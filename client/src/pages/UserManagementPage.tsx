import React, { useState, useEffect } from 'react';
import {
  Users, UserPlus, Search, Filter, Shield, Phone,
  KeyRound, Edit3, Trash2, CheckCircle, XCircle, AlertCircle,
  Clock, RefreshCw, X, ShieldAlert, Lock, UserCheck
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import type { User } from '../types';

export const UserManagementPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPassModalOpen, setIsResetPassModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Fleet Manager',
    phone: '',
    status: 'Active'
  });
  const [newPassword, setNewPassword] = useState('');
  const [modalError, setModalError] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roles = [
    'Super Admin',
    'Fleet Manager',
    'Compliance Manager',
    'Accountant',
    'Mechanic',
    'Driver'
  ];

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers({
        search: searchTerm,
        role: roleFilter,
        status: statusFilter
      });
      setUsers(data);
    } catch (err: any) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [searchTerm, roleFilter, statusFilter]);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'Fleet Manager',
      phone: '',
      status: 'Active'
    });
    setModalError('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      phone: user.phone || '',
      status: user.status || 'Active'
    });
    setModalError('');
    setIsEditModalOpen(true);
  };

  const handleOpenResetPass = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setModalError('');
    setIsResetPassModalOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setIsSubmitting(true);
    try {
      await api.createUser(formData);
      setIsAddModalOpen(false);
      setActionSuccessMsg(`User ${formData.name} created successfully.`);
      setTimeout(() => setActionSuccessMsg(''), 4000);
      fetchUsers();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setModalError('');
    setIsSubmitting(true);
    try {
      await api.updateUser(selectedUser.id, {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        phone: formData.phone,
        status: formData.status
      });
      setIsEditModalOpen(false);
      setActionSuccessMsg(`User ${formData.name} updated successfully.`);
      setTimeout(() => setActionSuccessMsg(''), 4000);
      fetchUsers();
    } catch (err: any) {
      setModalError(err.message || 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusToggle = async (user: User, newStatus: string) => {
    try {
      await api.updateUserStatus(user.id, newStatus);
      setActionSuccessMsg(`User ${user.name} status changed to ${newStatus}.`);
      setTimeout(() => setActionSuccessMsg(''), 4000);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setModalError('');
    setIsSubmitting(true);
    try {
      await api.resetUserPassword(selectedUser.id, newPassword);
      setIsResetPassModalOpen(false);
      setActionSuccessMsg(`Password for ${selectedUser.name} reset successfully.`);
      setTimeout(() => setActionSuccessMsg(''), 4000);
    } catch (err: any) {
      setModalError(err.message || 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await api.deleteUser(deletingUser.id);
      showSuccess('Record deleted successfully.');
      setDeletingUser(null);
      fetchUsers();
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      showError('Unable to delete this record. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Super Admin':
        return 'bg-[#7F1D1D]/30 text-[#FF6B6B] border-[#7F1D1D]';
      case 'Fleet Manager':
        return 'bg-[#1e293b] text-[#60A5FA] border-[#3b82f6]/40';
      case 'Compliance Manager':
        return 'bg-[#0F2A1A] text-[#22C55E] border-[#22C55E]/40';
      case 'Accountant':
        return 'bg-[#3A2808] text-[#F59E0B] border-[#F59E0B]/40';
      case 'Mechanic':
        return 'bg-[#2e1065] text-[#C084FC] border-[#A855F7]/40';
      case 'Driver':
        return 'bg-[#134e4a] text-[#2DD4BF] border-[#2DD4BF]/40';
      default:
        return 'bg-[#27272A] text-[#A1A1AA] border-[#3F3F46]';
    }
  };

  const getStatusBadge = (status: string = 'Active') => {
    switch (status) {
      case 'Active':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40">
            <CheckCircle className="w-3 h-3 mr-1 text-[#22C55E]" /> Active
          </span>
        );
      case 'Inactive':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#27272A] text-[#A1A1AA] border border-[#3F3F46]">
            <XCircle className="w-3 h-3 mr-1 text-[#71717A]" /> Inactive
          </span>
        );
      case 'Suspended':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#3F1111] text-[#FF6B6B] border border-[#B71C1C]">
            <ShieldAlert className="w-3 h-3 mr-1 text-[#FF1744]" /> Suspended
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#18181B] rounded-2xl p-6 border border-[#3F3F46] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <div className="p-2 bg-[#7F1D1D]/30 text-[#FF1744] rounded-xl border border-[#7F1D1D]">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-[#F5F5F5]">User & Access Governance</h1>
          </div>
          <p className="text-xs text-[#A1A1AA]">
            Manage user accounts, assign role permissions, reset credentials, and monitor access statuses.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center space-x-2 px-4 py-2.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] text-xs font-semibold rounded-xl shadow-lg shadow-[#E53935]/20 transition self-start md:self-auto cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New User</span>
        </button>
      </div>

      {actionSuccessMsg && (
        <div className="p-4 bg-[#0F2A1A] border border-[#22C55E]/40 rounded-xl text-[#22C55E] text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-[#22C55E] shrink-0" />
            <span className="font-semibold">{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg('')} className="text-[#22C55E] hover:text-[#4ade80] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-[#18181B] p-4 rounded-2xl border border-[#3F3F46] shadow-xl flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-xs text-[#F5F5F5] placeholder-[#71717A] focus:outline-none focus:border-[#E53935]"
          />
        </div>

        <div className="flex items-center space-x-2.5 w-full sm:w-auto">
          <div className="flex items-center space-x-1.5 text-xs text-[#A1A1AA]">
            <Filter className="w-3.5 h-3.5 text-[#71717A]" />
            <span className="font-semibold">Role:</span>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 bg-[#111113] border border-[#3F3F46] rounded-xl text-xs text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
          >
            <option value="All">All Roles</option>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <div className="flex items-center space-x-1.5 text-xs text-[#A1A1AA] pl-2">
            <span className="font-semibold">Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-[#111113] border border-[#3F3F46] rounded-xl text-xs text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Suspended">Suspended</option>
          </select>

          <button
            onClick={fetchUsers}
            className="p-2 text-[#71717A] hover:text-[#F5F5F5] hover:bg-[#27272A] rounded-xl transition ml-auto cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#E53935]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#18181B] rounded-2xl border border-[#3F3F46] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#3F3F46] bg-[#27272A] text-[11px] font-bold text-[#F5F5F5] uppercase tracking-wider">
                <th className="py-3.5 px-4">User Account</th>
                <th className="py-3.5 px-4">Assigned Role</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">Account Status</th>
                <th className="py-3.5 px-4">Last Login</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3F3F46] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#A1A1AA]">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-[#E53935] border-t-transparent rounded-full animate-spin" />
                      <span>Loading accounts...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#71717A]">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <UserCheck className="w-8 h-8 text-[#71717A]" />
                      <p className="font-semibold text-[#D4D4D8]">No user accounts found</p>
                      <p className="text-xs text-[#71717A]">Try adjusting your search criteria or add a new user.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#202024] transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7F1D1D] to-[#E53935] text-[#F5F5F5] flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                          {u.name ? u.name[0].toUpperCase() : 'U'}
                        </div>
                        <div>
                          <p className="font-bold text-[#F5F5F5]">{u.name}</p>
                          <p className="text-[11px] text-[#A1A1AA] font-mono">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getRoleBadgeColor(u.role)}`}>
                        <Shield className="w-3 h-3 mr-1" />
                        {u.role}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-[#A1A1AA]">
                      {u.phone ? (
                        <div className="flex items-center space-x-1 font-mono text-[11px]">
                          <Phone className="w-3 h-3 text-[#71717A]" />
                          <span>{u.phone}</span>
                        </div>
                      ) : (
                        <span className="text-[#71717A] italic">No phone</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {getStatusBadge(u.status)}
                    </td>

                    <td className="py-3.5 px-4 text-[#A1A1AA]">
                      {u.last_login ? (
                        <div className="flex items-center space-x-1 text-[11px]">
                          <Clock className="w-3 h-3 text-[#71717A]" />
                          <span>{new Date(u.last_login).toLocaleDateString()} {new Date(u.last_login).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ) : (
                        <span className="text-[#71717A] text-[11px]">Never</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 text-[#A1A1AA] hover:text-[#60A5FA] hover:bg-[#1e293b] rounded-lg transition cursor-pointer"
                          title="Edit user details"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleOpenResetPass(u)}
                          className="p-1.5 text-[#A1A1AA] hover:text-[#F59E0B] hover:bg-[#3A2808] rounded-lg transition cursor-pointer"
                          title="Reset password"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>

                        {u.status === 'Active' ? (
                          <button
                            onClick={() => handleStatusToggle(u, 'Inactive')}
                            className="p-1.5 text-[#A1A1AA] hover:text-[#FF1744] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                            title="Deactivate account"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusToggle(u, 'Active')}
                            className="p-1.5 text-[#A1A1AA] hover:text-[#22C55E] hover:bg-[#0F2A1A] rounded-lg transition cursor-pointer"
                            title="Activate account"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => setDeletingUser(u)}
                          className="p-1.5 text-[#71717A] hover:text-[#FF1744] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                          title="Delete user permanently"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add User */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#3F3F46] flex items-center justify-between bg-[#111113]">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-[#E53935]" />
                <h3 className="font-bold text-[#F5F5F5] text-sm">Add New User Account</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-[#71717A] hover:text-[#F5F5F5] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-3.5">
              {modalError && (
                <div className="p-3 bg-[#3F1111] border border-[#B71C1C] rounded-xl text-[#FF6B6B] text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#FF1744]" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#F5F5F5] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-xs text-[#F5F5F5] placeholder-[#71717A] focus:outline-none focus:border-[#E53935]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F5F5F5] mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. ramesh@smartfleet.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-xs text-[#F5F5F5] placeholder-[#71717A] focus:outline-none focus:border-[#E53935]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F5F5F5] mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-xs text-[#F5F5F5] placeholder-[#71717A] focus:outline-none focus:border-[#E53935]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#F5F5F5] mb-1">Assigned Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-xs text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                  >
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#F5F5F5] mb-1">Initial Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-xs text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F5F5F5] mb-1">Contact Phone</label>
                <input
                  type="text"
                  placeholder="+91 98000 00000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-xs text-[#F5F5F5] placeholder-[#71717A] focus:outline-none focus:border-[#E53935]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-semibold shadow-lg shadow-[#E53935]/20 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit User */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#3F3F46] flex items-center justify-between bg-[#111113]">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-[#E53935]" />
                <h3 className="font-bold text-[#F5F5F5] text-sm">Edit User Account</h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-[#71717A] hover:text-[#F5F5F5] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-6 space-y-3.5">
              {modalError && (
                <div className="p-3 bg-[#3F1111] border border-[#B71C1C] rounded-xl text-[#FF6B6B] text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#FF1744]" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#F5F5F5] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-xs text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F5F5F5] mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-xs text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#F5F5F5] mb-1">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-xs text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                  >
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#F5F5F5] mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-xs text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F5F5F5] mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-xs text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-semibold shadow-lg shadow-[#E53935]/20 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {isResetPassModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#3F3F46] flex items-center justify-between bg-[#111113]">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-[#F59E0B]" />
                <h3 className="font-bold text-[#F5F5F5] text-sm">Reset Password</h3>
              </div>
              <button onClick={() => setIsResetPassModalOpen(false)} className="text-[#71717A] hover:text-[#F5F5F5] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-3.5">
              {modalError && (
                <div className="p-3 bg-[#3F1111] border border-[#B71C1C] rounded-xl text-[#FF6B6B] text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#FF1744]" />
                  <span>{modalError}</span>
                </div>
              )}

              <p className="text-xs text-[#A1A1AA]">
                Set a new password for <span className="font-bold text-[#F5F5F5]">{selectedUser.name}</span> ({selectedUser.email}):
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#F5F5F5] mb-1">New Password *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
                  <input
                    type="password"
                    required
                    placeholder="Enter new password (min 6 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-xs text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsResetPassModalOpen(false)}
                  className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#F59E0B] hover:bg-[#d97706] text-[#111113] font-bold rounded-xl text-xs shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Resetting...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete User Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingUser}
        title="Delete User Account"
        itemName={deletingUser?.name}
        itemDetails={deletingUser ? `${deletingUser.role} • ${deletingUser.email}` : undefined}
        isLoading={isDeleting}
        onConfirm={confirmDeleteUser}
        onCancel={() => setDeletingUser(null)}
      />
    </div>
  );
};

export default UserManagementPage;
