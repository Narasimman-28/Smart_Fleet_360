import React, { useState, useEffect } from 'react';
import { CheckCircle, RefreshCw, X, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import type { Challan } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { AddChallanModal } from '../components/AddRecordModals';

interface ChallansHubPageProps {
  onNavigate?: (path: string) => void;
}

export const ChallansHubPage: React.FC<ChallansHubPageProps> = () => {
  const { showSuccess, showError } = useToast();
  const [challans, setChallans] = useState<Challan[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [payingChallan, setPayingChallan] = useState<Challan | null>(null);
  const [isChallanModalOpen, setIsChallanModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingChallan, setDeletingChallan] = useState<Challan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadChallans = async () => {
    setIsLoading(true);
    try {
      const data = await api.getChallans({
        status: statusFilter !== 'All' ? statusFilter : undefined
      });
      setChallans(data || []);
    } catch (err) {
      console.error('Failed to load challans:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadChallans();
  }, [statusFilter]);

  const handleDeleteChallan = async () => {
    if (!deletingChallan) return;
    setIsDeleting(true);
    try {
      await api.deleteChallan(deletingChallan.id);
      showSuccess('Record deleted successfully.');
      setDeletingChallan(null);
      loadChallans();
    } catch (err) {
      console.error('Failed to delete challan:', err);
      showError('Unable to delete this record. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePayChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingChallan) return;

    setIsSubmitting(true);
    try {
      await api.payChallan(payingChallan.id, {
        payment_mode: 'Online Echallan Portal',
        receipt_number: `ECH-REC-${Date.now()}`
      });
      setPayingChallan(null);
      loadChallans();
    } catch (err) {
      console.error('Failed to pay challan:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingAmount = challans.filter(c => c.payment_status !== 'Paid').reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const overdueCount = challans.filter(c => c.payment_status === 'Overdue' || (c.payment_status === 'Pending' && new Date(c.due_date) < new Date())).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight">Traffic Challans & Violations</h1>
          <p className="text-xs text-[#A1A1AA] mt-0.5">Automated penalty radar, court due date tracking & fine settlements</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadChallans}
            className="px-3.5 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs font-semibold border border-[#52525B] transition flex items-center space-x-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#FF1744]" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setIsChallanModalOpen(true)}
            className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/25 transition flex items-center space-x-1.5 cursor-pointer border border-[#FF1744]/30"
          >
            <Plus className="w-4 h-4" />
            <span>+ Record Challan</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <span className="text-xs font-semibold text-[#A1A1AA]">Total Pending Fines</span>
          <div className="text-2xl font-extrabold text-[#FF1744] font-mono mt-1">₹{pendingAmount.toLocaleString()}</div>
          <span className="text-[11px] text-[#71717A] mt-1 block">Unpaid violations requiring action</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <span className="text-xs font-semibold text-[#A1A1AA]">Overdue Traffic Notices</span>
          <div className="text-2xl font-extrabold text-[#FF6B6B] font-mono mt-1">{overdueCount} Notices</div>
          <span className="text-[11px] text-[#71717A] mt-1 block">Past due date (Subject to court penalty)</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <span className="text-xs font-semibold text-[#A1A1AA]">Resolved & Settled</span>
          <div className="text-2xl font-extrabold text-[#22C55E] font-mono mt-1">{challans.filter(c => c.payment_status === 'Paid').length} Challans</div>
          <span className="text-[11px] text-[#71717A] mt-1 block">Successfully cleared</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-3 bg-[#18181B] rounded-xl border border-[#3F3F46] flex space-x-2 text-xs font-semibold">
        {['All', 'Pending', 'Overdue', 'Paid'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer border ${statusFilter === st ? 'bg-[#B71C1C] text-[#F5F5F5] border-[#FF1744]/40 shadow-sm' : 'text-[#A1A1AA] hover:text-[#F5F5F5] bg-[#111113] border-[#3F3F46]'}`}
          >
            {st} Challans
          </button>
        ))}
      </div>

      {/* Challans Table */}
      <div className="rounded-2xl bg-[#18181B] border border-[#3F3F46] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-20 text-center text-[#A1A1AA]">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#E53935]" />
              <p className="text-sm">Loading challans data...</p>
            </div>
          ) : challans.length === 0 ? (
            <div className="py-16 text-center space-y-3 p-6">
              <AlertTriangle className="w-10 h-10 text-[#22C55E] mx-auto opacity-70" />
              <h4 className="text-sm font-bold text-[#F5F5F5]">No traffic challans found</h4>
              <p className="text-xs text-[#A1A1AA] max-w-sm mx-auto">
                {statusFilter !== 'All'
                  ? `No challans match filter "${statusFilter}".`
                  : 'All fleet vehicles have clean traffic records. Record any new fine notices issued by transport authorities.'}
              </p>
              <button
                onClick={() => setIsChallanModalOpen(true)}
                className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition cursor-pointer border border-[#FF1744]/30"
              >
                + Record Traffic Challan
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-[#F5F5F5]">
              <thead className="bg-[#27272A] text-[#F5F5F5] text-[11px] uppercase tracking-wider border-b border-[#3F3F46]">
                <tr>
                  <th className="p-3.5">Challan Number</th>
                  <th className="p-3.5">Vehicle Number</th>
                  <th className="p-3.5">Offence Details</th>
                  <th className="p-3.5">Location</th>
                  <th className="p-3.5">Date & Time</th>
                  <th className="p-3.5">Fine Amount</th>
                  <th className="p-3.5">Due Date</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3F3F46]">
                {challans.map((c) => (
                  <tr key={c.id} className="hover:bg-[#202024] bg-[#18181B]">
                    <td className="p-3.5 font-bold text-[#F5F5F5] font-mono">{c.challan_number}</td>
                    <td className="p-3.5 font-bold text-[#FF1744] font-mono">{c.vehicle_number}</td>
                    <td className="p-3.5 font-medium text-[#D4D4D8]">{c.offence}</td>
                    <td className="p-3.5 text-[#A1A1AA]">{c.location || '—'}</td>
                    <td className="p-3.5 text-[#A1A1AA] font-mono text-[11px]">{c.date} {c.time || ''}</td>
                    <td className="p-3.5 font-extrabold text-[#FF1744] font-mono text-sm">₹{c.amount.toLocaleString()}</td>
                    <td className="p-3.5 font-mono text-[11px] text-[#A1A1AA]">{c.due_date}</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                        c.payment_status === 'Paid' ? 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40' :
                        c.payment_status === 'Overdue' ? 'bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]' :
                        'bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/40'
                      }`}>
                        {c.payment_status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {c.payment_status !== 'Paid' ? (
                          <button
                            onClick={() => setPayingChallan(c)}
                            className="px-3 py-1 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-lg font-bold text-xs shadow-sm transition cursor-pointer border border-[#FF1744]/30"
                          >
                            Pay Fine
                          </button>
                        ) : (
                          <span className="text-[#22C55E] font-semibold text-xs flex items-center">
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Cleared
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeletingChallan(c)}
                          className="p-1 text-[#71717A] hover:text-[#FF1744] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                          title="Delete Challan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pay Challan Modal */}
      {payingChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090B]/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#3F3F46] flex items-center justify-between bg-[#111113]">
              <h3 className="font-bold text-[#F5F5F5] text-base">Settle Traffic Challan</h3>
              <button onClick={() => setPayingChallan(null)} className="text-[#71717A] hover:text-[#F5F5F5] cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handlePayChallan} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-[#111113] rounded-xl border border-[#3F3F46] space-y-1">
                <p className="text-[#A1A1AA]">Challan: <strong className="text-[#F5F5F5] font-mono">{payingChallan.challan_number}</strong></p>
                <p className="text-[#A1A1AA]">Vehicle: <strong className="text-[#FF1744] font-mono">{payingChallan.vehicle_number}</strong></p>
                <p className="text-[#A1A1AA]">Offence: <strong className="text-[#D4D4D8]">{payingChallan.offence}</strong></p>
                <p className="text-[#A1A1AA]">Penalty Fine: <strong className="text-[#FF1744] text-sm font-mono">₹{payingChallan.amount.toLocaleString()}</strong></p>
              </div>

              <div>
                <label className="block text-[#F5F5F5] font-semibold mb-1">Payment Method</label>
                <select className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] focus:border-[#E53935] focus:outline-none">
                  <option>Parivahan Echallan Gateway (NetBanking)</option>
                  <option>Corporate UPI</option>
                  <option>Fleet Credit Card</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button type="button" onClick={() => setPayingChallan(null)} className="px-4 py-2 bg-[#27272A] text-[#A1A1AA] hover:text-[#F5F5F5] rounded-xl cursor-pointer border border-[#52525B]">Cancel</button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl font-bold shadow-md transition cursor-pointer border border-[#FF1744]/30"
                >
                  {isSubmitting ? 'Settling...' : `Confirm Payment ₹${payingChallan.amount.toLocaleString()}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Challan Modal */}
      <AddChallanModal
        isOpen={isChallanModalOpen}
        onClose={() => setIsChallanModalOpen(false)}
        onSuccess={loadChallans}
      />

      {/* Delete Challan Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingChallan}
        title="Delete Traffic Challan"
        itemName={deletingChallan ? `${deletingChallan.challan_number} - ${deletingChallan.vehicle_number}` : undefined}
        itemDetails={deletingChallan ? `Offence: ${deletingChallan.offence} • Fine: ₹${deletingChallan.amount}` : undefined}
        isLoading={isDeleting}
        onConfirm={handleDeleteChallan}
        onCancel={() => setDeletingChallan(null)}
      />
    </div>
  );
};

export default ChallansHubPage;
