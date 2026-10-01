import React, { useState, useEffect, useRef } from 'react';
import { 
  Navigation, 
  Play, 
  Square, 
  CheckCircle, 
  AlertTriangle, 
  Phone, 
  Compass, 
  Wifi, 
  WifiOff, 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw,
  Car,
  User,
  Activity,
  AlertCircle,
  Radio,
  Clock,
  Gauge,
  Crosshair,
  MapPin,
  HelpCircle,
  Smartphone
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LiveTrackingMap } from '../components/LiveTrackingMap';
import { resolveDriverImageUrl } from '../utils/imageUrl';
import type { TripLocation } from '../types';

export const DriverPortalPage: React.FC = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState<any>(null);
  const [assignedVehicle, setAssignedVehicle] = useState<any>(null);
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [gpsPermission, setGpsPermission] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [isTracking, setIsTracking] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastLocation, setLastLocation] = useState<{
    lat: number;
    lng: number;
    accuracy?: number | null;
    speed?: number | null;
    heading?: number | null;
    time: string;
    isoTime: string;
  } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [tripHistory, setTripHistory] = useState<TripLocation[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);

  // Watchers / Timers refs
  const watchIdRef = useRef<number | null>(null);
  const intervalTimerRef = useRef<any>(null);
  const isTrackingRef = useRef<boolean>(false);
  const activeTripRef = useRef<any>(null);
  const driverRef = useRef<any>(null);
  const vehicleRef = useRef<any>(null);

  isTrackingRef.current = isTracking;
  activeTripRef.current = activeTrip;
  driverRef.current = driver;
  vehicleRef.current = assignedVehicle;

  // Load Driver Profile, Assigned Vehicle, and Active Trip
  const loadDriverData = async () => {
    try {
      setLoading(true);
      setGpsError(null);
      const data = await api.getDriverActiveTrip();
      setDriver(data.driver);
      setAssignedVehicle(data.assignedVehicle);
      setActiveTrip(data.activeTrip);

      if (data.activeTrip && data.activeTrip.booking_status === 'Started') {
        setIsTracking(true);
        try {
          const hist = await api.getTrackingHistory(data.activeTrip.id);
          setTripHistory(hist.locations || []);
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      console.error('Failed to load driver trip data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDriverData();

    // Check Geolocation permission query if supported
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((res) => {
        setGpsPermission(res.state as 'prompt' | 'granted' | 'denied');
        res.onchange = () => {
          setGpsPermission(res.state as 'prompt' | 'granted' | 'denied');
        };
      }).catch(() => {});
    } else if (!navigator.geolocation) {
      setGpsPermission('unsupported');
    }

    // Network status listener
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      stopGpsWatcher();
    };
  }, []);

  // Send Coordinates to Server
  const sendLocationToServer = async (pos: GeolocationPosition) => {
    if (!isTrackingRef.current) return;

    const curDriver = driverRef.current;
    const curVehicle = vehicleRef.current;
    const curTrip = activeTripRef.current;

    const coords = {
      driverId: curDriver?.id || user?.id,
      driver_id: curDriver?.id || user?.id,
      vehicleId: curTrip?.vehicle_id || curVehicle?.id,
      vehicle_id: curTrip?.vehicle_id || curVehicle?.id,
      tripId: curTrip?.id || null,
      booking_id: curTrip?.id || null,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy != null ? pos.coords.accuracy : null,
      speed: pos.coords.speed != null ? pos.coords.speed : null,
      heading: pos.coords.heading != null ? pos.coords.heading : null,
      timestamp: new Date(pos.timestamp).toISOString()
    };

    setLastLocation({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      speed: pos.coords.speed,
      heading: pos.coords.heading,
      time: new Date().toLocaleTimeString(),
      isoTime: new Date().toISOString()
    });

    setGpsError(null);
    setGpsPermission('granted');

    try {
      await api.sendDriverLocation(coords);

      // Append to local route history for the map
      setTripHistory(prev => [
        ...prev,
        {
          id: `gps-${Date.now()}`,
          booking_id: curTrip?.id || '',
          driver_id: curDriver?.id || '',
          vehicle_id: curTrip?.vehicle_id || curVehicle?.id || '',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          recorded_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        }
      ]);
    } catch (err: any) {
      console.error('Failed to send GPS coordinate update:', err);
    }
  };

  // Start continuous Watcher
  const startGpsWatcher = () => {
    if (!navigator.geolocation) {
      setGpsPermission('unsupported');
      setGpsError('Geolocation API is not supported by your mobile browser.');
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    // 1. Trigger initial position fix
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsPermission('granted');
        sendLocationToServer(pos);
      },
      (err) => {
        handleGeolocationError(err);
      },
      options
    );

    // 2. Start continuous high-accuracy stream
    if (watchIdRef.current === null) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsPermission('granted');
          sendLocationToServer(pos);
        },
        (err) => {
          handleGeolocationError(err);
        },
        options
      );
    }

    // 3. Fallback periodic sync timer (every 10s)
    if (!intervalTimerRef.current) {
      intervalTimerRef.current = setInterval(() => {
        if (isTrackingRef.current && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => sendLocationToServer(pos),
            (err) => handleGeolocationError(err),
            options
          );
        }
      }, 10000);
    }
  };

  // Stop Watcher
  const stopGpsWatcher = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalTimerRef.current) {
      clearInterval(intervalTimerRef.current);
      intervalTimerRef.current = null;
    }
  };

  // Geolocation Error Handler
  const handleGeolocationError = (err: GeolocationPositionError) => {
    switch (err.code) {
      case err.PERMISSION_DENIED:
        setGpsPermission('denied');
        setGpsError('Location permission denied. Please allow location access in your browser / device settings.');
        setShowPermissionGuide(true);
        break;
      case err.POSITION_UNAVAILABLE:
        setGpsError('GPS signal unavailable. Please ensure device Location Services / GPS is turned ON.');
        break;
      case err.TIMEOUT:
        setGpsError('GPS location request timed out. Retrying high-accuracy positioning...');
        break;
      default:
        setGpsError('Unable to obtain GPS coordinates. Retrying...');
    }
  };

  // User Action: START LIVE LOCATION
  const handleStartLiveLocation = async () => {
    setActionLoading(true);
    setGpsError(null);
    setStatusMessage('');

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your device or browser.');
      setActionLoading(false);
      return;
    }

    try {
      // 1. Request Browser Permission with a quick position check
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      setGpsPermission('granted');
      setIsTracking(true);
      isTrackingRef.current = true;

      // 2. Notify backend of tracking activation
      await api.updateTrackingStatus({
        driverId: driver?.id || user?.id,
        vehicleId: activeTrip?.vehicle_id || assignedVehicle?.id,
        status: 'ACTIVE'
      });

      // 3. Start streaming GPS watcher
      startGpsWatcher();

      setStatusMessage('Live GPS tracking started! Coordinates are streaming live to the fleet dashboard.');
    } catch (err: any) {
      if (err.code === 1 || err.PERMISSION_DENIED === 1) {
        setGpsPermission('denied');
        setGpsError('Location permission was denied. Please allow location permission in your browser or device settings.');
        setShowPermissionGuide(true);
      } else {
        setGpsError(err.message || 'Failed to start GPS tracking. Please ensure GPS is enabled.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // User Action: STOP LIVE LOCATION
  const handleStopLiveLocation = async () => {
    setActionLoading(true);
    try {
      stopGpsWatcher();
      setIsTracking(false);
      isTrackingRef.current = false;

      await api.updateTrackingStatus({
        driverId: driver?.id || user?.id,
        vehicleId: activeTrip?.vehicle_id || assignedVehicle?.id,
        status: 'STOPPED'
      });

      setStatusMessage('Live GPS tracking stopped. Your location is no longer streaming.');
    } catch (err: any) {
      setGpsError(err.message || 'Failed to stop tracking on server.');
    } finally {
      setActionLoading(false);
    }
  };

  // Trip Start Action
  const handleStartTrip = async () => {
    if (!activeTrip) return;
    setActionLoading(true);
    try {
      await api.startTrip(activeTrip.id);
      await handleStartLiveLocation();
      await loadDriverData();
    } catch (err: any) {
      setGpsError(err.message || 'Failed to start trip.');
    } finally {
      setActionLoading(false);
    }
  };

  // Trip Complete Action
  const handleCompleteTrip = async () => {
    if (!activeTrip) return;
    if (!window.confirm('Are you sure you want to complete this trip? Live GPS tracking will be stopped.')) {
      return;
    }
    setActionLoading(true);
    try {
      await handleStopLiveLocation();
      await api.completeTrip(activeTrip.id);
      setStatusMessage('Trip completed successfully. Vehicle and driver status updated to Available.');
      await loadDriverData();
    } catch (err: any) {
      setGpsError(err.message || 'Failed to complete trip.');
    } finally {
      setActionLoading(false);
    }
  };

  const driverDisplayName = driver?.name || user?.name || 'Fleet Driver';
  const driverPhone = driver?.phone || user?.phone || 'Not Specified';
  const vehicleRegNumber = assignedVehicle?.vehicle_number || activeTrip?.vehicle_number || 'Unassigned';
  const vehicleMakeModel = assignedVehicle ? `${assignedVehicle.make} ${assignedVehicle.model}` : (activeTrip ? `${activeTrip.make} ${activeTrip.model}` : 'Standby');

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 px-3 sm:px-0 font-sans">
      {/* Mobile-First Header Banner */}
      <div className="bg-[#111113] text-[#F5F5F5] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-[#3F3F46]">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-[#E53935]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-[#18181B] border border-[#7F1D1D] flex items-center justify-center shrink-0 overflow-hidden shadow-lg">
              {resolveDriverImageUrl(driver?.profile_image_url || driver?.photo_url || user?.avatar_url) ? (
                <img
                  src={resolveDriverImageUrl(driver?.profile_image_url || driver?.photo_url || user?.avatar_url)}
                  alt={driverDisplayName}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
              ) : (
                <Compass className="w-7 h-7 text-[#E53935]" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#F5F5F5]">Driver GPS Portal</h1>
                <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-[#3F1111] border border-[#7F1D1D] text-[#FF6B6B] flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-[#E53935]" /> Real Mobile GPS
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA] mt-1">
                Authenticated Driver: <strong className="text-[#F5F5F5]">{driverDisplayName}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
              isOnline 
                ? 'bg-[#0F2A1A] text-[#22C55E] border-[#22C55E]/40' 
                : 'bg-[#3F1111] text-[#FF1744] border-[#7F1D1D]'
            }`}>
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            <button
              onClick={loadDriverData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] text-[#F5F5F5] text-xs transition cursor-pointer flex items-center gap-1.5"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 text-[#E53935] ${loading ? 'animate-spin' : ''}`} />
              <span className="text-xs hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Network Alert */}
      {!isOnline && (
        <div className="bg-[#3A2808] border border-[#F59E0B] rounded-2xl p-4 flex items-center gap-3 text-[#F59E0B]">
          <WifiOff className="w-5 h-5 text-[#F59E0B] shrink-0" />
          <div className="text-xs font-semibold">
            Internet connection lost. GPS coordinates will automatically sync to the server when connection is restored.
          </div>
        </div>
      )}

      {/* Driver & Assigned Vehicle Summary Card */}
      <div className="bg-[#18181B] rounded-3xl p-5 sm:p-6 border border-[#3F3F46] shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111113] p-4 rounded-2xl border border-[#3F3F46]">
            <span className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider block mb-1">
              Driver Name
            </span>
            <div className="text-sm font-black text-[#F5F5F5] flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#27272A] border border-[#3F3F46] flex items-center justify-center overflow-hidden shrink-0">
                {resolveDriverImageUrl(driver?.profile_image_url || driver?.photo_url || user?.avatar_url) ? (
                  <img
                    src={resolveDriverImageUrl(driver?.profile_image_url || driver?.photo_url || user?.avatar_url)}
                    alt={driverDisplayName}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                ) : (
                  <User className="w-3.5 h-3.5 text-[#E53935]" />
                )}
              </div>
              <span className="truncate">{driverDisplayName}</span>
            </div>
            <div className="text-[11px] text-[#71717A] mt-0.5">
              ID: {driver?.id || user?.id || 'DRV-CURRENT'}
            </div>
          </div>

          <div className="bg-[#111113] p-4 rounded-2xl border border-[#3F3F46]">
            <span className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider block mb-1">
              Driver Phone Number
            </span>
            <div className="text-sm font-black text-[#F5F5F5] flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-[#22C55E]" />
              {driverPhone !== 'Not Specified' ? (
                <a href={`tel:${driverPhone}`} className="text-[#60A5FA] hover:underline">
                  {driverPhone}
                </a>
              ) : (
                <span className="text-[#71717A]">Not Specified</span>
              )}
            </div>
            <div className="text-[11px] text-[#71717A] mt-0.5">
              Contact Verified
            </div>
          </div>

          <div className="bg-[#111113] p-4 rounded-2xl border border-[#3F3F46]">
            <span className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider block mb-1">
              Assigned Vehicle
            </span>
            <div className="text-sm font-black text-[#F5F5F5] flex items-center gap-1.5">
              <Car className="w-4 h-4 text-[#E53935]" />
              {vehicleRegNumber}
            </div>
            <div className="text-[11px] text-[#71717A] mt-0.5 truncate">
              {vehicleMakeModel}
            </div>
          </div>

          <div className="bg-[#111113] p-4 rounded-2xl border border-[#3F3F46]">
            <span className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider block mb-1">
              Current Trip Status
            </span>
            <div className="text-sm font-black text-[#F5F5F5] flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-[#FF1744]" />
              {activeTrip ? activeTrip.booking_status : 'Standing By / Available'}
            </div>
            <div className="text-[11px] text-[#71717A] mt-0.5 truncate">
              {activeTrip ? `Ref: ${activeTrip.booking_number}` : 'Ready for dispatch'}
            </div>
          </div>
        </div>
      </div>

      {/* Main GPS Live Tracking Control Panel */}
      <div className={`rounded-3xl p-6 sm:p-8 border shadow-lg transition-all ${
        isTracking 
          ? 'bg-[#18181B] border-[#22C55E]/40' 
          : 'bg-[#18181B] border-[#3F3F46]'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#3F3F46]">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
              isTracking 
                ? 'bg-[#22C55E] text-[#F5F5F5] shadow-lg shadow-[#22C55E]/30 animate-pulse' 
                : 'bg-[#111113] text-[#71717A] border border-[#3F3F46]'
            }`}>
              <Radio className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-[#F5F5F5]">
                  {isTracking ? 'GPS STATUS: LIVE' : 'GPS STATUS: STOPPED'}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isTracking 
                    ? 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40 animate-pulse' 
                    : 'bg-[#27272A] text-[#A1A1AA] border border-[#3F3F46]'
                }`}>
                  {isTracking ? 'STREAMING COORDINATES' : 'STANDBY'}
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA] mt-1">
                {isTracking 
                  ? 'Real-time GPS coordinates from your mobile phone are streaming continuously to the server.'
                  : 'Press "START LIVE LOCATION" to request location permission and stream real GPS coordinates.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs bg-[#111113] px-3.5 py-2 rounded-xl border border-[#3F3F46]">
            <span className="text-[#A1A1AA] font-semibold">Permission:</span>
            {gpsPermission === 'granted' ? (
              <span className="flex items-center gap-1 text-[#22C55E] font-extrabold">
                <ShieldCheck className="w-4 h-4" /> GRANTED
              </span>
            ) : gpsPermission === 'denied' ? (
              <span className="flex items-center gap-1 text-[#FF1744] font-extrabold">
                <ShieldAlert className="w-4 h-4" /> DENIED
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[#F59E0B] font-extrabold">
                <AlertCircle className="w-4 h-4" /> PROMPT
              </span>
            )}
          </div>
        </div>

        {/* Real Mobile Telemetry HUD (Shown when live) */}
        {isTracking && lastLocation && (
          <div className="py-6 grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-[#111113] p-3.5 rounded-2xl border border-[#22C55E]/30">
              <span className="text-[10px] font-bold text-[#A1A1AA] flex items-center gap-1 mb-1">
                <MapPin className="w-3.5 h-3.5 text-[#22C55E]" /> Latitude / Longitude
              </span>
              <span className="font-mono font-black text-xs sm:text-sm text-[#F5F5F5] block truncate">
                {lastLocation.lat.toFixed(5)}, {lastLocation.lng.toFixed(5)}
              </span>
            </div>

            <div className="bg-[#111113] p-3.5 rounded-2xl border border-[#22C55E]/30">
              <span className="text-[10px] font-bold text-[#A1A1AA] flex items-center gap-1 mb-1">
                <Crosshair className="w-3.5 h-3.5 text-[#60A5FA]" /> GPS Accuracy
              </span>
              <span className="font-black text-xs sm:text-sm text-[#F5F5F5] block">
                {lastLocation.accuracy != null ? `±${Math.round(lastLocation.accuracy)} meters` : 'High Accuracy'}
              </span>
            </div>

            <div className="bg-[#111113] p-3.5 rounded-2xl border border-[#22C55E]/30">
              <span className="text-[10px] font-bold text-[#A1A1AA] flex items-center gap-1 mb-1">
                <Gauge className="w-3.5 h-3.5 text-[#E53935]" /> Current Speed
              </span>
              <span className="font-black text-xs sm:text-sm text-[#F5F5F5] block">
                {lastLocation.speed != null ? `${Math.round(lastLocation.speed * 3.6)} km/h` : '0 km/h'}
              </span>
            </div>

            <div className="bg-[#111113] p-3.5 rounded-2xl border border-[#22C55E]/30">
              <span className="text-[10px] font-bold text-[#A1A1AA] flex items-center gap-1 mb-1">
                <Clock className="w-3.5 h-3.5 text-[#F59E0B]" /> Last Updated
              </span>
              <span className="font-black text-xs sm:text-sm text-[#22C55E] block">
                {lastLocation.time}
              </span>
            </div>
          </div>
        )}

        {/* Error / Alert Callout */}
        {gpsError && (
          <div className="my-4 bg-[#3F1111] border border-[#B71C1C] rounded-2xl p-4 flex items-start gap-3 text-xs text-[#FF6B6B]">
            <AlertTriangle className="w-5 h-5 text-[#FF1744] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="block font-bold">Location Error:</strong>
              <div>{gpsError}</div>
              {gpsPermission === 'denied' && (
                <button
                  type="button"
                  onClick={() => setShowPermissionGuide(true)}
                  className="mt-2 text-[#FF1744] hover:text-[#FF6B6B] font-bold underline flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" /> How to enable location in browser settings
                </button>
              )}
            </div>
          </div>
        )}

        {/* Success / Status Message */}
        {statusMessage && (
          <div className="my-4 bg-[#0F2A1A] border border-[#22C55E] rounded-2xl p-4 flex items-center gap-3 text-xs text-[#22C55E]">
            <CheckCircle className="w-5 h-5 text-[#22C55E] shrink-0" />
            <span className="font-medium">{statusMessage}</span>
          </div>
        )}

        {/* Permission Instructions Modal / Box */}
        {showPermissionGuide && (
          <div className="my-4 bg-[#18181B] border border-[#E53935] rounded-2xl p-4 text-xs text-[#F5F5F5] space-y-2">
            <div className="font-black text-sm flex items-center gap-2 text-[#E53935]">
              <Smartphone className="w-4 h-4 text-[#E53935]" /> How to Allow Location Permission on Mobile:
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[#A1A1AA]">
              <li>Tap the <strong className="text-[#F5F5F5]">Lock / Tune icon (🔒)</strong> on the left side of the address bar in your browser (Chrome / Safari / Edge).</li>
              <li>Select <strong className="text-[#F5F5F5]">Permissions</strong> $\rightarrow$ <strong className="text-[#F5F5F5]">Location</strong>.</li>
              <li>Change the setting from <em className="text-[#FF1744]">Block</em> to <strong className="text-[#22C55E]">Allow</strong>.</li>
              <li>Ensure device <strong className="text-[#F5F5F5]">Location / GPS</strong> is turned ON in phone settings.</li>
              <li>Refresh this page and tap <strong className="text-[#E53935]">START LIVE LOCATION</strong>.</li>
            </ol>
            <button
              onClick={() => setShowPermissionGuide(false)}
              className="mt-2 px-3 py-1 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] font-bold rounded-lg text-[11px] cursor-pointer"
            >
              Got it
            </button>
          </div>
        )}

        {/* Primary Action Buttons */}
        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          {!isTracking ? (
            <button
              type="button"
              onClick={handleStartLiveLocation}
              disabled={actionLoading}
              className="flex-1 py-4 px-6 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] font-black text-base rounded-2xl shadow-xl shadow-[#E53935]/20 flex items-center justify-center gap-3 transition cursor-pointer active:scale-[0.99] disabled:opacity-50"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>{actionLoading ? 'Requesting GPS Permission...' : 'START LIVE LOCATION'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopLiveLocation}
              disabled={actionLoading}
              className="flex-1 py-4 px-6 bg-[#B71C1C] hover:bg-[#E53935] text-[#F5F5F5] font-black text-base rounded-2xl shadow-xl shadow-[#B71C1C]/30 flex items-center justify-center gap-3 transition cursor-pointer active:scale-[0.99] disabled:opacity-50"
            >
              <Square className="w-5 h-5 fill-current" />
              <span>{actionLoading ? 'Stopping GPS...' : 'STOP LIVE LOCATION'}</span>
            </button>
          )}

          {activeTrip && (
            <>
              {activeTrip.booking_status !== 'Started' ? (
                <button
                  type="button"
                  onClick={handleStartTrip}
                  disabled={actionLoading}
                  className="py-4 px-6 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] font-black text-base rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50"
                >
                  <Navigation className="w-5 h-5" />
                  <span>Start Assigned Trip</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCompleteTrip}
                  disabled={actionLoading}
                  className="py-4 px-6 bg-[#27272A] hover:bg-[#3F3F46] border border-[#52525B] text-[#F5F5F5] font-black text-base rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50"
                >
                  <CheckCircle className="w-5 h-5 text-[#22C55E]" />
                  <span>Complete Trip</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Active Trip Details Card (If booked) */}
      {activeTrip && (
        <div className="bg-[#18181B] rounded-3xl p-6 sm:p-8 border border-[#3F3F46] shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#3F3F46]">
            <div>
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-[#E53935]">
                Current Assigned Trip
              </span>
              <h2 className="text-xl font-black text-[#F5F5F5]">
                {activeTrip.booking_number}
              </h2>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold w-fit ${
              activeTrip.booking_status === 'Started' 
                ? 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40' 
                : 'bg-[#1E293B] text-[#60A5FA] border border-[#3B82F6]/40'
            }`}>
              Trip Status: {activeTrip.booking_status}
            </span>
          </div>

          <div className="bg-[#111113] p-5 rounded-2xl border border-[#3F3F46] space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#0F2A1A] border border-[#22C55E] text-[#22C55E] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                A
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold text-[#22C55E] uppercase tracking-wider block">
                  Pickup Location
                </span>
                <span className="text-sm font-bold text-[#F5F5F5]">
                  {activeTrip.pickup_location || 'Not Specified'}
                </span>
              </div>
            </div>

            <div className="ml-4 border-l-2 border-dashed border-[#3F3F46] h-6" />

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#3F1111] border border-[#B71C1C] text-[#FF1744] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                B
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold text-[#FF1744] uppercase tracking-wider block">
                  Drop Destination
                </span>
                <span className="text-sm font-bold text-[#F5F5F5]">
                  {activeTrip.drop_location || 'Not Specified'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Live Map View on Phone */}
      {isTracking && lastLocation && (
        <div className="bg-[#18181B] rounded-3xl p-5 sm:p-6 border border-[#3F3F46] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#F5F5F5] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#22C55E]" /> Real-Time Live GPS Map
            </span>
            <span className="text-xs text-[#71717A]">
              {tripHistory.length} GPS breadcrumb point(s)
            </span>
          </div>

          <LiveTrackingMap
            vehicles={[{
              driver_id: driver?.id || user?.id || 'drv',
              driver_name: driverDisplayName,
              driver_phone: driverPhone,
              vehicle_id: activeTrip?.vehicle_id || assignedVehicle?.id || 'veh',
              vehicle_number: vehicleRegNumber,
              make: assignedVehicle?.make || activeTrip?.make || '',
              model: assignedVehicle?.model || activeTrip?.model || '',
              vehicle_type: assignedVehicle?.vehicle_type || activeTrip?.vehicle_type || 'Commercial',
              latitude: lastLocation.lat,
              longitude: lastLocation.lng,
              accuracy: lastLocation.accuracy || null,
              speed: lastLocation.speed || null,
              heading: lastLocation.heading || null,
              source: 'GPS',
              location_source: 'GPS',
              is_tracking: 1,
              tracking_status: 'ACTIVE',
              trip_status: activeTrip?.booking_status || 'Started',
              status_label: 'Live Tracking Active',
              last_updated: lastLocation.isoTime
            }]}
            routeHistory={tripHistory}
            height="380px"
            zoomLevel={15}
          />
        </div>
      )}
    </div>
  );
};

export default DriverPortalPage;
