import React, { useState } from 'react';
import {
  X, Truck, AlertCircle, FileText, User, Shield,
  Zap, Fuel, Camera
} from 'lucide-react';
import type { VehicleType, VehicleStatus, FuelType } from '../types';
import { api } from '../services/api';
import { ImageUploader } from './ImageUploader';
import { useToast } from '../context/ToastContext';

interface RegisterVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const getEmptyFormData = () => ({
  vehicle_number: '',
  vehicle_type: 'Truck' as VehicleType,
  vehicle_category: 'Commercial',
  make: '',
  model: '',
  variant: '',
  manufacturing_year: '',
  registration_date: '',

  chassis_number: '',
  engine_number: '',
  fuel_type: 'Diesel' as FuelType,
  colour: '',
  seating_capacity: '',
  load_capacity_kg: '',
  gross_vehicle_weight_kg: '',
  unladen_weight_kg: '',
  axles_count: '',
  wheel_base_mm: '',

  // Fuel & EV specifications
  fuel_tank_capacity: '',
  current_fuel_level: '',
  fuel_efficiency: '',
  battery_capacity: '',
  charging_type: '',
  electric_range_km: '',

  owner_name: '',
  owner_phone: '',
  owner_address: '',
  rto_office: '',
  rto_code: '',
  state: '',
  district: '',
  usage_type: 'Commercial',
  status: 'Available' as VehicleStatus,

  purchase_date: '',
  purchase_price: '',
  current_value: '',
  odometer_reading: '',
  driver_id: '',
  fleet_id: '',

  // Initial Compliance items
  rc_expiry_date: '',
  insurance_provider: '',
  policy_number: '',
  insurance_expiry: '',
  puc_number: '',
  puc_expiry: '',
  fc_number: '',
  fitness_expiry: '',
  permit_number: '',
  permit_expiry: '',
  fastag_id: '',
  fastag_balance: '',
  route_name: '',
  goods_type: '',
  photo_url: '',
  profile_image_url: '',
  notes: ''
});

export const RegisterVehicleModal: React.FC<RegisterVehicleModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { showSuccess } = useToast();
  const [activeTab, setActiveTab] = useState<'basic' | 'fuel_specs' | 'technical' | 'ownership' | 'compliance'>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [formData, setFormData] = useState(getEmptyFormData);

  if (!isOpen) return null;

  const vehicleTypes: VehicleType[] = [
    'Car', 'Taxi', 'Bus', 'School Bus', 'Tourist Bus', 'Van',
    'Truck', 'Heavy Truck', 'Lorry', 'Tanker', 'Trailer', 'LCV',
    'Mini Truck', 'Ambulance', 'Heavy Commercial', 'Light Commercial',
    'Goods Vehicle', 'Passenger Vehicle', 'Construction Vehicle',
    'Special Vehicle', 'Other'
  ];

  const fuelTypes: FuelType[] = [
    'Diesel', 'Petrol', 'CNG', 'LPG', 'Electric', 'Hybrid', 'Hydrogen', 'Other'
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.vehicle_number.trim()) {
      setErrorMsg('Vehicle Registration Number is required');
      setActiveTab('basic');
      return;
    }

    if (!formData.make.trim()) {
      setErrorMsg('Make / Manufacturer is required');
      setActiveTab('basic');
      return;
    }

    if (!formData.model.trim()) {
      setErrorMsg('Model name is required');
      setActiveTab('basic');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, any> = {
        ...formData,
        vehicle_number: formData.vehicle_number.trim().toUpperCase(),
        make: formData.make.trim(),
        model: formData.model.trim(),
        variant: formData.variant.trim(),
        manufacturing_year: formData.manufacturing_year ? parseInt(String(formData.manufacturing_year), 10) : undefined,
        registration_date: formData.registration_date || undefined,
        chassis_number: formData.chassis_number.trim(),
        engine_number: formData.engine_number.trim(),
        seating_capacity: formData.seating_capacity ? parseInt(String(formData.seating_capacity), 10) : undefined,
        load_capacity_kg: formData.load_capacity_kg ? parseFloat(String(formData.load_capacity_kg)) : 0,
        gross_vehicle_weight_kg: formData.gross_vehicle_weight_kg ? parseFloat(String(formData.gross_vehicle_weight_kg)) : 0,
        unladen_weight_kg: formData.unladen_weight_kg ? parseFloat(String(formData.unladen_weight_kg)) : 0,
        axles_count: formData.axles_count ? parseInt(String(formData.axles_count), 10) : 2,
        wheel_base_mm: formData.wheel_base_mm ? parseInt(String(formData.wheel_base_mm), 10) : 0,
        fuel_tank_capacity: formData.fuel_tank_capacity ? parseFloat(String(formData.fuel_tank_capacity)) : undefined,
        current_fuel_level: formData.current_fuel_level ? parseFloat(String(formData.current_fuel_level)) : undefined,
        fuel_efficiency: formData.fuel_efficiency ? parseFloat(String(formData.fuel_efficiency)) : undefined,
        battery_capacity: formData.battery_capacity ? parseFloat(String(formData.battery_capacity)) : undefined,
        charging_type: formData.charging_type.trim() || undefined,
        electric_range_km: formData.electric_range_km ? parseFloat(String(formData.electric_range_km)) : undefined,
        owner_name: formData.owner_name.trim(),
        owner_phone: formData.owner_phone.trim(),
        owner_address: formData.owner_address.trim(),
        rto_office: formData.rto_office.trim(),
        rto_code: formData.rto_code.trim(),
        state: formData.state.trim(),
        district: formData.district.trim(),
        purchase_date: formData.purchase_date || undefined,
        purchase_price: formData.purchase_price ? parseFloat(String(formData.purchase_price)) : 0,
        current_value: formData.current_value ? parseFloat(String(formData.current_value)) : 0,
        odometer_reading: formData.odometer_reading ? parseFloat(String(formData.odometer_reading)) : 0,
        insurance_provider: formData.insurance_provider.trim(),
        policy_number: formData.policy_number.trim(),
        fastag_id: formData.fastag_id.trim(),
        fastag_balance: formData.fastag_balance ? parseFloat(String(formData.fastag_balance)) : undefined,
        route_name: formData.route_name.trim(),
        goods_type: formData.goods_type.trim(),
        photo_url: (formData.profile_image_url || formData.photo_url || '').trim(),
        profile_image_url: (formData.profile_image_url || formData.photo_url || '').trim(),
        notes: formData.notes.trim()
      };

      if (selectedImageFile) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') {
            fd.append(k, String(v));
          }
        });
        fd.append('image', selectedImageFile);
        await api.registerVehicle(fd);
      } else {
        await api.registerVehicle(payload);
      }

      showSuccess('Vehicle registered successfully.');
      setFormData(getEmptyFormData());
      setSelectedImageFile(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register vehicle');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-4xl bg-[#18181B] rounded-2xl shadow-2xl border border-[#3F3F46] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#3F3F46] flex items-center justify-between bg-[#111113]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#3F1111] border border-[#7F1D1D] rounded-xl text-[#E53935]">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#F5F5F5]">Register New Vehicle</h2>
              <p className="text-xs text-[#A1A1AA]">Enter vehicle specifications, fuel parameters & RTO compliance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#A1A1AA] hover:text-[#F5F5F5] rounded-lg hover:bg-[#202024] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="px-6 border-b border-[#3F3F46] flex space-x-6 overflow-x-auto text-xs font-semibold bg-[#111113]">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`py-3 border-b-2 transition flex items-center space-x-1.5 shrink-0 cursor-pointer ${
              activeTab === 'basic' ? 'border-[#E53935] text-[#E53935]' : 'border-transparent text-[#A1A1AA] hover:text-[#F5F5F5]'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>1. Identity & Type</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fuel_specs')}
            className={`py-3 border-b-2 transition flex items-center space-x-1.5 shrink-0 cursor-pointer ${
              activeTab === 'fuel_specs' ? 'border-[#E53935] text-[#E53935]' : 'border-transparent text-[#A1A1AA] hover:text-[#F5F5F5]'
            }`}
          >
            <Fuel className="w-4 h-4" />
            <span>2. Fuel & EV Details</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('technical')}
            className={`py-3 border-b-2 transition flex items-center space-x-1.5 shrink-0 cursor-pointer ${
              activeTab === 'technical' ? 'border-[#E53935] text-[#E53935]' : 'border-transparent text-[#A1A1AA] hover:text-[#F5F5F5]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>3. Technical Specs</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ownership')}
            className={`py-3 border-b-2 transition flex items-center space-x-1.5 shrink-0 cursor-pointer ${
              activeTab === 'ownership' ? 'border-[#E53935] text-[#E53935]' : 'border-transparent text-[#A1A1AA] hover:text-[#F5F5F5]'
            }`}
          >
            <User className="w-4 h-4" />
            <span>4. RTO & Owner</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('compliance')}
            className={`py-3 border-b-2 transition flex items-center space-x-1.5 shrink-0 cursor-pointer ${
              activeTab === 'compliance' ? 'border-[#E53935] text-[#E53935]' : 'border-transparent text-[#A1A1AA] hover:text-[#F5F5F5]'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>5. Compliance & FASTag</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#18181B]">
          {errorMsg && (
            <div className="p-3 bg-[#3F1111] border border-[#B71C1C] rounded-xl text-[#FF6B6B] text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#FF1744]" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: Basic Identity */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              {/* VEHICLE PROFILE IMAGE UPLOAD */}
              <div className="p-4 bg-[#111113] rounded-2xl border border-[#3F3F46] space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-[#3F3F46]">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-[#3F1111] text-[#E53935] rounded-lg">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#F5F5F5] uppercase tracking-wider">Vehicle Profile Image</h4>
                      <p className="text-[11px] text-[#A1A1AA]">Every vehicle must have its own profile image. Allowed: JPG, JPEG, PNG, WEBP (Max 5 MB)</p>
                    </div>
                  </div>
                </div>

                <div className="max-w-md pt-1">
                  <ImageUploader
                    label="Upload Vehicle Profile Image"
                    value={formData.profile_image_url || formData.photo_url}
                    onChange={(url) => {
                      handleInputChange('profile_image_url', url);
                      handleInputChange('photo_url', url);
                    }}
                    onFileChange={(file) => setSelectedImageFile(file)}
                    type="vehicle"
                    aspectRatio="wide"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Vehicle Registration Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter registration number (e.g. TN-01-AB-1234)"
                    value={formData.vehicle_number}
                    onChange={(e) => handleInputChange('vehicle_number', e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Vehicle Type *</label>
                  <select
                    value={formData.vehicle_type}
                    onChange={(e) => handleInputChange('vehicle_type', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                  >
                    {vehicleTypes.map(t => <option key={t} value={t} className="bg-[#18181B] text-[#F5F5F5]">{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Vehicle Category</label>
                  <select
                    value={formData.vehicle_category}
                    onChange={(e) => handleInputChange('vehicle_category', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                  >
                    <option value="Commercial" className="bg-[#18181B] text-[#F5F5F5]">Commercial</option>
                    <option value="Goods" className="bg-[#18181B] text-[#F5F5F5]">Goods</option>
                    <option value="Passenger" className="bg-[#18181B] text-[#F5F5F5]">Passenger</option>
                    <option value="Special Purpose" className="bg-[#18181B] text-[#F5F5F5]">Special Purpose</option>
                    <option value="Heavy Commercial" className="bg-[#18181B] text-[#F5F5F5]">Heavy Commercial</option>
                    <option value="Private" className="bg-[#18181B] text-[#F5F5F5]">Private</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Make / Manufacturer *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter manufacturer (e.g. Tata Motors, Ashok Leyland)"
                    value={formData.make}
                    onChange={(e) => handleInputChange('make', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Model *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter model name (e.g. Signa 4825, Prima)"
                    value={formData.model}
                    onChange={(e) => handleInputChange('model', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Variant / Sub-model</label>
                  <input
                    type="text"
                    placeholder="Enter variant (e.g. BS6 HD, CNG Special)"
                    value={formData.variant}
                    onChange={(e) => handleInputChange('variant', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Manufacturing Year</label>
                  <input
                    type="number"
                    min="1990"
                    max="2035"
                    placeholder="e.g. 2024"
                    value={formData.manufacturing_year}
                    onChange={(e) => handleInputChange('manufacturing_year', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Registration Date</label>
                  <input
                    type="date"
                    value={formData.registration_date}
                    onChange={(e) => handleInputChange('registration_date', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Vehicle Color</label>
                  <input
                    type="text"
                    placeholder="e.g. Crimson Red, Dark Slate"
                    value={formData.colour}
                    onChange={(e) => handleInputChange('colour', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Fuel & EV Details */}
          {activeTab === 'fuel_specs' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-[#111113] border border-[#7F1D1D] rounded-xl text-xs text-[#F5F5F5] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Fuel className="w-4 h-4 text-[#E53935] shrink-0" />
                  <span>Configuring fuel / energy characteristics for <strong className="text-[#E53935]">{formData.vehicle_number || 'Vehicle'}</strong></span>
                </div>
                {formData.fuel_type === 'CNG' && (
                  <span className="px-2 py-0.5 bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40 font-bold rounded-md text-[11px]">
                    CNG (Compressed Natural Gas)
                  </span>
                )}
                {formData.fuel_type === 'Electric' && (
                  <span className="px-2 py-0.5 bg-[#2E1065] text-[#C084FC] border border-[#A855F7]/40 font-bold rounded-md text-[11px] flex items-center space-x-1">
                    <Zap className="w-3 h-3" />
                    <span>Pure Electric (EV)</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Fuel Type *</label>
                  <select
                    value={formData.fuel_type}
                    onChange={(e) => handleInputChange('fuel_type', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                  >
                    {fuelTypes.map(f => (
                      <option key={f} value={f} className="bg-[#18181B] text-[#F5F5F5]">
                        {f === 'CNG' ? 'CNG (Compressed Natural Gas)' : f}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.fuel_type !== 'Electric' ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Fuel Tank Capacity (Litres)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 350 Litres"
                        value={formData.fuel_tank_capacity}
                        onChange={(e) => handleInputChange('fuel_tank_capacity', e.target.value)}
                        className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Current Fuel Level (Litres or %)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 150 Litres"
                        value={formData.current_fuel_level}
                        onChange={(e) => handleInputChange('current_fuel_level', e.target.value)}
                        className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Expected Fuel Efficiency (km/L)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 4.5 km/L"
                        value={formData.fuel_efficiency}
                        onChange={(e) => handleInputChange('fuel_efficiency', e.target.value)}
                        className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Battery Pack Capacity (kWh) *</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 80 kWh"
                        value={formData.battery_capacity}
                        onChange={(e) => handleInputChange('battery_capacity', e.target.value)}
                        className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Charging Standard / Connector</label>
                      <select
                        value={formData.charging_type}
                        onChange={(e) => handleInputChange('charging_type', e.target.value)}
                        className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                      >
                        <option value="" className="bg-[#18181B] text-[#F5F5F5]">-- Select Charging Type --</option>
                        <option value="CCS2 (DC Fast Charge)" className="bg-[#18181B] text-[#F5F5F5]">CCS2 (DC Fast Charge)</option>
                        <option value="Type 2 (AC)" className="bg-[#18181B] text-[#F5F5F5]">Type 2 (AC)</option>
                        <option value="GB/T" className="bg-[#18181B] text-[#F5F5F5]">GB/T</option>
                        <option value="CHAdeMO" className="bg-[#18181B] text-[#F5F5F5]">CHAdeMO</option>
                        <option value="15A Standard Wall Socket" className="bg-[#18181B] text-[#F5F5F5]">15A Standard Wall Socket</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Single Charge Range (km)</label>
                      <input
                        type="number"
                        step="1"
                        placeholder="e.g. 320 km"
                        value={formData.electric_range_km}
                        onChange={(e) => handleInputChange('electric_range_km', e.target.value)}
                        className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Current State of Charge / SOC (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="e.g. 95%"
                        value={formData.current_fuel_level}
                        onChange={(e) => handleInputChange('current_fuel_level', e.target.value)}
                        className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Energy Consumption (km/kWh)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 4.0 km/kWh"
                        value={formData.fuel_efficiency}
                        onChange={(e) => handleInputChange('fuel_efficiency', e.target.value)}
                        className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Technical Specifications */}
          {activeTab === 'technical' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Chassis Number</label>
                <input
                  type="text"
                  placeholder="Enter 17-digit VIN / Chassis"
                  value={formData.chassis_number}
                  onChange={(e) => handleInputChange('chassis_number', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Engine Number</label>
                <input
                  type="text"
                  placeholder="Enter Engine Serial Number"
                  value={formData.engine_number}
                  onChange={(e) => handleInputChange('engine_number', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Seating Capacity</label>
                <input
                  type="number"
                  placeholder="e.g. 2, 5, 45"
                  value={formData.seating_capacity}
                  onChange={(e) => handleInputChange('seating_capacity', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Payload / Load Capacity (kg)</label>
                <input
                  type="number"
                  placeholder="e.g. 35000 kg"
                  value={formData.load_capacity_kg}
                  onChange={(e) => handleInputChange('load_capacity_kg', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Gross Vehicle Weight / GVW (kg)</label>
                <input
                  type="number"
                  placeholder="e.g. 48000 kg"
                  value={formData.gross_vehicle_weight_kg}
                  onChange={(e) => handleInputChange('gross_vehicle_weight_kg', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Unladen Tare Weight (kg)</label>
                <input
                  type="number"
                  placeholder="e.g. 13000 kg"
                  value={formData.unladen_weight_kg}
                  onChange={(e) => handleInputChange('unladen_weight_kg', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Number of Axles</label>
                <input
                  type="number"
                  placeholder="e.g. 2, 3, 5"
                  value={formData.axles_count}
                  onChange={(e) => handleInputChange('axles_count', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Wheelbase (mm)</label>
                <input
                  type="number"
                  placeholder="e.g. 6800 mm"
                  value={formData.wheel_base_mm}
                  onChange={(e) => handleInputChange('wheel_base_mm', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Current Odometer (km)</label>
                <input
                  type="number"
                  placeholder="Enter initial odometer reading"
                  value={formData.odometer_reading}
                  onChange={(e) => handleInputChange('odometer_reading', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* TAB 4: RTO & Ownership */}
          {activeTab === 'ownership' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Registered Owner Name</label>
                <input
                  type="text"
                  placeholder="Enter registered owner name"
                  value={formData.owner_name}
                  onChange={(e) => handleInputChange('owner_name', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Owner Contact Phone</label>
                <input
                  type="text"
                  placeholder="Enter 10-digit phone number"
                  value={formData.owner_phone}
                  onChange={(e) => handleInputChange('owner_phone', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">RTO Office Location</label>
                <input
                  type="text"
                  placeholder="e.g. Chennai Central, Coimbatore South"
                  value={formData.rto_office}
                  onChange={(e) => handleInputChange('rto_office', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">RTO Code</label>
                <input
                  type="text"
                  placeholder="e.g. TN-01, MH-12, DL-03"
                  value={formData.rto_code}
                  onChange={(e) => handleInputChange('rto_code', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">State / Province</label>
                <input
                  type="text"
                  placeholder="e.g. Tamil Nadu, Maharashtra"
                  value={formData.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">District / City</label>
                <input
                  type="text"
                  placeholder="e.g. Chennai, Mumbai"
                  value={formData.district}
                  onChange={(e) => handleInputChange('district', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Owner Registered Address</label>
                <input
                  type="text"
                  placeholder="Enter full address as printed on RC"
                  value={formData.owner_address}
                  onChange={(e) => handleInputChange('owner_address', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* TAB 5: Compliance & FASTag */}
          {activeTab === 'compliance' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">RC Expiry Date</label>
                <input
                  type="date"
                  value={formData.rc_expiry_date}
                  onChange={(e) => handleInputChange('rc_expiry_date', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Insurance Provider</label>
                <input
                  type="text"
                  placeholder="e.g. ICICI Lombard, New India Assurance"
                  value={formData.insurance_provider}
                  onChange={(e) => handleInputChange('insurance_provider', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Insurance Policy Number</label>
                <input
                  type="text"
                  placeholder="Enter policy number"
                  value={formData.policy_number}
                  onChange={(e) => handleInputChange('policy_number', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Insurance Expiry Date</label>
                <input
                  type="date"
                  value={formData.insurance_expiry}
                  onChange={(e) => handleInputChange('insurance_expiry', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Fitness Certificate (FC) Expiry</label>
                <input
                  type="date"
                  value={formData.fitness_expiry}
                  onChange={(e) => handleInputChange('fitness_expiry', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">PUC / Pollution Expiry</label>
                <input
                  type="date"
                  value={formData.puc_expiry}
                  onChange={(e) => handleInputChange('puc_expiry', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Permit Expiry Date</label>
                <input
                  type="date"
                  value={formData.permit_expiry}
                  onChange={(e) => handleInputChange('permit_expiry', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">FASTag Tag ID</label>
                <input
                  type="text"
                  placeholder="Enter 24-digit FASTag RFID / ID"
                  value={formData.fastag_id}
                  onChange={(e) => handleInputChange('fastag_id', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">FASTag Initial Wallet Balance (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 1500"
                  value={formData.fastag_balance}
                  onChange={(e) => handleInputChange('fastag_balance', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="pt-4 border-t border-[#3F3F46] flex items-center justify-between">
            <div className="text-[11px] text-[#A1A1AA]">
              * Required fields: Registration Number, Make, Model.
            </div>

            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] border border-[#52525B] text-[#F5F5F5] rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-semibold shadow-lg shadow-[#E53935]/20 transition disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#F5F5F5]/30 border-t-[#F5F5F5] rounded-full animate-spin" />
                    <span>Saving Vehicle...</span>
                  </>
                ) : (
                  <span>Register Vehicle</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterVehicleModal;
