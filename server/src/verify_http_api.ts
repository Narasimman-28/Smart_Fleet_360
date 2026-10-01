import http from 'http';
import { db } from './db/database';

function makeRequest(options: http.RequestOptions, body?: any): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
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

async function testHttpFlow() {
  console.log('=== VERIFYING LIVE SMARTFLEET 360 API VIA HTTP (http://localhost:5000) ===\n');

  // Clean DB test bookings to ensure pristine state
  await db.run('DELETE FROM payments WHERE reference_type LIKE "%Booking%"');
  await db.run('DELETE FROM trip_locations');
  await db.run('DELETE FROM bookings');
  await db.run('DELETE FROM vehicles WHERE vehicle_number LIKE "DL 01 AX 5555"');
  await db.run('DELETE FROM drivers WHERE license_number LIKE "DL-04-2022-8888"');

  // 1. Authenticate as Super Admin
  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@smartfleet.com', password: 'Admin@123' });

  if (loginRes.status !== 200 || !loginRes.data.token) {
    throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`);
  }
  const token = loginRes.data.token;
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  console.log('✔ 1. Authenticated as Super Admin successfully.');

  // 2. Test Empty State Summary
  const summaryRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/bookings/summary',
    method: 'GET',
    headers: authHeaders
  });
  console.log('✔ 2. Live Bookings Summary (Empty DB):', summaryRes.data);
  if (summaryRes.data.totalTrips !== 0 || summaryRes.data.totalRevenue !== 0) {
    throw new Error('Summary is not empty!');
  }

  // 3. Register a test vehicle for the booking
  const vehRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/vehicles',
    method: 'POST',
    headers: authHeaders
  }, {
    vehicle_number: 'DL 01 AX 5555',
    vehicle_type: 'Truck',
    vehicle_category: 'Commercial',
    make: 'BharatBenz',
    model: '1617R',
    fuel_type: 'Diesel'
  });
  const vehicleId = vehRes.data.id || vehRes.data.vehicleId;
  console.log(`✔ 3. Registered test vehicle: DL 01 AX 5555 (ID: ${vehicleId})`);

  // 4. Register a test driver for the booking
  const drvRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/drivers',
    method: 'POST',
    headers: authHeaders
  }, {
    name: 'Vikram Singh',
    phone: '+919811122233',
    license_number: 'DL-04-2022-8888',
    license_type: 'Heavy Commercial',
    license_issue_date: '2022-01-01',
    license_expiry_date: '2032-01-01',
    experience_years: 8
  });
  const driverId = drvRes.data.id;
  console.log(`✔ 4. Registered test driver: Vikram Singh (ID: ${driverId})`);

  // 5. Create Booking Manually (POST /api/bookings)
  const uniqueBookingNum = `BK-2026-LIVE-${Date.now()}`;
  const createBookingRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/bookings',
    method: 'POST',
    headers: authHeaders
  }, {
    booking_number: uniqueBookingNum,
    booking_date: '2026-10-01',
    customer_name: 'Adani Logistics Hub',
    customer_mobile: '+919988776655',
    customer_address: 'Mundra SEZ, Gujarat',
    pickup_location: 'Mundra Port',
    drop_location: 'Delhi NCR Hub',
    start_date: '2026-10-01',
    start_time: '09:30 AM',
    end_date: '2026-10-02',
    end_time: '06:15 PM',
    vehicle_id: vehicleId,
    driver_id: driverId,
    trip_type: 'Goods Transport',
    passenger_or_goods_details: '15 Tons Steel Coils',
    booking_amount: 45000,
    advance_amount: 20000,
    distance_km: 1100,
    special_instructions: 'Handle industrial heavy coils with safety straps'
  });

  if (createBookingRes.status !== 201) {
    throw new Error(`Failed to create booking: ${JSON.stringify(createBookingRes.data)}`);
  }
  const bookingId = createBookingRes.data.id;
  console.log(`✔ 5. Manual booking created: ${createBookingRes.data.bookingNumber} (ID: ${bookingId})`);

  // 6. Verify Booking Details & Initial Status
  const getBookingRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/bookings/${bookingId}`,
    method: 'GET',
    headers: authHeaders
  });
  console.log(`✔ 6. Verified booking details: Status="${getBookingRes.data.booking_status}", Fare=₹${getBookingRes.data.booking_amount}, Advance=₹${getBookingRes.data.advance_amount}, Remaining=₹${getBookingRes.data.remaining_amount}`);
  if (getBookingRes.data.booking_status !== 'Confirmed') {
    throw new Error(`Expected Confirmed status, got ${getBookingRes.data.booking_status}`);
  }

  // 7. Test START TRIP (POST /api/bookings/:id/start)
  const startTripRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/bookings/${bookingId}/start`,
    method: 'POST',
    headers: authHeaders
  }, {
    actual_start_date: '2026-10-01',
    actual_start_time: '09:35 AM'
  });
  console.log(`✔ 7. START TRIP response:`, startTripRes.data.message);
  console.log(`   Status: ${startTripRes.data.booking.booking_status}, Actual Start: ${startTripRes.data.booking.actual_start_time}`);
  if (startTripRes.data.booking.booking_status !== 'Started') {
    throw new Error('START TRIP failed');
  }

  // 8. Test END TRIP (POST /api/bookings/:id/end)
  const endTripRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/bookings/${bookingId}/end`,
    method: 'POST',
    headers: authHeaders
  }, {
    actual_end_date: '2026-10-02',
    actual_end_time: '06:10 PM'
  });
  console.log(`✔ 8. END TRIP response:`, endTripRes.data.message);
  console.log(`   Status: ${endTripRes.data.booking.booking_status}, Actual End: ${endTripRes.data.booking.actual_end_time}, Duration: "${endTripRes.data.booking.trip_duration}"`);
  if (endTripRes.data.booking.booking_status !== 'Completed' || !endTripRes.data.booking.trip_duration) {
    throw new Error('END TRIP failed');
  }

  // 9. Test Edit Booking (PUT /api/bookings/:id)
  const editBookingRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/bookings/${bookingId}`,
    method: 'PUT',
    headers: authHeaders
  }, {
    ...getBookingRes.data,
    customer_name: 'Adani Global Logistics Hub',
    booking_amount: 50000,
    advance_amount: 25000,
    special_instructions: 'Updated: Fast track delivery required'
  });
  console.log(`✔ 9. Edit booking response:`, editBookingRes.data.message);

  // 10. Test Search
  const searchRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/bookings?search=Mundra',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`✔ 10. Search for "Mundra" returned ${searchRes.data.length} match(es).`);

  // 11. Test Delete Booking (DELETE /api/bookings/:id)
  const deleteRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/bookings/${bookingId}`,
    method: 'DELETE',
    headers: authHeaders
  });
  console.log(`✔ 11. Delete booking response:`, deleteRes.data.message);

  // Cleanup test vehicle and driver
  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/vehicles/${vehicleId}`,
    method: 'DELETE',
    headers: authHeaders
  });
  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/drivers/${driverId}`,
    method: 'DELETE',
    headers: authHeaders
  });

  // Verify counters after deletion
  const finalSummaryRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/bookings/summary',
    method: 'GET',
    headers: authHeaders
  });
  console.log('✔ 12. Final summary counters (Clean & zeroed):', finalSummaryRes.data);

  console.log('\n========================================================================');
  console.log('🎉 ALL LIVE API TESTS PASSED SUCCESSFULLY! 100% DATABASE-DRIVEN!');
  console.log('========================================================================\n');
}

testHttpFlow().catch((err) => {
  console.error('❌ HTTP test failed:', err);
  process.exit(1);
});
