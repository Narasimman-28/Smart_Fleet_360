import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';
import { NotificationEngine } from '../services/notificationEngine';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['Super Admin', 'Compliance Manager', 'Fleet Manager', 'Accountant']));

// GET all Permits
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const records = await db.all(`
      SELECT 
        p.*,
        v.vehicle_number,
        v.vehicle_type,
        v.make,
        v.model,
        (julianday(p.expiry_date) - julianday('now')) as raw_days_remaining
      FROM permits p
      JOIN vehicles v ON p.vehicle_id = v.id
      ORDER BY p.expiry_date ASC
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

// POST Add / Renew Permit
router.post('/', requireRole(['Super Admin', 'Compliance Manager', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = `perm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    if (!data.vehicle_id || !data.permit_number || !data.permit_type || !data.expiry_date) {
      res.status(400).json({ error: 'Vehicle, permit number, type, and expiry date are required' });
      return;
    }

    await db.run(`
      INSERT INTO permits (
        id, vehicle_id, permit_number, permit_type, issue_date, expiry_date,
        issuing_authority, permit_area, fee_paid, status, permit_document_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data.vehicle_id, data.permit_number, data.permit_type,
      data.issue_date || new Date().toISOString().split('T')[0],
      data.expiry_date,
      data.issuing_authority || 'State Transport Authority',
      data.permit_area || 'All India / State Wide',
      data.fee_paid || 0,
      data.status || 'Active',
      data.permit_document_url || null
    ]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'RENEW_PERMIT',
      entity: 'Permit',
      entityId: id,
      newValues: data,
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.status(201).json({ message: 'Permit registered successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Permit
router.delete('/:id', requireRole(['Super Admin', 'Compliance Manager', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const record = await db.get('SELECT * FROM permits WHERE id = ?', [id]);
    if (!record) {
      res.status(404).json({ error: 'Permit record not found' });
      return;
    }

    if (record.permit_document_url) {
      const { deleteUploadedFile } = await import('../utils/storage');
      deleteUploadedFile(record.permit_document_url);
    }

    await db.run('DELETE FROM permits WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_PERMIT',
      entity: 'Permit',
      entityId: String(id),
      oldValues: record,
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.json({ message: 'Permit record deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

