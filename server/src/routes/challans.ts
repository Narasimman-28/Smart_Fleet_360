import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';
import { NotificationEngine } from '../services/notificationEngine';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['Super Admin', 'Compliance Manager', 'Fleet Manager', 'Accountant']));

// GET all Traffic Challans
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, vehicle_id } = req.query;

    let query = `
      SELECT 
        c.*,
        v.vehicle_number,
        v.vehicle_type,
        v.make,
        v.model
      FROM challans c
      JOIN vehicles v ON c.vehicle_id = v.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'All') {
      if (status === 'Overdue') {
        query += ` AND (c.payment_status = 'Overdue' OR (c.payment_status = 'Pending' AND c.due_date < date('now')))`;
      } else {
        query += ` AND c.payment_status = ?`;
        params.push(status);
      }
    }

    if (vehicle_id) {
      query += ` AND c.vehicle_id = ?`;
      params.push(vehicle_id);
    }

    query += ` ORDER BY c.date DESC`;

    const challans = await db.all(query, params);
    res.json(challans);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Add New Challan
router.post('/', requireRole(['Super Admin', 'Compliance Manager', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = `chl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    if (!data.vehicle_id || !data.challan_number || !data.offence || !data.amount || !data.due_date) {
      res.status(400).json({ error: 'Vehicle, challan number, offence, amount, and due date are required' });
      return;
    }

    await db.run(`
      INSERT INTO challans (
        id, vehicle_id, challan_number, date, time, location,
        offence, amount, due_date, payment_status, notes, challan_document_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data.vehicle_id, data.challan_number,
      data.date || new Date().toISOString().split('T')[0],
      data.time || '12:00',
      data.location || 'Traffic Signal',
      data.offence,
      data.amount,
      data.due_date,
      data.payment_status || 'Pending',
      data.notes || '',
      data.challan_document_url || 'https://smartfleet360.internal/docs/challan-notice.pdf'
    ]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'ADD_CHALLAN',
      entity: 'Challan',
      entityId: id,
      newValues: data,
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.status(201).json({ message: 'Challan recorded successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST/PATCH Pay / Settle Challan
router.all('/:id/pay', requireRole(['Super Admin', 'Compliance Manager', 'Fleet Manager', 'Accountant']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { id } = req.params;
    const { payment_mode, receipt_number } = req.body;

    const challan = await db.get('SELECT * FROM challans WHERE id = ?', [id]);
    if (!challan) {
      res.status(404).json({ error: 'Challan not found' });
      return;
    }

    const payDate = new Date().toISOString().split('T')[0];
    const receiptNo = receipt_number || `REC-CHL-${Date.now()}`;

    await db.run(`
      UPDATE challans SET
        payment_status = 'Paid',
        payment_date = ?,
        receipt_number = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [payDate, receiptNo, id]);

    // Record into Payments
    await db.run(`
      INSERT INTO payments (id, reference_type, reference_id, vehicle_id, amount, payment_date, payment_mode, status, notes)
      VALUES (?, 'Challan', ?, ?, ?, ?, ?, 'Paid', ?)
    `, [
      `pay-chl-${Date.now()}`,
      id,
      challan.vehicle_id,
      challan.amount,
      payDate,
      payment_mode || 'Online Portal',
      `Payment for Traffic Challan ${challan.challan_number}`
    ]);

    // Record into Expenses
    await db.run(`
      INSERT INTO expenses (id, vehicle_id, category, amount, expense_date, description, payment_method, approved_by)
      VALUES (?, ?, 'Challan', ?, ?, ?, ?, ?)
    `, [
      `exp-chl-${Date.now()}`,
      challan.vehicle_id,
      challan.amount,
      payDate,
      `Traffic Fine Settled (${challan.offence}) - Challan: ${challan.challan_number}`,
      payment_mode || 'Online Portal',
      req.user?.name || 'Administrator'
    ]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'PAY_CHALLAN',
      entity: 'Challan',
      entityId: String(id),
      newValues: { payment_status: 'Paid', receipt_number: receiptNo, amount: challan.amount },
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.json({ message: `Challan ${challan.challan_number} paid successfully. Receipt: ${receiptNo}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Challan
router.delete('/:id', requireRole(['Super Admin', 'Compliance Manager', 'Fleet Manager', 'Accountant']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const challan = await db.get('SELECT * FROM challans WHERE id = ?', [id]);
    if (!challan) {
      res.status(404).json({ error: 'Challan not found' });
      return;
    }

    if (challan.challan_document_url) {
      const { deleteUploadedFile } = await import('../utils/storage');
      deleteUploadedFile(challan.challan_document_url);
    }

    // Delete associated payments and expenses if any
    await db.run('DELETE FROM payments WHERE reference_id = ? AND reference_type = ?', [id, 'Challan']);
    await db.run('DELETE FROM expenses WHERE description LIKE ?', [`%${challan.challan_number}%`]);

    await db.run('DELETE FROM challans WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_CHALLAN',
      entity: 'Challan',
      entityId: String(id),
      oldValues: challan,
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.json({ message: 'Traffic challan record deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

