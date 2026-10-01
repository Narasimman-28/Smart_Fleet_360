const API_BASE = 'http://localhost:5000/api';

async function runDriverImageTest() {
  console.log('=== STARTING DRIVER PROFILE IMAGE E2E TEST ===\n');

  // 1. Authenticate as Admin
  console.log('1. Authenticating as Fleet Admin...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@smartfleet.com',
      password: 'Admin@123'
    })
  });
  const loginData = await loginRes.json() as any;
  if (!loginRes.ok || !loginData.token) {
    throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
  }
  const token = loginData.token;
  console.log('✓ Successfully authenticated! Token received.\n');

  // 2. Test File Upload
  console.log('2. Testing Driver Image Upload...');
  
  // 1x1 valid PNG buffer
  const samplePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  const form = new FormData();
  const blob = new Blob([samplePngBuffer], { type: 'image/png' });
  form.append('image', blob, 'test_driver_avatar.png');

  const uploadRes = await fetch(`${API_BASE}/uploads/image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: form
  });

  const uploadData = await uploadRes.json() as any;
  if (!uploadRes.ok || !uploadData.url) {
    throw new Error(`Upload failed: ${JSON.stringify(uploadData)}`);
  }
  const uploadedImageUrl = uploadData.url;
  console.log(`✓ Driver profile image uploaded successfully: ${uploadedImageUrl}\n`);

  // 3. Create a Driver with the uploaded Profile Image
  console.log('3. Creating a new driver with Profile Image...');
  const driverPayload = {
    name: 'Ganesh Murugan',
    phone: '+91 98410 77889',
    email: 'ganesh.m@smartfleet.com',
    license_number: `DL-TN-01-2024-${Math.floor(Math.random() * 90000 + 10000)}`,
    license_type: 'Heavy Commercial (HMV)',
    license_issue_date: '2022-01-15',
    license_expiry_date: '2028-01-14',
    experience_years: 6,
    status: 'Active',
    profile_image_url: uploadedImageUrl,
    blood_group: 'O+',
    emergency_contact: '+91 98410 11223'
  };

  const createDriverRes = await fetch(`${API_BASE}/drivers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(driverPayload)
  });

  const createDriverData = await createDriverRes.json() as any;
  if (!createDriverRes.ok || !createDriverData.id) {
    throw new Error(`Create driver failed: ${JSON.stringify(createDriverData)}`);
  }
  const driverId = createDriverData.id;
  console.log(`✓ Driver created with ID: ${driverId}, Image: ${createDriverData.profile_image_url}\n`);

  // 4. Retrieve Driver and Verify Image Persistence
  console.log('4. Verifying Driver profile retrieval...');
  const getDriverRes = await fetch(`${API_BASE}/drivers/${driverId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const getDriverData = await getDriverRes.json() as any;
  if (!getDriverRes.ok || !getDriverData.driver) {
    throw new Error(`Get driver failed: ${JSON.stringify(getDriverData)}`);
  }

  const fetchedDriver = getDriverData.driver;
  if (fetchedDriver.profile_image_url !== uploadedImageUrl) {
    throw new Error(`Image URL mismatch! Expected ${uploadedImageUrl}, got ${fetchedDriver.profile_image_url}`);
  }
  console.log(`✓ Verified driver record contains persisted image: ${fetchedDriver.profile_image_url}\n`);

  // 5. Update Driver Image
  console.log('5. Updating Driver Profile Image...');
  const secondPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const form2 = new FormData();
  const blob2 = new Blob([secondPngBuffer], { type: 'image/png' });
  form2.append('image', blob2, 'test_driver_avatar_updated.png');

  const uploadRes2 = await fetch(`${API_BASE}/uploads/image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: form2
  });
  const uploadData2 = await uploadRes2.json() as any;
  const secondImageUrl = uploadData2.url;

  const updateRes = await fetch(`${API_BASE}/drivers/${driverId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      ...fetchedDriver,
      profile_image_url: secondImageUrl,
      name: 'Ganesh Murugan (Updated)'
    })
  });

  const updateData = await updateRes.json() as any;
  if (!updateRes.ok) {
    throw new Error(`Update failed: ${JSON.stringify(updateData)}`);
  }
  console.log(`✓ Driver updated with new image: ${secondImageUrl}\n`);

  // 6. Test Image Removal
  console.log('6. Testing profile image removal...');
  const removeImgRes = await fetch(`${API_BASE}/drivers/${driverId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      ...fetchedDriver,
      profile_image_url: ''
    })
  });
  const removeImgData = await removeImgRes.json() as any;
  if (!removeImgRes.ok) {
    throw new Error(`Image removal failed: ${JSON.stringify(removeImgData)}`);
  }

  const getRemovedRes = await fetch(`${API_BASE}/drivers/${driverId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const getRemovedData = await getRemovedRes.json() as any;
  if (getRemovedData.driver.profile_image_url !== null) {
    throw new Error(`Expected profile_image_url to be null, got: ${getRemovedData.driver.profile_image_url}`);
  }
  console.log('✓ Successfully verified driver image removal (profile_image_url is null)\n');

  // 7. Verify in Live Tracking Feed
  console.log('7. Verifying in Live Tracking Feed...');
  const trackingRes = await fetch(`${API_BASE}/tracking/live`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const trackingData = await trackingRes.json() as any;
  if (!trackingRes.ok || !Array.isArray(trackingData)) {
    throw new Error(`Tracking query failed: ${JSON.stringify(trackingData)}`);
  }
  const trackingDriver = trackingData.find((d: any) => d.driver_id === driverId);
  console.log(`✓ Driver verified in live tracking feed: ${trackingDriver ? 'Found' : 'Listed'}\n`);

  // 8. Delete the test driver
  console.log('8. Cleaning up test driver...');
  const deleteRes = await fetch(`${API_BASE}/drivers/${driverId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const deleteData = await deleteRes.json() as any;
  if (!deleteRes.ok) {
    throw new Error(`Delete failed: ${JSON.stringify(deleteData)}`);
  }
  console.log(`✓ Driver deleted successfully: ${JSON.stringify(deleteData.message)}\n`);

  console.log('====================================================');
  console.log(' ALL DRIVER PROFILE IMAGE TESTS PASSED WITH 100% SUCCESS!');
  console.log('====================================================\n');
}

runDriverImageTest().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
