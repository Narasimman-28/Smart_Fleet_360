import os from 'os';
import path from 'path';
import fs from 'fs';

const RUNTIME_CONFIG_PATH = path.resolve(__dirname, '../../data/runtime_config.json');

function loadPersistentRuntimePublicUrl(): string | null {
  try {
    if (fs.existsSync(RUNTIME_CONFIG_PATH)) {
      const content = fs.readFileSync(RUNTIME_CONFIG_PATH, 'utf8');
      const data = JSON.parse(content);
      return data.publicUrl || null;
    }
  } catch (e) {}
  return null;
}

function savePersistentRuntimePublicUrl(url: string | null): void {
  try {
    const dir = path.dirname(RUNTIME_CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(RUNTIME_CONFIG_PATH, JSON.stringify({ publicUrl: url, updatedAt: new Date().toISOString() }, null, 2));
  } catch (e) {}
}

let runtimePublicUrl: string | null = loadPersistentRuntimePublicUrl();

export function setRuntimePublicUrl(url: string | null): void {
  if (url && url.trim()) {
    runtimePublicUrl = url.trim().replace(/\/+$/, '');
  } else {
    runtimePublicUrl = null;
  }
  savePersistentRuntimePublicUrl(runtimePublicUrl);
}

export function getRuntimePublicUrl(): string | null {
  if (!runtimePublicUrl) {
    runtimePublicUrl = loadPersistentRuntimePublicUrl();
  }
  return runtimePublicUrl;
}

/**
 * Automatically discovers the computer's primary LAN IPv4 address
 * (e.g. 192.168.x.x, 10.x.x.x, 172.x.x.x) on Wi-Fi or Ethernet interfaces.
 */
export function getLocalLanIPv4(): string {
  const interfaces = os.networkInterfaces();
  
  // Prioritize active physical network adapters (Wi-Fi, Ethernet, LAN)
  const preferredNames = ['wi-fi', 'wifi', 'ethernet', 'eth0', 'wlan0', 'en0', 'en1', 'local area connection'];

  // 1st Priority: Match preferred interface names with valid non-internal IPv4
  for (const preferred of preferredNames) {
    for (const name of Object.keys(interfaces)) {
      if (name.toLowerCase().includes(preferred)) {
        const netList = interfaces[name];
        if (netList) {
          for (const net of netList) {
            const family = typeof net.family === 'string' ? net.family : (net as any).family;
            if ((family === 'IPv4' || family === 4) && !net.internal) {
              if (net.address && !net.address.startsWith('127.')) {
                return net.address;
              }
            }
          }
        }
      }
    }
  }

  // 2nd Priority: Any non-internal IPv4 on any interface
  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (netList) {
      for (const net of netList) {
        const family = typeof net.family === 'string' ? net.family : (net as any).family;
        if ((family === 'IPv4' || family === 4) && !net.internal) {
          if (net.address && !net.address.startsWith('127.')) {
            return net.address;
          }
        }
      }
    }
  }

  return 'localhost';
}

/**
 * Checks if a given URL is a secure HTTPS context
 */
export function isHttpsUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'https:';
  } catch {
    return urlStr.toLowerCase().startsWith('https://');
  }
}

/**
 * Resolves the mobile-accessible Frontend Public Base URL.
 * Priority:
 * 1. Runtime public URL (persisted from tunnel launcher or admin UI)
 * 2. process.env.FRONTEND_PUBLIC_URL if explicitly configured
 * 3. Incoming request origin/host if it contains an HTTPS origin or real domain
 * 4. Fallback: Auto-detected LAN IP (http://<LAN_IP>:5173) or localhost
 */
export function getFrontendPublicUrl(requestOriginOrHost?: string): string {
  // 1. Persistent runtime override
  const persistentUrl = getRuntimePublicUrl();
  if (persistentUrl) {
    return persistentUrl;
  }

  // 2. Explicit environment variable
  const envUrl = process.env.FRONTEND_PUBLIC_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  // 3. Incoming request origin/host (especially if HTTPS)
  if (requestOriginOrHost) {
    try {
      const urlStr = requestOriginOrHost.startsWith('http') ? requestOriginOrHost : `http://${requestOriginOrHost}`;
      const parsed = new URL(urlStr);
      if (
        parsed.hostname !== 'localhost' && 
        parsed.hostname !== '127.0.0.1' && 
        parsed.hostname !== '::1' &&
        parsed.hostname !== '0.0.0.0'
      ) {
        // If accessed through HTTPS proxy/tunnel, preserve HTTPS protocol
        const protocol = parsed.protocol === 'https:' ? 'https:' : 'http:';
        const portPart = (parsed.port && parsed.port !== '80' && parsed.port !== '443') 
          ? `:${parsed.port === '5000' ? '5173' : parsed.port}` 
          : '';
        return `${protocol}//${parsed.hostname}${portPart}`;
      }
    } catch (e) {}
  }

  // 4. Auto-detect PC LAN IPv4 address (Fallback for local dev)
  const lanIp = getLocalLanIPv4();
  if (lanIp && lanIp !== 'localhost') {
    return `http://${lanIp}:5173`;
  }

  return 'http://localhost:5173';
}
