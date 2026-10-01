import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';
import { NotificationEngine } from '../services/notificationEngine';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['Super Admin', 'Compliance Manager', 'Fleet Manager', 'Accountant']));

// GET all insurance records with computed remaining days
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const records = await db.all(`
      SELECT 
        ir.*,
        v.vehicle_number,
        v.vehicle_type,
        v.make,
        v.model,
        (julianday(ir.policy_expiry_date) - julianday('now')) as raw_days_remaining
      FROM insurance_records ir
      JOIN vehicles v ON ir.vehicle_id = v.id
      ORDER BY ir.policy_expiry_date ASC
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

// POST Add / Renew Insurance Policy
router.post('/', requireRole(['Super Admin', 'Compliance Manager', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = `ins-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    if (!data.vehicle_id || !data.insurance_company || !data.policy_number || !data.policy_expiry_date) {
      res.status(400).json({ error: 'Vehicle, insurance company, policy number, and expiry date are required' });
      return;
    }

    await db.run(`
      INSERT INTO insurance_records (
        id, vehicle_id, insurance_company, policy_number, insurance_type,
        policy_start_date, policy_expiry_date, premium_amount, insured_declared_value,
        agent_name, agent_contact, claim_details, status, policy_document_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data.vehicle_id, data.insurance_company, data.policy_number,
      data.insurance_type || 'Comprehensive',
      data.policy_start_date || new Date().toISOString().split('T')[0],
      data.policy_expiry_date,
      data.premium_amount || 0,
      data.insured_declared_value || 0,
      data.agent_name || null,
      data.agent_contact || null,
      data.claim_details || 'No claims',
      data.status || 'Active',
      data.policy_document_url || null
    ]);

    // Update vehicle's insurance provider & policy number
    await db.run(`
      UPDATE vehicles SET insurance_provider = ?, policy_number = ? WHERE id = ?
    `, [data.insurance_company, data.policy_number, data.vehicle_id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'RENEW_INSURANCE',
      entity: 'Insurance',
      entityId: id,
      newValues: data,
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.status(201).json({ message: 'Insurance policy recorded successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Insurance Policy
router.delete('/:id', requireRole(['Super Admin', 'Compliance Manager', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const record = await db.get('SELECT * FROM insurance_records WHERE id = ?', [id]);
    if (!record) {
      res.status(404).json({ error: 'Insurance record not found' });
      return;
    }

    if (record.policy_document_url) {
      const { deleteUploadedFile } = await import('../utils/storage');
      deleteUploadedFile(record.policy_document_url);
    }

    await db.run('DELETE FROM insurance_records WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_INSURANCE',
      entity: 'Insurance',
      entityId: String(id),
      oldValues: record,
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.json({ message: 'Insurance record deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

