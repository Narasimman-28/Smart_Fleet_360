import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, Fuel, Trash2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import type { FuelRecord } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { QuickFuelModal } from '../components/AddRecordModals';

interface FuelHubPageProps {
  onNavigate?: (path: string) => void;
}

export const FuelHubPage: React.FC<FuelHubPageProps> = () => {
  const { showSuccess, showError } = useToast();
  const [fuelLogs, setFuelLogs] = useState<FuelRecord[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingFuel, setDeletingFuel] = useState<FuelRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [logs, stats] = await Promise.all([
        api.getFuelLogs(),
        api.getFuelAnalytics()
      ]);
      setFuelLogs(logs || []);
      setAnalytics(stats || null);
    } catch (err) {
      console.error('Failed to load fuel data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFuel = async () => {
    if (!deletingFuel) return;
    setIsDeleting(true);
    try {
      await api.deleteFuelLog(deletingFuel.id);
      showSuccess('Record deleted successfully.');
      setDeletingFuel(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete fuel log:', err);
      showError('Unable to delete this record. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight">Fuel & Mileage Telematics</h1>
          <p className="text-xs text-[#A1A1AA] mt-0.5">Refill tracking, KM/L fuel efficiency calculations, and fuel cost per KM</p>
        </div>

        <button
          onClick={() => setIsFuelModalOpen(true)}
          className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/25 transition flex items-center space-x-1.5 cursor-pointer border border-[#FF1744]/30"
        >
          <Plus className="w-4 h-4" />
          <span>+ Record Fuel Refill</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <span className="text-xs font-semibold text-[#A1A1AA]">Monthly Fuel Expense</span>
          <div className="text-2xl font-extrabold text-[#F59E0B] font-mono mt-1">₹{(analytics?.monthCost || 0).toLocaleString()}</div>
          <span className="text-[11px] text-[#71717A] mt-1 block font-mono">{(analytics?.monthLitres || 0).toLocaleString()} Litres this month</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <span className="text-xs font-semibold text-[#A1A1AA]">Fleet Average Mileage</span>
          <div className="text-2xl font-extrabold text-[#22C55E] font-mono mt-1">
            {analytics?.avgKmPerLitre ? `${analytics.avgKmPerLitre} KM/L` : '—'}
          </div>
          <span className="text-[11px] text-[#71717A] mt-1 block">Cross-category benchmark</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <span className="text-xs font-semibold text-[#A1A1AA]">Average Cost / KM</span>
          <div className="text-2xl font-extrabold text-[#60A5FA] font-mono mt-1">
            {analytics?.avgCostPerKm ? `₹${analytics.avgCostPerKm} / KM` : '—'}
          </div>
          <span className="text-[11px] text-[#71717A] mt-1 block">Fuel operating expenditure</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <span className="text-xs font-semibold text-[#A1A1AA]">Total Fuel Dispensed</span>
          <div className="text-2xl font-extrabold text-[#FF1744] font-mono mt-1">{(analytics?.totalLitres || 0).toLocaleString()} L</div>
          <span className="text-[11px] text-[#71717A] mt-1 block">Total lifetime fleet volume</span>
        </div>
      </div>

      {/* Vehicle-wise Fuel Efficiency & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Fuel Trend Chart */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <h3 className="text-sm font-bold text-[#F5F5F5] mb-1">Monthly Fuel Expenditure (₹)</h3>
          <p className="text-xs text-[#A1A1AA] mb-4">Volume in litres vs total financial expenditure</p>

          <div className="h-64 w-full">
            {analytics?.monthlyTrend && analytics.monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.monthlyTrend}>
                  <XAxis dataKey="month" stroke="#71717A" fontSize={11} />
                  <YAxis stroke="#71717A" fontSize={11} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181B', borderColor: '#7F1D1D', borderRadius: '12px', fontSize: '12px', color: '#F5F5F5' }}
                    formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Fuel Expense']}
                  />
                  <Bar dataKey="cost" fill="#E53935" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[#71717A] text-xs">
                No monthly fuel logs to display chart.
              </div>
            )}
          </div>
        </div>

        {/* Driver Efficiency Leaders */}
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-3">
          <h3 className="text-sm font-bold text-[#F5F5F5]">Driver Fuel Rankings</h3>
          <p className="text-xs text-[#A1A1AA]">Mileage economy performance</p>

          <div className="space-y-2.5 pt-2">
            {analytics?.driverBreakdown && analytics.driverBreakdown.length > 0 ? (
              analytics.driverBreakdown.slice(0, 5).map((d: any, i: number) => (
                <div key={i} className="p-3 rounded-xl bg-[#111113] border border-[#3F3F46] flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#F5F5F5]">{d.driver_name}</span>
                    <p className="text-[10px] text-[#71717A] font-mono">{d.trips_count} refills • {d.total_litres}L</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#22C55E] font-mono">{d.avg_mileage ? `${Number(d.avg_mileage).toFixed(1)} km/L` : '—'}</span>
                    <span className="text-[10px] text-[#71717A] font-mono block">₹{Number(d.total_spent).toLocaleString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-[#71717A] text-xs">
                No driver refill rankings yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fuel Logs Table */}
      <div className="rounded-2xl bg-[#18181B] border border-[#3F3F46] overflow-hidden shadow-xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-[#F5F5F5]">Detailed Refill Log History</h3>

        <div className="overflow-x-auto rounded-xl border border-[#3F3F46]">
          {isLoading ? (
            <div className="py-20 text-center text-[#A1A1AA]">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#E53935]" />
              <p className="text-sm">Loading fuel logs...</p>
            </div>
          ) : fuelLogs.length === 0 ? (
            <div className="py-16 text-center space-y-3 p-6 bg-[#111113]">
              <Fuel className="w-10 h-10 text-[#F59E0B] mx-auto opacity-70" />
              <h4 className="text-sm font-bold text-[#F5F5F5]">No fuel refill records</h4>
              <p className="text-xs text-[#A1A1AA] max-w-sm mx-auto">
                Log fuel dispensing events with liters, rate per liter, and odometer readings to calculate KM/L efficiency.
              </p>
              <button
                onClick={() => setIsFuelModalOpen(true)}
                className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition cursor-pointer border border-[#FF1744]/30"
              >
                + Record First Refill
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-[#F5F5F5]">
              <thead className="bg-[#27272A] text-[#F5F5F5] text-[11px] uppercase tracking-wider border-b border-[#3F3F46]">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Vehicle Number</th>
                  <th className="p-3.5">Driver</th>
                  <th className="p-3.5">Fuel Station</th>
                  <th className="p-3.5">Quantity</th>
                  <th className="p-3.5">Price/L</th>
                  <th className="p-3.5">Total Amount</th>
                  <th className="p-3.5">Odometer</th>
                  <th className="p-3.5">Calculated KM/L</th>
                  <th className="p-3.5">Cost / KM</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3F3F46]">
                {fuelLogs.map((f) => (
                  <tr key={f.id} className="hover:bg-[#202024] bg-[#18181B]">
                    <td className="p-3.5 font-mono text-[11px] text-[#A1A1AA]">{f.date}</td>
                    <td className="p-3.5 font-bold text-[#FF1744] font-mono">{f.vehicle_number}</td>
                    <td className="p-3.5 text-[#D4D4D8]">{f.driver_name || 'Fleet Driver'}</td>
                    <td className="p-3.5 text-[#F5F5F5]">{f.fuel_station}</td>
                    <td className="p-3.5 font-mono">{f.quantity_litres} L</td>
                    <td className="p-3.5 font-mono">₹{f.price_per_litre}</td>
                    <td className="p-3.5 font-bold text-[#F59E0B] font-mono">₹{f.total_amount.toLocaleString()}</td>
                    <td className="p-3.5 font-mono text-[#A1A1AA]">{f.odometer_reading.toLocaleString()} km</td>
                    <td className="p-3.5 font-bold text-[#22C55E] font-mono">{f.km_per_litre ? `${f.km_per_litre} km/L` : '—'}</td>
                    <td className="p-3.5 font-mono text-[#60A5FA]">{f.cost_per_km ? `₹${f.cost_per_km}/km` : '—'}</td>
                    <td className="p-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setDeletingFuel(f)}
                        className="p-1.5 text-[#71717A] hover:text-[#FF1744] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                        title="Delete Fuel Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <QuickFuelModal
        isOpen={isFuelModalOpen}
        onClose={() => setIsFuelModalOpen(false)}
        onSuccess={loadData}
      />

      {/* Delete Fuel Record Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingFuel}
        title="Delete Fuel Record"
        itemName={deletingFuel ? `${deletingFuel.vehicle_number} - ₹${deletingFuel.total_amount}` : undefined}
        itemDetails={deletingFuel ? `Date: ${deletingFuel.date} • ${deletingFuel.quantity_litres} Litres at ${deletingFuel.fuel_station || 'Station'}` : undefined}
        isLoading={isDeleting}
        onConfirm={handleDeleteFuel}
        onCancel={() => setDeletingFuel(null)}
      />
    </div>
  );
};

export default FuelHubPage;
