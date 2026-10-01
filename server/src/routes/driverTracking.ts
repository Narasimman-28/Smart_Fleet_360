import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database';
import { authenticateToken, optionalAuthenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth';
import { GPSProviderManager, NormalizedGPSData } from '../services/gpsProvider';
import { LiveTrackingSocketService } from '../services/liveTrackingSocket';
import { NotificationEngine } from '../services/notificationEngine';
import { getLocalLanIPv4, getFrontendPublicUrl, setRuntimePublicUrl, getRuntimePublicUrl, isHttpsUrl } from '../utils/networkUtils';

const router = Router();

// Helper to generate a cryptographically secure random tracking token
function generateSecureToken(driverId: string): { token: string; tokenHash: string } {
  const randomHex = crypto.randomBytes(24).toString('hex');
  const cleanDriver = driverId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
  const token = `trk_${cleanDriver}_${randomHex}`;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

// 0. GET /api/driver-tracking/network-config
// Returns current computer LAN IPv4 address, public HTTPS URL and configuration state
router.get('/network-config', (req: Request, res: Response): void => {
  const requestOriginOrHost = req.get('origin') || req.get('referer') || req.get('host');
  const lanIp = getLocalLanIPv4();
  const publicBaseUrl = getFrontendPublicUrl(requestOriginOrHost);
  const isHttps = isHttpsUrl(publicBaseUrl);
  res.json({
    success: true,
    lanIp,
    publicBaseUrl,
    isHttps,
    isLanDetected: lanIp !== 'localhost',
    configuredEnvUrl: process.env.FRONTEND_PUBLIC_URL || null,
    runtimePublicUrl: getRuntimePublicUrl(),
    port: 5173
  });
});

// 0b. POST /api/driver-tracking/set-public-url
// Allows setting or updating public HTTPS URL dynamically (e.g. from cloudflare tunnel or custom domain)
router.post('/set-public-url', optionalAuthenticateToken, (req: Request, res: Response): void => {
  const { publicUrl } = req.body;
  setRuntimePublicUrl(publicUrl || null);
  const updatedUrl = getFrontendPublicUrl();
  const isHttps = isHttpsUrl(updatedUrl);
  res.json({
    success: true,
    publicBaseUrl: updatedUrl,
    isHttps,
    message: isHttps 
      ? 'Public HTTPS URL configured successfully' 
      : 'Public URL updated'
  });
});

// 1. POST /api/driver-tracking/connect
// Generates or retrieves a secure mobile tracking token for a driver
router.post('/connect', optionalAuthenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { driverId, driver_id, phone, providerType, deviceModel, browserName, osName } = req.body;

    let driver = null;
    const targetDriverId = driverId || driver_id;

    if (targetDriverId) {
      driver = await db.get('SELECT * FROM drivers WHERE id = ?', [targetDriverId]);
    } else if (phone) {
      driver = await db.get('SELECT * FROM drivers WHERE phone = ?', [phone]);
    } else if (req.user) {
      driver = await db.get('SELECT * FROM drivers WHERE email = ? OR id = ?', [req.user.email, req.user.id]);
    }

    if (!driver) {
      res.status(404).json({ error: 'Driver not found. Please verify driver ID or mobile number.' });
      return;
    }

    // Check for existing active tracking token
    let tokenRecord = await db.get(
      'SELECT * FROM driver_tracking_tokens WHERE driver_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1',
      [driver.id]
    );

    let token = tokenRecord?.token;
    const nowIso = new Date().toISOString();

    if (!token) {
      const generated = generateSecureToken(driver.id);
      token = generated.token;
      const tokenId = `tok-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const vehicleId = driver.assigned_vehicle_id || null;

      await db.run(`
        INSERT INTO driver_tracking_tokens (
          id, driver_id, vehicle_id, token_hash, token, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `, [tokenId, driver.id, vehicleId, generated.tokenHash, token, nowIso, nowIso]);

      // Also register in driver_tracking_devices
      await db.run(`
        INSERT INTO driver_tracking_devices (
          id, driver_id, device_id, device_token, provider_type,
          device_model, browser_name, os_name, status, last_connected_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)
      `, [
        tokenId,
        driver.id,
        tokenId,
        token,
        providerType || 'Browser',
        deviceModel || 'Mobile Web Browser',
        browserName || 'HTML5 Geolocation Client',
        osName || 'Mobile OS',
        nowIso,
        nowIso
      ]);
    } else {
      await db.run(`
        UPDATE driver_tracking_tokens SET
          last_used_at = ?,
          updated_at = ?
        WHERE token = ?
      `, [nowIso, nowIso, token]);
    }

    // Fetch assigned vehicle & active trip
    const assignedVehicle = driver.assigned_vehicle_id
      ? await db.get('SELECT id, vehicle_number, make, model, vehicle_type FROM vehicles WHERE id = ?', [driver.assigned_vehicle_id])
      : await db.get('SELECT id, vehicle_number, make, model, vehicle_type FROM vehicles WHERE driver_id = ?', [driver.id]);

    const activeTrip = await db.get(`
      SELECT b.id, b.booking_number, b.pickup_location, b.drop_location, b.booking_status
      FROM bookings b
      WHERE b.driver_id = ? AND b.booking_status IN ('Confirmed', 'Started')
      LIMIT 1
    `, [driver.id]);

    // Build tracking URL based on FRONTEND_PUBLIC_URL environment variable or auto-detected LAN IP
    const requestOriginOrHost = req.get('origin') || req.get('referer') || req.get('host');
    const publicOrigin = getFrontendPublicUrl(requestOriginOrHost);
    const trackingPath = `/driver-track/${token}`;
    const directUrl = `${publicOrigin}${trackingPath}`;
    const lanIp = getLocalLanIPv4();

    const hostHeader = req.get('host') || 'localhost:5000';
    const hostname = hostHeader.split(':')[0];
    const traccarServerUrl = `http://${hostname}:5055`;
    const osmAndUrl = `http://${hostname}:5055/?id=${driver.id}&lat={0}&lon={1}&timestamp={2}&speed={3}&bearing={4}&altitude={5}`;

    const isHttps = isHttpsUrl(publicOrigin);

    res.status(200).json({
      success: true,
      message: 'Mobile GPS tracking connection initialized successfully',
      token,
      trackingToken: token,
      trackingPath,
      trackingUrl: directUrl,
      directUrl,
      mobileBaseUrl: publicOrigin,
      isHttps,
      lanIp,
      isLanDetected: lanIp !== 'localhost',
      connectionStatus: isHttps ? 'READY (HTTPS)' : 'HTTP (HTTPS REQUIRED FOR 4G/5G)',
      traccarPort: 5055,
      traccarServerUrl,
      osmAndUrl,
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        email: driver.email,
        status: driver.status
      },
      assignedVehicle: assignedVehicle || null,
      activeTrip: activeTrip || null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET /api/driver-tracking/verify-token/:token & /api/driver-tracking/token-info/:token
// Validates tracking token and returns driver profile for the phone screen
router.get(['/verify-token/:token', '/token-info/:token'], async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    if (!token) {
      res.status(400).json({ valid: false, error: 'Tracking token is required' });
      return;
    }

    // Lookup token in driver_tracking_tokens
    let tokenRecord = await db.get(
      'SELECT * FROM driver_tracking_tokens WHERE token = ? AND is_active = 1',
      [token]
    );

    let driver = null;
    let vehicleId = null;

    if (tokenRecord) {
      driver = await db.get('SELECT * FROM drivers WHERE id = ?', [tokenRecord.driver_id]);
      vehicleId = tokenRecord.vehicle_id || driver?.assigned_vehicle_id;
    } else {
      // Fallback check in driver_tracking_devices
      const device = await db.get('SELECT * FROM driver_tracking_devices WHERE device_token = ? AND status = "Active"', [token]);
      if (device) {
        driver = await db.get('SELECT * FROM drivers WHERE id = ?', [device.driver_id]);
        vehicleId = driver?.assigned_vehicle_id;
      }
    }

    if (!driver) {
      res.status(404).json({
        valid: false,
        error: 'Invalid, revoked, or expired driver tracking link. Please ask your fleet manager for a new link.'
      });
      return;
    }

    // Fetch assigned vehicle & active trip
    const assignedVehicle = vehicleId
      ? await db.get('SELECT id, vehicle_number, make, model, vehicle_type, fuel_type FROM vehicles WHERE id = ?', [vehicleId])
      : await db.get('SELECT id, vehicle_number, make, model, vehicle_type, fuel_type FROM vehicles WHERE driver_id = ?', [driver.id]);

    const activeTrip = await db.get(`
      SELECT b.id, b.booking_number, b.pickup_location, b.drop_location, b.start_date, b.booking_status, b.customer_name, b.customer_mobile
      FROM bookings b
      WHERE b.driver_id = ? AND b.booking_status IN ('Confirmed', 'Started')
      LIMIT 1
    `, [driver.id]);

    const locationStatus = await db.get('SELECT * FROM driver_location_status WHERE driver_id = ?', [driver.id]);

    res.json({
      valid: true,
      token,
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        status: driver.status
      },
      assignedVehicle: assignedVehicle || null,
      activeTrip: activeTrip || null,
      lastLocation: locationStatus ? {
        latitude: locationStatus.latitude,
        longitude: locationStatus.longitude,
        accuracy: locationStatus.accuracy,
        speed: locationStatus.speed,
        heading: locationStatus.heading,
        lastUpdated: locationStatus.last_updated,
        isTracking: locationStatus.is_tracking === 1
      } : null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. POST /api/driver-tracking/location
// Receives phone GPS coordinates, validates token, persists to database, and broadcasts to WebSocket
router.all(['/location', '/traccar'], optionalAuthenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const gpsData: NormalizedGPSData | null = GPSProviderManager.processRequest(req);

    if (!gpsData) {
      res.status(400).json({ error: 'Valid geographical coordinates (latitude and longitude) are required' });
      return;
    }

    const { latitude: lat, longitude: lng, accuracy, speed, heading, provider, source } = gpsData;

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({ error: 'Coordinates out of geographical bounds' });
      return;
    }

    // Strict Token & Driver Identity Resolution from Database
    const token = gpsData.deviceToken || (req.body && req.body.token);
    let driverId: string | null = null;
    let vehicleId: string | null = null;

    if (token) {
      const tokenRec = await db.get('SELECT driver_id, vehicle_id FROM driver_tracking_tokens WHERE token = ? AND is_active = 1', [token]);
      if (tokenRec) {
        driverId = tokenRec.driver_id;
        vehicleId = tokenRec.vehicle_id;
        // Update token last used
        await db.run('UPDATE driver_tracking_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE token = ?', [token]);
      } else {
        const devRec = await db.get('SELECT driver_id FROM driver_tracking_devices WHERE device_token = ? AND status = "Active"', [token]);
        if (devRec) {
          driverId = devRec.driver_id;
        }
      }
    }

    // Authenticated session fallback (if logged in as Driver)
    if (!driverId && req.user) {
      const logged = await db.get('SELECT id, assigned_vehicle_id FROM drivers WHERE email = ? OR id = ? OR phone = ?', [req.user.email, req.user.id, req.user.phone || '']);
      if (logged) {
        driverId = logged.id;
        if (!vehicleId) vehicleId = logged.assigned_vehicle_id;
      }
    }

    if (!driverId) {
      res.status(401).json({ error: 'Driver identity could not be verified. Provide a valid, active tracking token.' });
      return;
    }

    const driver = await db.get('SELECT * FROM drivers WHERE id = ?', [driverId]);
    if (!driver) {
      res.status(404).json({ error: 'Driver record not found' });
      return;
    }

    // Resolve associated vehicle & trip
    if (!vehicleId) {
      vehicleId = driver.assigned_vehicle_id;
    }

    let vehicle = null;
    if (vehicleId) {
      vehicle = await db.get('SELECT id, vehicle_number, make, model FROM vehicles WHERE id = ?', [vehicleId]);
    } else {
      vehicle = await db.get('SELECT id, vehicle_number, make, model FROM vehicles WHERE driver_id = ?', [driverId]);
      if (vehicle) vehicleId = vehicle.id;
    }

    let tripId = gpsData.tripId;
    let bookingNumber = null;
    let tripStatus = 'Available';

    if (tripId) {
      const b = await db.get('SELECT id, booking_number, booking_status FROM bookings WHERE id = ?', [tripId]);
      if (b) {
        bookingNumber = b.booking_number;
        tripStatus = b.booking_status;
      }
    } else {
      const activeB = await db.get(`
        SELECT id, booking_number, booking_status 
        FROM bookings 
        WHERE (driver_id = ? OR vehicle_id = ?) AND booking_status IN ('Confirmed', 'Started')
        LIMIT 1
      `, [driverId, vehicleId || '']);
      if (activeB) {
        tripId = activeB.id;
        bookingNumber = activeB.booking_number;
        tripStatus = activeB.booking_status;
      }
    }

    const nowIso = new Date().toISOString();
    const locId = `loc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const locationName = gpsData.locationName || `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;

    // 1. Insert into driver_locations table
    await db.run(`
      INSERT INTO driver_locations (
        id, driver_id, vehicle_id, trip_id, latitude, longitude,
        accuracy, speed, heading, provider, source, tracking_status, recorded_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `, [
      locId, driverId, vehicleId || null, tripId || null,
      lat, lng, accuracy != null ? accuracy : null, speed != null ? speed : null, heading != null ? heading : null,
      provider || 'Browser GPS', source || 'GPS', nowIso, nowIso
    ]);

    // 2. Insert into trip_locations table (for route trails)
    await db.run(`
      INSERT INTO trip_locations (
        id, booking_id, driver_id, vehicle_id, latitude, longitude,
        accuracy, speed, heading, location_name, source, notes, recorded_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      locId, tripId || null, driverId, vehicleId || 'veh-unknown',
      lat, lng, accuracy != null ? accuracy : null, speed != null ? speed : null, heading != null ? heading : null,
      locationName, source || 'GPS', `Provider: ${provider || 'Browser GPS'}`, nowIso, nowIso
    ]);

    // 3. Upsert into driver_location_status for instant live dashboard map
    await db.run(`
      INSERT INTO driver_location_status (
        driver_id, driver_name, vehicle_id, vehicle_number, booking_id,
        booking_number, latitude, longitude, accuracy, speed, heading,
        location_name, source, is_tracking, tracking_status, trip_status, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'ACTIVE', ?, ?)
      ON CONFLICT(driver_id) DO UPDATE SET
        driver_name = excluded.driver_name,
        vehicle_id = COALESCE(excluded.vehicle_id, driver_location_status.vehicle_id),
        vehicle_number = COALESCE(excluded.vehicle_number, driver_location_status.vehicle_number),
        booking_id = COALESCE(excluded.booking_id, driver_location_status.booking_id),
        booking_number = COALESCE(excluded.booking_number, driver_location_status.booking_number),
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        accuracy = excluded.accuracy,
        speed = excluded.speed,
        heading = excluded.heading,
        location_name = excluded.location_name,
        source = excluded.source,
        is_tracking = 1,
        tracking_status = 'ACTIVE',
        trip_status = excluded.trip_status,
        last_updated = excluded.last_updated
    `, [
      driverId, driver.name, vehicleId || null, vehicle?.vehicle_number || null,
      tripId || null, bookingNumber || null, lat, lng,
      accuracy != null ? accuracy : null, speed != null ? speed : null, heading != null ? heading : null,
      locationName, source || 'GPS', tripStatus || 'Started', nowIso
    ]);

    // 4. Update drivers and vehicles tables
    await db.run(`
      UPDATE drivers SET
        current_location_name = ?,
        current_latitude = ?,
        current_longitude = ?,
        location_updated_at = ?
      WHERE id = ?
    `, [locationName, lat, lng, nowIso, driverId]);

    if (vehicleId) {
      await db.run(`
        UPDATE vehicles SET
          current_location_name = ?,
          current_latitude = ?,
          current_longitude = ?,
          location_updated_at = ?
        WHERE id = ?
      `, [locationName, lat, lng, nowIso, vehicleId]);
    }

    // 5. Broadcast live update to all WebSocket & SSE dashboard subscribers
    LiveTrackingSocketService.broadcastLocation({
      driver_id: driverId,
      driver_name: driver.name,
      driver_phone: driver.phone,
      vehicle_id: vehicleId,
      vehicle_number: vehicle?.vehicle_number || null,
      make: vehicle?.make || null,
      model: vehicle?.model || null,
      booking_id: tripId,
      booking_number: bookingNumber,
      latitude: lat,
      longitude: lng,
      accuracy: accuracy != null ? accuracy : null,
      speed: speed != null ? speed : null,
      heading: heading != null ? heading : null,
      location_name: locationName,
      source: 'GPS',
      provider: provider || 'Browser GPS',
      is_tracking: 1,
      tracking_status: 'ACTIVE',
      gps_status: 'CONNECTED',
      trip_status: tripStatus,
      last_updated: nowIso,
      minutes_since_update: 0
    });

    res.status(201).json({
      success: true,
      message: 'Real-time GPS coordinate recorded and broadcasted to live map',
      locationId: locId,
      driverId,
      vehicleNumber: vehicle?.vehicle_number || null,
      timestamp: nowIso
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. POST /api/driver-tracking/start
// Notifies that driver has started live tracking
router.post('/start', optionalAuthenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token, driverId } = req.body;
    let targetDriverId = driverId;

    if (token) {
      const tokRec = await db.get('SELECT driver_id FROM driver_tracking_tokens WHERE token = ? AND is_active = 1', [token]);
      if (tokRec) targetDriverId = tokRec.driver_id;
    }

    if (!targetDriverId && req.user) {
      const d = await db.get('SELECT id FROM drivers WHERE email = ? OR id = ?', [req.user.email, req.user.id]);
      if (d) targetDriverId = d.id;
    }

    if (!targetDriverId) {
      res.status(400).json({ error: 'Valid tracking token or driver ID is required' });
      return;
    }

    const nowIso = new Date().toISOString();
    await db.run(`
      UPDATE driver_location_status SET
        is_tracking = 1,
        tracking_status = 'ACTIVE',
        last_updated = ?
      WHERE driver_id = ?
    `, [nowIso, targetDriverId]);

    const driver = await db.get('SELECT name FROM drivers WHERE id = ?', [targetDriverId]);
    LiveTrackingSocketService.broadcastStatusChange(targetDriverId, 'CONNECTED', 'ACTIVE', driver?.name);

    res.json({ success: true, message: 'Tracking started', trackingStatus: 'ACTIVE' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. POST /api/driver-tracking/stop & /api/driver-tracking/disconnect
// Stops live tracking and marks driver as disconnected/stopped
router.post(['/stop', '/disconnect'], optionalAuthenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token, driverId, driver_id } = req.body;
    let targetDriverId = driverId || driver_id;

    if (token) {
      const tokRec = await db.get('SELECT driver_id FROM driver_tracking_tokens WHERE token = ?', [token]);
      if (tokRec) {
        targetDriverId = tokRec.driver_id;
      } else {
        const dev = await db.get('SELECT driver_id FROM driver_tracking_devices WHERE device_token = ?', [token]);
        if (dev) targetDriverId = dev.driver_id;
      }
    }

    if (!targetDriverId && req.user) {
      const logged = await db.get('SELECT id FROM drivers WHERE email = ? OR id = ?', [req.user.email, req.user.id]);
      if (logged) targetDriverId = logged.id;
    }

    if (!targetDriverId) {
      res.status(400).json({ error: 'Driver ID or token is required to disconnect' });
      return;
    }

    const nowIso = new Date().toISOString();

    await db.run(`
      UPDATE driver_location_status SET
        is_tracking = 0,
        tracking_status = 'STOPPED',
        last_updated = ?
      WHERE driver_id = ?
    `, [nowIso, targetDriverId]);

    const driver = await db.get('SELECT name FROM drivers WHERE id = ?', [targetDriverId]);

    // Broadcast status change to live dashboard
    LiveTrackingSocketService.broadcastStatusChange(targetDriverId, 'DISCONNECTED', 'STOPPED', driver?.name);

    res.json({
      success: true,
      message: 'Driver GPS tracking stopped successfully',
      trackingStatus: 'STOPPED'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. POST /api/driver-tracking/regenerate/:driverId
// Regenerates tracking token and invalidates prior token
router.post('/regenerate/:driverId', authenticateToken, requireRole(['Super Admin', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    const driver = await db.get('SELECT * FROM drivers WHERE id = ?', [driverId]);

    if (!driver) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }

    // Invalidate old tokens
    await db.run('UPDATE driver_tracking_tokens SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE driver_id = ?', [driverId]);
    await db.run('UPDATE driver_tracking_devices SET status = "Inactive" WHERE driver_id = ?', [driverId]);

    // Create fresh token
    const generated = generateSecureToken(driver.id);
    const tokenId = `tok-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();
    const vehicleId = driver.assigned_vehicle_id || null;

    await db.run(`
      INSERT INTO driver_tracking_tokens (
        id, driver_id, vehicle_id, token_hash, token, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `, [tokenId, driver.id, vehicleId, generated.tokenHash, generated.token, nowIso, nowIso]);

    await db.run(`
      INSERT INTO driver_tracking_devices (
        id, driver_id, device_id, device_token, provider_type, status, last_connected_at, created_at
      ) VALUES (?, ?, ?, ?, 'Browser', 'Active', ?, ?)
    `, [tokenId, driver.id, tokenId, generated.token, nowIso, nowIso]);

    const publicOrigin = process.env.FRONTEND_PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const trackingUrl = `${publicOrigin}/driver-track/${generated.token}`;

    res.json({
      success: true,
      message: 'New tracking token generated successfully. Old links are now invalid.',
      token: generated.token,
      trackingUrl
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. POST /api/driver-tracking/disable/:driverId
// Disables tracking token for a driver
router.post('/disable/:driverId', authenticateToken, requireRole(['Super Admin', 'Fleet Manager']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    const nowIso = new Date().toISOString();

    await db.run('UPDATE driver_tracking_tokens SET is_active = 0, updated_at = ? WHERE driver_id = ?', [nowIso, driverId]);
    await db.run('UPDATE driver_tracking_devices SET status = "Disabled" WHERE driver_id = ?', [driverId]);
    await db.run(`
      UPDATE driver_location_status SET
        is_tracking = 0,
        tracking_status = 'TRACKING DISABLED',
        last_updated = ?
      WHERE driver_id = ?
    `, [nowIso, driverId]);

    const driver = await db.get('SELECT name FROM drivers WHERE id = ?', [driverId]);
    LiveTrackingSocketService.broadcastStatusChange(String(driverId), 'DISABLED', 'TRACKING DISABLED', driver?.name);

    res.json({
      success: true,
      message: `GPS Tracking disabled for driver ${driver?.name || driverId}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. GET /api/driver-tracking/drivers
// Returns drivers with real-time GPS connectivity status, assigned vehicle, and last seen (Role filtered)
router.get('/drivers', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    if (userRole && !['Super Admin', 'Fleet Manager', 'Compliance Manager', 'Driver'].includes(userRole)) {
      res.status(403).json({ error: 'Access denied: insufficient permissions to view driver GPS tracking.' });
      return;
    }

    const settings = await db.get('SELECT gps_signal_delayed_min FROM notification_settings LIMIT 1');
    const delayThresholdMin = settings?.gps_signal_delayed_min || 5;

    let query = `
      SELECT 
        d.id as driver_id,
        d.name as driver_name,
        d.phone as driver_phone,
        d.email as driver_email,
        d.license_number as driver_license,
        d.status as driver_status,
        COALESCE(d.profile_image_url, d.photo_url) as driver_photo_url,
        COALESCE(d.profile_image_url, d.photo_url) as driver_profile_image_url,
        COALESCE(d.profile_image_url, d.photo_url) as profile_image_url,
        COALESCE(dls.vehicle_id, v.id) as vehicle_id,
        COALESCE(dls.vehicle_number, v.vehicle_number) as vehicle_number,
        v.make as vehicle_make,
        v.model as vehicle_model,
        v.vehicle_type as vehicle_type,
        COALESCE(v.profile_image_url, v.photo_url) as vehicle_photo_url,
        COALESCE(v.profile_image_url, v.photo_url) as vehicle_image_url,
        dls.latitude,
        dls.longitude,
        dls.accuracy,
        dls.speed,
        dls.heading,
        COALESCE(dls.location_name, d.current_location_name) as location_name,
        COALESCE(dls.source, 'GPS') as source,
        COALESCE(dls.is_tracking, 0) as is_tracking,
        COALESCE(dls.tracking_status, 'STOPPED') as tracking_status,
        dls.booking_number,
        dls.trip_status,
        COALESCE(dls.last_updated, d.location_updated_at) as last_updated,
        tok.token as device_token,
        tok.is_active as token_active,
        ((julianday('now') - julianday(COALESCE(dls.last_updated, d.location_updated_at, d.updated_at))) * 24 * 60) as minutes_since_update
      FROM drivers d
      LEFT JOIN driver_location_status dls ON dls.driver_id = d.id
      LEFT JOIN vehicles v ON d.assigned_vehicle_id = v.id OR dls.vehicle_id = v.id
      LEFT JOIN (
        SELECT driver_id, token, is_active FROM driver_tracking_tokens 
        WHERE is_active = 1 GROUP BY driver_id
      ) tok ON tok.driver_id = d.id
      WHERE d.status != 'Inactive'
    `;
    const params: any[] = [];

    // If Driver, strictly restrict to their own driver account
    if (userRole === 'Driver') {
      query += ` AND (d.email = ? OR d.id = ? OR (d.phone IS NOT NULL AND d.phone = ?))`;
      params.push(req.user?.email || '', req.user?.id || '', req.user?.phone || '');
    }

    query += ` ORDER BY dls.is_tracking DESC, dls.last_updated DESC`;

    const drivers = await db.all(query, params);

    const formatted = drivers.map(item => {
      const minutesSince = item.minutes_since_update != null ? Math.max(0, item.minutes_since_update) : 999;
      const isLive = item.is_tracking === 1 && minutesSince <= delayThresholdMin;
      const isDelayed = item.is_tracking === 1 && minutesSince > delayThresholdMin;

      let gpsStatus = 'OFFLINE';
      if (item.tracking_status === 'TRACKING DISABLED') {
        gpsStatus = 'TRACKING DISABLED';
      } else if (isLive) {
        gpsStatus = item.trip_status === 'Started' ? 'ON TRIP' : 'CONNECTED';
      } else if (isDelayed) {
        gpsStatus = 'DELAYED';
      } else if (item.tracking_status === 'STOPPED') {
        gpsStatus = 'OFFLINE';
      }

      return {
        ...item,
        is_live_gps: isLive,
        is_delayed: isDelayed,
        gps_status: gpsStatus,
        minutes_since_update: Math.round(minutesSince),
        tracking_url: item.device_token ? `/driver-track/${item.device_token}` : null
      };
    });

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. GET /api/driver-tracking/:driverId/location
router.get('/:driverId/location', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;

    // Driver authorization check
    if (req.user?.role === 'Driver') {
      const selfDriver = await db.get('SELECT id FROM drivers WHERE email = ? OR id = ? OR phone = ?', [req.user.email, req.user.id, req.user.phone || '']);
      if (driverId !== selfDriver?.id) {
        res.status(403).json({ error: 'Access denied: Drivers can only view their own real-time GPS location.' });
        return;
      }
    }

    const loc = await db.get(`
      SELECT dls.*, d.name as driver_name, d.phone as driver_phone, v.vehicle_number, v.make, v.model
      FROM driver_location_status dls
      JOIN drivers d ON dls.driver_id = d.id
      LEFT JOIN vehicles v ON dls.vehicle_id = v.id
      WHERE dls.driver_id = ?
    `, [driverId]);

    if (!loc) {
      res.status(404).json({ error: 'No location status found for this driver' });
      return;
    }

    res.json(loc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. GET /api/driver-tracking/:driverId/history
router.get('/:driverId/history', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;

    // Driver authorization check
    if (req.user?.role === 'Driver') {
      const selfDriver = await db.get('SELECT id FROM drivers WHERE email = ? OR id = ? OR phone = ?', [req.user.email, req.user.id, req.user.phone || '']);
      if (driverId !== selfDriver?.id) {
        res.status(403).json({ error: 'Access denied: Drivers can only view their own GPS history trail.' });
        return;
      }
    }

    const limit = parseInt(req.query.limit as string) || 100;

    const locations = await db.all(`
      SELECT 
        tl.*,
        v.vehicle_number,
        d.name as driver_name,
        d.phone as driver_phone
      FROM trip_locations tl
      LEFT JOIN vehicles v ON tl.vehicle_id = v.id
      LEFT JOIN drivers d ON tl.driver_id = d.id
      WHERE tl.driver_id = ?
      ORDER BY tl.recorded_at DESC
      LIMIT ?
    `, [driverId, limit]);

    res.json({
      driverId,
      count: locations.length,
      locations: locations.reverse()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. GET /api/driver-tracking/stream (Server-Sent Events)
router.get('/stream', (req: Request, res: Response): void => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE Stream Connected' })}\n\n`);
  LiveTrackingSocketService.addSSEClient(res);
});

export default router;
