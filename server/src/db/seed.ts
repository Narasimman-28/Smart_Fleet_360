import bcrypt from 'bcryptjs';
import { db, initDatabase } from './database';

export async function seedDatabase() {
  console.log('Initializing clean SmartFleet 360 database (Zero demo data)...');
  await initDatabase();

  // Clear all existing business records across all tables
  await db.exec(`
    DELETE FROM audit_logs;
    DELETE FROM notifications;
    DELETE FROM trip_locations;
    DELETE FROM driver_location_status;
    DELETE FROM driver_locations;
    DELETE FROM driver_tracking_devices;
    DELETE FROM driver_tracking_tokens;
    DELETE FROM vehicle_documents;
    DELETE FROM payments;
    DELETE FROM expenses;
    DELETE FROM battery_records;
    DELETE FROM tyre_records;
    DELETE FROM bookings;
    DELETE FROM fuel_records;
    DELETE FROM service_records;
    DELETE FROM challans;
    DELETE FROM fastag_transactions;
    DELETE FROM fastag_records;
    DELETE FROM road_tax_records;
    DELETE FROM permits;
    DELETE FROM fitness_records;
    DELETE FROM puc_records;
    DELETE FROM insurance_records;
    DELETE FROM rto_records;
    DELETE FROM vehicles;
    DELETE FROM vehicle_threshold_settings;
    DELETE FROM drivers;
    DELETE FROM customers;
    DELETE FROM fleets;
    DELETE FROM users;
    DELETE FROM notification_settings;
  `);

  // 1. Default Threshold & Compliance Settings Configuration
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
      push_alerts_enabled
    ) VALUES (
      'default-settings',
      30, 15, 30, 20, 10, 30, 500.0, 1000.0, 15, 24, 7, 20.0, 7, 30, 90, 1, 0, 1
    )
  `);

  // 2. Preserved Super Admin Authentication Account
  const adminHash = await bcrypt.hash('Admin@123', 10);

  await db.run(`
    INSERT INTO users (id, name, email, password_hash, role, phone, status)
    VALUES 
      ('usr-admin-1', 'Fleet Administrator', 'admin@smartfleet.com', ?, 'Super Admin', '+91 98100 00001', 'Active')
  `, [
    adminHash
  ]);

  console.log('Clean database initialization completed: Single Super Admin account (admin@smartfleet.com) active, zero sample data.');
}

if (require.main === module) {
  seedDatabase().catch((err) => {
    console.error('Database initialization error:', err);
    process.exit(1);
  });
}

