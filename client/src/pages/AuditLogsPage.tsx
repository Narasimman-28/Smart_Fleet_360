import React, { useState, useEffect } from 'react';
import { History, RefreshCw, Filter, Search } from 'lucide-react';
import type { AuditLog } from '../types';
import { api } from '../services/api';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs({
        entity: entityFilter !== 'ALL' ? entityFilter : undefined
      });
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [entityFilter]);

  const filteredLogs = logs.filter(l => 
    l.user_name.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    (l.entity_id && l.entity_id.toLowerCase().includes(search.toLowerCase())) ||
    (l.entityId && l.entityId.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight flex items-center gap-3">
            <History className="w-8 h-8 text-[#E53935]" />
            Security & Compliance Audit Trail
          </h1>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Immutable system activity logging, user action tracking, IP addresses & entity modification history
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs font-semibold border border-[#3F3F46] transition flex items-center space-x-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#E53935]" />
          <span>Refresh Trail</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-[#18181B] border border-[#3F3F46] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#71717A]" />
            <input
              type="text"
              placeholder="Search user, action, entity ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] text-xs focus:outline-none focus:border-[#E53935]"
            />
          </div>

          <div className="flex items-center space-x-1.5 text-xs text-[#A1A1AA]">
            <Filter className="w-4 h-4 text-[#71717A]" />
            <span>Entity:</span>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:outline-none focus:border-[#E53935]"
            >
              <option value="ALL">All Entities</option>
              <option value="Vehicle">Vehicle</option>
              <option value="Driver">Driver</option>
              <option value="Booking">Booking</option>
              <option value="Challan">Challan</option>
              <option value="Insurance">Insurance</option>
              <option value="Expense">Expense</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-[#71717A] font-mono">
          {filteredLogs.length} audit records found
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl bg-[#18181B] border border-[#3F3F46] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 text-center text-[#A1A1AA]">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#E53935]" />
              <p className="text-sm">Loading security audit records...</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-[#F5F5F5]">
              <thead className="bg-[#27272A] text-[#F5F5F5] text-[11px] uppercase tracking-wider border-b border-[#3F3F46]">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">User</th>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Target Entity</th>
                  <th className="p-3.5">Entity ID</th>
                  <th className="p-3.5">IP Address</th>
                  <th className="p-3.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3F3F46] font-mono">
                {filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-[#202024] transition">
                    <td className="p-3.5 text-[#71717A] text-[11px] whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td className="p-3.5 font-bold text-[#F5F5F5] whitespace-nowrap">{l.user_name}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-[#7F1D1D]/30 text-[#FF6B6B] text-[10px] font-bold border border-[#7F1D1D]">
                        {l.action}
                      </span>
                    </td>
                    <td className="p-3.5 text-[#60A5FA]">{l.entity}</td>
                    <td className="p-3.5 text-[#A1A1AA] text-[11px]">{l.entityId || '—'}</td>
                    <td className="p-3.5 text-[#71717A] text-[11px]">{l.ip_address || '127.0.0.1'}</td>
                    <td className="p-3.5 text-[#A1A1AA] max-w-xs truncate text-[11px]">
                      {l.new_values ? l.new_values : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
