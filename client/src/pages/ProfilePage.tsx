import React, { useState, useEffect } from 'react';
import {
  User, Mail, Phone, Shield, Clock, Calendar, CheckCircle2,
  AlertCircle, Lock, Camera, Save, ArrowLeft, KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ProfilePageProps {
  onNavigate: (path: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigate }) => {
  const { user, updateUserProfile, isSuperAdmin } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || user?.mobile || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || user?.profileImage || '');
  const [role, setRole] = useState(user?.role || '');

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || user.mobile || '');
      setAvatarUrl(user.avatar_url || user.profileImage || '');
      setRole(user.role || '');
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim()) {
      setErrorMsg('Full Name cannot be blank.');
      return;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        setErrorMsg('New password must be at least 6 characters long.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('New password and confirmation do not match.');
        return;
      }
      if (!currentPassword) {
        setErrorMsg('Current password is required to update your password.');
        return;
      }
    }

    setIsSaving(true);
    try {
      await updateUserProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
        role: isSuperAdmin ? role : undefined,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined
      });

      setSuccessMsg('Your profile has been updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return 'Not recorded';
    try {
      return new Date(iso).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch {
      return iso;
    }
  };

  const getRoleColor = (roleName?: string) => {
    switch (roleName) {
      case 'Super Admin':
        return 'bg-[#3F1111] text-[#FF1744] border-[#7F1D1D]';
      case 'Fleet Manager':
        return 'bg-[#1E293B] text-[#60A5FA] border-[#3B82F6]/40';
      case 'Compliance Manager':
        return 'bg-[#0F2A1A] text-[#22C55E] border-[#22C55E]/40';
      case 'Accountant':
        return 'bg-[#3A2808] text-[#F59E0B] border-[#F59E0B]/40';
      case 'Mechanic':
        return 'bg-[#2E1065] text-[#C084FC] border-[#A855F7]/40';
      case 'Driver':
        return 'bg-[#082F49] text-[#38BDF8] border-[#38BDF8]/40';
      default:
        return 'bg-[#27272A] text-[#A1A1AA] border-[#3F3F46]';
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header Back Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('/')}
          className="flex items-center space-x-1.5 text-xs font-semibold text-[#A1A1AA] hover:text-[#F5F5F5] transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#E53935]" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* Main Profile Header Card */}
      <div className="bg-[#18181B] p-6 sm:p-8 rounded-2xl border border-[#3F3F46] shadow-lg shadow-black/40">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar Display */}
          <div className="relative group">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user?.name || 'User Avatar'}
                className="w-24 h-24 rounded-2xl object-cover border-2 border-[#7F1D1D] shadow-md bg-[#111113]"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-[#B71C1C] to-[#E53935] text-[#F5F5F5] flex items-center justify-center font-extrabold text-3xl shadow-lg shadow-[#E53935]/20">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
            )}
            <div className="absolute -bottom-2 -right-2 p-1.5 bg-[#E53935] text-[#F5F5F5] rounded-xl shadow-md border-2 border-[#18181B]">
              <Camera className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* User Details Overview */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#F5F5F5] tracking-tight">
                {user?.name}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border inline-flex items-center justify-center self-center sm:self-auto ${getRoleColor(user?.role)}`}>
                {user?.role}
              </span>
            </div>

            <p className="text-xs text-[#A1A1AA] flex items-center justify-center sm:justify-start gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#E53935]" />
              <span>{user?.email}</span>
            </p>

            {/* Quick Status Badges */}
            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-[#A1A1AA]">
              <div className="flex items-center space-x-1.5 bg-[#111113] px-3 py-1.5 rounded-xl border border-[#3F3F46]">
                <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                <span className="font-semibold text-[#F5F5F5]">Status: {user?.status || 'Active'}</span>
              </div>

              <div className="flex items-center space-x-1.5 bg-[#111113] px-3 py-1.5 rounded-xl border border-[#3F3F46]">
                <Clock className="w-3.5 h-3.5 text-[#E53935]" />
                <span>Last Login: <strong className="text-[#F5F5F5]">{formatDateTime(user?.last_login || user?.lastLoginAt)}</strong></span>
              </div>

              <div className="flex items-center space-x-1.5 bg-[#111113] px-3 py-1.5 rounded-xl border border-[#3F3F46]">
                <Calendar className="w-3.5 h-3.5 text-[#FF1744]" />
                <span>Account Created: <strong className="text-[#F5F5F5]">{formatDateTime(user?.created_at || user?.createdAt)}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {successMsg && (
        <div className="p-4 bg-[#0F2A1A] border border-[#22C55E] rounded-2xl text-[#22C55E] text-xs flex items-center space-x-2.5">
          <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-[#3F1111] border border-[#B71C1C] rounded-2xl text-[#FF6B6B] text-xs flex items-center space-x-2.5">
          <AlertCircle className="w-4 h-4 text-[#FF1744] shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Edit Form */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Profile Information Section */}
        <div className="bg-[#18181B] p-6 sm:p-8 rounded-2xl border border-[#3F3F46] shadow-sm space-y-6">
          <div className="border-b border-[#3F3F46] pb-4">
            <h3 className="text-base font-bold text-[#F5F5F5] flex items-center space-x-2">
              <User className="w-4 h-4 text-[#E53935]" />
              <span>Personal Information</span>
            </h3>
            <p className="text-xs text-[#A1A1AA] mt-0.5">
              Update your account display name, contact phone number, and avatar
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1.5">
                Full Name <span className="text-[#FF1744]">*</span>
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-[#111113] hover:bg-[#202024] focus:bg-[#111113] border border-[#3F3F46] focus:border-[#E53935] rounded-xl text-xs text-[#F5F5F5] placeholder-[#71717A] focus:outline-hidden transition"
                  placeholder="Your full name"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1.5">
                Mobile Number
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                  <Phone className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-[#111113] hover:bg-[#202024] focus:bg-[#111113] border border-[#3F3F46] focus:border-[#E53935] rounded-xl text-xs text-[#F5F5F5] placeholder-[#71717A] focus:outline-hidden transition"
                  placeholder="+91 98000 00000"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1.5">
                Email Address (Account Identifier)
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="block w-full pl-10 pr-3 py-2.5 bg-[#27272A] border border-[#3F3F46] rounded-xl text-xs text-[#71717A] cursor-not-allowed"
                />
              </div>
              <p className="text-[10px] text-[#71717A] mt-1">Contact administrator to change account login email</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1.5">
                Assigned Role
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                  <Shield className="h-4 w-4" />
                </div>
                {isSuperAdmin ? (
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-[#111113] hover:bg-[#202024] focus:bg-[#111113] border border-[#3F3F46] focus:border-[#E53935] rounded-xl text-xs text-[#F5F5F5] focus:outline-hidden transition"
                  >
                    <option value="Super Admin" className="bg-[#18181B] text-[#F5F5F5]">Super Admin</option>
                    <option value="Fleet Manager" className="bg-[#18181B] text-[#F5F5F5]">Fleet Manager</option>
                    <option value="Compliance Manager" className="bg-[#18181B] text-[#F5F5F5]">Compliance Manager</option>
                    <option value="Accountant" className="bg-[#18181B] text-[#F5F5F5]">Accountant</option>
                    <option value="Mechanic" className="bg-[#18181B] text-[#F5F5F5]">Mechanic</option>
                    <option value="Driver" className="bg-[#18181B] text-[#F5F5F5]">Driver</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    value={user?.role || ''}
                    className="block w-full pl-10 pr-3 py-2.5 bg-[#27272A] border border-[#3F3F46] rounded-xl text-xs text-[#71717A] cursor-not-allowed"
                  />
                )}
              </div>
              {!isSuperAdmin && (
                <p className="text-[10px] text-[#71717A] mt-1">Roles are managed by your System Administrator</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1.5">
                Profile Avatar URL
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                  <Camera className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-[#111113] hover:bg-[#202024] focus:bg-[#111113] border border-[#3F3F46] focus:border-[#E53935] rounded-xl text-xs text-[#F5F5F5] placeholder-[#71717A] focus:outline-hidden transition"
                  placeholder="https://images.example.com/avatar.jpg"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Security & Password Change Section */}
        <div className="bg-[#18181B] p-6 sm:p-8 rounded-2xl border border-[#3F3F46] shadow-sm space-y-6">
          <div className="border-b border-[#3F3F46] pb-4">
            <h3 className="text-base font-bold text-[#F5F5F5] flex items-center space-x-2">
              <KeyRound className="w-4 h-4 text-[#E53935]" />
              <span>Change Password</span>
            </h3>
            <p className="text-xs text-[#A1A1AA] mt-0.5">
              Leave blank if you do not want to change your current password
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1.5">
                Current Password
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-[#111113] hover:bg-[#202024] focus:bg-[#111113] border border-[#3F3F46] focus:border-[#E53935] rounded-xl text-xs text-[#F5F5F5] placeholder-[#71717A] focus:outline-hidden transition"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1.5">
                New Password
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-[#111113] hover:bg-[#202024] focus:bg-[#111113] border border-[#3F3F46] focus:border-[#E53935] rounded-xl text-xs text-[#F5F5F5] placeholder-[#71717A] focus:outline-hidden transition"
                  placeholder="Minimum 6 characters"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#D4D4D8] mb-1.5">
                Confirm New Password
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-[#111113] hover:bg-[#202024] focus:bg-[#111113] border border-[#3F3F46] focus:border-[#E53935] rounded-xl text-xs text-[#F5F5F5] placeholder-[#71717A] focus:outline-hidden transition"
                  placeholder="Repeat new password"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="px-4 py-2.5 bg-[#27272A] hover:bg-[#3F3F46] border border-[#52525B] text-[#F5F5F5] rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center space-x-2 px-6 py-2.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/20 transition disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-[#F5F5F5]/30 border-t-[#F5F5F5] rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfilePage;
