import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, AlertOctagon, CheckCircle2, RefreshCw, ExternalLink, Trash2
} from 'lucide-react';
import { api } from '../services/api';
import { useNotifications } from '../context/NotificationContext';
import { useToast } from '../context/ToastContext';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';

interface ComplianceHubPageProps {
  onNavigate: (path: string) => void;
}

export const ComplianceHubPage: React.FC<ComplianceHubPageProps> = ({ onNavigate }) => {
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<'all' | 'insurance' | 'puc' | 'fitness' | 'permits' | 'tax'>('all');
  const [insuranceList, setInsuranceList] = useState<any[]>([]);
  const [pucList, setPucList] = useState<any[]>([]);
  const [fitnessList, setFitnessList] = useState<any[]>([]);
  const [permitList, setPermitList] = useState<any[]>([]);
  const [roadTaxList, setRoadTaxList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { runComplianceScan, isScanning } = useNotifications();

  // Delete state
  const [deletingItem, setDeletingItem] = useState<{ type: 'insurance' | 'puc' | 'fitness' | 'permit' | 'tax'; id: string; title: string; details?: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ins, puc, fit, perm, tax] = await Promise.all([
        api.getInsurance(),
        api.getPUC(),
        api.getFitness(),
        api.getPermits(),
        api.getRoadTax()
      ]);
      setInsuranceList(ins || []);
      setPucList(puc || []);
      setFitnessList(fit || []);
      setPermitList(perm || []);
      setRoadTaxList(tax || []);
    } catch (err) {
      console.error('Failed to load compliance data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      if (deletingItem.type === 'insurance') await api.deleteInsurance(deletingItem.id);
      else if (deletingItem.type === 'puc') await api.deletePuc(deletingItem.id);
      else if (deletingItem.type === 'fitness') await api.deleteFitness(deletingItem.id);
      else if (deletingItem.type === 'permit') await api.deletePermit(deletingItem.id);
      else if (deletingItem.type === 'tax') await api.deleteRoadTax(deletingItem.id);

      showSuccess('Record deleted successfully.');
      setDeletingItem(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete compliance record:', err);
      showError('Unable to delete this record. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: string, days?: number) => {
    if (status === 'Expired' || (days !== undefined && days < 0)) {
      return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C] flex items-center"><AlertOctagon className="w-3 h-3 mr-1 text-[#FF1744]" /> EXPIRED</span>;
    }
    if (status === 'Urgent Renewal' || (days !== undefined && days <= 7)) {
      return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B] flex items-center"><AlertTriangle className="w-3 h-3 mr-1 text-[#F59E0B]" /> URGENT ({days}d)</span>;
    }
    if (status === 'Expiring Soon' || (days !== undefined && days <= 30)) {
      return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/70 flex items-center"><AlertTriangle className="w-3 h-3 mr-1 text-[#F59E0B]" /> EXPIRING ({days}d)</span>;
    }
    return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40 flex items-center"><CheckCircle2 className="w-3 h-3 mr-1 text-[#22C55E]" /> ACTIVE</span>;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight">RTO & Compliance Matrix</h1>
          <p className="text-xs text-[#A1A1AA] mt-0.5">Centralized tracking of RC, Insurance, PUC, Fitness Certificates, Permits & Road Tax</p>
        </div>

        <button
          onClick={() => { runComplianceScan(); loadData(); }}
          disabled={isScanning}
          className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer border border-[#FF1744]/30"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Scanning...' : 'Re-scan Expiries'}</span>
        </button>
      </div>

      {/* Compliance Overview KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-[#18181B] border border-[#3F3F46] text-xs shadow-lg">
          <span className="text-[#A1A1AA] block">Insurance Policies</span>
          <span className="text-lg font-bold text-[#F5F5F5] mt-1 block">{insuranceList.length} Registered</span>
          <span className="text-[10px] text-[#FF6B6B] font-semibold">{insuranceList.filter(i => i.calculated_status === 'Expired').length} Expired</span>
        </div>

        <div className="p-4 rounded-xl bg-[#18181B] border border-[#3F3F46] text-xs shadow-lg">
          <span className="text-[#A1A1AA] block">PUC Certificates</span>
          <span className="text-lg font-bold text-[#F5F5F5] mt-1 block">{pucList.length} Active</span>
          <span className="text-[10px] text-[#FF6B6B] font-semibold">{pucList.filter(p => p.calculated_status === 'Expired').length} Expired</span>
        </div>

        <div className="p-4 rounded-xl bg-[#18181B] border border-[#3F3F46] text-xs shadow-lg">
          <span className="text-[#A1A1AA] block">Fitness Certificates</span>
          <span className="text-lg font-bold text-[#F5F5F5] mt-1 block">{fitnessList.length} Verified</span>
          <span className="text-[10px] text-[#FF6B6B] font-semibold">{fitnessList.filter(f => f.calculated_status === 'Expired').length} Expired</span>
        </div>

        <div className="p-4 rounded-xl bg-[#18181B] border border-[#3F3F46] text-xs shadow-lg">
          <span className="text-[#A1A1AA] block">Transport Permits</span>
          <span className="text-lg font-bold text-[#F5F5F5] mt-1 block">{permitList.length} Permits</span>
          <span className="text-[10px] text-[#FF6B6B] font-semibold">{permitList.filter(p => p.calculated_status === 'Expired').length} Expired</span>
        </div>

        <div className="p-4 rounded-xl bg-[#18181B] border border-[#3F3F46] text-xs col-span-2 sm:col-span-1 shadow-lg">
          <span className="text-[#A1A1AA] block">Road Tax Schedule</span>
          <span className="text-lg font-bold text-[#F5F5F5] mt-1 block">{roadTaxList.length} Vehicles</span>
          <span className="text-[10px] text-[#F59E0B] font-semibold">{roadTaxList.filter(t => t.calculated_status === 'Due Soon' || t.calculated_status === 'Overdue').length} Due Soon</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-[#3F3F46] pb-2 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-2 rounded-xl transition cursor-pointer border ${activeTab === 'all' ? 'bg-[#B71C1C] text-[#F5F5F5] border-[#FF1744]/40 shadow-md' : 'text-[#A1A1AA] hover:text-[#F5F5F5] bg-[#18181B] border-[#3F3F46]'}`}
        >
          All Compliances
        </button>
        <button
          onClick={() => setActiveTab('insurance')}
          className={`px-3 py-2 rounded-xl transition cursor-pointer border ${activeTab === 'insurance' ? 'bg-[#B71C1C] text-[#F5F5F5] border-[#FF1744]/40 shadow-md' : 'text-[#A1A1AA] hover:text-[#F5F5F5] bg-[#18181B] border-[#3F3F46]'}`}
        >
          Insurance Policies
        </button>
        <button
          onClick={() => setActiveTab('puc')}
          className={`px-3 py-2 rounded-xl transition cursor-pointer border ${activeTab === 'puc' ? 'bg-[#B71C1C] text-[#F5F5F5] border-[#FF1744]/40 shadow-md' : 'text-[#A1A1AA] hover:text-[#F5F5F5] bg-[#18181B] border-[#3F3F46]'}`}
        >
          PUC / Pollution
        </button>
        <button
          onClick={() => setActiveTab('fitness')}
          className={`px-3 py-2 rounded-xl transition cursor-pointer border ${activeTab === 'fitness' ? 'bg-[#B71C1C] text-[#F5F5F5] border-[#FF1744]/40 shadow-md' : 'text-[#A1A1AA] hover:text-[#F5F5F5] bg-[#18181B] border-[#3F3F46]'}`}
        >
          Fitness Certificates
        </button>
        <button
          onClick={() => setActiveTab('permits')}
          className={`px-3 py-2 rounded-xl transition cursor-pointer border ${activeTab === 'permits' ? 'bg-[#B71C1C] text-[#F5F5F5] border-[#FF1744]/40 shadow-md' : 'text-[#A1A1AA] hover:text-[#F5F5F5] bg-[#18181B] border-[#3F3F46]'}`}
        >
          Permits
        </button>
        <button
          onClick={() => setActiveTab('tax')}
          className={`px-3 py-2 rounded-xl transition cursor-pointer border ${activeTab === 'tax' ? 'bg-[#B71C1C] text-[#F5F5F5] border-[#FF1744]/40 shadow-md' : 'text-[#A1A1AA] hover:text-[#F5F5F5] bg-[#18181B] border-[#3F3F46]'}`}
        >
          Road Tax
        </button>
      </div>

      {/* Compliance Table */}
      <div className="rounded-2xl bg-[#18181B] border border-[#3F3F46] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-20 text-center text-[#A1A1AA]">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#E53935]" />
              <p className="text-sm">Loading compliance registry...</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-[#F5F5F5]">
              <thead className="bg-[#27272A] text-[#F5F5F5] text-[11px] font-bold uppercase tracking-wider border-b border-[#3F3F46]">
                <tr>
                  <th className="p-3.5">Vehicle Number</th>
                  <th className="p-3.5">Document / Type</th>
                  <th className="p-3.5">Doc Number</th>
                  <th className="p-3.5">Provider / Authority</th>
                  <th className="p-3.5">Expiry Date</th>
                  <th className="p-3.5">Days Remaining</th>
                  <th className="p-3.5">Compliance Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3F3F46]">
                {/* Insurance Rows */}
                {(activeTab === 'all' || activeTab === 'insurance') && insuranceList.map((ins) => (
                  <tr key={ins.id} className="hover:bg-[#202024] bg-[#18181B]">
                    <td className="p-3.5 font-bold text-[#F5F5F5] font-mono">{ins.vehicle_number}</td>
                    <td className="p-3.5"><span className="px-2 py-0.5 rounded bg-[#111113] text-[#60A5FA] font-semibold border border-[#3F3F46]">Insurance</span></td>
                    <td className="p-3.5 font-mono text-[#D4D4D8]">{ins.policy_number}</td>
                    <td className="p-3.5 text-[#A1A1AA]">{ins.insurance_company}</td>
                    <td className="p-3.5 font-mono">{ins.policy_expiry_date}</td>
                    <td className="p-3.5 font-bold font-mono text-[#D4D4D8]">{ins.days_remaining !== undefined ? `${ins.days_remaining}d` : '-'}</td>
                    <td className="p-3.5">{getStatusBadge(ins.calculated_status, ins.days_remaining)}</td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => onNavigate(`/vehicles/${ins.vehicle_id}?tab=insurance`)} className="text-[#FF1744] hover:text-[#FF6B6B] font-semibold inline-flex items-center text-xs cursor-pointer">
                          Manage <ExternalLink className="w-3.5 h-3.5 ml-1" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingItem({ type: 'insurance', id: ins.id, title: `Insurance - ${ins.vehicle_number}`, details: `Policy: ${ins.policy_number} • ${ins.insurance_company}` })}
                          className="p-1 text-[#71717A] hover:text-[#FF1744] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                          title="Delete Insurance Policy"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* PUC Rows */}
                {(activeTab === 'all' || activeTab === 'puc') && pucList.map((p) => (
                  <tr key={p.id} className="hover:bg-[#202024] bg-[#18181B]">
                    <td className="p-3.5 font-bold text-[#F5F5F5] font-mono">{p.vehicle_number}</td>
                    <td className="p-3.5"><span className="px-2 py-0.5 rounded bg-[#111113] text-[#22C55E] font-semibold border border-[#3F3F46]">PUC Emission</span></td>
                    <td className="p-3.5 font-mono text-[#D4D4D8]">{p.certificate_number}</td>
                    <td className="p-3.5 text-[#A1A1AA]">{p.testing_center}</td>
                    <td className="p-3.5 font-mono">{p.expiry_date}</td>
                    <td className="p-3.5 font-bold font-mono text-[#D4D4D8]">{p.days_remaining !== undefined ? `${p.days_remaining}d` : '-'}</td>
                    <td className="p-3.5">{getStatusBadge(p.calculated_status, p.days_remaining)}</td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => onNavigate(`/vehicles/${p.vehicle_id}?tab=puc`)} className="text-[#FF1744] hover:text-[#FF6B6B] font-semibold inline-flex items-center text-xs cursor-pointer">
                          Manage <ExternalLink className="w-3.5 h-3.5 ml-1" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingItem({ type: 'puc', id: p.id, title: `PUC - ${p.vehicle_number}`, details: `Cert: ${p.certificate_number} • ${p.testing_center}` })}
                          className="p-1 text-[#71717A] hover:text-[#FF1744] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                          title="Delete PUC Certificate"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Fitness Rows */}
                {(activeTab === 'all' || activeTab === 'fitness') && fitnessList.map((f) => (
                  <tr key={f.id} className="hover:bg-[#202024] bg-[#18181B]">
                    <td className="p-3.5 font-bold text-[#F5F5F5] font-mono">{f.vehicle_number}</td>
                    <td className="p-3.5"><span className="px-2 py-0.5 rounded bg-[#111113] text-[#22C55E] font-semibold border border-[#3F3F46]">Fitness Cert</span></td>
                    <td className="p-3.5 font-mono text-[#D4D4D8]">{f.certificate_number}</td>
                    <td className="p-3.5 text-[#A1A1AA]">{f.testing_center}</td>
                    <td className="p-3.5 font-mono">{f.expiry_date}</td>
                    <td className="p-3.5 font-bold font-mono text-[#D4D4D8]">{f.days_remaining !== undefined ? `${f.days_remaining}d` : '-'}</td>
                    <td className="p-3.5">{getStatusBadge(f.calculated_status, f.days_remaining)}</td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => onNavigate(`/vehicles/${f.vehicle_id}?tab=fitness`)} className="text-[#FF1744] hover:text-[#FF6B6B] font-semibold inline-flex items-center text-xs cursor-pointer">
                          Manage <ExternalLink className="w-3.5 h-3.5 ml-1" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingItem({ type: 'fitness', id: f.id, title: `Fitness Cert - ${f.vehicle_number}`, details: `Cert: ${f.certificate_number} • ${f.testing_center}` })}
                          className="p-1 text-[#71717A] hover:text-[#FF1744] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                          title="Delete Fitness Certificate"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Permits Rows */}
                {(activeTab === 'all' || activeTab === 'permits') && permitList.map((pm) => (
                  <tr key={pm.id} className="hover:bg-[#202024] bg-[#18181B]">
                    <td className="p-3.5 font-bold text-[#F5F5F5] font-mono">{pm.vehicle_number}</td>
                    <td className="p-3.5"><span className="px-2 py-0.5 rounded bg-[#111113] text-[#A855F7] font-semibold border border-[#3F3F46]">{pm.permit_type}</span></td>
                    <td className="p-3.5 font-mono text-[#D4D4D8]">{pm.permit_number}</td>
                    <td className="p-3.5 text-[#A1A1AA]">{pm.issuing_authority} ({pm.permit_area})</td>
                    <td className="p-3.5 font-mono">{pm.expiry_date}</td>
                    <td className="p-3.5 font-bold font-mono text-[#D4D4D8]">{pm.days_remaining !== undefined ? `${pm.days_remaining}d` : '-'}</td>
                    <td className="p-3.5">{getStatusBadge(pm.calculated_status, pm.days_remaining)}</td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => onNavigate(`/vehicles/${pm.vehicle_id}?tab=permits`)} className="text-[#FF1744] hover:text-[#FF6B6B] font-semibold inline-flex items-center text-xs cursor-pointer">
                          Manage <ExternalLink className="w-3.5 h-3.5 ml-1" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingItem({ type: 'permit', id: pm.id, title: `Permit - ${pm.vehicle_number}`, details: `Permit: ${pm.permit_number} • ${pm.permit_type}` })}
                          className="p-1 text-[#71717A] hover:text-[#FF1744] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                          title="Delete Permit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Road Tax Rows */}
                {(activeTab === 'all' || activeTab === 'tax') && roadTaxList.map((rt) => (
                  <tr key={rt.id} className="hover:bg-[#202024] bg-[#18181B]">
                    <td className="p-3.5 font-bold text-[#F5F5F5] font-mono">{rt.vehicle_number}</td>
                    <td className="p-3.5"><span className="px-2 py-0.5 rounded bg-[#111113] text-[#F59E0B] font-semibold border border-[#3F3F46]">{rt.tax_type || 'Road Tax'}</span></td>
                    <td className="p-3.5 font-mono text-[#D4D4D8]">{rt.receipt_number || '—'}</td>
                    <td className="p-3.5 text-[#A1A1AA]">{rt.state_authority || 'RTO'} • ₹{Number(rt.tax_amount || 0).toLocaleString()}</td>
                    <td className="p-3.5 font-mono">{rt.tax_valid_until}</td>
                    <td className="p-3.5 font-bold font-mono text-[#D4D4D8]">{rt.days_remaining !== undefined ? `${rt.days_remaining}d` : '-'}</td>
                    <td className="p-3.5">{getStatusBadge(rt.calculated_status, rt.days_remaining)}</td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => onNavigate(`/vehicles/${rt.vehicle_id}?tab=roadTax`)} className="text-[#FF1744] hover:text-[#FF6B6B] font-semibold inline-flex items-center text-xs cursor-pointer">
                          Manage <ExternalLink className="w-3.5 h-3.5 ml-1" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingItem({ type: 'tax', id: rt.id, title: `Road Tax - ${rt.vehicle_number}`, details: `Valid until: ${rt.tax_valid_until} • ₹${rt.tax_amount}` })}
                          className="p-1 text-[#71717A] hover:text-[#FF1744] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                          title="Delete Road Tax"
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

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingItem}
        title={`Delete ${deletingItem?.type === 'insurance' ? 'Insurance Policy' : deletingItem?.type === 'puc' ? 'PUC Certificate' : deletingItem?.type === 'fitness' ? 'Fitness Certificate' : deletingItem?.type === 'permit' ? 'Permit Record' : 'Road Tax Record'}`}
        itemName={deletingItem?.title}
        itemDetails={deletingItem?.details}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeletingItem(null)}
      />
    </div>
  );
};

export default ComplianceHubPage;
