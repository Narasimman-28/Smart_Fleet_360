import React, { useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  Navigation, 
  Loader2, 
  AlertCircle,
  User
} from 'lucide-react';
import { api } from '../services/api';
import { DriverContactActions } from './DriverContactActions';
import type { TripLocation, Driver } from '../types';

interface LocationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  driverId?: string;
  bookingId?: string;
}

export const LocationHistoryModal: React.FC<LocationHistoryModalProps> = ({
  isOpen,
  onClose,
  driverId,
  bookingId
}) => {
  const [locations, setLocations] = useState<TripLocation[]>([]);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && (driverId || bookingId)) {
      setLoading(true);
      setError(null);

      if (bookingId) {
        api.getTrackingHistory(bookingId)
          .then(res => {
            setLocations(res.locations || []);
            setBooking(res.booking || null);
          })
          .catch(err => setError(err.message || 'Failed to load trip location history'))
          .finally(() => setLoading(false));
      } else if (driverId) {
        api.getDriverLocationHistory(driverId)
          .then(res => {
            setLocations(res.locations || []);
            setDriver(res.driver || null);
          })
          .catch(err => setError(err.message || 'Failed to load driver location history'))
          .finally(() => setLoading(false));
      }
    }
  }, [isOpen, driverId, bookingId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div 
        className="bg-[#18181B] w-full max-w-3xl rounded-2xl shadow-2xl border border-[#3F3F46] overflow-hidden my-6 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#111113] text-[#F5F5F5] p-5 flex items-center justify-between border-b border-[#3F3F46]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3F1111] border border-[#7F1D1D] flex items-center justify-center">
              <Navigation className="w-5 h-5 text-[#E53935]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-[#F5F5F5]">Location History & Breadcrumb Trail</h2>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-[#3F1111] text-[#FF6B6B] border border-[#7F1D1D]">
                  {locations.length} Points
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA] mt-0.5">
                {driver ? (
                  <span>Driver: <strong className="text-[#F5F5F5]">{driver.name}</strong> {driver.phone ? `(${driver.phone})` : ''}</span>
                ) : booking ? (
                  <span>Trip: <strong className="text-[#F5F5F5]">{booking.booking_number}</strong> — {booking.vehicle_number}</span>
                ) : 'Chronological GPS and Manual coordinates'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#202024] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contact Banner if driver available */}
        {driver && (
          <div className="px-5 py-3 bg-[#111113] border-b border-[#3F3F46] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs">
              <User className="w-4 h-4 text-[#E53935]" />
              <span className="font-bold text-[#F5F5F5]">{driver.name}</span>
              <span className="text-[#71717A]">•</span>
              <span className="text-[#A1A1AA]">{driver.status}</span>
            </div>
            {driver.phone && (
              <DriverContactActions phone={driver.phone} driverName={driver.name} size="sm" />
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 bg-[#18181B]">
          {error && (
            <div className="p-3 bg-[#3F1111] border border-[#B71C1C] rounded-xl text-xs text-[#FF6B6B] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#FF1744]" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-[#A1A1AA]">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-[#E53935]" />
              <span className="text-xs font-semibold">Loading location history trail...</span>
            </div>
          ) : locations.length === 0 ? (
            <div className="py-16 text-center text-[#71717A]">
              <MapPin className="w-10 h-10 mx-auto mb-2 text-[#3F3F46]" />
              <p className="text-xs font-bold text-[#D4D4D8]">No location updates recorded yet</p>
              <p className="text-[11px] text-[#71717A] mt-1">Location points will appear here once the driver starts streaming GPS or manual updates are entered.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-xl border border-[#3F3F46]">
                <table className="w-full text-left text-xs border-collapse bg-[#18181B]">
                  <thead>
                    <tr className="bg-[#27272A] border-b border-[#3F3F46] text-[#F5F5F5] font-bold">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Location / Landmark</th>
                      <th className="py-2.5 px-3">Coordinates</th>
                      <th className="py-2.5 px-3">Speed</th>
                      <th className="py-2.5 px-3">Source</th>
                      <th className="py-2.5 px-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3F3F46] font-medium text-[#D4D4D8]">
                    {locations.map((loc, idx) => {
                      const isGps = (loc.source || 'GPS') === 'GPS';
                      return (
                        <tr key={loc.id || idx} className="hover:bg-[#202024] transition">
                          <td className="py-2.5 px-3 font-mono text-[#71717A]">{locations.length - idx}</td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-bold text-[#F5F5F5]">
                              {new Date(loc.recorded_at).toLocaleTimeString()}
                            </div>
                            <div className="text-[10px] text-[#71717A]">
                              {new Date(loc.recorded_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-[#F5F5F5]">
                              {loc.location_name || 'Checkpoint Location'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-[#60A5FA]">
                            {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                            {loc.accuracy != null && (
                              <span className="text-[9px] text-[#71717A] ml-1">(±{Math.round(loc.accuracy)}m)</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {loc.speed != null ? (
                              <span className="font-bold text-[#F5F5F5]">
                                {Math.round(loc.speed * 3.6)} km/h
                              </span>
                            ) : (
                              <span className="text-[#71717A]">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isGps 
                                ? 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40' 
                                : 'bg-[#1E293B] text-[#60A5FA] border border-[#3B82F6]/40'
                            }`}>
                              {loc.source || 'GPS'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[#A1A1AA] text-[11px] max-w-[200px] truncate">
                            {loc.notes || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#111113] border-t border-[#3F3F46] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] border border-[#52525B] rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationHistoryModal;
