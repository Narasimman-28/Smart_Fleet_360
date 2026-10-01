import React from 'react';
import { X, Bell, CheckCircle2, AlertTriangle, AlertOctagon, Info, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import type { NotificationItem } from '../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose, onNavigate }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, runComplianceScan, isScanning } = useNotifications();

  if (!isOpen) return null;

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'EXPIRED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]"><AlertOctagon className="w-3 h-3 mr-1 text-[#FF1744]" /> EXPIRED</span>;
      case 'URGENT':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]"><AlertTriangle className="w-3 h-3 mr-1 text-[#F59E0B]" /> URGENT</span>;
      case 'WARNING':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/70"><AlertTriangle className="w-3 h-3 mr-1 text-[#F59E0B]" /> WARNING</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#18181B] text-[#60A5FA] border border-[#3F3F46]"><Info className="w-3 h-3 mr-1 text-[#60A5FA]" /> INFO</span>;
    }
  };

  const handleAction = (n: NotificationItem) => {
    markAsRead(n.id);
    if (n.action_url) {
      onClose();
      onNavigate(n.action_url);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#09090B]/80 backdrop-blur-sm animate-fadeIn">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#111113] border-l border-[#3F3F46] shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-[#3F3F46] flex items-center justify-between bg-[#111113]">
            <div className="flex items-center space-x-2">
              <Bell className="w-5 h-5 text-[#FF1744]" />
              <h2 className="font-bold text-[#F5F5F5] text-base">Alerts & Notifications</h2>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold bg-[#FF1744] text-[#F5F5F5] rounded-full animate-soft-pulse shadow-sm">
                  {unreadCount} new
                </span>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 text-[#71717A] hover:text-[#F5F5F5] rounded-lg hover:bg-[#18181B] transition cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Bar */}
          <div className="px-4 py-2.5 bg-[#18181B] border-b border-[#3F3F46] flex items-center justify-between text-xs">
            <button
              onClick={() => runComplianceScan()}
              disabled={isScanning}
              className="flex items-center space-x-1.5 text-[#FF1744] hover:text-[#FF6B6B] font-medium transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Evaluating Expiries...' : 'Re-scan Expiries'}</span>
            </button>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="flex items-center space-x-1 text-[#A1A1AA] hover:text-[#F5F5F5] font-medium transition cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>

          {/* Notification Items List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-[#09090B]">
            {notifications.length === 0 ? (
              <div className="py-16 text-center text-[#71717A] space-y-2">
                <ShieldCheck className="w-10 h-10 text-[#22C55E] mx-auto opacity-80" />
                <p className="text-sm font-medium text-[#F5F5F5]">No notifications.</p>
                <p className="text-xs text-[#71717A]">No pending document expiries or alerts.</p>
              </div>
            ) : (
              notifications.slice(0, 30).map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 rounded-xl border transition cursor-pointer ${
                    n.is_read
                      ? 'bg-[#18181B]/50 border-[#3F3F46] text-[#71717A]'
                      : 'bg-[#18181B] border-[#7F1D1D] shadow-lg hover:border-[#E53935] text-[#F5F5F5]'
                  }`}
                  onClick={() => handleAction(n)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    {getSeverityBadge(n.severity)}
                    <span className="text-[10px] text-[#71717A] font-medium">{n.type}</span>
                  </div>
                  <h4 className="text-xs font-semibold leading-snug mb-1 text-[#F5F5F5]">{n.title}</h4>
                  <p className="text-[11px] leading-relaxed text-[#A1A1AA] line-clamp-2">{n.message}</p>
                  
                  <div className="mt-2.5 pt-2 border-t border-[#3F3F46] flex items-center justify-between text-[10px] text-[#71717A]">
                    <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-[#FF1744] hover:text-[#FF6B6B] font-semibold flex items-center">
                      View Details <ArrowRight className="w-3 h-3 ml-1" />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-[#3F3F46] bg-[#111113]">
            <button
              onClick={() => {
                onClose();
                onNavigate('/notifications');
              }}
              className="w-full py-2.5 bg-[#27272A] hover:bg-[#E53935] text-[#F5F5F5] rounded-xl text-xs font-semibold transition text-center cursor-pointer border border-[#52525B]"
            >
              Open Full Notification Center
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationDrawer;
