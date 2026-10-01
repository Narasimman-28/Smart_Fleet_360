import { startTunnel } from 'untun';

let currentTunnel = null;
let currentUrl = null;
let isReconnecting = false;

async function syncBackendUrl(publicUrl) {
  try {
    const res = await fetch('http://localhost:5000/api/driver-tracking/set-public-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicUrl })
    });
    const data = await res.json();
    console.log(`✓ SmartFleet 360 backend updated: ${data.publicBaseUrl}`);
  } catch (e) {
    console.log('ℹ Note: SmartFleet backend sync pending (will retry automatically).');
  }
}

async function launchTunnel() {
  if (isReconnecting) return;
  isReconnecting = true;

  console.log('\n=============================================================');
  console.log('  SmartFleet 360 - Cloudflare HTTPS Public Tunnel Launcher');
  console.log('=============================================================');
  console.log('⚡ Initializing Cloudflare tunnel on local port 5173...');

  try {
    if (currentTunnel) {
      try {
        await currentTunnel.close();
      } catch (e) {}
      currentTunnel = null;
    }

    // Small delay to let OS release ports
    await new Promise(r => setTimeout(r, 1500));

    currentTunnel = await startTunnel({ port: 5173 });
    currentUrl = await currentTunnel.getURL();

    console.log('\n🚀 PUBLIC HTTPS TUNNEL READY!');
    console.log('-------------------------------------------------------------');
    console.log(`  Public HTTPS URL:   ${currentUrl}`);
    console.log('-------------------------------------------------------------');

    await syncBackendUrl(currentUrl);

    console.log('\n📱 Drivers can now scan QR codes & stream real GPS over 4G/5G mobile data from anywhere!');
    console.log('   (Keep this tunnel running. Health monitor will keep it alive.)\n');

    isReconnecting = false;

    // Health check monitor every 45 seconds
    const interval = setInterval(async () => {
      try {
        const res = await fetch(currentUrl, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
        if (res.status >= 500) {
          throw new Error(`Tunnel status HTTP ${res.status}`);
        }
      } catch (err) {
        if (!isReconnecting) {
          console.warn('⚠️ Tunnel connectivity check failed. Re-establishing connection in 3s...');
          clearInterval(interval);
          setTimeout(() => {
            launchTunnel();
          }, 3000);
        }
      }
    }, 45000);

  } catch (err) {
    isReconnecting = false;
    console.error('❌ Failed to establish Cloudflare tunnel:', err.message);
    console.log('⏳ Retrying in 5 seconds...');
    setTimeout(launchTunnel, 5000);
  }
}

process.on('unhandledRejection', (reason) => {
  console.warn('ℹ Tunnel background event:', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.warn('ℹ Tunnel background error caught:', err.message);
  if (!isReconnecting) {
    setTimeout(launchTunnel, 4000);
  }
});

launchTunnel();
