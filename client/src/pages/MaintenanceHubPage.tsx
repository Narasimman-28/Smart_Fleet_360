import React, { useState, useEffect } from 'react';
import { Wrench, Plus, RefreshCw, Disc, Battery, Trash2 } from 'lucide-react';
import type { ServiceRecord, TyreRecord, BatteryRecord } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { AddServiceModal, AddTyreModal, AddBatteryModal } from '../components/AddRecordModals';

interface MaintenanceHubPageProps {
  onNavigate?: (path: string) => void;
}

export const MaintenanceHubPage: React.FC<MaintenanceHubPageProps> = () => {
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<'services' | 'tyres' | 'batteries'>('services');
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [tyres, setTyres] = useState<TyreRecord[]>([]);
  const [batteries, setBatteries] = useState<BatteryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Delete state
  const [deletingService, setDeletingService] = useState<ServiceRecord | null>(null);
  const [deletingTyre, setDeletingTyre] = useState<TyreRecord | null>(null);
  const [deletingBattery, setDeletingBattery] = useState<BatteryRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modals
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isTyreModalOpen, setIsTyreModalOpen] = useState(false);
  const [isBatteryModalOpen, setIsBatteryModalOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [srv, tyr, bat] = await Promise.all([
        api.getServices(),
        api.getTyres(),
        api.getBatteries()
      ]);
      setServices(srv || []);
      setTyres(tyr || []);
      setBatteries(bat || []);
    } catch (err) {
      console.error('Failed to load maintenance data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteService = async () => {
    if (!deletingService) return;
    setIsDeleting(true);
    try {
      await api.deleteService(deletingService.id);
      showSuccess('Record deleted successfully.');
      setDeletingService(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete service record:', err);
      showError('Unable to delete this record. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteTyre = async () => {
    if (!deletingTyre) return;
    setIsDeleting(true);
    try {
      await api.deleteTyre(deletingTyre.id);
      showSuccess('Record deleted successfully.');
      setDeletingTyre(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete tyre record:', err);
      showError('Unable to delete this record. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteBattery = async () => {
    if (!deletingBattery) return;
    setIsDeleting(true);
    try {
      await api.deleteBattery(deletingBattery.id);
      showSuccess('Record deleted successfully.');
      setDeletingBattery(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete battery record:', err);
      showError('Unable to delete this record. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalMaintenanceSpent = services.reduce((acc, curr) => acc + (curr.total_cost || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight">Maintenance, Tyres & Batteries Hub</h1>
          <p className="text-xs text-[#A1A1AA] mt-0.5">Odometer-based scheduled servicing, tyre wear tracking & battery health monitoring</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsTyreModalOpen(true)}
            className="px-3.5 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs font-semibold border border-[#3F3F46] transition flex items-center space-x-1.5"
          >
            <Disc className="w-3.5 h-3.5 text-[#E53935]" />
            <span>+ Add Tyre</span>
          </button>
          <button
            onClick={() => setIsBatteryModalOpen(true)}
            className="px-3.5 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs font-semibold border border-[#3F3F46] transition flex items-center space-x-1.5"
          >
            <Battery className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>+ Add Battery</span>
          </button>
          <button
            onClick={() => setIsServiceModalOpen(true)}
            className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/20 transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Log Service</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <span className="text-xs font-semibold text-[#A1A1AA]">Total Maintenance Expenditure</span>
          <div className="text-2xl font-extrabold text-[#E53935] font-mono mt-1">₹{totalMaintenanceSpent.toLocaleString()}</div>
          <span className="text-[11px] text-[#71717A] mt-1 block">Across {services.length} recorded workshop events</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <span className="text-xs font-semibold text-[#A1A1AA]">Tracked Tyre Positions</span>
          <div className="text-2xl font-extrabold text-[#F5F5F5] font-mono mt-1">{tyres.length} Wheels</div>
          <span className="text-[11px] text-[#71717A] mt-1 block">{tyres.filter(t => t.condition === 'Worn' || t.condition === 'Critical').length} Tyres due for replacement</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <span className="text-xs font-semibold text-[#A1A1AA]">Battery Units Monitored</span>
          <div className="text-2xl font-extrabold text-[#60A5FA] font-mono mt-1">{batteries.length} Batteries</div>
          <span className="text-[11px] text-[#71717A] mt-1 block">{batteries.filter(b => b.current_condition === 'Weak' || b.current_condition === 'Replace Soon').length} Weak batteries</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-[#3F3F46] pb-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('services')}
          className={`px-3.5 py-2 rounded-xl transition ${activeTab === 'services' ? 'bg-[#B71C1C] text-[#F5F5F5] shadow-md shadow-[#B71C1C]/30' : 'text-[#A1A1AA] hover:text-[#F5F5F5] bg-[#18181B] border border-[#3F3F46]'}`}
        >
          Service & Mechanical Invoices ({services.length})
        </button>
        <button
          onClick={() => setActiveTab('tyres')}
          className={`px-3.5 py-2 rounded-xl transition ${activeTab === 'tyres' ? 'bg-[#B71C1C] text-[#F5F5F5] shadow-md shadow-[#B71C1C]/30' : 'text-[#A1A1AA] hover:text-[#F5F5F5] bg-[#18181B] border border-[#3F3F46]'}`}
        >
          Tyre Lifecycle & Tread ({tyres.length})
        </button>
        <button
          onClick={() => setActiveTab('batteries')}
          className={`px-3.5 py-2 rounded-xl transition ${activeTab === 'batteries' ? 'bg-[#B71C1C] text-[#F5F5F5] shadow-md shadow-[#B71C1C]/30' : 'text-[#A1A1AA] hover:text-[#F5F5F5] bg-[#18181B] border border-[#3F3F46]'}`}
        >
          Battery Warranty & Health ({batteries.length})
        </button>
      </div>

      {/* TAB 1: Services List */}
      {activeTab === 'services' && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="py-20 text-center text-[#A1A1AA]">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#E53935]" />
              <p className="text-sm">Loading service history...</p>
            </div>
          ) : services.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-[#18181B] border border-[#3F3F46] rounded-2xl p-6">
              <Wrench className="w-10 h-10 text-[#E53935]/50 mx-auto" />
              <h4 className="text-sm font-bold text-[#F5F5F5]">No maintenance or service invoices</h4>
              <p className="text-xs text-[#A1A1AA] max-w-sm mx-auto">
                Record periodic maintenance, oil changes, engine repairs and parts replacements.
              </p>
              <button
                onClick={() => setIsServiceModalOpen(true)}
                className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition cursor-pointer"
              >
                + Log First Service
              </button>
            </div>
          ) : (
            services.map((s) => (
              <div key={s.id} className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-3 hover:border-[#7F1D1D] transition">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-[#7F1D1D]/20 border border-[#7F1D1D]/40 rounded-xl text-[#FF1744]">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#F5F5F5] text-sm">{s.service_type}</h3>
                      <p className="text-xs text-[#A1A1AA] font-mono">{s.vehicle_number} • {s.workshop_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="text-base font-extrabold text-[#E53935] font-mono">₹{s.total_cost.toLocaleString()}</span>
                      <span className="text-[10px] text-[#71717A] block font-mono">{s.service_date}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeletingService(s)}
                      className="p-1.5 text-[#71717A] hover:text-[#FF1744] hover:bg-[#3F1111] border border-transparent hover:border-[#7F1D1D] rounded-lg transition cursor-pointer ml-1"
                      title="Delete Service Record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-[#111113] p-3 rounded-xl border border-[#3F3F46]">
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
                    <span className="font-semibold text-[#D4D4D8] font-mono">₹{(s.parts_cost || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[#71717A] block">Labour Cost</span>
                    <span className="font-semibold text-[#D4D4D8] font-mono">₹{(s.labour_cost || 0).toLocaleString()}</span>
                  </div>
                </div>

                {s.parts_changed && (
                  <p className="text-xs text-[#A1A1AA]">
                    <strong className="text-[#F5F5F5]">Parts Replaced:</strong> {s.parts_changed}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: Tyres */}
      {activeTab === 'tyres' && (
        <div className="space-y-4">
          {tyres.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-[#18181B] border border-[#3F3F46] rounded-2xl p-6">
              <Disc className="w-10 h-10 text-[#E53935]/50 mx-auto" />
              <h4 className="text-sm font-bold text-[#F5F5F5]">No tyres registered</h4>
              <p className="text-xs text-[#A1A1AA] max-w-sm mx-auto">
                Track tyre brand, size, wear condition and replacement mileage.
              </p>
              <button
                onClick={() => setIsTyreModalOpen(true)}
                className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition cursor-pointer"
              >
                + Add Tyre
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tyres.map((t) => (
                <div key={t.id} className="p-4 rounded-xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-2 text-xs hover:border-[#7F1D1D] transition">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-[#F5F5F5] text-sm">{t.vehicle_number}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.condition === 'Good' ? 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40' :
                        t.condition === 'Fair' ? 'bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/40' :
                        'bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]'
                      }`}>
                        {t.condition}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDeletingTyre(t)}
                        className="p-1 text-[#71717A] hover:text-[#FF1744] hover:bg-[#3F1111] border border-transparent hover:border-[#7F1D1D] rounded-lg transition cursor-pointer"
                        title="Delete Tyre Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="font-semibold text-[#E53935]">{t.tyre_position}</p>
                  <p className="text-[#A1A1AA]">{t.brand} {t.size ? `• ${t.size}` : ''}</p>
                  <div className="pt-2 border-t border-[#3F3F46] flex justify-between text-[11px] font-mono text-[#A1A1AA]">
                    <span>Current: {(t.current_km || 0).toLocaleString()} km</span>
                    <span>Max: {(t.expected_km || 0).toLocaleString()} km</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Batteries */}
      {activeTab === 'batteries' && (
        <div className="space-y-4">
          {batteries.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-[#18181B] border border-[#3F3F46] rounded-2xl p-6">
              <Battery className="w-10 h-10 text-[#22C55E]/50 mx-auto" />
              <h4 className="text-sm font-bold text-[#F5F5F5]">No batteries registered</h4>
              <p className="text-xs text-[#A1A1AA] max-w-sm mx-auto">
                Record battery serial numbers, warranty expiry dates and electrical condition.
              </p>
              <button
                onClick={() => setIsBatteryModalOpen(true)}
                className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition cursor-pointer"
              >
                + Add Battery
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {batteries.map((b) => (
                <div key={b.id} className="p-4 rounded-xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-2 text-xs hover:border-[#7F1D1D] transition">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-[#F5F5F5] text-sm">{b.vehicle_number}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40">
                        {b.current_condition}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDeletingBattery(b)}
                        className="p-1 text-[#71717A] hover:text-[#FF1744] hover:bg-[#3F1111] border border-transparent hover:border-[#7F1D1D] rounded-lg transition cursor-pointer"
                        title="Delete Battery Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="font-semibold text-[#F5F5F5]">{b.brand} {b.model || ''}</p>
                  <p className="text-[#A1A1AA] font-mono">Serial: {b.battery_number || '—'}</p>
                  <div className="pt-2 border-t border-[#3F3F46] text-[11px] text-[#A1A1AA]">
                    Warranty Valid Until: <strong className="text-[#60A5FA] font-mono">{b.warranty_expiry || '—'}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <AddServiceModal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        onSuccess={loadData}
      />
      <AddTyreModal
        isOpen={isTyreModalOpen}
        onClose={() => setIsTyreModalOpen(false)}
        onSuccess={loadData}
      />
      <AddBatteryModal
        isOpen={isBatteryModalOpen}
        onClose={() => setIsBatteryModalOpen(false)}
        onSuccess={loadData}
      />

      {/* Delete Service Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingService}
        title="Delete Service Record"
        itemName={deletingService ? `${deletingService.vehicle_number} - ${deletingService.service_type}` : undefined}
        itemDetails={deletingService ? `Date: ${deletingService.service_date} • Workshop: ${deletingService.workshop_name} • ₹${deletingService.total_cost}` : undefined}
        isLoading={isDeleting}
        onConfirm={handleDeleteService}
        onCancel={() => setDeletingService(null)}
      />

      {/* Delete Tyre Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingTyre}
        title="Delete Tyre Record"
        itemName={deletingTyre ? `${deletingTyre.vehicle_number} - ${deletingTyre.tyre_position}` : undefined}
        itemDetails={deletingTyre ? `Brand: ${deletingTyre.brand} ${deletingTyre.size || ''}` : undefined}
        isLoading={isDeleting}
        onConfirm={handleDeleteTyre}
        onCancel={() => setDeletingTyre(null)}
      />

      {/* Delete Battery Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingBattery}
        title="Delete Battery Record"
        itemName={deletingBattery ? `${deletingBattery.vehicle_number} - ${deletingBattery.brand}` : undefined}
        itemDetails={deletingBattery ? `Serial: ${deletingBattery.battery_number || 'N/A'}` : undefined}
        isLoading={isDeleting}
        onConfirm={handleDeleteBattery}
        onCancel={() => setDeletingBattery(null)}
      />
    </div>
  );
};
