import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Truck, X, RefreshCw, UserCheck, MapPin,
  History, Radio, Navigation, Trash2, Edit2, Eye,
  User, AlertCircle, Check
} from 'lucide-react';
import type { Driver, Vehicle } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { DriverContactActions } from '../components/DriverContactActions';
import { ManualLocationModal } from '../components/ManualLocationModal';
import { LocationHistoryModal } from '../components/LocationHistoryModal';
import { ConnectMobileGpsModal } from '../components/ConnectMobileGpsModal';
import { ImageUploader } from '../components/ImageUploader';
import { resolveVehicleImageUrl, resolveDriverImageUrl } from '../utils/imageUrl';

interface DriversHubPageProps {
  onNavigate?: (path: string) => void;
}

export const DriversHubPage: React.FC<DriversHubPageProps> = ({ onNavigate }) => {
  const { showSuccess, showError } = useToast();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [viewingDriver, setViewingDriver] = useState<Driver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick Vehicle Assign Modal
  const [assigningDriver, setAssigningDriver] = useState<Driver | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');

  // Location & GPS modals
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isConnectGpsOpen, setIsConnectGpsOpen] = useState(false);
  const [connectGpsDriver, setConnectGpsDriver] = useState<Driver | null>(null);
  const [targetDriverId, setTargetDriverId] = useState<string | undefined>(undefined);
  const [targetVehicleId, setTargetVehicleId] = useState<string | undefined>(undefined);

  // Add / Edit Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    license_number: '',
    license_type: 'Heavy Commercial (HMV)',
    license_issue_date: '',
    license_expiry_date: '',
    badge_number: '',
    experience_years: 2,
    assigned_vehicle_id: '',
    blood_group: 'B+',
    emergency_contact: '',
    status: 'Active',
    profile_image_url: ''
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [drvs, vehs] = await Promise.all([
        api.getDrivers(),
        api.getVehicles()
      ]);
      setDrivers(drvs || []);
      setVehicles(vehs || []);
    } catch (err) {
      console.error('Failed to load drivers:', err);
      showError('Unable to load drivers list.');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Add Driver Modal
  const handleOpenAdd = () => {
    setEditingDriver(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      license_number: '',
      license_type: 'Heavy Commercial (HMV)',
      license_issue_date: new Date().toISOString().split('T')[0],
      license_expiry_date: '',
      badge_number: '',
      experience_years: 2,
      assigned_vehicle_id: '',
      blood_group: 'B+',
      emergency_contact: '',
      status: 'Active',
      profile_image_url: ''
    });
    setFormError('');
    setIsAddEditOpen(true);
  };

  // Open Edit Driver Modal
  const handleOpenEdit = (d: Driver) => {
    setEditingDriver(d);
    setFormData({
      name: d.name || '',
      phone: d.phone || '',
      email: d.email || '',
      address: d.address || '',
      license_number: d.license_number || '',
      license_type: d.license_type || 'Heavy Commercial (HMV)',
      license_issue_date: d.license_issue_date || '',
      license_expiry_date: d.license_expiry_date || '',
      badge_number: d.badge_number || '',
      experience_years: d.experience_years || 2,
      assigned_vehicle_id: d.assigned_vehicle_id || '',
      blood_group: d.blood_group || 'B+',
      emergency_contact: d.emergency_contact || '',
      status: d.status || 'Active',
      profile_image_url: d.profile_image_url || d.photo_url || ''
    });
    setFormError('');
    setIsAddEditOpen(true);
  };

  // Submit Add / Edit
  const handleSubmitDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Please enter the driver full name.');
      return;
    }
    if (!formData.phone.trim()) {
      setFormError('Please enter a valid phone number.');
      return;
    }
    if (!formData.license_number.trim()) {
      setFormError('Driving license number is required.');
      return;
    }
    if (!formData.license_expiry_date) {
      setFormError('Please specify the license expiry date.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingDriver) {
        await api.updateDriver(editingDriver.id, formData);
        showSuccess(`Driver ${formData.name} updated successfully.`);
      } else {
        await api.createDriver(formData);
        showSuccess(`Driver ${formData.name} added to fleet successfully.`);
      }
      setIsAddEditOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Failed to save driver:', err);
      setFormError(err.message || 'Unable to save driver. Please verify fields.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Assign Vehicle directly
  const handleAssignVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningDriver) return;
    try {
      await api.assignDriverVehicle(assigningDriver.id, selectedVehicleId || undefined);
      showSuccess('Vehicle assignment updated.');
      setAssigningDriver(null);
      loadData();
    } catch (err: any) {
      console.error('Failed to assign vehicle:', err);
      showError(err.message || 'Failed to assign driver.');
    }
  };

  // Delete Driver
  const handleDeleteDriver = async () => {
    if (!deletingDriver) return;
    setIsDeleting(true);
    try {
      await api.deleteDriver(deletingDriver.id);
      showSuccess(`Driver ${deletingDriver.name} deleted successfully.`);
      setDeletingDriver(null);
      loadData();
    } catch (err: any) {
      console.error('Failed to delete driver:', err);
      showError(err.message || 'Unable to delete this driver.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter and search logic
  const filteredDrivers = drivers.filter(d => {
    if (statusFilter !== 'All') {
      const isOnline = d.tracking_status === 'CONNECTED' || d.tracking_status === 'ACTIVE' || d.is_tracking === 1;
      if (statusFilter === 'GPS Connected' && !isOnline) return false;
      if (statusFilter === 'Active' && d.status !== 'Active') return false;
      if (statusFilter === 'On Trip' && d.status !== 'On Trip') return false;
      if (statusFilter === 'Expiring License' && (d.license_days_remaining === undefined || d.license_days_remaining > 30)) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = d.name?.toLowerCase().includes(q);
      const matchPhone = d.phone?.toLowerCase().includes(q);
      const matchLicense = d.license_number?.toLowerCase().includes(q);
      const matchVeh = d.assigned_vehicle_number?.toLowerCase().includes(q);
      const matchLoc = d.current_location_name?.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchLicense && !matchVeh && !matchLoc) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight">Driver Fleet Management</h1>
            <span className="px-2.5 py-0.5 bg-[#7F1D1D]/30 text-[#FF6B6B] border border-[#7F1D1D] rounded-full text-xs font-mono font-bold">
              {drivers.length} Drivers
            </span>
          </div>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Profile images, driving licenses, phone contacts, real-time GPS locations & vehicle assignments
          </p>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={loadData}
            className="p-2.5 bg-[#18181B] hover:bg-[#202024] text-[#A1A1AA] hover:text-[#F5F5F5] border border-[#3F3F46] rounded-xl transition cursor-pointer"
            title="Refresh Drivers"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#E53935]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setTargetDriverId(undefined);
              setTargetVehicleId(undefined);
              setIsManualModalOpen(true);
            }}
            className="px-3.5 py-2.5 bg-[#27272A] hover:bg-[#3F3F46] text-[#60A5FA] border border-[#3F3F46] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm cursor-pointer"
          >
            <MapPin className="w-4 h-4 text-[#60A5FA]" />
            <span>+ Manual Location</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/20 transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Fleet Driver</span>
          </button>
        </div>
      </div>

      {/* 2. Filter & Search Controls */}
      <div className="p-3 bg-[#18181B] border border-[#3F3F46] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-bold scrollbar-none">
          {['All', 'Active', 'On Trip', 'GPS Connected', 'Expiring License'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-xl transition shrink-0 cursor-pointer ${
                statusFilter === tab
                  ? 'bg-[#B71C1C] text-[#F5F5F5] shadow-md shadow-[#B71C1C]/30'
                  : 'text-[#A1A1AA] hover:text-[#F5F5F5] bg-[#111113] border border-[#3F3F46] hover:bg-[#202024]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="Search driver, phone, license, vehicle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#111113] border border-[#3F3F46] rounded-xl text-xs text-[#F5F5F5] placeholder-[#71717A] focus:outline-none focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935]"
          />
          <User className="w-3.5 h-3.5 text-[#71717A] absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* 3. Driver Cards Grid */}
      {isLoading ? (
        <div className="py-24 text-center text-[#A1A1AA] bg-[#18181B] border border-[#3F3F46] rounded-2xl">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#E53935]" />
          <p className="text-sm font-semibold text-[#F5F5F5]">Loading driver fleet & profile photos...</p>
          <p className="text-xs text-[#71717A] mt-1">Retrieving database records and GPS telemetry</p>
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div className="py-20 text-center space-y-4 bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-xl p-8">
          <div className="w-16 h-16 rounded-2xl bg-[#7F1D1D]/20 border border-[#7F1D1D]/40 text-[#FF1744] flex items-center justify-center mx-auto">
            <UserCheck className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#F5F5F5]">
              {searchQuery || statusFilter !== 'All' ? 'No matching drivers found.' : 'No drivers registered yet.'}
            </h3>
            <p className="text-xs text-[#A1A1AA] mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'All'
                ? `No drivers match the filter "${statusFilter}" or search query.`
                : 'Add commercial fleet drivers with profile photos, license specs, and assigned vehicles.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-5 py-2.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/20 transition inline-flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Driver</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDrivers.map((d) => {
            const isExpiring = d.license_days_remaining !== undefined && d.license_days_remaining <= 30 && d.license_days_remaining >= 0;
            const isExpired = d.license_days_remaining !== undefined && d.license_days_remaining < 0;
            const driverImgUrl = resolveDriverImageUrl(d.profile_image_url || d.photo_url);

            const isOnline = d.tracking_status === 'CONNECTED' || d.tracking_status === 'ACTIVE' || d.is_tracking === 1;
            const isConnecting = d.tracking_status === 'CONNECTING';

            return (
              <div
                key={d.id}
                className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl flex flex-col justify-between hover:border-[#7F1D1D] transition"
              >
                <div>
                  {/* Top Header: Profile Image, Name, Phone, GPS Status & Actions */}
                  <div className="flex items-start justify-between mb-3.5 gap-2">
                    <div className="flex items-center space-x-3 min-w-0">
                      {/* Driver Profile Image */}
                      <div className="w-13 h-13 rounded-2xl bg-[#111113] border-2 border-[#7F1D1D] overflow-hidden shrink-0 shadow-md flex items-center justify-center relative">
                        {driverImgUrl ? (
                          <img
                            src={driverImgUrl}
                            alt={d.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-tr from-[#7F1D1D] to-[#E53935] flex items-center justify-center font-bold text-[#F5F5F5] text-lg">
                            {d.name ? d.name.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h3 className="font-bold text-[#F5F5F5] text-sm truncate">{d.name}</h3>
                        <div className="mt-1">
                          <DriverContactActions phone={d.phone} driverName={d.name} size="sm" />
                        </div>
                      </div>
                    </div>

                    {/* GPS Status & Card Menu */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => setViewingDriver(d)}
                          className="p-1.5 text-[#71717A] hover:text-[#F5F5F5] hover:bg-[#27272A] rounded-lg transition cursor-pointer"
                          title="View Driver Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(d)}
                          className="p-1.5 text-[#71717A] hover:text-[#E53935] hover:bg-[#27272A] rounded-lg transition cursor-pointer"
                          title="Edit Driver"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingDriver(d)}
                          className="p-1.5 text-[#71717A] hover:text-[#FF1744] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                          title="Delete Driver"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {isOnline ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                          ONLINE
                        </span>
                      ) : isConnecting ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/40 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                          CONNECTING
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FF1744]" />
                          OFFLINE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Location Tag & Coordinates */}
                  {(d.current_location_name || (d.latitude != null && d.longitude != null)) && (
                    <div className="mb-3 px-3 py-2 rounded-xl bg-[#111113] border border-[#3F3F46] space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-[#60A5FA] truncate font-semibold">
                          <MapPin className="w-3.5 h-3.5 text-[#60A5FA] shrink-0" />
                          <span className="truncate">{d.current_location_name || 'Active GPS Location'}</span>
                        </div>
                        {d.location_updated_at && (
                          <span className="text-[10px] text-[#71717A] shrink-0 ml-2">
                            {new Date(d.location_updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      {d.latitude != null && d.longitude != null && (
                        <div className="text-[10px] font-mono text-[#A1A1AA] flex items-center justify-between">
                          <span>{Number(d.latitude).toFixed(4)}, {Number(d.longitude).toFixed(4)}</span>
                          <span className="text-[9px] uppercase px-1.5 py-0.2 bg-[#27272A] text-[#F5F5F5] rounded font-sans">
                            {d.location_source || 'GPS'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* License Information */}
                  <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46] space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#71717A]">License Number:</span>
                      <span className="font-bold text-[#F5F5F5] font-mono">{d.license_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#71717A]">Driver Type:</span>
                      <span className="text-[#E53935] font-semibold">{d.license_type}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#71717A]">License Expiry:</span>
                      <span className={`font-bold font-mono ${
                        isExpired ? 'text-[#FF1744]' : isExpiring ? 'text-[#F59E0B]' : 'text-[#D4D4D8]'
                      }`}>
                        {d.license_expiry_date} {d.license_days_remaining !== undefined ? `(${d.license_days_remaining}d)` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-0.5">
                      <span className="text-[#71717A]">Availability:</span>
                      <span className={`px-2 py-0.2 rounded-md text-[10px] font-bold ${
                        d.status === 'Active' ? 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40' :
                        d.status === 'On Trip' ? 'bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/40' :
                        'bg-[#27272A] text-[#A1A1AA] border border-[#3F3F46]'
                      }`}>
                        {d.status || 'Active'}
                      </span>
                    </div>
                  </div>

                  {/* Assigned Vehicle Section */}
                  <div className="mt-3 p-3 bg-[#111113] rounded-xl border border-[#3F3F46] flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      {resolveVehicleImageUrl(d.assigned_vehicle_photo_url || d.assigned_vehicle_image_url) ? (
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-[#27272A] border border-[#3F3F46] shrink-0 flex items-center justify-center">
                          <img
                            src={resolveVehicleImageUrl(d.assigned_vehicle_photo_url || d.assigned_vehicle_image_url)}
                            alt={d.assigned_vehicle_number || 'Vehicle'}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-[#27272A] flex items-center justify-center text-[#E53935] shrink-0 border border-[#3F3F46]">
                          <Truck className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-[10px] text-[#71717A] block">Assigned Vehicle</span>
                        <span className="font-bold text-[#F5F5F5] font-mono truncate block">
                          {d.assigned_vehicle_number || 'Unassigned'}
                        </span>
                        {d.assigned_vehicle_make && (
                          <span className="text-[10px] text-[#A1A1AA] block truncate">
                            {d.assigned_vehicle_make} {d.assigned_vehicle_model || ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setAssigningDriver(d);
                        setSelectedVehicleId(d.assigned_vehicle_id || '');
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold text-[#60A5FA] hover:text-[#F5F5F5] bg-[#27272A] hover:bg-[#3F3F46] rounded-lg border border-[#3F3F46] cursor-pointer shrink-0 transition"
                    >
                      Change
                    </button>
                  </div>
                </div>

                {/* Card Footer: GPS Buttons */}
                <div className="mt-4 pt-3 border-t border-[#3F3F46] space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-[#71717A]">
                    <span>{d.experience_years} Yrs Exp • {d.blood_group || 'O+'}</span>
                    <span>Last GPS: <strong className="text-[#D4D4D8]">{d.location_updated_at ? new Date(d.location_updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}</strong></span>
                  </div>

                  {/* GPS Tracking Action Buttons */}
                  {isOnline ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigate) {
                            onNavigate('/tracking');
                          } else {
                            window.history.pushState({}, '', '/tracking');
                            window.dispatchEvent(new Event('popstate'));
                          }
                        }}
                        className="py-2 px-3 rounded-xl bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] text-xs font-black transition flex items-center justify-center space-x-1.5 shadow-md cursor-pointer"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>LIVE MAP</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setConnectGpsDriver(d);
                          setIsConnectGpsOpen(true);
                        }}
                        className="py-2 px-3 rounded-xl bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] border border-[#3F3F46] text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Radio className="w-3.5 h-3.5 text-[#22C55E]" />
                        <span>GPS STATUS</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setConnectGpsDriver(d);
                        setIsConnectGpsOpen(true);
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#3F1111] hover:bg-[#7F1D1D]/50 text-[#FF6B6B] hover:text-[#F5F5F5] border border-[#7F1D1D] text-xs font-extrabold transition flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
                    >
                      <Radio className="w-3.5 h-3.5 text-[#FF1744] animate-pulse" />
                      <span>CONNECT MOBILE GPS</span>
                    </button>
                  )}

                  {/* Secondary Tools: Manual Checkpoint & Trip History */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetDriverId(d.id);
                        setTargetVehicleId(d.assigned_vehicle_id);
                        setIsManualModalOpen(true);
                      }}
                      className="px-2 py-1.5 rounded-lg bg-[#27272A] hover:bg-[#3F3F46] text-[#A1A1AA] hover:text-[#F5F5F5] border border-[#3F3F46] text-[10px] font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <MapPin className="w-3 h-3 text-[#60A5FA]" />
                      <span>Checkpoint</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetDriverId(d.id);
                        setTargetVehicleId(d.assigned_vehicle_id);
                        setIsHistoryModalOpen(true);
                      }}
                      className="px-2 py-1.5 rounded-lg bg-[#27272A] hover:bg-[#3F3F46] text-[#A1A1AA] hover:text-[#F5F5F5] border border-[#3F3F46] text-[10px] font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <History className="w-3 h-3 text-[#E53935]" />
                      <span>Trip History</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. ADD / EDIT DRIVER MODAL WITH PROFILE IMAGE UPLOAD */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#3F3F46] flex items-center justify-between shrink-0 bg-[#111113]">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#7F1D1D]/30 border border-[#7F1D1D] flex items-center justify-center text-[#FF1744]">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#F5F5F5] text-base">
                    {editingDriver ? `Edit Fleet Driver (${editingDriver.name})` : 'Add New Fleet Driver'}
                  </h3>
                  <p className="text-xs text-[#A1A1AA]">
                    Upload profile image, license specifications, vehicle assignment, and contacts
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddEditOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#71717A] hover:text-[#F5F5F5] hover:bg-[#27272A] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDriver} className="p-6 space-y-4 text-xs overflow-y-auto">
              {formError && (
                <div className="p-3 bg-[#3F1111] border border-[#B71C1C] rounded-xl text-[#FF6B6B] text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#FF1744]" />
                  <span>{formError}</span>
                </div>
              )}

              {/* SECTION: DRIVER PROFILE IMAGE UPLOADER */}
              <div className="p-4 bg-[#111113] border border-[#3F3F46] rounded-xl space-y-2">
                <ImageUploader
                  label="Driver Profile Image"
                  subLabel="JPG, JPEG, PNG, WEBP (Max 5 MB)"
                  value={formData.profile_image_url}
                  onChange={(url) => setFormData(prev => ({ ...prev, profile_image_url: url }))}
                  type="driver"
                  aspectRatio="square"
                />
              </div>

              {/* Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[#F5F5F5] font-bold mb-1">Driver Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Sundaram"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] focus:outline-none focus:border-[#E53935]"
                  />
                </div>

                <div>
                  <label className="block text-[#F5F5F5] font-bold mb-1">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +91 98450 12345"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono placeholder-[#71717A] focus:outline-none focus:border-[#E53935]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[#A1A1AA] font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="driver@smartfleet.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] focus:outline-none focus:border-[#E53935]"
                  />
                </div>

                <div>
                  <label className="block text-[#A1A1AA] font-semibold mb-1">Residential Address</label>
                  <input
                    type="text"
                    placeholder="Logistics Park Staff Quarters"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] focus:outline-none focus:border-[#E53935]"
                  />
                </div>
              </div>

              {/* License Details */}
              <div className="p-3.5 bg-[#111113] rounded-xl border border-[#3F3F46] space-y-3">
                <span className="text-xs font-extrabold text-[#E53935] block">License Specifications</span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#F5F5F5] font-bold mb-1">License Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. TN-01-2022-009988"
                      value={formData.license_number}
                      onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                      className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
                    />
                  </div>

                  <div>
                    <label className="block text-[#F5F5F5] font-bold mb-1">Driver / License Type</label>
                    <select
                      value={formData.license_type}
                      onChange={(e) => setFormData({ ...formData, license_type: e.target.value })}
                      className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                    >
                      <option value="Heavy Commercial (HMV)">Heavy Commercial (HMV)</option>
                      <option value="Light Commercial (LMV)">Light Commercial (LMV)</option>
                      <option value="Passenger Vehicle">Passenger Vehicle</option>
                      <option value="Hazardous Goods Carrier">Hazardous Goods Carrier</option>
                      <option value="Commercial Multi-Axle">Commercial Multi-Axle</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#A1A1AA] font-semibold mb-1">Issue Date</label>
                    <input
                      type="date"
                      value={formData.license_issue_date}
                      onChange={(e) => setFormData({ ...formData, license_issue_date: e.target.value })}
                      className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                    />
                  </div>

                  <div>
                    <label className="block text-[#F5F5F5] font-bold mb-1">License Expiry Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.license_expiry_date}
                      onChange={(e) => setFormData({ ...formData, license_expiry_date: e.target.value })}
                      className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                    />
                  </div>
                </div>
              </div>

              {/* Assignment & Availability */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#F5F5F5] font-bold mb-1">Assigned Vehicle</label>
                  <select
                    value={formData.assigned_vehicle_id}
                    onChange={(e) => setFormData({ ...formData, assigned_vehicle_id: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-medium focus:outline-none focus:border-[#E53935]"
                  >
                    <option value="">-- Unassigned --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.vehicle_number} ({v.make} {v.model})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#F5F5F5] font-bold mb-1">Availability Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-bold focus:outline-none focus:border-[#E53935]"
                  >
                    <option value="Active">Active / Available</option>
                    <option value="On Trip">On Trip</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#A1A1AA] font-semibold mb-1">Experience (Years)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.experience_years}
                    onChange={(e) => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
                  />
                </div>
              </div>

              {/* Emergency & Blood group */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#A1A1AA] font-semibold mb-1">Blood Group</label>
                  <select
                    value={formData.blood_group}
                    onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#A1A1AA] font-semibold mb-1">Emergency Contact Number</label>
                  <input
                    type="text"
                    placeholder="Relative / Next of kin phone"
                    value={formData.emergency_contact}
                    onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono placeholder-[#71717A] focus:outline-none focus:border-[#E53935]"
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-[#3F3F46] flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl font-bold shadow-lg shadow-[#E53935]/20 transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Saving Driver...' : editingDriver ? 'Update Driver' : 'Save Driver Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. DRIVER 360 DETAILS VIEW MODAL */}
      {viewingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
            {/* Header with Driver Image Hero */}
            <div className="p-6 bg-[#111113] border-b border-[#3F3F46] flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-2xl bg-[#18181B] border-2 border-[#E53935] overflow-hidden shrink-0 shadow-lg flex items-center justify-center">
                  {resolveDriverImageUrl(viewingDriver.profile_image_url || viewingDriver.photo_url) ? (
                    <img
                      src={resolveDriverImageUrl(viewingDriver.profile_image_url || viewingDriver.photo_url)}
                      alt={viewingDriver.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-[#7F1D1D] to-[#E53935] flex items-center justify-center font-bold text-[#F5F5F5] text-2xl">
                      {viewingDriver.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-extrabold text-[#F5F5F5] text-lg">{viewingDriver.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      viewingDriver.status === 'Active' ? 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40' :
                      viewingDriver.status === 'On Trip' ? 'bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/40' :
                      'bg-[#27272A] text-[#A1A1AA]'
                    }`}>
                      {viewingDriver.status || 'Active'}
                    </span>
                  </div>
                  <p className="text-xs text-[#A1A1AA] mt-0.5 font-mono">{viewingDriver.phone}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingDriver;
                    setViewingDriver(null);
                    handleOpenEdit(target);
                  }}
                  className="px-3 py-1.5 bg-[#27272A] hover:bg-[#3F3F46] text-[#E53935] border border-[#3F3F46] rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingDriver(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#71717A] hover:text-[#F5F5F5] hover:bg-[#27272A] transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Details Content */}
            <div className="p-6 space-y-4 overflow-y-auto text-xs">
              {/* GPS & Location Status */}
              <div className="p-3.5 bg-[#111113] rounded-xl border border-[#3F3F46] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#60A5FA] flex items-center space-x-1.5">
                    <Radio className="w-4 h-4 text-[#60A5FA]" />
                    <span>Real-Time GPS Telemetry</span>
                  </span>
                  <span className="px-2 py-0.5 bg-[#27272A] text-[#60A5FA] rounded text-[10px] font-mono">
                    {viewingDriver.tracking_status || 'OFFLINE'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[#D4D4D8] pt-1">
                  <div>
                    <span className="text-[#71717A] block text-[10px]">Current Location:</span>
                    <span className="font-semibold text-[#F5F5F5]">{viewingDriver.current_location_name || 'No GPS checkpoint logged'}</span>
                  </div>
                  <div>
                    <span className="text-[#71717A] block text-[10px]">Last Update:</span>
                    <span className="font-mono text-[#A1A1AA]">
                      {viewingDriver.location_updated_at ? new Date(viewingDriver.location_updated_at).toLocaleString('en-IN') : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              {/* License Specs */}
              <div className="p-3.5 bg-[#111113] rounded-xl border border-[#3F3F46] space-y-2">
                <span className="font-bold text-[#F5F5F5] block">Driving License Specs</span>
                <div className="grid grid-cols-2 gap-2 text-[#D4D4D8]">
                  <div>
                    <span className="text-[#71717A] block text-[10px]">License Number:</span>
                    <span className="font-mono font-bold text-[#F5F5F5]">{viewingDriver.license_number}</span>
                  </div>
                  <div>
                    <span className="text-[#71717A] block text-[10px]">Driver Type:</span>
                    <span className="text-[#E53935] font-semibold">{viewingDriver.license_type}</span>
                  </div>
                  <div>
                    <span className="text-[#71717A] block text-[10px]">Issue Date:</span>
                    <span className="font-mono text-[#A1A1AA]">{viewingDriver.license_issue_date || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[#71717A] block text-[10px]">Expiry Date:</span>
                    <span className="font-mono font-bold text-[#F59E0B]">{viewingDriver.license_expiry_date}</span>
                  </div>
                </div>
              </div>

              {/* Assigned Vehicle */}
              <div className="p-3.5 bg-[#111113] rounded-xl border border-[#3F3F46] space-y-2">
                <span className="font-bold text-[#F5F5F5] block">Assigned Fleet Vehicle</span>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-[#27272A] border border-[#3F3F46] overflow-hidden flex items-center justify-center shrink-0">
                    {resolveVehicleImageUrl(viewingDriver.assigned_vehicle_photo_url || viewingDriver.assigned_vehicle_image_url) ? (
                      <img
                        src={resolveVehicleImageUrl(viewingDriver.assigned_vehicle_photo_url || viewingDriver.assigned_vehicle_image_url)}
                        alt="Vehicle"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Truck className="w-5 h-5 text-[#E53935]" />
                    )}
                  </div>
                  <div>
                    <span className="font-mono font-extrabold text-[#F5F5F5] text-sm block">
                      {viewingDriver.assigned_vehicle_number || 'No Vehicle Assigned'}
                    </span>
                    <span className="text-[#A1A1AA] text-xs">
                      {viewingDriver.assigned_vehicle_make} {viewingDriver.assigned_vehicle_model || ''}
                      {viewingDriver.assigned_vehicle_type ? ` (${viewingDriver.assigned_vehicle_type})` : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Personal & Emergency */}
              <div className="p-3.5 bg-[#111113] rounded-xl border border-[#3F3F46] grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[#71717A] block text-[10px]">Experience:</span>
                  <span className="font-bold text-[#F5F5F5]">{viewingDriver.experience_years} Years</span>
                </div>
                <div>
                  <span className="text-[#71717A] block text-[10px]">Blood Group:</span>
                  <span className="font-mono font-bold text-[#FF1744]">{viewingDriver.blood_group || 'O+'}</span>
                </div>
                <div>
                  <span className="text-[#71717A] block text-[10px]">Emergency Contact:</span>
                  <span className="font-mono text-[#A1A1AA]">{viewingDriver.emergency_contact || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[#71717A] block text-[10px]">Email:</span>
                  <span className="text-[#A1A1AA] truncate">{viewingDriver.email || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-[#111113] border-t border-[#3F3F46] flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setViewingDriver(null)}
                className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl font-bold transition cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ASSIGN VEHICLE MODAL */}
      {assigningDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-[#F5F5F5] text-base">Assign Vehicle to {assigningDriver.name}</h3>
            <form onSubmit={handleAssignVehicle} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#A1A1AA] mb-1.5">Select Fleet Vehicle</label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs font-medium focus:outline-none focus:border-[#E53935]"
                >
                  <option value="">-- Unassign Vehicle --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number} - {v.make} {v.model} ({v.vehicle_type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setAssigningDriver(null)}
                  className="px-3.5 py-1.5 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold"
                >
                  Save Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. CONNECT MOBILE GPS MODAL */}
      <ConnectMobileGpsModal
        isOpen={isConnectGpsOpen}
        onClose={() => setIsConnectGpsOpen(false)}
        driver={connectGpsDriver}
      />

      {/* 8. MANUAL LOCATION MODAL */}
      <ManualLocationModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSuccess={loadData}
        preselectedDriverId={targetDriverId}
        preselectedVehicleId={targetVehicleId}
      />

      {/* 9. LOCATION HISTORY MODAL */}
      <LocationHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        driverId={targetDriverId}
      />

      {/* 10. DELETE CONFIRMATION MODAL */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingDriver)}
        title="Delete Fleet Driver"
        itemName={deletingDriver?.name}
        itemDetails={deletingDriver ? `License: ${deletingDriver.license_number} • Phone: ${deletingDriver.phone}` : undefined}
        isLoading={isDeleting}
        onConfirm={handleDeleteDriver}
        onCancel={() => setDeletingDriver(null)}
      />
    </div>
  );
};

export default DriversHubPage;
