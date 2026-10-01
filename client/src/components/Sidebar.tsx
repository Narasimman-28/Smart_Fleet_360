import React from 'react';
import {
  LayoutDashboard, Truck, FileCheck, Shield, Wind, CheckSquare,
  FileSpreadsheet, CreditCard, AlertTriangle, Fuel, Wrench,
  Calendar, Users, Disc, Receipt, Briefcase, BarChart3,
  Bell, History, Settings, ChevronRight, UserCog, Navigation
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const { unreadCount } = useNotifications();
  const { user, hasPermission } = useAuth();

  const allNavGroups = [
    {
      title: 'CORE FLEET',
      items: [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['All'] },
        { path: '/tracking', label: 'Driver Location Watch', icon: Navigation, roles: ['Super Admin', 'Fleet Manager', 'Compliance Manager', 'Driver'] },
        { path: '/vehicles', label: user?.role === 'Driver' ? 'My Assigned Vehicle' : 'Vehicles Registry', icon: Truck, roles: ['Super Admin', 'Fleet Manager', 'Compliance Manager', 'Mechanic', 'Driver'] },
        { path: '/bookings', label: 'Bookings & Trips', icon: Calendar, roles: ['Super Admin', 'Fleet Manager', 'Driver', 'Accountant'] },
        { path: '/drivers', label: 'Driver Management', icon: Users, roles: ['Super Admin', 'Fleet Manager'] },
      ]
    },
    {
      title: 'COMPLIANCE & RTO',
      items: [
        { path: '/compliance', label: 'RTO Compliance Hub', icon: FileCheck, roles: ['Super Admin', 'Compliance Manager'] },
        { path: '/insurance', label: 'Insurance Policies', icon: Shield, roles: ['Super Admin', 'Compliance Manager', 'Accountant'] },
        { path: '/puc', label: 'PUC / Pollution', icon: Wind, roles: ['Super Admin', 'Compliance Manager'] },
        { path: '/fitness', label: 'Fitness Certificates', icon: CheckSquare, roles: ['Super Admin', 'Compliance Manager'] },
        { path: '/permits-tax', label: 'Permits & Road Tax', icon: FileSpreadsheet, roles: ['Super Admin', 'Compliance Manager', 'Accountant'] },
        { path: '/fastag', label: 'FASTag Management', icon: CreditCard, roles: ['Super Admin', 'Fleet Manager', 'Compliance Manager', 'Accountant'] },
        { path: '/challans', label: 'Traffic Challans', icon: AlertTriangle, roles: ['Super Admin', 'Compliance Manager', 'Accountant'] },
      ]
    },
    {
      title: 'OPERATIONS & WORKSHOP',
      items: [
        { path: '/driver-portal', label: 'Driver GPS Portal', icon: Navigation, roles: ['Super Admin', 'Fleet Manager', 'Driver'] },
        { path: '/fuel', label: 'Fuel & Mileage Logs', icon: Fuel, roles: ['Super Admin', 'Fleet Manager', 'Accountant', 'Mechanic', 'Driver'] },
        { path: '/maintenance', label: 'Service & Maintenance', icon: Wrench, roles: ['Super Admin', 'Fleet Manager', 'Mechanic', 'Accountant'] },
        { path: '/tyres-batteries', label: 'Tyres & Batteries', icon: Disc, roles: ['Super Admin', 'Fleet Manager', 'Mechanic'] },
        { path: '/expenses', label: 'Expenses & Financials', icon: Receipt, roles: ['Super Admin', 'Fleet Manager', 'Accountant'] },
        { path: '/customers', label: 'Customer CRM', icon: Briefcase, roles: ['Super Admin', 'Fleet Manager', 'Accountant'] },
      ]
    },
    {
      title: 'INTELLIGENCE & ADMIN',
      items: [
        { path: '/reports', label: 'Reports & Analytics', icon: BarChart3, roles: ['Super Admin', 'Fleet Manager', 'Compliance Manager', 'Accountant'] },
        { path: '/notifications', label: 'Notification Center', icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined, roles: ['All'] },
        { path: '/users', label: 'User Management', icon: UserCog, roles: ['Super Admin'] },
        { path: '/audit-logs', label: 'Audit Trail Logs', icon: History, roles: ['Super Admin'] },
        { path: '/settings', label: 'Settings & Config', icon: Settings, roles: ['Super Admin'] },
      ]
    }
  ];

  // Filter groups and items according to current role
  const visibleNavGroups = allNavGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (item.roles.includes('All')) return true;
      return hasPermission(item.roles);
    })
  })).filter(group => group.items.length > 0);

  return (
    <aside className="w-64 bg-[#111113] border-r border-[#3F3F46] flex flex-col h-[calc(100vh-4rem)] sticky top-16 select-none shadow-2xl">
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {visibleNavGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            <h3 className="px-3 text-[10px] font-extrabold text-[#71717A] uppercase tracking-wider mb-2">
              {group.title}
            </h3>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));

              return (
                <button
                  key={item.path}
                  onClick={() => onNavigate(item.path)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition duration-150 group cursor-pointer border ${
                    isActive
                      ? 'bg-[#B71C1C] text-[#F5F5F5] font-semibold border-l-4 border-l-[#FF1744] border-t-[#7F1D1D] border-r-[#7F1D1D] border-b-[#7F1D1D] shadow-[0_0_12px_rgba(229,57,53,0.35)]'
                      : 'text-[#A1A1AA] border-transparent hover:text-[#F5F5F5] hover:bg-[#3F1818] hover:border-[#7F1D1D]/50'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#F5F5F5]' : 'text-[#A1A1AA] group-hover:text-[#FF1744]'} transition`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#FF1744] text-[#F5F5F5] rounded-full shadow-sm">
                      {item.badge}
                    </span>
                  )}

                  {isActive && !item.badge && (
                    <ChevronRight className="w-3.5 h-3.5 text-[#F5F5F5] shrink-0 opacity-80" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Fleet Summary Quick Footer with Role Status */}
      <div className="p-3 border-t border-[#3F3F46] bg-[#09090B]/80">
        <div className="p-2.5 rounded-xl bg-[#18181B] border border-[#3F3F46] flex items-center justify-between shadow-inner">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
            <span className="text-[11px] font-medium text-[#D4D4D8]">Live Telematics Sync</span>
          </div>
          <span className="text-[10px] text-[#22C55E] font-mono font-bold">100% OK</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
