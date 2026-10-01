import fs from 'fs';
import path from 'path';

const API_BASE = 'http://127.0.0.1:5000/api';

async function runVehicleImageFlowTest() {
  console.log('=== STARTING VEHICLE PROFILE IMAGE FLOW TEST ===\n');

  // 1. Authenticate / Login as Administrator
  console.log('1. Logging in as Administrator...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smartfleet.com', password: 'Admin@123' })
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed with HTTP ${loginRes.status}: ${await loginRes.text()}`);
  }
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('✓ Administrator logged in successfully.\n');

  // 2. Test Image Upload: Create 2 dummy image buffers (PNG & JPG)
  console.log('2. Testing Image Upload Endpoint (/api/uploads/image)...');
  const dummyPng = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d460000000049454e44ae426082', 'hex');
  const dummyJpg = Buffer.from('ffd8ffe000104a46494600010101006000600000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffda0008010100003f007f00ffd9', 'hex');

  // Upload Bus Image A
  const formA = new FormData();
  formA.append('image', new Blob([new Uint8Array(dummyPng)], { type: 'image/png' }), 'bus-photo-a.png');
  const uploadResA = await fetch(`${API_BASE}/uploads/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formA
  });
  if (!uploadResA.ok) throw new Error(`Upload A failed: ${await uploadResA.text()}`);
  const uploadDataA = await uploadResA.json();
  console.log('✓ Bus Image A uploaded:', uploadDataA.url);

  // Test static file serving over HTTP
  const staticCheckA = await fetch(`http://127.0.0.1:5000${uploadDataA.url}`);
  if (!staticCheckA.ok) {
    throw new Error(`Static file HTTP check failed for ${uploadDataA.url}: HTTP ${staticCheckA.status}`);
  }
  const staticBufferA = await staticCheckA.arrayBuffer();
  console.log(`✓ Image A statically accessible over HTTP (${staticBufferA.byteLength} bytes, content-type: ${staticCheckA.headers.get('content-type')})`);

  // Upload Bus Image B
  const formB = new FormData();
  formB.append('image', new Blob([new Uint8Array(dummyJpg)], { type: 'image/jpeg' }), 'bus-photo-b.jpg');
  const uploadResB = await fetch(`${API_BASE}/uploads/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formB
  });
  if (!uploadResB.ok) throw new Error(`Upload B failed: ${await uploadResB.text()}`);
  const uploadDataB = await uploadResB.json();
  console.log('✓ Bus Image B uploaded:', uploadDataB.url);

  const staticCheckB = await fetch(`http://127.0.0.1:5000${uploadDataB.url}`);
  if (!staticCheckB.ok) {
    throw new Error(`Static file HTTP check failed for ${uploadDataB.url}: HTTP ${staticCheckB.status}`);
  }
  const staticBufferB = await staticCheckB.arrayBuffer();
  console.log(`✓ Image B statically accessible over HTTP (${staticBufferB.byteLength} bytes, content-type: ${staticCheckB.headers.get('content-type')})`);

  // 3. Register Vehicle A with Image A
  console.log('\n3. Registering Vehicle A (Bus) with Image A...');
  const vehNumberA = `TN-${Math.floor(10 + Math.random() * 89)}-AA-${Math.floor(1000 + Math.random() * 8999)}`;
  const regResA = await fetch(`${API_BASE}/vehicles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      vehicle_number: vehNumberA,
      vehicle_type: 'Bus',
      vehicle_category: 'Commercial',
      make: 'Ashok Leyland',
      model: 'Viking Passenger Coach',
      fuel_type: 'CNG',
      status: 'Available',
      profile_image_url: uploadDataA.url,
      photo_url: uploadDataA.url
    })
  });
  if (!regResA.ok) throw new Error(`Register Vehicle A failed: ${await regResA.text()}`);
  const regDataA = await regResA.json();
  const vehicleIdA = regDataA.id;
  console.log(`✓ Vehicle A registered with ID: ${vehicleIdA}, Image: ${uploadDataA.url}`);

  // 4. Register Vehicle B with Image B
  console.log('\n4. Registering Vehicle B (Heavy Truck) with Image B...');
  const vehNumberB = `TN-${Math.floor(10 + Math.random() * 89)}-BB-${Math.floor(1000 + Math.random() * 8999)}`;
  const regResB = await fetch(`${API_BASE}/vehicles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      vehicle_number: vehNumberB,
      vehicle_type: 'Heavy Commercial',
      vehicle_category: 'Goods',
      make: 'Tata Motors',
      model: 'Signa 4825.TK',
      fuel_type: 'Diesel',
      status: 'Available',
      profile_image_url: uploadDataB.url,
      photo_url: uploadDataB.url
    })
  });
  if (!regResB.ok) throw new Error(`Register Vehicle B failed: ${await regResB.text()}`);
  const regDataB = await regResB.json();
  const vehicleIdB = regDataB.id;
  console.log(`✓ Vehicle B registered with ID: ${vehicleIdB}, Image: ${uploadDataB.url}`);

  // 5. Verify Vehicle 360 Profile
  console.log('\n5. Verifying Vehicle A 360 Profile and Profile Image URL...');
  const getResA = await fetch(`${API_BASE}/vehicles/${vehicleIdA}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const profileDataA = await getResA.json();
  if (profileDataA.vehicle.profile_image_url !== uploadDataA.url && profileDataA.vehicle.photo_url !== uploadDataA.url) {
    throw new Error(`Vehicle A image mismatch! Expected: ${uploadDataA.url}, Got: ${profileDataA.vehicle.profile_image_url}`);
  }
  console.log('✓ Vehicle A 360 profile contains correct independent profile image:', profileDataA.vehicle.profile_image_url || profileDataA.vehicle.photo_url);

  // 6. Verify Vehicles Registry List
  console.log('\n6. Verifying Vehicles Registry List (/api/vehicles)...');
  const listRes = await fetch(`${API_BASE}/vehicles`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const listData = await listRes.json();
  const foundA = listData.find((v: any) => v.id === vehicleIdA);
  const foundB = listData.find((v: any) => v.id === vehicleIdB);
  if (!foundA || (foundA.profile_image_url !== uploadDataA.url && foundA.photo_url !== uploadDataA.url)) {
    throw new Error('Vehicle A in list does not have correct image!');
  }
  if (!foundB || (foundB.profile_image_url !== uploadDataB.url && foundB.photo_url !== uploadDataB.url)) {
    throw new Error('Vehicle B in list does not have correct image!');
  }
  if (foundA.profile_image_url === foundB.profile_image_url) {
    throw new Error('Vehicle A and Vehicle B should have separate independent images, but they are identical!');
  }
  console.log('✓ Vehicle A & Vehicle B have independent, correct profile images in registry list.');

  // 7. Update Vehicle A Image (Change Image)
  console.log('\n7. Testing Vehicle Profile Image Change (Update Image)...');
  const formC = new FormData();
  formC.append('image', new Blob([dummyPng], { type: 'image/png' }), 'bus-photo-updated.png');
  const uploadResC = await fetch(`${API_BASE}/uploads/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formC
  });
  const uploadDataC = await uploadResC.json();

  const updateImgRes = await fetch(`${API_BASE}/vehicles/${vehicleIdA}/image`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ profile_image_url: uploadDataC.url })
  });
  if (!updateImgRes.ok) throw new Error(`Update image failed: ${await updateImgRes.text()}`);
  console.log('✓ Vehicle A image updated to:', uploadDataC.url);

  // Verify persistence
  const getUpdatedResA = await fetch(`${API_BASE}/vehicles/${vehicleIdA}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const updatedProfileA = await getUpdatedResA.json();
  if (updatedProfileA.vehicle.profile_image_url !== uploadDataC.url && updatedProfileA.vehicle.photo_url !== uploadDataC.url) {
    throw new Error(`Updated image did not persist!`);
  }
  console.log('✓ Updated image persisted successfully.');

  // 8. Remove Vehicle Profile Image
  console.log('\n8. Testing Vehicle Profile Image Removal (Remove Image)...');
  const removeImgRes = await fetch(`${API_BASE}/vehicles/${vehicleIdA}/image`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ profile_image_url: null })
  });
  if (!removeImgRes.ok) throw new Error(`Remove image failed: ${await removeImgRes.text()}`);
  const getRemovedResA = await fetch(`${API_BASE}/vehicles/${vehicleIdA}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const removedProfileA = await getRemovedResA.json();
  if (removedProfileA.vehicle.profile_image_url || removedProfileA.vehicle.photo_url) {
    throw new Error(`Profile image was not cleared!`);
  }
  console.log('✓ Vehicle profile image removed successfully (cleared to NO IMAGE).');

  // 9. Cleanup Test Vehicles
  console.log('\n9. Cleaning up test vehicles...');
  await fetch(`${API_BASE}/vehicles/${vehicleIdA}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  await fetch(`${API_BASE}/vehicles/${vehicleIdB}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  console.log('✓ Test vehicles cleaned up.');

  console.log('\n========================================');
  console.log('🎉 ALL VEHICLE PROFILE IMAGE TESTS PASSED!');
  console.log('========================================\n');
}

runVehicleImageFlowTest().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
