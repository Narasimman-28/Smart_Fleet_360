import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, Phone, Mail, Building, Search, X, Check, RefreshCw, Users, Trash2 } from 'lucide-react';
import type { Customer } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';

export const CustomersPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    company_name: '',
    gst_number: '',
    address: '',
    city: '',
    state: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await api.getCustomers();
      setCustomers(data || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return;
    setIsDeleting(true);
    try {
      await api.deleteCustomer(deletingCustomer.id);
      showSuccess('Record deleted successfully.');
      setDeletingCustomer(null);
      loadCustomers();
    } catch (err) {
      console.error('Failed to delete customer:', err);
      showError('Unable to delete this record. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createCustomer(formData);
      setIsAddOpen(false);
      setFormData({
        name: '',
        phone: '',
        email: '',
        company_name: '',
        gst_number: '',
        address: '',
        city: '',
        state: '',
        notes: ''
      });
      loadCustomers();
    } catch (err) {
      console.error('Failed to create customer:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company_name && c.company_name.toLowerCase().includes(search.toLowerCase())) ||
    c.phone.includes(search)
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-[#E53935]" />
            Corporate Clients & Customer CRM
          </h1>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            B2B Logistics contracts, GST accounts, booking history & billing records
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/20 transition flex items-center space-x-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Corporate Client</span>
        </button>
      </div>

      {/* Search & Statistics */}
      <div className="p-4 bg-[#18181B] border border-[#3F3F46] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#71717A]" />
          <input
            type="text"
            placeholder="Search by client name, company, mobile or GST..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:outline-none focus:border-[#E53935]"
          />
        </div>

        <div className="text-xs text-[#A1A1AA] font-medium">
          Showing {filteredCustomers.length} of {customers.length} clients
        </div>
      </div>

      {/* Customers Grid */}
      {loading ? (
        <div className="py-20 text-center text-[#A1A1AA]">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#E53935]" />
          <p className="text-sm">Loading client accounts...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="py-20 text-center space-y-4 bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-xl p-8">
          <div className="w-16 h-16 rounded-2xl bg-[#7F1D1D]/20 border border-[#7F1D1D]/40 text-[#FF1744] flex items-center justify-center mx-auto">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#F5F5F5]">No corporate clients registered</h3>
            <p className="text-xs text-[#A1A1AA] mt-1 max-w-sm mx-auto">
              Add client company profiles, billing addresses and GST details for trip dispatches.
            </p>
          </div>
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-5 py-2.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/20 transition inline-flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add First Client</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCustomers.map((c) => (
            <div key={c.id} className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl space-y-3 hover:border-[#7F1D1D] transition">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-[#F5F5F5] text-base">{c.name}</h3>
                  {c.company_name && (
                    <p className="text-xs text-[#E53935] font-semibold flex items-center gap-1 mt-0.5">
                      <Building className="w-3.5 h-3.5" />
                      <span>{c.company_name}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {(c.city || c.state) && (
                    <span className="px-2 py-0.5 rounded bg-[#111113] text-[#A1A1AA] border border-[#3F3F46] text-[10px] font-mono">
                      {[c.city, c.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeletingCustomer(c)}
                    className="p-1 text-[#71717A] hover:text-[#FF1744] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                    title="Delete Customer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46] space-y-1.5 text-xs">
                <div className="flex items-center text-[#D4D4D8] gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                  <span className="font-mono">{c.phone}</span>
                </div>
                {c.email && (
                  <div className="flex items-center text-[#D4D4D8] gap-2">
                    <Mail className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                    <span>{c.email}</span>
                  </div>
                )}
                {c.gst_number && (
                  <div className="flex items-center text-[#A1A1AA] gap-2 font-mono text-[11px]">
                    <span className="text-[#71717A]">GSTIN:</span>
                    <span className="text-[#60A5FA] font-bold">{c.gst_number}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#3F3F46] flex justify-between text-xs text-[#A1A1AA]">
                <span>Bookings: <strong className="text-[#F5F5F5]">{c.total_bookings || 0}</strong></span>
                <span>Revenue: <strong className="text-[#E53935] font-mono">₹{(c.total_spent || 0).toLocaleString()}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Client Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#3F3F46] mb-4">
              <h3 className="font-bold text-[#F5F5F5] text-base">Add Corporate Client</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-[#71717A] hover:text-[#F5F5F5] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#F5F5F5] font-semibold mb-1">Contact Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                  />
                </div>
                <div>
                  <label className="block text-[#F5F5F5] font-semibold mb-1">Company / Enterprise Name</label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#F5F5F5] font-semibold mb-1">Mobile Phone *</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                  />
                </div>
                <div>
                  <label className="block text-[#F5F5F5] font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#F5F5F5] font-semibold mb-1">GSTIN Number</label>
                <input
                  type="text"
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  value={formData.gst_number}
                  onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#F5F5F5] font-semibold mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                  />
                </div>
                <div>
                  <label className="block text-[#F5F5F5] font-semibold mb-1">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#3F3F46] flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl font-bold transition flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Client</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Customer Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingCustomer}
        title="Delete Corporate Client"
        itemName={deletingCustomer?.name}
        itemDetails={deletingCustomer ? `Company: ${deletingCustomer.company_name || 'N/A'} • Phone: ${deletingCustomer.phone}` : undefined}
        isLoading={isDeleting}
        onConfirm={handleDeleteCustomer}
        onCancel={() => setDeletingCustomer(null)}
      />
    </div>
  );
};
