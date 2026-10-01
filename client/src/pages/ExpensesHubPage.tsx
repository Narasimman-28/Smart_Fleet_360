import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Plus, Search, Filter, Download, ArrowUpRight, TrendingUp, 
  CreditCard, AlertCircle, PieChart as PieChartIcon, 
  Receipt, Wallet, RefreshCw, X, Check, Trash2
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  PieChart, Pie, Cell, CartesianGrid 
} from 'recharts';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import type { Vehicle, Expense } from '../types';

const CATEGORY_COLORS: Record<string, string> = {
  Fuel: '#F59E0B',
  Maintenance: '#60A5FA',
  Service: '#38BDF8',
  FASTag: '#22C55E',
  Challan: '#FF1744',
  Insurance: '#A855F7',
  'Road Tax': '#EC4899',
  'Driver Salary': '#818CF8',
  'Tyre / Battery': '#2DD4BF',
  Other: '#A1A1AA'
};

export const ExpensesHubPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // New Expense form state
  const [formData, setFormData] = useState({
    vehicle_id: '',
    category: 'Fuel',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    payment_mode: 'UPI',
    vendor_name: '',
    invoice_ref: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleDeleteExpense = async () => {
    if (!deletingExpense) return;
    setIsDeleting(true);
    try {
      await api.deleteExpense(deletingExpense.id);
      showSuccess('Record deleted successfully.');
      setDeletingExpense(null);
      fetchExpenses();
    } catch (err) {
      console.error('Failed to delete expense:', err);
      showError('Unable to delete this record. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const [expRes, vehRes] = await Promise.all([
        api.expenses.getAll(),
        api.vehicles.getAll()
      ]);
      setExpenses(expRes || []);
      setVehicles(vehRes || []);
    } catch (err) {
      console.error('Failed to load expenses', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || isNaN(Number(formData.amount))) return;
    setSubmitting(true);
    try {
      await api.expenses.create({
        ...formData,
        amount: Number(formData.amount)
      });
      setIsAddModalOpen(false);
      setFormData({
        vehicle_id: '',
        category: 'Fuel',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        payment_mode: 'UPI',
        vendor_name: '',
        invoice_ref: '',
        notes: ''
      });
      fetchExpenses();
    } catch (err) {
      console.error('Failed to log expense', err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredExpenses = expenses.filter(item => {
    const matchesSearch = 
      (item.registration_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.vendor_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.invoice_ref || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalExpense = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  
  // Calculate category aggregates for charts
  const categoryMap: Record<string, number> = {};
  expenses.forEach(item => {
    categoryMap[item.category] = (categoryMap[item.category] || 0) + Number(item.amount || 0);
  });

  const chartData = Object.entries(categoryMap).map(([name, value]) => ({
    name,
    value,
    color: CATEGORY_COLORS[name] || '#A1A1AA'
  }));

  const exportCSV = () => {
    const headers = ['Date', 'Vehicle', 'Category', 'Amount (INR)', 'Payment Mode', 'Vendor', 'Invoice Ref', 'Notes'];
    const rows = filteredExpenses.map(e => [
      e.date,
      e.registration_number || 'Fleet Wide',
      e.category,
      e.amount,
      e.payment_mode || 'N/A',
      `"${e.vendor_name || ''}"`,
      e.invoice_ref || '',
      `"${e.notes || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SmartFleet_Expenses_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#F5F5F5] flex items-center gap-3">
            <Wallet className="w-8 h-8 text-[#E53935]" />
            Financial & Expense Hub
          </h1>
          <p className="text-sm text-[#A1A1AA] mt-1">
            Complete cost ledger, fuel, maintenance, tolls, RTO fees, and budget breakdown across all fleets
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={exportCSV}
            className="px-4 py-2.5 rounded-xl border border-[#3F3F46] bg-[#18181B] text-[#F5F5F5] hover:bg-[#202024] text-sm font-semibold transition flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#A1A1AA]" />
            Export CSV
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] text-sm font-semibold shadow-lg shadow-[#E53935]/20 transition flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Record Expense
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA]">Total Fleet Spend</span>
            <div className="p-2.5 rounded-xl bg-[#7F1D1D]/30 text-[#FF1744]">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-extrabold text-[#E53935]">
              ₹{totalExpense.toLocaleString('en-IN')}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-[#FF6B6B] font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{expenses.length} ledger transactions logged</span>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA]">Fuel Expenditure</span>
            <div className="p-2.5 rounded-xl bg-[#3A2808] text-[#F59E0B]">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-extrabold text-[#F59E0B]">
              ₹{(categoryMap['Fuel'] || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-[#71717A] mt-1">
              {totalExpense > 0 ? `${(((categoryMap['Fuel'] || 0) / totalExpense) * 100).toFixed(1)}% of total budget` : '0%'}
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA]">Repairs & Workshop</span>
            <div className="p-2.5 rounded-xl bg-[#1e293b] text-[#60A5FA]">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-extrabold text-[#60A5FA]">
              ₹{((categoryMap['Maintenance'] || 0) + (categoryMap['Service'] || 0)).toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-[#71717A] mt-1">
              Service, oils, periodic checkups & parts
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA]">Tolls, Tax & Insurance</span>
            <div className="p-2.5 rounded-xl bg-[#2e1065] text-[#C084FC]">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-extrabold text-[#C084FC]">
              ₹{((categoryMap['FASTag'] || 0) + (categoryMap['Insurance'] || 0) + (categoryMap['Road Tax'] || 0)).toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-[#71717A] mt-1">
              Compliance & transit statutory dues
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl lg:col-span-2">
          <h3 className="text-base font-bold text-[#F5F5F5] mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#E53935]" />
            Spend Distribution by Category
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3F3F46" opacity={0.4} />
                <XAxis dataKey="name" stroke="#A1A1AA" fontSize={12} tickLine={false} />
                <YAxis stroke="#A1A1AA" fontSize={12} tickLine={false} />
                <Tooltip 
                  formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Amount']}
                  contentStyle={{ backgroundColor: '#111113', borderColor: '#3F3F46', borderRadius: '12px', color: '#F5F5F5' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#18181B] border border-[#3F3F46] shadow-xl flex flex-col items-center justify-center">
          <h3 className="text-base font-bold text-[#F5F5F5] mb-2 self-start flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-[#22C55E]" />
            Cost Ratio
          </h3>
          <div className="w-full h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`slice-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Amount']} 
                  contentStyle={{ backgroundColor: '#111113', borderColor: '#3F3F46', borderRadius: '12px', color: '#F5F5F5' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 w-full mt-2 text-xs">
            {chartData.slice(0, 6).map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="text-[#A1A1AA] truncate">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Expense Ledger Table */}
      <div className="rounded-2xl overflow-hidden bg-[#18181B] border border-[#3F3F46] shadow-xl">
        <div className="p-5 border-b border-[#3F3F46] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
              <input
                type="text"
                placeholder="Search vehicle, invoice, vendor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] focus:outline-none focus:border-[#E53935]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#71717A]" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-sm bg-[#111113] border border-[#3F3F46] rounded-xl px-3 py-2 text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
              >
                <option value="ALL">All Categories</option>
                <option value="Fuel">Fuel</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Service">Service</option>
                <option value="FASTag">FASTag</option>
                <option value="Challan">Challan</option>
                <option value="Insurance">Insurance</option>
                <option value="Road Tax">Road Tax</option>
                <option value="Driver Salary">Driver Salary</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="text-xs text-[#71717A] font-medium">
            Showing {filteredExpenses.length} of {expenses.length} records
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#27272A] text-[#F5F5F5] text-xs uppercase font-semibold border-b border-[#3F3F46]">
              <tr>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Vehicle</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5">Vendor / Bill Ref</th>
                <th className="px-6 py-3.5">Payment Mode</th>
                <th className="px-6 py-3.5">Notes</th>
                <th className="px-6 py-3.5 text-right">Amount</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3F3F46]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[#A1A1AA]">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#E53935]" />
                    Loading financial records...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[#71717A]">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-[#71717A] opacity-50" />
                    No expense records found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((record) => (
                  <tr key={record.id} className="hover:bg-[#202024] transition-colors">
                    <td className="px-6 py-4 font-medium text-[#F5F5F5]">
                      {record.date}
                    </td>
                    <td className="px-6 py-4">
                      {record.registration_number ? (
                        <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-[#111113] text-[#F5F5F5] border border-[#3F3F46]">
                          {record.registration_number}
                        </span>
                      ) : (
                        <span className="text-xs text-[#71717A]">Fleet Wide</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span 
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: `${CATEGORY_COLORS[record.category] || '#A1A1AA'}20`,
                          color: CATEGORY_COLORS[record.category] || '#D4D4D8'
                        }}
                      >
                        {record.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#D4D4D8]">
                      <div className="font-medium text-[#F5F5F5]">{record.vendor_name || '—'}</div>
                      {record.invoice_ref && <div className="text-xs text-[#71717A]">Ref: {record.invoice_ref}</div>}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-[#A1A1AA]">
                      {record.payment_mode || 'Cash'}
                    </td>
                    <td className="px-6 py-4 text-xs text-[#71717A] max-w-xs truncate">
                      {record.notes || '—'}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-[#E53935]">
                      ₹{Number(record.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setDeletingExpense(record)}
                        className="p-1.5 text-[#71717A] hover:text-[#FF1744] hover:bg-[#3F1111] rounded-lg transition cursor-pointer"
                        title="Delete Expense"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#18181B] rounded-2xl max-w-lg w-full p-6 border border-[#3F3F46] shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#3F3F46]">
              <h3 className="text-lg font-bold text-[#F5F5F5] flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#E53935]" />
                Record Fleet Expense
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-[#71717A] hover:text-[#F5F5F5] hover:bg-[#27272A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#A1A1AA] mb-1">Vehicle</label>
                  <select
                    value={formData.vehicle_id}
                    onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                  >
                    <option value="">General Fleet Expense</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.vehicle_number} ({v.make} {v.model})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#A1A1AA] mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-sm bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                  >
                    <option value="Fuel">Fuel</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Service">Service</option>
                    <option value="FASTag">FASTag</option>
                    <option value="Challan">Challan</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Road Tax">Road Tax</option>
                    <option value="Driver Salary">Driver Salary</option>
                    <option value="Tyre / Battery">Tyre / Battery</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#A1A1AA] mb-1">Amount (INR) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 4500"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#A1A1AA] mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#A1A1AA] mb-1">Payment Mode</label>
                  <select
                    value={formData.payment_mode}
                    onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] focus:outline-none focus:border-[#E53935]"
                  >
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Credit Card">Corporate Credit Card</option>
                    <option value="Net Banking">Net Banking / NEFT</option>
                    <option value="Fuel Card">Fuel Smart Card</option>
                    <option value="Cash">Cash Voucher</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#A1A1AA] mb-1">Invoice / Bill Ref</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-99218"
                    value={formData.invoice_ref}
                    onChange={(e) => setFormData({ ...formData, invoice_ref: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] focus:outline-none focus:border-[#E53935]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A1A1AA] mb-1">Vendor / Fuel Pump / Garage</label>
                <input
                  type="text"
                  placeholder="e.g. Indian Oil Corporation, Highway Plaza"
                  value={formData.vendor_name}
                  onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] focus:outline-none focus:border-[#E53935]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A1A1AA] mb-1">Notes & Description</label>
                <textarea
                  rows={2}
                  placeholder="Additional remarks or purpose..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] placeholder-[#71717A] focus:outline-none focus:border-[#E53935]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#3F3F46]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-[#A1A1AA] hover:text-[#F5F5F5] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] text-sm font-semibold shadow-lg shadow-[#E53935]/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Expense Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingExpense}
        title="Delete Expense Record"
        itemName={deletingExpense ? `${deletingExpense.category} - ₹${deletingExpense.amount}` : undefined}
        itemDetails={deletingExpense ? `Date: ${deletingExpense.date} • ${deletingExpense.registration_number || 'Fleet Wide'} • ${deletingExpense.vendor_name || ''}` : undefined}
        isLoading={isDeleting}
        onConfirm={handleDeleteExpense}
        onCancel={() => setDeletingExpense(null)}
      />
    </div>
  );
};
