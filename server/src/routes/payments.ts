import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['Super Admin', 'Accountant', 'Fleet Manager']));

// GET all Payments
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, reference_type } = req.query;
    let query = `
      SELECT 
        p.*,
        v.vehicle_number,
        v.vehicle_type
      FROM payments p
      LEFT JOIN vehicles v ON p.vehicle_id = v.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'All') {
      query += ` AND p.status = ?`;
      params.push(status);
    }
    if (reference_type && reference_type !== 'All') {
      query += ` AND p.reference_type = ?`;
      params.push(reference_type);
    }

    query += ` ORDER BY p.payment_date DESC LIMIT 150`;

    const payments = await db.all(query, params);
    res.json(payments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Record Payment
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const amt = parseFloat(data.amount);

    if (!data.reference_type || !amt) {
      res.status(400).json({ error: 'Reference type and amount are required' });
      return;
    }

    await db.run(`
      INSERT INTO payments (
        id, reference_type, reference_id, vehicle_id, amount,
        payment_date, payment_mode, transaction_id, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data.reference_type, data.reference_id || null, data.vehicle_id || null,
      amt,
      data.payment_date || new Date().toISOString().split('T')[0],
      data.payment_mode || 'Bank Transfer',
      data.transaction_id || `TXN-${Date.now()}`,
      data.status || 'Paid',
      data.notes || ''
    ]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'RECORD_PAYMENT',
      entity: 'Payment',
      entityId: id,
      newValues: { reference: data.reference_type, amount: amt },
      ipAddress: req.ip
    });

    res.status(201).json({ message: 'Payment recorded successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Payment
router.delete('/:id', requireRole(['Super Admin', 'Accountant', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const payment = await db.get('SELECT * FROM payments WHERE id = ?', [id]);
    if (!payment) {
      res.status(404).json({ error: 'Payment record not found' });
      return;
    }

    await db.run('DELETE FROM payments WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_PAYMENT',
      entity: 'Payment',
      entityId: String(id),
      oldValues: payment,
      ipAddress: req.ip
    });

    res.json({ message: 'Payment record deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

