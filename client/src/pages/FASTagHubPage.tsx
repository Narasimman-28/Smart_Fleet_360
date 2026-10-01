import React, { useState, useEffect } from 'react';
import { CreditCard, RefreshCw, History, Trash2 } from 'lucide-react';
import type { FASTagRecord, FASTagTransaction } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { QuickFASTagRechargeModal } from '../components/AddRecordModals';

interface FASTagHubPageProps {
  onNavigate?: (path: string) => void;
}

export const FASTagHubPage: React.FC<FASTagHubPageProps> = ({ onNavigate }) => {
  const { showSuccess, showError } = useToast();
  const [fastags, setFastags] = useState<FASTagRecord[]>([]);
  const [transactions, setTransactions] = useState<FASTagTransaction[]>([]);
  const [selectedTag, setSelectedTag] = useState<FASTagRecord | null>(null);
  const [isRechargeOpen, setIsRechargeOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Delete state
  const [deletingFastag, setDeletingFastag] = useState<FASTagRecord | null>(null);
  const [deletingTxn, setDeletingTxn] = useState<FASTagTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tags, txns] = await Promise.all([
        api.getFASTags(),
        api.getFASTagTransactions()
      ]);
      setFastags(tags || []);
      setTransactions(txns || []);
    } catch (err) {
      console.error('Failed to load FASTag data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteFastag = async () => {
    if (!deletingFastag) return;
    setIsDeleting(true);
    try {
      await api.deleteFastag(deletingFastag.id);
      showSuccess('Record deleted successfully.');
      setDeletingFastag(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete FASTag account:', err);
      showError('Unable to delete this record. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteTxn = async () => {
    if (!deletingTxn) return;
    setIsDeleting(true);
    try {
      await api.deleteFastagTransaction(deletingTxn.id);
      showSuccess('Record deleted successfully.');
      setDeletingTxn(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete FASTag transaction:', err);
      showError('Unable to delete this record. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalBalance = fastags.reduce((acc, curr) => acc + curr.wallet_balance, 0);
  const lowBalanceCount = fastags.filter(f => f.wallet_balance < f.minimum_balance).length;
  const blockedCount = fastags.filter(f => f.status === 'Blocked').length;

  const handleRechargeClick = (tag: FASTagRecord) => {
    setSelectedTag(tag);
    setIsRechargeOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight">FASTag & Toll Operations</h1>
          <p className="text-xs text-[#A1A1AA] mt-0.5">Fleet-wide electronic toll collection, wallet balance alerts, and toll plaza tracking</p>
        </div>

        <button
          onClick={loadData}
          className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs font-semibold border border-[#52525B] transition flex items-center space-x-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#FF1744]" />
          <span>Refresh Balances</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <span className="text-xs font-semibold text-[#A1A1AA]">Total Fleet Balance</span>
          <div className="text-2xl font-extrabold text-[#22C55E] font-mono mt-1">₹{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <span className="text-[11px] text-[#71717A] mt-1 block">Across {fastags.length} registered vehicles</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <span className="text-xs font-semibold text-[#A1A1AA]">Low Balance Warnings</span>
          <div className="text-2xl font-extrabold text-[#F59E0B] font-mono mt-1">{lowBalanceCount} Tags</div>
          <span className="text-[11px] text-[#71717A] mt-1 block">Below configured minimum limit</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <span className="text-xs font-semibold text-[#A1A1AA]">Blocked / Inactive</span>
          <div className="text-2xl font-extrabold text-[#FF1744] font-mono mt-1">{blockedCount} Tags</div>
          <span className="text-[11px] text-[#71717A] mt-1 block">Transit barred by bank issuer</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <span className="text-xs font-semibold text-[#A1A1AA]">Toll Transactions Logged</span>
          <div className="text-2xl font-extrabold text-[#60A5FA] font-mono mt-1">{transactions.length} Events</div>
          <span className="text-[11px] text-[#71717A] mt-1 block">Real-time ETC toll plaza sync</span>
        </div>
      </div>

      {/* Fleet FASTag Grid */}
      <div>
        <h3 className="text-sm font-bold text-[#F5F5F5] mb-3 flex items-center space-x-2">
          <CreditCard className="w-4 h-4 text-[#E53935]" />
          <span>Registered Fleet Vehicles & Balances</span>
        </h3>

        {isLoading ? (
          <div className="py-20 text-center text-[#A1A1AA]">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#E53935]" />
            <p className="text-sm">Loading FASTag records...</p>
          </div>
        ) : fastags.length === 0 ? (
          <div className="py-16 text-center space-y-4 bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-xl p-8">
            <div className="w-16 h-16 rounded-2xl bg-[#3F1111] border border-[#7F1D1D] text-[#FF1744] flex items-center justify-center mx-auto">
              <CreditCard className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#F5F5F5]">No FASTag accounts connected.</h3>
              <p className="text-xs text-[#A1A1AA] mt-1 max-w-sm mx-auto">
                FASTag provider not connected. Link FASTag tag IDs to your vehicles to monitor real-time toll plaza deductions and balances.
              </p>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('/vehicles')}
              className="px-5 py-2.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/25 transition inline-flex items-center space-x-1.5 cursor-pointer border border-[#FF1744]/30"
            >
              <span>+ Add FASTag</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fastags.map((ft) => {
              const isLow = ft.wallet_balance < ft.minimum_balance;
              const isBlocked = ft.status === 'Blocked';

              return (
                <div
                  key={ft.id}
                  className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl flex flex-col justify-between hover:border-[#7F1D1D] transition"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-extrabold text-sm text-[#F5F5F5] px-2.5 py-1 bg-[#111113] rounded-lg border border-[#3F3F46]">
                        {ft.vehicle_number}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isBlocked ? 'bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]' :
                          isLow ? 'bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]' :
                          'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40'
                        }`}>
                          {ft.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDeletingFastag(ft)}
                          className="p-1 text-[#71717A] hover:text-[#FF1744] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                          title="Delete FASTag Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-[#A1A1AA]">{ft.issuer_bank} • {ft.vehicle_type}</p>
                    <p className="text-[11px] text-[#71717A] font-mono mt-0.5">{ft.fastag_id}</p>

                    <div className="my-4 p-3 bg-[#111113] rounded-xl border border-[#3F3F46] flex justify-between items-center">
                      <div>
                        <span className="text-[10px] text-[#71717A] block">Balance</span>
                        <span className={`text-lg font-bold font-mono ${isLow ? 'text-[#F59E0B]' : 'text-[#22C55E]'}`}>
                          ₹{ft.wallet_balance.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[#71717A] block">Min Threshold</span>
                        <span className="text-xs font-semibold text-[#D4D4D8] font-mono">₹{ft.minimum_balance.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#3F3F46]">
                    <span className="text-[10px] text-[#71717A]">
                      Last Rech: {ft.last_recharge_date || 'N/A'}
                    </span>
                    <button
                      onClick={() => handleRechargeClick(ft)}
                      className="px-3 py-1.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-lg text-xs font-bold transition shadow-sm cursor-pointer border border-[#FF1744]/30"
                    >
                      + Recharge
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Toll Plaza Transaction Stream Table */}
      <div className="rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-[#F5F5F5] flex items-center space-x-2">
          <History className="w-4 h-4 text-[#FF1744]" />
          <span>Real-time Toll Plaza Transaction Ledger</span>
        </h3>

        <div className="overflow-x-auto rounded-xl border border-[#3F3F46]">
          <table className="w-full text-left text-xs text-[#F5F5F5]">
            <thead className="bg-[#27272A] text-[#F5F5F5] text-[11px] uppercase tracking-wider border-b border-[#3F3F46]">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Vehicle Number</th>
                <th className="p-3.5">Toll Plaza Name</th>
                <th className="p-3.5">Location / Highway</th>
                <th className="p-3.5">Lane</th>
                <th className="p-3.5">Toll Deducted</th>
                <th className="p-3.5">Balance After</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3F3F46]">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#71717A]">
                    No FASTag transactions recorded yet.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#202024] bg-[#18181B]">
                    <td className="p-3.5 font-mono text-[11px] text-[#A1A1AA]">{tx.transaction_date}</td>
                    <td className="p-3.5 font-bold text-[#F5F5F5] font-mono">{tx.vehicle_number}</td>
                    <td className="p-3.5 font-semibold text-[#D4D4D8]">{tx.toll_plaza_name}</td>
                    <td className="p-3.5 text-[#A1A1AA]">{tx.location || 'Highway'}</td>
                    <td className="p-3.5 text-[#A1A1AA] font-mono text-[11px]">{tx.lane_number}</td>
                    <td className="p-3.5 font-bold text-[#F59E0B] font-mono text-sm">-₹{tx.amount.toFixed(2)}</td>
                    <td className="p-3.5 font-bold text-[#22C55E] font-mono">₹{tx.balance_after.toFixed(2)}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40">
                        {tx.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setDeletingTxn(tx)}
                        className="p-1.5 text-[#71717A] hover:text-[#FF1744] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                        title="Delete Transaction"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recharge Modal */}
      {selectedTag && (
        <QuickFASTagRechargeModal
          isOpen={isRechargeOpen}
          onClose={() => { setIsRechargeOpen(false); setSelectedTag(null); }}
          onSuccess={loadData}
          vehicleId={selectedTag.vehicle_id}
          vehicleNumber={selectedTag.vehicle_number}
          currentBalance={selectedTag.wallet_balance}
        />
      )}

      {/* Delete FASTag Account Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingFastag}
        title="Delete FASTag Account"
        itemName={deletingFastag ? `${deletingFastag.vehicle_number} (${deletingFastag.fastag_id})` : undefined}
        itemDetails={deletingFastag ? `Bank: ${deletingFastag.issuer_bank} • Balance: ₹${deletingFastag.wallet_balance.toFixed(2)}` : undefined}
        isLoading={isDeleting}
        onConfirm={handleDeleteFastag}
        onCancel={() => setDeletingFastag(null)}
      />

      {/* Delete FASTag Transaction Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingTxn}
        title="Delete FASTag Transaction"
        itemName={deletingTxn ? `${deletingTxn.vehicle_number} - ₹${deletingTxn.amount.toFixed(2)}` : undefined}
        itemDetails={deletingTxn ? `Plaza: ${deletingTxn.toll_plaza_name} • ${deletingTxn.transaction_date}` : undefined}
        isLoading={isDeleting}
        onConfirm={handleDeleteTxn}
        onCancel={() => setDeletingTxn(null)}
      />
    </div>
  );
};

export default FASTagHubPage;
