import React, { useState, useEffect } from 'react';
import {
  X, Fuel, CreditCard, Check, Shield,
  FileCheck, Wrench, Receipt, Disc, Battery, FileText, Sliders
} from 'lucide-react';
import type { Vehicle, VehicleThresholdSettings } from '../types';
import { api } from '../services/api';
import { CreateEditBookingModal } from './BookingModals';

const getTodayISODate = () => new Date().toISOString().split('T')[0];

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

// 1. QUICK BOOKING MODAL (Delegates to centralized CreateEditBookingModal)
export const QuickBookingModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedVehicleId?: string;
}> = (props) => {
  return <CreateEditBookingModal {...props} />;
};

// 2. QUICK FUEL REFILL MODAL
export const QuickFuelModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedVehicleId?: string;
}> = ({ isOpen, onClose, onSuccess, preselectedVehicleId }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [formData, setFormData] = useState(() => ({
    vehicle_id: preselectedVehicleId || '',
    fuel_type: 'Diesel',
    date: getTodayISODate(),
    fuel_station: '',
    quantity_litres: 0,
    price_per_litre: 0,
    odometer_reading: 0,
    payment_method: 'Fuel Card'
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getVehicles().then(setVehicles).catch(console.error);
      if (preselectedVehicleId) {
        setFormData(prev => ({ ...prev, vehicle_id: preselectedVehicleId }));
      }
    }
  }, [isOpen, preselectedVehicleId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.addFuelLog(formData);
      onSuccess();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-[#111113] border-b border-[#3F3F46] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Fuel className="w-5 h-5 text-[#E53935]" />
            <h3 className="font-bold text-[#F5F5F5] text-base">Log Fuel Refill</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#27272A]"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Vehicle *</label>
            <select
              required
              value={formData.vehicle_id}
              onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
              className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
            >
              <option value="">-- Choose Vehicle --</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.vehicle_number} ({v.make} {v.model})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Quantity (Litres) *</label>
              <input
                type="number"
                step="0.01"
                required
                min="0"
                value={formData.quantity_litres || ''}
                onChange={(e) => setFormData({ ...formData, quantity_litres: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs font-mono focus:border-[#E53935]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Price per Litre (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                min="0"
                value={formData.price_per_litre || ''}
                onChange={(e) => setFormData({ ...formData, price_per_litre: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs font-mono focus:border-[#E53935]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Odometer Reading (KM) *</label>
              <input
                type="number"
                required
                min="0"
                value={formData.odometer_reading || ''}
                onChange={(e) => setFormData({ ...formData, odometer_reading: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs font-mono focus:border-[#E53935]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Fuel Station</label>
              <input
                type="text"
                placeholder="Station name / outlet"
                value={formData.fuel_station}
                onChange={(e) => setFormData({ ...formData, fuel_station: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
          </div>

          <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46] flex justify-between items-center text-xs">
            <span className="text-[#A1A1AA]">Total Fuel Cost:</span>
            <span className="font-bold text-[#E53935] text-sm font-mono">₹{((formData.quantity_litres || 0) * (formData.price_per_litre || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="pt-3 border-t border-[#3F3F46] flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs">Cancel</button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition shadow-md"
            >
              {isSubmitting ? 'Saving...' : 'Save Fuel Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 3. FASTAG RECHARGE MODAL
export const QuickFASTagRechargeModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicleId?: string;
  vehicleNumber?: string;
  currentBalance?: number;
}> = ({ isOpen, onClose, onSuccess, vehicleId, vehicleNumber, currentBalance }) => {
  const [amount, setAmount] = useState<number>(1000);
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !vehicleId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.rechargeFASTag({ vehicle_id: vehicleId, amount, payment_mode: paymentMode });
      onSuccess();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-sm bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-[#111113] border-b border-[#3F3F46] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-[#E53935]" />
            <h3 className="font-bold text-[#F5F5F5] text-base">FASTag Wallet Recharge</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#27272A]"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46] text-xs">
            <p className="text-[#A1A1AA]">Vehicle: <span className="text-[#F5F5F5] font-bold font-mono">{vehicleNumber}</span></p>
            <p className="text-[#A1A1AA] mt-1">Current Balance: <span className="text-[#22C55E] font-bold font-mono">₹{(currentBalance || 0).toFixed(2)}</span></p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Recharge Amount (₹)</label>
            <input
              type="number"
              required
              min="1"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs font-mono focus:border-[#E53935]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Payment Method</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
            >
              <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
              <option value="NetBanking">NetBanking</option>
              <option value="Card">Debit / Credit Card</option>
              <option value="Cash">Cash</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs">Cancel</button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition shadow-md"
            >
              {isSubmitting ? 'Processing...' : `Pay ₹${amount.toLocaleString()}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 4. QUICK INSURANCE MODAL
export const QuickInsuranceModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicleId?: string;
}> = ({ isOpen, onClose, onSuccess, vehicleId }) => {
  const [formData, setFormData] = useState(() => ({
    vehicle_id: vehicleId || '',
    insurance_company: '',
    policy_number: '',
    insurance_type: 'Comprehensive',
    policy_start_date: getTodayISODate(),
    policy_expiry_date: '',
    premium_amount: 0,
    insured_declared_value: 0,
    agent_name: '',
    agent_contact: ''
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (vehicleId) {
      setFormData(prev => ({ ...prev, vehicle_id: vehicleId }));
    }
  }, [vehicleId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.addInsurance(formData);
      onSuccess();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-[#111113] border-b border-[#3F3F46] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-[#E53935]" />
            <h3 className="font-bold text-[#F5F5F5] text-base">Add Insurance Policy</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#27272A]"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Insurance Company *</label>
            <input
              type="text"
              required
              placeholder="e.g. Tata AIG, ICICI Lombard, New India Assurance"
              value={formData.insurance_company}
              onChange={(e) => setFormData({ ...formData, insurance_company: e.target.value })}
              className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Policy Number *</label>
              <input
                type="text"
                required
                placeholder="Policy # / Ref"
                value={formData.policy_number}
                onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Expiry Date *</label>
              <input
                type="date"
                required
                value={formData.policy_expiry_date}
                onChange={(e) => setFormData({ ...formData, policy_expiry_date: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Premium (₹) *</label>
              <input
                type="number"
                required
                min="0"
                value={formData.premium_amount || ''}
                onChange={(e) => setFormData({ ...formData, premium_amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs font-mono focus:border-[#E53935]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Insured Declared Value (IDV ₹)</label>
              <input
                type="number"
                min="0"
                value={formData.insured_declared_value || ''}
                onChange={(e) => setFormData({ ...formData, insured_declared_value: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs font-mono focus:border-[#E53935]"
              />
            </div>
          </div>
          <div className="pt-3 border-t border-[#3F3F46] flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition shadow-md">
              {isSubmitting ? 'Saving...' : 'Save Policy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 5. QUICK PUC MODAL
export const QuickPUCModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicleId?: string;
}> = ({ isOpen, onClose, onSuccess, vehicleId }) => {
  const [formData, setFormData] = useState(() => ({
    vehicle_id: vehicleId || '',
    certificate_number: '',
    issue_date: getTodayISODate(),
    expiry_date: '',
    testing_center: '',
    emission_reading: '',
    fuel_type: 'Diesel'
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (vehicleId) {
      setFormData(prev => ({ ...prev, vehicle_id: vehicleId }));
    }
  }, [vehicleId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.addPUC(formData);
      onSuccess();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-[#111113] border-b border-[#3F3F46] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileCheck className="w-5 h-5 text-[#E53935]" />
            <h3 className="font-bold text-[#F5F5F5] text-base">Log Pollution (PUC) Record</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#27272A]"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Certificate Number *</label>
            <input
              type="text"
              required
              placeholder="e.g. PUC-2026-98124"
              value={formData.certificate_number}
              onChange={(e) => setFormData({ ...formData, certificate_number: e.target.value })}
              className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Issue Date</label>
              <input
                type="date"
                required
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Expiry Date *</label>
              <input
                type="date"
                required
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Authorized Testing Center</label>
            <input
              type="text"
              placeholder="Testing station name / RTO authorized agency"
              value={formData.testing_center}
              onChange={(e) => setFormData({ ...formData, testing_center: e.target.value })}
              className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
            />
          </div>
          <div className="pt-3 border-t border-[#3F3F46] flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition shadow-md">
              {isSubmitting ? 'Saving...' : 'Save PUC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 6. QUICK SERVICE / MAINTENANCE MODAL
export const QuickServiceModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicleId?: string;
}> = ({ isOpen, onClose, onSuccess, vehicleId }) => {
  const [formData, setFormData] = useState(() => ({
    vehicle_id: vehicleId || '',
    service_date: getTodayISODate(),
    service_type: 'General Service',
    workshop_name: '',
    current_odometer: 0,
    next_service_odometer: 0,
    next_service_date: '',
    labour_cost: 0,
    parts_cost: 0,
    parts_changed: '',
    service_notes: ''
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (vehicleId) {
      setFormData(prev => ({ ...prev, vehicle_id: vehicleId }));
    }
  }, [vehicleId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.addService(formData);
      onSuccess();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-[#111113] border-b border-[#3F3F46] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wrench className="w-5 h-5 text-[#E53935]" />
            <h3 className="font-bold text-[#F5F5F5] text-base">Log Workshop Service</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#27272A]"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Service Type *</label>
              <input
                type="text"
                required
                placeholder="e.g. Engine Oil, Brake Overhaul"
                value={formData.service_type}
                onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Workshop Name *</label>
              <input
                type="text"
                required
                placeholder="Workshop / Garage name"
                value={formData.workshop_name}
                onChange={(e) => setFormData({ ...formData, workshop_name: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Current Odometer (KM) *</label>
              <input
                type="number"
                required
                min="0"
                value={formData.current_odometer || ''}
                onChange={(e) => setFormData({ ...formData, current_odometer: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs font-mono focus:border-[#E53935]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Next Service Odometer (KM)</label>
              <input
                type="number"
                min="0"
                value={formData.next_service_odometer || ''}
                onChange={(e) => setFormData({ ...formData, next_service_odometer: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs font-mono focus:border-[#E53935]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Next Service Date</label>
              <input
                type="date"
                value={formData.next_service_date}
                onChange={(e) => setFormData({ ...formData, next_service_date: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Total Cost (₹)</label>
              <input
                type="number"
                min="0"
                value={(formData.parts_cost || 0) + (formData.labour_cost || 0) || ''}
                onChange={(e) => setFormData({ ...formData, parts_cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs font-mono focus:border-[#E53935]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Parts Changed / Replaced</label>
            <input
              type="text"
              placeholder="Items replaced (e.g. Filters, Brake pads, Oil)"
              value={formData.parts_changed}
              onChange={(e) => setFormData({ ...formData, parts_changed: e.target.value })}
              className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
            />
          </div>
          <div className="pt-3 border-t border-[#3F3F46] flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition shadow-md">
              {isSubmitting ? 'Saving...' : 'Save Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 7. QUICK CHALLAN RECORD MODAL
export const QuickChallanModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicleId?: string;
}> = ({ isOpen, onClose, onSuccess, vehicleId }) => {
  const [formData, setFormData] = useState(() => ({
    vehicle_id: vehicleId || '',
    challan_number: '',
    date: getTodayISODate(),
    time: '12:00',
    location: '',
    offence: '',
    amount: 0,
    due_date: ''
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (vehicleId) {
      setFormData(prev => ({ ...prev, vehicle_id: vehicleId }));
    }
  }, [vehicleId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.addChallan(formData);
      onSuccess();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-[#111113] border-b border-[#3F3F46] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-[#E53935]" />
            <h3 className="font-bold text-[#F5F5F5] text-base">Record Traffic Challan</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#27272A]"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Challan Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. TN-CH-2026-001"
                value={formData.challan_number}
                onChange={(e) => setFormData({ ...formData, challan_number: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Fine Amount (₹) *</label>
              <input
                type="number"
                required
                min="0"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs font-mono focus:border-[#E53935]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Offence Description *</label>
            <input
              type="text"
              required
              placeholder="e.g. Over speeding, Signal jump, No parking"
              value={formData.offence}
              onChange={(e) => setFormData({ ...formData, offence: e.target.value })}
              className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Location</label>
              <input
                type="text"
                placeholder="Violation place / highway"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Payment Due Date *</label>
              <input
                type="date"
                required
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
          </div>
          <div className="pt-3 border-t border-[#3F3F46] flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-[#B71C1C] hover:bg-[#E53935] text-[#F5F5F5] rounded-xl text-xs font-bold transition shadow-md">
              {isSubmitting ? 'Recording...' : 'Record Challan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 8. QUICK FITNESS CERTIFICATE MODAL
export const QuickFitnessModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicleId?: string;
}> = ({ isOpen, onClose, onSuccess, vehicleId }) => {
  const [formData, setFormData] = useState(() => ({
    vehicle_id: vehicleId || '',
    certificate_number: '',
    issue_date: getTodayISODate(),
    expiry_date: '',
    inspection_date: getTodayISODate(),
    testing_center: '',
    vehicle_class: 'Commercial Goods/Passenger',
    notes: ''
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (vehicleId) {
      setFormData(prev => ({ ...prev, vehicle_id: vehicleId }));
    }
  }, [vehicleId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.addFitness(formData);
      onSuccess();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-[#111113] border-b border-[#3F3F46] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileCheck className="w-5 h-5 text-[#E53935]" />
            <h3 className="font-bold text-[#F5F5F5] text-base">Add Fitness Certificate</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#27272A]"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Certificate Number *</label>
            <input
              type="text"
              required
              placeholder="e.g. FC-TN01-2026-88"
              value={formData.certificate_number}
              onChange={(e) => setFormData({ ...formData, certificate_number: e.target.value })}
              className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Inspection Date</label>
              <input
                type="date"
                required
                value={formData.inspection_date}
                onChange={(e) => setFormData({ ...formData, inspection_date: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Expiry Date *</label>
              <input
                type="date"
                required
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">ATS Testing Ground / Station</label>
            <input
              type="text"
              placeholder="Inspection center name"
              value={formData.testing_center}
              onChange={(e) => setFormData({ ...formData, testing_center: e.target.value })}
              className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
            />
          </div>
          <div className="pt-3 border-t border-[#3F3F46] flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition shadow-md">
              {isSubmitting ? 'Saving...' : 'Save Fitness Certificate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 9. QUICK PERMIT MODAL
export const QuickPermitModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicleId?: string;
}> = ({ isOpen, onClose, onSuccess, vehicleId }) => {
  const [formData, setFormData] = useState(() => ({
    vehicle_id: vehicleId || '',
    permit_number: '',
    permit_type: 'National Permit',
    permit_area: 'All India',
    issue_date: getTodayISODate(),
    expiry_date: '',
    issuing_authority: 'State Transport Authority',
    fee_paid: 0
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (vehicleId) {
      setFormData(prev => ({ ...prev, vehicle_id: vehicleId }));
    }
  }, [vehicleId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.addPermit(formData);
      onSuccess();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-[#111113] border-b border-[#3F3F46] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-[#E53935]" />
            <h3 className="font-bold text-[#F5F5F5] text-base">Add Vehicle Permit</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#27272A]"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Permit Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. NP-2026-99"
                value={formData.permit_number}
                onChange={(e) => setFormData({ ...formData, permit_number: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Permit Type</label>
              <select
                value={formData.permit_type}
                onChange={(e) => setFormData({ ...formData, permit_type: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              >
                <option value="National Permit">National Permit</option>
                <option value="State Goods Permit">State Goods Permit</option>
                <option value="All India Tourist Permit">All India Tourist Permit</option>
                <option value="Contract Carriage">Contract Carriage</option>
                <option value="School Bus Permit">School Bus Permit</option>
                <option value="Temporary Permit">Temporary Permit</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Coverage Area</label>
              <input
                type="text"
                placeholder="e.g. All India / State Zone"
                value={formData.permit_area}
                onChange={(e) => setFormData({ ...formData, permit_area: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Expiry Date *</label>
              <input
                type="date"
                required
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Permit Fee (₹)</label>
            <input
              type="number"
              min="0"
              value={formData.fee_paid || ''}
              onChange={(e) => setFormData({ ...formData, fee_paid: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs font-mono focus:border-[#E53935]"
            />
          </div>
          <div className="pt-3 border-t border-[#3F3F46] flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition shadow-md">
              {isSubmitting ? 'Saving...' : 'Save Permit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 10. QUICK ROAD TAX MODAL
export const QuickRoadTaxModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicleId?: string;
}> = ({ isOpen, onClose, onSuccess, vehicleId }) => {
  const [formData, setFormData] = useState(() => ({
    vehicle_id: vehicleId || '',
    tax_type: 'Annual',
    tax_amount: 0,
    payment_date: getTodayISODate(),
    next_due_date: '',
    receipt_number: '',
    payment_mode: 'Online Portal'
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (vehicleId) {
      setFormData(prev => ({ ...prev, vehicle_id: vehicleId }));
    }
  }, [vehicleId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.payRoadTax(formData);
      onSuccess();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-[#111113] border-b border-[#3F3F46] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-[#E53935]" />
            <h3 className="font-bold text-[#F5F5F5] text-base">Record Road Tax Payment</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#27272A]"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Tax Type</label>
              <select
                value={formData.tax_type}
                onChange={(e) => setFormData({ ...formData, tax_type: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              >
                <option value="Annual">Annual</option>
                <option value="Half-Yearly">Half-Yearly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Lifetime">Lifetime</option>
                <option value="One-Time">One-Time</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Tax Amount (₹) *</label>
              <input
                type="number"
                required
                min="0"
                value={formData.tax_amount || ''}
                onChange={(e) => setFormData({ ...formData, tax_amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs font-mono focus:border-[#E53935]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Payment Date</label>
              <input
                type="date"
                required
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Next Due Date *</label>
              <input
                type="date"
                required
                value={formData.next_due_date}
                onChange={(e) => setFormData({ ...formData, next_due_date: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Receipt Number *</label>
            <input
              type="text"
              required
              placeholder="e.g. TAX-REC-2026-90"
              value={formData.receipt_number}
              onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
              className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
            />
          </div>
          <div className="pt-3 border-t border-[#3F3F46] flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition shadow-md">
              {isSubmitting ? 'Saving...' : 'Save Tax Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 11. QUICK TYRE MODAL
export const QuickTyreModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicleId?: string;
}> = ({ isOpen, onClose, onSuccess, vehicleId }) => {
  const [formData, setFormData] = useState(() => ({
    vehicle_id: vehicleId || '',
    tyre_position: 'Front Left',
    brand: '',
    model: '',
    size: '',
    purchase_date: getTodayISODate(),
    purchase_cost: 0,
    installation_date: getTodayISODate(),
    current_km: 0,
    expected_km: 80000,
    condition: 'New'
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (vehicleId) {
      setFormData(prev => ({ ...prev, vehicle_id: vehicleId }));
    }
  }, [vehicleId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.addTyre(formData);
      onSuccess();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-[#111113] border-b border-[#3F3F46] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Disc className="w-5 h-5 text-[#E53935]" />
            <h3 className="font-bold text-[#F5F5F5] text-base">Add Tyre Record</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#27272A]"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Tyre Position</label>
              <select
                value={formData.tyre_position}
                onChange={(e) => setFormData({ ...formData, tyre_position: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              >
                <option value="Front Left">Front Left</option>
                <option value="Front Right">Front Right</option>
                <option value="Rear Left Outer">Rear Left Outer</option>
                <option value="Rear Left Inner">Rear Left Inner</option>
                <option value="Rear Right Outer">Rear Right Outer</option>
                <option value="Rear Right Inner">Rear Right Inner</option>
                <option value="Spare">Spare</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Brand *</label>
              <input
                type="text"
                required
                placeholder="e.g. MRF, Apollo, Michelin"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Size Specification</label>
              <input
                type="text"
                placeholder="e.g. 295/80 R22.5"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Purchase Cost (₹)</label>
              <input
                type="number"
                min="0"
                value={formData.purchase_cost || ''}
                onChange={(e) => setFormData({ ...formData, purchase_cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs font-mono focus:border-[#E53935]"
              />
            </div>
          </div>
          <div className="pt-3 border-t border-[#3F3F46] flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition shadow-md">
              {isSubmitting ? 'Saving...' : 'Save Tyre'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 12. QUICK BATTERY MODAL
export const QuickBatteryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicleId?: string;
}> = ({ isOpen, onClose, onSuccess, vehicleId }) => {
  const [formData, setFormData] = useState(() => ({
    vehicle_id: vehicleId || '',
    battery_number: '',
    brand: '',
    model: '',
    purchase_date: getTodayISODate(),
    warranty_expiry: '',
    installation_date: getTodayISODate(),
    current_condition: 'Healthy',
    cost: 0
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (vehicleId) {
      setFormData(prev => ({ ...prev, vehicle_id: vehicleId }));
    }
  }, [vehicleId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.addBattery(formData);
      onSuccess();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-[#111113] border-b border-[#3F3F46] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Battery className="w-5 h-5 text-[#E53935]" />
            <h3 className="font-bold text-[#F5F5F5] text-base">Add Battery Record</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#27272A]"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Battery Serial / Number *</label>
              <input
                type="text"
                required
                placeholder="Serial #"
                value={formData.battery_number}
                onChange={(e) => setFormData({ ...formData, battery_number: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Brand *</label>
              <input
                type="text"
                required
                placeholder="e.g. Exide, Amaron"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Warranty Expiry</label>
              <input
                type="date"
                required
                value={formData.warranty_expiry}
                onChange={(e) => setFormData({ ...formData, warranty_expiry: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:border-[#E53935]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1">Cost (₹)</label>
              <input
                type="number"
                min="0"
                value={formData.cost || ''}
                onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs font-mono focus:border-[#E53935]"
              />
            </div>
          </div>
          <div className="pt-3 border-t border-[#3F3F46] flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition shadow-md">
              {isSubmitting ? 'Saving...' : 'Save Battery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 13. QUICK VEHICLE THRESHOLD OVERRIDES MODAL
export const VehicleThresholdModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicleId: string;
  vehicleNumber: string;
}> = ({ isOpen, onClose, onSuccess, vehicleId, vehicleNumber }) => {
  const [thresholds, setThresholds] = useState<VehicleThresholdSettings>({
    vehicle_id: vehicleId,
    insurance_reminder_days: null,
    puc_reminder_days: null,
    fitness_reminder_days: null,
    permit_reminder_days: null,
    road_tax_reminder_days: null,
    fastag_min_balance_threshold: null,
    service_km_threshold: null,
    maintenance_days_threshold: null,
    fuel_anomaly_threshold: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && vehicleId) {
      setLoading(true);
      api.getVehicleSettings(vehicleId)
        .then(data => {
          if (data) setThresholds(prev => ({ ...prev, ...data, vehicle_id: vehicleId }));
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen, vehicleId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateVehicleSettings(vehicleId, thresholds);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to save vehicle threshold overrides:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-lg bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 bg-[#111113] border-b border-[#3F3F46] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-[#E53935]" />
            <div>
              <h3 className="font-bold text-[#F5F5F5] text-base">Vehicle-Specific Threshold Overrides</h3>
              <p className="text-xs text-[#A1A1AA]">Target Vehicle: <span className="text-[#E53935] font-mono font-bold">{vehicleNumber}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#27272A]"><X className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[#A1A1AA] text-xs">Loading vehicle threshold overrides...</div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
            <p className="text-[#A1A1AA] text-[11px]">
              Leave blank to use the global fleet default setting. Values entered here take highest priority for this vehicle.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#D4D4D8] font-semibold mb-1">Insurance Reminder (Days)</label>
                <input
                  type="number"
                  placeholder="Global default"
                  value={thresholds.insurance_reminder_days ?? ''}
                  onChange={(e) => setThresholds({ ...thresholds, insurance_reminder_days: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:border-[#E53935]"
                />
              </div>

              <div>
                <label className="block text-[#D4D4D8] font-semibold mb-1">PUC Reminder (Days)</label>
                <input
                  type="number"
                  placeholder="Global default"
                  value={thresholds.puc_reminder_days ?? ''}
                  onChange={(e) => setThresholds({ ...thresholds, puc_reminder_days: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:border-[#E53935]"
                />
              </div>

              <div>
                <label className="block text-[#D4D4D8] font-semibold mb-1">Fitness Reminder (Days)</label>
                <input
                  type="number"
                  placeholder="Global default"
                  value={thresholds.fitness_reminder_days ?? ''}
                  onChange={(e) => setThresholds({ ...thresholds, fitness_reminder_days: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:border-[#E53935]"
                />
              </div>

              <div>
                <label className="block text-[#D4D4D8] font-semibold mb-1">Permit Reminder (Days)</label>
                <input
                  type="number"
                  placeholder="Global default"
                  value={thresholds.permit_reminder_days ?? ''}
                  onChange={(e) => setThresholds({ ...thresholds, permit_reminder_days: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:border-[#E53935]"
                />
              </div>

              <div>
                <label className="block text-[#D4D4D8] font-semibold mb-1">FASTag Min Balance (₹)</label>
                <input
                  type="number"
                  placeholder="Global default"
                  value={thresholds.fastag_min_balance_threshold ?? ''}
                  onChange={(e) => setThresholds({ ...thresholds, fastag_min_balance_threshold: e.target.value ? parseFloat(e.target.value) : null })}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:border-[#E53935]"
                />
              </div>

              <div>
                <label className="block text-[#D4D4D8] font-semibold mb-1">Service Due Window (KM)</label>
                <input
                  type="number"
                  placeholder="Global default"
                  value={thresholds.service_km_threshold ?? ''}
                  onChange={(e) => setThresholds({ ...thresholds, service_km_threshold: e.target.value ? parseFloat(e.target.value) : null })}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:border-[#E53935]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#3F3F46] flex justify-end space-x-2">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs">Cancel</button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition flex items-center space-x-1 shadow-md"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Vehicle Overrides'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// 14. ADD / CONFIGURE FASTAG MODAL
export const AddFASTagModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicleId?: string;
  preselectedVehicleId?: string;
}> = ({ isOpen, onClose, onSuccess, vehicleId, preselectedVehicleId }) => {
  const targetId = vehicleId || preselectedVehicleId || '';
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [formData, setFormData] = useState({
    vehicle_id: targetId,
    fastag_id: '',
    issuer_bank: 'ICICI Bank',
    wallet_balance: 1000,
    minimum_balance: 500,
    linked_mobile_number: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getVehicles().then(setVehicles).catch(console.error);
      const effectiveId = vehicleId || preselectedVehicleId || '';
      if (effectiveId) {
        setFormData(prev => ({ ...prev, vehicle_id: effectiveId }));
      }
    }
  }, [isOpen, vehicleId, preselectedVehicleId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.rechargeFASTag({ vehicle_id: formData.vehicle_id, amount: formData.wallet_balance });
      onSuccess();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-[#111113] border-b border-[#3F3F46] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-[#E53935]" />
            <h3 className="font-bold text-[#F5F5F5] text-base">Setup / Link FASTag</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#27272A]"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs">
          <div>
            <label className="block text-[#D4D4D8] font-semibold mb-1">Vehicle *</label>
            <select
              required
              value={formData.vehicle_id}
              onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
              className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] focus:border-[#E53935]"
            >
              <option value="">-- Choose Vehicle --</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.vehicle_number} ({v.make} {v.model})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#D4D4D8] font-semibold mb-1">FASTag Tag ID *</label>
              <input
                type="text"
                required
                placeholder="e.g. 34161FA82032"
                value={formData.fastag_id}
                onChange={(e) => setFormData({ ...formData, fastag_id: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:border-[#E53935]"
              />
            </div>
            <div>
              <label className="block text-[#D4D4D8] font-semibold mb-1">Issuer Bank</label>
              <select
                value={formData.issuer_bank}
                onChange={(e) => setFormData({ ...formData, issuer_bank: e.target.value })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] focus:border-[#E53935]"
              >
                <option value="ICICI Bank">ICICI Bank</option>
                <option value="HDFC Bank">HDFC Bank</option>
                <option value="State Bank of India">State Bank of India</option>
                <option value="Axis Bank">Axis Bank</option>
                <option value="Paytm Payments Bank">Paytm Payments Bank</option>
                <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                <option value="IDBI Bank">IDBI Bank</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#D4D4D8] font-semibold mb-1">Initial Wallet Balance (₹)</label>
              <input
                type="number"
                min="0"
                value={formData.wallet_balance}
                onChange={(e) => setFormData({ ...formData, wallet_balance: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:border-[#E53935]"
              />
            </div>
            <div>
              <label className="block text-[#D4D4D8] font-semibold mb-1">Minimum Alert Threshold (₹)</label>
              <input
                type="number"
                min="50"
                value={formData.minimum_balance}
                onChange={(e) => setFormData({ ...formData, minimum_balance: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:border-[#E53935]"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#3F3F46] flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] text-[#F5F5F5] rounded-xl">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl font-bold transition shadow-md">
              {isSubmitting ? 'Linking...' : 'Save FASTag Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Aliases for clean interoperability across all hub pages
export {
  QuickBookingModal as AddBookingModal,
  QuickFuelModal as AddFuelModal,
  QuickInsuranceModal as AddInsuranceModal,
  QuickPUCModal as AddPUCModal,
  QuickFitnessModal as AddFitnessModal,
  QuickPermitModal as AddPermitModal,
  QuickRoadTaxModal as AddRoadTaxModal,
  QuickServiceModal as AddServiceModal,
  QuickChallanModal as AddChallanModal,
  QuickTyreModal as AddTyreModal,
  QuickBatteryModal as AddBatteryModal
};
