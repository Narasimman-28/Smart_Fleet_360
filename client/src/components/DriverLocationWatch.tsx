import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Car, 
  Clock, 
  Compass, 
  RefreshCw, 
  Plus, 
  Search, 
  Map as MapIcon,
  LayoutGrid,
  List,
  Smartphone
} from 'lucide-react';
import { api } from '../services/api';
import { LiveTrackingMap } from './LiveTrackingMap';
import { DriverContactActions } from './DriverContactActions';
import { ManualLocationModal } from './ManualLocationModal';
import { LocationHistoryModal } from './LocationHistoryModal';
import { ConnectMobileGpsModal } from './ConnectMobileGpsModal';
import { resolveVehicleImageUrl, resolveDriverImageUrl } from '../utils/imageUrl';
import type { DriverLocationStatus } from '../types';

interface DriverLocationWatchProps {
  onNavigate?: (path: string) => void;
}

export const DriverLocationWatch: React.FC<DriverLocationWatchProps> = ({ onNavigate }) => {
  const [trackedDrivers, setTrackedDrivers] = useState<DriverLocationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'map' | 'cards' | 'table'>('map');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const handleNavigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new Event('popstate'));
    }
  };

  // Modals state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isConnectGpsOpen, setIsConnectGpsOpen] = useState(false);
  const [connectGpsDriver, setConnectGpsDriver] = useState<any | null>(null);
  const [targetDriverId, setTargetDriverId] = useState<string | undefined>(undefined);
  const [targetVehicleId, setTargetVehicleId] = useState<string | undefined>(undefined);

  const handleOpenConnectGps = (driverItem: DriverLocationStatus) => {
    setConnectGpsDriver({
      id: driverItem.driver_id,
      name: driverItem.driver_name || 'Fleet Driver',
      phone: driverItem.driver_phone || '',
      assigned_vehicle_number: driverItem.vehicle_number,
      tracking_status: driverItem.tracking_status
    });
    setIsConnectGpsOpen(true);
  };

  const fetchLiveTracking = async () => {
    try {
      setLoading(true);
      const data = await api.getLiveTracking();
      setTrackedDrivers(data || []);
      if (data && data.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(data[0].vehicle_id || null);
      }
    } catch (err) {
      console.error('Failed to load live driver tracking', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveTracking();

    // 1. WebSocket Live Stream for instant zero-latency marker updates with auto-reconnect
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let isSubscribed = true;

    const connectWebSocket = () => {
      if (!isSubscribed) return;
      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.host;
        socket = new WebSocket(`${wsProtocol}//${wsHost}/api/driver-tracking/socket`);

        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'LOCATION_UPDATE' && msg.data) {
              setTrackedDrivers(prev => {
                const updated = [...prev];
                const idx = updated.findIndex(d => d.driver_id === msg.data.driverId || d.vehicle_id === msg.data.vehicleId);
                if (idx !== -1) {
                  updated[idx] = {
                    ...updated[idx],
                    latitude: msg.data.latitude,
                    longitude: msg.data.longitude,
                    accuracy: msg.data.accuracy,
                    speed: msg.data.speed,
                    heading: msg.data.heading,
                    is_tracking: 1,
                    tracking_status: 'ACTIVE',
                    last_updated: msg.data.timestamp || new Date().toISOString(),
                    is_signal_delayed: false
                  };
                }
                return updated;
              });
            }
          } catch {
            // Ignore parse errors
          }
        };

        socket.onclose = () => {
          if (isSubscribed) {
            reconnectTimeout = setTimeout(connectWebSocket, 3000);
          }
        };

        socket.onerror = () => {
          socket?.close();
        };
      } catch {
        if (isSubscribed) {
          reconnectTimeout = setTimeout(connectWebSocket, 5000);
        }
      }
    };

    connectWebSocket();

    // 2. High-speed REST polling fallback every 5 seconds
    const intervalTimer = setInterval(() => {
      api.getLiveTracking().then(data => {
        if (data) setTrackedDrivers(data);
      }).catch(() => {});
    }, 5000);

    return () => {
      isSubscribed = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) socket.close();
      clearInterval(intervalTimer);
    };
  }, []);

  const handleOpenManualUpdate = (driverId?: string, vehicleId?: string) => {
    setTargetDriverId(driverId);
    setTargetVehicleId(vehicleId);
    setIsManualModalOpen(true);
  };

  const handleOpenHistory = (driverId?: string) => {
    setTargetDriverId(driverId);
    setIsHistoryModalOpen(true);
  };

  // Filtered drivers list
  const filteredDrivers = trackedDrivers.filter(item => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      (item.driver_name || '').toLowerCase().includes(q) ||
      (item.driver_phone || '').toLowerCase().includes(q) ||
      (item.vehicle_number || '').toLowerCase().includes(q) ||
      (item.location_name || '').toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (statusFilter === 'TRACKING') return item.is_tracking === 1 && !item.is_signal_delayed;
    if (statusFilter === 'DELAYED') return item.is_signal_delayed;
    if (statusFilter === 'ON_TRIP') return item.trip_status === 'Started' || item.driver_status === 'On Trip' || item.is_tracking === 1;
    if (statusFilter === 'AVAILABLE') return item.driver_status === 'Active' || item.trip_status === 'Available';

    return true;
  });

  const liveGpsCount = trackedDrivers.filter(d => (d.is_tracking === 1 || d.tracking_status === 'ACTIVE') && !d.is_signal_delayed && d.tracking_status !== 'TRACKING DISABLED').length;
  const onTripCount = trackedDrivers.filter(d => d.trip_status === 'Started' || d.driver_status === 'On Trip' || d.gps_status === 'ON TRIP').length;
  const availableCount = trackedDrivers.filter(d => (d.driver_status === 'Active' || d.trip_status === 'Available' || !d.trip_status) && d.trip_status !== 'Started').length;
  const offlineCount = trackedDrivers.filter(d => (d.is_tracking === 0 || d.tracking_status === 'STOPPED' || d.tracking_status === 'OFFLINE' || d.gps_status === 'OFFLINE') && !d.is_signal_delayed).length;
  const staleCount = trackedDrivers.filter(d => d.is_signal_delayed || d.is_delayed || d.gps_status === 'DELAYED').length;

  return (
    <div className="bg-[#18181B] rounded-3xl border border-[#3F3F46] shadow-xl overflow-hidden transition-all">
      {/* Header Banner */}
      <div className="p-5 sm:p-6 bg-[#111113] text-[#F5F5F5] border-b border-[#3F3F46] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#3F1111] border border-[#7F1D1D] flex items-center justify-center shrink-0">
            <Compass className="w-6 h-6 text-[#E53935] animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-[#F5F5F5]">Driver Location & Contact Watch</h2>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-ping" />
                Live Fleet Feed
              </span>
            </div>
            <p className="text-xs text-[#A1A1AA] mt-0.5">
              Real-time driver GPS coordinates, direct calling/messaging, and manual location configuration
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2.5 w-full lg:w-auto justify-start lg:justify-end">
          {/* View Mode Toggle */}
          <div className="bg-[#18181B] p-1 rounded-xl border border-[#3F3F46] flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'map' ? 'bg-[#E53935] text-[#F5F5F5] shadow-xs' : 'text-[#A1A1AA] hover:text-[#F5F5F5]'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" /> Map View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'cards' ? 'bg-[#E53935] text-[#F5F5F5] shadow-xs' : 'text-[#A1A1AA] hover:text-[#F5F5F5]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'table' ? 'bg-[#E53935] text-[#F5F5F5] shadow-xs' : 'text-[#A1A1AA] hover:text-[#F5F5F5]'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Table
            </button>
          </div>

          {/* Manual Location Entry Button */}
          <button
            type="button"
            onClick={() => handleOpenManualUpdate()}
            className="px-3.5 py-2 bg-[#E53935] hover:bg-[#FF1744] active:scale-98 text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/20 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Configure Location
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={fetchLiveTracking}
            className="p-2 rounded-xl bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] text-[#A1A1AA] hover:text-[#F5F5F5] transition cursor-pointer"
            title="Refresh location telemetry"
          >
            <RefreshCw className={`w-4 h-4 text-[#E53935] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 5 Dynamic Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 border-b border-[#3F3F46] bg-[#111113] text-xs">
        {/* 1. LIVE GPS */}
        <div 
          onClick={() => setStatusFilter('TRACKING')}
          className="p-3.5 border-r border-[#3F3F46] flex items-center gap-3 cursor-pointer hover:bg-[#18181B] transition"
        >
          <div className="w-8 h-8 rounded-lg bg-[#0F2A1A] border border-[#22C55E]/40 text-[#22C55E] flex items-center justify-center font-bold">
            {liveGpsCount}
          </div>
          <div>
            <div className="font-extrabold text-[#22C55E]">{liveGpsCount} LIVE GPS</div>
            <div className="text-[10px] text-[#71717A]">Active Real-Time Stream</div>
          </div>
        </div>

        {/* 2. ON TRIP */}
        <div 
          onClick={() => setStatusFilter('ON_TRIP')}
          className="p-3.5 border-r border-[#3F3F46] flex items-center gap-3 cursor-pointer hover:bg-[#18181B] transition"
        >
          <div className="w-8 h-8 rounded-lg bg-[#3A2808] border border-[#F59E0B]/40 text-[#F59E0B] flex items-center justify-center font-bold">
            {onTripCount}
          </div>
          <div>
            <div className="font-extrabold text-[#F59E0B]">{onTripCount} ON TRIP</div>
            <div className="text-[10px] text-[#71717A]">Active Booking Dispatches</div>
          </div>
        </div>

        {/* 3. AVAILABLE */}
        <div 
          onClick={() => setStatusFilter('AVAILABLE')}
          className="p-3.5 border-r border-[#3F3F46] flex items-center gap-3 cursor-pointer hover:bg-[#18181B] transition"
        >
          <div className="w-8 h-8 rounded-lg bg-[#1E293B] border border-[#3B82F6]/40 text-[#60A5FA] flex items-center justify-center font-bold">
            {availableCount}
          </div>
          <div>
            <div className="font-extrabold text-[#60A5FA]">{availableCount} AVAILABLE</div>
            <div className="text-[10px] text-[#71717A]">Standby for Dispatch</div>
          </div>
        </div>

        {/* 4. OFFLINE */}
        <div 
          onClick={() => setStatusFilter('OFFLINE')}
          className="p-3.5 border-r border-[#3F3F46] flex items-center gap-3 cursor-pointer hover:bg-[#18181B] transition"
        >
          <div className="w-8 h-8 rounded-lg bg-[#27272A] border border-[#3F3F46] text-[#A1A1AA] flex items-center justify-center font-bold">
            {offlineCount}
          </div>
          <div>
            <div className="font-extrabold text-[#D4D4D8]">{offlineCount} OFFLINE</div>
            <div className="text-[10px] text-[#71717A]">Tracking Disconnected</div>
          </div>
        </div>

        {/* 5. STALE */}
        <div 
          onClick={() => setStatusFilter('DELAYED')}
          className="p-3.5 flex items-center gap-3 cursor-pointer hover:bg-[#18181B] transition"
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
            staleCount > 0 ? 'bg-[#3F1111] border border-[#B71C1C] text-[#FF1744]' : 'bg-[#27272A] border border-[#3F3F46] text-[#71717A]'
          }`}>
            {staleCount}
          </div>
          <div>
            <div className={`font-extrabold ${staleCount > 0 ? 'text-[#FF1744]' : 'text-[#A1A1AA]'}`}>
              {staleCount} STALE
            </div>
            <div className="text-[10px] text-[#71717A]">Signal Delayed Warning</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 border-b border-[#3F3F46] bg-[#18181B] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search driver, phone, plate, hub..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] focus:border-[#E53935] outline-hidden"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'All Drivers' },
            { id: 'TRACKING', label: '🟢 Live GPS' },
            { id: 'ON_TRIP', label: '🚚 On Trip' },
            { id: 'AVAILABLE', label: '✅ Available' },
            { id: 'DELAYED', label: '⚠️ Delayed' }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition whitespace-nowrap cursor-pointer ${
                statusFilter === f.id
                  ? 'bg-[#E53935] text-[#F5F5F5]'
                  : 'bg-[#111113] text-[#A1A1AA] border border-[#3F3F46] hover:text-[#F5F5F5]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Render */}
      {viewMode === 'map' && (
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Interactive Leaflet Map */}
            <div className="lg:col-span-2 rounded-2xl overflow-hidden border border-[#3F3F46] shadow-sm relative min-h-[440px]">
              <LiveTrackingMap
                vehicles={filteredDrivers}
                selectedVehicleId={selectedVehicleId}
                onSelectVehicle={(veh) => setSelectedVehicleId(veh.vehicle_id || null)}
                height="440px"
              />
            </div>

            {/* Quick Driver Watch List */}
            <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#A1A1AA] flex items-center justify-between pb-1">
                <span>Active Tracked Drivers</span>
                <span>{filteredDrivers.length} units</span>
              </div>

              {filteredDrivers.length === 0 ? (
                <div className="py-12 text-center text-[#71717A] text-xs font-medium bg-[#111113] rounded-xl border border-dashed border-[#3F3F46]">
                  No matching driver tracking records found.
                </div>
              ) : (
                filteredDrivers.map(d => {
                  const isSelected = selectedVehicleId === d.vehicle_id;
                  return (
                    <div
                      key={d.driver_id}
                      onClick={() => setSelectedVehicleId(d.vehicle_id || null)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#202024] border-[#E53935] ring-2 ring-[#E53935]/20 shadow-md'
                          : 'bg-[#111113] border-[#3F3F46] hover:border-[#7F1D1D]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-[#18181B] flex items-center justify-center font-black text-xs text-[#E53935] border border-[#3F3F46] shrink-0 overflow-hidden">
                            {resolveDriverImageUrl(d.driver_photo_url || (d as any).driver_profile_image_url || (d as any).profile_image_url || (d as any).photo_url) ? (
                              <img
                                src={resolveDriverImageUrl(d.driver_photo_url || (d as any).driver_profile_image_url || (d as any).profile_image_url || (d as any).photo_url)}
                                alt={d.driver_name || 'Driver'}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                              />
                            ) : (
                              <span>{d.driver_name ? d.driver_name.charAt(0).toUpperCase() : 'D'}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-xs text-[#F5F5F5] truncate">
                              {d.driver_name}
                            </div>
                            <div className="text-[10px] text-[#A1A1AA] truncate flex items-center gap-1">
                              <Car className="w-3 h-3 text-[#E53935]" />
                              <span className="font-semibold text-[#D4D4D8]">{d.vehicle_number || 'No Vehicle'}</span>
                            </div>
                          </div>
                        </div>

                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                          d.is_signal_delayed
                            ? 'bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/40'
                            : d.is_tracking === 1
                            ? 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40'
                            : 'bg-[#27272A] text-[#A1A1AA] border border-[#3F3F46]'
                        }`}>
                          {d.status_label}
                        </span>
                      </div>

                      {/* Phone & Direct Contact */}
                      <div className="mt-2.5 pt-2 border-t border-[#3F3F46] flex items-center justify-between gap-2">
                        <DriverContactActions phone={d.driver_phone} driverName={d.driver_name} size="sm" />

                        <div className="flex items-center gap-1 text-[11px]">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleOpenHistory(d.driver_id); }}
                            className="p-1 rounded-md text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#27272A] transition cursor-pointer"
                            title="View Location History"
                          >
                            <Clock className="w-3.5 h-3.5 text-[#60A5FA]" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleOpenManualUpdate(d.driver_id, d.vehicle_id); }}
                            className="p-1 rounded-md text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#27272A] transition cursor-pointer"
                            title="Manual Location Update"
                          >
                            <MapPin className="w-3.5 h-3.5 text-[#E53935]" />
                          </button>
                        </div>
                      </div>

                      {/* Location Name & Coordinates */}
                      <div className="mt-1.5 text-[10px] text-[#71717A] flex items-center justify-between">
                        <span className="truncate max-w-[170px]" title={d.location_name || (d.latitude ? `${d.latitude.toFixed(4)}, ${d.longitude?.toFixed(4)}` : 'GPS unavailable')}>
                          📍 {d.location_name || (d.latitude ? `${d.latitude.toFixed(4)}, ${d.longitude?.toFixed(4)}` : 'GPS unavailable')}
                        </span>
                        <span className="text-[#A1A1AA] font-mono">{d.latitude ? (d.source || 'GPS') : 'No GPS'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cards Grid View */}
      {viewMode === 'cards' && (
        <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrivers.map(d => (
            <div 
              key={d.driver_id} 
              className="bg-[#18181B] rounded-2xl border border-[#3F3F46] p-4 shadow-sm hover:border-[#7F1D1D] transition space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#111113] border border-[#3F3F46] flex items-center justify-center font-black text-sm text-[#E53935] overflow-hidden shrink-0">
                    {resolveDriverImageUrl(d.driver_photo_url || (d as any).driver_profile_image_url || (d as any).profile_image_url || (d as any).photo_url) ? (
                      <img
                        src={resolveDriverImageUrl(d.driver_photo_url || (d as any).driver_profile_image_url || (d as any).profile_image_url || (d as any).photo_url)}
                        alt={d.driver_name || 'Driver'}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    ) : (
                      <span>{d.driver_name ? d.driver_name.charAt(0).toUpperCase() : 'D'}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-sm text-[#F5F5F5] truncate">{d.driver_name}</h3>
                    <div className="text-xs font-semibold text-[#A1A1AA] flex items-center gap-1.5 mt-0.5">
                      {resolveVehicleImageUrl(d.vehicle_photo_url || (d as any).vehicle_image_url) ? (
                        <div className="w-5 h-5 rounded-md overflow-hidden bg-[#09090B] border border-[#3F3F46] shrink-0">
                          <img
                            src={resolveVehicleImageUrl(d.vehicle_photo_url || (d as any).vehicle_image_url)}
                            alt={d.vehicle_number || ''}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        </div>
                      ) : (
                        <Car className="w-3.5 h-3.5 text-[#E53935]" />
                      )}
                      {d.vehicle_number ? (
                        <button 
                          onClick={() => handleNavigate(`/vehicles/${d.vehicle_id}`)} 
                          className="hover:text-[#E53935] hover:underline text-left cursor-pointer truncate max-w-[170px]"
                        >
                          {d.vehicle_number} ({d.make || ''} {d.model || ''})
                        </button>
                      ) : (
                        <span className="text-[#71717A] italic">No assigned vehicle</span>
                      )}
                    </div>
                  </div>
                </div>

                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                  d.is_signal_delayed
                    ? 'bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/40'
                    : d.is_tracking === 1
                    ? 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40'
                    : 'bg-[#27272A] text-[#A1A1AA] border border-[#3F3F46]'
                }`}>
                  {d.status_label}
                </span>
              </div>

              {/* Contact Toolbar */}
              <div className="p-2.5 bg-[#111113] rounded-xl border border-[#3F3F46] flex items-center justify-between">
                <DriverContactActions phone={d.driver_phone} driverName={d.driver_name} size="md" />
                <span className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider">{d.driver_status || 'Active'}</span>
              </div>

              {/* Location Details */}
              <div className="text-xs space-y-1 bg-[#111113] p-2.5 rounded-xl border border-[#3F3F46]">
                <div className="flex items-center justify-between text-[#D4D4D8]">
                  <span className="font-bold flex items-center gap-1 text-[#71717A]">
                    <MapPin className="w-3.5 h-3.5 text-[#FF1744]" /> Location:
                  </span>
                  <span className="font-semibold text-right max-w-[170px] truncate text-[#F5F5F5]" title={d.location_name || (d.latitude ? `${d.latitude.toFixed(4)}, ${d.longitude?.toFixed(4)}` : 'GPS unavailable')}>
                    {d.location_name || (d.latitude ? `${d.latitude.toFixed(4)}, ${d.longitude?.toFixed(4)}` : 'GPS unavailable')}
                  </span>
                </div>

                {d.latitude && d.longitude ? (
                  <div className="flex items-center justify-between font-mono text-[11px] text-[#71717A]">
                    <span>Coordinates:</span>
                    <span className="text-[#60A5FA]">{d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-[#71717A] italic">
                    <span>Coordinates:</span>
                    <span>GPS unavailable</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-[#71717A] pt-1 border-t border-[#3F3F46]">
                  <span>Source: <strong className="text-[#D4D4D8]">{d.source || 'GPS'}</strong></span>
                  <span>Updated: {d.last_updated ? new Date(d.last_updated).toLocaleTimeString() : 'Just now'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => { setSelectedVehicleId(d.vehicle_id || null); setViewMode('map'); }}
                  className="py-1.5 px-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer border border-[#3F3F46]"
                >
                  <MapIcon className="w-3 h-3 text-[#E53935]" /> Map
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenConnectGps(d)}
                  className="py-1.5 px-2 bg-[#0F2A1A] hover:bg-[#1C4D2E] text-[#22C55E] border border-[#22C55E]/40 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  title="Connect Mobile GPS QR"
                >
                  <Smartphone className="w-3 h-3 text-[#22C55E]" /> GPS QR
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenHistory(d.driver_id)}
                  className="py-1.5 px-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#60A5FA] border border-[#3F3F46] rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Clock className="w-3 h-3" /> History
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenManualUpdate(d.driver_id, d.vehicle_id)}
                  className="py-1.5 px-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#FF6B6B] border border-[#3F3F46] rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <MapPin className="w-3 h-3 text-[#E53935]" /> Update
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="p-4 sm:p-5 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse bg-[#18181B] rounded-xl overflow-hidden border border-[#3F3F46]">
            <thead>
              <tr className="bg-[#27272A] border-b border-[#3F3F46] text-[#F5F5F5] font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">Driver</th>
                <th className="py-3 px-3">Phone & Actions</th>
                <th className="py-3 px-3">Assigned Vehicle</th>
                <th className="py-3 px-3">Current Location</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Source</th>
                <th className="py-3 px-3">Last Updated</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3F3F46] font-medium text-[#D4D4D8]">
              {filteredDrivers.map(d => (
                <tr key={d.driver_id} className="hover:bg-[#202024] transition">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#111113] border border-[#3F3F46] flex items-center justify-center overflow-hidden shrink-0">
                        {resolveDriverImageUrl(d.driver_photo_url || (d as any).driver_profile_image_url || (d as any).profile_image_url || (d as any).photo_url) ? (
                          <img
                            src={resolveDriverImageUrl(d.driver_photo_url || (d as any).driver_profile_image_url || (d as any).profile_image_url || (d as any).photo_url)}
                            alt={d.driver_name || 'Driver'}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        ) : (
                          <span className="font-bold text-xs text-[#E53935]">{d.driver_name ? d.driver_name.charAt(0).toUpperCase() : 'D'}</span>
                        )}
                      </div>
                      <div>
                        <div className="font-extrabold text-[#F5F5F5]">{d.driver_name}</div>
                        <div className="text-[10px] text-[#71717A]">{d.driver_license || 'License Verified'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <DriverContactActions phone={d.driver_phone} driverName={d.driver_name} size="sm" />
                  </td>
                  <td className="py-3 px-3">
                    {d.vehicle_number ? (
                      <div>
                        <button 
                          onClick={() => handleNavigate(`/vehicles/${d.vehicle_id}`)} 
                          className="font-bold text-[#E53935] hover:underline text-left cursor-pointer"
                        >
                          {d.vehicle_number}
                        </button>
                        <div className="text-[10px] text-[#71717A]">{d.make || ''} {d.model || ''}</div>
                      </div>
                    ) : (
                      <span className="text-[#71717A] italic">Unassigned</span>
                    )}
                  </td>
                  <td className="py-3 px-3 max-w-[200px]">
                    <div className="font-bold text-[#F5F5F5] truncate" title={d.location_name || (d.latitude ? `${d.latitude.toFixed(4)}, ${d.longitude?.toFixed(4)}` : 'GPS unavailable')}>
                      {d.location_name || (d.latitude ? `${d.latitude.toFixed(4)}, ${d.longitude?.toFixed(4)}` : 'GPS unavailable')}
                    </div>
                    {d.latitude ? (
                      <div className="text-[10px] font-mono text-[#60A5FA]">
                        {d.latitude.toFixed(4)}, {d.longitude?.toFixed(4)}
                      </div>
                    ) : (
                      <div className="text-[10px] text-[#71717A] italic">
                        GPS unavailable
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                      d.is_signal_delayed
                        ? 'bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/40'
                        : d.is_tracking === 1
                        ? 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40'
                        : 'bg-[#27272A] text-[#A1A1AA] border border-[#3F3F46]'
                    }`}>
                      {d.status_label}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-[#111113] rounded-md text-[#F5F5F5] border border-[#3F3F46]">
                      {d.source || 'GPS'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[#71717A] whitespace-nowrap">
                    {d.last_updated ? new Date(d.last_updated).toLocaleTimeString() : 'Just now'}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenConnectGps(d)}
                        className="p-1.5 rounded-lg bg-[#0F2A1A] text-[#22C55E] hover:bg-[#1C4D2E] border border-[#22C55E]/40 transition cursor-pointer"
                        title="Connect Mobile GPS / QR Code"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSelectedVehicleId(d.vehicle_id || null); setViewMode('map'); }}
                        className="p-1.5 rounded-lg bg-[#27272A] text-[#60A5FA] hover:bg-[#3F3F46] border border-[#3F3F46] transition cursor-pointer"
                        title="View on Live Map"
                      >
                        <MapIcon className="w-3.5 h-3.5 text-[#60A5FA]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenHistory(d.driver_id)}
                        className="p-1.5 rounded-lg bg-[#27272A] text-[#A1A1AA] hover:bg-[#3F3F46] hover:text-[#F5F5F5] border border-[#3F3F46] transition cursor-pointer"
                        title="View Location History"
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenManualUpdate(d.driver_id, d.vehicle_id)}
                        className="p-1.5 rounded-lg bg-[#27272A] text-[#FF6B6B] hover:bg-[#3F3F46] border border-[#3F3F46] transition cursor-pointer"
                        title="Manual Location Update"
                      >
                        <MapPin className="w-3.5 h-3.5 text-[#E53935]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual Location Modal */}
      <ManualLocationModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSuccess={fetchLiveTracking}
        preselectedDriverId={targetDriverId}
        preselectedVehicleId={targetVehicleId}
      />

      {/* Location History Modal */}
      <LocationHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        driverId={targetDriverId}
      />

      {/* Connect Mobile GPS Modal */}
      <ConnectMobileGpsModal
        isOpen={isConnectGpsOpen}
        onClose={() => {
          setIsConnectGpsOpen(false);
          setConnectGpsDriver(null);
        }}
        driver={connectGpsDriver}
        onSuccess={fetchLiveTracking}
      />
    </div>
  );
};

export default DriverLocationWatch;
