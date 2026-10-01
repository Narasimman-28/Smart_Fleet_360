import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { DriverLocationStatus, TripLocation } from '../types';
import { resolveDriverImageUrl } from '../utils/imageUrl';

interface LiveTrackingMapProps {
  vehicles: DriverLocationStatus[];
  selectedVehicleId?: string | null;
  onSelectVehicle?: (vehicle: DriverLocationStatus) => void;
  routeHistory?: TripLocation[];
  pickupLocation?: string;
  dropLocation?: string;
  height?: string;
  zoomLevel?: number;
}

export const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  routeHistory = [],
  pickupLocation,
  dropLocation,
  height = '500px',
  zoomLevel = 13
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default center: India / Tamil Nadu or first vehicle location
      const initialCenter: [number, number] = vehicles.length > 0 && vehicles[0].latitude && vehicles[0].longitude
        ? [vehicles[0].latitude, vehicles[0].longitude]
        : [11.0168, 76.9558]; // Coimbatore / Tamil Nadu default coordinates

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: zoomLevel,
        zoomControl: true,
        attributionControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers & Route
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    const bounds = L.latLngBounds([]);

    // 1. Plot Travelled Route History if available
    if (routeHistory && routeHistory.length > 0) {
      const latLngs: [number, number][] = routeHistory
        .filter(p => p.latitude != null && p.longitude != null)
        .map(p => [p.latitude, p.longitude]);

      if (latLngs.length > 0) {
        latLngs.forEach(ll => bounds.extend(ll));

        // Draw Outer Glow / Background Line
        L.polyline(latLngs, {
          color: '#7F1D1D',
          weight: 6,
          opacity: 0.5,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(markersLayer);

        // Draw Main Vibrant Polyline
        routePolylineRef.current = L.polyline(latLngs, {
          color: '#E53935',
          weight: 4,
          opacity: 0.9,
          dashArray: '8, 8',
          lineCap: 'round'
        }).addTo(markersLayer);

        // Start Point Marker (First location)
        const startPoint = latLngs[0];
        const startIcon = L.divIcon({
          className: 'custom-start-marker',
          html: `
            <div style="background-color: #22C55E; color: #09090B; width: 26px; height: 26px; border-radius: 50%; border: 3px solid #18181B; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800;">
              S
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        L.marker(startPoint, { icon: startIcon })
          .addTo(markersLayer)
          .bindPopup(`
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; background: #18181B; color: #F5F5F5; padding: 4px; border-radius: 8px;">
              <strong style="color: #22C55E;">Trip Starting Point</strong><br/>
              ${pickupLocation ? `<span style="color: #A1A1AA;">Pickup: <b style="color: #F5F5F5;">${pickupLocation}</b></span><br/>` : ''}
              ${dropLocation ? `<span style="color: #A1A1AA;">Drop: <b style="color: #F5F5F5;">${dropLocation}</b></span><br/>` : ''}
              <span style="color: #71717A; font-size: 10px;">Time: ${new Date(routeHistory[0].recorded_at).toLocaleTimeString()}</span>
            </div>
          `);
      }
    }

    // 2. Plot Active Vehicles
    vehicles.forEach(vehicle => {
      if (!vehicle.latitude || !vehicle.longitude) return;

      const latLng: [number, number] = [vehicle.latitude, vehicle.longitude];
      bounds.extend(latLng);

      const isSelected = selectedVehicleId === vehicle.vehicle_id;
      const isDelayed = vehicle.is_signal_delayed;
      const statusColor = isDelayed ? '#F59E0B' : vehicle.is_tracking ? '#22C55E' : '#71717A';

      // Custom HTML Marker with radar pulse
      const markerHtml = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          ${vehicle.is_tracking && !isDelayed ? `
            <div style="position: absolute; top: 0; width: 44px; height: 44px; border-radius: 50%; background: rgba(229, 57, 53, 0.35); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; z-index: 1;"></div>
          ` : ''}
          <div style="
            position: relative;
            z-index: 2;
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: ${isSelected ? '#E53935' : '#18181B'};
            border: 3px solid ${statusColor};
            color: #F5F5F5;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.6);
            transform: scale(${isSelected ? '1.2' : '1.0'});
            transition: all 0.2s ease;
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/>
              <path d="M9 17h6"/>
              <circle cx="17" cy="17" r="2"/>
            </svg>
          </div>
          <div style="
            margin-top: 4px;
            background: rgba(17, 17, 19, 0.95);
            color: #F5F5F5;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            white-space: nowrap;
            letter-spacing: 0.5px;
            border: 1px solid #3F3F46;
            box-shadow: 0 2px 4px rgba(0,0,0,0.5);
          ">
            ${vehicle.vehicle_number || 'Vehicle'}
          </div>
        </div>
      `;

      const vehicleIcon = L.divIcon({
        className: 'custom-vehicle-marker',
        html: markerHtml,
        iconSize: [44, 58],
        iconAnchor: [22, 29]
      });

      const marker = L.marker(latLng, { icon: vehicleIcon }).addTo(markersLayer);

      const isLiveGps = vehicle.is_tracking === 1 && (vehicle.source === 'GPS' || vehicle.location_source === 'GPS') && !isDelayed;
      const cleanPhone = (vehicle.driver_phone || '').trim();
      const updatedTimeStr = vehicle.last_updated ? new Date(vehicle.last_updated).toLocaleTimeString() : 'Just now';
      const driverPhoto = resolveDriverImageUrl(vehicle.driver_photo_url || (vehicle as any).driver_profile_image_url || (vehicle as any).profile_image_url || (vehicle as any).photo_url);

      const popupContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; width: 230px; padding: 6px; background: #18181B; color: #F5F5F5; border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #3F3F46; padding-bottom: 8px; margin-bottom: 8px;">
            ${driverPhoto ? `
              <img src="${driverPhoto}" style="width: 38px; height: 38px; border-radius: 10px; object-fit: cover; border: 2px solid #E53935; flex-shrink: 0;" onerror="this.style.display='none'"/>
            ` : `
              <div style="width: 38px; height: 38px; border-radius: 10px; background: #7F1D1D; color: #F5F5F5; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; flex-shrink: 0; border: 1px solid #B71C1C;">
                ${(vehicle.driver_name || 'D').charAt(0).toUpperCase()}
              </div>
            `}
            <div style="min-width: 0;">
              <div style="font-weight: 800; font-size: 13px; color: #F5F5F5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${vehicle.driver_name || 'Driver'}</div>
              ${cleanPhone ? `<div style="font-size: 11px; color: #FF1744; font-weight: 600;">📞 ${cleanPhone}</div>` : ''}
            </div>
          </div>

          <div style="font-size: 11px; line-height: 1.6; margin-bottom: 6px;">
            <div><span style="color: #A1A1AA;">Vehicle:</span> <b style="font-family: monospace; color: #F5F5F5;">${vehicle.vehicle_number || 'Unassigned'}</b></div>
            <div><span style="color: #A1A1AA;">GPS:</span> <b style="color: ${isLiveGps ? '#22C55E' : isDelayed ? '#F59E0B' : '#71717A'};">${isLiveGps ? 'LIVE' : isDelayed ? 'STALE' : 'OFFLINE'}</b></div>
            ${vehicle.location_name ? `<div><span style="color: #A1A1AA;">Location:</span> <b style="color: #F5F5F5;">${vehicle.location_name}</b></div>` : ''}
            <div><span style="color: #A1A1AA;">Speed:</span> <b style="color: #F5F5F5;">${vehicle.speed != null ? `${Math.round(vehicle.speed * 3.6)} km/h` : '0 km/h'}</b></div>
            <div><span style="color: #A1A1AA;">Accuracy:</span> <b style="color: #F5F5F5;">${vehicle.accuracy != null ? `${Math.round(vehicle.accuracy)} m` : '8 m'}</b></div>
            <div><span style="color: #A1A1AA;">Last Updated:</span> <b style="color: #E53935;">${updatedTimeStr}</b></div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('click', () => {
        if (onSelectVehicle) {
          onSelectVehicle(vehicle);
        }
      });

      if (isSelected) {
        marker.openPopup();
      }
    });

    // Fit map bounds if points exist
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [vehicles, selectedVehicleId, routeHistory]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-[#3F3F46] shadow-md bg-[#09090B]">
      <div
        ref={mapContainerRef}
        style={{ height, width: '100%' }}
        className="z-0 bg-[#09090B]"
      />
      {vehicles.length === 0 && (!routeHistory || routeHistory.length === 0) && (
        <div className="absolute inset-0 bg-[#09090B]/80 backdrop-blur-xs flex flex-col items-center justify-center text-[#F5F5F5] pointer-events-none p-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#18181B] border border-[#3F3F46] flex items-center justify-center mb-2 shadow-md">
            <svg className="w-6 h-6 text-[#E53935]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-xs font-bold text-[#F5F5F5]">No Active GPS Coordinates</p>
          <p className="text-[11px] text-[#A1A1AA] max-w-xs mt-0.5">
            Driver coordinates will stream live here once a driver starts an active trip from the Driver Portal.
          </p>
        </div>
      )}
    </div>
  );
};
