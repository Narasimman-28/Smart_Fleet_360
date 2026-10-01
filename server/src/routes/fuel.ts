import { Router, Response } from 'express';
import { db } from '../db/database';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';
import { NotificationEngine } from '../services/notificationEngine';
import { deleteUploadedFile } from '../utils/storage';

const router = Router();

router.use(authenticateToken);

// GET all Fuel Logs
router.get('/', requireRole(['Super Admin', 'Fleet Manager', 'Accountant', 'Mechanic', 'Driver']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { vehicle_id, driver_id } = req.query;
    const userRole = req.user?.role;

    let query = `
      SELECT 
        f.*,
        v.vehicle_number,
        v.vehicle_type,
        v.make,
        v.model,
        d.name as driver_name
      FROM fuel_records f
      JOIN vehicles v ON f.vehicle_id = v.id
      LEFT JOIN drivers d ON f.driver_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // If Driver, only show fuel logs associated with that driver
    if (userRole === 'Driver') {
      query += ` AND (f.driver_id = ? OR d.email = ? OR d.id = ?)`;
      params.push(req.user?.id || '', req.user?.email || '', req.user?.id || '');
    }

    if (vehicle_id) {
      query += ` AND f.vehicle_id = ?`;
      params.push(vehicle_id);
    }
    if (driver_id) {
      query += ` AND f.driver_id = ?`;
      params.push(driver_id);
    }

    query += ` ORDER BY f.date DESC LIMIT 100`;

    const logs = await db.all(query, params);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Comprehensive Fuel Analytics & Efficiency Reports
router.get('/analytics', requireRole(['Super Admin', 'Fleet Manager', 'Accountant']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Total & Monthly Fuel Cost
    const totalStats = await db.get(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_cost,
        COALESCE(SUM(quantity_litres), 0) as total_litres,
        AVG(km_per_litre) as avg_km_per_litre,
        AVG(cost_per_km) as avg_cost_per_km
      FROM fuel_records
    `);

    const currentMonthStats = await db.get(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as month_cost,
        COALESCE(SUM(quantity_litres), 0) as month_litres
      FROM fuel_records
      WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
    `);

    // Vehicle-wise Breakdown
    const vehicleBreakdown = await db.all(`
      SELECT 
        v.vehicle_number,
        v.vehicle_type,
        v.fuel_type,
        COUNT(f.id) as refill_count,
        SUM(f.quantity_litres) as total_litres,
        SUM(f.total_amount) as total_spent,
        AVG(f.km_per_litre) as avg_mileage,
        AVG(f.cost_per_km) as avg_cost_per_km
      FROM vehicles v
      JOIN fuel_records f ON f.vehicle_id = v.id
      GROUP BY v.id
      ORDER BY total_spent DESC
    `);

    // Driver-wise Breakdown
    const driverBreakdown = await db.all(`
      SELECT 
        d.name as driver_name,
        COUNT(f.id) as trips_count,
        SUM(f.quantity_litres) as total_litres,
        SUM(f.total_amount) as total_spent,
        AVG(f.km_per_litre) as avg_mileage
      FROM drivers d
      JOIN fuel_records f ON f.driver_id = d.id
      GROUP BY d.id
      ORDER BY total_spent DESC
    `);

    // Monthly Fuel Consumption Trend
    const monthlyTrend = await db.all(`
      SELECT 
        strftime('%Y-%m', date) as month,
        SUM(total_amount) as cost,
        SUM(quantity_litres) as litres
      FROM fuel_records
      GROUP BY strftime('%Y-%m', date)
      ORDER BY month DESC
      LIMIT 6
    `);

    res.json({
      totalCost: totalStats?.total_cost || 0,
      totalLitres: totalStats?.total_litres || 0,
      avgKmPerLitre: parseFloat(Number(totalStats?.avg_km_per_litre || 0).toFixed(2)),
      avgCostPerKm: parseFloat(Number(totalStats?.avg_cost_per_km || 0).toFixed(2)),
      monthCost: currentMonthStats?.month_cost || 0,
      monthLitres: currentMonthStats?.month_litres || 0,
      vehicleBreakdown,
      driverBreakdown,
      monthlyTrend: monthlyTrend.reverse()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Add Fuel Record
router.post('/', requireRole(['Super Admin', 'Fleet Manager', 'Driver']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = `fl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const qty = parseFloat(data.quantity_litres);
    const price = parseFloat(data.price_per_litre);
    const odo = parseFloat(data.odometer_reading);
    const totalAmt = data.total_amount ? parseFloat(data.total_amount) : (qty * price);

    if (!data.vehicle_id || !qty || !price || !odo) {
      res.status(400).json({ error: 'Vehicle, fuel quantity, price per litre, and odometer reading are required' });
      return;
    }

    // Resolve previous fuel log to calculate mileage
    const lastFuelLog = await db.get(`
      SELECT odometer_reading FROM fuel_records 
      WHERE vehicle_id = ? 
      ORDER BY date DESC, created_at DESC 
      LIMIT 1
    `, [data.vehicle_id]);

    let kmPerLitre = 0;
    let costPerKm = 0;

    if (lastFuelLog && odo > lastFuelLog.odometer_reading) {
      const distance = odo - lastFuelLog.odometer_reading;
      kmPerLitre = parseFloat((distance / qty).toFixed(2));
      costPerKm = parseFloat((totalAmt / distance).toFixed(2));
    }

    // Auto resolve driver if not supplied
    let driverId = data.driver_id;
    if (!driverId && req.user?.role === 'Driver') {
      const d = await db.get('SELECT id FROM drivers WHERE email = ? OR id = ?', [req.user.email, req.user.id]);
      if (d) driverId = d.id;
    }

    const fuelStation = data.fuel_station || data.fuel_station_name || 'Fuel Station Refill';
    const paymentMethod = data.payment_method || data.payment_mode || 'Fuel Card';
    const receiptUrl = data.receipt_url || data.invoice_receipt_url || null;

    await db.run(`
      INSERT INTO fuel_records (
        id, vehicle_id, driver_id, fuel_type, date, fuel_station,
        quantity_litres, price_per_litre, total_amount, odometer_reading,
        km_per_litre, cost_per_km, payment_method, receipt_url, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data.vehicle_id, driverId || null,
      data.fuel_type || 'Diesel',
      data.date || new Date().toISOString().split('T')[0],
      fuelStation,
      qty, price, totalAmt, odo,
      kmPerLitre, costPerKm,
      paymentMethod,
      receiptUrl,
      data.notes || ''
    ]);

    // Update vehicle's odometer
    await db.run('UPDATE vehicles SET odometer_reading = ? WHERE id = ?', [odo, data.vehicle_id]);

    // Record into expenses ledger
    await db.run(`
      INSERT INTO expenses (id, vehicle_id, driver_id, category, amount, expense_date, description, payment_method, approved_by)
      VALUES (?, ?, ?, 'Fuel', ?, ?, ?, ?, ?)
    `, [
      `exp-fl-${id}`, data.vehicle_id, driverId || null, totalAmt,
      data.date || new Date().toISOString().split('T')[0],
      `Fuel Refill (${qty}L at ₹${price}/L) at ${fuelStation}`,
      paymentMethod,
      req.user?.name || 'Administrator'
    ]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'ADD_FUEL_RECORD',
      entity: 'Fuel',
      entityId: id,
      newValues: { vehicle_id: data.vehicle_id, litres: qty, amount: totalAmt, mileage: kmPerLitre },
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.status(201).json({ message: 'Fuel refill recorded and expense ledger updated successfully', id, kmPerLitre });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Fuel Log
router.delete('/:id', requireRole(['Super Admin', 'Fleet Manager', 'Accountant', 'Mechanic', 'Driver']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const log = await db.get('SELECT * FROM fuel_records WHERE id = ?', [id]);
    if (!log) {
      res.status(404).json({ error: 'Fuel log not found' });
      return;
    }

    // Role check for Driver
    if (req.user?.role === 'Driver') {
      const driver = await db.get('SELECT id FROM drivers WHERE email = ? OR id = ? OR phone = ?', [req.user.email, req.user.id, req.user.phone || '']);
      if (log.driver_id !== driver?.id) {
        res.status(403).json({ error: 'Access denied: You can only delete fuel logs entered by yourself.' });
        return;
      }
    }

    if (log.invoice_receipt_url) {
      deleteUploadedFile(log.invoice_receipt_url);
    }

    // Delete corresponding auto-generated expense
    await db.run('DELETE FROM expenses WHERE id = ?', [`exp-fl-${id}`]);
    await db.run('DELETE FROM fuel_records WHERE id = ?', [id]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'DELETE_FUEL_RECORD',
      entity: 'Fuel',
      entityId: String(id),
      oldValues: log,
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();
    res.json({ message: 'Fuel record deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
