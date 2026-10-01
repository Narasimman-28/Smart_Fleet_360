import React, { useState, useEffect } from 'react';
import {
  X, Truck, AlertCircle, FileText, User,
  Fuel, Camera, Save, RefreshCw
} from 'lucide-react';
import type { Vehicle, VehicleType, FuelType } from '../types';
import { api } from '../services/api';
import { ImageUploader } from './ImageUploader';

interface EditVehicleModalProps {
  isOpen: boolean;
  vehicle: Vehicle;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditVehicleModal: React.FC<EditVehicleModalProps> = ({
  isOpen,
  vehicle,
  onClose,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'image_identity' | 'fuel_specs' | 'technical' | 'ownership'>('image_identity');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (vehicle) {
      setSelectedImageFile(null);
      setFormData({
        vehicle_number: vehicle.vehicle_number || '',
        vehicle_type: vehicle.vehicle_type || 'Truck',
        vehicle_category: vehicle.vehicle_category || 'Commercial',
        make: vehicle.make || '',
        model: vehicle.model || '',
        variant: vehicle.variant || '',
        manufacturing_year: vehicle.manufacturing_year || '',
        registration_date: vehicle.registration_date || '',
        chassis_number: vehicle.chassis_number || '',
        engine_number: vehicle.engine_number || '',
        fuel_type: vehicle.fuel_type || 'Diesel',
        colour: vehicle.colour || '',
        seating_capacity: vehicle.seating_capacity || '',
        load_capacity_kg: vehicle.load_capacity_kg || '',
        gross_vehicle_weight_kg: vehicle.gross_vehicle_weight_kg || '',
        unladen_weight_kg: vehicle.unladen_weight_kg || '',
        axles_count: vehicle.axles_count || 2,
        wheel_base_mm: vehicle.wheel_base_mm || '',

        fuel_tank_capacity: vehicle.fuel_tank_capacity || '',
        current_fuel_level: vehicle.current_fuel_level || '',
        fuel_efficiency: vehicle.fuel_efficiency || '',
        battery_capacity: vehicle.battery_capacity || '',
        charging_type: vehicle.charging_type || '',
        electric_range_km: vehicle.electric_range_km || '',

        owner_name: vehicle.owner_name || '',
        owner_phone: vehicle.owner_phone || '',
        owner_address: vehicle.owner_address || '',
        rto_office: vehicle.rto_office || '',
        rto_code: vehicle.rto_code || '',
        state: vehicle.state || '',
        district: vehicle.district || '',
        usage_type: vehicle.usage_type || 'Commercial',
        status: vehicle.status || 'Available',

        purchase_date: vehicle.purchase_date || '',
        purchase_price: vehicle.purchase_price || '',
        current_value: vehicle.current_value || '',
        odometer_reading: vehicle.odometer_reading || '',
        driver_id: vehicle.driver_id || '',
        fleet_id: vehicle.fleet_id || '',

        insurance_provider: vehicle.insurance_provider || '',
        policy_number: vehicle.policy_number || '',
        fastag_id: vehicle.fastag_id || '',
        route_name: vehicle.route_name || '',
        goods_type: vehicle.goods_type || '',
        photo_url: vehicle.profile_image_url || vehicle.photo_url || '',
        profile_image_url: vehicle.profile_image_url || vehicle.photo_url || '',
        notes: vehicle.notes || ''
      });
      setErrorMsg('');
    }
  }, [vehicle, isOpen]);

  if (!isOpen || !vehicle) return null;

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
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.make?.trim()) {
      setErrorMsg('Make / Manufacturer is required');
      setActiveTab('image_identity');
      return;
    }

    if (!formData.model?.trim()) {
      setErrorMsg('Model name is required');
      setActiveTab('image_identity');
      return;
    }

    setIsSubmitting(true);
    try {
      const imgUrl = (formData.profile_image_url || formData.photo_url || '').trim();

      if (selectedImageFile) {
        const fd = new FormData();
        fd.append('image', selectedImageFile);
        fd.append('profile_image', selectedImageFile);
        fd.append('make', formData.make.trim());
        fd.append('model', formData.model.trim());
        fd.append('variant', formData.variant?.trim() || '');
        fd.append('vehicle_type', formData.vehicle_type || 'Truck');
        fd.append('vehicle_category', formData.vehicle_category || 'Commercial');
        if (formData.manufacturing_year) fd.append('manufacturing_year', String(formData.manufacturing_year));
        if (formData.seating_capacity) fd.append('seating_capacity', String(formData.seating_capacity));
        if (formData.load_capacity_kg) fd.append('load_capacity_kg', String(formData.load_capacity_kg));
        if (formData.gross_vehicle_weight_kg) fd.append('gross_vehicle_weight_kg', String(formData.gross_vehicle_weight_kg));
        if (formData.unladen_weight_kg) fd.append('unladen_weight_kg', String(formData.unladen_weight_kg));
        if (formData.axles_count) fd.append('axles_count', String(formData.axles_count));
        if (formData.wheel_base_mm) fd.append('wheel_base_mm', String(formData.wheel_base_mm));
        if (formData.fuel_tank_capacity) fd.append('fuel_tank_capacity', String(formData.fuel_tank_capacity));
        if (formData.current_fuel_level) fd.append('current_fuel_level', String(formData.current_fuel_level));
        if (formData.fuel_efficiency) fd.append('fuel_efficiency', String(formData.fuel_efficiency));
        if (formData.battery_capacity) fd.append('battery_capacity', String(formData.battery_capacity));
        if (formData.charging_type) fd.append('charging_type', formData.charging_type.trim());
        if (formData.electric_range_km) fd.append('electric_range_km', String(formData.electric_range_km));
        if (formData.fuel_type) fd.append('fuel_type', formData.fuel_type);
        if (formData.colour) fd.append('colour', formData.colour);
        if (formData.status) fd.append('status', formData.status);
        if (formData.chassis_number) fd.append('chassis_number', formData.chassis_number);
        if (formData.engine_number) fd.append('engine_number', formData.engine_number);
        if (formData.odometer_reading) fd.append('odometer_reading', String(formData.odometer_reading));
        if (formData.owner_name) fd.append('owner_name', formData.owner_name.trim());
        if (formData.owner_phone) fd.append('owner_phone', formData.owner_phone.trim());
        if (formData.owner_address) fd.append('owner_address', formData.owner_address.trim());
        if (formData.rto_office) fd.append('rto_office', formData.rto_office.trim());
        if (formData.rto_code) fd.append('rto_code', formData.rto_code.trim());
        if (formData.state) fd.append('state', formData.state.trim());
        if (formData.district) fd.append('district', formData.district.trim());
        if (formData.notes) fd.append('notes', formData.notes.trim());

        await api.updateVehicle(vehicle.id, fd);
      } else {
        await api.updateVehicle(vehicle.id, {
          ...formData,
          make: formData.make.trim(),
          model: formData.model.trim(),
          variant: formData.variant?.trim() || '',
          manufacturing_year: formData.manufacturing_year ? parseInt(String(formData.manufacturing_year), 10) : undefined,
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
          charging_type: formData.charging_type?.trim() || undefined,
          electric_range_km: formData.electric_range_km ? parseFloat(String(formData.electric_range_km)) : undefined,
          owner_name: formData.owner_name?.trim() || '',
          owner_phone: formData.owner_phone?.trim() || '',
          owner_address: formData.owner_address?.trim() || '',
          rto_office: formData.rto_office?.trim() || '',
          rto_code: formData.rto_code?.trim() || '',
          state: formData.state?.trim() || '',
          district: formData.district?.trim() || '',
          purchase_price: formData.purchase_price ? parseFloat(String(formData.purchase_price)) : 0,
          current_value: formData.current_value ? parseFloat(String(formData.current_value)) : 0,
          odometer_reading: formData.odometer_reading ? parseFloat(String(formData.odometer_reading)) : 0,
          route_name: formData.route_name?.trim() || '',
          goods_type: formData.goods_type?.trim() || '',
          photo_url: imgUrl,
          profile_image_url: imgUrl,
          notes: formData.notes?.trim() || ''
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update vehicle');
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
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-[#F5F5F5]">Edit Vehicle Specifications</h2>
                <span className="px-2.5 py-0.5 bg-[#27272A] border border-[#3F3F46] text-[#F5F5F5] font-mono text-xs font-bold rounded-lg">
                  {vehicle.vehicle_number}
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA]">Update profile image, specifications, fuel parameters & RTO records</p>
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
            onClick={() => setActiveTab('image_identity')}
            className={`py-3 border-b-2 transition flex items-center space-x-1.5 shrink-0 cursor-pointer ${
              activeTab === 'image_identity' ? 'border-[#E53935] text-[#E53935]' : 'border-transparent text-[#A1A1AA] hover:text-[#F5F5F5]'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>1. Profile Image & Identity</span>
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
            <span>4. RTO & Ownership</span>
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

          {/* TAB 1: Profile Image & Identity */}
          {activeTab === 'image_identity' && (
            <div className="space-y-4">
              {/* VEHICLE PROFILE IMAGE UPLOAD */}
              <div className="p-4 bg-[#111113] rounded-2xl border border-[#3F3F46] space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-[#3F3F46]">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-[#3F1111] text-[#E53935] rounded-lg">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#F5F5F5] uppercase tracking-wider">Update Vehicle Profile Image</h4>
                      <p className="text-[11px] text-[#A1A1AA]">Every vehicle displays its own individual profile image across all cards and detail pages</p>
                    </div>
                  </div>
                </div>

                <div className="max-w-md pt-1">
                  <ImageUploader
                    label="Vehicle Profile Image"
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
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Make / Manufacturer *</label>
                  <input
                    type="text"
                    required
                    value={formData.make || ''}
                    onChange={(e) => handleInputChange('make', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Model *</label>
                  <input
                    type="text"
                    required
                    value={formData.model || ''}
                    onChange={(e) => handleInputChange('model', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Variant / Sub-model</label>
                  <input
                    type="text"
                    value={formData.variant || ''}
                    onChange={(e) => handleInputChange('variant', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Vehicle Type</label>
                  <select
                    value={formData.vehicle_type || 'Truck'}
                    onChange={(e) => handleInputChange('vehicle_type', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                  >
                    {vehicleTypes.map(t => <option key={t} value={t} className="bg-[#18181B] text-[#F5F5F5]">{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Vehicle Category</label>
                  <select
                    value={formData.vehicle_category || 'Commercial'}
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
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Operational Status</label>
                  <select
                    value={formData.status || 'Available'}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                  >
                    <option value="Available" className="bg-[#18181B] text-[#F5F5F5]">Available / Ready</option>
                    <option value="On Trip" className="bg-[#18181B] text-[#F5F5F5]">On Trip</option>
                    <option value="In Maintenance" className="bg-[#18181B] text-[#F5F5F5]">In Maintenance</option>
                    <option value="Under Inspection" className="bg-[#18181B] text-[#F5F5F5]">Under Inspection</option>
                    <option value="Breakdown" className="bg-[#18181B] text-[#F5F5F5]">Breakdown</option>
                    <option value="Retired" className="bg-[#18181B] text-[#F5F5F5]">Retired</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Manufacturing Year</label>
                  <input
                    type="number"
                    value={formData.manufacturing_year || ''}
                    onChange={(e) => handleInputChange('manufacturing_year', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Vehicle Color</label>
                  <input
                    type="text"
                    value={formData.colour || ''}
                    onChange={(e) => handleInputChange('colour', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Fuel & EV Details */}
          {activeTab === 'fuel_specs' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Fuel Type *</label>
                  <select
                    value={formData.fuel_type || 'Diesel'}
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
                        value={formData.fuel_tank_capacity || ''}
                        onChange={(e) => handleInputChange('fuel_tank_capacity', e.target.value)}
                        className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Current Fuel Level (Litres)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.current_fuel_level || ''}
                        onChange={(e) => handleInputChange('current_fuel_level', e.target.value)}
                        className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Fuel Efficiency (km/L)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.fuel_efficiency || ''}
                        onChange={(e) => handleInputChange('fuel_efficiency', e.target.value)}
                        className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Battery Pack Capacity (kWh)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.battery_capacity || ''}
                        onChange={(e) => handleInputChange('battery_capacity', e.target.value)}
                        className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Charging Connector Standard</label>
                      <select
                        value={formData.charging_type || ''}
                        onChange={(e) => handleInputChange('charging_type', e.target.value)}
                        className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                      >
                        <option value="" className="bg-[#18181B] text-[#F5F5F5]">-- Select Charging Connector --</option>
                        <option value="CCS2 (DC Fast Charge)" className="bg-[#18181B] text-[#F5F5F5]">CCS2 (DC Fast Charge)</option>
                        <option value="Type 2 (AC)" className="bg-[#18181B] text-[#F5F5F5]">Type 2 (AC)</option>
                        <option value="GB/T" className="bg-[#18181B] text-[#F5F5F5]">GB/T</option>
                        <option value="CHAdeMO" className="bg-[#18181B] text-[#F5F5F5]">CHAdeMO</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Single Charge Range (km)</label>
                      <input
                        type="number"
                        value={formData.electric_range_km || ''}
                        onChange={(e) => handleInputChange('electric_range_km', e.target.value)}
                        className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Technical Specs */}
          {activeTab === 'technical' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Chassis / VIN Number</label>
                <input
                  type="text"
                  value={formData.chassis_number || ''}
                  onChange={(e) => handleInputChange('chassis_number', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Engine Number</label>
                <input
                  type="text"
                  value={formData.engine_number || ''}
                  onChange={(e) => handleInputChange('engine_number', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Seating Capacity</label>
                <input
                  type="number"
                  value={formData.seating_capacity || ''}
                  onChange={(e) => handleInputChange('seating_capacity', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Payload / Load Capacity (kg)</label>
                <input
                  type="number"
                  value={formData.load_capacity_kg || ''}
                  onChange={(e) => handleInputChange('load_capacity_kg', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Gross Vehicle Weight / GVW (kg)</label>
                <input
                  type="number"
                  value={formData.gross_vehicle_weight_kg || ''}
                  onChange={(e) => handleInputChange('gross_vehicle_weight_kg', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Unladen Tare Weight (kg)</label>
                <input
                  type="number"
                  value={formData.unladen_weight_kg || ''}
                  onChange={(e) => handleInputChange('unladen_weight_kg', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Number of Axles</label>
                <input
                  type="number"
                  value={formData.axles_count || 2}
                  onChange={(e) => handleInputChange('axles_count', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Wheelbase (mm)</label>
                <input
                  type="number"
                  value={formData.wheel_base_mm || ''}
                  onChange={(e) => handleInputChange('wheel_base_mm', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Current Odometer (km)</label>
                <input
                  type="number"
                  value={formData.odometer_reading || ''}
                  onChange={(e) => handleInputChange('odometer_reading', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* TAB 4: RTO & Ownership */}
          {activeTab === 'ownership' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Registered Owner Name</label>
                  <input
                    type="text"
                    value={formData.owner_name || ''}
                    onChange={(e) => handleInputChange('owner_name', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Owner Contact Phone</label>
                  <input
                    type="text"
                    value={formData.owner_phone || ''}
                    onChange={(e) => handleInputChange('owner_phone', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">RTO Office Location</label>
                  <input
                    type="text"
                    value={formData.rto_office || ''}
                    onChange={(e) => handleInputChange('rto_office', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">RTO Code</label>
                  <input
                    type="text"
                    value={formData.rto_code || ''}
                    onChange={(e) => handleInputChange('rto_code', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">State</label>
                  <input
                    type="text"
                    value={formData.state || ''}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">District</label>
                  <input
                    type="text"
                    value={formData.district || ''}
                    onChange={(e) => handleInputChange('district', e.target.value)}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Internal Notes & Operations Tag</label>
                <textarea
                  rows={3}
                  value={formData.notes || ''}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="pt-4 border-t border-[#3F3F46] flex items-center justify-between">
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
              className="px-5 py-2.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/20 transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Vehicle...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditVehicleModal;
