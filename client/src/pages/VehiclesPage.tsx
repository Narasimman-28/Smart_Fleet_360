import React, { useState, useEffect } from 'react';
import {
  Search, Plus, LayoutGrid, List,
  ArrowRight, User, ExternalLink, RefreshCw, Truck, Trash2, Edit3
} from 'lucide-react';
import type { Vehicle, VehicleStatus, VehicleType, FuelType } from '../types';
import { api } from '../services/api';
import { resolveVehicleImageUrl } from '../utils/imageUrl';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { EditVehicleModal } from '../components/EditVehicleModal';
import { useToast } from '../context/ToastContext';

interface VehiclesPageProps {
  onNavigate: (path: string) => void;
  onOpenRegister: () => void;
}

export const VehiclesPage: React.FC<VehiclesPageProps> = ({ onNavigate, onOpenRegister }) => {
  const { showSuccess, showError } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Delete modal state
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit modal state
  const [vehicleToEdit, setVehicleToEdit] = useState<Vehicle | null>(null);

  // Filter States
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [fuelFilter, setFuelFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const allVehicleTypes: VehicleType[] = [
    'Car', 'Taxi', 'Bus', 'School Bus', 'Tourist Bus', 'Van',
    'Truck', 'Heavy Truck', 'Lorry', 'Tanker', 'Trailer', 'LCV',
    'Mini Truck', 'Ambulance', 'Heavy Commercial', 'Light Commercial',
    'Goods Vehicle', 'Passenger Vehicle', 'Construction Vehicle',
    'Special Vehicle', 'Other'
  ];

  const allFuelTypes: FuelType[] = [
    'Diesel', 'Petrol', 'CNG', 'LPG', 'Electric', 'Hybrid', 'Hydrogen', 'Other'
  ];

  const loadVehicles = async () => {
    setIsLoading(true);
    try {
      const data = await api.getVehicles({
        type: typeFilter !== 'All' ? typeFilter : undefined,
        fuel: fuelFilter !== 'All' ? fuelFilter : undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
        search: search.trim() || undefined
      });
      setVehicles(data || []);
    } catch (err) {
      console.error('Failed to load vehicles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      loadVehicles();
    }, 200);
    return () => clearTimeout(handler);
  }, [typeFilter, fuelFilter, statusFilter, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadVehicles();
  };

  const getStatusBadge = (status: VehicleStatus) => {
    switch (status) {
      case 'Available':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40 flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] mr-1.5" /> Available</span>;
      case 'On Trip':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#18181B] text-[#60A5FA] border border-[#60A5FA]/40 flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA] mr-1.5 animate-pulse" /> On Trip</span>;
      case 'Under Maintenance':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/40 flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] mr-1.5" /> In Workshop</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#27272A] text-[#A1A1AA] border border-[#3F3F46]">{status}</span>;
    }
  };

  const formatFuelDisplay = (fuelType: string) => {
    if (fuelType === 'CNG') return 'CNG (Natural Gas)';
    if (fuelType === 'Electric') return '⚡ Electric (EV)';
    return fuelType;
  };

  const handleConfirmDelete = async () => {
    if (!vehicleToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteVehicle(vehicleToDelete.id);
      showSuccess('Vehicle deleted successfully.');
      setVehicleToDelete(null);
      await loadVehicles();
    } catch (err: any) {
      showError(err.message || 'Unable to delete this vehicle. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight">Vehicles Fleet Registry</h1>
            <span className="px-2.5 py-0.5 text-xs font-extrabold bg-[#3F1111] text-[#FF1744] border border-[#7F1D1D] rounded-full">
              {vehicles.length} {vehicles.length === 1 ? 'Vehicle' : 'Vehicles'}
            </span>
          </div>
          <p className="text-xs text-[#A1A1AA] mt-0.5">Centralized vehicle registry across all categories and commercial operations</p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex bg-[#18181B] p-1 rounded-xl border border-[#3F3F46] shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${viewMode === 'grid' ? 'bg-[#E53935] text-[#F5F5F5]' : 'text-[#71717A] hover:text-[#F5F5F5]'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${viewMode === 'table' ? 'bg-[#E53935] text-[#F5F5F5]' : 'text-[#71717A] hover:text-[#F5F5F5]'}`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onOpenRegister}
            className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/25 transition flex items-center space-x-1.5 cursor-pointer border border-[#FF1744]/30"
          >
            <Plus className="w-4 h-4" />
            <span>+ Register Vehicle</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by registration number, make, model, chassis, driver..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder:text-[#71717A] text-xs focus:border-[#E53935] focus:outline-none focus:ring-1 focus:ring-[#E53935]"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Vehicle Type Filter */}
          <div className="flex items-center space-x-1.5 text-xs text-[#A1A1AA]">
            <span>Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-none"
            >
              <option value="All">All Types</option>
              {allVehicleTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Fuel Type Filter */}
          <div className="flex items-center space-x-1.5 text-xs text-[#A1A1AA]">
            <span>Fuel:</span>
            <select
              value={fuelFilter}
              onChange={(e) => setFuelFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-none"
            >
              <option value="All">All Fuels</option>
              {allFuelTypes.map(f => (
                <option key={f} value={f}>
                  {f === 'CNG' ? 'CNG (Natural Gas)' : f}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1.5 text-xs text-[#A1A1AA]">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Available">Available</option>
              <option value="On Trip">On Trip</option>
              <option value="Under Maintenance">In Workshop</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <button
            onClick={() => { setSearch(''); setTypeFilter('All'); setFuelFilter('All'); setStatusFilter('All'); }}
            className="px-3 py-1.5 text-xs text-[#A1A1AA] hover:text-[#F5F5F5] bg-[#27272A] hover:bg-[#3F3F46] rounded-xl border border-[#52525B] font-medium transition cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-[#A1A1AA]">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#E53935]" />
          <p className="text-sm">Loading fleet vehicles...</p>
        </div>
      ) : vehicles.length === 0 ? (
        <div className="py-20 text-center space-y-4 bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-xl p-8">
          <div className="w-16 h-16 rounded-2xl bg-[#3F1111] border border-[#7F1D1D] text-[#FF1744] flex items-center justify-center mx-auto">
            <Truck className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#F5F5F5]">No vehicles registered yet.</h3>
            <p className="text-xs text-[#A1A1AA] mt-1 max-w-sm mx-auto">
              {search || typeFilter !== 'All' || fuelFilter !== 'All' || statusFilter !== 'All'
                ? 'No vehicles match your search filter criteria. Try resetting filters.'
                : 'Your fleet database is empty. Register your first transport or commercial vehicle to get started.'}
            </p>
          </div>
          <button
            onClick={onOpenRegister}
            className="px-5 py-2.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/25 transition inline-flex items-center space-x-1.5 cursor-pointer border border-[#FF1744]/30"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Vehicle</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {vehicles.map((v) => (
            <div
              key={v.id}
              onClick={() => onNavigate(`/vehicles/${v.id}`)}
              className="rounded-2xl bg-[#18181B] border border-[#3F3F46] hover:border-[#E53935] hover:bg-[#202024] hover:shadow-2xl transition duration-200 overflow-hidden shadow-xl group cursor-pointer flex flex-col justify-between"
            >
              <div>
                {/* Photo & Top Bar */}
                {(() => {
                  const fullImg = resolveVehicleImageUrl(v.profile_image_url || v.photo_url);
                  return (
                    <div className="relative h-48 w-full overflow-hidden bg-[#09090B] flex items-center justify-center">
                      {fullImg ? (
                        <img
                          src={fullImg}
                          alt={v.vehicle_number}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                            const parent = (e.target as HTMLElement).parentElement;
                            if (parent) {
                              const fallback = parent.querySelector('.img-fallback');
                              if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                            }
                          }}
                        />
                      ) : null}
                      <div className={`img-fallback flex flex-col items-center justify-center text-[#71717A] ${fullImg ? 'hidden' : ''}`}>
                        <Truck className="w-12 h-12 text-[#71717A] mb-1" />
                        <span className="text-[10px] font-extrabold text-[#71717A] tracking-wider">NO VEHICLE IMAGE</span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#18181B] via-transparent to-transparent pointer-events-none" />

                      <div className="absolute top-3 left-3">
                        <span className="px-2.5 py-1 text-xs font-extrabold bg-[#09090B]/90 text-[#F5F5F5] rounded-lg border border-[#3F3F46] tracking-wider font-mono shadow-md">
                          {v.vehicle_number}
                        </span>
                      </div>

                      <div className="absolute top-3 right-3 flex items-center space-x-1.5">
                        {getStatusBadge(v.status)}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVehicleToDelete(v);
                          }}
                          className="p-1.5 bg-[#3F1111] hover:bg-[#B71C1C] text-[#FF1744] hover:text-white rounded-lg border border-[#7F1D1D] transition cursor-pointer"
                          title="Delete Vehicle"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-[#F5F5F5]">
                        <span className="font-bold text-sm drop-shadow">{v.make} {v.model}</span>
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#B71C1C] text-[#F5F5F5] rounded-md border border-[#FF1744]/40">
                          {v.vehicle_type}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Card Body Metrics */}
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-[11px] bg-[#111113] p-2.5 rounded-xl border border-[#3F3F46]">
                    <div>
                      <span className="text-[#71717A] block">Fuel Type</span>
                      <span className="font-semibold text-[#F5F5F5] truncate block" title={v.fuel_type}>
                        {formatFuelDisplay(v.fuel_type || '—')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#71717A] block">Odometer</span>
                      <span className="font-semibold text-[#F5F5F5] font-mono">{(v.odometer_reading || 0).toLocaleString()} km</span>
                    </div>
                    <div>
                      <span className="text-[#71717A] block">RTO Code</span>
                      <span className="font-semibold text-[#FF1744] font-mono">{v.rto_code || '—'}</span>
                    </div>
                  </div>

                  {/* Driver & Owner */}
                  <div className="flex items-center justify-between text-xs text-[#A1A1AA] pt-1">
                    <div className="flex items-center space-x-1.5 truncate">
                      <User className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                      <span className="truncate">Driver: <strong className="text-[#F5F5F5]">{v.driver_name || 'Not assigned'}</strong></span>
                    </div>
                    <span className="text-[11px] text-[#A1A1AA] truncate">Owner: <strong className="text-[#F5F5F5]">{v.owner_name || 'Not assigned'}</strong></span>
                  </div>

                  {/* Compliance Status Badges */}
                  <div className="pt-2 border-t border-[#3F3F46] flex flex-wrap gap-1.5 text-[10px]">
                    <span className="px-2 py-0.5 rounded-md font-semibold bg-[#111113] text-[#60A5FA] border border-[#3F3F46]">
                      RC: Valid
                    </span>
                    <span className={`px-2 py-0.5 rounded-md font-semibold ${
                      v.insurance_status === 'Expired' ? 'bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]' : 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40'
                    }`}>
                      Ins: {v.insurance_status || 'Valid'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md font-semibold ${
                      v.puc_status === 'Expired' ? 'bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]' : 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40'
                    }`}>
                      PUC: {v.puc_status || 'Valid'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md font-semibold ${
                      v.fitness_status === 'Expired' ? 'bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]' : 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40'
                    }`}>
                      FC: {v.fitness_status || 'Valid'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md font-semibold bg-[#111113] text-[#A855F7] border border-[#3F3F46]">
                      Permit: {v.permit_status || 'Active'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md font-semibold ${
                      (v.fastag_balance ?? 0) < 500 ? 'bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/50' : 'bg-[#111113] text-[#F5F5F5] border border-[#3F3F46]'
                    }`}>
                      FASTag: {v.fastag_balance !== undefined ? `₹${v.fastag_balance}` : 'Active'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-4 py-3 border-t border-[#3F3F46] bg-[#111113] flex items-center justify-between text-xs">
                <span className="text-[#A1A1AA] font-medium">
                  {v.seating_capacity && v.seating_capacity > 0
                    ? `${v.seating_capacity} Seats`
                    : v.load_capacity_kg
                    ? `${(v.load_capacity_kg).toLocaleString()}kg Load`
                    : '—'}
                </span>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVehicleToEdit(v);
                    }}
                    className="p-1.5 text-[#A1A1AA] hover:text-[#FF1744] hover:bg-[#18181B] rounded-lg transition cursor-pointer border border-transparent hover:border-[#3F3F46]"
                    title="Edit Vehicle"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVehicleToDelete(v);
                    }}
                    className="p-1.5 text-[#FF1744] hover:text-[#FF6B6B] hover:bg-[#3F1111] rounded-lg transition cursor-pointer border border-transparent hover:border-[#7F1D1D]"
                    title="Delete Vehicle"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(`/vehicles/${v.id}`);
                    }}
                    className="text-[#FF1744] hover:text-[#FF6B6B] font-bold flex items-center cursor-pointer ml-1"
                  >
                    <span>View Details</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="rounded-2xl bg-[#18181B] border border-[#3F3F46] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#F5F5F5]">
              <thead className="bg-[#27272A] text-[#F5F5F5] text-[11px] font-bold uppercase tracking-wider border-b border-[#3F3F46]">
                <tr>
                  <th className="p-3.5">Vehicle Number</th>
                  <th className="p-3.5">Make & Model</th>
                  <th className="p-3.5">Type & Fuel</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Assigned Driver</th>
                  <th className="p-3.5">Owner & RTO</th>
                  <th className="p-3.5">Compliance Badges</th>
                  <th className="p-3.5">FASTag</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3F3F46]">
                {vehicles.map((v) => {
                  const fullImg = resolveVehicleImageUrl(v.profile_image_url || v.photo_url);
                  return (
                    <tr
                      key={v.id}
                      onClick={() => onNavigate(`/vehicles/${v.id}`)}
                      className="hover:bg-[#202024] transition cursor-pointer bg-[#18181B]"
                    >
                      <td className="p-3.5 font-bold text-[#F5F5F5] font-mono">
                        <div className="flex items-center space-x-3">
                          <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#09090B] border border-[#3F3F46] shrink-0 flex items-center justify-center">
                            {fullImg ? (
                              <img
                                src={fullImg}
                                alt={v.vehicle_number}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Truck className="w-5 h-5 text-[#71717A]" />
                            )}
                          </div>
                          <div>
                            <span className="block font-bold text-[#F5F5F5]">{v.vehicle_number}</span>
                            <span className="text-[10px] text-[#FF1744] font-sans font-semibold">{v.vehicle_type}</span>
                          </div>
                        </div>
                      </td>
                    <td className="p-3.5 font-medium">
                      <div>
                        <span className="font-bold text-[#F5F5F5]">{v.make} {v.model}</span>
                        {v.variant && <span className="text-[11px] text-[#A1A1AA] block">{v.variant}</span>}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="space-y-1">
                        <span className="px-2 py-0.5 rounded bg-[#3F1111] text-[#FF1744] font-semibold text-[11px] block w-fit border border-[#7F1D1D]">
                          {v.vehicle_type}
                        </span>
                        <span className="text-[10px] text-[#A1A1AA] block truncate max-w-[140px]" title={v.fuel_type}>
                          {formatFuelDisplay(v.fuel_type || 'Diesel')}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5">{getStatusBadge(v.status)}</td>
                    <td className="p-3.5 font-medium">{v.driver_name || <span className="text-[#71717A] italic">Not assigned</span>}</td>
                    <td className="p-3.5">
                      <div className="text-[11px]">
                        <span className="font-semibold text-[#F5F5F5] block">{v.owner_name || 'Not assigned'}</span>
                        <span className="text-[#A1A1AA]">{v.rto_code ? `${v.rto_office} (${v.rto_code})` : v.rto_office || '—'}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        <span className="px-1.5 py-0.5 bg-[#111113] text-[#60A5FA] font-bold rounded border border-[#3F3F46]">RC</span>
                        <span className={`px-1.5 py-0.5 font-bold rounded ${v.insurance_status === 'Expired' ? 'bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]' : 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40'}`}>Ins</span>
                        <span className={`px-1.5 py-0.5 font-bold rounded ${v.puc_status === 'Expired' ? 'bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]' : 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40'}`}>PUC</span>
                        <span className={`px-1.5 py-0.5 font-bold rounded ${v.fitness_status === 'Expired' ? 'bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]' : 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40'}`}>FC</span>
                        <span className="px-1.5 py-0.5 bg-[#111113] text-[#A855F7] font-bold rounded border border-[#3F3F46]">Permit</span>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono font-semibold text-[#60A5FA]">
                      {v.fastag_balance !== undefined && v.fastag_balance !== null ? `₹${Number(v.fastag_balance).toFixed(2)}` : '—'}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVehicleToEdit(v);
                          }}
                          className="p-1.5 text-[#A1A1AA] hover:text-[#FF1744] hover:bg-[#111113] rounded-lg transition cursor-pointer border border-transparent hover:border-[#3F3F46]"
                          title="Edit Vehicle"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVehicleToDelete(v);
                          }}
                          className="p-1.5 text-[#FF1744] hover:text-[#FF6B6B] hover:bg-[#3F1111] rounded-lg transition cursor-pointer border border-transparent hover:border-[#7F1D1D]"
                          title="Delete Vehicle"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate(`/vehicles/${v.id}`);
                          }}
                          className="px-3 py-1.5 bg-[#3F1111] hover:bg-[#E53935] text-[#FF1744] hover:text-[#F5F5F5] rounded-lg font-bold text-xs transition inline-flex items-center space-x-1 cursor-pointer border border-[#7F1D1D]"
                        >
                          <span>View Details</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Vehicle Modal */}
      {vehicleToEdit && (
        <EditVehicleModal
          isOpen={Boolean(vehicleToEdit)}
          vehicle={vehicleToEdit}
          onClose={() => setVehicleToEdit(null)}
          onSuccess={async () => {
            showSuccess('Vehicle updated successfully.');
            setVehicleToEdit(null);
            await loadVehicles();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(vehicleToDelete)}
        title="Delete Vehicle Record"
        itemType="Vehicle"
        itemName={vehicleToDelete ? `${vehicleToDelete.vehicle_number} (${vehicleToDelete.make} ${vehicleToDelete.model})` : ''}
        message="Are you sure you want to delete this vehicle?"
        confirmLabel="Delete Vehicle"
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setVehicleToDelete(null)}
      />
    </div>
  );
};

export default VehiclesPage;
