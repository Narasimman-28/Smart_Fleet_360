import React, { useState, useEffect } from 'react';
import {
  X, Calendar, Clock, MapPin, Truck, User,
  Check, AlertCircle, Edit2, Trash2,
  Tag, FileText, ArrowRight, Play, CheckCircle2,
  Info
} from 'lucide-react';
import type { Vehicle, Driver, Booking } from '../types';
import { api } from '../services/api';
import { resolveVehicleImageUrl } from '../utils/imageUrl';

const getTodayISODate = () => new Date().toISOString().split('T')[0];

// Helper to format currency in Indian format
export const formatINR = (amount?: number | null): string => {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
};

// Helper for 12-hour time parsing and formatting
export const parse12HourTime = (timeStr?: string) => {
  if (!timeStr) return { hour: '08', minute: '00', period: 'AM' as const };
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2];
    let p = (match[3] || '').toUpperCase();
    if (!p) {
      p = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
    }
    return {
      hour: h < 10 ? `0${h}` : `${h}`,
      minute: m,
      period: p === 'PM' ? 'PM' as const : 'AM' as const
    };
  }
  return { hour: '08', minute: '00', period: 'AM' as const };
};

export const format12HourString = (hour: string, minute: string, period: 'AM' | 'PM') => {
  const h = parseInt(hour, 10) || 12;
  const formattedH = h < 10 ? `0${h}` : `${h}`;
  return `${formattedH}:${minute.padStart(2, '0')} ${period}`;
};

export const format12HourDisplay = (timeStr?: string): string => {
  if (!timeStr) return '';
  if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].substring(0, 2);
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const formattedHours = hours < 10 ? `0${hours}` : `${hours}`;
  return `${formattedHours}:${minutes} ${period}`;
};

export const TimePicker12Hour: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
}> = ({ label, value, onChange }) => {
  const parsed = parse12HourTime(value);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(parsed.period);

  useEffect(() => {
    const p = parse12HourTime(value);
    setHour(p.hour);
    setMinute(p.minute);
    setPeriod(p.period);
  }, [value]);

  const updateTime = (newH: string, newM: string, newP: 'AM' | 'PM') => {
    setHour(newH);
    setMinute(newM);
    setPeriod(newP);
    onChange(format12HourString(newH, newM, newP));
  };

  const hoursList = Array.from({ length: 12 }, (_, i) => {
    const num = i + 1;
    return num < 10 ? `0${num}` : `${num}`;
  });

  const minutesList = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[#D4D4D8]">{label}</label>
        <span className="text-[11px] font-mono font-bold text-[#FF6B6B] bg-[#3F1111] px-2 py-0.5 rounded border border-[#7F1D1D]">
          {format12HourString(hour, minute, period)}
        </span>
      </div>
      <div className="flex items-center space-x-1">
        {/* Hour Select */}
        <select
          value={hour}
          onChange={(e) => updateTime(e.target.value, minute, period)}
          className="w-16 px-2 py-1.5 text-xs font-mono font-semibold bg-[#111113] border border-[#3F3F46] rounded-lg text-[#F5F5F5] focus:border-[#E53935] focus:outline-hidden"
        >
          {hoursList.map(h => (
            <option key={h} value={h} className="bg-[#18181B] text-[#F5F5F5]">{h}</option>
          ))}
        </select>
        <span className="text-[#71717A] font-bold">:</span>
        {/* Minute Select */}
        <select
          value={minute}
          onChange={(e) => updateTime(hour, e.target.value, period)}
          className="w-16 px-2 py-1.5 text-xs font-mono font-semibold bg-[#111113] border border-[#3F3F46] rounded-lg text-[#F5F5F5] focus:border-[#E53935] focus:outline-hidden"
        >
          {minutesList.map(m => (
            <option key={m} value={m} className="bg-[#18181B] text-[#F5F5F5]">{m}</option>
          ))}
        </select>
        {/* AM / PM Toggle */}
        <div className="flex rounded-lg overflow-hidden border border-[#3F3F46]">
          <button
            type="button"
            onClick={() => updateTime(hour, minute, 'AM')}
            className={`px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              period === 'AM'
                ? 'bg-[#E53935] text-[#F5F5F5]'
                : 'bg-[#111113] text-[#A1A1AA] hover:bg-[#202024]'
            }`}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => updateTime(hour, minute, 'PM')}
            className={`px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              period === 'PM'
                ? 'bg-[#E53935] text-[#F5F5F5]'
                : 'bg-[#111113] text-[#A1A1AA] hover:bg-[#202024]'
            }`}
          >
            PM
          </button>
        </div>
      </div>
    </div>
  );
};

// ==============================================================================
// 1. CREATE / EDIT TRIP BOOKING MODAL
// ==============================================================================
export interface CreateEditBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialBooking?: Booking | null;
  preselectedVehicleId?: string;
}

export const CreateEditBookingModal: React.FC<CreateEditBookingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialBooking,
  preselectedVehicleId
}) => {
  const isEditing = Boolean(initialBooking && initialBooking.id);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [formData, setFormData] = useState({
    booking_number: initialBooking?.booking_number || '',
    booking_date: initialBooking?.booking_date || getTodayISODate(),
    customer_name: initialBooking?.customer_name || '',
    customer_mobile: initialBooking?.customer_mobile || '',
    customer_address: initialBooking?.customer_address || '',
    pickup_location: initialBooking?.pickup_location || '',
    drop_location: initialBooking?.drop_location || '',
    start_date: initialBooking?.start_date || getTodayISODate(),
    start_time: initialBooking?.start_time ? format12HourDisplay(initialBooking.start_time) : '09:30 AM',
    end_date: initialBooking?.end_date || getTodayISODate(),
    end_time: initialBooking?.end_time ? format12HourDisplay(initialBooking.end_time) : '06:15 PM',
    vehicle_id: preselectedVehicleId || initialBooking?.vehicle_id || '',
    vehicle_number: initialBooking?.vehicle_number || '',
    vehicle_type: initialBooking?.vehicle_type || '',
    vehicle_category: initialBooking?.vehicle_category || 'Commercial',
    driver_id: initialBooking?.driver_id || '',
    driver_name: initialBooking?.driver_name || '',
    driver_phone: initialBooking?.driver_phone || '',
    driver_availability: initialBooking?.driver_availability || 'Available',
    trip_type: initialBooking?.trip_type || 'One Way',
    passenger_or_goods_details: initialBooking?.passenger_or_goods_details || '',
    booking_amount: initialBooking?.booking_amount || 0,
    advance_amount: initialBooking?.advance_amount || 0,
    distance_km: initialBooking?.distance_km || 0,
    booking_status: (initialBooking?.booking_status || 'Confirmed') as 'Confirmed' | 'Started' | 'Completed' | 'Cancelled',
    special_instructions: initialBooking?.special_instructions || '',
    notes: initialBooking?.notes || ''
  });

  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state when modal opens or initialBooking changes
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      if (initialBooking) {
        setFormData({
          booking_number: initialBooking.booking_number || '',
          booking_date: initialBooking.booking_date || getTodayISODate(),
          customer_name: initialBooking.customer_name || '',
          customer_mobile: initialBooking.customer_mobile || '',
          customer_address: initialBooking.customer_address || '',
          pickup_location: initialBooking.pickup_location || '',
          drop_location: initialBooking.drop_location || '',
          start_date: initialBooking.start_date || getTodayISODate(),
          start_time: initialBooking.start_time ? format12HourDisplay(initialBooking.start_time) : '09:30 AM',
          end_date: initialBooking.end_date || getTodayISODate(),
          end_time: initialBooking.end_time ? format12HourDisplay(initialBooking.end_time) : '06:15 PM',
          vehicle_id: initialBooking.vehicle_id || '',
          vehicle_number: initialBooking.vehicle_number || '',
          vehicle_type: initialBooking.vehicle_type || '',
          vehicle_category: initialBooking.vehicle_category || 'Commercial',
          driver_id: initialBooking.driver_id || '',
          driver_name: initialBooking.driver_name || '',
          driver_phone: initialBooking.driver_phone || '',
          driver_availability: initialBooking.driver_availability || 'Available',
          trip_type: initialBooking.trip_type || 'One Way',
          passenger_or_goods_details: initialBooking.passenger_or_goods_details || '',
          booking_amount: initialBooking.booking_amount || 0,
          advance_amount: initialBooking.advance_amount || 0,
          distance_km: initialBooking.distance_km || 0,
          booking_status: (initialBooking.booking_status || 'Confirmed') as any,
          special_instructions: initialBooking.special_instructions || '',
          notes: initialBooking.notes || ''
        });
      } else {
        const autoBookingNumber = `BK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        setFormData({
          booking_number: autoBookingNumber,
          booking_date: getTodayISODate(),
          customer_name: '',
          customer_mobile: '',
          customer_address: '',
          pickup_location: '',
          drop_location: '',
          start_date: getTodayISODate(),
          start_time: '09:30 AM',
          end_date: getTodayISODate(),
          end_time: '06:15 PM',
          vehicle_id: preselectedVehicleId || '',
          vehicle_number: '',
          vehicle_type: '',
          vehicle_category: 'Commercial',
          driver_id: '',
          driver_name: '',
          driver_phone: '',
          driver_availability: 'Available',
          trip_type: 'One Way',
          passenger_or_goods_details: '',
          booking_amount: 0,
          advance_amount: 0,
          distance_km: 0,
          booking_status: 'Confirmed',
          special_instructions: '',
          notes: ''
        });
      }

      // Fetch vehicles & drivers
      api.getVehicles().then(setVehicles).catch(console.error);
      api.getDrivers().then(setDrivers).catch(console.error);
    }
  }, [isOpen, initialBooking, preselectedVehicleId]);

  if (!isOpen) return null;

  const handleVehicleChange = (vId: string) => {
    const selected = vehicles.find(v => v.id === vId);
    if (selected) {
      setFormData(prev => ({
        ...prev,
        vehicle_id: selected.id,
        vehicle_number: selected.vehicle_number,
        vehicle_type: selected.vehicle_type || '',
        vehicle_category: selected.vehicle_category || 'Commercial',
        driver_id: selected.driver_id || prev.driver_id,
        driver_name: selected.driver_name || prev.driver_name,
        driver_phone: selected.driver_phone || prev.driver_phone
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        vehicle_id: '',
        vehicle_number: '',
        vehicle_type: ''
      }));
    }
  };

  const handleDriverChange = (dId: string) => {
    const selected = drivers.find(d => d.id === dId);
    if (selected) {
      setFormData(prev => ({
        ...prev,
        driver_id: selected.id,
        driver_name: selected.name,
        driver_phone: selected.phone || '',
        driver_availability: selected.status === 'On Trip' ? 'On Trip' : 'Available'
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        driver_id: '',
        driver_name: '',
        driver_phone: '',
        driver_availability: 'Available'
      }));
    }
  };

  const selectedVehicle = vehicles.find(v => v.id === formData.vehicle_id);

  // Financial calculations
  const totalFare = Number(formData.booking_amount) || 0;
  const advanceAmount = Number(formData.advance_amount) || 0;
  const balanceAmount = Math.max(0, totalFare - advanceAmount);

  const validateInputs = () => {
    if (!formData.booking_number.trim()) {
      setErrorMsg('Booking ID is mandatory.');
      return false;
    }
    if (!formData.customer_name.trim()) {
      setErrorMsg('Customer Name is mandatory.');
      return false;
    }
    if (!formData.customer_mobile.trim()) {
      setErrorMsg('Customer Mobile Number is mandatory.');
      return false;
    }
    if (!formData.vehicle_id) {
      setErrorMsg('Please select a vehicle from the fleet registry.');
      return false;
    }
    if (!formData.pickup_location.trim()) {
      setErrorMsg('Pickup Location is mandatory.');
      return false;
    }
    if (!formData.drop_location.trim()) {
      setErrorMsg('Drop Destination Location is mandatory.');
      return false;
    }
    if (!formData.start_date) {
      setErrorMsg('Journey Start Date is mandatory.');
      return false;
    }
    if (!formData.end_date) {
      setErrorMsg('Journey End Date is mandatory.');
      return false;
    }
    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      setErrorMsg('Expected End Date cannot be earlier than Start Date.');
      return false;
    }
    if (formData.start_date === formData.end_date) {
      const pStart = parse12HourTime(formData.start_time);
      const pEnd = parse12HourTime(formData.end_time);

      let hStart = parseInt(pStart.hour, 10);
      if (pStart.period === 'PM' && hStart < 12) hStart += 12;
      if (pStart.period === 'AM' && hStart === 12) hStart = 0;
      const mStart = hStart * 60 + parseInt(pStart.minute, 10);

      let hEnd = parseInt(pEnd.hour, 10);
      if (pEnd.period === 'PM' && hEnd < 12) hEnd += 12;
      if (pEnd.period === 'AM' && hEnd === 12) hEnd = 0;
      const mEnd = hEnd * 60 + parseInt(pEnd.minute, 10);

      if (mEnd < mStart) {
        setErrorMsg('Expected End time cannot be earlier than Start time on the same date.');
        return false;
      }
    }
    if (totalFare < 0) {
      setErrorMsg('Total Booking Amount cannot be negative.');
      return false;
    }
    if (advanceAmount < 0) {
      setErrorMsg('Advance Amount cannot be negative.');
      return false;
    }
    if (advanceAmount > totalFare && totalFare > 0) {
      setErrorMsg(`Advance Amount (${formatINR(advanceAmount)}) cannot exceed Total Booking Amount (${formatINR(totalFare)}).`);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!validateInputs()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        booking_amount: totalFare,
        advance_amount: advanceAmount,
        remaining_amount: balanceAmount,
        distance_km: Number(formData.distance_km) || 0
      };

      if (isEditing && initialBooking?.id) {
        await api.updateBooking(initialBooking.id, payload);
      } else {
        await api.createBooking(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save booking to database. Please review inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const vehImgUrl = resolveVehicleImageUrl(
    selectedVehicle?.profile_image_url ||
    selectedVehicle?.photo_url ||
    initialBooking?.vehicle_photo_url ||
    (initialBooking as any)?.vehicle_image_url
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="w-full max-w-3xl bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-[#111113] border-b border-[#3F3F46] text-[#F5F5F5] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#3F1111] border border-[#7F1D1D] flex items-center justify-center text-[#E53935]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-[#F5F5F5] text-base tracking-tight">
                {isEditing ? `Edit Trip Booking (${initialBooking?.booking_number || ''})` : 'Create Trip Booking'}
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Manual trip booking with 12-hour AM/PM schedule, driver assignment & database persistence
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#202024] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 bg-[#3F1111] border border-[#B71C1C] rounded-xl text-[#FF6B6B] text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#FF1744] mt-0.5" />
              <span className="font-medium leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* SECTION 1: BOOKING IDENTIFICATION & DATE */}
          <div className="p-4 bg-[#111113] border border-[#3F3F46] rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#3F3F46] pb-2">
              <div className="flex items-center space-x-2 text-[#F5F5F5] font-bold text-xs">
                <Info className="w-4 h-4 text-[#E53935]" />
                <span>Booking Identification</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#D4D4D8] mb-1">Booking ID *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BK-2026-1001"
                  value={formData.booking_number}
                  onChange={(e) => setFormData({ ...formData, booking_number: e.target.value })}
                  className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs font-mono font-bold focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#D4D4D8] mb-1">Booking Date *</label>
                <input
                  type="date"
                  required
                  value={formData.booking_date}
                  onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                  className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: CUSTOMER DETAILS */}
          <div className="p-4 bg-[#111113] border border-[#3F3F46] rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#3F3F46] pb-2">
              <div className="flex items-center space-x-2 text-[#F5F5F5] font-bold text-xs">
                <User className="w-4 h-4 text-[#E53935]" />
                <span>Customer Information</span>
              </div>
              <span className="text-[11px] text-[#A1A1AA]">Required *</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#D4D4D8] mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Kumar / ABC Logistics"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#D4D4D8] mb-1">Customer Phone Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +91 98765 43210"
                  value={formData.customer_mobile}
                  onChange={(e) => setFormData({ ...formData, customer_mobile: e.target.value })}
                  className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[#D4D4D8] mb-1">Customer Address</label>
                <input
                  type="text"
                  placeholder="Customer billing / office address"
                  value={formData.customer_address}
                  onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                  className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: VEHICLE & DRIVER SELECTION */}
          <div className="p-4 bg-[#111113] border border-[#3F3F46] rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#3F3F46] pb-2">
              <div className="flex items-center space-x-2 text-[#F5F5F5] font-bold text-xs">
                <Truck className="w-4 h-4 text-[#E53935]" />
                <span>Vehicle & Driver Details</span>
              </div>
              <span className="text-[11px] text-[#A1A1AA]">Database Linked</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#D4D4D8] mb-1">Select Vehicle (Database) *</label>
                <select
                  required
                  value={formData.vehicle_id}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                  className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden font-medium"
                >
                  <option value="" className="bg-[#18181B] text-[#F5F5F5]">-- Choose Vehicle from Fleet --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id} className="bg-[#18181B] text-[#F5F5F5]">
                      {v.vehicle_number} - {v.make} {v.model} ({v.vehicle_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#D4D4D8] mb-1">Vehicle Registration Number</label>
                <input
                  type="text"
                  placeholder="Vehicle Number (e.g. MH 02 AB 1234)"
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                  className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs font-mono font-bold focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#D4D4D8] mb-1">Select Driver (Database)</label>
                <select
                  value={formData.driver_id}
                  onChange={(e) => handleDriverChange(e.target.value)}
                  className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden font-medium"
                >
                  <option value="" className="bg-[#18181B] text-[#F5F5F5]">-- Choose Driver --</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id} className="bg-[#18181B] text-[#F5F5F5]">
                      {d.name} ({d.phone}) - {d.status || 'Active'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#D4D4D8] mb-1">Driver Phone Number</label>
                <input
                  type="text"
                  placeholder="Driver Phone Number"
                  value={formData.driver_phone}
                  onChange={(e) => setFormData({ ...formData, driver_phone: e.target.value })}
                  className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden font-mono"
                />
              </div>
            </div>

            {/* Selected Vehicle Visual Card */}
            {formData.vehicle_id && (
              <div className="p-3 bg-[#18181B] border border-[#3F3F46] rounded-xl flex items-center space-x-3.5">
                <div className="w-14 h-12 rounded-lg bg-[#111113] border border-[#7F1D1D] overflow-hidden shrink-0 flex items-center justify-center">
                  {vehImgUrl ? (
                    <img
                      src={vehImgUrl}
                      alt={formData.vehicle_number}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  ) : (
                    <Truck className="w-5 h-5 text-[#E53935]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-extrabold text-sm text-[#F5F5F5]">{formData.vehicle_number}</span>
                    <span className="px-2 py-0.5 bg-[#3F1111] text-[#FF6B6B] border border-[#7F1D1D] rounded-md text-[10px] font-bold">
                      {formData.vehicle_type || 'Vehicle'}
                    </span>
                    <span className="px-2 py-0.5 bg-[#27272A] text-[#A1A1AA] rounded-md text-[10px] font-semibold">
                      {formData.vehicle_category}
                    </span>
                  </div>
                  <p className="text-xs text-[#A1A1AA] mt-0.5 truncate">
                    {selectedVehicle ? `${selectedVehicle.make} ${selectedVehicle.model} • Driver: ${formData.driver_name || 'Unassigned'}` : 'Fleet Vehicle'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: ROUTE & TRIP DETAILS */}
          <div className="p-4 bg-[#111113] border border-[#3F3F46] rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#3F3F46] pb-2">
              <div className="flex items-center space-x-2 text-[#F5F5F5] font-bold text-xs">
                <MapPin className="w-4 h-4 text-[#E53935]" />
                <span>Pickup, Drop & Trip Type</span>
              </div>
              <span className="text-[11px] text-[#A1A1AA]">Required *</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#D4D4D8] mb-1">Pickup Location *</label>
                <input
                  type="text"
                  required
                  placeholder="Origin address / City (e.g. Chennai)"
                  value={formData.pickup_location}
                  onChange={(e) => setFormData({ ...formData, pickup_location: e.target.value })}
                  className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#D4D4D8] mb-1">Drop Location *</label>
                <input
                  type="text"
                  required
                  placeholder="Destination address / City (e.g. Bengaluru)"
                  value={formData.drop_location}
                  onChange={(e) => setFormData({ ...formData, drop_location: e.target.value })}
                  className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#D4D4D8] mb-1">Trip Type</label>
                <select
                  value={formData.trip_type}
                  onChange={(e) => setFormData({ ...formData, trip_type: e.target.value })}
                  className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden font-medium"
                >
                  <option value="One Way" className="bg-[#18181B] text-[#F5F5F5]">One Way</option>
                  <option value="Round Trip" className="bg-[#18181B] text-[#F5F5F5]">Round Trip</option>
                  <option value="Rental" className="bg-[#18181B] text-[#F5F5F5]">Rental</option>
                  <option value="Daily Route" className="bg-[#18181B] text-[#F5F5F5]">Daily Route</option>
                  <option value="Goods Transport" className="bg-[#18181B] text-[#F5F5F5]">Goods Transport</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-[#D4D4D8] mb-1">Passenger / Load Details</label>
                <input
                  type="text"
                  placeholder="e.g. 4 Passengers with luggage / 10 Tons Industrial Goods"
                  value={formData.passenger_or_goods_details}
                  onChange={(e) => setFormData({ ...formData, passenger_or_goods_details: e.target.value })}
                  className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: 12-HOUR AM/PM TRIP SCHEDULE */}
          <div className="p-4 bg-[#111113] border border-[#3F3F46] rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#3F3F46] pb-2">
              <div className="flex items-center space-x-2 text-[#F5F5F5] font-bold text-xs">
                <Clock className="w-4 h-4 text-[#E53935]" />
                <span>Journey Schedule (12-Hour AM/PM Format)</span>
              </div>
              <span className="text-[11px] text-[#FF6B6B] font-semibold">12-Hour AM/PM</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Start Schedule */}
              <div className="space-y-2 p-3 bg-[#18181B] border border-[#3F3F46] rounded-xl">
                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Journey Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#111113] border border-[#3F3F46] rounded-lg text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>
                <TimePicker12Hour
                  label="Start Time (12-Hour AM/PM)"
                  value={formData.start_time}
                  onChange={(val) => setFormData({ ...formData, start_time: val })}
                />
              </div>

              {/* End Schedule */}
              <div className="space-y-2 p-3 bg-[#18181B] border border-[#3F3F46] rounded-xl">
                <div>
                  <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Expected End Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#111113] border border-[#3F3F46] rounded-lg text-[#F5F5F5] text-xs focus:border-[#E53935] focus:outline-hidden"
                  />
                </div>
                <TimePicker12Hour
                  label="Expected End Time (12-Hour AM/PM)"
                  value={formData.end_time}
                  onChange={(val) => setFormData({ ...formData, end_time: val })}
                />
              </div>
            </div>
          </div>

          {/* SECTION 6: FINANCIAL LEDGER */}
          <div className="p-4 bg-[#111113] border border-[#7F1D1D] rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-[#F5F5F5] border-b border-[#3F3F46] pb-2">
              <span>Financials & Payments</span>
              <span className="text-[11px] text-[#A1A1AA] font-mono font-semibold">Pending = Total - Advance</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#D4D4D8] mb-1">Total Booking Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="e.g. 25000"
                  value={formData.booking_amount || ''}
                  onChange={(e) => setFormData({ ...formData, booking_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs font-mono font-bold focus:border-[#E53935] focus:outline-hidden"
                />
                <span className="text-[10px] text-[#A1A1AA] mt-1 block">Formatted: {formatINR(totalFare)}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#D4D4D8] mb-1">Advance Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 10000"
                  value={formData.advance_amount || ''}
                  onChange={(e) => setFormData({ ...formData, advance_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs font-mono font-bold focus:border-[#E53935] focus:outline-hidden"
                />
                <span className="text-[10px] text-[#A1A1AA] mt-1 block">Formatted: {formatINR(advanceAmount)}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#D4D4D8] mb-1">Pending Amount / Balance (₹)</label>
                <div className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F59E0B] font-extrabold text-xs font-mono flex items-center justify-between">
                  <span>{formatINR(balanceAmount)}</span>
                  <span className="text-[10px] text-[#71717A] font-sans font-normal">Auto-calculated</span>
                </div>
                <span className="text-[10px] text-[#A1A1AA] mt-1 block">Due upon completion</span>
              </div>
            </div>
          </div>

          {/* SECTION 7: SPECIAL INSTRUCTIONS & NOTES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#D4D4D8] mb-1">Special Instructions</label>
              <textarea
                rows={2}
                placeholder="Specific routing instructions, toll pass guidelines, customer contact person..."
                value={formData.special_instructions}
                onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
                className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#D4D4D8] mb-1">Notes / Remarks</label>
              <textarea
                rows={2}
                placeholder="Internal notes, payment remarks, driver instructions..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:border-[#E53935] focus:outline-hidden resize-none"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-[#3F3F46] flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-[#27272A] hover:bg-[#3F3F46] border border-[#52525B] text-[#F5F5F5] rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/20 transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving to Database...' : isEditing ? 'Update Booking' : 'Save Booking'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==============================================================================
// 2. BOOKING DETAILS 360 VIEW MODAL
// ==============================================================================
export interface BookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onEdit?: (booking: Booking) => void;
  onDelete?: (booking: Booking) => void;
  onStartTrip?: (id: string) => void;
  onEndTrip?: (id: string) => void;
  onStatusChange?: (id: string, newStatus: string) => void;
}

export const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({
  isOpen,
  onClose,
  booking,
  onEdit,
  onDelete,
  onStartTrip,
  onEndTrip,
  onStatusChange
}) => {
  if (!isOpen || !booking) return null;

  const vehImgUrl = resolveVehicleImageUrl(
    booking.vehicle_photo_url ||
    (booking as any).vehicle_image_url ||
    booking.profile_image_url
  );

  const totalFare = booking.booking_amount || 0;
  const advanceAmt = booking.advance_amount || 0;
  const remBalance = booking.remaining_amount !== undefined ? booking.remaining_amount : Math.max(0, totalFare - advanceAmt);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="w-full max-w-3xl bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#111113] border-b border-[#3F3F46] text-[#F5F5F5] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#3F1111] border border-[#7F1D1D] flex items-center justify-center text-[#E53935]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-[#F5F5F5] text-base font-mono tracking-tight">{booking.booking_number}</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  booking.booking_status === 'Completed' ? 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40' :
                  booking.booking_status === 'Started' ? 'bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/40 animate-pulse' :
                  booking.booking_status === 'Confirmed' ? 'bg-[#1E293B] text-[#60A5FA] border border-[#3B82F6]/40' :
                  'bg-[#3F1111] text-[#FF1744] border border-[#7F1D1D]'
                }`}>
                  ● {booking.booking_status}
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA] mt-0.5">Booking Record ID: {booking.id}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => { onClose(); onEdit(booking); }}
                className="px-3 py-1.5 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs font-semibold transition flex items-center space-x-1 cursor-pointer border border-[#3F3F46]"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#E53935]" />
                <span>Edit</span>
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => { onClose(); onDelete(booking); }}
                className="p-1.5 bg-[#3F1111] hover:bg-[#7F1D1D] text-[#FF1744] rounded-xl transition cursor-pointer border border-[#7F1D1D]"
                title="Delete Booking"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#202024] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* VEHICLE & TRIP STATUS HERO BANNER */}
          <div className="p-4 bg-[#111113] border border-[#3F3F46] rounded-2xl flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="w-28 h-24 rounded-xl bg-[#18181B] border border-[#7F1D1D] overflow-hidden shrink-0 flex items-center justify-center">
              {vehImgUrl ? (
                <img
                  src={vehImgUrl}
                  alt={booking.vehicle_number || 'Vehicle'}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-[#71717A] p-2 text-center">
                  <Truck className="w-7 h-7 text-[#E53935] mb-1" />
                  <span className="text-[9px] font-bold text-[#71717A]">NO VEHICLE IMAGE</span>
                </div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="text-lg font-mono font-extrabold text-[#F5F5F5]">{booking.vehicle_number}</span>
                <span className="px-2.5 py-0.5 bg-[#3F1111] text-[#FF6B6B] border border-[#7F1D1D] rounded-lg text-xs font-bold">
                  {booking.vehicle_type}
                </span>
                <span className="px-2.5 py-0.5 bg-[#27272A] text-[#A1A1AA] rounded-lg text-xs font-medium">
                  {booking.vehicle_category || 'Commercial'}
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA]">
                {booking.vehicle_make ? `${booking.vehicle_make} ${booking.vehicle_model || ''}` : 'Database Fleet Vehicle'}
                {booking.vehicle_fuel_type ? ` • ${booking.vehicle_fuel_type}` : ''}
              </p>
              {booking.customer_address && (
                <p className="text-[11px] text-[#71717A]">
                  Customer Address: {booking.customer_address}
                </p>
              )}
            </div>

            {/* Trip Action Flow Buttons */}
            <div className="flex sm:flex-col gap-1.5 shrink-0 self-center sm:self-auto">
              {booking.booking_status === 'Confirmed' && onStartTrip && (
                <button
                  onClick={() => { onStartTrip(booking.id); onClose(); }}
                  className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition shadow-lg shadow-[#E53935]/20 flex items-center space-x-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>START TRIP</span>
                </button>
              )}
              {booking.booking_status === 'Started' && onEndTrip && (
                <button
                  onClick={() => { onEndTrip(booking.id); onClose(); }}
                  className="px-4 py-2 bg-[#22C55E] hover:bg-emerald-600 text-[#F5F5F5] rounded-xl text-xs font-bold transition shadow-lg shadow-[#22C55E]/20 flex items-center space-x-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>END TRIP</span>
                </button>
              )}
              {booking.booking_status !== 'Cancelled' && booking.booking_status !== 'Completed' && onStatusChange && (
                <button
                  onClick={() => { onStatusChange(booking.id, 'Cancelled'); onClose(); }}
                  className="px-3 py-1.5 bg-[#27272A] hover:bg-[#3F1111] text-[#A1A1AA] hover:text-[#FF1744] border border-[#3F3F46] rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel Booking
                </button>
              )}
            </div>
          </div>

          {/* TRIP EXECUTION TIMELINE */}
          <div className="p-4 bg-[#111113] border border-[#3F3F46] rounded-xl space-y-3">
            <span className="text-xs font-extrabold text-[#F5F5F5] block border-b border-[#3F3F46] pb-2">
              Trip Execution Timeline
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-[#18181B] border border-[#3F3F46] rounded-xl">
                <span className="text-[10px] font-bold text-[#71717A] uppercase block">Actual Start Time</span>
                <div className="font-mono font-bold text-[#F5F5F5] mt-1">
                  {booking.actual_start_time ? (
                    <span className="text-[#60A5FA]">{booking.actual_start_date || ''} • {format12HourDisplay(booking.actual_start_time)}</span>
                  ) : (
                    <span className="text-[#71717A] font-normal">Not started yet</span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-[#18181B] border border-[#3F3F46] rounded-xl">
                <span className="text-[10px] font-bold text-[#71717A] uppercase block">Actual End Time</span>
                <div className="font-mono font-bold text-[#F5F5F5] mt-1">
                  {booking.actual_end_time ? (
                    <span className="text-[#22C55E]">{booking.actual_end_date || ''} • {format12HourDisplay(booking.actual_end_time)}</span>
                  ) : (
                    <span className="text-[#71717A] font-normal">Not completed yet</span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-[#18181B] border border-[#3F3F46] rounded-xl">
                <span className="text-[10px] font-bold text-[#71717A] uppercase block">Trip Duration</span>
                <div className="font-mono font-bold text-[#F5F5F5] mt-1">
                  {booking.trip_duration ? (
                    <span className="text-[#A855F7]">{booking.trip_duration}</span>
                  ) : (
                    <span className="text-[#71717A] font-normal">Calculated upon end</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* GRID DETAILS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Driver Details */}
            <div className="p-4 bg-[#111113] border border-[#3F3F46] rounded-xl space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#3F3F46] pb-2">
                <span className="text-xs font-extrabold text-[#F5F5F5] flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-[#E53935]" />
                  <span>Driver Details</span>
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  booking.driver_availability === 'Available' ? 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40' :
                  booking.driver_availability === 'On Trip' ? 'bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/40' :
                  'bg-[#27272A] text-[#A1A1AA]'
                }`}>
                  {booking.driver_availability || 'Available'}
                </span>
              </div>
              <div className="text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Driver Name:</span>
                  <span className="font-bold text-[#F5F5F5]">{booking.driver_name || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Driver Phone:</span>
                  <span className="font-mono font-semibold text-[#F5F5F5]">{booking.driver_phone || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Customer Details */}
            <div className="p-4 bg-[#111113] border border-[#3F3F46] rounded-xl space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#3F3F46] pb-2">
                <span className="text-xs font-extrabold text-[#F5F5F5] flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#E53935]" />
                  <span>Customer Details</span>
                </span>
              </div>
              <div className="text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Customer Name:</span>
                  <span className="font-bold text-[#F5F5F5]">{booking.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Customer Phone:</span>
                  <span className="font-mono font-semibold text-[#60A5FA]">{booking.customer_mobile}</span>
                </div>
              </div>
            </div>

            {/* Route & Schedule */}
            <div className="p-4 bg-[#111113] border border-[#3F3F46] rounded-xl space-y-2.5 md:col-span-2">
              <div className="flex items-center justify-between border-b border-[#3F3F46] pb-2">
                <span className="text-xs font-extrabold text-[#F5F5F5] flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#E53935]" />
                  <span>Pickup, Drop & Scheduled 12-Hour Timing</span>
                </span>
                <span className="text-[11px] font-semibold text-[#A1A1AA]">Type: {booking.trip_type}</span>
              </div>

              {/* Route banner */}
              <div className="p-3 bg-[#18181B] rounded-xl border border-[#3F3F46] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#22C55E] ring-4 ring-[#0F2A1A]" />
                  <span className="font-extrabold text-[#F5F5F5]">{booking.pickup_location}</span>
                  <ArrowRight className="w-4 h-4 text-[#71717A]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF1744] ring-4 ring-[#3F1111]" />
                  <span className="font-extrabold text-[#F5F5F5]">{booking.drop_location}</span>
                </div>
              </div>

              {/* 12-Hour Scheduled matrix */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-2.5 bg-[#18181B] rounded-lg border border-[#3F3F46]">
                  <span className="text-[10px] font-bold text-[#E53935] uppercase tracking-wider block">Scheduled Start</span>
                  <div className="text-xs font-mono font-bold text-[#F5F5F5] mt-0.5">
                    {booking.start_date} • {format12HourDisplay(booking.start_time)}
                  </div>
                </div>

                <div className="p-2.5 bg-[#18181B] rounded-lg border border-[#3F3F46]">
                  <span className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider block">Expected End</span>
                  <div className="text-xs font-mono font-bold text-[#F5F5F5] mt-0.5">
                    {booking.end_date} • {format12HourDisplay(booking.end_time)}
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Details */}
            <div className="p-4 bg-[#111113] border border-[#7F1D1D] rounded-xl space-y-2.5 md:col-span-2">
              <div className="flex items-center justify-between border-b border-[#3F3F46] pb-2">
                <span className="text-xs font-extrabold text-[#F5F5F5] flex items-center space-x-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#E53935]" />
                  <span>Financial Ledger</span>
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#18181B] border border-[#3F3F46] text-[#60A5FA]">
                  Payment Status: {booking.payment_status || (remBalance === 0 ? 'Paid' : advanceAmt > 0 ? 'Partial' : 'Pending')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-[#18181B] rounded-xl border border-[#3F3F46] shadow-xs">
                  <span className="text-[10px] font-bold text-[#71717A] uppercase">Total Booking Amount</span>
                  <div className="text-lg font-mono font-extrabold text-[#F5F5F5] mt-0.5">{formatINR(totalFare)}</div>
                </div>

                <div className="p-3 bg-[#18181B] rounded-xl border border-[#22C55E]/40 shadow-xs">
                  <span className="text-[10px] font-bold text-[#22C55E] uppercase">Advance Amount</span>
                  <div className="text-lg font-mono font-extrabold text-[#22C55E] mt-0.5">{formatINR(advanceAmt)}</div>
                </div>

                <div className="p-3 bg-[#18181B] rounded-xl border border-[#F59E0B]/40 shadow-xs">
                  <span className="text-[10px] font-bold text-[#F59E0B] uppercase">Pending Balance</span>
                  <div className="text-lg font-mono font-extrabold text-[#F59E0B] mt-0.5">{formatINR(remBalance)}</div>
                </div>
              </div>
            </div>

            {/* Special Instructions & Notes */}
            {(booking.special_instructions || booking.notes || booking.passenger_or_goods_details) && (
              <div className="p-4 bg-[#111113] border border-[#3F3F46] rounded-xl space-y-2 md:col-span-2 text-xs">
                {booking.passenger_or_goods_details && (
                  <div>
                    <span className="font-bold text-[#D4D4D8]">Passenger / Load Details: </span>
                    <span className="text-[#A1A1AA]">{booking.passenger_or_goods_details}</span>
                  </div>
                )}
                {booking.special_instructions && (
                  <div>
                    <span className="font-bold text-[#D4D4D8]">Special Instructions: </span>
                    <span className="text-[#A1A1AA]">{booking.special_instructions}</span>
                  </div>
                )}
                {booking.notes && (
                  <div>
                    <span className="font-bold text-[#D4D4D8]">Notes / Remarks: </span>
                    <span className="text-[#A1A1AA]">{booking.notes}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-[#111113] border-t border-[#3F3F46] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#71717A] font-mono">
            Booking Date: {booking.booking_date || (booking.created_at ? new Date(booking.created_at).toLocaleDateString('en-IN') : 'N/A')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] border border-[#52525B] text-[#F5F5F5] rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateEditBookingModal;
