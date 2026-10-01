import React, { useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  Phone, 
  Car, 
  User, 
  Calendar, 
  Clock, 
  FileText, 
  Check, 
  AlertCircle, 
  Compass,
  Loader2
} from 'lucide-react';
import { api } from '../services/api';
import type { Driver, Vehicle } from '../types';

interface ManualLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedDriverId?: string;
  preselectedVehicleId?: string;
}

const COMMON_HUBS = [
  { name: 'Coimbatore Hub (TN)', lat: 11.0168, lng: 76.9558 },
  { name: 'Chennai Port Terminal (TN)', lat: 13.0827, lng: 80.2707 },
  { name: 'Salem NH544 Logistics (TN)', lat: 11.6643, lng: 78.1460 },
  { name: 'Hosur Industrial Border (TN)', lat: 12.7409, lng: 77.8253 },
  { name: 'Madurai Ring Road Hub (TN)', lat: 9.9252, lng: 78.1198 },
  { name: 'Bengaluru Electronic City (KA)', lat: 12.8399, lng: 77.6770 },
  { name: 'Kochi Port Container Depot (KL)', lat: 9.9312, lng: 76.2673 }
];

export const ManualLocationModal: React.FC<ManualLocationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedDriverId,
  preselectedVehicleId
}) => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    driver_id: '',
    vehicle_id: '',
    phone: '',
    location_name: '',
    latitude: '',
    longitude: '',
    status: 'Available',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setLoading(true);
      Promise.all([
        api.getDrivers(),
        api.getVehicles()
      ]).then(([dList, vList]) => {
        setDrivers(dList || []);
        setVehicles(vList || []);

        const initDriverId = preselectedDriverId || (dList.length > 0 ? dList[0].id : '');
        const dObj = dList.find(d => d.id === initDriverId);
        const initVehId = preselectedVehicleId || dObj?.assigned_vehicle_id || (vList.length > 0 ? vList[0].id : '');

        setFormData(prev => ({
          ...prev,
          driver_id: initDriverId,
          vehicle_id: initVehId,
          phone: dObj?.phone || '',
          location_name: dObj?.current_location_name || '',
          latitude: dObj?.current_latitude ? String(dObj.current_latitude) : '',
          longitude: dObj?.current_longitude ? String(dObj.current_longitude) : '',
          status: dObj?.status === 'On Trip' ? 'On Trip' : 'Available',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().slice(0, 5)
        }));
      }).catch(err => {
        console.error('Failed to load drivers/vehicles', err);
        setError('Failed to fetch drivers or vehicles list.');
      }).finally(() => {
        setLoading(false);
      });
    }
  }, [isOpen, preselectedDriverId, preselectedVehicleId]);

  const handleDriverChange = (driverId: string) => {
    const d = drivers.find(drv => drv.id === driverId);
    setFormData(prev => ({
      ...prev,
      driver_id: driverId,
      phone: d?.phone || prev.phone,
      vehicle_id: d?.assigned_vehicle_id || prev.vehicle_id,
      location_name: d?.current_location_name || prev.location_name,
      latitude: d?.current_latitude ? String(d.current_latitude) : prev.latitude,
      longitude: d?.current_longitude ? String(d.current_longitude) : prev.longitude,
      status: d?.status === 'On Trip' ? 'On Trip' : 'Available'
    }));
  };

  const handleVehicleChange = (vehicleId: string) => {
    const v = vehicles.find(veh => veh.id === vehicleId);
    setFormData(prev => ({
      ...prev,
      vehicle_id: vehicleId,
      driver_id: v?.driver_id || prev.driver_id
    }));
  };

  const handleSelectPreset = (preset: { name: string; lat: number; lng: number }) => {
    setFormData(prev => ({
      ...prev,
      location_name: preset.name,
      latitude: String(preset.lat),
      longitude: String(preset.lng)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const latNum = formData.latitude ? parseFloat(formData.latitude) : null;
    const lngNum = formData.longitude ? parseFloat(formData.longitude) : null;

    if (latNum !== null && (isNaN(latNum) || latNum < -90 || latNum > 90)) {
      setError('Latitude must be a valid number between -90 and 90.');
      return;
    }
    if (lngNum !== null && (isNaN(lngNum) || lngNum < -180 || lngNum > 180)) {
      setError('Longitude must be a valid number between -180 and 180.');
      return;
    }

    setSubmitting(true);
    try {
      await api.sendManualLocation({
        driver_id: formData.driver_id || undefined,
        vehicle_id: formData.vehicle_id || undefined,
        phone: formData.phone.trim() || undefined,
        location_name: formData.location_name.trim() || undefined,
        latitude: latNum,
        longitude: lngNum,
        status: formData.status,
        notes: formData.notes.trim() || undefined,
        date: formData.date,
        time: formData.time
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update location');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div 
        className="bg-[#18181B] w-full max-w-xl rounded-2xl shadow-2xl border border-[#3F3F46] overflow-hidden my-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#111113] border-b border-[#3F3F46] text-[#F5F5F5] p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3F1111] border border-[#7F1D1D] flex items-center justify-center">
              <MapPin className="w-5 h-5 text-[#E53935]" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-[#F5F5F5]">Manual Driver Location Config</h2>
              <p className="text-xs text-[#A1A1AA]">Configure real-time driver coordinates, phone, & status</p>
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 bg-[#18181B]">
          {error && (
            <div className="p-3 bg-[#3F1111] border border-[#B71C1C] rounded-xl text-xs text-[#FF6B6B] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#FF1744]" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-[#A1A1AA]">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-[#E53935]" />
              <span className="text-xs font-semibold">Loading drivers and vehicles...</span>
            </div>
          ) : (
            <>
              {/* Driver & Phone Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-bold text-[#D4D4D8] flex items-center gap-1.5 mb-1">
                    <User className="w-3.5 h-3.5 text-[#E53935]" /> Driver <span className="text-[#FF1744]">*</span>
                  </label>
                  <select
                    value={formData.driver_id}
                    onChange={(e) => handleDriverChange(e.target.value)}
                    className="w-full text-xs font-medium bg-[#111113] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-[#F5F5F5] focus:border-[#E53935] outline-hidden"
                    required
                  >
                    <option value="" className="bg-[#18181B] text-[#F5F5F5]">Select Driver</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id} className="bg-[#18181B] text-[#F5F5F5]">
                        {d.name} {d.phone ? `(${d.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#D4D4D8] flex items-center gap-1.5 mb-1">
                    <Phone className="w-3.5 h-3.5 text-[#22C55E]" /> Driver Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+91 98765 43210"
                    className="w-full text-xs font-medium bg-[#111113] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-[#F5F5F5] placeholder-[#71717A] focus:border-[#E53935] outline-hidden"
                  />
                </div>
              </div>

              {/* Vehicle & Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-bold text-[#D4D4D8] flex items-center gap-1.5 mb-1">
                    <Car className="w-3.5 h-3.5 text-[#E53935]" /> Assigned Vehicle
                  </label>
                  <select
                    value={formData.vehicle_id}
                    onChange={(e) => handleVehicleChange(e.target.value)}
                    className="w-full text-xs font-medium bg-[#111113] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-[#F5F5F5] focus:border-[#E53935] outline-hidden"
                  >
                    <option value="" className="bg-[#18181B] text-[#F5F5F5]">None / Unassigned</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id} className="bg-[#18181B] text-[#F5F5F5]">
                        {v.vehicle_number} — {v.make} {v.model} ({v.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#D4D4D8] flex items-center gap-1.5 mb-1">
                    <Compass className="w-3.5 h-3.5 text-[#60A5FA]" /> Tracking / Trip Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full text-xs font-medium bg-[#111113] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-[#F5F5F5] focus:border-[#E53935] outline-hidden"
                  >
                    <option value="Available" className="bg-[#18181B] text-[#F5F5F5]">Available / Standby</option>
                    <option value="On Trip" className="bg-[#18181B] text-[#F5F5F5]">On Trip / En Route</option>
                    <option value="Under Maintenance" className="bg-[#18181B] text-[#F5F5F5]">Workshop Maintenance</option>
                    <option value="Off Duty" className="bg-[#18181B] text-[#F5F5F5]">Off Duty / Rest</option>
                  </select>
                </div>
              </div>

              {/* Location Name & Quick Presets */}
              <div>
                <label className="text-xs font-bold text-[#D4D4D8] flex items-center gap-1.5 mb-1">
                  <MapPin className="w-3.5 h-3.5 text-[#FF1744]" /> Location Name / Hub Landmark
                </label>
                <input
                  type="text"
                  value={formData.location_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, location_name: e.target.value }))}
                  placeholder="e.g. Coimbatore NH544 Logistics Hub, Tamil Nadu"
                  className="w-full text-xs font-medium bg-[#111113] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-[#F5F5F5] placeholder-[#71717A] focus:border-[#E53935] outline-hidden"
                />
                
                {/* Hub Presets */}
                <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">Quick Presets:</span>
                  {COMMON_HUBS.map(hub => (
                    <button
                      key={hub.name}
                      type="button"
                      onClick={() => handleSelectPreset(hub)}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#27272A] hover:bg-[#3F1818] hover:text-[#FF1744] text-[#A1A1AA] border border-[#3F3F46] transition cursor-pointer"
                    >
                      {hub.name.split(' (')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Coordinates Grid */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-bold text-[#D4D4D8] flex items-center gap-1 mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                    placeholder="11.0168"
                    className="w-full text-xs font-mono font-medium bg-[#111113] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-[#F5F5F5] placeholder-[#71717A] focus:border-[#E53935] outline-hidden"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#D4D4D8] flex items-center gap-1 mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                    placeholder="76.9558"
                    className="w-full text-xs font-mono font-medium bg-[#111113] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-[#F5F5F5] placeholder-[#71717A] focus:border-[#E53935] outline-hidden"
                  />
                </div>
              </div>

              {/* Date & Time Grid */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-bold text-[#D4D4D8] flex items-center gap-1 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-[#71717A]" /> Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full text-xs font-medium bg-[#111113] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-[#F5F5F5] focus:border-[#E53935] outline-hidden"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#D4D4D8] flex items-center gap-1 mb-1">
                    <Clock className="w-3.5 h-3.5 text-[#71717A]" /> Time
                  </label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full text-xs font-medium bg-[#111113] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-[#F5F5F5] focus:border-[#E53935] outline-hidden"
                  />
                </div>
              </div>

              {/* Operational Notes */}
              <div>
                <label className="text-xs font-bold text-[#D4D4D8] flex items-center gap-1.5 mb-1">
                  <FileText className="w-3.5 h-3.5 text-[#71717A]" /> Notes / Checkpoint Remarks
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Driver reported at terminal checkpoint, vehicle fueled and ready for loading."
                  className="w-full text-xs font-medium bg-[#111113] border border-[#3F3F46] rounded-xl p-3 text-[#F5F5F5] placeholder-[#71717A] focus:border-[#E53935] outline-hidden resize-none"
                />
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#3F3F46] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#F5F5F5] bg-[#27272A] hover:bg-[#3F3F46] border border-[#52525B] rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loading || !formData.driver_id}
              className="px-5 py-2.5 text-xs font-black text-[#F5F5F5] bg-[#E53935] hover:bg-[#FF1744] rounded-xl transition shadow-lg shadow-[#E53935]/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Save Location Update
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualLocationModal;
