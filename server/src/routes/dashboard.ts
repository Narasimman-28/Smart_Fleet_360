import { Router, Response } from 'express';
import { db } from '../db/database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/stats', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const userRole = user?.role || 'Driver';

    // 0. Fetch User-Configured Threshold Settings
    const settings = await db.get('SELECT * FROM notification_settings LIMIT 1') || {
      insurance_reminder_days: 30,
      puc_reminder_days: 15,
      fitness_reminder_days: 30,
      permit_reminder_days: 20,
      road_tax_reminder_days: 10,
      fastag_min_balance_threshold: 500,
      service_km_threshold: 1000
    };

    const insDays = `+${settings.insurance_reminder_days || 30} days`;
    const pucDays = `+${settings.puc_reminder_days || 15} days`;
    const fitDays = `+${settings.fitness_reminder_days || 30} days`;
    const permDays = `+${settings.permit_reminder_days || 20} days`;
    const taxDays = `+${settings.road_tax_reminder_days || 10} days`;
    const srvKm = settings.service_km_threshold || 1000;
    const fastagMin = settings.fastag_min_balance_threshold || 500;

    // Common Base Metrics
    const totalVehicles = await db.get('SELECT COUNT(*) as count FROM vehicles');
    const activeVehicles = await db.get("SELECT COUNT(*) as count FROM vehicles WHERE status IN ('Available', 'On Trip')");
    const onTripVehicles = await db.get("SELECT COUNT(*) as count FROM vehicles WHERE status = 'On Trip'");
    const availableVehicles = await db.get("SELECT COUNT(*) as count FROM vehicles WHERE status = 'Available'");
    const maintenanceVehicles = await db.get("SELECT COUNT(*) as count FROM vehicles WHERE status = 'Under Maintenance'");
    const inactiveVehicles = await db.get("SELECT COUNT(*) as count FROM vehicles WHERE status IN ('Inactive', 'Blocked', 'Sold', 'Retired')");

    // Vehicle Type Breakdown
    const carsCount = await db.get("SELECT COUNT(*) as count FROM vehicles WHERE vehicle_type = 'Car'");
    const busesCount = await db.get("SELECT COUNT(*) as count FROM vehicles WHERE vehicle_type IN ('Bus', 'School Bus', 'Tourist Vehicle')");
    const trucksCount = await db.get("SELECT COUNT(*) as count FROM vehicles WHERE vehicle_type IN ('Truck', 'Lorry', 'Goods Vehicle', 'Light Commercial')");
    const heavyCount = await db.get("SELECT COUNT(*) as count FROM vehicles WHERE vehicle_type IN ('Heavy Commercial', 'Construction Vehicle') OR vehicle_category = 'Special Purpose'");
    const commercialCount = await db.get("SELECT COUNT(*) as count FROM vehicles WHERE usage_type = 'Commercial'");

    // Compliance & Expiry Metrics
    const insuranceExpiringSoon = await db.get(`
      SELECT COUNT(*) as count FROM insurance_records 
      WHERE policy_expiry_date BETWEEN date('now') AND date('now', ?)
    `, [insDays]);
    const insuranceExpired = await db.get(`
      SELECT COUNT(*) as count FROM insurance_records 
      WHERE policy_expiry_date < date('now')
    `);

    const pucExpiringSoon = await db.get(`
      SELECT COUNT(*) as count FROM puc_records 
      WHERE expiry_date BETWEEN date('now') AND date('now', ?)
    `, [pucDays]);
    const pucExpired = await db.get(`
      SELECT COUNT(*) as count FROM puc_records 
      WHERE expiry_date < date('now')
    `);

    const fitnessExpiringSoon = await db.get(`
      SELECT COUNT(*) as count FROM fitness_records 
      WHERE expiry_date BETWEEN date('now') AND date('now', ?)
    `, [fitDays]);
    const fitnessExpired = await db.get(`
      SELECT COUNT(*) as count FROM fitness_records 
      WHERE expiry_date < date('now')
    `);

    const permitsExpiringSoon = await db.get(`
      SELECT COUNT(*) as count FROM permits 
      WHERE expiry_date BETWEEN date('now') AND date('now', ?)
    `, [permDays]);
    const permitsExpired = await db.get(`
      SELECT COUNT(*) as count FROM permits 
      WHERE expiry_date < date('now')
    `);

    const roadTaxDue = await db.get(`
      SELECT COUNT(*) as count FROM road_tax_records 
      WHERE next_due_date <= date('now', ?)
    `, [taxDays]);

    const fastagIssues = await db.get(`
      SELECT COUNT(*) as count FROM fastag_records 
      WHERE wallet_balance < ? OR status = 'Blocked'
    `, [fastagMin]);

    const pendingChallans = await db.get(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount 
      FROM challans WHERE payment_status != 'Paid'
    `);

    const overdueChallans = await db.get(`
      SELECT COUNT(*) as count FROM challans 
      WHERE payment_status = 'Overdue' OR (payment_status = 'Pending' AND due_date < date('now'))
    `);

    const serviceDue = await db.get(`
      SELECT COUNT(*) as count FROM vehicles v
      JOIN service_records s ON s.vehicle_id = v.id
      WHERE v.odometer_reading >= (s.next_service_odometer - ?)
    `, [srvKm]);

    const upcomingBookings = await db.get(`
      SELECT COUNT(*) as count FROM bookings 
      WHERE start_date >= date('now') AND booking_status IN ('Confirmed', 'Assigned')
    `);

    // Financial Metrics
    const fuelExpenses = await db.get(`
      SELECT COALESCE(SUM(total_amount), 0) as total FROM fuel_records 
      WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
    `);

    const maintenanceExpenses = await db.get(`
      SELECT COALESCE(SUM(total_cost), 0) as total FROM service_records 
      WHERE strftime('%Y-%m', service_date) = strftime('%Y-%m', 'now')
    `);

    const otherExpenses = await db.get(`
      SELECT COALESCE(SUM(amount), 0) as total FROM expenses 
      WHERE strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now')
    `);

    const pendingPayments = await db.get(`
      SELECT COALESCE(SUM(remaining_amount), 0) as total FROM bookings 
      WHERE payment_status != 'Paid' AND booking_status != 'Cancelled'
    `);

    // Category Distribution
    const categoryDistribution = await db.all(`
      SELECT vehicle_type, COUNT(*) as count 
      FROM vehicles 
      GROUP BY vehicle_type
    `);

    // Critical Alerts Feed
    const criticalAlerts = await db.all(`
      SELECT * FROM notifications 
      WHERE is_read = 0 
      ORDER BY 
        CASE severity 
          WHEN 'EXPIRED' THEN 1 
          WHEN 'URGENT' THEN 2 
          WHEN 'WARNING' THEN 3 
          ELSE 4 
        END, created_at DESC 
      LIMIT 8
    `);

    // Monthly Expenses Trend
    const monthlyTrend = await db.all(`
      SELECT 
        strftime('%Y-%m', expense_date) as month,
        SUM(amount) as total_amount
      FROM expenses
      GROUP BY strftime('%Y-%m', expense_date)
      ORDER BY month DESC
      LIMIT 6
    `);

    // Recent Activity Feed (Filtered by role)
    let recentActivity: any[] = [];
    if (userRole === 'Super Admin' || userRole === 'Fleet Manager') {
      recentActivity = await db.all(`
        SELECT id, user_id, user_name, action, entity, entity_id, created_at
        FROM audit_logs 
        ORDER BY created_at DESC 
        LIMIT 6
      `);
    } else {
      recentActivity = await db.all(`
        SELECT id, user_id, user_name, action, entity, entity_id, created_at
        FROM audit_logs 
        WHERE user_id = ?
        ORDER BY created_at DESC 
        LIMIT 6
      `, [user?.id || '']);
    }

    const activeDrivers = await db.get("SELECT COUNT(*) as count FROM drivers WHERE status = 'Active'");
    const totalDrivers = await db.get("SELECT COUNT(*) as count FROM drivers");
    const activeTrips = await db.get("SELECT COUNT(*) as count FROM bookings WHERE booking_status = 'Started'");
    const totalBookings = await db.get("SELECT COUNT(*) as count FROM bookings WHERE booking_status != 'Cancelled'");
    const fastagBalance = await db.get("SELECT COALESCE(SUM(wallet_balance), 0) as total FROM fastag_records");

    const totalBookingRevenue = await db.get(`
      SELECT COALESCE(SUM(booking_amount), 0) as total FROM bookings 
      WHERE booking_status != 'Cancelled'
    `);

    res.json({
      role: userRole,
      totalVehicles: totalVehicles?.count || 0,
      activeVehicles: activeVehicles?.count || 0,
      onTripVehicles: onTripVehicles?.count || 0,
      availableVehicles: availableVehicles?.count || 0,
      maintenanceVehicles: maintenanceVehicles?.count || 0,
      inactiveVehicles: inactiveVehicles?.count || 0,
      activeDrivers: activeDrivers?.count || 0,
      totalDrivers: totalDrivers?.count || 0,
      activeTrips: activeTrips?.count || 0,
      totalBookings: totalBookings?.count || 0,
      bookingsCount: totalBookings?.count || 0,
      fastagBalance: fastagBalance?.total || 0,
      carsCount: carsCount?.count || 0,
      busesCount: busesCount?.count || 0,
      trucksCount: trucksCount?.count || 0,
      heavyCount: heavyCount?.count || 0,
      commercialCount: commercialCount?.count || 0,
      
      insuranceDue: (insuranceExpiringSoon?.count || 0) + (insuranceExpired?.count || 0),
      insuranceExpired: insuranceExpired?.count || 0,
      pucDue: (pucExpiringSoon?.count || 0) + (pucExpired?.count || 0),
      pucExpired: pucExpired?.count || 0,
      fitnessDue: (fitnessExpiringSoon?.count || 0) + (fitnessExpired?.count || 0),
      fitnessExpired: fitnessExpired?.count || 0,
      permitsDue: (permitsExpiringSoon?.count || 0) + (permitsExpired?.count || 0),
      permitsExpired: permitsExpired?.count || 0,
      roadTaxDue: roadTaxDue?.count || 0,
      fastagIssues: fastagIssues?.count || 0,
      pendingChallansCount: pendingChallans?.count || 0,
      pendingChallansAmount: pendingChallans?.total_amount || 0,
      overdueChallans: overdueChallans?.count || 0,
      serviceDue: serviceDue?.count || 0,
      upcomingBookings: upcomingBookings?.count || 0,
      
      fuelExpenses: fuelExpenses?.total || 0,
      maintenanceExpenses: maintenanceExpenses?.total || 0,
      totalExpenses: (otherExpenses?.total || 0) + (fuelExpenses?.total || 0) + (maintenanceExpenses?.total || 0),
      pendingPayments: pendingPayments?.total || 0,
      bookingRevenue: totalBookingRevenue?.total || 0,
      
      criticalAlerts: criticalAlerts || [],
      monthlyTrend: (monthlyTrend || []).reverse(),
      categoryDistribution: categoryDistribution || [],
      recentActivity: recentActivity || []
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
