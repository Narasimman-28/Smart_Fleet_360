import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'smartfleet.db');

export const rawDb = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log(`Connected to SQLite database at ${DB_PATH}`);
  }
});

// Enable Foreign Keys and WAL Mode
rawDb.serialize(() => {
  rawDb.run('PRAGMA foreign_keys = ON;');
  rawDb.run('PRAGMA journal_mode = WAL;');
});

export const db = {
  get: <T = any>(sql: string, params: any[] = []): Promise<T | undefined> => {
    return new Promise((resolve, reject) => {
      rawDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  },

  all: <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
    return new Promise((resolve, reject) => {
      rawDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve((rows || []) as T[]);
      });
    });
  },

  run: (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> => {
    return new Promise((resolve, reject) => {
      rawDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },

  exec: (sql: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      rawDb.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  close: (): Promise<void> => {
    return new Promise((resolve, reject) => {
      rawDb.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

export async function initDatabase(): Promise<void> {
  const candidatePaths = [
    path.resolve(__dirname, 'schema.sql'),
    path.resolve(__dirname, '../src/db/schema.sql'),
    path.resolve(__dirname, '../../src/db/schema.sql'),
    path.resolve(__dirname, '../../server/src/db/schema.sql'),
    path.resolve(process.cwd(), 'server/src/db/schema.sql'),
    path.resolve(process.cwd(), 'src/db/schema.sql'),
    path.resolve(process.cwd(), 'server/dist/db/schema.sql'),
    path.resolve(process.cwd(), 'dist/db/schema.sql')
  ];
  const schemaPath = candidatePaths.find(p => fs.existsSync(p));
  if (schemaPath) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await db.exec(schemaSql);
  } else {
    console.warn('[Database] schema.sql not found in standard paths; proceeding with table verification.');
  }

  // Safe incremental column migrations
  try {
    await db.run('ALTER TABLE users ADD COLUMN last_login DATETIME');
  } catch (e) {
    // Column already exists
  }

  const newVehicleCols = [
    'ALTER TABLE vehicles ADD COLUMN fuel_tank_capacity REAL',
    'ALTER TABLE vehicles ADD COLUMN current_fuel_level REAL',
    'ALTER TABLE vehicles ADD COLUMN fuel_efficiency REAL',
    'ALTER TABLE vehicles ADD COLUMN battery_capacity REAL',
    'ALTER TABLE vehicles ADD COLUMN charging_type TEXT',
    'ALTER TABLE vehicles ADD COLUMN photo_url TEXT',
    'ALTER TABLE vehicles ADD COLUMN profile_image_url TEXT',
    'ALTER TABLE vehicles ADD COLUMN back_photo_url TEXT',
    'ALTER TABLE vehicles ADD COLUMN side_photo_url TEXT',
    'ALTER TABLE vehicles ADD COLUMN document_photo_url TEXT',
    'ALTER TABLE vehicles ADD COLUMN current_location_name TEXT',
    'ALTER TABLE vehicles ADD COLUMN current_latitude REAL',
    'ALTER TABLE vehicles ADD COLUMN current_longitude REAL',
    'ALTER TABLE vehicles ADD COLUMN location_updated_at DATETIME',
    'ALTER TABLE drivers ADD COLUMN photo_url TEXT',
    'ALTER TABLE drivers ADD COLUMN profile_image_url TEXT',
    'ALTER TABLE drivers ADD COLUMN current_location_name TEXT',
    'ALTER TABLE drivers ADD COLUMN current_latitude REAL',
    'ALTER TABLE drivers ADD COLUMN current_longitude REAL',
    'ALTER TABLE drivers ADD COLUMN location_updated_at DATETIME',
    'ALTER TABLE trip_locations ADD COLUMN location_name TEXT',
    'ALTER TABLE trip_locations ADD COLUMN source TEXT DEFAULT "GPS"',
    'ALTER TABLE trip_locations ADD COLUMN notes TEXT',
    'ALTER TABLE driver_location_status ADD COLUMN location_name TEXT',
    'ALTER TABLE driver_location_status ADD COLUMN source TEXT DEFAULT "GPS"',
    'ALTER TABLE driver_location_status ADD COLUMN notes TEXT',
    'ALTER TABLE driver_location_status ADD COLUMN tracking_status TEXT DEFAULT "STOPPED"',
    'ALTER TABLE notification_settings ADD COLUMN gps_update_interval_sec INTEGER DEFAULT 30',
    'ALTER TABLE notification_settings ADD COLUMN gps_signal_delayed_min INTEGER DEFAULT 5',
    'ALTER TABLE bookings ADD COLUMN vehicle_number TEXT',
    'ALTER TABLE bookings ADD COLUMN vehicle_category TEXT',
    'ALTER TABLE bookings ADD COLUMN driver_name TEXT',
    'ALTER TABLE bookings ADD COLUMN driver_phone TEXT',
    'ALTER TABLE bookings ADD COLUMN driver_availability TEXT',
    'ALTER TABLE bookings ADD COLUMN booking_date TEXT',
    'ALTER TABLE bookings ADD COLUMN customer_address TEXT',
    'ALTER TABLE bookings ADD COLUMN actual_start_date TEXT',
    'ALTER TABLE bookings ADD COLUMN actual_start_time TEXT',
    'ALTER TABLE bookings ADD COLUMN actual_end_date TEXT',
    'ALTER TABLE bookings ADD COLUMN actual_end_time TEXT',
    'ALTER TABLE bookings ADD COLUMN trip_duration TEXT',
    'ALTER TABLE bookings ADD COLUMN special_instructions TEXT',
    'ALTER TABLE bookings ADD COLUMN created_by TEXT',
    'ALTER TABLE bookings ADD COLUMN updated_by TEXT',
    'ALTER TABLE vehicles ADD COLUMN created_by TEXT',
    'ALTER TABLE vehicles ADD COLUMN updated_by TEXT',
    'ALTER TABLE expenses ADD COLUMN created_by TEXT',
    'ALTER TABLE expenses ADD COLUMN updated_by TEXT',
    'ALTER TABLE service_records ADD COLUMN created_by TEXT',
    'ALTER TABLE service_records ADD COLUMN updated_by TEXT',
    'ALTER TABLE fuel_records ADD COLUMN created_by TEXT',
    'ALTER TABLE fuel_records ADD COLUMN updated_by TEXT'
  ];

  for (const sql of newVehicleCols) {
    try {
      await db.run(sql);
    } catch (e) {
      // Column already exists
    }
  }

  // Ensure trip_locations has nullable booking_id
  try {
    const cols = await db.all("PRAGMA table_info('trip_locations')");
    const bookingCol = cols.find((c: any) => c.name === 'booking_id');
    if (bookingCol && bookingCol.notnull === 1) {
      await db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE trip_locations_migrated (
          id TEXT PRIMARY KEY,
          booking_id TEXT,
          driver_id TEXT NOT NULL,
          vehicle_id TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          accuracy REAL,
          speed REAL,
          heading REAL,
          location_name TEXT,
          source TEXT NOT NULL DEFAULT 'GPS',
          notes TEXT,
          recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO trip_locations_migrated (id, booking_id, driver_id, vehicle_id, latitude, longitude, accuracy, speed, heading, location_name, source, notes, recorded_at, created_at)
        SELECT id, booking_id, driver_id, vehicle_id, latitude, longitude, accuracy, speed, heading, location_name, source, notes, recorded_at, created_at FROM trip_locations;
        DROP TABLE trip_locations;
        ALTER TABLE trip_locations_migrated RENAME TO trip_locations;
        CREATE INDEX IF NOT EXISTS idx_trip_loc_driver ON trip_locations(driver_id);
        CREATE INDEX IF NOT EXISTS idx_trip_loc_vehicle ON trip_locations(vehicle_id);
        CREATE INDEX IF NOT EXISTS idx_trip_loc_booking ON trip_locations(booking_id);
        CREATE INDEX IF NOT EXISTS idx_trip_loc_time ON trip_locations(recorded_at);
        PRAGMA foreign_keys = ON;
      `);
      console.log('Migrated trip_locations table: booking_id is now nullable.');
    }
  } catch (err) {
    console.error('trip_locations migration notice:', err);
  }

  // Ensure vehicles table has nullable optional columns
  try {
    const vcols = await db.all("PRAGMA table_info('vehicles')");
    const chassisCol = vcols.find((c: any) => c.name === 'chassis_number');
    const ownerNameCol = vcols.find((c: any) => c.name === 'owner_name');
    if ((chassisCol && chassisCol.notnull === 1) || (ownerNameCol && ownerNameCol.notnull === 1)) {
      await db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE vehicles_migrated (
          id TEXT PRIMARY KEY,
          vehicle_number TEXT UNIQUE NOT NULL,
          vehicle_type TEXT NOT NULL,
          vehicle_category TEXT NOT NULL DEFAULT 'Commercial',
          make TEXT NOT NULL,
          model TEXT NOT NULL,
          variant TEXT,
          manufacturing_year INTEGER,
          registration_date TEXT,
          chassis_number TEXT,
          engine_number TEXT,
          fuel_type TEXT NOT NULL DEFAULT 'Diesel',
          colour TEXT,
          seating_capacity INTEGER,
          load_capacity_kg REAL DEFAULT 0,
          gross_vehicle_weight_kg REAL DEFAULT 0,
          unladen_weight_kg REAL DEFAULT 0,
          axles_count INTEGER DEFAULT 2,
          wheel_base_mm INTEGER,
          owner_name TEXT,
          owner_phone TEXT,
          owner_address TEXT,
          rto_office TEXT,
          rto_code TEXT,
          state TEXT,
          district TEXT,
          usage_type TEXT NOT NULL DEFAULT 'Commercial',
          status TEXT NOT NULL DEFAULT 'Available',
          purchase_date TEXT,
          purchase_price REAL DEFAULT 0,
          current_value REAL DEFAULT 0,
          odometer_reading REAL DEFAULT 0,
          fuel_tank_capacity REAL,
          current_fuel_level REAL,
          fuel_efficiency REAL,
          battery_capacity REAL,
          charging_type TEXT,
          electric_range_km REAL,
          driver_id TEXT,
          fleet_id TEXT,
          insurance_provider TEXT,
          policy_number TEXT,
          fastag_id TEXT,
          route_name TEXT,
          goods_type TEXT,
          photo_url TEXT,
          profile_image_url TEXT,
          back_photo_url TEXT,
          side_photo_url TEXT,
          document_photo_url TEXT,
          current_location_name TEXT,
          current_latitude REAL,
          current_longitude REAL,
          location_updated_at DATETIME,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
          FOREIGN KEY (fleet_id) REFERENCES fleets(id) ON DELETE SET NULL
        );
        INSERT INTO vehicles_migrated SELECT 
          id, vehicle_number, vehicle_type, vehicle_category, make, model, variant,
          manufacturing_year, registration_date, chassis_number, engine_number, fuel_type,
          colour, seating_capacity, load_capacity_kg, gross_vehicle_weight_kg, unladen_weight_kg,
          axles_count, wheel_base_mm, owner_name, owner_phone, owner_address,
          rto_office, rto_code, state, district, usage_type, status,
          purchase_date, purchase_price, current_value, odometer_reading,
          fuel_tank_capacity, current_fuel_level, fuel_efficiency,
          battery_capacity, charging_type, electric_range_km,
          driver_id, fleet_id, insurance_provider, policy_number, fastag_id,
          route_name, goods_type, photo_url, profile_image_url, back_photo_url, side_photo_url, document_photo_url,
          current_location_name, current_latitude, current_longitude, location_updated_at,
          notes, created_at, updated_at
        FROM vehicles;
        DROP TABLE vehicles;
        ALTER TABLE vehicles_migrated RENAME TO vehicles;
        PRAGMA foreign_keys = ON;
      `);
      console.log('Migrated vehicles table: optional columns are now nullable.');
    }
  } catch (err) {
    console.error('vehicles migration notice:', err);
  }

  // Ensure rto_records table has nullable optional columns
  try {
    const rtocols = await db.all("PRAGMA table_info('rto_records')");
    const rcCol = rtocols.find((c: any) => c.name === 'rc_number');
    const rtoChassisCol = rtocols.find((c: any) => c.name === 'chassis_number');
    if ((rcCol && rcCol.notnull === 1) || (rtoChassisCol && rtoChassisCol.notnull === 1)) {
      await db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE rto_records_migrated (
          id TEXT PRIMARY KEY,
          vehicle_id TEXT UNIQUE NOT NULL,
          rc_number TEXT,
          registration_date TEXT,
          registration_validity TEXT,
          rto_office TEXT,
          rto_code TEXT,
          owner_name TEXT,
          owner_phone TEXT,
          owner_address TEXT,
          vehicle_class TEXT,
          fuel_type TEXT,
          chassis_number TEXT,
          engine_number TEXT,
          tax_valid_upto TEXT,
          permit_valid_upto TEXT,
          fitness_valid_upto TEXT,
          hypothecation_bank TEXT,
          hypothecation_status TEXT DEFAULT 'Active',
          rto_contact_info TEXT,
          document_url TEXT,
          status TEXT NOT NULL DEFAULT 'Active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
        );
        INSERT INTO rto_records_migrated SELECT 
          id, vehicle_id, rc_number, registration_date, registration_validity,
          rto_office, rto_code, owner_name, owner_phone, owner_address,
          vehicle_class, fuel_type, chassis_number, engine_number,
          tax_valid_upto, permit_valid_upto, fitness_valid_upto,
          hypothecation_bank, hypothecation_status, rto_contact_info, document_url,
          status, created_at, updated_at
        FROM rto_records;
        DROP TABLE rto_records;
        ALTER TABLE rto_records_migrated RENAME TO rto_records;
        PRAGMA foreign_keys = ON;
      `);
      console.log('Migrated rto_records table: optional columns are now nullable.');
    }
  } catch (err) {
    console.error('rto_records migration notice:', err);
  }

  // Ensure driver_tracking_tokens, driver_tracking_devices and driver_locations exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS driver_tracking_tokens (
      id TEXT PRIMARY KEY,
      driver_id TEXT NOT NULL,
      vehicle_id TEXT,
      token_hash TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      expires_at DATETIME,
      last_used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS driver_tracking_devices (
      id TEXT PRIMARY KEY,
      driver_id TEXT NOT NULL,
      device_id TEXT,
      device_token TEXT UNIQUE NOT NULL,
      provider_type TEXT NOT NULL DEFAULT 'Browser',
      device_model TEXT,
      browser_name TEXT,
      os_name TEXT,
      status TEXT NOT NULL DEFAULT 'Active',
      last_connected_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS driver_locations (
      id TEXT PRIMARY KEY,
      driver_id TEXT NOT NULL,
      vehicle_id TEXT,
      trip_id TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      speed REAL,
      heading REAL,
      provider TEXT NOT NULL DEFAULT 'Browser GPS',
      source TEXT NOT NULL DEFAULT 'GPS',
      tracking_status TEXT DEFAULT 'ACTIVE',
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_trk_tokens_token ON driver_tracking_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_trk_tokens_driver ON driver_tracking_tokens(driver_id);
    CREATE INDEX IF NOT EXISTS idx_drv_loc_driver ON driver_locations(driver_id);
    CREATE INDEX IF NOT EXISTS idx_drv_loc_time ON driver_locations(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_drv_device_token ON driver_tracking_devices(device_token);
  `);

  // Ensure default notification_settings exist if empty
  const notifSettings = await db.get('SELECT id FROM notification_settings LIMIT 1');
  if (!notifSettings) {
    await db.run(`
      INSERT INTO notification_settings (
        id, insurance_reminder_days, puc_reminder_days, fitness_reminder_days,
        permit_reminder_days, road_tax_reminder_days, driver_license_reminder_days,
        fastag_min_balance_threshold, service_km_threshold, maintenance_days_threshold,
        booking_reminder_hours, challan_reminder_days, fuel_anomaly_threshold,
        urgent_days_threshold, warning_days_threshold, info_days_threshold,
        email_alerts_enabled, sms_alerts_enabled, push_alerts_enabled
      ) VALUES (
        'default-settings', 30, 15, 30, 20, 10, 30, 500.0, 1000.0, 15, 24, 7, 20.0, 7, 30, 90, 1, 0, 1
      )
    `);
  }

  // Ensure single Super Admin account exists if users table is empty
  const existingUsers = await db.get('SELECT id FROM users LIMIT 1');
  if (!existingUsers) {
    const bcrypt = await import('bcryptjs');
    const adminHash = await bcrypt.default.hash('Admin@123', 10);
    await db.run(`
      INSERT INTO users (id, name, email, password_hash, role, phone, status)
      VALUES ('usr-admin-1', 'Fleet Administrator', 'admin@smartfleet.com', ?, 'Super Admin', '+91 98100 00001', 'Active')
    `, [adminHash]);
  }

  console.log('Database schema successfully initialized.');
}


