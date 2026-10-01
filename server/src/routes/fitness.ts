import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';
import { NotificationEngine } from '../services/notificationEngine';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['Super Admin', 'Compliance Manager', 'Fleet Manager', 'Accountant']));

// GET all fitness records
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const records = await db.all(`
      SELECT 
        f.*,
        v.vehicle_number,
        v.vehicle_type,
        v.make,
        v.model,
        (julianday(f.expiry_date) - julianday('now')) as raw_days_remaining
      FROM fitness_records f
      JOIN vehicles v ON f.vehicle_id = v.id
      ORDER BY f.expiry_date ASC
    `);

    const formatted = records.map(r => {
      const days = Math.ceil(r.raw_days_remaining);
      let calculatedStatus = 'Active';
      if (days < 0) calculatedStatus = 'Expired';
      else if (days <= 7) calculatedStatus = 'Urgent Renewal';
      else if (days <= 30) calculatedStatus = 'Expiring Soon';

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

// POST Add / Renew Fitness Certificate
router.post('/', requireRole(['Super Admin', 'Compliance Manager', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = `fit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    if (!data.vehicle_id || !data.certificate_number || !data.expiry_date) {
      res.status(400).json({ error: 'Vehicle, certificate number, and expiry date are required' });
      return;
    }

    await db.run(`
      INSERT INTO fitness_records (
        id, vehicle_id, certificate_number, issue_date, expiry_date,
        inspection_date, testing_center, vehicle_class, status, certificate_document_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data.vehicle_id, data.certificate_number,
      data.issue_date || new Date().toISOString().split('T')[0],
      data.expiry_date,
      data.inspection_date || new Date().toISOString().split('T')[0],
      data.testing_center || 'Automated Testing Station',
      data.vehicle_class || 'Commercial Transport',
      data.status || 'Active',
      data.certificate_document_url || null
    ]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'RENEW_FITNESS',
      entity: 'Fitness',
      entityId: id,
      newValues: data,
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.status(201).json({ message: 'Fitness certificate recorded successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Fitness Certificate
router.delete('/:id', requireRole(['Super Admin', 'Compliance Manager', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const record = await db.get('SELECT * FROM fitness_records WHERE id = ?', [id]);
    if (!record) {
      res.status(404).json({ error: 'Fitness record not found' });
      return;
    }

    if (record.certificate_document_url) {
      const { deleteUploadedFile } = await import('../utils/storage');
      deleteUploadedFile(record.certificate_document_url);
    }

    await db.run('DELETE FROM fitness_records WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_FITNESS',
      entity: 'Fitness',
      entityId: String(id),
      oldValues: record,
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.json({ message: 'Fitness certificate deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

