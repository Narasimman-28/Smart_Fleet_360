async function testFrontend() {
  console.log('--- TESTING FRONTEND VITE SERVER (http://localhost:5173/) ---');

  // Test 1: Fetch index.html
  const htmlRes = await fetch('http://localhost:5173/');
  console.log('Vite dev index.html status:', htmlRes.status);
  const htmlText = await htmlRes.text();
  if (!htmlText.includes('<div id="root"></div>') && !htmlText.includes('main.tsx')) {
    throw new Error('Index HTML does not contain root div or main.tsx');
  }
  console.log('Index HTML served correctly with Vite module script tag.');

  // Test 2: Fetch Vite client
  const viteClientRes = await fetch('http://localhost:5173/@vite/client');
  console.log('@vite/client status:', viteClientRes.status);
  if (viteClientRes.status !== 200) throw new Error('Vite client script not reachable');

  // Test 3: Fetch main entry
  const mainTsxRes = await fetch('http://localhost:5173/src/main.tsx');
  console.log('src/main.tsx status:', mainTsxRes.status);
  if (mainTsxRes.status !== 200) throw new Error('src/main.tsx not reachable');

  // Test 4: Fetch App.tsx
  const appTsxRes = await fetch('http://localhost:5173/src/App.tsx');
  console.log('src/App.tsx status:', appTsxRes.status);
  if (appTsxRes.status !== 200) throw new Error('src/App.tsx not reachable');

  // Test 5: Fetch API via Vite proxy
  const proxyApiRes = await fetch('http://localhost:5173/api/health');
  console.log('Vite Proxy /api/health status:', proxyApiRes.status);
  const proxyApiData = await proxyApiRes.json();
  console.log('Vite Proxy /api/health data:', proxyApiData);
  if (proxyApiData.status !== 'ok') throw new Error('Vite API proxy failed');

  // Test 6: Verify Auth endpoints through Vite proxy
  const proxyLoginRes = await fetch('http://localhost:5173/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smartfleet.com', password: 'Admin@123' })
  });
  const proxyLoginData = await proxyLoginRes.json();
  console.log('Vite Proxy Login test status:', proxyLoginRes.status, 'User:', proxyLoginData.user?.name);
  if (!proxyLoginData.token) throw new Error('Proxy login failed');

  console.log('\n>>> FRONTEND VITE SERVER & API PROXY ALL VERIFIED SUCCESSFULLY! <<<');
}

testFrontend().catch(err => {
  console.error('FRONTEND TEST ERROR:', err);
  process.exit(1);
});
