import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['Super Admin', 'Mechanic', 'Fleet Manager']));

// GET all Tyres
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { vehicle_id } = req.query;
    let query = `
      SELECT 
        t.*,
        v.vehicle_number,
        v.vehicle_type,
        v.odometer_reading as vehicle_odometer
      FROM tyre_records t
      JOIN vehicles v ON t.vehicle_id = v.id
    `;
    const params: any[] = [];
    if (vehicle_id) {
      query += ` WHERE t.vehicle_id = ?`;
      params.push(vehicle_id);
    }
    query += ` ORDER BY t.condition = 'Critical' DESC, t.condition = 'Worn' DESC, t.created_at DESC`;

    const tyres = await db.all(query, params);
    res.json(tyres);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Add / Replace Tyre
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = `tyr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    if (!data.vehicle_id || !data.tyre_position || !data.brand || !data.size) {
      res.status(400).json({ error: 'Vehicle, position, brand, and size are required' });
      return;
    }

    await db.run(`
      INSERT INTO tyre_records (
        id, vehicle_id, tyre_position, brand, model, size,
        purchase_date, purchase_cost, installation_date, current_km,
        expected_km, condition
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data.vehicle_id, data.tyre_position, data.brand,
      data.model || '',
      data.size,
      data.purchase_date || new Date().toISOString().split('T')[0],
      parseFloat(data.purchase_cost) || 0,
      data.installation_date || new Date().toISOString().split('T')[0],
      parseFloat(data.current_km) || 0,
      parseFloat(data.expected_km) || 80000,
      data.condition || 'Good'
    ]);

    if (parseFloat(data.purchase_cost) > 0) {
      await db.run(`
        INSERT INTO expenses (id, vehicle_id, category, amount, expense_date, description, payment_method, approved_by)
        VALUES (?, ?, 'Tyre Replacement', ?, ?, ?, 'UPI', ?)
      `, [
        `exp-tyr-${id}`, data.vehicle_id, parseFloat(data.purchase_cost),
        data.installation_date || new Date().toISOString().split('T')[0],
        `New Tyre (${data.brand} - ${data.tyre_position})`,
        req.user?.name || 'Administrator'
      ]);
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'ADD_TYRE_RECORD',
      entity: 'Tyre',
      entityId: id,
      newValues: data,
      ipAddress: req.ip
    });

    res.status(201).json({ message: 'Tyre replacement recorded successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Tyre Record
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tyre = await db.get('SELECT * FROM tyre_records WHERE id = ?', [id]);
    if (!tyre) {
      res.status(404).json({ error: 'Tyre record not found' });
      return;
    }

    await db.run('DELETE FROM expenses WHERE id = ?', [`exp-tyr-${id}`]);
    await db.run('DELETE FROM tyre_records WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_TYRE_RECORD',
      entity: 'Tyre',
      entityId: String(id),
      oldValues: tyre,
      ipAddress: req.ip
    });

    res.json({ message: 'Tyre record deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
