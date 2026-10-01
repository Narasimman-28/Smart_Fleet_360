import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, RefreshCw, Calendar,
  Edit2, Trash2, Eye, Play, CheckCircle2,
  TrendingUp, Wallet, ShieldAlert, X, Phone, ArrowRight, Truck
} from 'lucide-react';
import type { Booking, BookingsSummary } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import {
  CreateEditBookingModal,
  BookingDetailsModal,
  formatINR,
  format12HourDisplay
} from '../components/BookingModals';
import { resolveVehicleImageUrl } from '../utils/imageUrl';

interface BookingsHubPageProps {
  onNavigate?: (path: string) => void;
}

export const BookingsHubPage: React.FC<BookingsHubPageProps> = () => {
  const { showSuccess, showError } = useToast();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [summary, setSummary] = useState<BookingsSummary>({
    totalRevenue: 0,
    totalAdvance: 0,
    totalRemaining: 0,
    totalTrips: 0,
    confirmedTrips: 0,
    startedTrips: 0,
    completedTrips: 0,
    cancelledTrips: 0,
    todayTrips: 0,
    upcomingTrips: 0,
    activeTrips: 0
  });

  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [viewingBooking, setViewingBooking] = useState<Booking | null>(null);
  const [deletingBooking, setDeletingBooking] = useState<Booking | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [bookingsData, summaryData] = await Promise.all([
        api.getBookings({
          status: statusFilter !== 'All' ? statusFilter : undefined,
          search: debouncedSearch.trim() || undefined
        }),
        api.getBookingsSummary().catch(() => ({
          totalRevenue: 0,
          totalAdvance: 0,
          totalRemaining: 0,
          totalTrips: 0,
          confirmedTrips: 0,
          startedTrips: 0,
          completedTrips: 0,
          cancelledTrips: 0,
          todayTrips: 0,
          upcomingTrips: 0,
          activeTrips: 0
        }))
      ]);

      setBookings(bookingsData || []);
      setSummary(summaryData);
    } catch (err) {
      console.error('Failed to load bookings:', err);
      showError('Unable to load bookings from database.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, debouncedSearch, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle START TRIP
  const handleStartTrip = async (id: string) => {
    try {
      const res = await api.startTrip(id);
      showSuccess(res.message || 'Trip started successfully.');
      loadData();
    } catch (err: any) {
      console.error('Failed to start trip:', err);
      showError(err.message || 'Failed to start trip.');
    }
  };

  // Handle END TRIP
  const handleEndTrip = async (id: string) => {
    try {
      const res = await api.endTrip(id);
      showSuccess(res.message || 'Trip ended and completed.');
      loadData();
    } catch (err: any) {
      console.error('Failed to end trip:', err);
      showError(err.message || 'Failed to end trip.');
    }
  };

  // Handle live status updates (e.g. Cancel)
  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await api.updateBookingStatus(id, newStatus);
      showSuccess(`Trip status updated to "${newStatus}".`);
      loadData();
    } catch (err: any) {
      console.error('Failed to update status:', err);
      showError(err.message || 'Failed to update booking status.');
    }
  };

  // Handle delete
  const handleDeleteBooking = async () => {
    if (!deletingBooking) return;
    setIsDeleting(true);
    try {
      await api.deleteBooking(deletingBooking.id);
      showSuccess(`Booking ${deletingBooking.booking_number} permanently deleted.`);
      setDeletingBooking(null);
      loadData();
    } catch (err: any) {
      console.error('Failed to delete booking:', err);
      showError(err.message || 'Unable to delete booking.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight">
              Vehicle Bookings & Dispatch Trips
            </h1>
            <span className="px-2.5 py-0.5 bg-[#7F1D1D]/30 text-[#FF6B6B] border border-[#7F1D1D] rounded-full text-xs font-mono font-bold">
              {summary.totalTrips} Total
            </span>
          </div>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Database-driven manual trip dispatch with 12-hour AM/PM format, driver assignment & real-time trip lifecycle
          </p>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={loadData}
            className="p-2.5 bg-[#18181B] hover:bg-[#202024] text-[#A1A1AA] hover:text-[#F5F5F5] border border-[#3F3F46] rounded-xl transition cursor-pointer"
            title="Refresh Bookings"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#E53935]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingBooking(null);
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/20 transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Trip Booking</span>
          </button>
        </div>
      </div>

      {/* 2. Top Financial KPI Summary Cards (Real Database Values Only) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">Total Booking Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-[#7F1D1D]/20 border border-[#7F1D1D]/40 text-[#FF1744] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#E53935] font-mono mt-2">
            {formatINR(summary.totalRevenue)}
          </div>
          <div className="text-[11px] text-[#71717A] mt-1 flex items-center space-x-1">
            <span>Across</span>
            <strong className="text-[#F5F5F5] font-mono font-semibold">{summary.totalTrips - summary.cancelledTrips}</strong>
            <span>active & completed trips</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">Advance Collections</span>
            <div className="w-8 h-8 rounded-lg bg-[#0F2A1A] border border-[#22C55E]/30 text-[#22C55E] flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#22C55E] font-mono mt-2">
            {formatINR(summary.totalAdvance)}
          </div>
          <span className="text-[11px] text-[#71717A] mt-1 block">Deposited upfront in ledger</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">Pending Receivables</span>
            <div className="w-8 h-8 rounded-lg bg-[#3A2808] border border-[#F59E0B]/30 text-[#F59E0B] flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#F59E0B] font-mono mt-2">
            {formatINR(summary.totalRemaining)}
          </div>
          <span className="text-[11px] text-[#71717A] mt-1 block">Due upon trip completion</span>
        </div>
      </div>

      {/* 3. Detailed Status Metric Badges Grid (All Database Values) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        <div className="p-3 bg-[#18181B] rounded-xl border border-[#3F3F46] text-center">
          <span className="text-[10px] font-bold text-[#A1A1AA] uppercase block">Total Trips</span>
          <span className="text-base font-extrabold font-mono text-[#F5F5F5] mt-0.5 block">{summary.totalTrips}</span>
        </div>

        <div className="p-3 bg-[#18181B] rounded-xl border border-[#3F3F46] text-center">
          <span className="text-[10px] font-bold text-[#60A5FA] uppercase block">Confirmed</span>
          <span className="text-base font-extrabold font-mono text-[#60A5FA] mt-0.5 block">{summary.confirmedTrips}</span>
        </div>

        <div className="p-3 bg-[#18181B] rounded-xl border border-[#3F3F46] text-center">
          <span className="text-[10px] font-bold text-[#F59E0B] uppercase block">Started</span>
          <span className="text-base font-extrabold font-mono text-[#F59E0B] mt-0.5 block">{summary.startedTrips}</span>
        </div>

        <div className="p-3 bg-[#18181B] rounded-xl border border-[#3F3F46] text-center">
          <span className="text-[10px] font-bold text-[#22C55E] uppercase block">Completed</span>
          <span className="text-base font-extrabold font-mono text-[#22C55E] mt-0.5 block">{summary.completedTrips}</span>
        </div>

        <div className="p-3 bg-[#18181B] rounded-xl border border-[#3F3F46] text-center">
          <span className="text-[10px] font-bold text-[#FF1744] uppercase block">Cancelled</span>
          <span className="text-base font-extrabold font-mono text-[#FF1744] mt-0.5 block">{summary.cancelledTrips}</span>
        </div>

        <div className="p-3 bg-[#18181B] rounded-xl border border-[#3F3F46] text-center">
          <span className="text-[10px] font-bold text-[#A855F7] uppercase block">Today's Trips</span>
          <span className="text-base font-extrabold font-mono text-[#A855F7] mt-0.5 block">{summary.todayTrips}</span>
        </div>

        <div className="p-3 bg-[#18181B] rounded-xl border border-[#3F3F46] text-center">
          <span className="text-[10px] font-bold text-[#818CF8] uppercase block">Upcoming</span>
          <span className="text-base font-extrabold font-mono text-[#818CF8] mt-0.5 block">{summary.upcomingTrips}</span>
        </div>

        <div className="p-3 bg-[#18181B] rounded-xl border border-[#3F3F46] text-center">
          <span className="text-[10px] font-bold text-[#2DD4BF] uppercase block">Active Trips</span>
          <span className="text-base font-extrabold font-mono text-[#2DD4BF] mt-0.5 block">{summary.activeTrips}</span>
        </div>
      </div>

      {/* 4. Filters & Search Controls Bar */}
      <div className="p-4 bg-[#18181B] rounded-2xl border border-[#3F3F46] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        {/* Status Tab Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-bold scrollbar-none">
          {[
            { id: 'All', label: 'All Trips', count: summary.totalTrips },
            { id: 'Confirmed', label: 'Confirmed', count: summary.confirmedTrips },
            { id: 'Started', label: 'Started', count: summary.startedTrips },
            { id: 'Completed', label: 'Completed', count: summary.completedTrips },
            { id: 'Cancelled', label: 'Cancelled', count: summary.cancelledTrips }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl transition shrink-0 cursor-pointer flex items-center space-x-1.5 ${
                statusFilter === tab.id
                  ? 'bg-[#B71C1C] text-[#F5F5F5] shadow-md shadow-[#B71C1C]/30'
                  : 'text-[#A1A1AA] hover:text-[#F5F5F5] bg-[#111113] border border-[#3F3F46] hover:bg-[#202024]'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                statusFilter === tab.id ? 'bg-[#7F1D1D] text-[#F5F5F5]' : 'bg-[#27272A] text-[#A1A1AA]'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by ID, Vehicle, Driver, Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-xs text-[#F5F5F5] placeholder-[#71717A] focus:outline-none focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935] transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#F5F5F5] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 5. Bookings Stream / Data Display */}
      {isLoading ? (
        <div className="py-24 text-center text-[#A1A1AA] bg-[#18181B] border border-[#3F3F46] rounded-2xl">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#E53935]" />
          <p className="text-sm font-semibold text-[#F5F5F5]">Loading trip bookings from database...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="py-20 text-center space-y-4 bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-xl p-8">
          <div className="w-16 h-16 rounded-2xl bg-[#7F1D1D]/20 border border-[#7F1D1D]/40 text-[#FF1744] flex items-center justify-center mx-auto">
            <Calendar className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#F5F5F5]">
              No bookings found.
            </h3>
            <p className="text-xs text-[#A1A1AA] mt-1 max-w-md mx-auto">
              Create a booking to start trip tracking.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingBooking(null);
              setIsCreateModalOpen(true);
            }}
            className="px-5 py-2.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/20 transition inline-flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Trip Booking</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* BOOKING CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {bookings.map((b) => {
              const imgUrl = resolveVehicleImageUrl(
                b.vehicle_photo_url ||
                (b as any).vehicle_image_url ||
                b.profile_image_url
              );

              return (
                <div
                  key={b.id}
                  className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl flex flex-col justify-between space-y-4 hover:border-[#7F1D1D] transition duration-200"
                >
                  {/* Top Bar: Booking ID, Trip Type, Status Badge */}
                  <div className="flex items-center justify-between gap-2 border-b border-[#3F3F46] pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-extrabold text-sm text-[#F5F5F5] bg-[#111113] px-2.5 py-1 rounded-lg border border-[#3F3F46]">
                        {b.booking_number}
                      </span>
                      <span className="px-2 py-0.5 bg-[#111113] text-[#60A5FA] border border-[#3F3F46] rounded-md text-[10px] font-bold">
                        {b.trip_type}
                      </span>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center space-x-1 ${
                      b.booking_status === 'Completed' ? 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40' :
                      b.booking_status === 'Started' ? 'bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/40 animate-pulse' :
                      b.booking_status === 'Confirmed' ? 'bg-[#1e293b] text-[#60A5FA] border border-[#3b82f6]/40' :
                      'bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]'
                    }`}>
                      <span>●</span>
                      <span>{b.booking_status}</span>
                    </span>
                  </div>

                  {/* Customer & Vehicle Info */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46] space-y-1">
                      <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">Customer</span>
                      <div className="font-bold text-[#F5F5F5] truncate">{b.customer_name}</div>
                      <div className="text-[11px] text-[#60A5FA] font-mono font-semibold flex items-center space-x-1">
                        <Phone className="w-3 h-3 text-[#71717A]" />
                        <span>{b.customer_mobile}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46] flex items-center space-x-2.5">
                      <div className="w-10 h-10 rounded-lg bg-[#27272A] border border-[#3F3F46] overflow-hidden shrink-0 flex items-center justify-center">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={b.vehicle_number || ''}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        ) : (
                          <Truck className="w-5 h-5 text-[#71717A]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">Vehicle</span>
                        <div className="font-mono font-extrabold text-[#F5F5F5] truncate">{b.vehicle_number}</div>
                        <div className="text-[11px] text-[#A1A1AA] truncate">{b.vehicle_type}</div>
                      </div>
                    </div>
                  </div>

                  {/* Driver Info */}
                  <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46] flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">Driver</span>
                      <span className="font-bold text-[#F5F5F5]">{b.driver_name || 'Unassigned'}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">Driver Phone</span>
                      <span className="font-mono text-[#D4D4D8] font-semibold">{b.driver_phone || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Route: Pickup -> Drop */}
                  <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46] space-y-1.5 text-xs">
                    <div className="flex items-center space-x-2 font-bold text-[#F5F5F5]">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#22C55E] shrink-0" />
                      <span className="truncate">{b.pickup_location}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#FF1744] shrink-0" />
                      <span className="truncate">{b.drop_location}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] font-mono pt-1 border-t border-[#3F3F46]">
                      <span>Journey: {b.start_date}</span>
                      <span>{format12HourDisplay(b.start_time)} to {format12HourDisplay(b.end_time)}</span>
                    </div>
                  </div>

                  {/* Actual Timeline Execution Data */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#111113] p-2.5 rounded-xl border border-[#3F3F46] font-mono">
                    <div>
                      <span className="text-[10px] font-sans font-bold text-[#71717A] uppercase block">Actual Start:</span>
                      <span className={b.actual_start_time ? 'text-[#F59E0B] font-bold' : 'text-[#71717A] font-sans'}>
                        {b.actual_start_time ? `${b.actual_start_date || ''} ${format12HourDisplay(b.actual_start_time)}` : 'Not started yet'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-sans font-bold text-[#71717A] uppercase block">Actual End:</span>
                      <span className={b.actual_end_time ? 'text-[#22C55E] font-bold' : 'text-[#71717A] font-sans'}>
                        {b.actual_end_time ? `${b.actual_end_date || ''} ${format12HourDisplay(b.actual_end_time)}` : 'Not completed yet'}
                      </span>
                    </div>

                    {b.trip_duration && (
                      <div className="col-span-2 pt-1 border-t border-[#3F3F46] flex justify-between">
                        <span className="font-sans text-[#A1A1AA] font-semibold">Trip Duration:</span>
                        <span className="font-bold text-[#A855F7]">{b.trip_duration}</span>
                      </div>
                    )}
                  </div>

                  {/* Financials: Total, Advance, Pending */}
                  <div className="pt-2 border-t border-[#3F3F46] flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-[#71717A] uppercase block">Total Amount</span>
                      <span className="text-base font-extrabold text-[#F5F5F5] font-mono">
                        {formatINR(b.booking_amount)}
                      </span>
                    </div>

                    <div className="text-center">
                      <span className="text-[10px] font-bold text-[#22C55E] uppercase block">Advance</span>
                      <span className="text-xs font-bold text-[#22C55E] font-mono">
                        {formatINR(b.advance_amount)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-[#F59E0B] uppercase block">Pending Balance</span>
                      <span className="text-xs font-bold text-[#F59E0B] font-mono">
                        {formatINR(b.remaining_amount)}
                      </span>
                    </div>
                  </div>

                  {/* Status Specific Action Buttons */}
                  <div className="pt-2 border-t border-[#3F3F46] flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-1.5">
                      {/* START TRIP button (Only for Confirmed) */}
                      {b.booking_status === 'Confirmed' && (
                        <button
                          type="button"
                          onClick={() => handleStartTrip(b.id)}
                          className="px-3.5 py-1.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-extrabold shadow-md transition flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>START TRIP</span>
                        </button>
                      )}

                      {/* END TRIP button (Only for Started) */}
                      {b.booking_status === 'Started' && (
                        <button
                          type="button"
                          onClick={() => handleEndTrip(b.id)}
                          className="px-3.5 py-1.5 bg-[#22C55E] hover:bg-[#16a34a] text-[#F5F5F5] rounded-xl text-xs font-extrabold shadow-md transition flex items-center space-x-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>END TRIP</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setViewingBooking(b)}
                        className="px-2.5 py-1.5 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs font-semibold transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center space-x-1">
                      {/* EDIT button */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBooking(b);
                          setIsCreateModalOpen(true);
                        }}
                        className="p-1.5 text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#27272A] rounded-xl border border-[#3F3F46] transition cursor-pointer"
                        title="Edit Booking"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* DELETE button */}
                      <button
                        type="button"
                        onClick={() => setDeletingBooking(b)}
                        className="p-1.5 text-[#71717A] hover:text-[#FF1744] hover:bg-[#3F1111] rounded-xl border border-[#3F3F46] transition cursor-pointer"
                        title="Delete Booking"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. CREATE / EDIT BOOKING MODAL */}
      <CreateEditBookingModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingBooking(null);
        }}
        onSuccess={loadData}
        initialBooking={editingBooking}
      />

      {/* 7. BOOKING 360 DETAILS VIEW MODAL */}
      <BookingDetailsModal
        isOpen={Boolean(viewingBooking)}
        onClose={() => setViewingBooking(null)}
        booking={viewingBooking}
        onEdit={(b) => {
          setEditingBooking(b);
          setIsCreateModalOpen(true);
        }}
        onDelete={(b) => setDeletingBooking(b)}
        onStartTrip={handleStartTrip}
        onEndTrip={handleEndTrip}
        onStatusChange={handleStatusUpdate}
      />

      {/* 8. DELETE CONFIRMATION MODAL */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingBooking)}
        title="Delete Booking"
        itemName={deletingBooking?.booking_number}
        itemDetails={
          deletingBooking
            ? `${deletingBooking.customer_name} • ${deletingBooking.vehicle_number} (${deletingBooking.pickup_location} → ${deletingBooking.drop_location})`
            : undefined
        }
        message="Are you sure you want to delete this booking?"
        confirmLabel="Delete Booking"
        isLoading={isDeleting}
        onConfirm={handleDeleteBooking}
        onCancel={() => setDeletingBooking(null)}
      />
    </div>
  );
};

export default BookingsHubPage;
