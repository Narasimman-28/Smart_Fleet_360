import { db, initDatabase } from './db/database';
import { seedDatabase } from './db/seed';

async function verifyCleanState() {
  console.log('--- Step 1: Checking Database Table Counts ---');
  const tables = [
    'vehicles',
    'drivers',
    'bookings',
    'fuel_records',
    'service_records',
    'insurance_records',
    'puc_records',
    'fitness_records',
    'permits',
    'road_tax_records',
    'fastag_records',
    'fastag_transactions',
    'challans',
    'payments',
    'expenses',
    'battery_records',
    'tyre_records',
    'trip_locations',
    'driver_locations',
    'driver_location_status',
    'notifications',
    'customers',
    'fleets'
  ];

  for (const table of tables) {
    const row = await db.get(`SELECT COUNT(*) as count FROM ${table}`);
    console.log(`Table '${table}': count = ${row?.count}`);
    if (row?.count !== 0) {
      throw new Error(`Expected table '${table}' to have 0 records, but found ${row?.count}`);
    }
  }

  console.log('--- Step 2: Checking Users Table ---');
  const users = await db.all('SELECT id, email, role, status FROM users');
  console.log(`Users count: ${users.length}`);
  console.log('Users:', users);
  if (users.length !== 1 || users[0].email !== 'admin@smartfleet.com' || users[0].role !== 'Super Admin') {
    throw new Error(`Expected exactly 1 Super Admin user (admin@smartfleet.com), but found: ${JSON.stringify(users)}`);
  }

  console.log('--- Step 3: Checking Server Restart Behavior (initDatabase idempotency) ---');
  await initDatabase();
  for (const table of tables) {
    const row = await db.get(`SELECT COUNT(*) as count FROM ${table}`);
    if (row?.count !== 0) {
      throw new Error(`Server restart recreated data in '${table}'! Found ${row?.count}`);
    }
  }
  const usersAfterRestart = await db.all('SELECT id, email, role FROM users');
  if (usersAfterRestart.length !== 1 || usersAfterRestart[0].email !== 'admin@smartfleet.com') {
    throw new Error(`Users count changed after restart: ${JSON.stringify(usersAfterRestart)}`);
  }

  console.log('--- Step 4: Testing Manual Data Flow Lifecycle ---');
  // 1. Manually add a vehicle using full schema
  const vehId = `veh-${Date.now()}`;
  await db.run(`
    INSERT INTO vehicles (
      id, vehicle_number, vehicle_type, vehicle_category, make, model,
      manufacturing_year, registration_date, chassis_number, engine_number,
      fuel_type, colour, owner_name, owner_phone, rto_office, rto_code, state,
      status, odometer_reading, profile_image_url
    ) VALUES (
      ?, 'MH-12-AB-1234', 'Heavy Commercial', 'Commercial', 'Tata', 'Prima 4028.S',
      2023, '2023-05-15', 'MAT1234567890CHAS', 'ENG9876543210',
      'Diesel', 'White', 'SmartFleet Logistics', '+91 98100 00001', 'Pune RTO', 'MH-12', 'Maharashtra',
      'Available', 25000, '/uploads/vehicles/sample.jpg'
    )
  `, [vehId]);

  // 2. Manually add a driver
  const drvId = `drv-${Date.now()}`;
  await db.run(`
    INSERT INTO drivers (
      id, name, phone, license_number, license_type, license_issue_date, license_expiry_date,
      experience_years, status, profile_image_url
    ) VALUES (
      ?, 'Rajesh Sharma', '+91 98765 43210', 'MH-14-2020-001234', 'Heavy Commercial', '2020-01-01', '2030-12-31',
      10, 'Active', '/uploads/drivers/rajesh.jpg'
    )
  `, [drvId]);

  // 3. Manually create a booking
  const bkgId = `bkg-${Date.now()}`;
  await db.run(`
    INSERT INTO bookings (
      id, booking_number, vehicle_id, vehicle_number, vehicle_type, vehicle_category,
      driver_id, driver_name, driver_phone,
      customer_name, customer_mobile, pickup_location, drop_location, start_date, start_time,
      end_date, end_time, trip_type, booking_amount, advance_amount, remaining_amount,
      payment_status, booking_status
    ) VALUES (
      ?, 'BK-2026-0001', ?, 'MH-12-AB-1234', 'Heavy Commercial', 'Commercial',
      ?, 'Rajesh Sharma', '+91 98765 43210',
      'Acme Logistics Corp', '+91 98000 11111', 'Mumbai Port Yard 4', 'Pune MIDC Hub', '2026-10-01', '08:00',
      '2026-10-02', '18:00', 'Goods Transport', 15000, 5000, 10000,
      'Partial', 'Confirmed'
    )
  `, [bkgId, vehId, drvId]);

  // Verify counts updated
  const vehCount = await db.get('SELECT COUNT(*) as count FROM vehicles');
  const drvCount = await db.get('SELECT COUNT(*) as count FROM drivers');
  const bkgCount = await db.get('SELECT COUNT(*) as count FROM bookings');

  if (vehCount.count !== 1 || drvCount.count !== 1 || bkgCount.count !== 1) {
    throw new Error('Manual insertion verification failed');
  }
  console.log(`Manual entries verified: Vehicles = ${vehCount.count}, Drivers = ${drvCount.count}, Bookings = ${bkgCount.count}`);

  // Re-clean the database to 0
  console.log('--- Step 5: Resetting Back to Clean Database ---');
  await seedDatabase();

  const finalVeh = await db.get('SELECT COUNT(*) as count FROM vehicles');
  const finalDrv = await db.get('SELECT COUNT(*) as count FROM drivers');
  const finalBkg = await db.get('SELECT COUNT(*) as count FROM bookings');
  const finalUsr = await db.get('SELECT COUNT(*) as count FROM users');

  if (finalVeh.count !== 0 || finalDrv.count !== 0 || finalBkg.count !== 0 || finalUsr.count !== 1) {
    throw new Error('Final clean reset failed!');
  }

  console.log('Verification SUCCESSFUL! All checks passed with 100% clean database state.');
}

verifyCleanState().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
