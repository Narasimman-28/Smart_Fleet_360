import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';

const router = Router();

router.use(authenticateToken);

// GET all Customers with booking count & revenue
router.get('/', requireRole(['Super Admin', 'Fleet Manager', 'Accountant']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const customers = await db.all(`
      SELECT 
        c.*,
        COUNT(b.id) as total_bookings,
        COALESCE(SUM(b.booking_amount), 0) as total_spent
      FROM customers c
      LEFT JOIN bookings b ON b.customer_id = c.id
      GROUP BY c.id
      ORDER BY total_spent DESC
    `);
    res.json(customers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create Customer
router.post('/', requireRole(['Super Admin', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    if (!data.name || !data.phone) {
      res.status(400).json({ error: 'Customer name and phone number are required' });
      return;
    }

    await db.run(`
      INSERT INTO customers (id, name, phone, email, company_name, gst_number, address, city, state, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data.name, data.phone, data.email || null,
      data.company_name || null,
      data.gst_number || null,
      data.address || null,
      data.city || null,
      data.state || null,
      data.notes || ''
    ]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'CREATE_CUSTOMER',
      entity: 'Customer',
      entityId: id,
      newValues: data,
      ipAddress: req.ip
    });

    res.status(201).json({ message: 'Customer registered successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Customer
router.delete('/:id', requireRole(['Super Admin', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    // Unassign or nullify customer_id in bookings if needed
    await db.run('UPDATE bookings SET customer_id = NULL WHERE customer_id = ?', [id]);

    await db.run('DELETE FROM customers WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_CUSTOMER',
      entity: 'Customer',
      entityId: String(id),
      oldValues: customer,
      ipAddress: req.ip
    });

    res.json({ message: 'Customer record deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

