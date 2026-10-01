import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/auditLogger';
import { NotificationEngine } from '../services/notificationEngine';

const router = Router();

// GET Live tracking settings (interval, timeout)
router.get('/settings', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await db.get('SELECT gps_update_interval_sec, gps_signal_delayed_min FROM notification_settings LIMIT 1');
    res.json({
      gps_update_interval_sec: settings?.gps_update_interval_sec || 30,
      gps_signal_delayed_min: settings?.gps_signal_delayed_min || 5
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET All live tracked drivers and vehicles (Super Admin, Fleet Manager, or Driver)
router.get('/live', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    const settings = await db.get('SELECT gps_signal_delayed_min FROM notification_settings LIMIT 1');
    const delayThresholdMin = settings?.gps_signal_delayed_min || 5;

    // Comprehensive query joining drivers, vehicles, location status, and active bookings
    let query = `
      SELECT 
        d.id as driver_id,
        d.name as driver_name,
        d.name as driver_name_full,
        d.phone as driver_phone,
        COALESCE(d.profile_image_url, d.photo_url) as driver_photo_url,
        COALESCE(d.profile_image_url, d.photo_url) as driver_profile_image_url,
        COALESCE(d.profile_image_url, d.photo_url) as profile_image_url,
        d.license_number as driver_license,
        d.status as driver_status,
        COALESCE(dls.vehicle_id, v.id) as vehicle_id,
        COALESCE(dls.vehicle_number, v.vehicle_number) as vehicle_number,
        v.make,
        v.model,
        v.vehicle_type,
        v.fuel_type,
        COALESCE(v.profile_image_url, v.photo_url) as vehicle_photo_url,
        COALESCE(v.profile_image_url, v.photo_url) as vehicle_image_url,
        v.status as vehicle_status,
        dls.booking_id,
        dls.booking_number,
        COALESCE(dls.latitude, d.current_latitude, v.current_latitude) as latitude,
        COALESCE(dls.longitude, d.current_longitude, v.current_longitude) as longitude,
        dls.accuracy,
        dls.speed,
        dls.heading,
        COALESCE(dls.location_name, d.current_location_name, v.current_location_name) as location_name,
        COALESCE(dls.source, 'MANUAL') as source,
        COALESCE(dls.source, 'MANUAL') as location_source,
        dls.notes,
        COALESCE(dls.is_tracking, 0) as is_tracking,
        COALESCE(dls.trip_status, CASE WHEN d.status = 'On Trip' THEN 'Started' ELSE 'Available' END) as trip_status,
        COALESCE(dls.last_updated, d.location_updated_at, v.location_updated_at, d.updated_at) as last_updated,
        b.customer_name,
        b.customer_mobile,
        b.pickup_location,
        b.drop_location,
        b.start_date,
        b.start_time,
        b.end_date,
        b.end_time,
        b.booking_amount,
        b.advance_amount,
        b.remaining_amount,
        b.distance_km,
        ((julianday('now') - julianday(COALESCE(dls.last_updated, d.location_updated_at, v.location_updated_at, d.updated_at))) * 24 * 60) as minutes_since_update
      FROM drivers d
      LEFT JOIN driver_location_status dls ON dls.driver_id = d.id
      LEFT JOIN vehicles v ON d.assigned_vehicle_id = v.id OR dls.vehicle_id = v.id
      LEFT JOIN bookings b ON dls.booking_id = b.id OR (b.driver_id = d.id AND b.booking_status IN ('Confirmed', 'Started'))
      WHERE d.status != 'Inactive'
    `;

    const params: any[] = [];

    // If driver role, restrict to their own records
    if (userRole === 'Driver') {
      const driver = await db.get('SELECT id FROM drivers WHERE email = ? OR id = ?', [req.user?.email, userId]);
      if (driver) {
        query += ` AND d.id = ?`;
        params.push(driver.id);
      }
    }

    query += ` ORDER BY dls.is_tracking DESC, dls.last_updated DESC`;

    const rawList = await db.all(query, params);

    const formatted = rawList.map(item => {
      const minutesSinceUpdate = item.minutes_since_update != null ? Math.max(0, item.minutes_since_update) : 999;
      const isDelayed = item.is_tracking === 1 && minutesSinceUpdate > delayThresholdMin;

      let statusLabel = 'Standby / Available';
      if (item.is_tracking === 1) {
        statusLabel = isDelayed ? 'GPS Delayed' : 'Live Tracking Active';
      } else if (item.trip_status === 'Started' || item.driver_status === 'On Trip') {
        statusLabel = 'On Trip (Stationary)';
      } else if (item.driver_status === 'On Leave') {
        statusLabel = 'On Leave';
      }

      return {
        ...item,
        is_signal_delayed: isDelayed,
        minutes_since_update: Math.round(minutesSinceUpdate),
        status_label: statusLabel
      };
    });

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Location History for a Booking / Trip
router.get('/history/:booking_id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { booking_id } = req.params;

    const locations = await db.all(`
      SELECT 
        tl.*,
        v.vehicle_number,
        d.name as driver_name,
        d.phone as driver_phone
      FROM trip_locations tl
      LEFT JOIN vehicles v ON tl.vehicle_id = v.id
      LEFT JOIN drivers d ON tl.driver_id = d.id
      WHERE tl.booking_id = ?
      ORDER BY tl.recorded_at ASC
    `, [booking_id]);

    const booking = await db.get(`
      SELECT b.*, v.vehicle_number, v.make, v.model, d.name as driver_name, d.phone as driver_phone 
      FROM bookings b
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN drivers d ON b.driver_id = d.id
      WHERE b.id = ?
    `, [booking_id]);

    res.json({
      booking,
      locations: locations || []
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Location History for a Driver
router.get('/history/driver/:driver_id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { driver_id } = req.params;

    const driver = await db.get('SELECT * FROM drivers WHERE id = ?', [driver_id]);
    if (!driver) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }

    const locations = await db.all(`
      SELECT 
        tl.*,
        v.vehicle_number,
        v.make,
        v.model
      FROM trip_locations tl
      LEFT JOIN vehicles v ON tl.vehicle_id = v.id
      WHERE tl.driver_id = ?
      ORDER BY tl.recorded_at DESC
      LIMIT 100
    `, [driver_id]);

    res.json({
      driver,
      locations: locations.reverse()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Driver Active Trip & Assigned Vehicle
router.get('/driver/active-trip', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userEmail = req.user?.email;
    const userId = req.user?.id;
    const userPhone = req.user?.phone;

    let driver = await db.get(
      'SELECT * FROM drivers WHERE email = ? OR id = ? OR (phone IS NOT NULL AND phone != "" AND phone = ?)',
      [userEmail, userId, userPhone || '']
    );
    if (!driver && req.user?.name) {
      driver = await db.get('SELECT * FROM drivers WHERE name LIKE ?', [`%${req.user.name}%`]);
    }

    let assignedVehicle = null;
    if (driver?.assigned_vehicle_id) {
      assignedVehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [driver.assigned_vehicle_id]);
    }
    if (!assignedVehicle && driver?.id) {
      assignedVehicle = await db.get('SELECT * FROM vehicles WHERE driver_id = ?', [driver.id]);
    }

    let activeTrip = null;
    if (driver) {
      activeTrip = await db.get(`
        SELECT b.*, v.vehicle_number, v.make, v.model, v.fuel_type,
               COALESCE(v.profile_image_url, v.photo_url) as vehicle_photo_url,
               COALESCE(v.profile_image_url, v.photo_url) as vehicle_image_url,
               d.name as driver_name, d.phone as driver_phone,
               COALESCE(d.profile_image_url, d.photo_url) as driver_photo_url,
               COALESCE(d.profile_image_url, d.photo_url) as driver_profile_image_url
        FROM bookings b
        LEFT JOIN vehicles v ON b.vehicle_id = v.id
        LEFT JOIN drivers d ON b.driver_id = d.id
        WHERE (b.driver_id = ? OR v.driver_id = ? OR b.vehicle_id = ?)
          AND b.booking_status IN ('Confirmed', 'Started')
        ORDER BY 
          CASE b.booking_status 
            WHEN 'Started' THEN 1 
            WHEN 'Confirmed' THEN 2 
            ELSE 3 
          END, b.start_date ASC
        LIMIT 1
      `, [driver.id, driver.id, assignedVehicle?.id || '']);
    } else {
      activeTrip = await db.get(`
        SELECT b.*, v.vehicle_number, v.make, v.model, v.fuel_type,
               COALESCE(v.profile_image_url, v.photo_url) as vehicle_photo_url,
               COALESCE(v.profile_image_url, v.photo_url) as vehicle_image_url,
               d.name as driver_name, d.phone as driver_phone,
               COALESCE(d.profile_image_url, d.photo_url) as driver_photo_url,
               COALESCE(d.profile_image_url, d.photo_url) as driver_profile_image_url
        FROM bookings b
        LEFT JOIN vehicles v ON b.vehicle_id = v.id
        LEFT JOIN drivers d ON b.driver_id = d.id
        WHERE b.booking_status IN ('Confirmed', 'Started')
        ORDER BY b.start_date ASC
        LIMIT 1
      `);
    }

    res.json({
      driver: driver || null,
      assignedVehicle: assignedVehicle || null,
      activeTrip: activeTrip || null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Handler function for recording real GPS coordinates
const handleRecordLocation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    const userEmail = req.user?.email;
    const userId = req.user?.id;

    // Normalizing request parameters (supports both camelCase and snake_case)
    let dId = req.body.driverId || req.body.driver_id;
    let vId = req.body.vehicleId || req.body.vehicle_id;
    let bId = req.body.tripId || req.body.booking_id || null;
    const latitude = req.body.latitude;
    const longitude = req.body.longitude;
    const accuracy = req.body.accuracy;
    const speed = req.body.speed;
    const heading = req.body.heading;
    const location_name = req.body.locationName || req.body.location_name;

    if (latitude === undefined || longitude === undefined || isNaN(Number(latitude)) || isNaN(Number(longitude))) {
      res.status(400).json({ error: 'Valid numerical latitude and longitude are required' });
      return;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({ error: 'Coordinates are out of geographical range (-90 to 90 lat, -180 to 180 lng)' });
      return;
    }

    // Authenticate driver: if user is logged in as Driver, they can only send their own location
    if (userRole === 'Driver') {
      const loggedDriver = await db.get(
        'SELECT * FROM drivers WHERE email = ? OR id = ? OR (phone IS NOT NULL AND phone != "" AND phone = ?)',
        [userEmail, userId, req.user?.phone || '']
      );
      if (loggedDriver) {
        if (dId && dId !== loggedDriver.id) {
          res.status(403).json({ error: 'Unauthorized: You cannot submit location updates for another driver.' });
          return;
        }
        dId = loggedDriver.id;
        if (!vId && loggedDriver.assigned_vehicle_id) {
          vId = loggedDriver.assigned_vehicle_id;
        }
      }
    }

    const locId = `loc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    let bNum = '';
    let vNum = '';
    let dName = '';

    if (bId) {
      const b = await db.get(`
        SELECT b.id, b.booking_number, b.driver_id, b.vehicle_id, b.booking_status,
               v.vehicle_number, d.name as driver_name
        FROM bookings b
        LEFT JOIN vehicles v ON b.vehicle_id = v.id
        LEFT JOIN drivers d ON b.driver_id = d.id
        WHERE b.id = ?
      `, [bId]);

      if (b) {
        bNum = b.booking_number;
        if (!dId) dId = b.driver_id;
        if (!vId) vId = b.vehicle_id;
        vNum = b.vehicle_number || '';
        dName = b.driver_name || '';
      }
    }

    if (!vId && dId) {
      const v = await db.get('SELECT id, vehicle_number FROM vehicles WHERE driver_id = ? OR id = (SELECT assigned_vehicle_id FROM drivers WHERE id = ?)', [dId, dId]);
      if (v) {
        vId = v.id;
        vNum = v.vehicle_number;
      }
    }

    if (!dName && dId) {
      const d = await db.get('SELECT name FROM drivers WHERE id = ?', [dId]);
      if (d) dName = d.name;
    }

    if (!dId && !vId) {
      res.status(400).json({ error: 'Location update requires at least an associated driver or vehicle.' });
      return;
    }

    // 1. Insert into trip_locations history
    await db.run(`
      INSERT INTO trip_locations (
        id, booking_id, driver_id, vehicle_id, latitude, longitude,
        accuracy, speed, heading, location_name, source, notes, recorded_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GPS', NULL, ?, ?)
    `, [
      locId, bId, dId || 'drv-unknown', vId || 'veh-unknown', lat, lng,
      accuracy != null ? Number(accuracy) : null,
      speed != null ? Number(speed) : null,
      heading != null ? Number(heading) : null,
      location_name || null,
      nowIso, nowIso
    ]);

    // 2. Upsert into driver_location_status for live map
    if (dId) {
      await db.run(`
        INSERT INTO driver_location_status (
          driver_id, driver_name, vehicle_id, vehicle_number, booking_id,
          booking_number, latitude, longitude, accuracy, speed, heading,
          location_name, source, is_tracking, tracking_status, trip_status, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GPS', 1, 'ACTIVE', 'Started', ?)
        ON CONFLICT(driver_id) DO UPDATE SET
          driver_name = COALESCE(excluded.driver_name, driver_location_status.driver_name),
          vehicle_id = COALESCE(excluded.vehicle_id, driver_location_status.vehicle_id),
          vehicle_number = COALESCE(excluded.vehicle_number, driver_location_status.vehicle_number),
          booking_id = COALESCE(excluded.booking_id, driver_location_status.booking_id),
          booking_number = COALESCE(excluded.booking_number, driver_location_status.booking_number),
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          accuracy = excluded.accuracy,
          speed = excluded.speed,
          heading = excluded.heading,
          location_name = COALESCE(excluded.location_name, driver_location_status.location_name),
          source = 'GPS',
          is_tracking = 1,
          tracking_status = 'ACTIVE',
          trip_status = 'Started',
          last_updated = excluded.last_updated
      `, [
        dId, dName, vId || null, vNum || null, bId,
        bNum || null, lat, lng,
        accuracy != null ? Number(accuracy) : null,
        speed != null ? Number(speed) : null,
        heading != null ? Number(heading) : null,
        location_name || null,
        nowIso
      ]);

      // Update drivers table
      await db.run(`
        UPDATE drivers SET
          current_location_name = COALESCE(?, current_location_name),
          current_latitude = ?,
          current_longitude = ?,
          location_updated_at = ?
        WHERE id = ?
      `, [location_name || null, lat, lng, nowIso, dId]);
    }

    if (vId) {
      await db.run(`
        UPDATE vehicles SET
          current_location_name = COALESCE(?, current_location_name),
          current_latitude = ?,
          current_longitude = ?,
          location_updated_at = ?
        WHERE id = ?
      `, [location_name || null, lat, lng, nowIso, vId]);
    }

    res.status(201).json({
      success: true,
      message: 'GPS location recorded successfully',
      locationId: locId,
      driverId: dId,
      vehicleId: vId,
      latitude: lat,
      longitude: lng,
      timestamp: nowIso
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// POST Record Real GPS Location Point from Mobile Phone
router.post('/locations', authenticateToken, handleRecordLocation);
router.post('/driver-location', authenticateToken, handleRecordLocation);
router.post('/', authenticateToken, handleRecordLocation);

// POST Start or Stop Live Tracking Status
router.post('/status', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    const userEmail = req.user?.email;
    const userId = req.user?.id;

    let dId = req.body.driverId || req.body.driver_id;
    let vId = req.body.vehicleId || req.body.vehicle_id;
    const status = (req.body.status || req.body.tracking_status || 'STOPPED').toUpperCase();
    const isTracking = status === 'ACTIVE' || status === 'STARTED' || status === 'LIVE' ? 1 : 0;
    const trackingStatus = isTracking ? 'ACTIVE' : 'STOPPED';
    const nowIso = new Date().toISOString();

    if (userRole === 'Driver') {
      const loggedDriver = await db.get(
        'SELECT * FROM drivers WHERE email = ? OR id = ? OR (phone IS NOT NULL AND phone != "" AND phone = ?)',
        [userEmail, userId, req.user?.phone || '']
      );
      if (loggedDriver) {
        dId = loggedDriver.id;
        if (!vId && loggedDriver.assigned_vehicle_id) {
          vId = loggedDriver.assigned_vehicle_id;
        }
      }
    }

    if (dId) {
      await db.run(`
        INSERT INTO driver_location_status (
          driver_id, is_tracking, tracking_status, last_updated
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(driver_id) DO UPDATE SET
          is_tracking = excluded.is_tracking,
          tracking_status = excluded.tracking_status,
          last_updated = excluded.last_updated
      `, [dId, isTracking, trackingStatus, nowIso]);

      await db.run(`
        UPDATE drivers SET
          status = ?,
          location_updated_at = ?
        WHERE id = ?
      `, [isTracking ? 'On Trip' : 'Active', nowIso, dId]);
    }

    if (vId) {
      await db.run(`
        UPDATE vehicles SET
          status = ?,
          location_updated_at = ?
        WHERE id = ?
      `, [isTracking ? 'On Trip' : 'Available', nowIso, vId]);
    }

    res.json({
      success: true,
      message: `Live GPS tracking status set to ${trackingStatus}`,
      trackingStatus,
      isTracking
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Manual Location Update for Administrators
router.post('/manual-location', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      driver_id,
      vehicle_id,
      phone,
      location_name,
      latitude,
      longitude,
      status,
      notes,
      date,
      time
    } = req.body;

    if (!driver_id && !vehicle_id) {
      res.status(400).json({ error: 'Driver or Vehicle is required for manual location configuration' });
      return;
    }

    const lat = latitude !== undefined && latitude !== '' && latitude !== null ? Number(latitude) : null;
    const lng = longitude !== undefined && longitude !== '' && longitude !== null ? Number(longitude) : null;

    if (lat !== null && (isNaN(lat) || lat < -90 || lat > 90)) {
      res.status(400).json({ error: 'Latitude must be a valid number between -90 and 90' });
      return;
    }
    if (lng !== null && (isNaN(lng) || lng < -180 || lng > 180)) {
      res.status(400).json({ error: 'Longitude must be a valid number between -180 and 180' });
      return;
    }

    // Fetch driver and vehicle records
    let driver = driver_id ? await db.get('SELECT * FROM drivers WHERE id = ?', [driver_id]) : null;
    let vehicle = vehicle_id ? await db.get('SELECT * FROM vehicles WHERE id = ?', [vehicle_id]) : null;

    if (!driver && vehicle && vehicle.driver_id) {
      driver = await db.get('SELECT * FROM drivers WHERE id = ?', [vehicle.driver_id]);
    }
    if (!vehicle && driver && driver.assigned_vehicle_id) {
      vehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [driver.assigned_vehicle_id]);
    }

    // Update driver phone number if supplied
    if (driver && phone && phone.trim() !== '' && phone !== driver.phone) {
      await db.run('UPDATE drivers SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [phone.trim(), driver.id]);
      driver.phone = phone.trim();
    }

    const locId = `loc-man-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const recordedAt = date && time ? `${date}T${time}:00` : new Date().toISOString();
    const locStatus = status || (driver?.status === 'On Trip' ? 'On Trip' : 'Available');

    // 1. Insert into trip_locations history
    if (lat !== null && lng !== null) {
      await db.run(`
        INSERT INTO trip_locations (
          id, booking_id, driver_id, vehicle_id, latitude, longitude,
          accuracy, speed, heading, location_name, source, notes, recorded_at, created_at
        ) VALUES (?, NULL, ?, ?, ?, ?, NULL, NULL, NULL, ?, 'MANUAL', ?, ?, CURRENT_TIMESTAMP)
      `, [
        locId,
        driver?.id || 'drv-unknown',
        vehicle?.id || 'veh-unknown',
        lat,
        lng,
        location_name || 'Manual Checkpoint',
        notes || null,
        recordedAt
      ]);
    }

    // 2. Upsert into driver_location_status
    if (driver) {
      await db.run(`
        INSERT INTO driver_location_status (
          driver_id, driver_name, vehicle_id, vehicle_number, booking_id,
          booking_number, latitude, longitude, location_name, source, notes,
          is_tracking, trip_status, last_updated
        ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, 'MANUAL', ?, 0, ?, ?)
        ON CONFLICT(driver_id) DO UPDATE SET
          driver_name = excluded.driver_name,
          vehicle_id = COALESCE(excluded.vehicle_id, driver_location_status.vehicle_id),
          vehicle_number = COALESCE(excluded.vehicle_number, driver_location_status.vehicle_number),
          latitude = COALESCE(excluded.latitude, driver_location_status.latitude),
          longitude = COALESCE(excluded.longitude, driver_location_status.longitude),
          location_name = excluded.location_name,
          source = 'MANUAL',
          notes = excluded.notes,
          trip_status = excluded.trip_status,
          last_updated = excluded.last_updated
      `, [
        driver.id,
        driver.name,
        vehicle?.id || null,
        vehicle?.vehicle_number || null,
        lat,
        lng,
        location_name || null,
        notes || null,
        locStatus,
        recordedAt
      ]);

      // Update drivers table
      await db.run(`
        UPDATE drivers SET
          current_location_name = ?,
          current_latitude = ?,
          current_longitude = ?,
          location_updated_at = ?,
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [location_name || null, lat, lng, recordedAt, locStatus === 'On Trip' ? 'On Trip' : 'Active', driver.id]);
    }

    if (vehicle) {
      await db.run(`
        UPDATE vehicles SET
          current_location_name = ?,
          current_latitude = ?,
          current_longitude = ?,
          location_updated_at = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [location_name || null, lat, lng, recordedAt, vehicle.id]);
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Administrator',
      action: 'MANUAL_LOCATION_UPDATE',
      entity: 'Driver',
      entityId: driver?.id || vehicle?.id,
      newValues: {
        driver: driver?.name,
        phone: driver?.phone,
        vehicle: vehicle?.vehicle_number,
        location_name,
        latitude: lat,
        longitude: lng,
        status: locStatus,
        notes
      },
      ipAddress: req.ip
    });

    res.status(201).json({
      message: 'Driver location configuration updated successfully',
      locationId: locId,
      driver_name: driver?.name,
      location_name: location_name || (lat !== null ? `${lat}, ${lng}` : 'Updated')
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Start Trip (Changes Booking to 'Started', Vehicle & Driver to 'On Trip')
router.post('/trips/:id/start', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const booking = await db.get(`
      SELECT b.*, v.vehicle_number, d.name as driver_name, d.id as driver_id_val
      FROM bookings b
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN drivers d ON b.driver_id = d.id
      WHERE b.id = ?
    `, [id]);

    if (!booking) {
      res.status(404).json({ error: 'Trip booking not found' });
      return;
    }

    if (booking.booking_status === 'Completed' || booking.booking_status === 'Cancelled') {
      res.status(400).json({ error: `Cannot start a trip with status "${booking.booking_status}"` });
      return;
    }

    // Update booking status
    await db.run("UPDATE bookings SET booking_status = 'Started' WHERE id = ?", [id]);

    // Update vehicle status
    if (booking.vehicle_id) {
      await db.run("UPDATE vehicles SET status = 'On Trip' WHERE id = ?", [booking.vehicle_id]);
    }

    // Update driver status
    if (booking.driver_id) {
      await db.run("UPDATE drivers SET status = 'On Trip' WHERE id = ?", [booking.driver_id]);
      
      // Update location status tracking state
      await db.run(`
        INSERT INTO driver_location_status (
          driver_id, driver_name, vehicle_id, vehicle_number, booking_id,
          booking_number, is_tracking, trip_status, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 'Started', CURRENT_TIMESTAMP)
        ON CONFLICT(driver_id) DO UPDATE SET
          vehicle_id = excluded.vehicle_id,
          vehicle_number = excluded.vehicle_number,
          booking_id = excluded.booking_id,
          booking_number = excluded.booking_number,
          is_tracking = 1,
          trip_status = 'Started',
          last_updated = CURRENT_TIMESTAMP
      `, [
        booking.driver_id,
        booking.driver_name || 'Driver',
        booking.vehicle_id,
        booking.vehicle_number || '',
        booking.id,
        booking.booking_number
      ]);
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Driver',
      action: 'START_TRIP',
      entity: 'Booking',
      entityId: id,
      newValues: { status: 'Started', vehicle: booking.vehicle_number },
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();

    res.json({
      message: 'Trip started successfully. Live location tracking activated.',
      bookingId: id,
      status: 'Started'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Complete / Stop Trip (Changes Booking to 'Completed', Vehicle & Driver to 'Available')
router.post('/trips/:id/complete', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const booking = await db.get(`
      SELECT b.*, v.vehicle_number, d.name as driver_name
      FROM bookings b
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN drivers d ON b.driver_id = d.id
      WHERE b.id = ?
    `, [id]);

    if (!booking) {
      res.status(404).json({ error: 'Trip booking not found' });
      return;
    }

    // Update booking status
    await db.run("UPDATE bookings SET booking_status = 'Completed' WHERE id = ?", [id]);

    // Update vehicle status back to Available
    if (booking.vehicle_id) {
      await db.run("UPDATE vehicles SET status = 'Available' WHERE id = ?", [booking.vehicle_id]);
    }

    // Update driver status back to Available
    if (booking.driver_id) {
      await db.run("UPDATE drivers SET status = 'Active' WHERE id = ?", [booking.driver_id]);

      // Stop location tracking flag
      await db.run(`
        UPDATE driver_location_status 
        SET is_tracking = 0, trip_status = 'Completed', last_updated = CURRENT_TIMESTAMP
        WHERE driver_id = ?
      `, [booking.driver_id]);
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name || 'Driver',
      action: 'COMPLETE_TRIP',
      entity: 'Booking',
      entityId: id,
      newValues: { status: 'Completed', vehicle: booking.vehicle_number },
      ipAddress: req.ip
    });

    await NotificationEngine.runEvaluation();

    res.json({
      message: 'Trip completed successfully. Vehicle and driver marked as Available. Location tracking stopped.',
      bookingId: id,
      status: 'Completed'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
