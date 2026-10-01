import { Request } from 'express';

export interface NormalizedGPSData {
  deviceToken?: string;
  driverId?: string;
  vehicleId?: string;
  tripId?: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  altitude?: number | null;
  batteryLevel?: number | null;
  locationName?: string;
  provider: string;
  source: 'GPS' | 'MANUAL';
  timestamp: string;
}

export interface IGPSProvider {
  readonly name: string;
  canHandle(req: Request): boolean;
  parse(req: Request): NormalizedGPSData | null;
}

/**
 * 1. Mobile HTML5 Browser Geolocation Provider
 * Handles JSON payload from mobile browsers via SmartFleet Driver Portal
 */
export class BrowserGPSProvider implements IGPSProvider {
  readonly name = 'Browser GPS';

  canHandle(req: Request): boolean {
    const body = req.body || {};
    return (
      (body.latitude !== undefined || body.lat !== undefined) &&
      !req.query.traccar &&
      !req.headers['x-traccar-version']
    );
  }

  parse(req: Request): NormalizedGPSData | null {
    const body = req.body || {};
    const query = req.query || {};

    const lat = parseFloat(body.latitude ?? body.lat ?? query.lat);
    const lng = parseFloat(body.longitude ?? body.lng ?? body.lon ?? query.lng ?? query.lon);

    if (isNaN(lat) || isNaN(lng)) return null;

    const token = body.token || req.headers['x-driver-token'] || query.token || null;
    const driverId = body.driverId || body.driver_id || query.driverId;
    const vehicleId = body.vehicleId || body.vehicle_id || query.vehicleId;
    const tripId = body.tripId || body.trip_id || body.booking_id || query.tripId;

    return {
      deviceToken: token ? String(token) : undefined,
      driverId: driverId ? String(driverId) : undefined,
      vehicleId: vehicleId ? String(vehicleId) : undefined,
      tripId: tripId ? String(tripId) : undefined,
      latitude: lat,
      longitude: lng,
      accuracy: body.accuracy != null ? parseFloat(body.accuracy) : null,
      speed: body.speed != null ? parseFloat(body.speed) : null,
      heading: body.heading != null ? parseFloat(body.heading) : (body.bearing != null ? parseFloat(body.bearing) : null),
      altitude: body.altitude != null ? parseFloat(body.altitude) : null,
      locationName: body.locationName || body.location_name || undefined,
      provider: 'Browser GPS',
      source: 'GPS',
      timestamp: body.timestamp || new Date().toISOString()
    };
  }
}

/**
 * 2. Traccar / OsmAnd Native GPS Client Provider
 * Handles standard Traccar Client / OsmAnd HTTP protocol:
 * e.g. GET/POST /api/driver-tracking/location?id=TRK-12345&lat=11.0168&lon=76.9558&speed=12.5&bearing=90&timestamp=1700000000
 */
export class TraccarGPSProvider implements IGPSProvider {
  readonly name = 'Traccar GPS';

  canHandle(req: Request): boolean {
    const query = req.query || {};
    const body = req.body || {};
    return (
      query.id !== undefined ||
      body.id !== undefined ||
      req.headers['x-traccar-version'] !== undefined ||
      req.path.includes('/traccar')
    );
  }

  parse(req: Request): NormalizedGPSData | null {
    const query = req.query || {};
    const body = req.body || {};

    const deviceId = (query.id || body.id || query.deviceid || body.deviceid)?.toString();
    const lat = parseFloat(query.lat || body.lat || query.latitude || body.latitude);
    const lng = parseFloat(query.lon || body.lon || query.lng || body.lng || query.longitude || body.longitude);

    if (isNaN(lat) || isNaN(lng)) return null;

    let timestamp = new Date().toISOString();
    if (query.timestamp || body.timestamp) {
      const rawTs = Number(query.timestamp || body.timestamp);
      if (!isNaN(rawTs)) {
        timestamp = new Date(rawTs > 1e11 ? rawTs : rawTs * 1000).toISOString();
      }
    }

    return {
      deviceToken: deviceId,
      latitude: lat,
      longitude: lng,
      speed: (query.speed != null || body.speed != null) ? parseFloat(query.speed || body.speed) : null,
      heading: (query.bearing != null || body.bearing != null) ? parseFloat(query.bearing || body.bearing) : null,
      altitude: (query.altitude != null || body.altitude != null) ? parseFloat(query.altitude || body.altitude) : null,
      batteryLevel: (query.batt != null || body.batt != null) ? parseFloat(query.batt || body.batt) : null,
      provider: 'Traccar GPS',
      source: 'GPS',
      timestamp
    };
  }
}

/**
 * Extensible GPS Provider Manager
 */
export class GPSProviderManager {
  private static providers: IGPSProvider[] = [
    new TraccarGPSProvider(),
    new BrowserGPSProvider()
  ];

  public static registerProvider(provider: IGPSProvider) {
    this.providers.unshift(provider);
  }

  public static processRequest(req: Request): NormalizedGPSData | null {
    for (const provider of this.providers) {
      if (provider.canHandle(req)) {
        const data = provider.parse(req);
        if (data) return data;
      }
    }

    // Default fallback to Browser GPS
    const defaultProvider = new BrowserGPSProvider();
    return defaultProvider.parse(req);
  }
}
