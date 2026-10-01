import fs from 'fs';
import path from 'path';
import { UPLOADS_ROOT } from './utils/storage';

const API_BASE = 'http://127.0.0.1:5000/api';

async function testRealImage() {
  console.log('=== TESTING REAL IMAGE UPLOAD & SERVING PIPELINE ===\n');

  // 1. Admin login
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smartfleet.com', password: 'Admin@123' })
  });
  const { token } = await loginRes.json();
  console.log('1. Admin authenticated.');

  // 2. Read an existing real image or create standard binary
  const existingFiles = fs.existsSync(UPLOADS_ROOT) 
    ? fs.readdirSync(UPLOADS_ROOT).filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
    : [];
  
  let imageBuffer: Buffer;
  let filename = 'test-bus-real.jpg';
  let mimeType = 'image/jpeg';

  if (existingFiles.length > 0) {
    const samplePath = path.join(UPLOADS_ROOT, existingFiles[0]);
    imageBuffer = fs.readFileSync(samplePath);
    filename = existingFiles[0];
    mimeType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
    console.log(`2. Using real image sample: ${filename} (${(imageBuffer.length / 1024).toFixed(1)} KB)`);
  } else {
    imageBuffer = Buffer.alloc(1024 * 50, 0xff);
    console.log(`2. Created 50KB synthetic image.`);
  }

  // 3. Upload image via multipart FormData
  const form = new FormData();
  form.append('image', new Blob([new Uint8Array(imageBuffer)], { type: mimeType }), filename);

  const uploadRes = await fetch(`${API_BASE}/uploads/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });

  if (!uploadRes.ok) throw new Error(`Upload failed: ${await uploadRes.text()}`);
  const uploadData = await uploadRes.json();
  console.log('3. Image uploaded successfully. Stored URL:', uploadData.url);

  // 4. Verify static file serving
  const staticRes = await fetch(`http://127.0.0.1:5000${uploadData.url}`);
  if (!staticRes.ok) {
    throw new Error(`Static file failed to serve: HTTP ${staticRes.status}`);
  }
  const receivedBuffer = await staticRes.arrayBuffer();
  console.log(`4. Image verified accessible over HTTP! Length: ${receivedBuffer.byteLength} bytes.`);

  // 5. Register vehicle with this image
  const regRes = await fetch(`${API_BASE}/vehicles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      vehicle_number: `TN-99-TEST-${Math.floor(1000 + Math.random() * 9000)}`,
      vehicle_type: 'Bus',
      make: 'Ashok Leyland',
      model: 'Viking 222',
      profile_image_url: uploadData.url
    })
  });

  if (!regRes.ok) throw new Error(`Vehicle registration failed: ${await regRes.text()}`);
  const regData = await regRes.json();
  console.log('5. Vehicle registered with real profile image:', regData.id);

  // 6. Fetch vehicle and assert image
  const getRes = await fetch(`${API_BASE}/vehicles/${regData.id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const getData = await getRes.json();
  if (getData.vehicle.profile_image_url !== uploadData.url) {
    throw new Error('Vehicle profile_image_url mismatch!');
  }
  console.log('6. Vehicle record verified in database with profile image URL:', getData.vehicle.profile_image_url);

  // 7. Cleanup
  await fetch(`${API_BASE}/vehicles/${regData.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('7. Test vehicle cleaned up safely.\n');

  console.log('✅ REAL IMAGE PIPELINE FULLY FUNCTIONAL AND VERIFIED!');
}

testRealImage().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
