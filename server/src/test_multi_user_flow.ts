async function runTestSuite() {
  const BASE_URL = 'http://127.0.0.1:5000/api';
  console.log('🚀 Starting SmartFleet 360 Multi-User RBAC & Auth Test Suite...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`, detail || '');
      failed++;
    }
  }

  // 1. Initial Super Admin Login
  console.log('--- Step 1: Super Admin Login ---');
  const adminRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smartfleet.com', password: 'Admin@123' })
  });
  const adminData: any = await adminRes.json();
  assert(adminRes.ok && adminData.token, 'Super Admin logs in successfully', adminData);
  assert(adminData.user?.role === 'Super Admin', 'Admin role is Super Admin');
  assert(!adminData.user?.password && !adminData.user?.password_hash, 'Password is never returned in API response');
  const adminToken = adminData.token;

  // 2. Super Admin Creates Person A (Fleet Manager)
  console.log('\n--- Step 2: Super Admin Creates Person A (Fleet Manager) ---');
  const createPersonARes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Narasimman Manager',
      email: 'narasimman.fm@testcorp.com',
      password: 'StrongPassword@2026',
      role: 'Fleet Manager',
      status: 'Active',
      phone: '+91 9876543210'
    })
  });
  const personAData: any = await createPersonARes.json();
  assert(
    createPersonARes.status === 201 || createPersonARes.status === 409 || (createPersonARes.status === 400 && personAData.error?.includes('already')),
    'Created Person A or already exists from previous run'
  );

  // 3. Super Admin Creates Person B (Accountant)
  console.log('\n--- Step 3: Super Admin Creates Person B (Accountant) ---');
  const createPersonBRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Sarah Accounts',
      email: 'sarah.acc@testcorp.com',
      password: 'FinancePassword@2026',
      role: 'Accountant',
      status: 'Active',
      phone: '+91 9876543211'
    })
  });
  const personBData: any = await createPersonBRes.json();
  assert(
    createPersonBRes.status === 201 || createPersonBRes.status === 409 || (createPersonBRes.status === 400 && personBData.error?.includes('already')),
    'Created Person B or already exists from previous run'
  );

  // 4. Duplicate Email Validation
  console.log('\n--- Step 4: Duplicate Email Validation ---');
  const duplicateRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Duplicate Guy',
      email: 'narasimman.fm@testcorp.com',
      password: 'AnyPassword@123',
      role: 'Driver'
    })
  });
  const duplicateData: any = await duplicateRes.json();
  assert(
    (duplicateRes.status === 409 || duplicateRes.status === 400) && (duplicateData.error?.includes('already exists') || duplicateData.error?.includes('already in use')),
    'Duplicate email rejected properly'
  );

  // 5. Login as Person A (Fleet Manager)
  console.log('\n--- Step 5: Login as Person A (Fleet Manager) ---');
  const loginPersonARes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'narasimman.fm@testcorp.com', password: 'StrongPassword@2026' })
  });
  const loginPersonAData: any = await loginPersonARes.json();
  assert(loginPersonARes.ok && loginPersonAData.token, 'Person A logged in successfully');
  assert(loginPersonAData.user?.name === 'Narasimman Manager', 'Person A name is displayed correctly');
  assert(loginPersonAData.user?.role === 'Fleet Manager', 'Person A role is Fleet Manager');
  const tokenPersonA = loginPersonAData.token;

  // Verify Person A cannot access Super Admin User Management
  const personATryUsersRes = await fetch(`${BASE_URL}/users`, {
    headers: { Authorization: `Bearer ${tokenPersonA}` }
  });
  assert(
    personATryUsersRes.status === 403,
    'Person A (Fleet Manager) is blocked from Super Admin User Management (403 Forbidden)'
  );

  // 6. Login as Person B (Accountant)
  console.log('\n--- Step 6: Login as Person B (Accountant) ---');
  const loginPersonBRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sarah.acc@testcorp.com', password: 'FinancePassword@2026' })
  });
  const loginPersonBData: any = await loginPersonBRes.json();
  assert(loginPersonBRes.ok && loginPersonBData.token, 'Person B logged in successfully');
  assert(loginPersonBData.user?.name === 'Sarah Accounts', 'Person B name is displayed correctly');
  assert(loginPersonBData.user?.role === 'Accountant', 'Person B role is Accountant');
  const tokenPersonB = loginPersonBData.token;

  // Verify Person B cannot access Super Admin User Management
  const personBTryUsersRes = await fetch(`${BASE_URL}/users`, {
    headers: { Authorization: `Bearer ${tokenPersonB}` }
  });
  assert(
    personBTryUsersRes.status === 403,
    'Person B (Accountant) is blocked from Super Admin User Management (403 Forbidden)'
  );

  // 7. Test Invalid Login Credentials
  console.log('\n--- Step 7: Invalid Login Credentials Test ---');
  const wrongPassRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'narasimman.fm@testcorp.com', password: 'WrongPassword123' })
  });
  const wrongPassData: any = await wrongPassRes.json();
  assert(
    wrongPassRes.status === 401 && wrongPassData.error === 'Invalid email or password.',
    'Incorrect password returns generic "Invalid email or password."'
  );

  const wrongEmailRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nonexistent.user@random.com', password: 'SomePassword' })
  });
  const wrongEmailData: any = await wrongEmailRes.json();
  assert(
    wrongEmailRes.status === 401 && wrongEmailData.error === 'Invalid email or password.',
    'Non-existent email returns generic "Invalid email or password."'
  );

  // 8. Test Disabled / Inactive Account
  console.log('\n--- Step 8: Disabled / Inactive Account Test ---');
  // Find Person A's user id
  const allUsersRes = await fetch(`${BASE_URL}/users`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const allUsers: any = await allUsersRes.json();
  const personAUser = allUsers.find((u: any) => u.email === 'narasimman.fm@testcorp.com');

  if (personAUser) {
    // Admin sets Person A to Inactive
    const disableRes = await fetch(`${BASE_URL}/users/${personAUser.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'Inactive' })
    });
    assert(disableRes.ok, 'Super Admin set Person A account to Inactive');

    // Person A attempts to log in
    const disabledLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'narasimman.fm@testcorp.com', password: 'StrongPassword@2026' })
    });
    const disabledLoginData: any = await disabledLoginRes.json();
    assert(
      disabledLoginRes.status === 403 && disabledLoginData.error?.includes('disabled'),
      'Disabled account receives account-status error: "Your account is currently disabled. Please contact the administrator."'
    );

    // Re-enable Person A
    await fetch(`${BASE_URL}/users/${personAUser.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'Active' })
    });
    console.log('Re-enabled Person A account to Active');
  }

  // 9. Logout Test
  console.log('\n--- Step 9: User Logout Test ---');
  const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenPersonA}` }
  });
  assert(logoutRes.ok, 'Logout endpoint responded successfully');

  // Summary
  console.log(`\n========================================`);
  console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);
}

runTestSuite().catch(console.error);
