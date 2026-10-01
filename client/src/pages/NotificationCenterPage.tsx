import React, { useState, useEffect } from 'react';
import { 
  Bell, CheckCircle2, AlertTriangle, AlertOctagon, Info, 
  Trash2, RefreshCw, Filter, ArrowRight, ShieldCheck, Settings, Check
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import type { NotificationItem, NotificationSettings } from '../types';
import { api } from '../services/api';

interface NotificationCenterPageProps {
  onNavigate: (path: string) => void;
}

export const NotificationCenterPage: React.FC<NotificationCenterPageProps> = ({ onNavigate }) => {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    runComplianceScan, 
    isScanning 
  } = useNotifications();

  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState<Partial<NotificationSettings>>({
    urgent_days_threshold: 7,
    warning_days_threshold: 30,
    info_days_threshold: 90,
    insurance_reminder_days: 30,
    puc_reminder_days: 15,
    fitness_reminder_days: 30,
    fastag_min_balance_threshold: 500,
    service_km_threshold: 1000
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (isSettingsOpen) {
      api.getNotificationSettings().then(setSettingsForm).catch(console.error);
    }
  }, [isSettingsOpen]);

  const filteredNotifications = notifications.filter(n => {
    const matchesSeverity = severityFilter === 'ALL' || n.severity === severityFilter;
    const matchesType = typeFilter === 'ALL' || n.type.toLowerCase().includes(typeFilter.toLowerCase());
    return matchesSeverity && matchesType;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'EXPIRED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]"><AlertOctagon className="w-3.5 h-3.5 mr-1" /> EXPIRED</span>;
      case 'URGENT':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold bg-[#3F1111] text-[#FF1744] border border-[#7F1D1D]"><AlertTriangle className="w-3.5 h-3.5 mr-1" /> URGENT</span>;
      case 'WARNING':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/40"><AlertTriangle className="w-3.5 h-3.5 mr-1" /> WARNING</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold bg-[#1e293b] text-[#60A5FA] border border-[#3b82f6]/40"><Info className="w-3.5 h-3.5 mr-1" /> INFO</span>;
    }
  };

  const handleAction = (n: NotificationItem) => {
    markAsRead(n.id);
    if (n.action_url) {
      onNavigate(n.action_url);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.updateNotificationSettings(settingsForm);
      setIsSettingsOpen(false);
      await runComplianceScan();
    } catch (err) {
      console.error('Failed to update settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight flex items-center gap-3">
            <Bell className="w-8 h-8 text-[#E53935]" />
            Automated Notification & Expiry Center
          </h1>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Real-time compliance monitoring radar for RC, Insurance, PUC, Fitness, Permits, FASTag balances & Challans
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => onNavigate('/settings')}
            className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs font-semibold border border-[#3F3F46] transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Settings className="w-4 h-4 text-[#A1A1AA]" />
            <span>Full Settings</span>
          </button>

          <button
            onClick={() => runComplianceScan()}
            disabled={isScanning}
            className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/20 transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Evaluating Engine...' : 'Run Compliance Scan'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <span className="text-xs font-semibold text-[#A1A1AA]">Total Active Alerts</span>
          <div className="text-2xl font-extrabold text-[#F5F5F5] font-mono mt-1">{notifications.length}</div>
          <span className="text-[11px] text-[#71717A] mt-1 block font-mono">{unreadCount} unread notices</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <span className="text-xs font-semibold text-[#A1A1AA]">Expired Documents</span>
          <div className="text-2xl font-extrabold text-[#FF1744] font-mono mt-1">
            {notifications.filter(n => n.severity === 'EXPIRED').length}
          </div>
          <span className="text-[11px] text-[#71717A] mt-1 block">Immediate breach</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <span className="text-xs font-semibold text-[#A1A1AA]">Urgent Renewals</span>
          <div className="text-2xl font-extrabold text-[#F59E0B] font-mono mt-1">
            {notifications.filter(n => n.severity === 'URGENT').length}
          </div>
          <span className="text-[11px] text-[#71717A] mt-1 block">High-priority warning</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl">
          <span className="text-xs font-semibold text-[#A1A1AA]">Warning Notices</span>
          <div className="text-2xl font-extrabold text-[#FBBF24] font-mono mt-1">
            {notifications.filter(n => n.severity === 'WARNING').length}
          </div>
          <span className="text-[11px] text-[#71717A] mt-1 block">Upcoming expiry / threshold</span>
        </div>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="p-4 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 text-xs text-[#A1A1AA]">
            <Filter className="w-4 h-4 text-[#71717A]" />
            <span>Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:outline-none focus:border-[#E53935]"
            >
              <option value="ALL">All Severities</option>
              <option value="EXPIRED">Expired</option>
              <option value="URGENT">Urgent</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5 text-xs text-[#A1A1AA]">
            <span>Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:outline-none focus:border-[#E53935]"
            >
              <option value="ALL">All Types</option>
              <option value="Insurance">Insurance</option>
              <option value="PUC">PUC</option>
              <option value="Fitness">Fitness</option>
              <option value="Permit">Permits</option>
              <option value="FASTag">FASTag</option>
              <option value="Service">Service</option>
              <option value="Challan">Challans</option>
            </select>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsRead()}
            className="text-xs text-[#E53935] hover:text-[#FF1744] font-semibold flex items-center space-x-1 self-start md:self-auto cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Mark all {unreadCount} notices as read</span>
          </button>
        )}
      </div>

      {/* Notifications Stream */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="py-20 text-center text-[#71717A] bg-[#18181B] border border-[#3F3F46] rounded-2xl p-6">
            <ShieldCheck className="w-12 h-12 text-[#22C55E] mx-auto mb-3 opacity-70" />
            <h3 className="text-base font-bold text-[#F5F5F5]">No notifications.</h3>
            <p className="text-xs text-[#A1A1AA] mt-1">
              Notifications will be generated when real application events, compliance expiries, or threshold triggers occur.
            </p>
          </div>
        ) : (
          filteredNotifications.map((n) => (
            <div
              key={n.id}
              className={`p-5 rounded-2xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                n.is_read
                  ? 'bg-[#111113] border-[#3F3F46] text-[#A1A1AA]'
                  : 'bg-[#18181B] border-[#7F1D1D] shadow-xl text-[#F5F5F5]'
              }`}
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {getSeverityBadge(n.severity)}
                  <span className="px-2 py-0.5 rounded bg-[#27272A] text-[#F5F5F5] text-[10px] font-semibold border border-[#3F3F46]">
                    {n.type}
                  </span>
                  {n.vehicle_number && (
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[#111113] text-[#E53935] border border-[#3F3F46]">
                      {n.vehicle_number}
                    </span>
                  )}
                  <span className="text-[11px] text-[#71717A] font-mono">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-[#F5F5F5]">{n.title}</h3>
                <p className="text-xs text-[#A1A1AA] leading-relaxed">{n.message}</p>
              </div>

              <div className="flex items-center space-x-3 self-end md:self-auto shrink-0">
                {n.action_url && (
                  <button
                    onClick={() => handleAction(n)}
                    className="px-3.5 py-1.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                  >
                    <span>Resolve</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => deleteNotification(n.id)}
                  className="p-2 text-[#71717A] hover:text-[#FF1744] rounded-xl hover:bg-[#27272A] transition cursor-pointer"
                  title="Dismiss alert"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Threshold Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-[#F5F5F5] mb-1 flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#E53935]" />
              Configure Alert Engine Thresholds
            </h3>
            <p className="text-xs text-[#A1A1AA] mb-4">
              Automated expiry rules for proactive fleet compliance notifications
            </p>

            <form onSubmit={handleSaveSettings} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#F5F5F5] font-semibold mb-1">Urgent Alert Trigger (Days before expiry)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  required
                  value={settingsForm.urgent_days_threshold || 7}
                  onChange={(e) => setSettingsForm({ ...settingsForm, urgent_days_threshold: parseInt(e.target.value) || 7 })}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
                />
              </div>

              <div>
                <label className="block text-[#F5F5F5] font-semibold mb-1">Warning Notice Trigger (Days before expiry)</label>
                <input
                  type="number"
                  min="7"
                  max="90"
                  required
                  value={settingsForm.warning_days_threshold || 30}
                  onChange={(e) => setSettingsForm({ ...settingsForm, warning_days_threshold: parseInt(e.target.value) || 30 })}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
                />
              </div>

              <div>
                <label className="block text-[#F5F5F5] font-semibold mb-1">FASTag Minimum Balance Threshold (₹)</label>
                <input
                  type="number"
                  min="100"
                  required
                  value={settingsForm.fastag_min_balance_threshold || 500}
                  onChange={(e) => setSettingsForm({ ...settingsForm, fastag_min_balance_threshold: parseFloat(e.target.value) || 500 })}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
                />
              </div>

              <div>
                <label className="block text-[#F5F5F5] font-semibold mb-1">Service Due Odometer Window (KM)</label>
                <input
                  type="number"
                  min="100"
                  required
                  value={settingsForm.service_km_threshold || 1000}
                  onChange={(e) => setSettingsForm({ ...settingsForm, service_km_threshold: parseInt(e.target.value) || 1000 })}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
                />
              </div>

              <div className="pt-3 border-t border-[#3F3F46] flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl font-bold transition flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingSettings ? 'Saving...' : 'Save & Re-evaluate'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
