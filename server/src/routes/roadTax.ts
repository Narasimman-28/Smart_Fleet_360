import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';
import { NotificationEngine } from '../services/notificationEngine';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['Super Admin', 'Compliance Manager', 'Fleet Manager', 'Accountant']));

// GET all Road Tax records
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const records = await db.all(`
      SELECT 
        rt.*,
        v.vehicle_number,
        v.vehicle_type,
        v.make,
        v.model,
        (julianday(rt.next_due_date) - julianday('now')) as raw_days_remaining
      FROM road_tax_records rt
      JOIN vehicles v ON rt.vehicle_id = v.id
      ORDER BY rt.next_due_date ASC
    `);

    const formatted = records.map(r => {
      const days = Math.ceil(r.raw_days_remaining);
      let calculatedStatus = 'Active';
      if (days < 0) calculatedStatus = 'Overdue';
      else if (days <= 7) calculatedStatus = 'Urgent Due';
      else if (days <= 30) calculatedStatus = 'Due Soon';

      return {
        ...r,
        days_remaining: days,
        calculated_status: calculatedStatus
      };
    });

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Record Road Tax Payment
router.post('/', requireRole(['Super Admin', 'Compliance Manager', 'Fleet Manager', 'Accountant']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = `tax-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    if (!data.vehicle_id || !data.tax_amount || !data.next_due_date || !data.receipt_number) {
      res.status(400).json({ error: 'Vehicle, tax amount, next due date, and receipt number are required' });
      return;
    }

    await db.run(`
      INSERT INTO road_tax_records (
        id, vehicle_id, tax_type, tax_amount, payment_date, next_due_date,
        receipt_number, payment_mode, status, tax_document_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data.vehicle_id,
      data.tax_type || 'Annual',
      data.tax_amount,
      data.payment_date || new Date().toISOString().split('T')[0],
      data.next_due_date,
      data.receipt_number,
      data.payment_mode || 'Online Vahan Portal',
      data.status || 'Active',
      data.tax_document_url || null
    ]);

    // Also record into expenses ledger
    await db.run(`
      INSERT INTO expenses (id, vehicle_id, category, amount, expense_date, description, payment_method, approved_by)
      VALUES (?, ?, 'Road Tax', ?, ?, ?, ?, ?)
    `, [
      `exp-tax-${id}`, data.vehicle_id, data.tax_amount,
      data.payment_date || new Date().toISOString().split('T')[0],
      `Road Tax Payment (${data.tax_type}) - Receipt: ${data.receipt_number}`,
      data.payment_mode || 'Online Portal',
      req.user?.name || 'Administrator'
    ]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'PAY_ROAD_TAX',
      entity: 'RoadTax',
      entityId: id,
      newValues: data,
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.status(201).json({ message: 'Road Tax recorded successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Road Tax Record
router.delete('/:id', requireRole(['Super Admin', 'Compliance Manager', 'Fleet Manager', 'Accountant']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const record = await db.get('SELECT * FROM road_tax_records WHERE id = ?', [id]);
    if (!record) {
      res.status(404).json({ error: 'Road Tax record not found' });
      return;
    }

    if (record.tax_document_url) {
      const { deleteUploadedFile } = await import('../utils/storage');
      deleteUploadedFile(record.tax_document_url);
    }

    // Delete linked expense if created
    await db.run('DELETE FROM expenses WHERE id = ?', [`exp-tax-${id}`]);

    await db.run('DELETE FROM road_tax_records WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_ROAD_TAX',
      entity: 'RoadTax',
      entityId: String(id),
      oldValues: record,
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.json({ message: 'Road Tax record deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

