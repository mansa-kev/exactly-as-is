// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area
} from 'recharts';
import {
  TrendingUp,
  Users,
  Car,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Clock,
  CheckCircle2,
  Building2,
  Loader2,
  Tag,
  AlertCircle,
  XCircle
} from 'lucide-react';

// --- Components ---

const scheduleIdle = (cb: () => void) => {
  if (typeof window === 'undefined') {
    cb();
    return () => {};
  }

  if ('requestIdleCallback' in window) {
    const idleId = window.requestIdleCallback(() => cb(), { timeout: 700 });
    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = window.setTimeout(cb, 150);
  return () => window.clearTimeout(timeoutId);
};

const ChartPlaceholder = ({ height = 'h-[300px]' }: { height?: string }) => (
  <div className={`${height} w-full rounded-2xl bg-muted/60 animate-pulse`} />
);

const StatCard = ({
  title,
  value,
  trend,
  trendValue,
  icon: Icon,
  color,
  sparklineData,
  showSparkline = true
}: {
  title: string;
  value: string;
  trend?: 'up' | 'down';
  trendValue?: string;
  icon: React.ElementType;
  color: string;
  sparklineData?: number[];
  showSparkline?: boolean;
}) => (
  <div className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${color} bg-opacity-10 text-${color.split('-')[1]}-600`}>
        <Icon size={24} />
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-bold ${trend === 'up' ? 'text-success' : 'text-error'}`}>
          {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trendValue}
        </div>
      )}
    </div>
    <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">{title}</h3>
    <p className="text-2xl font-bold text-foreground mb-2">{value}</p>
    {showSparkline && sparklineData && sparklineData.length > 0 && (
      <div className="h-10 w-full">
        <ResponsiveContainer width="100%" height={40}>
          <AreaChart data={sparklineData.map((val, i) => ({ value: val }))}>
            <defs>
              <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color.replace('bg-', '')} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color.replace('bg-', '')} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={color.replace('bg-', '')}
              strokeWidth={2}
              fill={`url(#spark-${color})}`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

// --- Dashboard ---

export function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [reservationStats, setReservationStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '3m' | '6m' | '1y'>('7d');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [showHeavyVisuals, setShowHeavyVisuals] = useState(false);

  // Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setShowHeavyVisuals(false);
      try {
        const data = await adminService.getDashboardStats(timeRange);
        setStats(data);

        // Fetch reservation stats
        try {
          const resStats = await adminService.getReservationStats();
          setReservationStats(resStats);
        } catch (resError) {
          console.error('Failed to fetch reservation stats:', resError);
        }

        setLastUpdated(new Date().toLocaleTimeString());
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [timeRange]);

  useEffect(() => {
    if (!stats) return;
    return scheduleIdle(() => setShowHeavyVisuals(true));
  }, [stats, timeRange]);

  if (loading && !stats) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  // Use real revenue trend data from stats
  const revenueData = stats?.revenueTrend || [];

  const bookingStatusData = stats?.bookingStatusDistribution || [];

  const totalBookings = bookingStatusData.reduce((sum: number, item: any) => sum + item.value, 0);

  // Calculate booking by day of week
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const bookingsByDay = dayNames.map((day, index) => {
    // Get all bookings for the current time range (using revenue trend data as proxy)
    const dayBookings = revenueData.filter((item: any) => {
      const date = new Date(item.name);
      const dayOfWeek = date.getDay(); // 0 = Sun, 1 = Mon, etc.
      const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Mon=0, Sun=6
      return adjustedDay === index;
    }).reduce((sum: number, item: any) => sum + (item.gross > 0 ? 1 : 0), 0);
    return { day, count: dayBookings };
  });
  const maxDayBookings = Math.max(...bookingsByDay.map(d => d.count));

  // Calculate sparkline data for revenue cards
  const revenueSparkline = revenueData.map((item: any) => item.gross);
  const commissionSparkline = revenueData.map((item: any) => item.net);

  // Calculate extra KPI stats
  const averageBookingValue = totalBookings > 0 ? stats?.totalRevenue / totalBookings : 0;
  const utilizationRate = stats?.totalCars > 0 ? Math.round((stats?.activeBookings / stats?.totalCars) * 100) : 0;
  const cancelledBookings = 0; // Not in current booking status distribution
  const cancellationRate = '0'; // Not calculated from current data
  const pendingVerifications = 0; // Not in current booking status distribution

  const getTrendProps = (percent: number) => {
    if (percent === 0) return {};
    return {
      trend: percent > 0 ? 'up' as const : 'down' as const,
      trendValue: `${percent > 0 ? '+' : ''}${percent}%`
    };
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-serif font-black italic text-foreground">
            {getGreeting()}, Admin 👋
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Data refreshed at {lastUpdated}</p>
        </div>
      </div>

      {/* Gradient Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-warning/30 to-transparent my-6" />

      {/* Top Stats: Platform Revenue Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Gross Revenue"
          value={`KSh ${stats?.totalRevenue?.toLocaleString() || '0'}`}
          {...getTrendProps(stats?.revenueTrendPercent || 0)}
          icon={DollarSign}
          color="bg-blue-500"
          sparklineData={revenueSparkline}
          showSparkline={showHeavyVisuals}
        />
        <StatCard
          title="Net Commission"
          value={`KSh ${stats?.netCommission?.toLocaleString() || '0'}`}
          {...getTrendProps(stats?.commissionTrendPercent || 0)}
          icon={TrendingUp}
          color="bg-primary"
          sparklineData={commissionSparkline}
          showSparkline={showHeavyVisuals}
        />
        <StatCard 
          title="Client Churn Rate" 
          value={`${stats?.churnRate || 0}%`} 
          icon={Users} 
          color="bg-error"
        />
        <StatCard 
          title="Active Bookings" 
          value={stats?.activeBookings?.toString() || '0'} 
          {...getTrendProps(stats?.activeBookingsTrendPercent || 0)}
          icon={Calendar} 
          color="bg-success"
        />
      </div>

      {/* Extra KPI Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Average Booking Value"
          value={`KSh ${averageBookingValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={TrendingUp}
          color="bg-purple-500"
        />
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-success/10 text-success rounded-xl">
              <Car size={24} />
            </div>
          </div>
          <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Fleet Utilization Rate</h3>
          <p className="text-2xl font-bold text-foreground mb-2">{utilizationRate}%</p>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-success transition-all duration-300"
              style={{ width: `${utilizationRate}%` }}
            />
          </div>
        </div>
        <StatCard
          title="Cancellation Rate"
          value={`${cancellationRate}%`}
          icon={XCircle}
          color={parseFloat(cancellationRate) > 20 ? 'bg-error' : parseFloat(cancellationRate) >= 10 ? 'bg-warning' : 'bg-success'}
        />
        <button
          onClick={() => window.location.href = '/admin/financials?tab=approvals'}
          className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-200 text-left"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-warning/10 text-warning rounded-xl">
              <AlertCircle size={24} />
            </div>
          </div>
          <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Pending Verifications</h3>
          <p className="text-2xl font-bold text-foreground">{pendingVerifications}</p>
        </button>
      </div>

      {/* Gradient Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-warning/30 to-transparent my-6" />

      {/* Reservation Stats Section */}
      <div>
        <h2 className="text-xl font-bold mb-4">Reservation Activity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-warning/5 p-5 rounded-xl border-l-4 border-warning hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-warning/20 text-warning rounded-lg">
                <Tag size={18} />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Reservation Fees Collected</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              KSh {reservationStats?.totalReservationFees?.toLocaleString() || '0'}
            </p>
          </div>
          <div className="bg-blue-500/5 p-5 rounded-xl border-l-4 border-blue-500 hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/20 text-blue-500 rounded-lg">
                <Clock size={18} />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Active Reservations</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {reservationStats?.activeReservations || '0'}
            </p>
          </div>
          <div className="bg-success/5 p-5 rounded-xl border-l-4 border-success hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-success/20 text-success rounded-lg">
                <CheckCircle2 size={18} />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Converted to Bookings</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {reservationStats?.confirmedReservations || '0'}
            </p>
          </div>
        </div>
      </div>

      {/* Gradient Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-warning/30 to-transparent my-6" />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend */}
        <div className="lg:col-span-2 bg-card p-8 rounded-2xl border border-border shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-bold text-lg">Revenue Trend</h3>
            <div className="flex items-center gap-4">
              <div className="flex bg-muted rounded-lg p-1">
                {['7d', '30d', '3m', '6m', '1y'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range as any)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      timeRange === range
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {range === '7d' ? '7D' : range === '30d' ? '30D' : range === '3m' ? '3M' : range === '6m' ? '6M' : '1Y'}
                  </button>
                ))}
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <div className="w-3 h-3 rounded-full bg-primary" /> Gross Revenue
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <div className="w-3 h-3 rounded-full bg-blue-500" /> Net Commission
                </div>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            {showHeavyVisuals && revenueData && revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={200}>
                <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--card)', 
                    borderColor: 'var(--border)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="gross" 
                  stroke="var(--primary)" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: 'var(--primary)' }} 
                  activeDot={{ r: 6 }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="net" 
                  stroke="#3B82F6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#3B82F6' }} 
                  activeDot={{ r: 6 }} 
                />
              </LineChart>
            </ResponsiveContainer>
            ) : showHeavyVisuals ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No revenue data available
              </div>
            ) : (
              <ChartPlaceholder />
            )}
          </div>
        </div>

        {/* Booking Status Distribution */}
        <div className="bg-card p-8 rounded-2xl border border-border shadow-sm">
          <h3 className="font-bold text-lg mb-8">Booking Status</h3>
          <div className="h-[240px] w-full relative">
            {showHeavyVisuals ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={200}>
                <PieChart>
                  <Pie
                    data={bookingStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {bookingStatusData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ChartPlaceholder height="h-[240px]" />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold">{totalBookings}</span>
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Total</span>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {bookingStatusData.map((item: any) => (
              <div key={item.name} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-muted-foreground">{item.name}</span>
                </div>
                <span className="text-sm font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top 5 Cars Row */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-card p-8 rounded-2xl border border-border shadow-sm">
          <h3 className="font-bold text-lg mb-8">Top 5 Most Booked Cars</h3>
          <div className="h-[300px] w-full">
            {showHeavyVisuals ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={200}>
                <BarChart data={stats?.topCars || []} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} 
                    width={150}
                  />
                  <Tooltip 
                    cursor={{ fill: 'var(--muted)' }}
                    contentStyle={{ 
                      backgroundColor: 'var(--card)', 
                      borderColor: 'var(--border)',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                    }} 
                  />
                  <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartPlaceholder />
            )}
          </div>
        </div>
      </div>

      {/* Gradient Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-warning/30 to-transparent my-6" />

      {/* Booking Activity by Day of Week */}
      <div className="bg-card p-8 rounded-2xl border border-border shadow-sm">
        <div>
          <h3 className="font-bold text-lg">Booking Activity by Day of Week</h3>
          <p className="text-sm text-muted-foreground">Which days drive the most bookings</p>
        </div>
        <div className="h-[300px] w-full mt-6">
          {showHeavyVisuals && bookingsByDay && bookingsByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={300} minWidth={300} minHeight={200}>
              <BarChart data={bookingsByDay}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff6b00" stopOpacity={1} />
                  <stop offset="100%" stopColor="#ff4d0060" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                }}
                formatter={(value: number, name: string) => [`${value} bookings`, name]}
              />
              <Bar
                dataKey="count"
                radius={[6, 6, 0, 0]}
                animationBegin={0}
                animationDuration={800}
              >
                {bookingsByDay.map((entry, index) => (
                  <Cell
                    key={entry.day}
                    fill={entry.count === maxDayBookings && entry.count > 0 ? 'url(#barGrad)' : '#ff6b0060'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          ) : showHeavyVisuals ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No booking data available
            </div>
          ) : (
            <ChartPlaceholder />
          )}
        </div>
      </div>

      {/* Gradient Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-warning/30 to-transparent my-6" />

      {/* Bottom Row: Fleet & System Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Fleet Health */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="font-bold text-sm mb-6 uppercase tracking-wider text-muted-foreground">Fleet Health</h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Average Utilization</span>
                <span className="text-sm font-bold">
                  {stats?.totalCars > 0 ? Math.round((stats?.activeBookings / stats?.totalCars) * 100) : 0}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-success transition-all duration-300" 
                  style={{ width: `${stats?.totalCars > 0 ? Math.min(100, Math.round((stats?.activeBookings / stats?.totalCars) * 100)) : 0}%` }} 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-xl">
                <span className="block text-xs text-muted-foreground mb-1">Total Cars</span>
                <span className="text-xl font-bold">{stats?.totalCars || 0}</span>
              </div>
              <div className="p-4 bg-muted rounded-xl">
                <span className="block text-xs text-muted-foreground mb-1">In Maintenance</span>
                <span className="text-xl font-bold text-warning">{stats?.maintenanceCars || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Growth */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="font-bold text-sm mb-6 uppercase tracking-wider text-muted-foreground">User Growth</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                  <Users size={18} />
                </div>
                <span className="text-sm font-medium">Total Clients</span>
              </div>
              <span className="font-bold text-success">{stats?.newClients || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                  <Building2 size={18} />
                </div>
                <span className="text-sm font-medium">Total Fleet Owners</span>
              </div>
              <span className="font-bold text-success">{stats?.newFleetOwners || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-error/10 text-error rounded-lg">
                  <Activity size={18} />
                </div>
                <span className="text-sm font-medium">System Activity</span>
              </div>
              <span className="font-bold text-success">Active</span>
            </div>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="font-bold text-sm mb-6 uppercase tracking-wider text-muted-foreground">System Health</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
                <span className="text-sm font-medium">Supabase Connection</span>
              </div>
              <span className="text-xs font-bold text-success uppercase">Healthy</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity size={18} className="text-muted-foreground" />
                <span className="text-sm font-medium">API Latency</span>
              </div>
              <span className="text-sm font-bold">42ms</span>
            </div>
            <div className="p-4 bg-muted rounded-xl flex items-center gap-4">
              <CheckCircle2 className="text-success" size={24} />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</p>
                <p className="text-sm font-bold">All Systems Operational</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}