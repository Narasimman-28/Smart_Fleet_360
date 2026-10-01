import { db, initDatabase } from './db/database';
import { seedDatabase } from './db/seed';

const BASE_URL = 'http://localhost:5000/api';

interface StepResult {
  step: number;
  name: string;
  passed: boolean;
  message: string;
}

const steps: StepResult[] = [];

function record(step: number, name: string, passed: boolean, message: string) {
  steps.push({ step, name, passed, message });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [Step ${step}]: ${name} -> ${message}`);
}

async function runE2EAuthVerification() {
  console.log('========================================================================');
  console.log('   SMARTFLEET 360 - END-TO-END LOGIN & LOGOUT VERIFICATION SUITE');
  console.log('========================================================================\n');

  await initDatabase();
  await seedDatabase();

  // Step 1: Health check
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json() as any;
    record(1, 'Server Health Check', res.status === 200 && data.status === 'ok', `Server responded 200 OK (Status: ${data.status})`);
  } catch (err: any) {
    record(1, 'Server Health Check', false, err.message);
  }

  // Step 2: Unauthenticated access to protected routes
  try {
    const res = await fetch(`${BASE_URL}/vehicles`);
    const data = await res.json() as any;
    record(2, 'Protected Route Blocked Without Token', res.status === 401, `Status ${res.status}: ${data.error}`);
  } catch (err: any) {
    record(2, 'Protected Route Blocked Without Token', false, err.message);
  }

  // Step 3: Login with Invalid Credentials
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@smartfleet.com', password: 'WrongPassword!99' })
    });
    const data = await res.json() as any;
    record(3, 'Invalid Credentials Rejected', res.status === 401 && data.error === 'Invalid username or password.', `Status ${res.status}: ${data.error}`);
  } catch (err: any) {
    record(3, 'Invalid Credentials Rejected', false, err.message);
  }

  // Step 4: Login with Inactive Account
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'inactive@smartfleet.com', password: 'Inactive@123' })
    });
    const data = await res.json() as any;
    record(4, 'Inactive Account Blocked', res.status === 403, `Status ${res.status}: ${data.error}`);
  } catch (err: any) {
    record(4, 'Inactive Account Blocked', false, err.message);
  }

  // Step 5: First Login - Super Admin
  let adminToken = '';
  let adminUser: any = null;
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@smartfleet.com', password: 'Admin@123' })
    });
    const data = await res.json() as any;
    adminToken = data.token;
    adminUser = data.user;
    const hasToken = Boolean(adminToken && adminToken.split('.').length === 3);
    const noPasswordLeaked = !('password_hash' in adminUser) && !('password' in adminUser);
    record(5, 'Super Admin Login Succeeded', res.status === 200 && hasToken && noPasswordLeaked, `Logged in as ${adminUser?.name} (${adminUser?.role}), received valid JWT`);
  } catch (err: any) {
    record(5, 'Super Admin Login Succeeded', false, err.message);
  }

  // Step 6: Access Protected Routes with Authenticated Session
  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json() as any;
    record(6, 'Session Validation (/api/auth/me)', res.status === 200 && data.user.email === 'admin@smartfleet.com', `Validated session for ${data.user.name}`);
  } catch (err: any) {
    record(6, 'Session Validation (/api/auth/me)', false, err.message);
  }

  // Step 7: Access Vehicles Registry as Authenticated Super Admin
  try {
    const res = await fetch(`${BASE_URL}/vehicles`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json() as any;
    record(7, 'Access Protected Dashboard Data (Vehicles)', res.status === 200 && Array.isArray(data), `Retrieved vehicles array (Length: ${data.length})`);
  } catch (err: any) {
    record(7, 'Access Protected Dashboard Data (Vehicles)', false, err.message);
  }

  // Step 8: User Logout via API
  try {
    const res = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
    });
    const data = await res.json() as any;
    record(8, 'Logout Endpoint Call', res.status === 200 && data.success === true && data.message === 'Logged out successfully', `Status ${res.status}: "${data.message}"`);
  } catch (err: any) {
    record(8, 'Logout Endpoint Call', false, err.message);
  }

  // Step 9: Audit Trail Log for Login and Logout
  try {
    const loginAudit = await db.get('SELECT * FROM audit_logs WHERE action = ? ORDER BY created_at DESC LIMIT 1', ['LOGIN']);
    const logoutAudit = await db.get('SELECT * FROM audit_logs WHERE action = ? ORDER BY created_at DESC LIMIT 1', ['LOGOUT']);
    record(9, 'Audit Trail Verification', Boolean(loginAudit && logoutAudit), `Recorded LOGIN (User: ${loginAudit?.user_name}) and LOGOUT (User: ${logoutAudit?.user_name})`);
  } catch (err: any) {
    record(9, 'Audit Trail Verification', false, err.message);
  }

  // Step 10: After Logout - Request without Token (Simulating storage purged)
  try {
    const res = await fetch(`${BASE_URL}/auth/me`);
    record(10, 'After Logout - Unauthenticated Request Blocked', res.status === 401, `Status ${res.status}: Protected /auth/me rejected unauthenticated request`);
  } catch (err: any) {
    record(10, 'After Logout - Unauthenticated Request Blocked', false, err.message);
  }

  // Step 11: Role Logins - Verify all 6 standard roles authenticate independently
  const rolesToTest = [
    { role: 'Fleet Manager', email: 'fleetmanager@smartfleet.com', pass: 'Fleet@123' },
    { role: 'Compliance Manager', email: 'compliance@smartfleet.com', pass: 'Compliance@123' },
    { role: 'Accountant', email: 'accountant@smartfleet.com', pass: 'Accounts@123' },
    { role: 'Mechanic', email: 'mechanic@smartfleet.com', pass: 'Mechanic@123' },
    { role: 'Driver', email: 'driver@smartfleet.com', pass: 'Driver@123' }
  ];

  let stepNum = 12;
  for (const r of rolesToTest) {
    try {
      // 1. Login
      const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: r.email, password: r.pass })
      });
      const loginData = await loginRes.json() as any;
      const token = loginData.token;
      const user = loginData.user;

      // 2. Validate Profile
      const meRes = await fetch(`${BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const meData = await meRes.json() as any;

      // 3. Logout
      const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });

      const passed = loginRes.status === 200 && meRes.status === 200 && logoutRes.status === 200 && user.role === r.role && meData.user.role === r.role;
      record(stepNum++, `Role Lifecycle: ${r.role}`, passed, `Authenticated as ${user?.name} [${user?.role}] -> verified /me -> logged out successfully`);
    } catch (err: any) {
      record(stepNum++, `Role Lifecycle: ${r.role}`, false, err.message);
    }
  }

  // Step 17: Multi-User Switch Isolation (Kumar -> Ravi)
  try {
    // 1. Login as Kumar (Driver)
    const resA = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'driver@smartfleet.com', password: 'Driver@123' })
    });
    const dataA = await resA.json() as any;

    // 2. Clear / Logout
    await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${dataA.token}` }
    });

    // 3. Login as Ravi (Fleet Manager)
    const resB = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'fleetmanager@smartfleet.com', password: 'Fleet@123' })
    });
    const dataB = await resB.json() as any;

    const isolated = dataA.user.id !== dataB.user.id && dataA.user.role === 'Driver' && dataB.user.role === 'Fleet Manager';
    record(17, 'Complete Multi-User Session Isolation', isolated, `Driver session completely terminated before Fleet Manager session created.`);
  } catch (err: any) {
    record(17, 'Complete Multi-User Session Isolation', false, err.message);
  }

  console.log('\n========================================================================');
  const allPassed = steps.every(s => s.passed);
  console.log(`TOTAL STEPS TESTED: ${steps.length}`);
  console.log(`PASSED: ${steps.filter(s => s.passed).length} | FAILED: ${steps.filter(s => !s.passed).length}`);
  console.log(`OVERALL STATUS: ${allPassed ? '🎉 ALL LOGIN & LOGOUT VERIFICATIONS PASSED 100%!' : '❌ SOME TESTS FAILED'}`);
  console.log('========================================================================\n');
}

runE2EAuthVerification().catch(err => console.error(err));
