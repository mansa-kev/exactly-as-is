import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { 
  Search, 
  Car, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  ArrowUpRight, 
  Filter, 
  MoreHorizontal, 
  Eye,
  BarChart3,
  Loader2,
  ChevronDown
} from 'lucide-react';

// --- Types ---

interface CarEarning {
  id: string;
  model: string;
  plateNumber: string;
  ownerName: string;
  totalEarnings: number;
  totalMaintenance: number;
  avgDailyEarnings: number;
  utilizationRate: number;
  tripsCount: number;
  lastTripDate: string;
  payoutStatus: 'paid' | 'pending' | 'processing';
}

// --- Components ---

export function AdminCarEarnings() {
  const [earnings, setEarnings] = useState<CarEarning[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCar, setSelectedCar] = useState<CarEarning | null>(null);
  
  // Mobile expandable row state
  const [isMobile, setIsMobile] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const fetchEarnings = async () => {
    setLoading(true);
    try {
      const [earningsData, statsData] = await Promise.all([
        adminService.getCarEarnings(),
        adminService.getCarEarningsStats()
      ]);
      
      const formatted: CarEarning[] = (earningsData || []).map((c: any) => ({
        id: c.id,
        model: `${c.make} ${c.model}`,
        plateNumber: c.license_plate,
        ownerName: c.fleet_owner?.full_name || 'Individual',
        totalEarnings: c.totalEarnings || 0,
        totalMaintenance: c.totalMaintenance || 0,
        avgDailyEarnings: c.avgDailyEarnings || 0,
        utilizationRate: c.utilizationRate || 0,
        tripsCount: c.tripsCount || 0,
        lastTripDate: c.lastTripDate || 'N/A',
        payoutStatus: 'paid'
      }));
      setEarnings(formatted);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch car earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, []);

  // Mobile detection with resize listener
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const filteredEarnings = earnings.filter(e => 
    e.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.plateNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.ownerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && earnings.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Highest Earner</p>
              <p className="text-lg font-bold">{stats?.highestEarner || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">Ksh {stats?.highestEarnings?.toLocaleString() || 0}</span>
            <span className="text-xs font-bold text-success flex items-center gap-1">
              <ArrowUpRight size={14} /> {stats?.highestEarnerTrend || 0}%
            </span>
          </div>
        </div>

        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
              <BarChart3 size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Avg. Utilization</p>
              <p className="text-lg font-bold">{stats?.avgUtilization || 0}% Platform Wide</p>
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-blue-500" style={{ width: `${stats?.avgUtilization || 0}%` }} />
          </div>
        </div>

        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-warning/10 text-warning rounded-xl">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Avg. Daily Earning</p>
              <p className="text-lg font-bold">Ksh {stats?.avgDailyEarning || 0} / Car</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">Ksh {stats?.avgDailyEarning || 0}</span>
            <span className="text-xs font-bold text-success flex items-center gap-1">
              <ArrowUpRight size={14} /> {stats?.avgDailyEarningTrend || 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Search & List */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="font-bold text-lg">Car Performance & Earnings</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input 
                type="text" 
                placeholder="Search cars..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-muted border-none rounded-xl text-xs w-64 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <button 
              onClick={() => {
                // Implement filter logic here
                alert('Filter functionality coming soon');
              }}
              className="p-2 bg-muted hover:bg-muted/80 rounded-xl transition-colors"
            >
              <Filter size={18} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Table - Desktop View */}
        {!isMobile && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Car Details</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Fleet Owner</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Utilization</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Trips</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Revenue</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Avg Daily</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEarnings.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all">
                          <Car size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground leading-none">{item.model}</p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">{item.plateNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium">{item.ownerName}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[100px]">
                          <div 
                            className={`h-full rounded-full ${item.utilizationRate > 70 ? 'bg-success' : item.utilizationRate > 40 ? 'bg-warning' : 'bg-error'}`} 
                            style={{ width: `${item.utilizationRate}%` }} 
                          />
                        </div>
                        <span className="text-sm font-bold">{item.utilizationRate}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium">{item.tripsCount}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-foreground">Ksh {item.totalEarnings.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium">Ksh {item.avgDailyEarnings.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setSelectedCar(item)}
                          className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors" 
                          title="View Performance"
                        >
                          <BarChart3 size={18} />
                        </button>
                        <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors" title="View Details">
                          <Eye size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile Expandable Rows */}
        {isMobile && (
          <div className="space-y-2">
            {filteredEarnings.map((item) => (
              <div key={item.id}>
                {/* Summary Row */}
                <div 
                  className="flex justify-between items-center px-4 py-3 bg-card border border-border rounded-xl cursor-pointer select-none hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedRowId(expandedRowId === item.id ? null : item.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Car size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold truncate max-w-[150px]">{item.model}</p>
                      <p className="text-xs text-muted-foreground">{item.plateNumber}</p>
                    </div>
                  </div>
                  <ChevronDown 
                    size={16} 
                    className={`transition-transform duration-200 ${expandedRowId === item.id ? 'rotate-180' : ''}`}
                  />
                </div>

                {/* Expanded Card */}
                {expandedRowId === item.id && (
                  <div className="bg-card border border-border rounded-xl p-4 mb-3 max-h-[65vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Car ID</span>
                        <p className="text-sm text-white font-medium break-all">{item.id}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Model</span>
                        <p className="text-sm text-white font-medium">{item.model}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Plate Number</span>
                        <p className="text-sm text-white font-medium">{item.plateNumber}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Fleet Owner</span>
                        <p className="text-sm text-white font-medium">{item.ownerName}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Utilization Rate</span>
                        <div className="mt-1">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${item.utilizationRate > 70 ? 'bg-success' : item.utilizationRate > 40 ? 'bg-warning' : 'bg-error'}`} 
                                style={{ width: `${item.utilizationRate}%` }} 
                              />
                            </div>
                            <span className="text-sm text-white font-medium">{item.utilizationRate}%</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Total Trips</span>
                        <p className="text-sm text-white font-medium">{item.tripsCount}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Total Revenue</span>
                        <p className="text-sm text-white font-medium">Ksh {item.totalEarnings.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Avg Daily Earnings</span>
                        <p className="text-sm text-white font-medium">Ksh {item.avgDailyEarnings.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Last Trip Date</span>
                        <p className="text-sm text-white font-medium">{item.lastTripDate}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Payout Status</span>
                        <p className="text-sm text-white font-medium capitalize">{item.payoutStatus}</p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border">
                      <button 
                        onClick={() => setSelectedCar(item)}
                        className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-2"
                      >
                        <BarChart3 size={12} />
                        Performance
                      </button>
                      <button className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-bold hover:bg-muted/80 transition-colors flex items-center gap-2">
                        <Eye size={12} />
                        Details
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedCar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-2xl p-6">
            <h3 className="font-bold text-lg mb-4">{selectedCar.model} - Earnings Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-xl">
                <p className="text-xs font-bold text-muted-foreground">Total Revenue</p>
                <p className="text-xl font-bold">Ksh {selectedCar.totalEarnings.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-muted rounded-xl">
                <p className="text-xs font-bold text-muted-foreground">Maintenance Costs</p>
                <p className="text-xl font-bold">Ksh {selectedCar.totalMaintenance.toLocaleString()}</p>
              </div>
            </div>
            <button 
              onClick={() => setSelectedCar(null)}
              className="mt-6 w-full py-2 bg-primary text-primary-foreground rounded-xl font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
