import http from 'http';
import { seedDatabase } from './db/seed';

async function makeRequest(options: http.RequestOptions, body?: any): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode || 200, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode || 200, data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runE2ETests() {
  console.log('--- Starting API E2E Clean State Tests ---');

  // Step 1: Clean DB
  await seedDatabase();

  // Step 2: Login
  console.log('1. Testing Login API with Super Admin...');
  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { identifier: 'admin@smartfleet.com', password: 'Admin@123' });

  if (loginRes.status !== 200 || !loginRes.data?.token) {
    throw new Error(`Login failed: status ${loginRes.status}, data: ${JSON.stringify(loginRes.data)}`);
  }
  const token = loginRes.data.token;
  console.log('   Login successful! Token acquired.');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Step 3: Check Dashboard Stats on Empty Database
  console.log('2. Testing Dashboard Stats API on empty DB...');
  const statsRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/dashboard/stats',
    method: 'GET',
    headers: authHeaders
  });

  if (statsRes.status !== 200) {
    throw new Error(`Dashboard stats failed with status ${statsRes.status}`);
  }

  const s = statsRes.data;
  console.log('   Dashboard Metrics received:');
  console.log(`   - Total Fleet: ${s.totalVehicles}`);
  console.log(`   - Active Drivers: ${s.activeDrivers}`);
  console.log(`   - Active Trips: ${s.activeTrips}`);
  console.log(`   - Bookings: ${s.totalBookings}`);
  console.log(`   - Fuel Expenses: ₹${s.fuelExpenses}`);
  console.log(`   - Maintenance: ₹${s.maintenanceExpenses}`);
  console.log(`   - Pending Payments: ₹${s.pendingPayments}`);
  console.log(`   - FASTag Balance: ₹${s.fastagBalance}`);

  if (s.totalVehicles !== 0 || s.activeDrivers !== 0 || s.activeTrips !== 0 || s.totalBookings !== 0 ||
      s.fuelExpenses !== 0 || s.maintenanceExpenses !== 0 || s.pendingPayments !== 0 || s.fastagBalance !== 0) {
    throw new Error('Expected all dashboard KPI values to be 0 for an empty database!');
  }

  // Step 4: Check modules return empty lists
  console.log('3. Checking all REST entity endpoints return clean empty arrays...');
  const endpoints = ['/api/vehicles', '/api/drivers', '/api/bookings', '/api/fuel', '/api/service', '/api/fastag', '/api/challans', '/api/notifications'];
  for (const ep of endpoints) {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: ep,
      method: 'GET',
      headers: authHeaders
    });
    if (res.status !== 200) {
      throw new Error(`GET ${ep} returned status ${res.status}`);
    }
    const list = Array.isArray(res.data) ? res.data : (res.data?.notifications || []);
    if (list.length !== 0) {
      throw new Error(`Expected ${ep} to return 0 records, but got ${list.length}`);
    }
    console.log(`   - ${ep}: 0 records.`);
  }

  // Step 5: Test manual data entry via API
  console.log('4. Testing Manual Vehicle Registration via API...');
  const newVeh = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/vehicles',
    method: 'POST',
    headers: authHeaders
  }, {
    vehicle_number: 'DL-01-AX-9999',
    vehicle_type: 'Car',
    vehicle_category: 'Passenger',
    make: 'Hyundai',
    model: 'Creta',
    manufacturing_year: 2024,
    registration_date: '2024-01-15',
    chassis_number: 'HYU9876543210123',
    engine_number: 'ENG1234567890',
    fuel_type: 'Petrol',
    colour: 'Silver',
    owner_name: 'SmartFleet Transport',
    owner_phone: '+91 98100 00001',
    rto_office: 'Delhi South RTO',
    rto_code: 'DL-01',
    state: 'Delhi',
    status: 'Available',
    odometer_reading: 5000
  });

  if (newVeh.status !== 201 && newVeh.status !== 200) {
    throw new Error(`Vehicle creation failed: status ${newVeh.status}, ${JSON.stringify(newVeh.data)}`);
  }
  const createdVehId = newVeh.data.id;
  console.log(`   Vehicle successfully created: ID = ${createdVehId}, Number = ${newVeh.data.vehicle_number}`);

  console.log('5. Testing Manual Driver Onboarding via API (with profile image)...');
  const newDrv = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/drivers',
    method: 'POST',
    headers: authHeaders
  }, {
    name: 'Vikram Singh',
    phone: '+91 98765 00001',
    license_number: 'DL-01-2022-004455',
    license_type: 'Commercial',
    license_issue_date: '2022-01-01',
    license_expiry_date: '2032-01-01',
    experience_years: 6,
    status: 'Active',
    profile_image_url: '/uploads/drivers/vikram_profile.jpg'
  });

  if (newDrv.status !== 201 && newDrv.status !== 200) {
    throw new Error(`Driver creation failed: status ${newDrv.status}, ${JSON.stringify(newDrv.data)}`);
  }
  const createdDrvId = newDrv.data.id;
  console.log(`   Driver successfully created: ID = ${createdDrvId}, Name = ${newDrv.data.name}`);

  console.log('6. Testing Manual Trip Booking Creation via API...');
  const newBkg = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/bookings',
    method: 'POST',
    headers: authHeaders
  }, {
    vehicle_id: createdVehId,
    vehicle_number: 'DL-01-AX-9999',
    vehicle_type: 'Car',
    vehicle_category: 'Passenger',
    driver_id: createdDrvId,
    driver_name: 'Vikram Singh',
    driver_phone: '+91 98765 00001',
    customer_name: 'Tech Mahindra Ltd',
    customer_mobile: '+91 99999 88888',
    pickup_location: 'Indira Gandhi Airport T3',
    drop_location: 'Cyber Hub, Gurugram',
    start_date: '2026-10-05',
    start_time: '09:00',
    end_date: '2026-10-05',
    end_time: '18:00',
    trip_type: 'One Way',
    booking_amount: 3500,
    advance_amount: 1500,
    payment_status: 'Partial'
  });

  if (newBkg.status !== 201 && newBkg.status !== 200) {
    throw new Error(`Booking creation failed: status ${newBkg.status}, ${JSON.stringify(newBkg.data)}`);
  }
  console.log(`   Booking created successfully: Booking # = ${newBkg.data.booking_number}`);

  console.log('7. Verifying Dashboard Stats immediately reflects manual data...');
  const updatedStats = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/dashboard/stats',
    method: 'GET',
    headers: authHeaders
  });

  if (updatedStats.data.totalVehicles !== 1 || updatedStats.data.activeDrivers !== 1 || updatedStats.data.totalBookings !== 1) {
    throw new Error(`Stats mismatch after manual creation: ${JSON.stringify(updatedStats.data)}`);
  }
  console.log(`   Stats accurately updated: Total Vehicles = ${updatedStats.data.totalVehicles}, Active Drivers = ${updatedStats.data.activeDrivers}, Total Bookings = ${updatedStats.data.totalBookings}`);

  // Step 6: Final reset to completely empty clean state
  console.log('8. Performing Final Database Clean Reset...');
  await seedDatabase();
  console.log('   All sample/test records cleared. Database is 100% clean and ready for real manual production entry.');
  console.log('--- ALL E2E API TESTS PASSED SUCCESSFULLY ---');
}

runE2ETests().catch(err => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
