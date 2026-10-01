import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['Super Admin', 'Fleet Manager']));

// GET all Fleets with vehicle counts
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const fleets = await db.all(`
      SELECT 
        f.*,
        COUNT(v.id) as vehicle_count,
        SUM(CASE WHEN v.status = 'On Trip' THEN 1 ELSE 0 END) as on_trip_count,
        SUM(CASE WHEN v.status = 'Available' THEN 1 ELSE 0 END) as available_count
      FROM fleets f
      LEFT JOIN vehicles v ON v.fleet_id = f.id
      GROUP BY f.id
      ORDER BY f.name ASC
    `);
    res.json(fleets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create Fleet Group
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = `flt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    if (!data.name || !data.fleet_type) {
      res.status(400).json({ error: 'Fleet name and type are required' });
      return;
    }

    await db.run(`
      INSERT INTO fleets (id, name, description, fleet_type, manager_name, color_code)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      id, data.name, data.description || '', data.fleet_type,
      data.manager_name || req.user?.name || 'Fleet Manager',
      data.color_code || '#3B82F6'
    ]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'CREATE_FLEET',
      entity: 'Fleet',
      entityId: id,
      newValues: data,
      ipAddress: req.ip
    });

    res.status(201).json({ message: 'Fleet group created successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Fleet
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const fleet = await db.get('SELECT * FROM fleets WHERE id = ?', [id]);
    if (!fleet) {
      res.status(404).json({ error: 'Fleet not found' });
      return;
    }

    // Unassign vehicles in this fleet
    await db.run('UPDATE vehicles SET fleet_id = NULL WHERE fleet_id = ?', [id]);

    await db.run('DELETE FROM fleets WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_FLEET',
      entity: 'Fleet',
      entityId: String(id),
      oldValues: fleet,
      ipAddress: req.ip
    });

    res.json({ message: 'Fleet group deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

