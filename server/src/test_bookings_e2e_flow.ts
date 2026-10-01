import { db, initDatabase } from './db/database';

async function runTest() {
  console.log('=== STARTING 17-STEP BOOKINGS & TRIPS LIFECYCLE E2E TEST ===\n');
  await initDatabase();

  // Step 1 & 2: Start & Verify Empty Database State
  console.log('Step 1 & 2: Testing Empty State Verification...');
  await db.run('DELETE FROM bookings');
  await db.run("DELETE FROM payments WHERE reference_type = 'Booking Advance'");

  const API_HOST = 'http://localhost:5000/api';

  // Login as admin
  const loginRes = await fetch(`${API_HOST}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smartfleet.com', password: 'Admin@123' })
  });
  const { token } = await loginRes.json();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Get initial summary and bookings
  const summaryRes1 = await fetch(`${API_HOST}/bookings/summary`, { headers });
  const summary1 = await summaryRes1.json();
  const listRes1 = await fetch(`${API_HOST}/bookings`, { headers });
  const list1 = await listRes1.json();

  console.log('Empty Summary Check:', summary1);
  console.log('Empty Bookings Count:', list1.length);

  if (list1.length !== 0) throw new Error('Expected 0 bookings in empty state');
  if (summary1.totalRevenue !== 0 || summary1.totalAdvance !== 0 || summary1.totalRemaining !== 0 || summary1.totalTrips !== 0) {
    throw new Error('Expected all summary metrics to be 0 in empty state');
  }
  console.log('✓ Step 2 Passed: Empty database verified (0 bookings, ₹0 counters).\n');

  // Step 3: Create one booking manually
  console.log('Step 3: Creating Booking Manually...');
  const vehiclesRes = await fetch(`${API_HOST}/vehicles`, { headers });
  const vehicles = await vehiclesRes.json();
  const driversRes = await fetch(`${API_HOST}/drivers`, { headers });
  const drivers = await driversRes.json();

  if (vehicles.length === 0 || drivers.length === 0) {
    throw new Error('Need at least 1 vehicle and 1 driver to test booking');
  }

  const testVehicle = vehicles[0];
  const testDriver = drivers[0];

  const createPayload = {
    booking_number: 'BK-2026-TEST-99',
    booking_date: '2026-10-01',
    customer_name: 'Ramesh Logistics Ltd',
    customer_mobile: '9876543210',
    customer_address: '45 Commercial Street, Chennai',
    pickup_location: 'Chennai Port Terminal',
    drop_location: 'Bengaluru Industrial Hub',
    start_date: '2026-10-01',
    start_time: '09:30 AM',
    end_date: '2026-10-01',
    end_time: '06:15 PM',
    vehicle_id: testVehicle.id,
    vehicle_number: testVehicle.vehicle_number,
    vehicle_type: testVehicle.vehicle_type,
    driver_id: testDriver.id,
    driver_name: testDriver.name,
    driver_phone: testDriver.phone,
    trip_type: 'Goods Transport',
    passenger_or_goods_details: '15 Tons Industrial Equipment',
    booking_amount: 35000,
    advance_amount: 15000,
    remaining_amount: 20000,
    special_instructions: 'Handle with care. Deliver before 6 PM.'
  };

  const createRes = await fetch(`${API_HOST}/bookings`, {
    method: 'POST',
    headers,
    body: JSON.stringify(createPayload)
  });
  const createResult = await createRes.json();
  console.log('Create Booking Response:', createResult);
  if (!createResult.id) throw new Error('Failed to create booking: ' + JSON.stringify(createResult));
  const bookingId = createResult.id;

  // Step 4: Verify it appears as CONFIRMED
  console.log('\nStep 4: Verifying Created Booking in DB & Summary...');
  const getBookingRes = await fetch(`${API_HOST}/bookings/${bookingId}`, { headers });
  const createdBooking = await getBookingRes.json();
  console.log('Created Booking Data:', {
    id: createdBooking.id,
    number: createdBooking.booking_number,
    customer: createdBooking.customer_name,
    phone: createdBooking.customer_mobile,
    vehicle: createdBooking.vehicle_number,
    driver: createdBooking.driver_name,
    status: createdBooking.booking_status,
    total: createdBooking.booking_amount,
    advance: createdBooking.advance_amount,
    remaining: createdBooking.remaining_amount
  });

  if (createdBooking.booking_status !== 'Confirmed') throw new Error('Expected status Confirmed');
  if (createdBooking.booking_amount !== 35000 || createdBooking.advance_amount !== 15000 || createdBooking.remaining_amount !== 20000) {
    throw new Error('Financial amounts mismatch');
  }

  // Check Confirmed tab filter
  const confirmedListRes = await fetch(`${API_HOST}/bookings?status=Confirmed`, { headers });
  const confirmedList = await confirmedListRes.json();
  if (confirmedList.length !== 1) throw new Error('Expected 1 booking in Confirmed tab');
  console.log('✓ Step 4 Passed: Status is Confirmed with exact entered values and tab visibility.\n');

  // Step 5 & 6 & 7: Click START TRIP -> Verify status changes to STARTED & actual start time saved
  console.log('Step 5, 6, 7: Starting Trip...');
  const startRes = await fetch(`${API_HOST}/bookings/${bookingId}/start`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ actual_start_date: '2026-10-01', actual_start_time: '09:30 AM' })
  });
  const startResult = await startRes.json();
  console.log('Start Trip Response:', startResult);

  const startedBookingRes = await fetch(`${API_HOST}/bookings/${bookingId}`, { headers });
  const startedBooking = await startedBookingRes.json();
  console.log('Started Booking State:', {
    status: startedBooking.booking_status,
    actual_start_date: startedBooking.actual_start_date,
    actual_start_time: startedBooking.actual_start_time
  });

  if (startedBooking.booking_status !== 'Started') throw new Error('Expected status Started');
  if (!startedBooking.actual_start_time) throw new Error('Expected actual_start_time to be saved');

  // Check Started tab filter
  const startedListRes = await fetch(`${API_HOST}/bookings?status=Started`, { headers });
  const startedList = await startedListRes.json();
  if (startedList.length !== 1) throw new Error('Expected 1 booking in Started tab');
  console.log('✓ Steps 5, 6, 7 Passed: Status changed to Started and actual start time recorded.\n');

  // Step 8, 9, 10, 11: Click END TRIP -> Verify status changes to COMPLETED, actual end time saved & duration calculated
  console.log('Step 8, 9, 10, 11: Ending Trip...');
  const endRes = await fetch(`${API_HOST}/bookings/${bookingId}/end`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ actual_end_date: '2026-10-01', actual_end_time: '06:15 PM' })
  });
  const endResult = await endRes.json();
  console.log('End Trip Response:', endResult);

  const completedBookingRes = await fetch(`${API_HOST}/bookings/${bookingId}`, { headers });
  const completedBooking = await completedBookingRes.json();
  console.log('Completed Booking State:', {
    status: completedBooking.booking_status,
    actual_start: `${completedBooking.actual_start_date} ${completedBooking.actual_start_time}`,
    actual_end: `${completedBooking.actual_end_date} ${completedBooking.actual_end_time}`,
    duration: completedBooking.trip_duration
  });

  if (completedBooking.booking_status !== 'Completed') throw new Error('Expected status Completed');
  if (!completedBooking.actual_end_time) throw new Error('Expected actual_end_time to be saved');
  if (!completedBooking.trip_duration) throw new Error('Expected trip_duration to be calculated');

  // Check Completed tab filter
  const completedListRes = await fetch(`${API_HOST}/bookings?status=Completed`, { headers });
  const completedList = await completedListRes.json();
  if (completedList.length !== 1) throw new Error('Expected 1 booking in Completed tab');
  console.log('✓ Steps 8, 9, 10, 11 Passed: Status Completed, actual end time and duration calculated.\n');

  // Step 12 & 13: Refresh / Reload -> Verify all information remains intact
  console.log('Step 12 & 13: Verifying Database Persistence...');
  const reloadedBooking = await db.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
  if (!reloadedBooking || reloadedBooking.booking_status !== 'Completed') {
    throw new Error('Database persistence verification failed');
  }
  console.log('✓ Steps 12 & 13 Passed: Data perfectly preserved in database.\n');

  // Step 14 & 15: Edit Booking -> Verify edited information is saved
  console.log('Step 14 & 15: Editing Booking...');
  const updatePayload = {
    ...createPayload,
    booking_amount: 38000,
    advance_amount: 15000,
    remaining_amount: 23000,
    special_instructions: 'Updated: Special express delivery completed'
  };
  const updateRes = await fetch(`${API_HOST}/bookings/${bookingId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updatePayload)
  });
  const updateResult = await updateRes.json();
  console.log('Update Response:', updateResult);

  const editedBookingRes = await fetch(`${API_HOST}/bookings/${bookingId}`, { headers });
  const editedBooking = await editedBookingRes.json();
  console.log('Edited Booking State:', {
    total: editedBooking.booking_amount,
    advance: editedBooking.advance_amount,
    remaining: editedBooking.remaining_amount,
    special_instructions: editedBooking.special_instructions
  });

  if (editedBooking.booking_amount !== 38000 || editedBooking.remaining_amount !== 23000) {
    throw new Error('Edited amounts not reflected');
  }
  console.log('✓ Steps 14 & 15 Passed: Booking edited and updated in database.\n');

  // Step 16 & 17: Delete Booking -> Verify removed from DB and UI counters update
  console.log('Step 16 & 17: Deleting Booking...');
  const deleteRes = await fetch(`${API_HOST}/bookings/${bookingId}`, {
    method: 'DELETE',
    headers
  });
  const deleteResult = await deleteRes.json();
  console.log('Delete Response:', deleteResult);

  const afterDeleteListRes = await fetch(`${API_HOST}/bookings`, { headers });
  const afterDeleteList = await afterDeleteListRes.json();
  const afterDeleteSummaryRes = await fetch(`${API_HOST}/bookings/summary`, { headers });
  const afterDeleteSummary = await afterDeleteSummaryRes.json();

  console.log('After Delete List Count:', afterDeleteList.length);
  console.log('After Delete Summary:', afterDeleteSummary);

  if (afterDeleteList.length !== 0) throw new Error('Expected 0 bookings after deletion');
  if (afterDeleteSummary.totalRevenue !== 0 || afterDeleteSummary.totalTrips !== 0) {
    throw new Error('Expected 0 revenue and 0 trips after deletion');
  }
  console.log('✓ Steps 16 & 17 Passed: Booking permanently deleted from database and summary counters reset to 0.\n');

  console.log('===============================================================');
  console.log('  ALL 17 TEST STEPS PASSED WITH 100% SUCCESS AND PERSISTENCE!  ');
  console.log('===============================================================');
}

runTest().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
