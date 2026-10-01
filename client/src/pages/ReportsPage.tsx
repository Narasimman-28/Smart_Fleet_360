import React, { useState } from 'react';
import { 
  BarChart3, Download, Filter, RefreshCw, FileText 
} from 'lucide-react';
import { api } from '../services/api';

export const ReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState('vehicles');
  const [vehicleType, setVehicleType] = useState('ALL');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await api.generateReport({
        report_type: reportType,
        vehicle_type: vehicleType !== 'ALL' ? vehicleType : undefined
      });
      setReportData(res);
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!reportData?.data || reportData.data.length === 0) return;
    const keys = Object.keys(reportData.data[0]);
    const rows = reportData.data.map((row: any) => keys.map(k => `"${row[k] !== undefined && row[k] !== null ? row[k] : ''}"`));
    const csvContent = 'data:text/csv;charset=utf-8,' + [keys.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SmartFleet_${reportType}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-[#E53935]" />
            Fleet Operational Reports & Analytics
          </h1>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Query live operational records across all 12 transport domains with instant CSV data export
          </p>
        </div>

        {reportData && reportData.data && reportData.data.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] border border-[#3F3F46] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#A1A1AA]" />
            <span>Export CSV</span>
          </button>
        )}
      </div>

      {/* Report Configuration Controls */}
      <div className="p-6 bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-[#F5F5F5] flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#E53935]" />
          Select Operational Domain & Filter
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#A1A1AA] mb-1">Report Domain *</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:outline-none focus:border-[#E53935]"
            >
              <option value="vehicles">1. Fleet Vehicles Directory & Telematics</option>
              <option value="compliance">2. Master Compliance & Expiry Audit</option>
              <option value="insurance">3. Insurance Policies & Coverage</option>
              <option value="puc">4. Pollution Under Control (PUC) Records</option>
              <option value="fitness">5. Commercial Fitness Certificates</option>
              <option value="permits">6. Transport Route Permits</option>
              <option value="fastag">7. FASTag Electronic Toll Collection</option>
              <option value="fuel">8. Fuel Refill & Mileage Economy (KM/L)</option>
              <option value="maintenance">9. Workshop Maintenance & Service History</option>
              <option value="bookings">10. Trip Bookings & Dispatch Revenue</option>
              <option value="challans">11. Traffic Police Challans & Penalties</option>
              <option value="expenses">12. Vehicle Operating Expenses & Cost Ledger</option>
              <option value="notifications">13. Automated Alerts & Condition Notifications</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#A1A1AA] mb-1">Vehicle Category</label>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="w-full px-3 py-2 bg-[#111113] border border-[#3F3F46] rounded-xl text-[#F5F5F5] text-xs focus:outline-none focus:border-[#E53935]"
            >
              <option value="ALL">All Categories</option>
              <option value="Car">Car</option>
              <option value="Bus">Bus</option>
              <option value="Heavy Commercial">Heavy Commercial</option>
              <option value="Light Commercial">Light Commercial</option>
              <option value="School Bus">School Bus</option>
              <option value="Tourist Vehicle">Tourist Vehicle</option>
              <option value="Emergency Vehicle">Emergency Vehicle</option>
              <option value="Construction Vehicle">Construction Vehicle</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-lg shadow-[#E53935]/20 cursor-pointer disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              <span>{loading ? 'Querying Database...' : 'Run Report Query'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Generated Report View */}
      {reportData && (
        <div className="space-y-4">
          <div className="p-4 bg-[#18181B] border border-[#3F3F46] rounded-xl flex items-center justify-between text-xs">
            <div>
              <h2 className="font-bold text-[#F5F5F5] text-sm">{reportData.title}</h2>
              <p className="text-[#A1A1AA] mt-0.5">Generated on {new Date(reportData.generatedAt).toLocaleString()}</p>
            </div>
            <div className="font-mono text-[#E53935] font-bold">
              {reportData.data?.length || 0} Records Found in Database
            </div>
          </div>

          {reportData.data?.length === 0 ? (
            <div className="py-16 text-center space-y-2 bg-[#18181B] border border-[#3F3F46] rounded-2xl p-6">
              <FileText className="w-10 h-10 text-[#71717A] mx-auto" />
              <h4 className="text-sm font-bold text-[#F5F5F5]">No data available for this report.</h4>
              <p className="text-xs text-[#A1A1AA]">
                The database returned 0 rows for the selected domain and filter parameters.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#18181B] border border-[#3F3F46] overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#F5F5F5]">
                  <thead className="bg-[#27272A] text-[#F5F5F5] text-[11px] uppercase tracking-wider border-b border-[#3F3F46]">
                    <tr>
                      {Object.keys(reportData.data[0]).map((col, i) => (
                        <th key={i} className="p-3.5 whitespace-nowrap">{col.replace(/_/g, ' ')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3F3F46] font-mono">
                    {reportData.data.map((row: any, rIdx: number) => (
                      <tr key={rIdx} className="hover:bg-[#202024]">
                        {Object.values(row).map((val: any, cIdx: number) => (
                          <td key={cIdx} className="p-3.5 whitespace-nowrap text-[#D4D4D8]">
                            {val !== null && val !== undefined ? String(val) : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
