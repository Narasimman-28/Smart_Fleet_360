import { db } from './db/database';
import bcrypt from 'bcryptjs';

async function verifyEmptyAndPersistence() {
  console.log('=== Starting SmartFleet 360 Empty State & Persistence Verification ===\n');

  // 1. Check Table Record Counts
  const tables = [
    'vehicles',
    'drivers',
    'bookings',
    'rto_records',
    'insurance_records',
    'puc_records',
    'fitness_records',
    'permits',
    'road_tax_records',
    'challans',
    'fastag_records',
    'fastag_transactions',
    'service_records',
    'fuel_records',
    'tyre_records',
    'battery_records',
    'expenses',
    'payments',
    'driver_locations',
    'driver_location_status',
    'driver_tracking_devices',
    'driver_tracking_tokens',
    'trip_locations',
    'notifications',
    'fleets',
    'customers'
  ];

  console.log('--- Checking Business Tables (Must be 0 records) ---');
  let allZero = true;
  for (const table of tables) {
    try {
      const res = await db.get(`SELECT COUNT(*) as count FROM ${table}`);
      const count = res?.count || 0;
      console.log(`Table [${table}]: ${count} records`);
      if (count !== 0) {
        allZero = false;
        console.error(`❌ Table ${table} has ${count} records, expected 0!`);
      }
    } catch (err: any) {
      console.error(`Error querying table ${table}:`, err.message);
      allZero = false;
    }
  }

  if (allZero) {
    console.log('✅ ALL business tables are completely empty (0 records).\n');
  } else {
    throw new Error('Some tables contain business records!');
  }

  // 2. Verify Authentication System Preserved (1 Super Admin user only)
  console.log('--- Checking Preserved Admin Authentication Account ---');
  const users = await db.all('SELECT id, name, email, role, password_hash, status FROM users');
  console.log(`Total users in DB: ${users.length}`);
  if (users.length !== 1) {
    throw new Error(`Expected 1 user, found ${users.length}`);
  }

  const adminUser = users[0];
  console.log(`Admin User: ID=${adminUser.id}, Email=${adminUser.email}, Role=${adminUser.role}, Status=${adminUser.status}`);
  if (adminUser.email !== 'admin@smartfleet.com' || adminUser.role !== 'Super Admin') {
    throw new Error('Admin user email or role mismatch');
  }

  const passwordValid = await bcrypt.compare('Admin@123', adminUser.password_hash);
  if (!passwordValid) {
    throw new Error('Admin password hash verification failed');
  }
  console.log('✅ Super Admin credentials verified (Admin@123 / admin@smartfleet.com)\n');

  // 3. Test Manual Data Entry Persistence
  console.log('--- Testing Manual Vehicle & Driver Registration & SQLite Persistence ---');
  
  // Test Vehicle Insertion
  const testVehicleId = `veh-test-${Date.now()}`;
  await db.run(`
    INSERT INTO vehicles (
      id, vehicle_number, vehicle_type, vehicle_category, make, model,
      manufacturing_year, registration_date, chassis_number, engine_number,
      fuel_type, colour, owner_name, owner_phone, rto_office, rto_code, state,
      status, odometer_reading, fuel_tank_capacity, current_fuel_level, fuel_efficiency
    ) VALUES (
      ?, 'TN-37-CZ-1122', 'Heavy Commercial', 'Commercial', 'BharatBenz', '3528C',
      2024, '2024-03-15', 'BBZ98765432101234', 'ENG-3528-5678',
      'Diesel', 'White', 'Real Owner Logistics', '+91 98765 00001', 'TN-37 Coimbatore South', 'TN-37', 'Tamil Nadu',
      'Available', 12000.0, 350.0, 280.0, 4.2
    )
  `, [testVehicleId]);

  const persistedVeh = await db.get('SELECT * FROM vehicles WHERE id = ?', [testVehicleId]);
  if (!persistedVeh || persistedVeh.vehicle_number !== 'TN-37-CZ-1122') {
    throw new Error('Vehicle persistence test failed');
  }
  console.log(`✅ Vehicle successfully inserted and persisted: ${persistedVeh.vehicle_number} (${persistedVeh.make} ${persistedVeh.model})`);

  // Test Driver Insertion
  const testDriverId = `drv-test-${Date.now()}`;
  await db.run(`
    INSERT INTO drivers (
      id, name, phone, email, address, license_number, license_type,
      license_issue_date, license_expiry_date, experience_years, blood_group, status
    ) VALUES (
      ?, 'Manickam V', '+91 94433 11223', 'manickam@example.com',
      'Gandhi Nagar, Pollachi', 'TN-37-2021-0099881', 'Heavy Commercial (HMV)',
      '2021-05-10', '2028-05-09', 8, 'O+', 'Active'
    )
  `, [testDriverId]);

  const persistedDrv = await db.get('SELECT * FROM drivers WHERE id = ?', [testDriverId]);
  if (!persistedDrv || persistedDrv.name !== 'Manickam V') {
    throw new Error('Driver persistence test failed');
  }
  console.log(`✅ Driver successfully inserted and persisted: ${persistedDrv.name} (${persistedDrv.license_number})`);

  // Test Booking Insertion
  const testBookingId = `bk-test-${Date.now()}`;
  await db.run(`
    INSERT INTO bookings (
      id, booking_number, customer_name, customer_mobile, vehicle_id, vehicle_type, driver_id,
      pickup_location, drop_location, start_date, start_time, end_date, end_time,
      trip_type, booking_amount, advance_amount, remaining_amount, payment_status, booking_status
    ) VALUES (
      ?, 'BK-TEST-001', 'Coimbatore Cotton Mill', '+91 94422 33445', ?, 'Heavy Commercial', ?,
      'Coimbatore Mill Area', 'Tuticorin Port', '2026-10-01', '06:00 AM', '2026-10-02', '08:00 PM',
      'One Way', 28000.0, 10000.0, 18000.0, 'Partial', 'Confirmed'
    )
  `, [testBookingId, testVehicleId, testDriverId]);

  const persistedBk = await db.get('SELECT * FROM bookings WHERE id = ?', [testBookingId]);
  if (!persistedBk || persistedBk.booking_number !== 'BK-TEST-001') {
    throw new Error('Booking persistence test failed');
  }
  console.log(`✅ Booking successfully inserted and persisted: ${persistedBk.booking_number} (₹${persistedBk.booking_amount})`);

  // Clean up test records to leave the DB completely clean and empty
  await db.run('DELETE FROM bookings WHERE id = ?', [testBookingId]);
  await db.run('DELETE FROM drivers WHERE id = ?', [testDriverId]);
  await db.run('DELETE FROM vehicles WHERE id = ?', [testVehicleId]);

  const finalVehCount = await db.get('SELECT COUNT(*) as count FROM vehicles');
  const finalDrvCount = await db.get('SELECT COUNT(*) as count FROM drivers');
  const finalBkCount = await db.get('SELECT COUNT(*) as count FROM bookings');

  console.log(`\nFinal Verification: Vehicles=${finalVehCount?.count}, Drivers=${finalDrvCount?.count}, Bookings=${finalBkCount?.count}`);
  console.log('=== All Verifications Passed Successfully! ===');
}

verifyEmptyAndPersistence().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
