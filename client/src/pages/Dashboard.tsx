import React, { useState, useEffect } from 'react';
import {
  Truck, Shield, CreditCard, Wrench, Fuel,
  Calendar, ArrowRight, Plus, RefreshCw, Layers, AlertOctagon, FileCheck,
  TrendingUp, Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, PieChart, Pie, Cell
} from 'recharts';
import { api } from '../services/api';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { DriverLocationWatch } from '../components/DriverLocationWatch';
import { resolveVehicleImageUrl } from '../utils/imageUrl';
import type { Vehicle } from '../types';

interface DashboardProps {
  onNavigate: (path: string) => void;
  onOpenQuickAdd: (type: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onOpenQuickAdd }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { runComplianceScan, isScanning } = useNotifications();

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const [statsData, vehiclesData] = await Promise.all([
        api.getDashboardStats(),
        api.getVehicles().catch(() => [])
      ]);
      setStats(statsData);
      setVehicles(vehiclesData || []);
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const COLORS = ['#E53935', '#FF1744', '#B71C1C', '#F59E0B', '#22C55E', '#60A5FA', '#A855F7'];

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#E53935] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[#A1A1AA] text-sm font-medium">Aggregating telemetry & compliance stats from database...</p>
        </div>
      </div>
    );
  }

  const categoryChartData = stats?.categoryDistribution?.map((item: any) => ({
    name: item.vehicle_type,
    value: item.count
  })) || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#18181B] p-6 rounded-2xl border border-[#3F3F46] shadow-xl">
        <div>
          <div className="flex items-center space-x-2.5 mb-1.5">
            <span className="text-xs font-extrabold text-[#FF1744] tracking-tight">
              Welcome, {user?.name || 'User'}
            </span>
            <span className="px-2.5 py-0.5 text-[10px] font-bold bg-[#3F1111] text-[#FF1744] border border-[#7F1D1D] rounded-full">
              Role: {user?.role || 'Guest'}
            </span>
          </div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight">Smart Fleet Operations Center</h1>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40 rounded-full flex items-center">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] mr-1.5 animate-pulse" /> Live Telemetry
            </span>
          </div>
          <p className="text-xs text-[#A1A1AA] mt-1">
            Real-time multi-category vehicle governance, RTO compliance monitoring, FASTag toll tracking & automated condition engine.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => { runComplianceScan(); loadStats(); }}
            disabled={isScanning}
            className="px-3.5 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs font-semibold border border-[#52525B] shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#FF1744] ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Evaluating...' : 'Scan Conditions'}</span>
          </button>

          {/* Primary + Register Vehicle Action */}
          <button
            onClick={() => onOpenQuickAdd('vehicle')}
            className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/25 transition flex items-center space-x-1.5 cursor-pointer border border-[#FF1744]/30"
          >
            <Plus className="w-4 h-4" />
            <span>+ Register Vehicle</span>
          </button>
        </div>
      </div>

      {/* Empty Database Getting Started Banner */}
      {(!stats?.totalVehicles || stats.totalVehicles === 0) && (!stats?.totalDrivers || stats.totalDrivers === 0) && (!stats?.totalBookings || stats.totalBookings === 0) && (
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#7F1D1D] shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-[#E53935] rounded-2xl text-[#F5F5F5] shadow-lg shadow-[#E53935]/30 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#F5F5F5]">No data available. Add your first record to get started.</h3>
              <p className="text-xs text-[#A1A1AA] mt-1">
                Database is clean and ready. Start by registering your first vehicle, onboarding drivers, or creating transport bookings manually.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => onOpenQuickAdd('vehicle')}
              className="px-3.5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] text-xs font-bold rounded-xl shadow-md transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Register Vehicle</span>
            </button>
            <button
              onClick={() => onNavigate('/drivers')}
              className="px-3.5 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] text-xs font-bold rounded-xl border border-[#52525B] shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#FF1744]" />
              <span>+ Add Driver</span>
            </button>
            <button
              onClick={() => onNavigate('/bookings')}
              className="px-3.5 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] text-xs font-bold rounded-xl border border-[#52525B] shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>+ Create Booking</span>
            </button>
          </div>
        </div>
      )}

      {/* Critical Expiry Radar / Alert Priority Banner */}
      {stats?.criticalAlerts && stats.criticalAlerts.length > 0 && (
        <div className="bg-[#3F1111] border border-[#B71C1C] rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <AlertOctagon className="w-5 h-5 text-[#FF1744] animate-pulse" />
              <h3 className="text-sm font-bold text-[#FF6B6B] tracking-wide">Critical Attention Required (Condition Triggered)</h3>
            </div>
            <button
              onClick={() => onNavigate('/notifications')}
              className="text-xs text-[#FF1744] hover:text-[#FF6B6B] font-semibold flex items-center cursor-pointer"
            >
              View All Notifications <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.criticalAlerts.slice(0, 4).map((alert: any) => (
              <div
                key={alert.id}
                onClick={() => alert.action_url && onNavigate(alert.action_url)}
                className="p-3 rounded-xl bg-[#18181B] border border-[#7F1D1D] shadow-md hover:border-[#E53935] transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded ${
                      alert.severity === 'EXPIRED' ? 'bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]' : 'bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]'
                    }`}>
                      {alert.severity}
                    </span>
                    <span className="text-[10px] text-[#71717A] font-medium">{alert.type}</span>
                  </div>
                  <h4 className="text-xs font-bold text-[#F5F5F5] line-clamp-1">{alert.title}</h4>
                  <p className="text-[11px] text-[#A1A1AA] line-clamp-2 mt-1">{alert.message}</p>
                </div>
                <div className="mt-2 text-right">
                  <span className="text-[10px] text-[#FF1744] font-semibold inline-flex items-center">
                    Resolve <ArrowRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Primary 8-Metric KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Fleet */}
        <div
          onClick={() => onNavigate('/vehicles')}
          className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] hover:border-[#E53935] hover:bg-[#202024] hover:shadow-xl transition cursor-pointer shadow-lg group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#A1A1AA]">Total Fleet</span>
            <div className="p-2 rounded-xl bg-[#3F1111] text-[#FF1744] border border-[#7F1D1D] group-hover:scale-110 transition">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#F5F5F5]">{stats?.totalVehicles || 0}</div>
          <div className="mt-2 flex items-center space-x-2 text-xs">
            <span className="text-[#22C55E] font-semibold">{stats?.availableVehicles || 0} Available</span>
            <span className="text-[#3F3F46]">|</span>
            <span className="text-[#60A5FA] font-semibold">{stats?.onTripVehicles || 0} on Trip</span>
          </div>
        </div>

        {/* Active Drivers */}
        <div
          onClick={() => onNavigate('/drivers')}
          className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] hover:border-[#22C55E] hover:bg-[#202024] hover:shadow-xl transition cursor-pointer shadow-lg group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#A1A1AA]">Active Drivers</span>
            <div className="p-2 rounded-xl bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40 group-hover:scale-110 transition">
              <Shield className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#F5F5F5]">{stats?.activeDrivers || 0}</div>
          <div className="mt-2 text-xs text-[#A1A1AA]">
            <span>{stats?.totalDrivers || 0} Total Drivers Registered</span>
          </div>
        </div>

        {/* Active Trips */}
        <div
          onClick={() => onNavigate('/bookings')}
          className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] hover:border-[#60A5FA] hover:bg-[#202024] hover:shadow-xl transition cursor-pointer shadow-lg group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#A1A1AA]">Active Trips</span>
            <div className="p-2 rounded-xl bg-[#111113] text-[#60A5FA] border border-[#3F3F46] group-hover:scale-110 transition">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#F5F5F5]">{stats?.activeTrips || 0}</div>
          <div className="mt-2 text-xs text-[#A1A1AA]">
            <span>{stats?.upcomingBookings || 0} Upcoming Dispatches</span>
          </div>
        </div>

        {/* Bookings */}
        <div
          onClick={() => onNavigate('/bookings')}
          className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] hover:border-[#E53935] hover:bg-[#202024] hover:shadow-xl transition cursor-pointer shadow-lg group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#A1A1AA]">Bookings</span>
            <div className="p-2 rounded-xl bg-[#3F1111] text-[#E53935] border border-[#7F1D1D] group-hover:scale-110 transition">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#F5F5F5]">{stats?.totalBookings ?? stats?.bookingsCount ?? 0}</div>
          <div className="mt-2 text-xs text-[#FF1744] font-semibold">
            <span>Revenue: ₹{(stats?.bookingRevenue || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Fuel Expenses */}
        <div
          onClick={() => onNavigate('/fuel')}
          className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] hover:border-[#F59E0B] hover:bg-[#202024] hover:shadow-xl transition cursor-pointer shadow-lg group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#A1A1AA]">Fuel Expenses</span>
            <div className="p-2 rounded-xl bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/50 group-hover:scale-110 transition">
              <Fuel className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#F59E0B]">
            ₹{(stats?.fuelExpenses || 0).toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-[#A1A1AA]">
            <span>Current Month Fuel Total</span>
          </div>
        </div>

        {/* Maintenance */}
        <div
          onClick={() => onNavigate('/maintenance')}
          className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] hover:border-[#22C55E] hover:bg-[#202024] hover:shadow-xl transition cursor-pointer shadow-lg group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#A1A1AA]">Maintenance</span>
            <div className="p-2 rounded-xl bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40 group-hover:scale-110 transition">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#22C55E]">
            ₹{(stats?.maintenanceExpenses || 0).toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-[#A1A1AA]">
            <span>Current Month Invoices</span>
          </div>
        </div>

        {/* Pending Payments */}
        <div
          onClick={() => onNavigate('/bookings')}
          className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] hover:border-[#FF1744] hover:bg-[#202024] hover:shadow-xl transition cursor-pointer shadow-lg group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#A1A1AA]">Pending Payments</span>
            <div className="p-2 rounded-xl bg-[#3F1111] text-[#FF1744] border border-[#7F1D1D] group-hover:scale-110 transition">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#FF1744]">
            ₹{(stats?.pendingPayments || 0).toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-[#A1A1AA]">
            <span>Outstanding Collections</span>
          </div>
        </div>

        {/* FASTag Balance */}
        <div
          onClick={() => onNavigate('/fastag')}
          className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] hover:border-[#60A5FA] hover:bg-[#202024] hover:shadow-xl transition cursor-pointer shadow-lg group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#A1A1AA]">FASTag Balance</span>
            <div className="p-2 rounded-xl bg-[#111113] text-[#60A5FA] border border-[#3F3F46] group-hover:scale-110 transition">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#60A5FA]">
            ₹{(stats?.fastagBalance || 0).toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-[#A1A1AA]">
            <span>{stats?.fastagIssues || 0} Wallets need attention</span>
          </div>
        </div>
      </div>

      {/* Vehicle Category Matrix Quick Selector */}
      <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-[#E53935]" />
            <h3 className="text-sm font-bold text-[#F5F5F5]">Fleet Composition by Vehicle Types</h3>
          </div>
          <span className="text-xs text-[#71717A] font-mono">14 Supported Categories</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Cars & Taxis', count: stats?.carsCount || 0, icon: '🚗', type: 'Car' },
            { label: 'Passenger Coaches', count: stats?.busesCount || 0, icon: '🚌', type: 'Bus' },
            { label: 'Freight Trucks', count: stats?.trucksCount || 0, icon: '🚚', type: 'Heavy Commercial' },
            { label: 'LCVs & Vans', count: stats?.lcvCount || 0, icon: '🚐', type: 'Light Commercial' },
            { label: 'School Buses', count: stats?.schoolBusCount || 0, icon: '🚸', type: 'School Bus' },
            { label: 'Special Fleets', count: stats?.touristCount || 0, icon: '⚡', type: 'Tourist Vehicle' },
          ].map((cat, idx) => (
            <button
              key={idx}
              onClick={() => onNavigate(`/vehicles?type=${encodeURIComponent(cat.type)}`)}
              className="p-3.5 rounded-xl bg-[#111113] hover:bg-[#3F1818] border border-[#3F3F46] hover:border-[#7F1D1D] transition text-left group cursor-pointer"
            >
              <div className="text-xl mb-1">{cat.icon}</div>
              <p className="text-xs font-semibold text-[#F5F5F5] group-hover:text-[#FF1744] transition">{cat.label}</p>
              <p className="text-sm font-extrabold text-[#E53935] mt-1">{cat.count} Units</p>
            </button>
          ))}
        </div>
      </div>

      {/* Registered Fleet Overview & Profile Showcase */}
      {vehicles.length > 0 && (
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Truck className="w-5 h-5 text-[#E53935]" />
              <div>
                <h3 className="text-sm font-bold text-[#F5F5F5]">Registered Fleet & Bus Profiles</h3>
                <p className="text-xs text-[#A1A1AA]">Real profile photos, vehicle types and live operational status</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('/vehicles')}
              className="text-xs text-[#FF1744] hover:text-[#FF6B6B] font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>View All ({vehicles.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {vehicles.slice(0, 4).map((v) => {
              const fullImg = resolveVehicleImageUrl(v.profile_image_url || v.photo_url);
              return (
                <div
                  key={v.id}
                  onClick={() => onNavigate(`/vehicles/${v.id}`)}
                  className="rounded-2xl border border-[#3F3F46] bg-[#111113] hover:border-[#E53935] hover:bg-[#202024] hover:shadow-xl transition overflow-hidden cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    {/* Profile Image Banner */}
                    <div className="relative h-36 w-full overflow-hidden bg-[#09090B] flex items-center justify-center">
                      {fullImg ? (
                        <img
                          src={fullImg}
                          alt={v.vehicle_number}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                            const parent = (e.target as HTMLElement).parentElement;
                            if (parent) {
                              const fallback = parent.querySelector('.dash-img-fallback');
                              if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                            }
                          }}
                        />
                      ) : null}
                      <div className={`dash-img-fallback flex flex-col items-center justify-center text-[#71717A] ${fullImg ? 'hidden' : ''}`}>
                        <Truck className="w-10 h-10 text-[#71717A] mb-1" />
                        <span className="text-[9px] font-extrabold text-[#71717A] tracking-wider">NO VEHICLE IMAGE</span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#111113] via-transparent to-transparent pointer-events-none" />

                      <div className="absolute top-2.5 left-2.5">
                        <span className="px-2 py-0.5 text-[10px] font-extrabold bg-[#09090B]/90 text-[#F5F5F5] rounded-md border border-[#3F3F46] font-mono shadow">
                          {v.vehicle_number}
                        </span>
                      </div>

                      <div className="absolute top-2.5 right-2.5">
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md ${
                          v.status === 'Available' ? 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]' :
                          v.status === 'On Trip' ? 'bg-[#18181B] text-[#60A5FA] border border-[#60A5FA]' :
                          'bg-[#27272A] text-[#A1A1AA] border border-[#52525B]'
                        }`}>
                          {v.status}
                        </span>
                      </div>

                      <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-xs text-[#F5F5F5]">
                        <span className="font-bold text-xs drop-shadow truncate">{v.make} {v.model}</span>
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#B71C1C] rounded text-[#F5F5F5]">
                          {v.vehicle_type}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 space-y-1.5 text-xs text-[#A1A1AA]">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#71717A]">Driver:</span>
                        <span className="font-semibold text-[#F5F5F5] truncate max-w-[120px]">{v.driver_name || 'Unassigned'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#71717A]">Fuel:</span>
                        <span className="font-medium text-[#D4D4D8]">{v.fuel_type || 'Diesel'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Driver Location Watch Section */}
      <DriverLocationWatch onNavigate={onNavigate} />

      {/* Charts Section: Monthly Trend & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Expense Trend */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#F5F5F5]">Monthly Fleet Operating Expenses (₹)</h3>
              <p className="text-xs text-[#A1A1AA]">Fuel, Maintenance, Toll, Insurance & Taxes breakdown</p>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold bg-[#3F1111] text-[#FF1744] border border-[#7F1D1D] rounded-lg">Last 6 Months</span>
          </div>

          <div className="h-64 w-full">
            {stats?.monthlyTrend && stats.monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.monthlyTrend}>
                  <defs>
                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E53935" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#E53935" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="#71717A" fontSize={11} />
                  <YAxis stroke="#71717A" fontSize={11} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181B', borderColor: '#7F1D1D', borderRadius: '12px', fontSize: '12px', color: '#F5F5F5' }}
                    formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Total Spent']}
                  />
                  <Area type="monotone" dataKey="total_amount" stroke="#E53935" strokeWidth={2.5} fillOpacity={1} fill="url(#expenseGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[#71717A] text-xs">
                No monthly expenditure recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Fleet Distribution Donut */}
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#F5F5F5]">Category Distribution</h3>
            <p className="text-xs text-[#A1A1AA] mb-4">Fleet breakdown by vehicle type</p>
          </div>

          <div className="h-52 w-full">
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryChartData.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181B', borderColor: '#7F1D1D', borderRadius: '12px', fontSize: '12px', color: '#F5F5F5' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[#71717A] text-xs">
                No vehicles registered yet.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-[#A1A1AA] mt-2">
            {categoryChartData.slice(0, 4).map((c: any, i: number) => (
              <div key={i} className="flex items-center space-x-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="truncate text-[#F5F5F5]">{c.name}: {c.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Audit Activity & Quick Launchpad Hubs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Audit Actions */}
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#F5F5F5]">Recent Fleet Activity Log</h3>
            <button onClick={() => onNavigate('/audit-logs')} className="text-xs text-[#FF1744] hover:text-[#FF6B6B] font-semibold cursor-pointer">View Trail</button>
          </div>

          <div className="space-y-3">
            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              stats.recentActivity.map((act: any) => (
                <div key={act.id} className="p-3 rounded-xl bg-[#111113] border border-[#3F3F46] flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-[#F5F5F5]">{act.user_name}</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-[#3F1111] text-[#FF1744] rounded border border-[#7F1D1D]">{act.action}</span>
                    </div>
                    <p className="text-[#A1A1AA] text-[11px] mt-0.5">Entity: {act.entity} {act.entity_id ? `(${act.entity_id})` : ''}</p>
                  </div>
                  <span className="text-[10px] text-[#71717A] font-mono">{new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-[#71717A] text-xs">
                Activity log is clear.
              </div>
            )}
          </div>
        </div>

        {/* Quick Launchpad Hubs */}
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <h3 className="text-sm font-bold text-[#F5F5F5] mb-4">Quick Transport Hubs</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onNavigate('/compliance')}
              className="p-3.5 rounded-xl bg-[#111113] hover:bg-[#3F1818] border border-[#3F3F46] hover:border-[#7F1D1D] transition text-left flex items-center space-x-3 cursor-pointer"
            >
              <FileCheck className="w-5 h-5 text-[#E53935]" />
              <div>
                <p className="text-xs font-bold text-[#F5F5F5]">RTO Compliance</p>
                <p className="text-[10px] text-[#A1A1AA]">RC, Tax & Permits</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate('/bookings')}
              className="p-3.5 rounded-xl bg-[#111113] hover:bg-[#3F1818] border border-[#3F3F46] hover:border-[#7F1D1D] transition text-left flex items-center space-x-3 cursor-pointer"
            >
              <Calendar className="w-5 h-5 text-[#60A5FA]" />
              <div>
                <p className="text-xs font-bold text-[#F5F5F5]">Bookings & Trips</p>
                <p className="text-[10px] text-[#A1A1AA]">Calendar & Dispatch</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate('/fastag')}
              className="p-3.5 rounded-xl bg-[#111113] hover:bg-[#3F1818] border border-[#3F3F46] hover:border-[#7F1D1D] transition text-left flex items-center space-x-3 cursor-pointer"
            >
              <CreditCard className="w-5 h-5 text-[#F59E0B]" />
              <div>
                <p className="text-xs font-bold text-[#F5F5F5]">FASTag Center</p>
                <p className="text-[10px] text-[#A1A1AA]">Wallet & Toll Logs</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate('/reports')}
              className="p-3.5 rounded-xl bg-[#111113] hover:bg-[#3F1818] border border-[#3F3F46] hover:border-[#7F1D1D] transition text-left flex items-center space-x-3 cursor-pointer"
            >
              <TrendingUp className="w-5 h-5 text-[#22C55E]" />
              <div>
                <p className="text-xs font-bold text-[#F5F5F5]">Analytics & Reports</p>
                <p className="text-[10px] text-[#A1A1AA]">Export All 12 Domains</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
