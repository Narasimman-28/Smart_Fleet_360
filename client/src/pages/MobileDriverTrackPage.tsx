import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Square, 
  CheckCircle2, 
  AlertTriangle, 
  Compass, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  User,
  Radio,
  HelpCircle,
  Smartphone,
  Lock,
  Unlock,
  ShieldAlert,
  Server,
  Activity
} from 'lucide-react';
import { resolveDriverImageUrl } from '../utils/imageUrl';

interface MobileDriverTrackPageProps {
  token?: string;
  onNavigate?: (path: string) => void;
}

export const MobileDriverTrackPage: React.FC<MobileDriverTrackPageProps> = ({ token: propToken }) => {
  // Extract token from prop or URL pathname / query
  const extractToken = (): string => {
    if (propToken) return propToken;
    const pathParts = window.location.pathname.split('/');
    const trackIndex = pathParts.indexOf('driver-track');
    if (trackIndex !== -1 && pathParts[trackIndex + 1]) {
      return pathParts[trackIndex + 1];
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
  };

  const token = extractToken();

  // Secure context detection (Critical: modern mobile browsers only allow Geolocation over HTTPS or localhost)
  const isSecureContext = typeof window !== 'undefined' && (
    window.isSecureContext === true || 
    window.location.protocol === 'https:' || 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1'
  );

  const [loading, setLoading] = useState(true);
  const [driverData, setDriverData] = useState<any>(null);
  const [gpsPermission, setGpsPermission] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [isTracking, setIsTracking] = useState(false);
  const [isSearchingGps, setIsSearchingGps] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [serverStatus, setServerStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'CONNECTING'>('CONNECTING');
  
  const [lastLocation, setLastLocation] = useState<{
    lat: number;
    lng: number;
    accuracy?: number | null;
    speed?: number | null;
    heading?: number | null;
    time: string;
  } | null>(null);

  const [gpsError, setGpsError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);

  // Refs for continuous watcher and timers
  const watchIdRef = useRef<number | null>(null);
  const intervalTimerRef = useRef<any>(null);
  const isTrackingRef = useRef<boolean>(false);
  const tokenRef = useRef<string | undefined>(token);

  isTrackingRef.current = isTracking;
  tokenRef.current = token;

  // 1. Verify Driver Tracking Token on Mount
  const verifyTokenAndLoad = async () => {
    if (!token) {
      setGpsError('Missing driver tracking token in URL.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setGpsError(null);
      const res = await fetch(`/api/driver-tracking/verify-token/${token}`);
      const data = await res.json();

      if (!res.ok || !data.valid) {
        throw new Error(data.error || 'Invalid or expired tracking token.');
      }

      setDriverData(data);
      setServerStatus('CONNECTED');

      if (data.lastLocation?.isTracking) {
        setIsTracking(true);
        isTrackingRef.current = true;
        setLastLocation({
          lat: data.lastLocation.latitude,
          lng: data.lastLocation.longitude,
          accuracy: data.lastLocation.accuracy,
          speed: data.lastLocation.speed,
          heading: data.lastLocation.heading,
          time: new Date(data.lastLocation.lastUpdated).toLocaleTimeString()
        });
      }
    } catch (err: any) {
      setServerStatus('DISCONNECTED');
      setGpsError(err.message || 'Failed to authenticate driver tracking token.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verifyTokenAndLoad();

    // Check Geolocation Permission state if supported in secure context
    if (isSecureContext && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((res) => {
        setGpsPermission(res.state as 'prompt' | 'granted' | 'denied');
        res.onchange = () => {
          setGpsPermission(res.state as 'prompt' | 'granted' | 'denied');
        };
      }).catch(() => {});
    } else if (!navigator.geolocation) {
      setGpsPermission('unsupported');
    }

    // Online / Offline Listeners
    const handleOnline = () => {
      setIsOnline(true);
      setServerStatus('CONNECTED');
    };
    const handleOffline = () => {
      setIsOnline(false);
      setServerStatus('DISCONNECTED');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      stopGpsTracking();
    };
  }, [token, isSecureContext]);

  const lastSentTimeRef = useRef<number>(0);
  const lastSentCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  // Helper to calculate approximate distance in meters between two lat/lng points
  const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // 2. Transmit Real GPS Coordinates to Server (with 3-second / 5-meter rate throttling)
  const transmitGPSCoordinates = async (pos: GeolocationPosition, force: boolean = false) => {
    if (!tokenRef.current) return;

    const now = Date.now();
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // Rate throttling: allow if forced (first fix) or >= 3 seconds elapsed or moved >= 5 meters
    if (!force && lastSentCoordsRef.current) {
      const timeDiff = now - lastSentTimeRef.current;
      const dist = calculateDistanceMeters(
        lastSentCoordsRef.current.lat,
        lastSentCoordsRef.current.lng,
        lat,
        lng
      );
      if (timeDiff < 3000 && dist < 5) {
        return;
      }
    }

    lastSentTimeRef.current = now;
    lastSentCoordsRef.current = { lat, lng };

    const payload = {
      token: tokenRef.current,
      driverId: driverData?.driver?.id,
      vehicleId: driverData?.assignedVehicle?.id,
      tripId: driverData?.activeTrip?.id,
      latitude: lat,
      longitude: lng,
      accuracy: pos.coords.accuracy != null ? pos.coords.accuracy : null,
      speed: pos.coords.speed != null ? pos.coords.speed : null,
      heading: pos.coords.heading != null ? pos.coords.heading : null,
      timestamp: new Date(pos.timestamp).toISOString()
    };

    setLastLocation({
      lat,
      lng,
      accuracy: pos.coords.accuracy,
      speed: pos.coords.speed,
      heading: pos.coords.heading,
      time: new Date().toLocaleTimeString()
    });

    setGpsError(null);
    setGpsPermission('granted');
    setIsSearchingGps(false);
    setUpdateCount(prev => prev + 1);

    try {
      const res = await fetch('/api/driver-tracking/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setServerStatus('CONNECTED');
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.warn('GPS sync response:', errJson);
      }
    } catch (err) {
      setServerStatus('DISCONNECTED');
      setGpsError('Live server connection lost. Reconnecting...');
      console.error('Network error transmitting GPS coordinate:', err);
    }
  };

  const handlePositionError = (err: GeolocationPositionError) => {
    setIsSearchingGps(false);
    switch (err.code) {
      case err.PERMISSION_DENIED:
        setGpsPermission('denied');
        setGpsError('Location permission is blocked. Allow Location for this website.');
        setShowPermissionHelp(true);
        break;
      case err.POSITION_UNAVAILABLE:
        setGpsError('GPS position is currently unavailable. Turn on phone Location Services.');
        break;
      case err.TIMEOUT:
        setGpsError('GPS is taking too long to respond. Move to an area with better GPS signal.');
        break;
      default:
        setGpsError('Unable to obtain GPS fix. Checking mobile sensors...');
    }
  };

  // 3. Start Geolocation Watcher
  const startContinuousWatch = () => {
    if (!navigator.geolocation) return;

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    };

    // Continuous real-time watcher
    if (watchIdRef.current === null) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsPermission('granted');
          transmitGPSCoordinates(pos);
        },
        (err) => handlePositionError(err),
        options
      );
    }

    // Secondary fallback sync timer (every 10 seconds)
    if (!intervalTimerRef.current) {
      intervalTimerRef.current = setInterval(() => {
        if (isTrackingRef.current && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => transmitGPSCoordinates(pos),
            (err) => console.warn('Periodic GPS fix notice:', err.message),
            options
          );
        }
      }, 10000);
    }
  };

  // 4. Stop Geolocation Watcher
  const stopGpsTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalTimerRef.current) {
      clearInterval(intervalTimerRef.current);
      intervalTimerRef.current = null;
    }
  };

  // Action: START TRACKING
  const handleStartTracking = async () => {
    setActionLoading(true);
    setGpsError(null);
    setStatusMessage('');

    // Step 1: Check HTTPS / Secure Context
    if (!isSecureContext) {
      setGpsError('GPS tracking requires HTTPS on mobile browsers. Unencrypted HTTP connections block mobile GPS sensors.');
      setActionLoading(false);
      return;
    }

    // Step 2: Check Geolocation API support
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by this browser.');
      setGpsPermission('unsupported');
      setActionLoading(false);
      return;
    }

    setIsSearchingGps(true);

    try {
      // Step 3 & 4: Request permission and receive the first real GPS coordinate
      const firstPosition = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        });
      });

      // Step 5: Transmit first real coordinate to backend
      await transmitGPSCoordinates(firstPosition);

      // Step 6: Start continuous watchPosition
      setIsTracking(true);
      isTrackingRef.current = true;
      startContinuousWatch();

      // Step 7: Change status to LIVE GPS
      setStatusMessage('GPS Tracking Active! Coordinates are streaming live to SmartFleet 360.');
    } catch (err: any) {
      if (err.code === 1 || err.PERMISSION_DENIED === 1) {
        setGpsPermission('denied');
        setGpsError('Location permission is blocked. Open browser site settings and allow Location.');
        setShowPermissionHelp(true);
      } else if (err.code === 2 || err.POSITION_UNAVAILABLE === 2) {
        setGpsError('GPS location is currently unavailable. Turn on phone Location Services / GPS and try again.');
      } else if (err.code === 3 || err.TIMEOUT === 3) {
        setGpsError('GPS is taking too long to respond. Move to an area with better GPS signal.');
      } else {
        setGpsError(err.message || 'Failed to start GPS tracking.');
      }
    } finally {
      setActionLoading(false);
      setIsSearchingGps(false);
    }
  };

  // Action: STOP TRACKING
  const handleStopTracking = async () => {
    setActionLoading(true);
    try {
      stopGpsTracking();
      setIsTracking(false);
      isTrackingRef.current = false;

      // Notify backend of disconnection
      await fetch('/api/driver-tracking/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      setStatusMessage('GPS Tracking Stopped. Location updates have been disconnected.');
    } catch (err: any) {
      setGpsError(err.message || 'Failed to notify server.');
    } finally {
      setActionLoading(false);
    }
  };

  const driver = driverData?.driver;
  const vehicle = driverData?.assignedVehicle;
  const trip = driverData?.activeTrip;

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F5F5F5] flex flex-col justify-between font-sans selection:bg-[#E53935] selection:text-[#F5F5F5] p-4 sm:p-6">
      <div className="max-w-md w-full mx-auto space-y-4">
        {/* Brand Header */}
        <div className="flex items-center justify-between pt-2 pb-2 border-b border-[#3F3F46]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#E53935] flex items-center justify-center shadow-lg shadow-[#E53935]/30">
              <Compass className="w-6 h-6 text-[#F5F5F5] animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-[#F5F5F5] flex items-center gap-1.5">
                SmartFleet 360
              </h1>
              <span className="text-[10px] font-bold text-[#E53935] uppercase tracking-widest block">
                Driver Mobile GPS Telemetry
              </span>
            </div>
          </div>

          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
            isOnline 
              ? 'bg-[#0F2A1A] text-[#22C55E] border-[#22C55E]/40' 
              : 'bg-[#3F1111] text-[#FF1744] border-[#7F1D1D]'
          }`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>

        {/* Insecure HTTP Warning Banner (When opened over unencrypted HTTP) */}
        {!isSecureContext && (
          <div className="bg-[#3A2808] border border-[#F59E0B] rounded-2xl p-4 text-xs text-[#F59E0B] space-y-2 shadow-lg">
            <div className="flex items-center gap-2 font-bold text-[#F5F5F5] text-sm">
              <ShieldAlert className="w-5 h-5 text-[#F59E0B] shrink-0" />
              <span>Secure Connection Required (HTTPS)</span>
            </div>
            <p className="text-[#D4D4D8] leading-relaxed text-[11px]">
              Mobile browsers (Chrome on Android, Safari on iOS) strictly block real GPS access over unencrypted HTTP (e.g. LAN IP).
            </p>
            <div className="bg-[#111113] p-2.5 rounded-xl border border-[#F59E0B]/30 text-[11px] space-y-1">
              <span className="font-bold text-[#F59E0B] block">How to enable real 4G/5G GPS tracking:</span>
              <p className="text-[#A1A1AA]">
                1. Use the public HTTPS URL configured by SmartFleet 360 (e.g., <code className="text-[#60A5FA]">https://your-domain.com</code> or an HTTPS Cloudflare Tunnel).
              </p>
              <p className="text-[#A1A1AA]">
                2. Once opened over HTTPS, your phone will allow full high-accuracy GPS streaming anywhere over 4G/5G mobile data.
              </p>
            </div>
          </div>
        )}

        {/* Connection Diagnostics Bar */}
        <div className="bg-[#18181B] rounded-2xl p-3 border border-[#3F3F46] text-[10px] grid grid-cols-3 gap-2">
          <div className="bg-[#111113] p-2 rounded-xl border border-[#3F3F46]">
            <span className="text-[#71717A] font-bold block mb-0.5">Connection</span>
            <span className={`font-black flex items-center gap-1 ${isOnline ? 'text-[#22C55E]' : 'text-[#FF1744]'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[#22C55E]' : 'bg-[#FF1744]'}`} />
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <div className="bg-[#111113] p-2 rounded-xl border border-[#3F3F46]">
            <span className="text-[#71717A] font-bold block mb-0.5">Secure Context</span>
            <span className={`font-black flex items-center gap-1 ${isSecureContext ? 'text-[#22C55E]' : 'text-[#F59E0B]'}`}>
              {isSecureContext ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              {isSecureContext ? 'YES (HTTPS)' : 'NO (HTTP)'}
            </span>
          </div>

          <div className="bg-[#111113] p-2 rounded-xl border border-[#3F3F46]">
            <span className="text-[#71717A] font-bold block mb-0.5">Server API</span>
            <span className={`font-black flex items-center gap-1 ${
              serverStatus === 'CONNECTED' ? 'text-[#22C55E]' : 'text-[#FF1744]'
            }`}>
              <Server className="w-3 h-3" />
              {serverStatus}
            </span>
          </div>

          <div className="bg-[#111113] p-2 rounded-xl border border-[#3F3F46]">
            <span className="text-[#71717A] font-bold block mb-0.5">GPS Permission</span>
            <span className={`font-black uppercase ${
              gpsPermission === 'granted' 
                ? 'text-[#22C55E]' 
                : gpsPermission === 'denied' 
                ? 'text-[#FF1744]' 
                : 'text-[#F59E0B]'
            }`}>
              {gpsPermission === 'granted' ? 'GRANTED' : gpsPermission === 'denied' ? 'BLOCKED' : 'PROMPT'}
            </span>
          </div>

          <div className="bg-[#111113] p-2 rounded-xl border border-[#3F3F46]">
            <span className="text-[#71717A] font-bold block mb-0.5">GPS Status</span>
            <span className={`font-black uppercase ${
              isTracking 
                ? 'text-[#22C55E]' 
                : isSearchingGps 
                ? 'text-[#F59E0B] animate-pulse' 
                : gpsError 
                ? 'text-[#FF1744]' 
                : 'text-[#71717A]'
            }`}>
              {isTracking ? 'LIVE GPS' : isSearchingGps ? 'SEARCHING...' : gpsError ? 'ERROR' : 'NOT STARTED'}
            </span>
          </div>

          <div className="bg-[#111113] p-2 rounded-xl border border-[#3F3F46]">
            <span className="text-[#71717A] font-bold block mb-0.5">Last GPS Fix</span>
            <span className="font-mono font-black text-[#F5F5F5] truncate block">
              {lastLocation ? lastLocation.time : 'None'}
            </span>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#E53935] animate-spin mx-auto" />
            <p className="text-xs text-[#A1A1AA] font-semibold">Authenticating Driver Tracking Session...</p>
          </div>
        ) : (
          <>
            {/* Driver & Vehicle Information Card */}
            <div className="bg-[#18181B] rounded-3xl p-4 sm:p-5 border border-[#3F3F46] shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-[#3F3F46]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#111113] border border-[#7F1D1D] flex items-center justify-center text-[#E53935] font-black overflow-hidden shrink-0">
                    {resolveDriverImageUrl(driver?.profile_image_url || driver?.photo_url) ? (
                      <img
                        src={resolveDriverImageUrl(driver?.profile_image_url || driver?.photo_url)}
                        alt={driver?.name || 'Driver'}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    ) : (
                      <User className="w-5 h-5 text-[#E53935]" />
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] block">
                      Driver Name
                    </span>
                    <h2 className="text-sm font-black text-[#F5F5F5]">
                      {driver?.name || 'Fleet Driver'}
                    </h2>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-[#F5F5F5] bg-[#27272A] px-2.5 py-1 rounded-lg border border-[#3F3F46]">
                  {driver?.phone || 'Mobile Verified'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                <div className="bg-[#111113] p-2.5 rounded-2xl border border-[#3F3F46]">
                  <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block mb-0.5">
                    Vehicle Number
                  </span>
                  <span className="text-xs font-black text-[#E53935] font-mono block truncate">
                    {vehicle?.vehicle_number || trip?.vehicle_number || 'Standby'}
                  </span>
                </div>

                <div className="bg-[#111113] p-2.5 rounded-2xl border border-[#3F3F46]">
                  <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block mb-0.5">
                    Model
                  </span>
                  <span className="text-xs font-black text-[#F5F5F5] block truncate">
                    {vehicle?.make ? `${vehicle.make} ${vehicle.model}` : 'Commercial'}
                  </span>
                </div>
              </div>

              {trip && (
                <div className="bg-[#111113] border border-[#7F1D1D] p-2.5 rounded-2xl text-xs space-y-1">
                  <span className="text-[10px] font-bold text-[#E53935] uppercase tracking-wider block">
                    Active Trip: {trip.booking_number}
                  </span>
                  <div className="text-[#A1A1AA] text-[11px] truncate">
                    📍 {trip.pickup_location} $\rightarrow$ 🏁 {trip.drop_location}
                  </div>
                </div>
              )}
            </div>

            {/* GPS Connection Status HUD */}
            <div className={`rounded-3xl p-5 border shadow-2xl transition-all ${
              isTracking 
                ? 'bg-[#18181B] border-[#22C55E]/40' 
                : 'bg-[#18181B] border-[#3F3F46]'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    isTracking 
                      ? 'bg-[#22C55E] text-[#F5F5F5] shadow-lg shadow-[#22C55E]/30 animate-pulse' 
                      : 'bg-[#111113] text-[#71717A] border border-[#3F3F46]'
                  }`}>
                    <Radio className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] block">
                      Telemetry State
                    </span>
                    <h3 className="text-sm font-black text-[#F5F5F5] flex items-center gap-1.5">
                      {isTracking ? 'GPS STATUS: 🟢 LIVE' : isSearchingGps ? 'GPS STATUS: ACQUIRING FIX...' : 'GPS STATUS: NOT STARTED'}
                    </h3>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isTracking 
                    ? 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40 animate-pulse' 
                    : 'bg-[#27272A] text-[#A1A1AA] border border-[#3F3F46]'
                }`}>
                  {isTracking ? 'STREAMING REAL GPS' : isSearchingGps ? 'SEARCHING SENSORS' : 'READY TO CONNECT'}
                </span>
              </div>

              {/* GPS Settings Checklist */}
              <div className="bg-[#111113] p-3 rounded-2xl border border-[#3F3F46] space-y-1.5 text-[11px] my-3">
                <span className="font-bold text-[#A1A1AA] uppercase tracking-wider text-[10px] block mb-1">
                  GPS Pre-Flight Checklist:
                </span>
                <div className="grid grid-cols-1 gap-1 text-[#D4D4D8]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
                    <span>Phone Location Services / GPS enabled</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${gpsPermission === 'granted' ? 'text-[#22C55E]' : 'text-[#71717A]'} shrink-0`} />
                    <span>Browser Location permission {gpsPermission === 'granted' ? 'granted' : 'ready to prompt'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isSecureContext ? 'text-[#22C55E]' : 'text-[#F59E0B]'} shrink-0`} />
                    <span>HTTPS secure connection {isSecureContext ? '(verified)' : '(HTTPS required)'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isOnline ? 'text-[#22C55E]' : 'text-[#FF1744]'} shrink-0`} />
                    <span>Internet / 4G / 5G connection {isOnline ? 'active' : 'offline'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isTracking ? 'text-[#22C55E]' : 'text-[#71717A]'} shrink-0`} />
                    <span>GPS satellite / cell fix {isTracking ? 'acquired & live' : 'standby'}</span>
                  </div>
                </div>
              </div>

              {/* Live Telemetry Display */}
              {isTracking && lastLocation && (
                <div className="grid grid-cols-2 gap-2.5 my-3 pt-2 border-t border-[#3F3F46] text-xs">
                  <div className="bg-[#111113] p-2.5 rounded-2xl border border-[#22C55E]/30">
                    <span className="text-[9px] font-bold text-[#71717A] block mb-0.5">Latitude / Longitude</span>
                    <span className="font-mono font-black text-[#F5F5F5] block text-[11px] truncate">
                      {lastLocation.lat.toFixed(5)}, {lastLocation.lng.toFixed(5)}
                    </span>
                  </div>

                  <div className="bg-[#111113] p-2.5 rounded-2xl border border-[#22C55E]/30">
                    <span className="text-[9px] font-bold text-[#71717A] block mb-0.5">GPS Accuracy</span>
                    <span className="font-black text-[#F5F5F5] block text-[11px]">
                      {lastLocation.accuracy != null ? `±${Math.round(lastLocation.accuracy)} meters` : 'High'}
                    </span>
                  </div>

                  <div className="bg-[#111113] p-2.5 rounded-2xl border border-[#22C55E]/30">
                    <span className="text-[9px] font-bold text-[#71717A] block mb-0.5">Vehicle Speed</span>
                    <span className="font-black text-[#F5F5F5] block text-[11px]">
                      {lastLocation.speed != null ? `${Math.round(lastLocation.speed * 3.6)} km/h` : '0 km/h'}
                    </span>
                  </div>

                  <div className="bg-[#111113] p-2.5 rounded-2xl border border-[#22C55E]/30">
                    <span className="text-[9px] font-bold text-[#71717A] block mb-0.5">Last Transmitted</span>
                    <span className="font-black text-[#22C55E] block text-[11px]">
                      {lastLocation.time}
                    </span>
                  </div>
                </div>
              )}

              {/* Permission & Error Banner */}
              {gpsError && (
                <div className="my-3 bg-[#3F1111] border border-[#B71C1C] rounded-2xl p-3.5 text-xs text-[#FF6B6B] flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-[#FF1744] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="font-bold block text-[#F5F5F5]">GPS Notice:</strong>
                    <div className="text-[11px] leading-relaxed">{gpsError}</div>
                    {gpsPermission === 'denied' && (
                      <button
                        type="button"
                        onClick={() => setShowPermissionHelp(true)}
                        className="mt-1.5 text-[#FF1744] hover:text-[#FF6B6B] font-bold underline flex items-center gap-1 cursor-pointer"
                      >
                        <HelpCircle className="w-3.5 h-3.5" /> How to allow location in browser
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Status Message Banner */}
              {statusMessage && (
                <div className="my-3 bg-[#0F2A1A] border border-[#22C55E] rounded-2xl p-3 text-xs text-[#22C55E] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {/* Permission Help Dialog */}
              {showPermissionHelp && (
                <div className="my-3 bg-[#111113] border border-[#E53935] rounded-2xl p-3.5 text-xs text-[#F5F5F5] space-y-2">
                  <div className="font-black flex items-center gap-1.5 text-[#E53935]">
                    <Smartphone className="w-4 h-4 text-[#E53935]" /> Enable Location on Mobile:
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[#A1A1AA] text-[11px]">
                    <li>Tap the <strong className="text-[#F5F5F5]">Lock / Settings icon (🔒)</strong> in your browser address bar.</li>
                    <li>Tap <strong className="text-[#F5F5F5]">Permissions $\rightarrow$ Location</strong>.</li>
                    <li>Set to <strong className="text-[#22C55E]">Allow</strong>.</li>
                    <li>Ensure phone GPS / Location Services is turned ON in phone settings.</li>
                    <li>Return here and tap <strong className="text-[#E53935]">START TRACKING</strong>.</li>
                  </ol>
                  <button
                    onClick={() => setShowPermissionHelp(false)}
                    className="mt-1 px-3 py-1 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] font-bold rounded-lg text-[10px] cursor-pointer"
                  >
                    Got It
                  </button>
                </div>
              )}

              {/* Primary Action Buttons: START TRACKING & STOP TRACKING */}
              <div className="pt-2">
                {!isTracking ? (
                  <button
                    type="button"
                    onClick={handleStartTracking}
                    disabled={actionLoading}
                    className="w-full py-4 px-6 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] font-black text-base rounded-2xl shadow-xl shadow-[#E53935]/30 flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.99] disabled:opacity-50 transition"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>{actionLoading ? 'Connecting to GPS Sensors...' : 'START TRACKING'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStopTracking}
                    disabled={actionLoading}
                    className="w-full py-4 px-6 bg-[#B71C1C] hover:bg-[#E53935] text-[#F5F5F5] font-black text-base rounded-2xl shadow-xl shadow-[#B71C1C]/30 flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.99] disabled:opacity-50 transition"
                  >
                    <Square className="w-5 h-5 fill-current" />
                    <span>{actionLoading ? 'Stopping Telemetry...' : 'STOP TRACKING'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Connection Footer Info */}
            <div className="text-center text-[10px] text-[#71717A] space-y-0.5">
              <div>Secure Driver Tracking Session (4G / 5G / Internet Telemetry)</div>
              <div>Token: <span className="font-mono text-[#A1A1AA]">{token?.slice(0, 16)}...</span></div>
              {updateCount > 0 && (
                <div className="text-[#22C55E] font-bold flex items-center justify-center gap-1">
                  <Activity className="w-3 h-3 text-[#22C55E] animate-pulse" />
                  <span>{updateCount} real-time GPS coordinate point(s) transmitted</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="text-center text-[11px] text-[#71717A] pt-6 pb-2">
        SmartFleet 360 Enterprise GPS Telemetry System
      </div>
    </div>
  );
};

export default MobileDriverTrackPage;
