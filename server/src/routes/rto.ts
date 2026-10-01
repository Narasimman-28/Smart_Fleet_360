import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';
import { NotificationEngine } from '../services/notificationEngine';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['Super Admin', 'Compliance Manager', 'Fleet Manager', 'Accountant']));

// GET all RTO records
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const records = await db.all(`
      SELECT 
        r.*,
        v.vehicle_number,
        v.vehicle_type,
        v.make,
        v.model,
        v.status as vehicle_status
      FROM rto_records r
      JOIN vehicles v ON r.vehicle_id = v.id
      ORDER BY r.registration_validity ASC
    `);
    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST / PUT RTO Record
router.post('/', requireRole(['Super Admin', 'Compliance Manager', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = data.id || `rto-${data.vehicle_id}`;

    await db.run(`
      INSERT INTO rto_records (
        id, vehicle_id, rc_number, registration_date, registration_validity,
        rto_office, rto_code, owner_name, owner_phone, owner_address,
        vehicle_class, fuel_type, chassis_number, engine_number,
        tax_valid_upto, permit_valid_upto, fitness_valid_upto,
        hypothecation_bank, hypothecation_status, status, document_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(vehicle_id) DO UPDATE SET
        rc_number = excluded.rc_number,
        registration_date = excluded.registration_date,
        registration_validity = excluded.registration_validity,
        rto_office = excluded.rto_office,
        rto_code = excluded.rto_code,
        tax_valid_upto = excluded.tax_valid_upto,
        permit_valid_upto = excluded.permit_valid_upto,
        fitness_valid_upto = excluded.fitness_valid_upto,
        hypothecation_bank = excluded.hypothecation_bank,
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP
    `, [
      id, data.vehicle_id, data.rc_number, data.registration_date, data.registration_validity,
      data.rto_office, data.rto_code, data.owner_name || '', data.owner_phone, data.owner_address,
      data.vehicle_class, data.fuel_type, data.chassis_number, data.engine_number,
      data.tax_valid_upto, data.permit_valid_upto, data.fitness_valid_upto,
      data.hypothecation_bank, data.hypothecation_status || 'Active', data.status || 'Active', data.document_url
    ]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'UPDATE_RTO',
      entity: 'RTO',
      entityId: id,
      newValues: data,
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.json({ message: 'RTO details updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE RTO Record
router.delete('/:id', requireRole(['Super Admin', 'Compliance Manager', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const record = await db.get('SELECT * FROM rto_records WHERE id = ? OR vehicle_id = ?', [id, id]);
    if (!record) {
      res.status(404).json({ error: 'RTO record not found' });
      return;
    }

    if (record.document_url) {
      const { deleteUploadedFile } = await import('../utils/storage');
      deleteUploadedFile(record.document_url);
    }

    await db.run('DELETE FROM rto_records WHERE id = ?', [record.id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_RTO',
      entity: 'RTO',
      entityId: String(record.id),
      oldValues: record,
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.json({ message: 'RTO record deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

