import React, { useState, useEffect } from 'react';
import { Settings, Check, RefreshCw, Globe, Truck, ShieldAlert, FileText, RotateCcw, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { useNotifications } from '../context/NotificationContext';
import type { NotificationSettings } from '../types';

export const SettingsPage: React.FC = () => {
  const { runComplianceScan } = useNotifications();
  const [settings, setSettings] = useState<NotificationSettings>({
    id: 'default-settings',
    insurance_reminder_days: 30,
    puc_reminder_days: 15,
    fitness_reminder_days: 30,
    permit_reminder_days: 20,
    road_tax_reminder_days: 10,
    driver_license_reminder_days: 30,
    fastag_min_balance_threshold: 500,
    service_km_threshold: 1000,
    maintenance_days_threshold: 15,
    booking_reminder_hours: 24,
    challan_reminder_days: 7,
    fuel_anomaly_threshold: 20,
    urgent_days_threshold: 7,
    warning_days_threshold: 30,
    info_days_threshold: 90,
    email_alerts_enabled: 1,
    sms_alerts_enabled: 0,
    push_alerts_enabled: 1
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getNotificationSettings();
      if (data) setSettings(data);
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      setStatusMessage({ text: 'Failed to fetch settings from server.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);
    try {
      await api.updateNotificationSettings(settings);
      await runComplianceScan();
      setStatusMessage({
        text: 'Configuration successfully saved! Automated compliance evaluator re-evaluated all fleet conditions.',
        type: 'success'
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setStatusMessage({ text: `Failed to save configuration: ${err.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all notification rules and thresholds to system default values?')) return;
    setResetting(true);
    setStatusMessage(null);
    try {
      await api.resetNotificationSettings();
      await fetchSettings();
      await runComplianceScan();
      setStatusMessage({
        text: 'Settings have been reset to factory defaults and compliance status refreshed.',
        type: 'success'
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.error('Failed to reset settings:', err);
      setStatusMessage({ text: `Failed to reset: ${err.message}`, type: 'error' });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight flex items-center gap-3">
            <Settings className="w-8 h-8 text-[#E53935]" />
            System & Fleet Governance Settings
          </h1>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Configure automated compliance evaluation rules, threshold limits, FASTag triggers & alert dispatch channels.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting || saving || loading}
            className="px-4 py-2.5 bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
            <span>Reset to Defaults</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-xl border text-xs flex items-center space-x-2 animate-fadeIn ${
          statusMessage.type === 'success'
            ? 'bg-[#0F2A1A] border-[#22C55E]/40 text-[#22C55E]'
            : 'bg-[#3F1111] border-[#B71C1C] text-[#FF6B6B]'
        }`}>
          {statusMessage.type === 'success' ? <Check className="w-4 h-4 text-[#22C55E]" /> : <AlertTriangle className="w-4 h-4 text-[#FF1744]" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Document Expiry Rules */}
        <div className="p-6 bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center space-x-2 text-sm font-bold text-[#F5F5F5] border-b border-[#3F3F46] pb-3">
            <FileText className="w-5 h-5 text-[#E53935]" />
            <span>Regulatory & Compliance Renewal Advance Windows (Days)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[#F5F5F5] font-semibold mb-1">
                Insurance Expiry Reminder (Days)
              </label>
              <input
                type="number"
                min="1"
                max="180"
                required
                value={settings.insurance_reminder_days}
                onChange={(e) => setSettings({ ...settings, insurance_reminder_days: parseInt(e.target.value) || 30 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
              />
              <p className="text-[11px] text-[#71717A] mt-1">Alerts prior to policy expiry</p>
            </div>

            <div>
              <label className="block text-[#F5F5F5] font-semibold mb-1">
                PUC Expiry Reminder (Days)
              </label>
              <input
                type="number"
                min="1"
                max="90"
                required
                value={settings.puc_reminder_days}
                onChange={(e) => setSettings({ ...settings, puc_reminder_days: parseInt(e.target.value) || 15 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
              />
              <p className="text-[11px] text-[#71717A] mt-1">Pollution emission check renewal lead time</p>
            </div>

            <div>
              <label className="block text-[#F5F5F5] font-semibold mb-1">
                Fitness Certificate Reminder (Days)
              </label>
              <input
                type="number"
                min="1"
                max="180"
                required
                value={settings.fitness_reminder_days}
                onChange={(e) => setSettings({ ...settings, fitness_reminder_days: parseInt(e.target.value) || 30 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
              />
              <p className="text-[11px] text-[#71717A] mt-1">Commercial fitness certificate window</p>
            </div>

            <div>
              <label className="block text-[#F5F5F5] font-semibold mb-1">
                Permit Expiry Reminder (Days)
              </label>
              <input
                type="number"
                min="1"
                max="180"
                required
                value={settings.permit_reminder_days}
                onChange={(e) => setSettings({ ...settings, permit_reminder_days: parseInt(e.target.value) || 20 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
              />
              <p className="text-[11px] text-[#71717A] mt-1">National/State route permit renewal lead</p>
            </div>

            <div>
              <label className="block text-[#F5F5F5] font-semibold mb-1">
                Road Tax Due Reminder (Days)
              </label>
              <input
                type="number"
                min="1"
                max="90"
                required
                value={settings.road_tax_reminder_days}
                onChange={(e) => setSettings({ ...settings, road_tax_reminder_days: parseInt(e.target.value) || 10 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
              />
              <p className="text-[11px] text-[#71717A] mt-1">Quarterly/Annual tax due date alert</p>
            </div>

            <div>
              <label className="block text-[#F5F5F5] font-semibold mb-1">
                Driver License Expiry Reminder (Days)
              </label>
              <input
                type="number"
                min="1"
                max="180"
                required
                value={settings.driver_license_reminder_days}
                onChange={(e) => setSettings({ ...settings, driver_license_reminder_days: parseInt(e.target.value) || 30 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
              />
              <p className="text-[11px] text-[#71717A] mt-1">Commercial driver badge / license expiry</p>
            </div>
          </div>
        </div>

        {/* 2. Operations, FASTag & Maintenance Triggers */}
        <div className="p-6 bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center space-x-2 text-sm font-bold text-[#F5F5F5] border-b border-[#3F3F46] pb-3">
            <Truck className="w-5 h-5 text-[#60A5FA]" />
            <span>Operations, FASTag, Maintenance & Anomaly Thresholds</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[#F5F5F5] font-semibold mb-1">
                FASTag Minimum Balance Threshold (₹)
              </label>
              <input
                type="number"
                min="50"
                required
                value={settings.fastag_min_balance_threshold}
                onChange={(e) => setSettings({ ...settings, fastag_min_balance_threshold: parseFloat(e.target.value) || 500 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
              />
              <p className="text-[11px] text-[#71717A] mt-1">Generates warning when toll wallet falls below ₹</p>
            </div>

            <div>
              <label className="block text-[#F5F5F5] font-semibold mb-1">
                Service Due Proximity (Odometer KM)
              </label>
              <input
                type="number"
                min="50"
                required
                value={settings.service_km_threshold}
                onChange={(e) => setSettings({ ...settings, service_km_threshold: parseInt(e.target.value) || 1000 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
              />
              <p className="text-[11px] text-[#71717A] mt-1">Triggers service alert within remaining KM</p>
            </div>

            <div>
              <label className="block text-[#F5F5F5] font-semibold mb-1">
                Maintenance Schedule Advance (Days)
              </label>
              <input
                type="number"
                min="1"
                max="90"
                required
                value={settings.maintenance_days_threshold}
                onChange={(e) => setSettings({ ...settings, maintenance_days_threshold: parseInt(e.target.value) || 15 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
              />
              <p className="text-[11px] text-[#71717A] mt-1">Alerts prior to scheduled service date</p>
            </div>

            <div>
              <label className="block text-[#F5F5F5] font-semibold mb-1">
                Booking Dispatch Reminder (Hours)
              </label>
              <input
                type="number"
                min="1"
                max="72"
                required
                value={settings.booking_reminder_hours}
                onChange={(e) => setSettings({ ...settings, booking_reminder_hours: parseInt(e.target.value) || 24 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
              />
              <p className="text-[11px] text-[#71717A] mt-1">Alerts trip planner before trip start time</p>
            </div>

            <div>
              <label className="block text-[#F5F5F5] font-semibold mb-1">
                Challan Payment Due Lead (Days)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                required
                value={settings.challan_reminder_days}
                onChange={(e) => setSettings({ ...settings, challan_reminder_days: parseInt(e.target.value) || 7 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
              />
              <p className="text-[11px] text-[#71717A] mt-1">Warns prior to court escalation or late fee</p>
            </div>

            <div>
              <label className="block text-[#F5F5F5] font-semibold mb-1">
                Fuel Anomaly Drop Threshold (%)
              </label>
              <input
                type="number"
                min="5"
                max="80"
                required
                value={settings.fuel_anomaly_threshold}
                onChange={(e) => setSettings({ ...settings, fuel_anomaly_threshold: parseFloat(e.target.value) || 20 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
              />
              <p className="text-[11px] text-[#71717A] mt-1">Flags sudden drops in mileage (km/L)</p>
            </div>
          </div>
        </div>

        {/* 3. Global Alert Severity Classification */}
        <div className="p-6 bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center space-x-2 text-sm font-bold text-[#F5F5F5] border-b border-[#3F3F46] pb-3">
            <ShieldAlert className="w-5 h-5 text-[#F59E0B]" />
            <span>Alert Severity Windows (Days Remaining)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[#F5F5F5] font-semibold mb-1">
                Urgent Escalation Window (≤ Days)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                required
                value={settings.urgent_days_threshold}
                onChange={(e) => setSettings({ ...settings, urgent_days_threshold: parseInt(e.target.value) || 7 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
              />
              <p className="text-[11px] text-[#71717A] mt-1">URGENT red badge when expiry is within this range</p>
            </div>

            <div>
              <label className="block text-[#F5F5F5] font-semibold mb-1">
                Warning Notice Window (≤ Days)
              </label>
              <input
                type="number"
                min="7"
                max="90"
                required
                value={settings.warning_days_threshold}
                onChange={(e) => setSettings({ ...settings, warning_days_threshold: parseInt(e.target.value) || 30 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
              />
              <p className="text-[11px] text-[#71717A] mt-1">WARNING amber badge for upcoming expiries</p>
            </div>

            <div>
              <label className="block text-[#F5F5F5] font-semibold mb-1">
                Information Window (≤ Days)
              </label>
              <input
                type="number"
                min="30"
                max="180"
                required
                value={settings.info_days_threshold}
                onChange={(e) => setSettings({ ...settings, info_days_threshold: parseInt(e.target.value) || 90 })}
                className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] font-mono focus:outline-none focus:border-[#E53935]"
              />
              <p className="text-[11px] text-[#71717A] mt-1">INFO blue badge for advance awareness</p>
            </div>
          </div>
        </div>

        {/* 4. Dispatch Channels */}
        <div className="p-6 bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center space-x-2 text-sm font-bold text-[#F5F5F5] border-b border-[#3F3F46] pb-3">
            <Globe className="w-5 h-5 text-[#22C55E]" />
            <span>Automated Notification Dispatch Channels</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46] flex items-center justify-between">
              <div>
                <p className="font-bold text-[#F5F5F5]">In-App Live Alerts</p>
                <p className="text-[11px] text-[#A1A1AA]">Desktop & Bell Drawer Badge</p>
              </div>
              <input
                type="checkbox"
                checked={!!settings.push_alerts_enabled}
                onChange={(e) => setSettings({ ...settings, push_alerts_enabled: e.target.checked ? 1 : 0 })}
                className="w-4 h-4 rounded text-[#E53935] focus:ring-[#E53935] accent-[#E53935]"
              />
            </div>

            <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46] flex items-center justify-between">
              <div>
                <p className="font-bold text-[#F5F5F5]">Email Digest Dispatch</p>
                <p className="text-[11px] text-[#A1A1AA]">Automated Daily Compliance Report</p>
              </div>
              <input
                type="checkbox"
                checked={!!settings.email_alerts_enabled}
                onChange={(e) => setSettings({ ...settings, email_alerts_enabled: e.target.checked ? 1 : 0 })}
                className="w-4 h-4 rounded text-[#E53935] focus:ring-[#E53935] accent-[#E53935]"
              />
            </div>

            <div className="p-4 bg-[#111113] rounded-xl border border-[#3F3F46] flex items-center justify-between">
              <div>
                <p className="font-bold text-[#F5F5F5]">SMS Critical Escalation</p>
                <p className="text-[11px] text-[#A1A1AA]">Expired Docs & Immediate Violations</p>
              </div>
              <input
                type="checkbox"
                checked={!!settings.sms_alerts_enabled}
                onChange={(e) => setSettings({ ...settings, sms_alerts_enabled: e.target.checked ? 1 : 0 })}
                className="w-4 h-4 rounded text-[#E53935] focus:ring-[#E53935] accent-[#E53935]"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end space-x-3">
          <button
            type="submit"
            disabled={saving || loading || resetting}
            className="px-6 py-2.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/20 transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>Save Configuration & Re-Evaluate</span>
          </button>
        </div>
      </form>
    </div>
  );
};
