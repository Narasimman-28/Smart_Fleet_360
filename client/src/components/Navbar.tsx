import React, { useState } from 'react';
import {
  Search, Bell, Plus, ChevronDown, Check, Zap, LogOut,
  Users, Settings as SettingsIcon, ArrowLeftRight, RotateCcw,
  User as UserIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { GlobalSearchModal } from './GlobalSearchModal';
import { NotificationDrawer } from './NotificationDrawer';

interface NavbarProps {
  onNavigate: (path: string, replace?: boolean) => void;
  onOpenQuickAdd: (type: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate, onOpenQuickAdd }) => {
  const {
    user,
    switchRole,
    restoreSuperAdmin,
    logout,
    isSuperAdmin,
    isImpersonating
  } = useAuth();
  const { unreadCount } = useNotifications();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  const availableRoles = [
    'Super Admin',
    'Fleet Manager',
    'Compliance Manager',
    'Accountant',
    'Mechanic',
    'Driver'
  ];

  const handleLogout = async () => {
    setIsProfileMenuOpen(false);
    await logout();
    onNavigate('/login', true);
  };

  const avatarUrl = user?.avatar_url || user?.profileImage;

  return (
    <>
      {/* Super Admin Impersonation Notice Bar */}
      {isImpersonating && (
        <div className="bg-[#B71C1C] text-[#F5F5F5] px-4 py-1.5 text-xs font-semibold flex items-center justify-between border-b border-[#FF1744]/40 shadow-md">
          <div className="flex items-center space-x-2">
            <ArrowLeftRight className="w-4 h-4 text-[#FF1744]" />
            <span>
              Active Role Context: <strong className="text-white">{user?.role}</strong> (Actual Account: <strong className="text-white">Super Admin</strong>)
            </span>
          </div>
          <button
            onClick={restoreSuperAdmin}
            className="flex items-center space-x-1 px-2.5 py-0.5 bg-[#7F1D1D] hover:bg-[#E53935] text-[#F5F5F5] rounded-lg text-[11px] font-bold shadow transition cursor-pointer border border-[#FF1744]/30"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Return to Super Admin</span>
          </button>
        </div>
      )}

      <header className="sticky top-0 z-30 h-16 bg-[#111113] border-b border-[#3F3F46] px-4 sm:px-6 flex items-center justify-between shadow-lg">
        {/* Left: Brand / Title */}
        <div className="flex items-center space-x-3 cursor-pointer select-none" onClick={() => onNavigate('/')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#B71C1C] via-[#E53935] to-[#FF1744] flex items-center justify-center shadow-lg shadow-[#E53935]/25 border border-[#FF1744]/30">
            <Zap className="w-6 h-6 text-[#F5F5F5]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg text-[#F5F5F5] tracking-tight">
                SmartFleet <span className="text-[#E53935]">360</span>
              </span>
              <span className="hidden md:inline-block px-2 py-0.5 text-[10px] font-bold bg-[#3F1111] text-[#FF1744] border border-[#7F1D1D] rounded-full">
                v2.0 PRO
              </span>
            </div>
            <p className="hidden sm:block text-[11px] text-[#A1A1AA]">Intelligent Transport & Fleet Governance</p>
          </div>
        </div>

        {/* Center: Search Trigger Bar */}
        <div className="flex-1 max-w-lg mx-4 lg:mx-8 hidden sm:block">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-2 bg-[#18181B] hover:bg-[#202024] hover:border-[#E53935] border border-[#3F3F46] rounded-xl text-[#A1A1AA] text-xs transition group shadow-inner cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-[#71717A] group-hover:text-[#E53935] transition" />
              <span className="text-[#A1A1AA]">Search vehicle, chassis, policy, FASTag, driver, challans...</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#27272A] text-[#A1A1AA] border border-[#3F3F46] rounded">Ctrl+K</kbd>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2.5">
          {/* Mobile Search Button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="sm:hidden p-2 text-[#A1A1AA] hover:text-[#F5F5F5] rounded-lg hover:bg-[#18181B] border border-transparent hover:border-[#3F3F46]"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Quick Action Button (Role Aware) */}
          {user?.role !== 'Driver' && (
            <div className="relative">
              <button
                onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] text-xs font-semibold rounded-xl shadow-md transition cursor-pointer border border-[#FF1744]/40"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden md:inline">Quick Action</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {isQuickAddOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-[#18181B] border border-[#3F3F46] rounded-xl shadow-2xl p-1.5 z-40 animate-fadeIn text-[#F5F5F5]">
                  <button
                    onClick={() => { setIsQuickAddOpen(false); onOpenQuickAdd('vehicle'); }}
                    className="w-full text-left px-3 py-2 text-xs text-[#F5F5F5] hover:bg-[#3F1818] hover:text-[#FF1744] rounded-lg flex items-center space-x-2 transition font-medium cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-[#E53935]" />
                    <span>Register Vehicle</span>
                  </button>
                  <button
                    onClick={() => { setIsQuickAddOpen(false); onOpenQuickAdd('booking'); }}
                    className="w-full text-left px-3 py-2 text-xs text-[#F5F5F5] hover:bg-[#3F1818] hover:text-[#FF1744] rounded-lg flex items-center space-x-2 transition font-medium cursor-pointer"
                  >
                    <Zap className="w-4 h-4 text-[#60A5FA]" />
                    <span>New Booking / Trip</span>
                  </button>
                  <button
                    onClick={() => { setIsQuickAddOpen(false); onOpenQuickAdd('fuel'); }}
                    className="w-full text-left px-3 py-2 text-xs text-[#F5F5F5] hover:bg-[#3F1818] hover:text-[#FF1744] rounded-lg flex items-center space-x-2 transition font-medium cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-[#F59E0B]" />
                    <span>Log Fuel Refill</span>
                  </button>
                  <button
                    onClick={() => { setIsQuickAddOpen(false); onOpenQuickAdd('service'); }}
                    className="w-full text-left px-3 py-2 text-xs text-[#F5F5F5] hover:bg-[#3F1818] hover:text-[#FF1744] rounded-lg flex items-center space-x-2 transition font-medium cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-[#22C55E]" />
                    <span>Schedule Service</span>
                  </button>
                  <button
                    onClick={() => { setIsQuickAddOpen(false); onOpenQuickAdd('expense'); }}
                    className="w-full text-left px-3 py-2 text-xs text-[#F5F5F5] hover:bg-[#3F1818] hover:text-[#FF1744] rounded-lg flex items-center space-x-2 transition font-medium cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-[#FF1744]" />
                    <span>Record Expense</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Notification Bell */}
          <button
            onClick={() => setIsNotifDrawerOpen(true)}
            className="relative p-2 text-[#A1A1AA] hover:text-[#F5F5F5] rounded-xl hover:bg-[#18181B] border border-transparent hover:border-[#3F3F46] transition cursor-pointer"
            title="Notification Center"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#FF1744] text-[10px] font-bold text-[#F5F5F5] rounded-full flex items-center justify-center animate-pulse shadow-[0_0_8px_rgba(255,23,68,0.8)]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Profile & Menu */}
          <div className="relative">
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center space-x-2 p-1.5 bg-[#18181B] hover:bg-[#202024] border border-[#3F3F46] rounded-xl transition cursor-pointer"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user?.name || 'User'}
                  className="w-7 h-7 rounded-lg object-cover border border-[#E53935]"
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-[#E53935] text-[#F5F5F5] flex items-center justify-center font-bold text-xs">
                  {user?.name ? user.name[0].toUpperCase() : 'U'}
                </div>
              )}
              <div className="hidden lg:block text-left pr-1">
                <p className="text-xs font-semibold text-[#F5F5F5] leading-tight">{user?.name || 'User'}</p>
                <p className="text-[10px] text-[#FF1744] font-medium">{user?.role || 'Guest'}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#71717A]" />
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl p-2.5 z-40 animate-fadeIn text-[#F5F5F5]">
                {/* Profile Header Block */}
                <div className="px-3 py-3 border-b border-[#3F3F46] mb-2 flex items-start space-x-3">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={user?.name || 'User'}
                      className="w-10 h-10 rounded-xl object-cover border-2 border-[#E53935]/50 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#B71C1C] to-[#E53935] text-[#F5F5F5] flex items-center justify-center font-extrabold text-sm shrink-0 shadow-sm border border-[#FF1744]/40">
                      {user?.name ? user.name[0].toUpperCase() : 'U'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-[#F5F5F5] truncate leading-tight">{user?.name}</p>
                    <p className="text-[11px] text-[#A1A1AA] truncate mt-0.5">{user?.email}</p>
                    <div className="mt-1 flex items-center space-x-1.5">
                      <span className="px-2 py-0.5 bg-[#3F1111] text-[#FF1744] border border-[#7F1D1D] rounded-full text-[10px] font-bold">
                        Role: {user?.role}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Profile Links */}
                <div className="space-y-1">
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); onNavigate('/profile'); }}
                    className="w-full text-left px-3 py-2 text-xs text-[#F5F5F5] hover:bg-[#3F1818] hover:text-[#FF1744] rounded-xl flex items-center space-x-2 transition font-semibold cursor-pointer"
                  >
                    <UserIcon className="w-4 h-4 text-[#E53935]" />
                    <span>My Profile</span>
                  </button>

                  {/* Super Admin Options */}
                  {isSuperAdmin && (
                    <>
                      <button
                        onClick={() => { setIsProfileMenuOpen(false); onNavigate('/users'); }}
                        className="w-full text-left px-3 py-2 text-xs text-[#F5F5F5] hover:bg-[#202024] hover:text-[#FF1744] rounded-xl flex items-center space-x-2 transition font-medium cursor-pointer"
                      >
                        <Users className="w-4 h-4 text-[#E53935]" />
                        <span>User Management</span>
                      </button>

                      <div className="pt-2 pb-1 border-t border-[#3F3F46]">
                        <p className="px-3 text-[10px] font-extrabold text-[#71717A] uppercase tracking-wider mb-1">
                          Switch Active Role
                        </p>
                        <div className="space-y-0.5">
                          {availableRoles.map((role) => (
                            <button
                              key={role}
                              onClick={() => {
                                switchRole(role);
                                setIsProfileMenuOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 text-xs rounded-xl flex items-center justify-between transition cursor-pointer ${
                                user?.role === role
                                  ? 'bg-[#3F1111] text-[#FF1744] font-semibold border border-[#7F1D1D]'
                                  : 'text-[#A1A1AA] hover:bg-[#202024] hover:text-[#F5F5F5]'
                              }`}
                            >
                              <span>{role}</span>
                              {user?.role === role && <Check className="w-3.5 h-3.5 text-[#FF1744]" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {isSuperAdmin && (
                    <button
                      onClick={() => { setIsProfileMenuOpen(false); onNavigate('/settings'); }}
                      className="w-full text-left px-3 py-2 text-xs text-[#A1A1AA] hover:bg-[#202024] hover:text-[#F5F5F5] rounded-xl flex items-center space-x-2 transition font-medium cursor-pointer"
                    >
                      <SettingsIcon className="w-4 h-4 text-[#71717A]" />
                      <span>Settings & Config</span>
                    </button>
                  )}

                  <div className="pt-1.5 border-t border-[#3F3F46]">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 text-xs text-[#FF1744] hover:bg-[#3F1111] rounded-xl flex items-center space-x-2 transition font-bold cursor-pointer border border-transparent hover:border-[#7F1D1D]"
                    >
                      <LogOut className="w-4 h-4 text-[#FF1744]" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Omnisearch Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={onNavigate}
      />

      {/* Notification Slide Drawer */}
      <NotificationDrawer
        isOpen={isNotifDrawerOpen}
        onClose={() => setIsNotifDrawerOpen(false)}
        onNavigate={onNavigate}
      />
    </>
  );
};

export default Navbar;
