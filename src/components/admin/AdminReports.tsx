// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { 
  BarChart3, 
  FileText, 
  Download, 
  Calendar, 
  Filter, 
  Search, 
  TrendingUp, 
  Users, 
  Car, 
  DollarSign,
  ChevronRight,
  ArrowUpRight,
  Loader2,
  RefreshCw
} from 'lucide-react';

// --- Types ---

interface ReportItem {
  id: string;
  title: string;
  category: string;
  lastGenerated: string;
  status: 'ready' | 'generating' | 'failed';
  file_url?: string;
}

// --- Components ---

export function AdminReports() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'all' | 'financial' | 'operational' | 'user'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [reportsData, statsData] = await Promise.all([
        adminService.getReports(),
        adminService.getReportStats()
      ]);
      
      const formattedReports: ReportItem[] = (reportsData || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        lastGenerated: new Date(r.created_at).toLocaleDateString(),
        status: r.status as any,
        file_url: r.file_url
      }));
      setReports(formattedReports);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleGenerateReport = async (title: string, category: string) => {
    try {
      // Simulate saving to report history
      await adminService.generateReport({ title, category });
      fetchReports();

      // Actually generate CSV for the user
      const { data, error } = await adminService.getFinancials(); // Assuming it fetches some transactions or we can just fetch bookings directly
      
      const { supabase } = await import('../../lib/supabase');
      const { data: bookings } = await supabase.from('bookings').select('*, cars(make, model), user_profiles(full_name)').limit(500);

      if (!bookings || bookings.length === 0) {
        alert('No data to export for this report');
        return;
      }

      const headers = ['Booking ID', 'Car', 'Client', 'Start Date', 'End Date', 'Status', 'Total Amount', 'Payment Status'];
      const rows = bookings.map((b: any) => [
        b.id,
        `${b.cars?.make || ''} ${b.cars?.model || ''}`,
        b.user_profiles?.full_name || 'N/A',
        new Date(b.start_date).toLocaleDateString(),
        new Date(b.end_date).toLocaleDateString(),
        b.status,
        b.total_amount,
        b.payment_status
      ]);

      const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Failed to generate report', error);
      alert('Failed to generate report');
    }
  };

  const filteredReports = reports.filter(r => {
    const matchesCategory = activeCategory === 'all' || r.category === activeCategory;
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading && reports.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <TrendingUp size={24} />
            </div>
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Platform Growth</h3>
          </div>
          <p className="text-2xl font-bold">+{stats?.platformGrowth || 0}% <span className="text-xs text-success font-bold">vs last month</span></p>
        </div>
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
              <Users size={24} />
            </div>
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Active Users</h3>
          </div>
          <p className="text-2xl font-bold">{stats?.activeUsers?.toLocaleString() || 0} <span className="text-xs text-success font-bold">+{stats?.newUsers || 0} new</span></p>
        </div>
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-warning/10 text-warning rounded-xl">
              <Car size={24} />
            </div>
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Fleet Health</h3>
          </div>
          <p className="text-2xl font-bold">{stats?.fleetHealth || 0}% <span className="text-xs text-success font-bold">Operational</span></p>
        </div>
      </div>

      {/* Report Generator Section */}
      <div className="bg-card p-8 rounded-2xl border border-border shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <h3 className="font-bold text-lg">Report Center</h3>
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <input 
                type="text" 
                placeholder="Search reports..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <button 
              onClick={() => handleGenerateReport('New Custom Report', 'operational')}
              className="flex items-center justify-center gap-2 px-6 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-primary/20"
            >
              <FileText size={18} /> Generate New Report
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          {['all', 'financial', 'operational', 'user'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat as any)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeCategory === cat 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {cat ? (cat.charAt(0).toUpperCase() + cat.slice(1)) : ''} Reports
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((report) => (
            <div key={report.id} className="bg-muted/30 p-6 rounded-2xl border border-border hover:border-primary/50 transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div className={`p-3 rounded-xl ${
                  report.category === 'financial' ? 'bg-success/10 text-success' : 
                  report.category === 'operational' ? 'bg-blue-500/10 text-blue-500' : 
                  'bg-primary/10 text-primary'
                }`}>
                  <BarChart3 size={24} />
                </div>
                {report.status === 'generating' && (
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-warning animate-pulse">
                    <div className="w-2 h-2 bg-warning rounded-full" /> Generating
                  </div>
                )}
              </div>
              <h4 className="font-bold text-foreground mb-1">{report.title}</h4>
              <p className="text-xs text-muted-foreground mb-6">Last generated: {report.lastGenerated}</p>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => report.file_url && window.open(report.file_url)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-card hover:bg-primary/10 hover:text-primary border border-border rounded-xl text-xs font-bold transition-all disabled:opacity-50" 
                  disabled={report.status !== 'ready'}
                >
                  <Download size={14} /> Download
                </button>
                <button className="p-2 bg-card hover:bg-muted border border-border rounded-xl transition-colors">
                  <ChevronRight size={18} className="text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Query Section */}
      <div className="bg-card p-8 rounded-2xl border border-border shadow-sm border-l-4 border-l-primary">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <Search size={24} />
          </div>
          <div>
            <h3 className="font-bold text-lg">Custom Data Query</h3>
            <p className="text-sm text-muted-foreground">Build custom reports by selecting specific parameters and date ranges.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Data Source</label>
            <select className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all">
              <option>Bookings</option>
              <option>Fleet Performance</option>
              <option>User Activity</option>
              <option>Financial Transactions</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date Range</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input type="text" placeholder="Select range" className="w-full pl-10 pr-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Format</label>
            <select className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all">
              <option>PDF Document</option>
              <option>CSV Spreadsheet</option>
              <option>JSON Data</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full py-2 bg-primary text-white rounded-xl font-bold text-sm hover:scale-[1.02] transition-transform shadow-lg shadow-primary/20">
              Run Query
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}