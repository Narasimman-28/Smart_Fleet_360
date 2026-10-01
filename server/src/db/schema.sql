-- SmartFleet 360 Relational Database Schema (SQLite / Relational SQL)

PRAGMA foreign_keys = ON;

-- Users and Authentication
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Fleet Manager', -- Super Admin, Admin, Fleet Manager, Transport Manager, Compliance Manager, Accountant, Mechanic, Driver, Customer
    phone TEXT,
    avatar_url TEXT,
    status TEXT NOT NULL DEFAULT 'Active', -- Active, Inactive, Suspended
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Fleets / Groupings
CREATE TABLE IF NOT EXISTS fleets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    fleet_type TEXT NOT NULL, -- City Fleet, Delivery Fleet, School Bus Fleet, Tourist Fleet, Heavy Vehicle Fleet, Goods Transport, Corporate, Emergency
    manager_name TEXT,
    color_code TEXT DEFAULT '#3B82F6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Drivers
CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    license_number TEXT UNIQUE NOT NULL,
    license_type TEXT NOT NULL, -- LMV, HMV, Heavy Commercial, Passenger, Hazard
    license_issue_date TEXT NOT NULL,
    license_expiry_date TEXT NOT NULL,
    badge_number TEXT,
    experience_years INTEGER DEFAULT 1,
    assigned_vehicle_id TEXT,
    emergency_contact TEXT,
    blood_group TEXT,
    status TEXT NOT NULL DEFAULT 'Active', -- Active, On Leave, Suspended, Inactive
    license_document_url TEXT,
    id_proof_url TEXT,
    medical_cert_url TEXT,
    photo_url TEXT,
    profile_image_url TEXT,
    rating REAL DEFAULT 5.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Customers / B2B Clients
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    company_name TEXT,
    gst_number TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Vehicles (Central Registry)
CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    vehicle_number TEXT UNIQUE NOT NULL, -- e.g. TN01AB1234
    vehicle_type TEXT NOT NULL, -- Car, Bus, Van, Truck, Lorry, Heavy Commercial, Light Commercial, Goods Vehicle, Passenger Vehicle, School Bus, Tourist Vehicle, Emergency Vehicle, Construction Vehicle, Other
    vehicle_category TEXT NOT NULL DEFAULT 'Commercial', -- Passenger, Goods, Special Purpose, Commercial, Private
    make TEXT NOT NULL, -- Tata, Ashok Leyland, Mahindra, BharatBenz, Eicher, Toyota, Hyundai, Force, Scania, Isuzu, etc.
    model TEXT NOT NULL,
    variant TEXT,
    manufacturing_year INTEGER,
    registration_date TEXT,
    chassis_number TEXT,
    engine_number TEXT,
    fuel_type TEXT NOT NULL DEFAULT 'Diesel', -- Diesel, Petrol, CNG, Electric, Hybrid, LNG
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
    rto_code TEXT, -- e.g. TN-01, MH-12, DL-03
    state TEXT,
    district TEXT,
    usage_type TEXT NOT NULL DEFAULT 'Commercial', -- Commercial, Private
    status TEXT NOT NULL DEFAULT 'Available', -- Available, Booked, On Trip, Under Maintenance, Inactive, Sold, Retired, Expired Documents, Blocked
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
    route_name TEXT, -- For buses/transit
    goods_type TEXT, -- For trucks
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

-- RTO Records
CREATE TABLE IF NOT EXISTS rto_records (
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
    hypothecation_bank TEXT, -- Financed by bank/NBFC
    hypothecation_status TEXT DEFAULT 'Active',
    rto_contact_info TEXT,
    document_url TEXT,
    status TEXT NOT NULL DEFAULT 'Active', -- Active, Expiring Soon, Expired, Pending, Not Available
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- Insurance Policies
CREATE TABLE IF NOT EXISTS insurance_records (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    insurance_company TEXT NOT NULL,
    policy_number TEXT UNIQUE NOT NULL,
    insurance_type TEXT NOT NULL, -- Comprehensive, Third Party, Commercial Vehicle Insurance
    policy_start_date TEXT NOT NULL,
    policy_expiry_date TEXT NOT NULL,
    premium_amount REAL NOT NULL DEFAULT 0,
    insured_declared_value REAL NOT NULL DEFAULT 0, -- IDV
    agent_name TEXT,
    agent_contact TEXT,
    claim_details TEXT,
    claim_count INTEGER DEFAULT 0,
    policy_document_url TEXT,
    status TEXT NOT NULL DEFAULT 'Active', -- Active, Expiring Soon, Expired
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- PUC / Pollution Certificate Records
CREATE TABLE IF NOT EXISTS puc_records (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    certificate_number TEXT UNIQUE NOT NULL,
    issue_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    testing_center TEXT NOT NULL,
    emission_reading TEXT, -- e.g. CO: 0.12%, HC: 45ppm, Smoke Density: 1.2 HSU
    fuel_type TEXT NOT NULL,
    certificate_document_url TEXT,
    status TEXT NOT NULL DEFAULT 'Active', -- Active, Expiring Soon, Expired
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- Fitness Certificates
CREATE TABLE IF NOT EXISTS fitness_records (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    certificate_number TEXT UNIQUE NOT NULL,
    issue_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    inspection_date TEXT NOT NULL,
    testing_center TEXT NOT NULL,
    vehicle_class TEXT NOT NULL,
    certificate_document_url TEXT,
    status TEXT NOT NULL DEFAULT 'Active', -- Active, Expiring Soon, Expired
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- Vehicle Permits
CREATE TABLE IF NOT EXISTS permits (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    permit_number TEXT UNIQUE NOT NULL,
    permit_type TEXT NOT NULL, -- National Permit, State Permit, Goods Carrier Permit, Passenger Permit, Tourist Permit, Contract Carriage Permit, School Bus Permit, Temporary Permit, Other Permit
    issue_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    issuing_authority TEXT NOT NULL,
    permit_area TEXT NOT NULL, -- All India, South Zone, State Specific, City limits
    permit_document_url TEXT,
    status TEXT NOT NULL DEFAULT 'Active', -- Active, Expiring Soon, Expired
    fee_paid REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- Road Tax Records
CREATE TABLE IF NOT EXISTS road_tax_records (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    tax_type TEXT NOT NULL, -- Lifetime, Annual, Half-Yearly, Quarterly, One-time
    tax_amount REAL NOT NULL,
    payment_date TEXT NOT NULL,
    next_due_date TEXT NOT NULL,
    receipt_number TEXT UNIQUE NOT NULL,
    payment_mode TEXT NOT NULL, -- Online Portal, Cash, NetBanking, Demand Draft
    tax_document_url TEXT,
    status TEXT NOT NULL DEFAULT 'Active', -- Active, Due Soon, Overdue
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- FASTag Information
CREATE TABLE IF NOT EXISTS fastag_records (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT UNIQUE NOT NULL,
    fastag_id TEXT UNIQUE NOT NULL,
    issuer_bank TEXT NOT NULL, -- ICICI, HDFC, SBI, Axis, Paytm Payments, IDFC First, Kotak
    wallet_balance REAL NOT NULL DEFAULT 0,
    minimum_balance REAL NOT NULL DEFAULT 500,
    linked_mobile_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active', -- Active, Low Balance, Blocked, Inactive
    last_recharge_date TEXT,
    last_recharge_amount REAL DEFAULT 0,
    last_transaction_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- FASTag Toll Transactions
CREATE TABLE IF NOT EXISTS fastag_transactions (
    id TEXT PRIMARY KEY,
    fastag_id TEXT NOT NULL,
    vehicle_id TEXT NOT NULL,
    toll_plaza_name TEXT NOT NULL,
    location TEXT,
    transaction_date TEXT NOT NULL,
    amount REAL NOT NULL,
    balance_after REAL NOT NULL,
    lane_number TEXT,
    status TEXT NOT NULL DEFAULT 'Success', -- Success, Failed, Disputed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- Traffic Challans
CREATE TABLE IF NOT EXISTS challans (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    challan_number TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    location TEXT NOT NULL,
    offence TEXT NOT NULL, -- Over Speeding, Signal Jump, Without Seatbelt, No Parking, Overloading, Pollution Norms, FASTag Non-compliance, etc.
    amount REAL NOT NULL,
    due_date TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'Pending', -- Pending, Paid, Overdue, Disputed
    payment_date TEXT,
    receipt_number TEXT,
    challan_document_url TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- Service & Mechanical Records
CREATE TABLE IF NOT EXISTS service_records (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    service_date TEXT NOT NULL,
    service_type TEXT NOT NULL, -- Engine Service, Oil Change, Brake Service, Tyre Replacement, Battery Replacement, AC Service, Clutch Service, Transmission Service, Suspension Service, Wheel Alignment, Wheel Balancing, General Service, Major Repair, Emergency Repair
    current_odometer REAL NOT NULL,
    next_service_odometer REAL NOT NULL,
    next_service_date TEXT NOT NULL,
    mechanic_name TEXT,
    workshop_name TEXT NOT NULL,
    parts_changed TEXT,
    labour_cost REAL DEFAULT 0,
    parts_cost REAL DEFAULT 0,
    total_cost REAL NOT NULL,
    service_notes TEXT,
    invoice_document_url TEXT,
    service_status TEXT NOT NULL DEFAULT 'Completed', -- Scheduled, In Progress, Completed, Cancelled
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- Fuel Logs
CREATE TABLE IF NOT EXISTS fuel_records (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    driver_id TEXT,
    fuel_type TEXT NOT NULL, -- Diesel, Petrol, CNG, Electric, LNG
    date TEXT NOT NULL,
    fuel_station TEXT NOT NULL,
    quantity_litres REAL NOT NULL,
    price_per_litre REAL NOT NULL,
    total_amount REAL NOT NULL,
    odometer_reading REAL NOT NULL,
    km_per_litre REAL, -- Computed
    cost_per_km REAL, -- Computed
    payment_method TEXT NOT NULL DEFAULT 'Fuel Card', -- Cash, Card, UPI, Fuel Card, Credit
    receipt_url TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
);

-- Bookings & Trips
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    booking_number TEXT UNIQUE NOT NULL,
    booking_date TEXT,
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    customer_mobile TEXT NOT NULL,
    customer_address TEXT,
    vehicle_id TEXT NOT NULL,
    vehicle_number TEXT,
    vehicle_type TEXT NOT NULL,
    vehicle_category TEXT,
    driver_id TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    driver_availability TEXT DEFAULT 'Available',
    pickup_location TEXT NOT NULL,
    drop_location TEXT NOT NULL,
    start_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_date TEXT NOT NULL,
    end_time TEXT NOT NULL,
    trip_type TEXT NOT NULL, -- One Way, Round Trip, Rental, Daily Route, Goods Transport
    passenger_or_goods_details TEXT,
    distance_km REAL DEFAULT 0,
    estimated_fuel_litres REAL DEFAULT 0,
    booking_amount REAL NOT NULL,
    advance_amount REAL DEFAULT 0,
    remaining_amount REAL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'Pending', -- Pending, Partial, Paid, Refunded
    booking_status TEXT NOT NULL DEFAULT 'Confirmed', -- Confirmed, Started, Completed, Cancelled
    actual_start_date TEXT,
    actual_start_time TEXT,
    actual_end_date TEXT,
    actual_end_time TEXT,
    trip_duration TEXT,
    special_instructions TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
);

-- Tyre Management
CREATE TABLE IF NOT EXISTS tyre_records (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    tyre_position TEXT NOT NULL, -- Front Left, Front Right, Rear Left Outer, Rear Left Inner, Rear Right Outer, Rear Right Inner, Axle 3 Left, Axle 3 Right, Spare
    brand TEXT NOT NULL, -- MRF, Apollo, JK Tyre, Michelin, Bridgestone, CEAT
    model TEXT,
    size TEXT NOT NULL, -- e.g. 295/80 R22.5, 185/65 R15
    purchase_date TEXT NOT NULL,
    purchase_cost REAL DEFAULT 0,
    installation_date TEXT NOT NULL,
    current_km REAL DEFAULT 0,
    expected_km REAL DEFAULT 80000,
    replacement_date TEXT,
    condition TEXT NOT NULL DEFAULT 'Good', -- New, Good, Fair, Worn, Critical, Replaced
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- Battery Management
CREATE TABLE IF NOT EXISTS battery_records (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    battery_number TEXT NOT NULL,
    brand TEXT NOT NULL, -- Exide, Amaron, Luminous, Bosch, Tata Green
    model TEXT,
    purchase_date TEXT NOT NULL,
    warranty_expiry TEXT NOT NULL,
    installation_date TEXT NOT NULL,
    current_condition TEXT NOT NULL DEFAULT 'Healthy', -- Healthy, Fair, Weak, Replace Soon, Dead
    replacement_date TEXT,
    cost REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- Expense Ledger
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT,
    driver_id TEXT,
    category TEXT NOT NULL, -- Fuel, Maintenance, Insurance, Road Tax, Permit, FASTag, Challan, Service, Tyres, Battery, Driver Salary, Toll, Parking, Repair, Other
    amount REAL NOT NULL,
    expense_date TEXT NOT NULL,
    description TEXT NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'Bank Transfer', -- Cash, Card, UPI, NetBanking, Fuel Card, Cheque
    receipt_url TEXT,
    approved_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    reference_type TEXT NOT NULL, -- Booking, Insurance, Tax, Permit, Maintenance, Fuel, FASTag, Challan, Driver Salary, Other
    reference_id TEXT,
    vehicle_id TEXT,
    amount REAL NOT NULL,
    payment_date TEXT NOT NULL,
    payment_mode TEXT NOT NULL, -- UPI, NetBanking, Card, Cash, Cheque, Fuel Card
    transaction_id TEXT,
    status TEXT NOT NULL DEFAULT 'Paid', -- Paid, Pending, Overdue, Cancelled
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
);

-- Central Document Vault
CREATE TABLE IF NOT EXISTS vehicle_documents (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    document_type TEXT NOT NULL, -- RC, Insurance, PUC, Fitness, Permit, Road Tax, FASTag, Challan, Driver Doc, Service Invoice, Fuel Receipt, Other
    document_name TEXT NOT NULL,
    document_number TEXT,
    issue_date TEXT,
    expiry_date TEXT,
    file_url TEXT NOT NULL,
    file_size_kb INTEGER DEFAULT 120,
    status TEXT NOT NULL DEFAULT 'Active', -- Active, Expiring Soon, Expired, Validated
    days_remaining INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- Automated Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT,
    vehicle_number TEXT,
    entity_id TEXT,
    fingerprint TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- INSURANCE, PUC, FITNESS, PERMIT, TAX, RC, FASTAG, SERVICE, CHALLAN, BOOKING, LICENCE, MAINTENANCE, PAYMENT, FUEL_ANOMALY
    severity TEXT NOT NULL DEFAULT 'INFO', -- INFO, WARNING, URGENT, EXPIRED
    is_read INTEGER NOT NULL DEFAULT 0,
    action_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- Global Notification Threshold Settings
CREATE TABLE IF NOT EXISTS notification_settings (
    id TEXT PRIMARY KEY DEFAULT 'default-settings',
    insurance_reminder_days INTEGER NOT NULL DEFAULT 30,
    puc_reminder_days INTEGER NOT NULL DEFAULT 15,
    fitness_reminder_days INTEGER NOT NULL DEFAULT 30,
    permit_reminder_days INTEGER NOT NULL DEFAULT 20,
    road_tax_reminder_days INTEGER NOT NULL DEFAULT 10,
    driver_license_reminder_days INTEGER NOT NULL DEFAULT 30,
    fastag_min_balance_threshold REAL NOT NULL DEFAULT 500,
    service_km_threshold REAL NOT NULL DEFAULT 1000,
    maintenance_days_threshold INTEGER NOT NULL DEFAULT 15,
    booking_reminder_hours INTEGER NOT NULL DEFAULT 24,
    challan_reminder_days INTEGER NOT NULL DEFAULT 7,
    fuel_anomaly_threshold REAL NOT NULL DEFAULT 20.0,
    urgent_days_threshold INTEGER NOT NULL DEFAULT 7,
    warning_days_threshold INTEGER NOT NULL DEFAULT 30,
    info_days_threshold INTEGER NOT NULL DEFAULT 90,
    email_alerts_enabled INTEGER DEFAULT 1,
    sms_alerts_enabled INTEGER DEFAULT 0,
    push_alerts_enabled INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Vehicle-Specific Threshold Overrides
CREATE TABLE IF NOT EXISTS vehicle_threshold_settings (
    vehicle_id TEXT PRIMARY KEY,
    insurance_reminder_days INTEGER,
    puc_reminder_days INTEGER,
    fitness_reminder_days INTEGER,
    permit_reminder_days INTEGER,
    road_tax_reminder_days INTEGER,
    fastag_min_balance_threshold REAL,
    service_km_threshold REAL,
    maintenance_days_threshold INTEGER,
    fuel_anomaly_threshold REAL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- Audit Trail Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL, -- LOGIN, CREATE, UPDATE, DELETE, UPLOAD, PAY, RENEW, EXPORT
    entity TEXT NOT NULL, -- Vehicle, Insurance, PUC, Fitness, Permit, FASTag, Challan, Booking, Service, Driver, User
    entity_id TEXT,
    old_values TEXT, -- JSON
    new_values TEXT, -- JSON
    ip_address TEXT DEFAULT '127.0.0.1',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Live Driver & Vehicle GPS Tracking
CREATE TABLE IF NOT EXISTS trip_locations (
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
    source TEXT NOT NULL DEFAULT 'GPS', -- GPS, MANUAL
    notes TEXT,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS driver_location_status (
    driver_id TEXT PRIMARY KEY,
    driver_name TEXT,
    vehicle_id TEXT,
    vehicle_number TEXT,
    booking_id TEXT,
    booking_number TEXT,
    latitude REAL,
    longitude REAL,
    accuracy REAL,
    speed REAL,
    heading REAL,
    location_name TEXT,
    source TEXT NOT NULL DEFAULT 'GPS', -- GPS, MANUAL
    notes TEXT,
    is_tracking INTEGER DEFAULT 0,
    trip_status TEXT DEFAULT 'Pending',
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);

-- Driver Tracking Devices / Tokens
CREATE TABLE IF NOT EXISTS driver_tracking_devices (
    id TEXT PRIMARY KEY,
    driver_id TEXT NOT NULL,
    device_id TEXT,
    device_token TEXT UNIQUE NOT NULL,
    provider_type TEXT NOT NULL DEFAULT 'Browser', -- Browser, Traccar, Native
    device_model TEXT,
    browser_name TEXT,
    os_name TEXT,
    status TEXT NOT NULL DEFAULT 'Active', -- Active, Disconnected, Inactive
    last_connected_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);

-- Driver Locations
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

-- Create Indexes for Super Fast Querying
CREATE INDEX IF NOT EXISTS idx_trip_loc_driver ON trip_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_trip_loc_vehicle ON trip_locations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trip_loc_booking ON trip_locations(booking_id);
CREATE INDEX IF NOT EXISTS idx_trip_loc_time ON trip_locations(recorded_at);
CREATE INDEX IF NOT EXISTS idx_drv_loc_driver ON driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_drv_loc_time ON driver_locations(recorded_at);
CREATE INDEX IF NOT EXISTS idx_drv_device_token ON driver_tracking_devices(device_token);
CREATE INDEX IF NOT EXISTS idx_vehicles_num ON vehicles(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_insurance_expiry ON insurance_records(policy_expiry_date);
CREATE INDEX IF NOT EXISTS idx_puc_expiry ON puc_records(expiry_date);
CREATE INDEX IF NOT EXISTS idx_fitness_expiry ON fitness_records(expiry_date);
CREATE INDEX IF NOT EXISTS idx_permit_expiry ON permits(expiry_date);
CREATE INDEX IF NOT EXISTS idx_challans_status ON challans(payment_status);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read, severity);
CREATE INDEX IF NOT EXISTS idx_notifications_fingerprint ON notifications(fingerprint, is_read);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_trip_locs_booking ON trip_locations(booking_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_trip_locs_driver ON trip_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_trip_locs_vehicle ON trip_locations(vehicle_id);



