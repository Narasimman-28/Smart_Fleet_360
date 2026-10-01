import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { NotificationEngine } from '../services/notificationEngine';

const router = Router();

router.use(authenticateToken);

// GET all notifications
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { unread_only, severity, type, vehicle_id } = req.query;

    let query = `SELECT * FROM notifications WHERE 1=1`;
    const params: any[] = [];

    if (unread_only === 'true') {
      query += ` AND is_read = 0`;
    }
    if (severity && severity !== 'All') {
      query += ` AND severity = ?`;
      params.push(severity);
    }
    if (type && type !== 'All') {
      query += ` AND type = ?`;
      params.push(type);
    }
    if (vehicle_id) {
      query += ` AND vehicle_id = ?`;
      params.push(vehicle_id);
    }

    query += ` ORDER BY 
      CASE severity 
        WHEN 'EXPIRED' THEN 1 
        WHEN 'URGENT' THEN 2 
        WHEN 'WARNING' THEN 3 
        ELSE 4 
      END, created_at DESC LIMIT 200`;

    const notifications = await db.all(query, params);
    const unreadCount = await db.get('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0');

    res.json({
      notifications: notifications || [],
      unreadCount: unreadCount?.count || 0
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH Mark Single Notification as Read
router.patch('/:id/read', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    res.json({ message: 'Marked as read' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Mark ALL as Read
router.post('/mark-all-read', async (req: Request, res: Response): Promise<void> => {
  try {
    await db.run('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
    res.json({ message: 'All notifications marked as read' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Single Notification
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM notifications WHERE id = ?', [id]);
    res.json({ message: 'Notification deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Trigger on-demand compliance re-evaluation
router.post('/evaluate', requireRole(['Super Admin', 'Fleet Manager', 'Compliance Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await NotificationEngine.runEvaluation();
    res.json({ message: 'Notification evaluation complete', ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Global Notification Settings
router.get('/settings', async (req: Request, res: Response): Promise<void> => {
  try {
    let settings = await db.get('SELECT * FROM notification_settings LIMIT 1');
    if (!settings) {
      settings = {
        id: 'default-settings',
        insurance_reminder_days: 30,
        puc_reminder_days: 15,
        fitness_reminder_days: 30,
        permit_reminder_days: 20,
        road_tax_reminder_days: 10,
        driver_license_reminder_days: 30,
        fastag_min_balance_threshold: 500.0,
        service_km_threshold: 1000.0,
        maintenance_days_threshold: 15,
        booking_reminder_hours: 24,
        challan_reminder_days: 7,
        fuel_anomaly_threshold: 20.0,
        urgent_days_threshold: 7,
        warning_days_threshold: 30,
        info_days_threshold: 90,
        email_alerts_enabled: 1,
        sms_alerts_enabled: 0,
        push_alerts_enabled: 1
      };
    }
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Global Notification Settings
router.put('/settings', requireRole(['Super Admin', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    await db.run(`
      INSERT INTO notification_settings (
        id,
        insurance_reminder_days,
        puc_reminder_days,
        fitness_reminder_days,
        permit_reminder_days,
        road_tax_reminder_days,
        driver_license_reminder_days,
        fastag_min_balance_threshold,
        service_km_threshold,
        maintenance_days_threshold,
        booking_reminder_hours,
        challan_reminder_days,
        fuel_anomaly_threshold,
        urgent_days_threshold,
        warning_days_threshold,
        info_days_threshold,
        email_alerts_enabled,
        sms_alerts_enabled,
        push_alerts_enabled,
        updated_at
      ) VALUES (
        'default-settings', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        insurance_reminder_days = excluded.insurance_reminder_days,
        puc_reminder_days = excluded.puc_reminder_days,
        fitness_reminder_days = excluded.fitness_reminder_days,
        permit_reminder_days = excluded.permit_reminder_days,
        road_tax_reminder_days = excluded.road_tax_reminder_days,
        driver_license_reminder_days = excluded.driver_license_reminder_days,
        fastag_min_balance_threshold = excluded.fastag_min_balance_threshold,
        service_km_threshold = excluded.service_km_threshold,
        maintenance_days_threshold = excluded.maintenance_days_threshold,
        booking_reminder_hours = excluded.booking_reminder_hours,
        challan_reminder_days = excluded.challan_reminder_days,
        fuel_anomaly_threshold = excluded.fuel_anomaly_threshold,
        urgent_days_threshold = excluded.urgent_days_threshold,
        warning_days_threshold = excluded.warning_days_threshold,
        info_days_threshold = excluded.info_days_threshold,
        email_alerts_enabled = excluded.email_alerts_enabled,
        sms_alerts_enabled = excluded.sms_alerts_enabled,
        push_alerts_enabled = excluded.push_alerts_enabled,
        updated_at = CURRENT_TIMESTAMP
    `, [
      parseInt(data.insurance_reminder_days) || 30,
      parseInt(data.puc_reminder_days) || 15,
      parseInt(data.fitness_reminder_days) || 30,
      parseInt(data.permit_reminder_days) || 20,
      parseInt(data.road_tax_reminder_days) || 10,
      parseInt(data.driver_license_reminder_days) || 30,
      parseFloat(data.fastag_min_balance_threshold) || 500.0,
      parseFloat(data.service_km_threshold) || 1000.0,
      parseInt(data.maintenance_days_threshold) || 15,
      parseInt(data.booking_reminder_hours) || 24,
      parseInt(data.challan_reminder_days) || 7,
      parseFloat(data.fuel_anomaly_threshold) || 20.0,
      parseInt(data.urgent_days_threshold) || 7,
      parseInt(data.warning_days_threshold) || 30,
      parseInt(data.info_days_threshold) || 90,
      data.email_alerts_enabled ? 1 : 0,
      data.sms_alerts_enabled ? 1 : 0,
      data.push_alerts_enabled ? 1 : 0
    ]);

    // Re-evaluate with new threshold rules
    const evalRes = await NotificationEngine.runEvaluation();

    res.json({
      message: 'Global notification & threshold settings updated and engine evaluated successfully.',
      ...evalRes
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Reset Global Settings to Defaults
router.post('/settings/reset', requireRole(['Super Admin', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await db.run(`
      UPDATE notification_settings SET
        insurance_reminder_days = 30,
        puc_reminder_days = 15,
        fitness_reminder_days = 30,
        permit_reminder_days = 20,
        road_tax_reminder_days = 10,
        driver_license_reminder_days = 30,
        fastag_min_balance_threshold = 500.0,
        service_km_threshold = 1000.0,
        maintenance_days_threshold = 15,
        booking_reminder_hours = 24,
        challan_reminder_days = 7,
        fuel_anomaly_threshold = 20.0,
        urgent_days_threshold = 7,
        warning_days_threshold = 30,
        info_days_threshold = 90,
        email_alerts_enabled = 1,
        sms_alerts_enabled = 0,
        push_alerts_enabled = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 'default-settings'
    `);

    await NotificationEngine.runEvaluation();
    res.json({ message: 'Settings reset to factory defaults.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Vehicle-Specific Threshold Overrides
router.get('/settings/vehicle/:vehicleId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { vehicleId } = req.params;
    const overrides = await db.get('SELECT * FROM vehicle_threshold_settings WHERE vehicle_id = ?', [vehicleId]);
    res.json(overrides || {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Vehicle-Specific Threshold Overrides
router.put('/settings/vehicle/:vehicleId', requireRole(['Super Admin', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { vehicleId } = req.params;
    const data = req.body;

    await db.run(`
      INSERT INTO vehicle_threshold_settings (
        vehicle_id,
        insurance_reminder_days,
        puc_reminder_days,
        fitness_reminder_days,
        permit_reminder_days,
        road_tax_reminder_days,
        fastag_min_balance_threshold,
        service_km_threshold,
        maintenance_days_threshold,
        fuel_anomaly_threshold,
        updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
      )
      ON CONFLICT(vehicle_id) DO UPDATE SET
        insurance_reminder_days = excluded.insurance_reminder_days,
        puc_reminder_days = excluded.puc_reminder_days,
        fitness_reminder_days = excluded.fitness_reminder_days,
        permit_reminder_days = excluded.permit_reminder_days,
        road_tax_reminder_days = excluded.road_tax_reminder_days,
        fastag_min_balance_threshold = excluded.fastag_min_balance_threshold,
        service_km_threshold = excluded.service_km_threshold,
        maintenance_days_threshold = excluded.maintenance_days_threshold,
        fuel_anomaly_threshold = excluded.fuel_anomaly_threshold,
        updated_at = CURRENT_TIMESTAMP
    `, [
      vehicleId,
      data.insurance_reminder_days !== undefined ? data.insurance_reminder_days : null,
      data.puc_reminder_days !== undefined ? data.puc_reminder_days : null,
      data.fitness_reminder_days !== undefined ? data.fitness_reminder_days : null,
      data.permit_reminder_days !== undefined ? data.permit_reminder_days : null,
      data.road_tax_reminder_days !== undefined ? data.road_tax_reminder_days : null,
      data.fastag_min_balance_threshold !== undefined ? data.fastag_min_balance_threshold : null,
      data.service_km_threshold !== undefined ? data.service_km_threshold : null,
      data.maintenance_days_threshold !== undefined ? data.maintenance_days_threshold : null,
      data.fuel_anomaly_threshold !== undefined ? data.fuel_anomaly_threshold : null
    ]);

    await NotificationEngine.runEvaluation();
    res.json({ message: `Custom thresholds updated for vehicle ${vehicleId}.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
