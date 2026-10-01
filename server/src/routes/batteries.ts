import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['Super Admin', 'Mechanic', 'Fleet Manager']));

// GET all Batteries
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { vehicle_id } = req.query;
    let query = `
      SELECT 
        b.*,
        v.vehicle_number,
        v.vehicle_type
      FROM battery_records b
      JOIN vehicles v ON b.vehicle_id = v.id
    `;
    const params: any[] = [];
    if (vehicle_id) {
      query += ` WHERE b.vehicle_id = ?`;
      params.push(vehicle_id);
    }
    query += ` ORDER BY b.current_condition = 'Replace Soon' DESC, b.current_condition = 'Weak' DESC, b.created_at DESC`;

    const batteries = await db.all(query, params);
    res.json(batteries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Add / Replace Battery
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = `bat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    if (!data.vehicle_id || !data.battery_number || !data.brand || !data.warranty_expiry) {
      res.status(400).json({ error: 'Vehicle, battery serial number, brand, and warranty expiry are required' });
      return;
    }

    await db.run(`
      INSERT INTO battery_records (
        id, vehicle_id, battery_number, brand, model, purchase_date,
        warranty_expiry, installation_date, current_condition, cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data.vehicle_id, data.battery_number, data.brand,
      data.model || '',
      data.purchase_date || new Date().toISOString().split('T')[0],
      data.warranty_expiry,
      data.installation_date || new Date().toISOString().split('T')[0],
      data.current_condition || 'Healthy',
      parseFloat(data.cost) || 0
    ]);

    if (parseFloat(data.cost) > 0) {
      await db.run(`
        INSERT INTO expenses (id, vehicle_id, category, amount, expense_date, description, payment_method, approved_by)
        VALUES (?, ?, 'Battery Replacement', ?, ?, ?, 'UPI', ?)
      `, [
        `exp-bat-${id}`, data.vehicle_id, parseFloat(data.cost),
        data.installation_date || new Date().toISOString().split('T')[0],
        `New Battery Installation (${data.brand} - ${data.battery_number})`,
        req.user?.name || 'Administrator'
      ]);
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'ADD_BATTERY_RECORD',
      entity: 'Battery',
      entityId: id,
      newValues: data,
      ipAddress: req.ip
    });

    res.status(201).json({ message: 'Battery replacement recorded successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Battery Record
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const battery = await db.get('SELECT * FROM battery_records WHERE id = ?', [id]);
    if (!battery) {
      res.status(404).json({ error: 'Battery record not found' });
      return;
    }

    await db.run('DELETE FROM expenses WHERE id = ?', [`exp-bat-${id}`]);
    await db.run('DELETE FROM battery_records WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_BATTERY_RECORD',
      entity: 'Battery',
      entityId: String(id),
      oldValues: battery,
      ipAddress: req.ip
    });

    res.json({ message: 'Battery record deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
