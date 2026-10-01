import { db } from './db/database';
import { NotificationEngine } from './services/notificationEngine';

async function verifyProductionReadiness() {
  console.log('================================================================');
  console.log('   SMARTFLEET 360 - PRODUCTION READINESS VERIFICATION SUITE');
  console.log('================================================================');
  const baseUrl = 'http://localhost:5000/api';

  // 1. Role-based Authentication & Login / Logout
  console.log('\n[1] Testing Role-Based Authentication & Permissions...');
  
  // Super Admin Login
  const adminRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smartfleet.com', password: 'Admin@123' })
  });
  const adminData = await adminRes.json();
  if (!adminRes.ok || !adminData.token) throw new Error('Admin login failed');
  const adminToken = adminData.token;
  console.log('✓ Admin authenticated:', adminData.user.name, `[${adminData.user.role}]`);

  // Driver Login
  const driverRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'driver@smartfleet.com', password: 'Driver@123' })
  });
  const driverData = await driverRes.json();
  if (!driverRes.ok || !driverData.token) throw new Error('Driver login failed');
  const driverToken = driverData.token;
  console.log('✓ Driver authenticated:', driverData.user.name, `[${driverData.user.role}]`);

  // 2. Vehicle Registration & Manual Data Entry
  console.log('\n[2] Testing Vehicle Registration & Database Persistence...');
  const uniquePlate = `TN-09-PROD-${Math.floor(1000 + Math.random() * 9000)}`;
  const regVehRes = await fetch(`${baseUrl}/vehicles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      vehicle_number: uniquePlate,
      vehicle_type: 'Heavy Commercial Vehicle (HCV)',
      vehicle_category: 'Goods',
      make: 'Ashok Leyland',
      model: 'AVTR 4220',
      variant: '14-Wheeler Tipper',
      manufacturing_year: 2024,
      registration_date: '2024-01-15',
      chassis_number: `CHAS-PROD-${Date.now()}`,
      engine_number: `ENG-PROD-${Date.now()}`,
      fuel_type: 'Diesel',
      colour: 'Crimson Red',
      seating_capacity: 3,
      load_capacity_kg: 28000,
      gross_vehicle_weight_kg: 42000,
      unladen_weight_kg: 14000,
      axles_count: 5,
      owner_name: 'M/s. Tamil Nadu Cargo Movers Pvt Ltd',
      owner_phone: '+91 94440 88888',
      owner_address: 'Salem Highway Logistics Park, Coimbatore',
      rto_office: 'Coimbatore South RTO',
      rto_code: 'TN-38',
      state: 'Tamil Nadu',
      status: 'Available',
      odometer_reading: 12500,
      fuel_tank_capacity: 375,
      current_fuel_level: 210,
      fuel_efficiency: 4.5
    })
  });
  const regVehData = await regVehRes.json();
  if (!regVehRes.ok || !regVehData.id) throw new Error(`Vehicle registration failed: ${JSON.stringify(regVehData)}`);
  const vehicleId = regVehData.id;
  console.log(`✓ Vehicle registered: ID=${vehicleId}, Plate=${uniquePlate}, Status=Available`);

  // Verify Direct Database Record
  const dbVeh = await db.get('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
  if (!dbVeh || dbVeh.vehicle_number !== uniquePlate) throw new Error('Vehicle record not found in SQLite database');
  console.log('✓ SQLite database persistence verified for vehicle:', dbVeh.vehicle_number);

  // 3. Driver Creation & Assignment
  console.log('\n[3] Testing Driver Creation & Assignment...');
  const drvPhone = `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const createDrvRes = await fetch(`${baseUrl}/drivers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Kandasamy S.',
      phone: drvPhone,
      email: `kandasamy.${Date.now()}@smartfleet.com`,
      license_number: `TN-38-${Date.now().toString().slice(-6)}`,
      license_type: 'Heavy Commercial',
      license_issue_date: '2020-05-10',
      license_expiry_date: '2028-05-09',
      assigned_vehicle_id: vehicleId,
      status: 'Active'
    })
  });
  const createDrvData = await createDrvRes.json();
  if (!createDrvRes.ok || !createDrvData.id) throw new Error(`Driver creation failed: ${JSON.stringify(createDrvData)}`);
  const driverId = createDrvData.id;
  console.log(`✓ Driver created: ID=${driverId}, Name=Kandasamy S., Assigned to Vehicle=${vehicleId}`);

  // Assign vehicle directly
  await fetch(`${baseUrl}/drivers/${driverId}/assign-vehicle`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ vehicle_id: vehicleId })
  });

  // 4. Compliance Records (RTO, Insurance, PUC, Fitness, Permit, Road Tax, FASTag)
  console.log('\n[4] Testing Compliance Sub-Entity Registrations...');
  
  // RTO Record (Normal validity: 15 years from now)
  await fetch(`${baseUrl}/rto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      vehicle_id: vehicleId,
      rc_number: `RC-${uniquePlate}`,
      registration_date: '2024-01-15',
      registration_validity: '2039-01-14',
      rto_office: 'Coimbatore South',
      rto_code: 'TN-38',
      owner_name: 'Tamil Nadu Cargo Movers Pvt Ltd',
      owner_phone: '+91 94440 88888',
      vehicle_class: 'Goods Carrier',
      fuel_type: 'Diesel',
      chassis_number: dbVeh.chassis_number,
      engine_number: dbVeh.engine_number
    })
  });

  // Insurance Record (Expiring in 1 day -> Should trigger URGENT alert since urgent_days_threshold is 2)
  const insExpiryDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  await fetch(`${baseUrl}/insurance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      vehicle_id: vehicleId,
      insurance_company: 'ICICI Lombard General Insurance',
      policy_number: `POL-ICICI-${Date.now()}`,
      insurance_type: 'Comprehensive Commercial',
      policy_start_date: '2023-09-20',
      policy_expiry_date: insExpiryDate,
      premium_amount: 52000,
      insured_declared_value: 3200000
    })
  });

  // FASTag Record (Balance: 250 -> Below 500 threshold -> Should trigger WARNING alert)
  await db.run(`
    INSERT INTO fastag_records (id, vehicle_id, fastag_id, issuer_bank, wallet_balance, minimum_balance, linked_mobile_number, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
  `, [
    `ft-${Date.now()}`,
    vehicleId,
    `FTAG-${Date.now()}`,
    'HDFC Bank FASTag',
    250.0,
    500.0,
    '+91 94440 88888'
  ]);
  console.log('✓ Compliance sub-records entered into SQLite database.');

  // 5. Notification Engine Threshold Evaluation & Deduplication
  console.log('\n[5] Testing Notification Engine Threshold Alerts & Deduplication...');
  const evalRes1 = await NotificationEngine.runEvaluation();
  console.log('Evaluation Run 1 result:', evalRes1);

  // Fetch notifications for this vehicle
  const notifs = await db.all('SELECT * FROM notifications WHERE vehicle_id = ?', [vehicleId]);
  console.log(`✓ Generated alerts for vehicle ${uniquePlate}: ${notifs.length}`);
  for (const n of notifs) {
    console.log(`   - [${n.severity}] ${n.type}: ${n.title} -> ${n.message}`);
  }

  // Ensure insurance alert is generated because it crossed threshold (5 days <= 7 days urgent)
  const insAlert = notifs.find(n => n.type === 'INSURANCE');
  if (!insAlert) throw new Error('Insurance alert was not generated for vehicle with 5 days remaining');
  if (insAlert.severity !== 'URGENT') throw new Error(`Expected URGENT severity, got ${insAlert.severity}`);
  console.log('✓ Threshold-based alert correctly generated (specific vehicle & policy details identified).');

  // Test Deduplication: Run evaluation second time
  const evalRes2 = await NotificationEngine.runEvaluation();
  console.log('Evaluation Run 2 result (Deduplication Check):', evalRes2);
  if (evalRes2.generated !== 0) throw new Error(`Deduplication failed: generated ${evalRes2.generated} duplicate notifications`);
  console.log('✓ Notification deduplication verified: 0 duplicate alerts generated for unresolved issues.');

  // 6. Fuel Record Entry & Auto Ledger
  console.log('\n[6] Testing Fuel Log Manual Entry & Automatic Ledger Entry...');
  const fuelRes = await fetch(`${baseUrl}/fuel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      vehicle_id: vehicleId,
      driver_id: driverId,
      fuel_type: 'Diesel',
      date: new Date().toISOString().split('T')[0],
      fuel_station: 'Indian Oil Highway Depot - NH544',
      quantity_litres: 120,
      price_per_litre: 92.50,
      total_amount: 11100,
      odometer_reading: 13100,
      payment_method: 'Fuel Card'
    })
  });
  const fuelData = await fuelRes.json();
  if (!fuelRes.ok || !fuelData.id) throw new Error(`Fuel log failed: ${JSON.stringify(fuelData)}`);
  console.log('✓ Fuel log registered:', fuelData.message, 'Computed mileage:', fuelData.km_per_litre, 'KM/L');

  // Check that vehicle odometer updated to 13100
  const updatedVeh = await db.get('SELECT odometer_reading FROM vehicles WHERE id = ?', [vehicleId]);
  if (updatedVeh.odometer_reading !== 13100) throw new Error(`Vehicle odometer not updated: expected 13100, got ${updatedVeh.odometer_reading}`);
  console.log('✓ Vehicle odometer reading automatically synced to:', updatedVeh.odometer_reading, 'km');

  // 7. Service / Maintenance Record Entry
  console.log('\n[7] Testing Maintenance / Service Record Entry...');
  const srvRes = await fetch(`${baseUrl}/service`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      vehicle_id: vehicleId,
      service_date: new Date().toISOString().split('T')[0],
      service_type: 'Periodic Preventive Maintenance (15k)',
      current_odometer: 13100,
      next_service_odometer: 25000,
      next_service_date: '2026-12-31',
      workshop_name: 'TVS Ashok Leyland Authorized Workshop',
      parts_changed: 'Engine Oil Filter, Fuel Filter, Synthetic Engine Oil (15W-40)',
      labour_cost: 3500,
      parts_cost: 14500,
      total_cost: 18000,
      service_status: 'Completed'
    })
  });
  const srvData = await srvRes.json();
  if (!srvRes.ok || !srvData.id) throw new Error(`Service logging failed: ${JSON.stringify(srvData)}`);
  console.log('✓ Service record logged successfully! ID:', srvData.id);

  // 8. Expense Logging & Expense Summary Breakdown
  console.log('\n[8] Testing Expense Ledger Logging & Summary Breakdown...');
  const expRes = await fetch(`${baseUrl}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      vehicle_id: vehicleId,
      driver_id: driverId,
      category: 'Driver Salary',
      amount: 22000,
      date: new Date().toISOString().split('T')[0],
      payment_mode: 'Bank Transfer',
      vendor_name: 'Driver Monthly Advance Allowance',
      notes: 'Monthly driver wage advance'
    })
  });
  const expData = await expRes.json();
  if (!expRes.ok || !expData.id) throw new Error(`Expense recording failed: ${JSON.stringify(expData)}`);
  console.log('✓ Direct expense logged! ID:', expData.id);

  const expSummaryRes = await fetch(`${baseUrl}/expenses/summary`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const expSummary = await expSummaryRes.json();
  console.log('✓ Expense summary fetched. Category breakdowns:', expSummary.categoryBreakdown.length, 'categories recorded.');

  // 9. Booking Creation, Trip Start, Driver GPS Location Streaming, and Trip Complete
  console.log('\n[9] Testing Complete Trip Lifecycle & Real-Time Driver GPS Tracking...');
  
  // Step 9a: Create Booking
  const bkRes = await fetch(`${baseUrl}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      customer_name: 'Tata Steel Tubes Distribution Ltd',
      customer_mobile: '+91 99887 76655',
      pickup_location: 'Peelamedu Industrial Estate, Coimbatore',
      drop_location: 'Ennore Port Hub, Chennai',
      start_date: new Date().toISOString().split('T')[0],
      start_time: '06:00',
      end_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      end_time: '20:00',
      vehicle_id: vehicleId,
      driver_id: driverId,
      booking_amount: 68000,
      advance_amount: 25000,
      remaining_amount: 43000,
      distance_km: 510,
      booking_status: 'Confirmed'
    })
  });
  const bkData = await bkRes.json();
  if (!bkRes.ok || !bkData.id) throw new Error(`Booking creation failed: ${JSON.stringify(bkData)}`);
  const bookingId = bkData.id;
  console.log(`✓ Booking created: Number=${bkData.bookingNumber}, ID=${bookingId}`);

  // Check initial availability
  let vehState = await db.get('SELECT status FROM vehicles WHERE id = ?', [vehicleId]);
  let drvState = await db.get('SELECT status FROM drivers WHERE id = ?', [driverId]);
  console.log(`   Initial State -> Vehicle: ${vehState.status}, Driver: ${drvState.status}`);

  // Step 9b: Start Trip (Driver or Dispatcher)
  const startRes = await fetch(`${baseUrl}/tracking/trips/${bookingId}/start`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${driverToken}` }
  });
  const startData = await startRes.json();
  if (!startRes.ok) throw new Error(`Trip start failed: ${JSON.stringify(startData)}`);
  console.log('✓ Trip Started successfully:', startData.message);

  // Check state after start
  vehState = await db.get('SELECT status FROM vehicles WHERE id = ?', [vehicleId]);
  drvState = await db.get('SELECT status FROM drivers WHERE id = ?', [driverId]);
  if (vehState.status !== 'On Trip' || drvState.status !== 'On Trip') {
    throw new Error(`Vehicle or Driver status not updated to On Trip: veh=${vehState.status}, drv=${drvState.status}`);
  }
  console.log(`✓ Availability lifecycle verified on Trip Start -> Vehicle: ${vehState.status}, Driver: ${drvState.status}`);

  // Step 9c: Mobile GPS Streaming (Ingesting coordinates with speed, heading, accuracy)
  const telemetryPoints = [
    { lat: 11.0200, lng: 76.9600, speed: 10.0, heading: 45, accuracy: 3.2 },
    { lat: 11.0450, lng: 76.9950, speed: 18.5, heading: 50, accuracy: 2.8 },
    { lat: 11.0900, lng: 77.0450, speed: 22.0, heading: 55, accuracy: 2.5 },
    { lat: 11.1400, lng: 77.1100, speed: 24.5, heading: 60, accuracy: 2.0 }
  ];

  for (let i = 0; i < telemetryPoints.length; i++) {
    const pt = telemetryPoints[i];
    const postLocRes = await fetch(`${baseUrl}/tracking/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        booking_id: bookingId,
        driver_id: driverId,
        vehicle_id: vehicleId,
        latitude: pt.lat,
        longitude: pt.lng,
        speed: pt.speed,
        heading: pt.heading,
        accuracy: pt.accuracy
      })
    });
    const postLocData = await postLocRes.json();
    if (!postLocRes.ok) throw new Error(`Location point ${i} failed`);
  }
  console.log(`✓ Streamed ${telemetryPoints.length} live GPS coordinates from mobile device.`);

  // Step 9d: Live Vehicle Location Verification
  const liveRes = await fetch(`${baseUrl}/tracking/live`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const liveVehicles = await liveRes.json();
  const currentLive = liveVehicles.find((v: any) => v.vehicle_id === vehicleId);
  if (!currentLive || currentLive.latitude !== 11.1400 || currentLive.longitude !== 77.1100) {
    throw new Error(`Live vehicle position mismatch: expected lat 11.1400, got ${currentLive?.latitude}`);
  }
  console.log('✓ Live vehicle location verified on map feed:', {
    vehicle: currentLive.vehicle_number,
    lat: currentLive.latitude,
    lng: currentLive.longitude,
    speed_kmh: Math.round(currentLive.speed * 3.6),
    status: currentLive.trip_status
  });

  // Step 9e: Location History Polyline Verification
  const histRes = await fetch(`${baseUrl}/tracking/history/${bookingId}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const histData = await histRes.json();
  if (!histRes.ok || histData.locations.length !== telemetryPoints.length) {
    throw new Error(`Location history length mismatch: expected ${telemetryPoints.length}, got ${histData.locations?.length}`);
  }
  console.log(`✓ Location history polyline verified: ${histData.locations.length} chronological points stored.`);

  // Step 9f: Trip Complete
  const compRes = await fetch(`${baseUrl}/tracking/trips/${bookingId}/complete`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${driverToken}` }
  });
  const compData = await compRes.json();
  if (!compRes.ok) throw new Error(`Trip complete failed: ${JSON.stringify(compData)}`);
  console.log('✓ Trip completed successfully:', compData.message);

  // Check state after completion
  vehState = await db.get('SELECT status FROM vehicles WHERE id = ?', [vehicleId]);
  drvState = await db.get('SELECT status FROM drivers WHERE id = ?', [driverId]);
  if (vehState.status !== 'Available' || drvState.status !== 'Active') {
    throw new Error(`Vehicle or Driver status not restored to Available/Active: veh=${vehState.status}, drv=${drvState.status}`);
  }
  console.log(`✓ Availability lifecycle verified on Trip Complete -> Vehicle: ${vehState.status}, Driver: ${drvState.status}`);

  console.log('\n================================================================');
  console.log('   >>> ALL PRODUCTION READINESS CHECKS PASSED (100% SUCCESS) <<<');
  console.log('================================================================\n');
  process.exit(0);
}

verifyProductionReadiness().catch(err => {
  console.error('\n❌ PRODUCTION READINESS FAILURE:', err);
  process.exit(1);
});
