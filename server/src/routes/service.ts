import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';
import { NotificationEngine } from '../services/notificationEngine';
import { deleteUploadedFile } from '../utils/storage';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['Super Admin', 'Mechanic', 'Fleet Manager']));

// GET all service records
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { vehicle_id } = req.query;
    let query = `
      SELECT 
        s.*,
        v.vehicle_number,
        v.vehicle_type,
        v.make,
        v.model,
        v.odometer_reading as current_vehicle_odometer
      FROM service_records s
      JOIN vehicles v ON s.vehicle_id = v.id
    `;
    const params: any[] = [];
    if (vehicle_id) {
      query += ` WHERE s.vehicle_id = ?`;
      params.push(vehicle_id);
    }
    query += ` ORDER BY s.service_date DESC`;

    const records = await db.all(query, params);
    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Add Service Record
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = `srv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    if (!data.vehicle_id || !data.service_type || !data.workshop_name || !data.total_cost) {
      res.status(400).json({ error: 'Vehicle, service type, workshop name, and total cost are required' });
      return;
    }

    const curOdo = parseFloat(data.current_odometer) || 0;
    const nextOdo = parseFloat(data.next_service_odometer) || (curOdo + 10000);
    const totalCost = parseFloat(data.total_cost);

    await db.run(`
      INSERT INTO service_records (
        id, vehicle_id, service_date, service_type, current_odometer,
        next_service_odometer, next_service_date, mechanic_name, workshop_name,
        parts_changed, labour_cost, parts_cost, total_cost, service_notes,
        service_status, invoice_document_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data.vehicle_id,
      data.service_date || new Date().toISOString().split('T')[0],
      data.service_type,
      curOdo,
      nextOdo,
      data.next_service_date || null,
      data.mechanic_name || req.user?.name || 'Workshop Mechanic',
      data.workshop_name,
      data.parts_changed || 'Standard Service Parts',
      parseFloat(data.labour_cost) || 0,
      parseFloat(data.parts_cost) || 0,
      totalCost,
      data.service_notes || '',
      data.service_status || 'Completed',
      data.invoice_document_url || null
    ]);

    // Update vehicle odometer & maintenance status
    if (curOdo > 0) {
      await db.run('UPDATE vehicles SET odometer_reading = ? WHERE id = ?', [curOdo, data.vehicle_id]);
    }
    if (data.service_status === 'In Progress') {
      await db.run("UPDATE vehicles SET status = 'Under Maintenance' WHERE id = ?", [data.vehicle_id]);
    } else {
      await db.run("UPDATE vehicles SET status = 'Available' WHERE id = ? AND status = 'Under Maintenance'", [data.vehicle_id]);
    }

    // Auto record into expenses
    if (totalCost > 0) {
      await db.run(`
        INSERT INTO expenses (id, vehicle_id, category, amount, expense_date, description, payment_method, approved_by)
        VALUES (?, ?, 'Maintenance', ?, ?, ?, 'Bank Transfer', ?)
      `, [
        `exp-srv-${id}`, data.vehicle_id, totalCost,
        data.service_date || new Date().toISOString().split('T')[0],
        `Workshop Service: ${data.service_type} at ${data.workshop_name}`,
        req.user?.name || 'Administrator'
      ]);
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'SERVICE_RECORD_CREATED',
      entity: 'Service',
      entityId: id,
      newValues: { type: data.service_type, workshop: data.workshop_name, cost: totalCost },
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.status(201).json({ message: 'Service record logged successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Service Record
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const record = await db.get('SELECT * FROM service_records WHERE id = ?', [id]);
    if (!record) {
      res.status(404).json({ error: 'Service record not found' });
      return;
    }

    if (record.invoice_document_url) {
      deleteUploadedFile(record.invoice_document_url);
    }

    // Delete auto-recorded expense
    await db.run('DELETE FROM expenses WHERE id = ?', [`exp-srv-${id}`]);
    await db.run('DELETE FROM service_records WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_SERVICE_RECORD',
      entity: 'Service',
      entityId: String(id),
      oldValues: record,
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.json({ message: 'Service record deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
