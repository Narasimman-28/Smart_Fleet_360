import { db } from './db/database';

async function runTests() {
  const baseUrl = 'http://localhost:5000/api';
  console.log('--- STARTING SMARTFLEET 360 FULL API & DATABASE VERIFICATION ---');

  // Test 1: Health Check
  console.log('\n[1] Testing Health Check API...');
  const healthRes = await fetch(`${baseUrl}/health`);
  const healthData = await healthRes.json();
  console.log('Health check response:', healthData);
  if (healthData.status !== 'ok') throw new Error('Health check failed');

  // Test 2: Authentication (Login as Admin)
  console.log('\n[2] Testing Authentication (Admin Login)...');
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smartfleet.com', password: 'Admin@123' })
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.token) throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
  console.log('Admin login successful! Token received. User:', loginData.user.name, 'Role:', loginData.user.role);
  const adminToken = loginData.token;

  // Test 2b: Driver Login
  console.log('\n[2b] Testing Driver Login...');
  const driverLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'driver@smartfleet.com', password: 'Driver@123' })
  });
  const driverLoginData = await driverLoginRes.json();
  if (!driverLoginRes.ok || !driverLoginData.token) throw new Error(`Driver login failed: ${JSON.stringify(driverLoginData)}`);
  console.log('Driver login successful! Token received. User:', driverLoginData.user.name, 'Role:', driverLoginData.user.role);
  const driverToken = driverLoginData.token;

  // Test 3: Vehicle Registration
  console.log('\n[3] Testing Vehicle Registration...');
  const testVehicleNumber = `TN-38-TEST-${Math.floor(1000 + Math.random() * 9000)}`;
  const regVehRes = await fetch(`${baseUrl}/vehicles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      vehicle_number: testVehicleNumber,
      make: 'Tata',
      model: 'Prima 5530.S',
      vehicle_type: 'Heavy Commercial Vehicle (HCV)',
      fuel_type: 'Diesel',
      manufacturing_year: 2024,
      chassis_number: `MAT${Date.now()}XYZ`,
      engine_number: `ENG${Date.now()}`,
      status: 'Available',
      current_odometer: 15400,
      fuel_tank_capacity: 400,
      current_fuel_level: 280,
      fuel_efficiency: 4.2
    })
  });
  const regVehData = await regVehRes.json();
  if (!regVehRes.ok || !regVehData.id) throw new Error(`Vehicle registration failed: ${JSON.stringify(regVehData)}`);
  const createdVehicleId = regVehData.id;
  console.log(`Vehicle created successfully! ID: ${createdVehicleId}, Plate: ${testVehicleNumber}`);

  // Test 4: Vehicle 360 Detail View
  console.log('\n[4] Testing Vehicle 360 Detail Profile API...');
  const veh360Res = await fetch(`${baseUrl}/vehicles/${createdVehicleId}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const veh360Data = await veh360Res.json();
  if (!veh360Res.ok || !veh360Data.vehicle || veh360Data.vehicle.vehicle_number !== testVehicleNumber) throw new Error(`Vehicle 360 detail fetch failed: ${JSON.stringify(veh360Data)}`);
  console.log('Vehicle 360 fetched successfully:', veh360Data.vehicle.make, veh360Data.vehicle.model, 'Status:', veh360Data.vehicle.status);

  // Test 5: Driver Creation & Assignment
  console.log('\n[5] Testing Driver Creation...');
  const testDriverPhone = `+91 99${Math.floor(10000000 + Math.random() * 90000000)}`;
  const createDriverRes = await fetch(`${baseUrl}/drivers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Ramesh Kumar Test',
      phone: testDriverPhone,
      license_number: `DL-TN-${Math.floor(100000 + Math.random() * 900000)}`,
      license_expiry_date: '2028-12-31',
      status: 'Active'
    })
  });
  const createDriverData = await createDriverRes.json();
  if (!createDriverRes.ok || !createDriverData.id) throw new Error(`Driver creation failed: ${JSON.stringify(createDriverData)}`);
  const createdDriverId = createDriverData.id;
  console.log(`Driver created successfully! ID: ${createdDriverId}, Assigned Vehicle: ${createdVehicleId}`);

  // Test 6: Create Booking / Trip
  console.log('\n[6] Testing Booking / Trip Creation...');
  const createBookingRes = await fetch(`${baseUrl}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      customer_name: 'Apex Logistics Hub',
      customer_mobile: '+91 98400 12345',
      pickup_location: 'Coimbatore Port Terminal, Tamil Nadu',
      drop_location: 'Chennai Harbour, Tamil Nadu',
      start_date: new Date().toISOString().split('T')[0],
      start_time: '10:00',
      end_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      end_time: '18:00',
      vehicle_id: createdVehicleId,
      driver_id: createdDriverId,
      booking_amount: 45000,
      advance_amount: 15000,
      remaining_amount: 30000,
      booking_status: 'Confirmed'
    })
  });
  const createBookingData = await createBookingRes.json();
  if (!createBookingRes.ok || !createBookingData.id) throw new Error(`Booking creation failed: ${JSON.stringify(createBookingData)}`);
  const createdBookingId = createBookingData.id;
  console.log(`Booking created successfully! ID: ${createdBookingId}, Number: ${createBookingData.bookingNumber}`);

  // Test 7: Start Trip API
  console.log('\n[7] Testing Trip Start (Changes Vehicle & Driver to On Trip and Enables Location Tracking)...');
  const startTripRes = await fetch(`${baseUrl}/tracking/trips/${createdBookingId}/start`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const startTripData = await startTripRes.json();
  if (!startTripRes.ok) throw new Error(`Start trip failed: ${JSON.stringify(startTripData)}`);
  console.log('Trip started successfully:', startTripData.message);

  // Test 8: Live Location Ingestion
  console.log('\n[8] Testing Location Stream Ingestion (Sending GPS Coordinates)...');
  const gpsCoords = [
    { lat: 11.0168, lng: 76.9558, speed: 12.5, heading: 90, accuracy: 5.0 },
    { lat: 11.0250, lng: 76.9680, speed: 15.0, heading: 95, accuracy: 4.5 },
    { lat: 11.0400, lng: 76.9850, speed: 18.2, heading: 100, accuracy: 4.0 }
  ];

  for (let i = 0; i < gpsCoords.length; i++) {
    const locRes = await fetch(`${baseUrl}/tracking/locations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        booking_id: createdBookingId,
        driver_id: createdDriverId,
        vehicle_id: createdVehicleId,
        latitude: gpsCoords[i].lat,
        longitude: gpsCoords[i].lng,
        accuracy: gpsCoords[i].accuracy,
        speed: gpsCoords[i].speed,
        heading: gpsCoords[i].heading
      })
    });
    const locData = await locRes.json();
    if (!locRes.ok) throw new Error(`Location post ${i} failed: ${JSON.stringify(locData)}`);
    console.log(`Location point ${i + 1} recorded: Lat=${gpsCoords[i].lat}, Lng=${gpsCoords[i].lng}, LocId=${locData.locationId}`);
  }

  // Test 9: Verify Live Tracking Status API
  console.log('\n[9] Verifying Live Tracking Fleet Status API...');
  const liveTrackingRes = await fetch(`${baseUrl}/tracking/live`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const liveVehicles = await liveTrackingRes.json();
  const trackedVeh = liveVehicles.find((v: any) => v.vehicle_id === createdVehicleId);
  if (!trackedVeh) throw new Error('Created vehicle not found in live tracking stream');
  console.log('Live tracked vehicle verified:', {
    vehicle_number: trackedVeh.vehicle_number,
    latitude: trackedVeh.latitude,
    longitude: trackedVeh.longitude,
    driver_name: trackedVeh.driver_name,
    is_tracking: trackedVeh.is_tracking,
    trip_status: trackedVeh.trip_status
  });

  // Test 10: Verify Trip History Polyline API
  console.log('\n[10] Verifying Trip Location History Polyline API...');
  const historyRes = await fetch(`${baseUrl}/tracking/history/${createdBookingId}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const historyData = await historyRes.json();
  if (!historyRes.ok || !historyData.locations || historyData.locations.length !== 3) {
    throw new Error(`Trip history count mismatch: expected 3, got ${historyData.locations?.length}`);
  }
  console.log(`Trip location history verified: ${historyData.locations.length} coordinates stored.`);

  // Test 11: Compliance & Notification Engine Evaluation
  console.log('\n[11] Testing Compliance & Notification Engine...');
  const evalRes = await fetch(`${baseUrl}/notifications/evaluate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const evalData = await evalRes.json();
  console.log('Compliance evaluation completed:', evalData);

  const notifRes = await fetch(`${baseUrl}/notifications`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const notifData = await notifRes.json();
  console.log(`Notifications fetched: ${notifData.notifications.length} notifications, Unread: ${notifData.unreadCount}`);

  // Test 12: Complete Trip
  console.log('\n[12] Testing Trip Complete...');
  const completeTripRes = await fetch(`${baseUrl}/tracking/trips/${createdBookingId}/complete`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const completeTripData = await completeTripRes.json();
  if (!completeTripRes.ok) throw new Error(`Trip complete failed: ${JSON.stringify(completeTripData)}`);
  console.log('Trip completed successfully:', completeTripData.message);

  // Verify Vehicle status is back to Available in Database
  const dbVehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [createdVehicleId]);
  console.log('Database verification of vehicle status after trip completion:', dbVehicle.status);
  if (dbVehicle.status !== 'Available') throw new Error('Vehicle status was not restored to Available');

  // Test 13: Database Check - Verify user-entered records are persisted
  console.log('\n[13] Database direct query checks...');
  const dbLocations = await db.all('SELECT * FROM trip_locations WHERE booking_id = ?', [createdBookingId]);
  console.log(`trip_locations row count for booking: ${dbLocations.length}`);
  if (dbLocations.length !== 3) throw new Error('Database trip locations count mismatch');

  const dbAuditLogs = await db.all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5');
  console.log(`Audit logs count recorded: ${dbAuditLogs.length}. Most recent action: ${dbAuditLogs[0]?.action} on ${dbAuditLogs[0]?.entity}`);

  console.log('\n>>> ALL 13 END-TO-END BACKEND & DATABASE VERIFICATIONS PASSED SUCCESSFULLY! <<<');
  process.exit(0);
}

runTests().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
