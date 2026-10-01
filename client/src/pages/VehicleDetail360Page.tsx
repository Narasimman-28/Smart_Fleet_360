import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck, Shield, Wind, CheckSquare, FileSpreadsheet, CreditCard,
  AlertTriangle, Fuel, Wrench, Calendar, Receipt, Disc, FileText,
  Bell, History, ArrowLeft, User, DollarSign, Plus, Sliders, Edit3, Camera, Trash2
} from 'lucide-react';
import type { Vehicle360Profile } from '../types';
import { api } from '../services/api';
import { VehicleTimeline } from '../components/VehicleTimeline';
import { DriverContactActions } from '../components/DriverContactActions';
import { EditVehicleModal } from '../components/EditVehicleModal';
import { UpdateVehicleImageModal } from '../components/UpdateVehicleImageModal';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { useToast } from '../context/ToastContext';
import {
  QuickFASTagRechargeModal, QuickFuelModal, QuickBookingModal,
  AddInsuranceModal, AddPUCModal, AddFitnessModal, AddPermitModal,
  AddRoadTaxModal, AddFASTagModal, AddChallanModal, AddServiceModal,
  AddTyreModal, AddBatteryModal, VehicleThresholdModal
} from '../components/AddRecordModals';
import { resolveVehicleImageUrl } from '../utils/imageUrl';

interface VehicleDetail360PageProps {
  vehicleId: string;
  initialTab?: string;
  onBack: () => void;
  onNavigate?: (path: string) => void;
}

export const VehicleDetail360Page: React.FC<VehicleDetail360PageProps> = ({
  vehicleId,
  initialTab = 'overview',
  onBack
}) => {
  const { showSuccess, showError } = useToast();
  const [profile, setProfile] = useState<Vehicle360Profile | null>(null);
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [isLoading, setIsLoading] = useState(true);

  // Generic item delete state
  const [itemToDelete, setItemToDelete] = useState<{
    type: string;
    id: string;
    name?: string;
    action: () => Promise<any>;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modals
  const [isEditVehicleModalOpen, setIsEditVehicleModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isInsuranceModalOpen, setIsInsuranceModalOpen] = useState(false);
  const [isPUCModalOpen, setIsPUCModalOpen] = useState(false);
  const [isFitnessModalOpen, setIsFitnessModalOpen] = useState(false);
  const [isPermitModalOpen, setIsPermitModalOpen] = useState(false);
  const [isRoadTaxModalOpen, setIsRoadTaxModalOpen] = useState(false);
  const [isFASTagModalOpen, setIsFASTagModalOpen] = useState(false);
  const [isChallanModalOpen, setIsChallanModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isTyreModalOpen, setIsTyreModalOpen] = useState(false);
  const [isBatteryModalOpen, setIsBatteryModalOpen] = useState(false);
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getVehicle360(vehicleId);
      setProfile(data);
    } catch (err) {
      console.error('Failed to load 360 profile:', err);
    } finally {
      setIsLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await itemToDelete.action();
      showSuccess('Record deleted successfully.');
      setItemToDelete(null);
    } catch (err: any) {
      showError(err.message || 'Unable to delete this record. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading && !profile) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#E53935] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[#A1A1AA] text-sm font-medium">Assembling 360° vehicle telemetry, compliance & operations...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center space-y-4 bg-[#18181B] rounded-2xl border border-[#3F3F46] shadow-xl">
        <p className="text-[#FF1744] font-bold">Vehicle record not found in database.</p>
        <button onClick={onBack} className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-semibold cursor-pointer">
          Return to Vehicles Registry
        </button>
      </div>
    );
  }

  const {
    vehicle,
    rto,
    insurance,
    puc,
    fitness,
    permit,
    roadTax,
    fastag,
    fastagTxns = [],
    challans = [],
    serviceHistory = [],
    fuelLogs = [],
    bookings = [],
    tyres = [],
    batteries = [],
    expenses = [],
    documents = [],
    notifications = [],
    timeline = []
  } = profile;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Truck },
    { id: 'rto', label: 'RTO Registration', icon: FileSpreadsheet },
    { id: 'insurance', label: 'Insurance', icon: Shield, badge: insurance?.status === 'Expired' ? '!' : undefined },
    { id: 'puc', label: 'PUC / Pollution', icon: Wind, badge: puc?.status === 'Expired' ? '!' : undefined },
    { id: 'fitness', label: 'Fitness Certificate', icon: CheckSquare, badge: fitness?.status === 'Expired' ? '!' : undefined },
    { id: 'permits', label: 'Permits', icon: FileSpreadsheet },
    { id: 'roadtax', label: 'Road Tax', icon: Receipt },
    { id: 'fastag', label: 'FASTag & Tolls', icon: CreditCard, badge: fastag && fastag.wallet_balance < fastag.minimum_balance ? 'Low' : undefined },
    { id: 'challans', label: 'Challans', icon: AlertTriangle, badge: challans.filter(c => c.payment_status !== 'Paid').length || undefined },
    { id: 'fuel', label: 'Fuel & Mileage', icon: Fuel },
    { id: 'maintenance', label: 'Service & Repairs', icon: Wrench },
    { id: 'tyres-batteries', label: 'Tyres & Battery', icon: Disc },
    { id: 'bookings', label: 'Trips & Bookings', icon: Calendar },
    { id: 'expenses', label: 'Expenses Ledger', icon: DollarSign },
    { id: 'documents', label: 'Document Vault', icon: FileText, badge: documents.length || undefined },
    { id: 'notifications', label: 'Alerts', icon: Bell, badge: notifications.filter(n => !n.is_read).length || undefined },
    { id: 'history', label: 'Timeline History', icon: History }
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Top Navigation Back Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-xs font-semibold text-[#A1A1AA] hover:text-[#FF1744] transition group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition" />
          <span>Back to Fleet Directory</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsEditVehicleModalOpen(true)}
            className="px-3.5 py-1.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-1.5 cursor-pointer border border-[#FF1744]/30"
            title="Edit Vehicle specifications & image"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Vehicle</span>
          </button>
          <button
            onClick={() => setItemToDelete({
              type: 'Vehicle',
              id: vehicle.id,
              name: `${vehicle.vehicle_number} (${vehicle.make} ${vehicle.model})`,
              action: async () => {
                await api.deleteVehicle(vehicle.id);
                onBack();
              }
            })}
            className="px-3.5 py-1.5 bg-[#3F1111] hover:bg-[#B71C1C] text-[#FF1744] hover:text-[#F5F5F5] border border-[#7F1D1D] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
            title="Delete Vehicle permanently"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Vehicle</span>
          </button>
          <button
            onClick={() => setIsThresholdModalOpen(true)}
            className="px-3 py-1.5 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] border border-[#52525B] rounded-xl text-xs font-semibold shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
            title="Configure vehicle-specific alert threshold overrides"
          >
            <Sliders className="w-3.5 h-3.5 text-[#FF1744]" />
            <span>Threshold Rules</span>
          </button>
          <button
            onClick={() => setIsFuelModalOpen(true)}
            className="px-3 py-1.5 bg-[#3A2808] hover:bg-[#F59E0B] text-[#F59E0B] hover:text-black border border-[#F59E0B]/50 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Fuel className="w-3.5 h-3.5" />
            <span>+ Record Fuel</span>
          </button>
          <button
            onClick={() => setIsBookingModalOpen(true)}
            className="px-3 py-1.5 bg-[#18181B] hover:bg-[#202024] text-[#60A5FA] border border-[#60A5FA]/40 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>+ Book Trip</span>
          </button>
          {fastag ? (
            <button
              onClick={() => setIsRechargeModalOpen(true)}
              className="px-3 py-1.5 bg-[#3F1111] hover:bg-[#E53935] text-[#FF1744] hover:text-[#F5F5F5] border border-[#7F1D1D] rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Recharge FASTag</span>
            </button>
          ) : (
            <button
              onClick={() => setIsFASTagModalOpen(true)}
              className="px-3 py-1.5 bg-[#3F1111] hover:bg-[#E53935] text-[#FF1744] hover:text-[#F5F5F5] border border-[#7F1D1D] rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>+ Setup FASTag</span>
            </button>
          )}
        </div>
      </div>

      {/* 360° Hero Command Center Card */}
      <div className="rounded-2xl bg-[#18181B] border border-[#3F3F46] p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start sm:items-center space-x-5">
            {/* Vehicle Profile Image Box */}
            {(() => {
              const fullVImg = resolveVehicleImageUrl(vehicle.profile_image_url || vehicle.photo_url);
              return (
                <div
                  onClick={() => setIsImageModalOpen(true)}
                  className="relative group w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-[#09090B] border-2 border-[#E53935] shadow-lg shrink-0 flex items-center justify-center cursor-pointer transition-all hover:ring-4 hover:ring-[#E53935]/30"
                  title="Click to change / update vehicle profile photo"
                >
                  {fullVImg && !imageError ? (
                    <img
                      src={fullVImg}
                      alt={vehicle.vehicle_number}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      onError={() => setImageError(true)}
                    />
                  ) : imageError ? (
                    <div className="flex flex-col items-center justify-center p-2 text-center text-[#71717A]">
                      <AlertTriangle className="w-6 h-6 text-[#F59E0B] mb-1" />
                      <span className="text-[9px] font-bold text-[#A1A1AA] leading-tight">Image unavailable</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-2 text-center text-[#71717A]">
                      <Truck className="w-8 h-8 text-[#E53935] mb-1" />
                      <span className="text-[9px] font-extrabold text-[#A1A1AA] tracking-wider">NO IMAGE</span>
                      <span className="text-[8px] text-[#FF1744] font-semibold mt-0.5 underline">+ Upload</span>
                    </div>
                  )}

                  {/* Hover Quick Action Overlay */}
                  <div className="absolute inset-0 bg-[#09090B]/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-[#F5F5F5] p-1">
                    <Camera className="w-5 h-5 text-[#FF1744] mb-0.5" />
                    <span className="text-[10px] font-bold">{fullVImg ? 'Change Photo' : 'Upload Photo'}</span>
                  </div>
                </div>
              );
            })()}

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-3 py-1 bg-[#09090B] text-[#F5F5F5] font-mono font-extrabold text-base rounded-xl tracking-wider shadow border border-[#3F3F46]">
                  {vehicle.vehicle_number}
                </span>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
                  vehicle.status === 'Available' ? 'bg-[#0F2A1A] text-[#22C55E] border-[#22C55E]/40' :
                  vehicle.status === 'On Trip' ? 'bg-[#18181B] text-[#60A5FA] border-[#60A5FA]/40' :
                  vehicle.status === 'Under Maintenance' ? 'bg-[#3A2808] text-[#F59E0B] border-[#F59E0B]/40' :
                  'bg-[#27272A] text-[#A1A1AA] border-[#3F3F46]'
                }`}>
                  {vehicle.status}
                </span>
                <span className="px-2.5 py-1 text-xs font-bold bg-[#3F1111] text-[#FF1744] border border-[#7F1D1D] rounded-lg">
                  {vehicle.vehicle_type}
                </span>
              </div>

              <h2 className="text-xl font-extrabold text-[#F5F5F5] mt-1">
                {vehicle.make} {vehicle.model} {vehicle.variant && <span className="text-[#A1A1AA] text-sm font-normal">({vehicle.variant})</span>}
              </h2>

              <div className="flex flex-wrap items-center gap-4 text-xs text-[#A1A1AA] mt-2">
                <span>RTO: <strong className="text-[#F5F5F5]">{vehicle.rto_office || 'Not provided'} {vehicle.rto_code ? `(${vehicle.rto_code})` : ''}</strong></span>
                <span>•</span>
                <span>Odometer: <strong className="text-[#F5F5F5] font-mono">{(vehicle.odometer_reading || 0).toLocaleString()} KM</strong></span>
                <span>•</span>
                <span>Driver: <strong className="text-[#22C55E]">{vehicle.driver_name || 'Not assigned'}</strong></span>
                <span>•</span>
                <span>Fleet: <strong className="text-[#60A5FA]">{vehicle.fleet_name || 'Not assigned'}</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Health Summary Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#111113] p-3.5 rounded-2xl border border-[#3F3F46] text-xs">
            <div className="text-center p-2 rounded-xl bg-[#18181B] border border-[#3F3F46]">
              <span className="text-[10px] text-[#71717A] block font-semibold">Insurance</span>
              <span className={`font-bold mt-0.5 block ${
                !insurance ? 'text-[#71717A]' : insurance.status === 'Expired' ? 'text-[#FF6B6B]' : 'text-[#22C55E]'
              }`}>
                {insurance?.status || 'Not Added'}
              </span>
            </div>
            <div className="text-center p-2 rounded-xl bg-[#18181B] border border-[#3F3F46]">
              <span className="text-[10px] text-[#71717A] block font-semibold">PUC Emission</span>
              <span className={`font-bold mt-0.5 block ${
                !puc ? 'text-[#71717A]' : puc.status === 'Expired' ? 'text-[#FF6B6B]' : 'text-[#22C55E]'
              }`}>
                {puc?.status || 'Not Added'}
              </span>
            </div>
            <div className="text-center p-2 rounded-xl bg-[#18181B] border border-[#3F3F46]">
              <span className="text-[10px] text-[#71717A] block font-semibold">Fitness Cert</span>
              <span className={`font-bold mt-0.5 block ${
                !fitness ? 'text-[#71717A]' : fitness.status === 'Expired' ? 'text-[#FF6B6B]' : 'text-[#22C55E]'
              }`}>
                {fitness?.status || 'Not Added'}
              </span>
            </div>
            <div className="text-center p-2 rounded-xl bg-[#18181B] border border-[#3F3F46]">
              <span className="text-[10px] text-[#71717A] block font-semibold">FASTag Balance</span>
              <span className={`font-bold mt-0.5 block font-mono ${
                !fastag ? 'text-[#71717A]' :
                fastag.wallet_balance < fastag.minimum_balance ? 'text-[#F59E0B]' : 'text-[#60A5FA]'
              }`}>
                {fastag ? `₹${fastag.wallet_balance.toFixed(2)}` : 'Not Linked'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Tabs Navigation Bar */}
      <div className="overflow-x-auto flex space-x-1 p-1 bg-[#18181B] rounded-2xl border border-[#3F3F46] shadow-md">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold transition flex items-center space-x-2 shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[#B71C1C] text-[#F5F5F5] border border-[#FF1744]/40 shadow-[0_0_12px_rgba(229,57,53,0.35)]'
                  : 'text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#202024]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#FF1744] text-[#F5F5F5] rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENTS */}

      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Key Specifications Card */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F5F5F5] flex items-center space-x-2">
                <Truck className="w-4 h-4 text-[#E53935]" />
                <span>Technical & Registration Specifications</span>
              </h3>
              <button
                onClick={() => setIsThresholdModalOpen(true)}
                className="px-2.5 py-1 bg-[#27272A] hover:bg-[#3F3F46] border border-[#52525B] rounded-lg text-[#F5F5F5] text-xs font-medium flex items-center space-x-1 cursor-pointer"
              >
                <Sliders className="w-3 h-3 text-[#FF1744]" />
                <span>Vehicle Thresholds</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block">Chassis Number</span>
                <span className="font-semibold text-[#F5F5F5] font-mono">{vehicle.chassis_number || 'Not provided'}</span>
              </div>
              <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block">Engine Number</span>
                <span className="font-semibold text-[#F5F5F5] font-mono">{vehicle.engine_number || 'Not provided'}</span>
              </div>
              <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block">Fuel Type</span>
                <span className="font-semibold text-[#F5F5F5]">
                  {vehicle.fuel_type === 'CNG' ? 'CNG (Compressed Natural Gas)' : (vehicle.fuel_type || 'Diesel')}
                </span>
              </div>
              <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block">Vehicle Color</span>
                <span className="font-semibold text-[#F5F5F5]">{vehicle.color || 'Not provided'}</span>
              </div>
              <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block">Seating / Load Capacity</span>
                <span className="font-semibold text-[#F5F5F5]">
                  {vehicle.seating_capacity && vehicle.seating_capacity > 0
                    ? `${vehicle.seating_capacity} Seats`
                    : vehicle.load_capacity_kg
                    ? `${vehicle.load_capacity_kg} kg Payload`
                    : 'Not provided'}
                </span>
              </div>
              <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block">Gross Weight (GVW)</span>
                <span className="font-semibold text-[#F5F5F5]">{vehicle.gross_vehicle_weight_kg ? `${vehicle.gross_vehicle_weight_kg.toLocaleString()} kg` : 'Not provided'}</span>
              </div>
              <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block">Number of Axles</span>
                <span className="font-semibold text-[#F5F5F5]">{vehicle.axles_count ? `${vehicle.axles_count} Axles` : 'Not provided'}</span>
              </div>
              <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block">Mfg Year / Reg Date</span>
                <span className="font-semibold text-[#F5F5F5]">{vehicle.manufacturing_year || 'Not provided'} {vehicle.registration_date ? `(${vehicle.registration_date})` : ''}</span>
              </div>
              <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block">Fuel Tank / Capacity</span>
                <span className="font-semibold text-[#F5F5F5] font-mono">{vehicle.fuel_tank_capacity ? `${vehicle.fuel_tank_capacity} Litres` : 'Not provided'}</span>
              </div>
              <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block">Current Fuel Level</span>
                <span className="font-semibold text-[#F5F5F5] font-mono">{vehicle.current_fuel_level != null ? `${vehicle.current_fuel_level} Litres` : 'Not provided'}</span>
              </div>
              <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block">Mileage / Efficiency</span>
                <span className="font-semibold text-[#22C55E] font-mono">{vehicle.fuel_efficiency ? `${vehicle.fuel_efficiency} km/L` : 'Not provided'}</span>
              </div>
              {vehicle.fuel_type === 'Electric' && (
                <>
                  <div className="p-3 bg-[#0F2A1A] rounded-xl border border-[#22C55E]/40">
                    <span className="text-[#22C55E] block font-medium">EV Battery Capacity</span>
                    <span className="font-bold text-[#F5F5F5] font-mono">{vehicle.battery_capacity ? `${vehicle.battery_capacity} kWh` : 'Not provided'}</span>
                  </div>
                  <div className="p-3 bg-[#0F2A1A] rounded-xl border border-[#22C55E]/40">
                    <span className="text-[#22C55E] block font-medium">Charging Connector</span>
                    <span className="font-bold text-[#F5F5F5]">{vehicle.charging_type || 'Not provided'}</span>
                  </div>
                  <div className="p-3 bg-[#0F2A1A] rounded-xl border border-[#22C55E]/40">
                    <span className="text-[#22C55E] block font-medium">Single Charge Range</span>
                    <span className="font-bold text-[#F5F5F5] font-mono">{vehicle.electric_range_km ? `${vehicle.electric_range_km} KM` : 'Not provided'}</span>
                  </div>
                </>
              )}
              <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block">Current Estimated Value</span>
                <span className="font-semibold text-[#22C55E] font-mono">{vehicle.current_value ? `₹${vehicle.current_value.toLocaleString()}` : 'Not provided'}</span>
              </div>
              <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block">Usage Type</span>
                <span className="font-semibold text-[#60A5FA]">{vehicle.usage_type || 'Not provided'}</span>
              </div>
            </div>

            {vehicle.notes && (
              <div className="p-3.5 bg-[#111113] rounded-xl border border-[#3F3F46] text-xs">
                <span className="font-bold text-[#A1A1AA] block mb-1">Equipment & Telematics Notes:</span>
                <p className="text-[#D4D4D8]">{vehicle.notes}</p>
              </div>
            )}
          </div>

          {/* Right Side: Assigned Driver & Quick Contacts */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-[#F5F5F5] flex items-center space-x-2">
                <User className="w-4 h-4 text-[#22C55E]" />
                <span>Assigned Fleet Driver</span>
              </h3>

              {vehicle.driver_name ? (
                <div className="p-4 rounded-xl bg-[#111113] border border-[#3F3F46] space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#F5F5F5] text-sm">{vehicle.driver_name}</span>
                    <span className="px-2 py-0.5 bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40 rounded text-[10px] font-bold">★ {vehicle.driver_rating || '5.0'}</span>
                  </div>
                  <div>
                    <DriverContactActions phone={vehicle.driver_phone} driverName={vehicle.driver_name} size="sm" />
                  </div>
                  <p className="text-[#A1A1AA] text-[11px]">License: <strong className="text-[#F5F5F5]">{vehicle.driver_license || 'Not provided'}</strong></p>
                  {vehicle.current_location_name && (
                    <p className="text-[#A1A1AA] text-[11px]">Last Location: <strong className="text-[#60A5FA]">{vehicle.current_location_name}</strong></p>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center text-[#71717A] text-xs bg-[#111113] rounded-xl border border-dashed border-[#3F3F46]">
                  No driver currently assigned to this vehicle.
                </div>
              )}
            </div>

            {/* Ownership & Fleet Assignment */}
            <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-3 text-xs">
              <h3 className="text-sm font-bold text-[#F5F5F5]">Ownership & Fleet Assignment</h3>
              <p className="text-[#A1A1AA]">Assigned Fleet: <strong className="text-[#60A5FA]">{vehicle.fleet_name || 'Not provided'}</strong></p>
              <p className="text-[#A1A1AA]">Registered Owner: <strong className="text-[#F5F5F5]">{vehicle.owner_name || 'Not provided'}</strong></p>
              <p className="text-[#A1A1AA]">Owner Contact: <strong className="text-[#D4D4D8]">{vehicle.owner_phone || 'Not provided'}</strong></p>
              <p className="text-[#A1A1AA]">Registered Address: <strong className="text-[#D4D4D8]">{vehicle.owner_address || 'Not provided'}</strong></p>
            </div>
          </div>
        </div>
      )}

      {/* 2. RTO TAB */}
      {activeTab === 'rto' && (
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#3F3F46] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#F5F5F5]">Registration Certificate (RC) & RTO Details</h3>
              <p className="text-xs text-[#A1A1AA]">Vahan database mapping & hypothecation bank status</p>
            </div>
            <span className="px-3 py-1 text-xs font-bold bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40 rounded-lg">
              RC Status: {rto?.status || 'Active'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
              <span className="text-[#71717A] block mb-1">RC SmartCard Number</span>
              <span className="font-bold text-[#F5F5F5] font-mono text-sm">{rto?.rc_number || vehicle.vehicle_number}</span>
            </div>
            <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
              <span className="text-[#71717A] block mb-1">Registration Date</span>
              <span className="font-semibold text-[#F5F5F5]">{rto?.registration_date || vehicle.registration_date || 'Not provided'}</span>
            </div>
            <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
              <span className="text-[#71717A] block mb-1">Registration Validity</span>
              <span className="font-semibold text-[#22C55E]">{rto?.registration_validity || 'Not provided'}</span>
            </div>
            <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
              <span className="text-[#71717A] block mb-1">RTO Office Name</span>
              <span className="font-semibold text-[#F5F5F5]">{rto?.rto_office || vehicle.rto_office || 'Not provided'}</span>
            </div>
            <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
              <span className="text-[#71717A] block mb-1">RTO Code</span>
              <span className="font-semibold text-[#FF1744] font-mono text-sm">{rto?.rto_code || vehicle.rto_code || 'Not provided'}</span>
            </div>
            <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
              <span className="text-[#71717A] block mb-1">Financed By (Hypothecation Bank)</span>
              <span className="font-semibold text-[#D4D4D8]">{rto?.hypothecation_bank || 'No Hypothecation (Self-Owned)'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. INSURANCE TAB */}
      {activeTab === 'insurance' && (
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#3F3F46] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#F5F5F5]">Commercial Insurance Policy Management</h3>
              <p className="text-xs text-[#A1A1AA]">Coverage, Insured Declared Value (IDV) & claim tracking</p>
            </div>
            <div className="flex items-center gap-3">
              {insurance && (
                <>
                  <span className={`px-3 py-1 text-xs font-bold rounded-lg border ${
                    insurance.status === 'Expired' ? 'bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]' : 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40'
                  }`}>
                    Policy: {insurance.status}
                  </span>
                  <button
                    onClick={() => setItemToDelete({
                      type: 'Insurance Policy',
                      id: insurance.id,
                      name: `Policy #${insurance.policy_number} (${insurance.insurance_company})`,
                      action: async () => {
                        await api.deleteInsurance(insurance.id);
                        await loadProfile();
                      }
                    })}
                    className="px-3 py-1.5 bg-[#3F1111] hover:bg-[#B71C1C] text-[#FF1744] hover:text-[#F5F5F5] border border-[#7F1D1D] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                    title="Delete Insurance Policy"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </>
              )}
              <button
                onClick={() => setIsInsuranceModalOpen(true)}
                className="px-3 py-1.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer border border-[#FF1744]/30"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{insurance ? 'Update Insurance' : '+ Add Insurance'}</span>
              </button>
            </div>
          </div>

          {insurance ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Insurance Company</span>
                <span className="font-bold text-[#F5F5F5] text-sm">{insurance.insurance_company}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Policy Number</span>
                <span className="font-semibold text-[#60A5FA] font-mono text-sm">{insurance.policy_number}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Insurance Type</span>
                <span className="font-semibold text-[#F5F5F5]">{insurance.insurance_type}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Start Date</span>
                <span className="font-semibold text-[#F5F5F5]">{insurance.policy_start_date}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Expiry Date</span>
                <span className="font-bold text-[#FF1744] font-mono">{insurance.policy_expiry_date}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Insured Declared Value (IDV)</span>
                <span className="font-bold text-[#22C55E] font-mono text-sm">₹{insurance.insured_declared_value.toLocaleString()}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Annual Premium Amount</span>
                <span className="font-bold text-[#F5F5F5] font-mono">₹{insurance.premium_amount.toLocaleString()}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Agent / Broker</span>
                <span className="font-semibold text-[#D4D4D8]">{insurance.agent_name || 'Direct'} {insurance.agent_contact ? `(${insurance.agent_contact})` : ''}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Claim History</span>
                <span className="font-semibold text-[#D4D4D8]">{insurance.claim_details || 'Zero claims'}</span>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center space-y-3 bg-[#111113] rounded-xl border border-dashed border-[#3F3F46]">
              <Shield className="w-8 h-8 text-[#71717A] mx-auto" />
              <p className="text-[#A1A1AA] text-xs">No active insurance policy registered for this vehicle.</p>
              <button
                onClick={() => setIsInsuranceModalOpen(true)}
                className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-semibold cursor-pointer border border-[#FF1744]/30"
              >
                + Register Policy Now
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. PUC TAB */}
      {activeTab === 'puc' && (
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#3F3F46] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#F5F5F5]">Pollution Under Control (PUC) Certificate</h3>
              <p className="text-xs text-[#A1A1AA]">Emission norms compliance & test station certifications</p>
            </div>
            <div className="flex items-center gap-3">
              {puc && (
                <>
                  <span className={`px-3 py-1 text-xs font-bold rounded-lg border ${
                    puc.status === 'Expired' ? 'bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]' : 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40'
                  }`}>
                    {puc.status}
                  </span>
                  <button
                    onClick={() => setItemToDelete({
                      type: 'PUC Certificate',
                      id: puc.id,
                      name: `Cert #${puc.certificate_number}`,
                      action: async () => {
                        await api.deletePUC(puc.id);
                        await loadProfile();
                      }
                    })}
                    className="px-3 py-1.5 bg-[#3F1111] hover:bg-[#B71C1C] text-[#FF1744] hover:text-[#F5F5F5] border border-[#7F1D1D] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                    title="Delete PUC Record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </>
              )}
              <button
                onClick={() => setIsPUCModalOpen(true)}
                className="px-3 py-1.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer border border-[#FF1744]/30"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{puc ? 'Update PUC' : '+ Add PUC'}</span>
              </button>
            </div>
          </div>

          {puc ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">PUC Certificate Number</span>
                <span className="font-bold text-[#F5F5F5] font-mono text-sm">{puc.certificate_number}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Issue Date</span>
                <span className="font-semibold text-[#F5F5F5]">{puc.issue_date}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Expiry Date</span>
                <span className="font-bold text-[#FF1744] font-mono">{puc.expiry_date}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46] sm:col-span-2">
                <span className="text-[#71717A] block mb-1">Emission Readings</span>
                <span className="font-semibold text-[#D4D4D8] font-mono">{puc.emission_reading || 'Standard Compliant'}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Testing Center</span>
                <span className="font-semibold text-[#D4D4D8]">{puc.testing_center || 'Not specified'}</span>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center space-y-3 bg-[#111113] rounded-xl border border-dashed border-[#3F3F46]">
              <Wind className="w-8 h-8 text-[#71717A] mx-auto" />
              <p className="text-[#A1A1AA] text-xs">No PUC record found for this vehicle.</p>
              <button
                onClick={() => setIsPUCModalOpen(true)}
                className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-semibold cursor-pointer border border-[#FF1744]/30"
              >
                + Record PUC Certificate
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. FITNESS TAB */}
      {activeTab === 'fitness' && (
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#3F3F46] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#F5F5F5]">Commercial Vehicle Fitness Certificate</h3>
              <p className="text-xs text-[#A1A1AA]">Automated Vehicle Testing Station (ATS) inspection track records</p>
            </div>
            <div className="flex items-center gap-3">
              {fitness && (
                <>
                  <span className={`px-3 py-1 text-xs font-bold rounded-lg border ${
                    fitness.status === 'Expired' ? 'bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]' : 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40'
                  }`}>
                    {fitness.status}
                  </span>
                  <button
                    onClick={() => setItemToDelete({
                      type: 'Fitness Certificate',
                      id: fitness.id,
                      name: `Cert #${fitness.certificate_number}`,
                      action: async () => {
                        await api.deleteFitness(fitness.id);
                        await loadProfile();
                      }
                    })}
                    className="px-3 py-1.5 bg-[#3F1111] hover:bg-[#B71C1C] text-[#FF1744] hover:text-[#F5F5F5] border border-[#7F1D1D] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                    title="Delete Fitness Certificate"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </>
              )}
              <button
                onClick={() => setIsFitnessModalOpen(true)}
                className="px-3 py-1.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer border border-[#FF1744]/30"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{fitness ? 'Update Fitness' : '+ Add Fitness'}</span>
              </button>
            </div>
          </div>

          {fitness ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Fitness Certificate Number</span>
                <span className="font-bold text-[#F5F5F5] font-mono text-sm">{fitness.certificate_number}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Inspection Date</span>
                <span className="font-semibold text-[#F5F5F5]">{fitness.inspection_date}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Validity Expiry Date</span>
                <span className="font-bold text-[#FF1744] font-mono">{fitness.expiry_date}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46] sm:col-span-2">
                <span className="text-[#71717A] block mb-1">ATS Testing Ground / Station</span>
                <span className="font-semibold text-[#D4D4D8]">{fitness.testing_center || 'Not specified'}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Vehicle Classification</span>
                <span className="font-semibold text-[#60A5FA]">{fitness.vehicle_class || vehicle.vehicle_type || 'Commercial'}</span>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center space-y-3 bg-[#111113] rounded-xl border border-dashed border-[#3F3F46]">
              <CheckSquare className="w-8 h-8 text-[#71717A] mx-auto" />
              <p className="text-[#A1A1AA] text-xs">No fitness certificate found for this vehicle.</p>
              <button
                onClick={() => setIsFitnessModalOpen(true)}
                className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-semibold cursor-pointer border border-[#FF1744]/30"
              >
                + Record Fitness Certificate
              </button>
            </div>
          )}
        </div>
      )}

      {/* 6. PERMITS TAB */}
      {activeTab === 'permits' && (
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#3F3F46] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#F5F5F5]">Commercial Vehicle Permits</h3>
              <p className="text-xs text-[#A1A1AA]">National Permit, All-India Tourist Permit, State Goods & School Bus Permits</p>
            </div>
            <div className="flex items-center gap-3">
              {permit && (
                <>
                  <span className="px-3 py-1 text-xs font-bold bg-[#3F1111] text-[#FF1744] border border-[#7F1D1D] rounded-lg">
                    {permit.permit_type}
                  </span>
                  <button
                    onClick={() => setItemToDelete({
                      type: 'Permit Record',
                      id: permit.id,
                      name: `Permit #${permit.permit_number}`,
                      action: async () => {
                        await api.deletePermit(permit.id);
                        await loadProfile();
                      }
                    })}
                    className="px-3 py-1.5 bg-[#3F1111] hover:bg-[#B71C1C] text-[#FF1744] hover:text-[#F5F5F5] border border-[#7F1D1D] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                    title="Delete Permit"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </>
              )}
              <button
                onClick={() => setIsPermitModalOpen(true)}
                className="px-3 py-1.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer border border-[#FF1744]/30"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{permit ? 'Update Permit' : '+ Add Permit'}</span>
              </button>
            </div>
          </div>

          {permit ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Permit Number</span>
                <span className="font-bold text-[#F5F5F5] font-mono text-sm">{permit.permit_number}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Permit Type</span>
                <span className="font-semibold text-[#F5F5F5]">{permit.permit_type}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Coverage Area</span>
                <span className="font-semibold text-[#60A5FA]">{permit.permit_area || 'Not specified'}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Issuing Authority</span>
                <span className="font-semibold text-[#D4D4D8]">{permit.issuing_authority || 'State Transport Authority'}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Expiry Date</span>
                <span className="font-bold text-[#FF1744] font-mono">{permit.expiry_date}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Fee Paid</span>
                <span className="font-bold text-[#22C55E] font-mono">₹{(permit.fee_paid || 0).toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center space-y-3 bg-[#111113] rounded-xl border border-dashed border-[#3F3F46]">
              <FileSpreadsheet className="w-8 h-8 text-[#71717A] mx-auto" />
              <p className="text-[#A1A1AA] text-xs">No active commercial permits recorded.</p>
              <button
                onClick={() => setIsPermitModalOpen(true)}
                className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-semibold cursor-pointer border border-[#FF1744]/30"
              >
                + Add Transport Permit
              </button>
            </div>
          )}
        </div>
      )}

      {/* 7. ROAD TAX TAB */}
      {activeTab === 'roadtax' && (
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#3F3F46] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#F5F5F5]">Road Tax Schedule & Receipts</h3>
              <p className="text-xs text-[#A1A1AA]">Vahan Road Tax cycle payments</p>
            </div>
            <div className="flex items-center gap-3">
              {roadTax && (
                <>
                  <span className="px-3 py-1 text-xs font-bold bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40 rounded-lg">
                    Status: {roadTax.status}
                  </span>
                  <button
                    onClick={() => setItemToDelete({
                      type: 'Road Tax Record',
                      id: roadTax.id,
                      name: `Receipt #${roadTax.receipt_number || roadTax.id}`,
                      action: async () => {
                        await api.deleteRoadTax(roadTax.id);
                        await loadProfile();
                      }
                    })}
                    className="px-3 py-1.5 bg-[#3F1111] hover:bg-[#B71C1C] text-[#FF1744] hover:text-[#F5F5F5] border border-[#7F1D1D] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                    title="Delete Road Tax Record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </>
              )}
              <button
                onClick={() => setIsRoadTaxModalOpen(true)}
                className="px-3 py-1.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer border border-[#FF1744]/30"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Pay Road Tax</span>
              </button>
            </div>
          </div>

          {roadTax ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Tax Type</span>
                <span className="font-bold text-[#F5F5F5]">{roadTax.tax_type}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Tax Amount Paid</span>
                <span className="font-bold text-[#22C55E] font-mono text-sm">₹{roadTax.tax_amount.toLocaleString()}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Next Tax Due Date</span>
                <span className="font-bold text-[#FF1744] font-mono">{roadTax.next_due_date}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Vahan Receipt Number</span>
                <span className="font-semibold text-[#D4D4D8] font-mono">{roadTax.receipt_number || '—'}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Payment Mode</span>
                <span className="font-semibold text-[#D4D4D8]">{roadTax.payment_mode || 'Online NetBanking'}</span>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center space-y-3 bg-[#111113] rounded-xl border border-dashed border-[#3F3F46]">
              <Receipt className="w-8 h-8 text-[#71717A] mx-auto" />
              <p className="text-[#A1A1AA] text-xs">No road tax payment records found.</p>
              <button
                onClick={() => setIsRoadTaxModalOpen(true)}
                className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-semibold cursor-pointer border border-[#FF1744]/30"
              >
                + Record Road Tax Payment
              </button>
            </div>
          )}
        </div>
      )}

      {/* 8. FASTAG TAB */}
      {activeTab === 'fastag' && (
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#3F3F46] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#F5F5F5]">FASTag Wallet & Electronic Toll Collection</h3>
              <p className="text-xs text-[#A1A1AA]">Live balance, toll plaza passage logs and instant recharge</p>
            </div>
            <div className="flex items-center gap-2">
              {fastag ? (
                <>
                  <button
                    onClick={() => setItemToDelete({
                      type: 'FASTag Account',
                      id: fastag.id,
                      name: `Tag #${fastag.fastag_id}`,
                      action: async () => {
                        await api.deleteFASTag(fastag.id);
                        await loadProfile();
                      }
                    })}
                    className="px-3 py-2 bg-[#3F1111] hover:bg-[#B71C1C] text-[#FF1744] hover:text-[#F5F5F5] border border-[#7F1D1D] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                    title="Delete FASTag Account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete FASTag</span>
                  </button>
                  <button
                    onClick={() => setIsRechargeModalOpen(true)}
                    className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-md flex items-center space-x-1.5 cursor-pointer border border-[#FF1744]/30"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>+ Recharge Wallet</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsFASTagModalOpen(true)}
                  className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-md flex items-center space-x-1.5 cursor-pointer border border-[#FF1744]/30"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>+ Link FASTag Account</span>
                </button>
              )}
            </div>
          </div>

          {fastag ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Current Wallet Balance</span>
                <span className="font-extrabold text-[#60A5FA] text-xl font-mono">₹{fastag.wallet_balance.toFixed(2)}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">FASTag Tag ID / Issuer</span>
                <span className="font-semibold text-[#F5F5F5] font-mono">{fastag.fastag_id}</span>
                <span className="text-[#A1A1AA] block text-[11px] mt-0.5">{fastag.issuer_bank}</span>
              </div>
              <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46]">
                <span className="text-[#71717A] block mb-1">Minimum Alert Threshold</span>
                <span className="font-semibold text-[#F5F5F5] font-mono">₹{fastag.minimum_balance.toFixed(2)}</span>
                <span className={`text-[10px] font-bold block mt-0.5 ${fastag.wallet_balance < fastag.minimum_balance ? 'text-[#F59E0B]' : 'text-[#22C55E]'}`}>
                  {fastag.wallet_balance < fastag.minimum_balance ? '⚠ Balance below threshold' : '✓ Sufficient Balance'}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-[#71717A] text-xs bg-[#111113] rounded-xl border border-dashed border-[#3F3F46]">
              No FASTag account configured for this vehicle.
            </div>
          )}

          {/* Toll Plaza Transactions Table */}
          <div>
            <h4 className="text-xs font-bold text-[#A1A1AA] uppercase tracking-wider mb-3">Recent Toll Plaza Transactions</h4>
            {fastagTxns.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-[#3F3F46]">
                <table className="w-full text-left text-xs text-[#F5F5F5]">
                  <thead className="bg-[#27272A] text-[#F5F5F5] text-[11px]">
                    <tr>
                      <th className="p-3">Date & Time</th>
                      <th className="p-3">Toll Plaza Name</th>
                      <th className="p-3">Highway Location</th>
                      <th className="p-3">Lane</th>
                      <th className="p-3">Toll Amount</th>
                      <th className="p-3">Balance After</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3F3F46]">
                    {fastagTxns.map((t) => (
                      <tr key={t.id} className="hover:bg-[#202024] bg-[#18181B]">
                        <td className="p-3 font-mono text-[11px] text-[#A1A1AA]">{t.transaction_date}</td>
                        <td className="p-3 font-semibold text-[#F5F5F5]">{t.toll_plaza_name}</td>
                        <td className="p-3 text-[#A1A1AA]">{t.location || 'Expressway'}</td>
                        <td className="p-3 text-[#A1A1AA]">{t.lane_number || 'ETC Lane'}</td>
                        <td className="p-3 font-bold text-[#F59E0B] font-mono">-₹{t.amount.toFixed(2)}</td>
                        <td className="p-3 font-mono text-[#60A5FA]">₹{t.balance_after.toFixed(2)}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setItemToDelete({
                              type: 'FASTag Transaction',
                              id: t.id,
                              name: `${t.toll_plaza_name} (₹${t.amount})`,
                              action: async () => {
                                await api.deleteFASTagTransaction(t.id);
                                await loadProfile();
                              }
                            })}
                            className="p-1 text-[#FF1744] hover:text-[#FF6B6B] hover:bg-[#3F1111] rounded transition cursor-pointer"
                            title="Delete Transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-6 text-center text-[#71717A] text-xs border border-dashed border-[#3F3F46] rounded-xl bg-[#111113]">
                No toll transactions recorded yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 9. CHALLANS TAB */}
      {activeTab === 'challans' && (
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#3F3F46] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#F5F5F5]">Traffic Police Challans & Violations</h3>
              <p className="text-xs text-[#A1A1AA]">Fine settlements and court due dates</p>
            </div>
            <button
              onClick={() => setIsChallanModalOpen(true)}
              className="px-3.5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer border border-[#FF1744]/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Record Challan</span>
            </button>
          </div>

          {challans.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-[#3F3F46]">
              <table className="w-full text-left text-xs text-[#F5F5F5]">
                <thead className="bg-[#27272A] text-[#F5F5F5] text-[11px]">
                  <tr>
                    <th className="p-3">Challan No</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Offence & Location</th>
                    <th className="p-3">Fine Amount</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3F3F46]">
                  {challans.map((c) => (
                    <tr key={c.id} className="hover:bg-[#202024] bg-[#18181B]">
                      <td className="p-3 font-bold text-[#F5F5F5] font-mono">{c.challan_number}</td>
                      <td className="p-3 text-[#A1A1AA]">{c.date}</td>
                      <td className="p-3">
                        <span className="font-semibold text-[#F5F5F5] block">{c.offence}</span>
                        <span className="text-[11px] text-[#A1A1AA]">{c.location || '—'}</span>
                      </td>
                      <td className="p-3 font-bold text-[#FF1744] font-mono text-sm">₹{c.amount.toLocaleString()}</td>
                      <td className="p-3 font-mono text-[#A1A1AA]">{c.due_date}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.payment_status === 'Paid' ? 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40' :
                          c.payment_status === 'Overdue' ? 'bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]' :
                          'bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/40'
                        }`}>
                          {c.payment_status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setItemToDelete({
                            type: 'Traffic Challan',
                            id: c.id,
                            name: `Challan #${c.challan_number} (₹${c.amount})`,
                            action: async () => {
                              await api.deleteChallan(c.id);
                              await loadProfile();
                            }
                          })}
                          className="p-1.5 text-[#FF1744] hover:text-[#FF6B6B] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                          title="Delete Challan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center space-y-3 bg-[#111113] rounded-xl border border-dashed border-[#3F3F46]">
              <AlertTriangle className="w-8 h-8 text-[#22C55E] mx-auto" />
              <p className="text-[#A1A1AA] text-xs">Zero traffic challans recorded for this vehicle.</p>
              <button
                onClick={() => setIsChallanModalOpen(true)}
                className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs font-semibold cursor-pointer border border-[#52525B]"
              >
                + Log Traffic Challan
              </button>
            </div>
          )}
        </div>
      )}

      {/* 10. FUEL & MILEAGE TAB */}
      {activeTab === 'fuel' && (
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#3F3F46] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#F5F5F5]">Fuel Logs & Consumption Efficiency</h3>
              <p className="text-xs text-[#A1A1AA]">Refill logs, fuel stations & calculated KM/L performance</p>
            </div>
            <button
              onClick={() => setIsFuelModalOpen(true)}
              className="px-3.5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer border border-[#FF1744]/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Record Refill</span>
            </button>
          </div>

          {fuelLogs.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-[#3F3F46]">
              <table className="w-full text-left text-xs text-[#F5F5F5]">
                <thead className="bg-[#27272A] text-[#F5F5F5] text-[11px]">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Fuel Station</th>
                    <th className="p-3">Quantity</th>
                    <th className="p-3">Price/L</th>
                    <th className="p-3">Total Cost</th>
                    <th className="p-3">Odometer</th>
                    <th className="p-3">Mileage (KM/L)</th>
                    <th className="p-3">Cost / KM</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3F3F46]">
                  {fuelLogs.map((f) => (
                    <tr key={f.id} className="hover:bg-[#202024] bg-[#18181B]">
                      <td className="p-3 font-mono text-[#A1A1AA]">{f.date}</td>
                      <td className="p-3 font-semibold text-[#F5F5F5]">{f.fuel_station}</td>
                      <td className="p-3 font-mono text-[#D4D4D8]">{f.quantity_litres} L</td>
                      <td className="p-3 font-mono text-[#D4D4D8]">₹{f.price_per_litre}</td>
                      <td className="p-3 font-bold text-[#F59E0B] font-mono">₹{f.total_amount.toLocaleString()}</td>
                      <td className="p-3 font-mono text-[#A1A1AA]">{f.odometer_reading.toLocaleString()} km</td>
                      <td className="p-3 font-bold text-[#22C55E] font-mono">{f.km_per_litre ? `${f.km_per_litre} km/L` : '—'}</td>
                      <td className="p-3 font-mono text-[#60A5FA]">{f.cost_per_km ? `₹${f.cost_per_km}/km` : '—'}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setItemToDelete({
                            type: 'Fuel Record',
                            id: f.id,
                            name: `${f.fuel_station} (${f.quantity_litres}L, ₹${f.total_amount})`,
                            action: async () => {
                              await api.deleteFuelLog(f.id);
                              await loadProfile();
                            }
                          })}
                          className="p-1.5 text-[#FF1744] hover:text-[#FF6B6B] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                          title="Delete Fuel Log"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center space-y-3 bg-[#111113] rounded-xl border border-dashed border-[#3F3F46]">
              <Fuel className="w-8 h-8 text-[#71717A] mx-auto" />
              <p className="text-[#A1A1AA] text-xs">No fuel records logged yet.</p>
              <button
                onClick={() => setIsFuelModalOpen(true)}
                className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-semibold cursor-pointer border border-[#FF1744]/30"
              >
                + Record First Refill
              </button>
            </div>
          )}
        </div>
      )}

      {/* 11. MAINTENANCE & SERVICE TAB */}
      {activeTab === 'maintenance' && (
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#3F3F46] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#F5F5F5]">Workshop Service & Mechanical Maintenance</h3>
              <p className="text-xs text-[#A1A1AA]">Parts replacement, labour costs, and next service interval triggers</p>
            </div>
            <button
              onClick={() => setIsServiceModalOpen(true)}
              className="px-3.5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer border border-[#FF1744]/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Log Service</span>
            </button>
          </div>

          {serviceHistory.length > 0 ? (
            <div className="space-y-4">
              {serviceHistory.map((s) => (
                <div key={s.id} className="p-4 rounded-xl bg-[#111113] border border-[#3F3F46] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-[#F5F5F5] text-sm">{s.service_type}</span>
                      <span className="text-xs text-[#A1A1AA] block">{s.workshop_name} {s.mechanic_name ? `(Tech: ${s.mechanic_name})` : ''}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-[#22C55E] font-mono">₹{s.total_cost.toLocaleString()}</span>
                        <span className="text-[10px] text-[#71717A] block font-mono">Date: {s.service_date}</span>
                      </div>
                      <button
                        onClick={() => setItemToDelete({
                          type: 'Service Record',
                          id: s.id,
                          name: `${s.service_type} (${s.workshop_name}, ₹${s.total_cost})`,
                          action: async () => {
                            await api.deleteService(s.id);
                            await loadProfile();
                          }
                        })}
                        className="p-1.5 text-[#FF1744] hover:text-[#FF6B6B] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                        title="Delete Service Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-2 border-t border-[#3F3F46]">
                    <div>
                      <span className="text-[#71717A] block">Service Odometer</span>
                      <span className="font-semibold text-[#F5F5F5] font-mono">{s.current_odometer.toLocaleString()} km</span>
                    </div>
                    <div>
                      <span className="text-[#71717A] block">Next Service Trigger</span>
                      <span className="font-semibold text-[#60A5FA] font-mono">{s.next_service_odometer ? `${s.next_service_odometer.toLocaleString()} km` : '—'}</span>
                    </div>
                    <div>
                      <span className="text-[#71717A] block">Parts Cost</span>
                      <span className="font-semibold text-[#D4D4D8] font-mono">₹{s.parts_cost.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[#71717A] block">Labour Cost</span>
                      <span className="font-semibold text-[#D4D4D8] font-mono">₹{s.labour_cost.toLocaleString()}</span>
                    </div>
                  </div>

                  {s.parts_changed && (
                    <p className="text-xs text-[#D4D4D8] bg-[#18181B] p-2.5 rounded-lg border border-[#3F3F46]">
                      <strong className="text-[#F5F5F5]">Parts Changed:</strong> {s.parts_changed}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center space-y-3 bg-[#111113] rounded-xl border border-dashed border-[#3F3F46]">
              <Wrench className="w-8 h-8 text-[#71717A] mx-auto" />
              <p className="text-[#A1A1AA] text-xs">No service records registered for this vehicle.</p>
              <button
                onClick={() => setIsServiceModalOpen(true)}
                className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-semibold cursor-pointer border border-[#FF1744]/30"
              >
                + Log Workshop Service
              </button>
            </div>
          )}
        </div>
      )}

      {/* 12. TYRES & BATTERY TAB */}
      {activeTab === 'tyres-batteries' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tyres */}
          <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#3F3F46] pb-3">
              <h3 className="text-sm font-bold text-[#F5F5F5] flex items-center space-x-2">
                <Disc className="w-4 h-4 text-[#E53935]" />
                <span>Wheel & Tyre Positions</span>
              </h3>
              <button
                onClick={() => setIsTyreModalOpen(true)}
                className="px-2.5 py-1 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-lg text-xs font-semibold transition cursor-pointer border border-[#FF1744]/30"
              >
                + Add Tyre
              </button>
            </div>

            {tyres.length > 0 ? (
              <div className="space-y-3">
                {tyres.map((t) => (
                  <div key={t.id} className="p-3 rounded-xl bg-[#111113] border border-[#3F3F46] flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#F5F5F5]">{t.tyre_position}</span>
                      <p className="text-[11px] text-[#A1A1AA]">{t.brand} {t.size ? `(${t.size})` : ''}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.condition === 'Good' ? 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40' :
                          t.condition === 'Fair' ? 'bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/40' :
                          'bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]'
                        }`}>
                          {t.condition}
                        </span>
                        <span className="text-[10px] text-[#71717A] block mt-0.5 font-mono">{(t.current_km || 0).toLocaleString()} / {(t.expected_km || 0).toLocaleString()} km</span>
                      </div>
                      <button
                        onClick={() => setItemToDelete({
                          type: 'Tyre Record',
                          id: t.id,
                          name: `${t.tyre_position} (${t.brand})`,
                          action: async () => {
                            await api.deleteTyre(t.id);
                            await loadProfile();
                          }
                        })}
                        className="p-1.5 text-[#FF1744] hover:text-[#FF6B6B] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                        title="Delete Tyre Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-[#71717A] text-xs bg-[#111113] rounded-xl border border-dashed border-[#3F3F46]">No tyre records registered.</div>
            )}
          </div>

          {/* Battery */}
          <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#3F3F46] pb-3">
              <h3 className="text-sm font-bold text-[#F5F5F5] flex items-center space-x-2">
                <Disc className="w-4 h-4 text-[#22C55E]" />
                <span>Battery & Electrical Health</span>
              </h3>
              <button
                onClick={() => setIsBatteryModalOpen(true)}
                className="px-2.5 py-1 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-lg text-xs font-semibold transition cursor-pointer border border-[#FF1744]/30"
              >
                + Add Battery
              </button>
            </div>

            {batteries.length > 0 ? (
              <div className="space-y-3">
                {batteries.map((b) => (
                  <div key={b.id} className="p-4 rounded-xl bg-[#111113] border border-[#3F3F46] text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#F5F5F5] text-sm">{b.brand} {b.model || ''}</span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40">{b.current_condition}</span>
                        <button
                          onClick={() => setItemToDelete({
                            type: 'Battery Record',
                            id: b.id,
                            name: `${b.brand} (${b.battery_number || 'Battery'})`,
                            action: async () => {
                              await api.deleteBattery(b.id);
                              await loadProfile();
                            }
                          })}
                          className="p-1 text-[#FF1744] hover:text-[#FF6B6B] hover:bg-[#3F1111] rounded transition cursor-pointer"
                          title="Delete Battery Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[#A1A1AA]">Serial No: <strong className="text-[#F5F5F5] font-mono">{b.battery_number || '—'}</strong></p>
                    <p className="text-[#A1A1AA]">Warranty Expiry: <strong className="text-[#60A5FA] font-mono">{b.warranty_expiry || '—'}</strong></p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-[#71717A] text-xs bg-[#111113] rounded-xl border border-dashed border-[#3F3F46]">No battery record registered.</div>
            )}
          </div>
        </div>
      )}

      {/* 13. BOOKINGS & TRIPS TAB */}
      {activeTab === 'bookings' && (
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#3F3F46] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#F5F5F5]">Trip Bookings History</h3>
              <p className="text-xs text-[#A1A1AA]">Dispatches, customer accounts, and revenue collection</p>
            </div>
            <button
              onClick={() => setIsBookingModalOpen(true)}
              className="px-3.5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer border border-[#FF1744]/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Create Booking</span>
            </button>
          </div>

          {bookings.length > 0 ? (
            <div className="space-y-3">
              {bookings.map((b) => (
                <div key={b.id} className="p-4 rounded-xl bg-[#111113] border border-[#3F3F46] space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-[#F5F5F5] font-mono">{b.booking_number}</span>
                      <span className="text-[#A1A1AA] block font-medium">{b.customer_name} {b.customer_mobile ? `(${b.customer_mobile})` : ''}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-[#60A5FA] font-mono">₹{b.booking_amount.toLocaleString()}</span>
                        <span className="text-[10px] text-[#71717A] block font-mono">Status: {b.booking_status}</span>
                      </div>
                      <button
                        onClick={() => setItemToDelete({
                          type: 'Booking Record',
                          id: b.id,
                          name: `Booking #${b.booking_number} (${b.customer_name})`,
                          action: async () => {
                            await api.deleteBooking(b.id);
                            await loadProfile();
                          }
                        })}
                        className="p-1.5 text-[#FF1744] hover:text-[#FF6B6B] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                        title="Delete Booking"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 bg-[#18181B] rounded-lg border border-[#3F3F46] flex items-center justify-between">
                    <span className="text-[#D4D4D8]">Route: <strong className="text-[#F5F5F5]">{b.pickup_location}</strong> → <strong className="text-[#F5F5F5]">{b.drop_location}</strong></span>
                    <span className="text-[#A1A1AA] font-mono">{b.start_date} to {b.end_date}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center space-y-3 bg-[#111113] rounded-xl border border-dashed border-[#3F3F46]">
              <Calendar className="w-8 h-8 text-[#71717A] mx-auto" />
              <p className="text-[#A1A1AA] text-xs">No bookings recorded for this vehicle yet.</p>
              <button
                onClick={() => setIsBookingModalOpen(true)}
                className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-semibold cursor-pointer border border-[#FF1744]/30"
              >
                + Create Booking
              </button>
            </div>
          )}
        </div>
      )}

      {/* 14. EXPENSES TAB */}
      {activeTab === 'expenses' && (
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#3F3F46] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#F5F5F5]">Vehicle Expense Ledger</h3>
              <p className="text-xs text-[#A1A1AA]">All operating costs attributed to this vehicle</p>
            </div>
          </div>

          {expenses.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-[#3F3F46]">
              <table className="w-full text-left text-xs text-[#F5F5F5]">
                <thead className="bg-[#27272A] text-[#F5F5F5] text-[11px]">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Payment Mode</th>
                    <th className="p-3">Amount (₹)</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3F3F46]">
                  {expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-[#202024] bg-[#18181B]">
                      <td className="p-3 font-mono text-[#A1A1AA]">{e.expense_date || e.date}</td>
                      <td className="p-3"><span className="px-2 py-0.5 rounded bg-[#3F1111] text-[#FF1744] font-semibold border border-[#7F1D1D]">{e.category}</span></td>
                      <td className="p-3 text-[#F5F5F5]">{e.description || '—'}</td>
                      <td className="p-3 text-[#A1A1AA]">{e.payment_method || e.payment_mode || '—'}</td>
                      <td className="p-3 font-bold text-[#F5F5F5] font-mono">₹{e.amount.toLocaleString()}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setItemToDelete({
                            type: 'Expense Record',
                            id: e.id,
                            name: `${e.category} (₹${e.amount})`,
                            action: async () => {
                              await api.deleteExpense(e.id);
                              await loadProfile();
                            }
                          })}
                          className="p-1.5 text-[#FF1744] hover:text-[#FF6B6B] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-[#71717A] text-xs border border-dashed border-[#3F3F46] rounded-xl bg-[#111113]">
              No expenses recorded for this vehicle.
            </div>
          )}
        </div>
      )}

      {/* 15. DOCUMENTS VAULT TAB */}
      {activeTab === 'documents' && (
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#3F3F46] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#F5F5F5]">Vehicle Document Vault</h3>
              <p className="text-xs text-[#A1A1AA]">Digital copies of RC, Insurance, PUC, Fitness, Permits, and Invoices</p>
            </div>
          </div>

          {documents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <div key={doc.id} className="p-4 rounded-xl bg-[#111113] border border-[#3F3F46] flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-[#3F1111] border border-[#7F1D1D] rounded-xl text-[#FF1744]">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#F5F5F5] text-xs">{doc.document_name}</h4>
                      <p className="text-[11px] text-[#A1A1AA]">{doc.document_type} {doc.document_number ? `(${doc.document_number})` : ''}</p>
                      <span className="text-[10px] text-[#71717A] font-mono mt-0.5 block">{doc.file_size_kb || 0} KB • {doc.expiry_date ? `Exp: ${doc.expiry_date}` : 'Permanent'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-lg font-semibold text-xs border border-[#52525B]"
                    >
                      View
                    </a>
                    <button
                      onClick={() => setItemToDelete({
                        type: 'Vehicle Document',
                        id: doc.id,
                        name: doc.document_name,
                        action: async () => {
                          await api.deleteDocument(doc.id);
                          await loadProfile();
                        }
                      })}
                      className="p-1.5 text-[#FF1744] hover:text-[#FF6B6B] hover:bg-[#3F1111] rounded-lg border border-[#7F1D1D] transition cursor-pointer"
                      title="Delete Document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-[#71717A] text-xs border border-dashed border-[#3F3F46] rounded-xl bg-[#111113]">
              No digital documents uploaded in the vault for this vehicle yet.
            </div>
          )}
        </div>
      )}

      {/* 16. NOTIFICATIONS TAB */}
      {activeTab === 'notifications' && (
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-[#F5F5F5]">Automated Condition Alerts for this Vehicle</h3>
          {notifications.length > 0 ? (
            <div className="space-y-2.5">
              {notifications.map((n) => (
                <div key={n.id} className="p-3.5 rounded-xl bg-[#111113] border border-[#3F3F46] text-xs flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        n.severity === 'EXPIRED' ? 'bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]' :
                        n.severity === 'URGENT' ? 'bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]' :
                        n.severity === 'WARNING' ? 'bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/70' :
                        'bg-[#18181B] text-[#A1A1AA] border border-[#3F3F46]'
                      }`}>
                        {n.severity}
                      </span>
                      <span className="font-bold text-[#F5F5F5]">{n.title}</span>
                    </div>
                    <p className="text-[#A1A1AA]">{n.message}</p>
                  </div>
                  <span className="text-[10px] text-[#71717A] font-mono">{new Date(n.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-[#22C55E] text-xs border border-dashed border-[#3F3F46] rounded-xl bg-[#111113]">
              ✓ All clear! No active compliance warnings or threshold breaches for this vehicle.
            </div>
          )}
        </div>
      )}

      {/* 17. HISTORY TIMELINE TAB */}
      {activeTab === 'history' && (
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-6">
          <div className="border-b border-[#3F3F46] pb-4">
            <h3 className="text-base font-bold text-[#F5F5F5]">Complete Vehicle Lifecycle History</h3>
            <p className="text-xs text-[#A1A1AA]">Chronological timeline of registrations, services, trips, refills, and traffic events</p>
          </div>

          <VehicleTimeline events={timeline || []} />
        </div>
      )}

      {/* Modals for Quick Actions on this Vehicle */}
      <QuickFASTagRechargeModal
        isOpen={isRechargeModalOpen}
        onClose={() => setIsRechargeModalOpen(false)}
        onSuccess={loadProfile}
        vehicleId={vehicle.id}
        vehicleNumber={vehicle.vehicle_number}
        currentBalance={fastag?.wallet_balance}
      />

      <QuickFuelModal
        isOpen={isFuelModalOpen}
        onClose={() => setIsFuelModalOpen(false)}
        onSuccess={loadProfile}
        preselectedVehicleId={vehicle.id}
      />

      <QuickBookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        onSuccess={loadProfile}
        preselectedVehicleId={vehicle.id}
      />

      <AddInsuranceModal
        isOpen={isInsuranceModalOpen}
        onClose={() => setIsInsuranceModalOpen(false)}
        onSuccess={loadProfile}
        vehicleId={vehicle.id}
      />

      <AddPUCModal
        isOpen={isPUCModalOpen}
        onClose={() => setIsPUCModalOpen(false)}
        onSuccess={loadProfile}
        vehicleId={vehicle.id}
      />

      <AddFitnessModal
        isOpen={isFitnessModalOpen}
        onClose={() => setIsFitnessModalOpen(false)}
        onSuccess={loadProfile}
        vehicleId={vehicle.id}
      />

      <AddPermitModal
        isOpen={isPermitModalOpen}
        onClose={() => setIsPermitModalOpen(false)}
        onSuccess={loadProfile}
        vehicleId={vehicle.id}
      />

      <AddRoadTaxModal
        isOpen={isRoadTaxModalOpen}
        onClose={() => setIsRoadTaxModalOpen(false)}
        onSuccess={loadProfile}
        vehicleId={vehicle.id}
      />

      <AddFASTagModal
        isOpen={isFASTagModalOpen}
        onClose={() => setIsFASTagModalOpen(false)}
        onSuccess={loadProfile}
        vehicleId={vehicle.id}
      />

      <AddChallanModal
        isOpen={isChallanModalOpen}
        onClose={() => setIsChallanModalOpen(false)}
        onSuccess={loadProfile}
        vehicleId={vehicle.id}
      />

      <AddServiceModal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        onSuccess={loadProfile}
        vehicleId={vehicle.id}
      />

      <AddTyreModal
        isOpen={isTyreModalOpen}
        onClose={() => setIsTyreModalOpen(false)}
        onSuccess={loadProfile}
        vehicleId={vehicle.id}
      />

      <AddBatteryModal
        isOpen={isBatteryModalOpen}
        onClose={() => setIsBatteryModalOpen(false)}
        onSuccess={loadProfile}
        vehicleId={vehicle.id}
      />

      <VehicleThresholdModal
        isOpen={isThresholdModalOpen}
        onClose={() => setIsThresholdModalOpen(false)}
        onSuccess={loadProfile}
        vehicleId={vehicle.id}
        vehicleNumber={vehicle.vehicle_number}
      />

      <EditVehicleModal
        isOpen={isEditVehicleModalOpen}
        vehicle={vehicle}
        onClose={() => setIsEditVehicleModalOpen(false)}
        onSuccess={loadProfile}
      />

      <UpdateVehicleImageModal
        isOpen={isImageModalOpen}
        vehicle={vehicle}
        onClose={() => setIsImageModalOpen(false)}
        onSuccess={loadProfile}
      />

      {/* Generic Item Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!itemToDelete}
        title={`Delete ${itemToDelete?.type || 'Record'}`}
        itemName={itemToDelete?.name}
        itemDetails={itemToDelete ? `Permanently remove this ${itemToDelete.type.toLowerCase()} from the system.` : undefined}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
};

export default VehicleDetail360Page;
