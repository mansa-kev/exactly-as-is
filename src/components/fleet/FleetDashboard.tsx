// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { fleetService } from '../../services/fleetService';
import { supabase } from '../../lib/supabase';
import { Car, Calendar, Wrench, TrendingUp, DollarSign, CreditCard, Clock, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';

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

const ChartPlaceholder = ({ height = 'h-72' }: { height?: string }) => (
  <div className={`${height} w-full rounded-2xl bg-muted/60 animate-pulse`} />
);

export function FleetDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showHeavyVisuals, setShowHeavyVisuals] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const emptyStats = {
        totalCars: 0, activeBookings: 0, maintenanceCars: 0, utilizationRate: 0,
        totalEarnings: 0, netPayouts: 0, pendingPayouts: 0, totalBookings30Days: 0,
        avgBookingDuration: 0, monthlyEarningsTrend: [], bookingsByDay: [],
        topCar: null, underperformingCar: null
      };

      try {
        setShowHeavyVisuals(false);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const data = await fleetService.getDashboardStats(user.id);
          setStats(data);
        } else {
          // Fallback to empty state so the UI still renders for preview purposes
          setStats(emptyStats);
        }
      } catch (err: any) {
        console.error("Error fetching dashboard stats:", err);
        // Fallback to empty state on error so UI still renders
        setStats(emptyStats);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!stats) return;
    return scheduleIdle(() => setShowHeavyVisuals(true));
  }, [stats]);

  if (loading) return <div className="p-8 animate-pulse">Loading dashboard...</div>;
  if (!stats) return <div className="p-8">No data available.</div>;

  const cards = [
    { title: 'Total Cars', value: stats.totalCars, icon: Car, color: 'text-primary' },
    { title: 'Active Bookings', value: stats.activeBookings, icon: Calendar, color: 'text-success' },
    { title: 'Cars in Maintenance', value: stats.maintenanceCars, icon: Wrench, color: 'text-warning' },
    { title: 'Avg. Utilization', value: `${stats.utilizationRate}%`, icon: TrendingUp, color: 'text-primary' },
  ];

  const financialCards = [
    { title: 'Total Revenue Earned', value: `Ksh ${stats.totalEarnings.toLocaleString()}`, icon: DollarSign, color: 'text-primary', onClick: () => navigate('/fleet/financials') },
    { title: 'Net Payouts Received', value: `Ksh ${stats.netPayouts.toLocaleString()}`, icon: CreditCard, color: 'text-success', onClick: () => navigate('/fleet/financials') },
    { title: 'Pending Payouts', value: `Ksh ${stats.pendingPayouts.toLocaleString()}`, icon: Clock, color: 'text-warning', onClick: () => navigate('/fleet/financials') },
  ];

  const bookingInsights = [
    { title: 'Total Bookings (30d)', value: stats.totalBookings30Days, icon: Activity, color: 'text-primary' },
    { title: 'Avg. Booking Duration', value: `${stats.avgBookingDuration} days`, icon: Clock, color: 'text-success' },
  ];

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Strategic Dashboard</h2>
      
      {/* Fleet Performance Summary */}
      <section>
        <h3 className="text-xl font-bold mb-4">Fleet Performance Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card, i) => (
            <div key={i} className="bg-card p-6 rounded-2xl border border-border shadow-sm">
              <div className={`mb-4 ${card.color}`}>
                <card.icon size={24} />
              </div>
              <h3 className="text-muted-foreground text-sm font-bold uppercase tracking-wider">{card.title}</h3>
              <p className="text-3xl font-bold mt-2">{card.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Financial Overview */}
      <section>
        <h3 className="text-xl font-bold mb-4">Financial Overview (Owner's Share)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {financialCards.map((card, i) => (
            <div 
              key={i} 
              className="bg-card p-6 rounded-2xl border border-border shadow-sm cursor-pointer hover:border-primary transition-colors"
              onClick={card.onClick}
            >
              <div className={`mb-4 ${card.color}`}>
                <card.icon size={24} />
              </div>
              <h3 className="text-muted-foreground text-sm font-bold uppercase tracking-wider">{card.title}</h3>
              <p className="text-2xl font-bold mt-2">{card.value}</p>
            </div>
          ))}
        </div>
        
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="text-muted-foreground text-sm font-bold uppercase tracking-wider mb-6">Monthly Earnings Trend</h3>
          <div className="h-72">
            {showHeavyVisuals ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={300}>
                <LineChart data={stats.monthlyEarningsTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `Ksh ${value}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--foreground)' }}
                    formatter={(value) => [`Ksh ${Number(value).toLocaleString()}`, 'Earnings']}
                  />
                  <Line type="monotone" dataKey="earnings" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--primary)' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ChartPlaceholder />
            )}
          </div>
        </div>
      </section>

      {/* Booking Insights & Car Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h3 className="text-xl font-bold mb-4">Booking Insights</h3>
          <div className="grid grid-cols-2 gap-6 mb-6">
            {bookingInsights.map((card, i) => (
              <div key={i} className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                <div className={`mb-4 ${card.color}`}>
                  <card.icon size={24} />
                </div>
                <h3 className="text-muted-foreground text-sm font-bold uppercase tracking-wider">{card.title}</h3>
                <p className="text-2xl font-bold mt-2">{card.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <h3 className="text-muted-foreground text-sm font-bold uppercase tracking-wider mb-6">Days with Most Bookings</h3>
            <div className="h-64">
              {showHeavyVisuals ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={300}>
                  <BarChart data={stats.bookingsByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip 
                      cursor={{ fill: 'var(--muted)' }}
                      contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                    />
                    <Bar dataKey="bookings" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartPlaceholder height="h-64" />
              )}
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xl font-bold mb-4">Car Performance Snapshot</h3>
          <div className="space-y-6">
            <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-success/10 text-success rounded-xl">
                  <ArrowUpRight size={24} />
                </div>
                <span className="text-success font-bold text-sm bg-success/10 px-3 py-1 rounded-full">Top Performer</span>
              </div>
              <h3 className="text-muted-foreground text-sm font-bold uppercase tracking-wider">Highest Revenue Car</h3>
              {stats.topCar ? (
                <>
                  <p className="text-2xl font-bold mt-2">{stats.topCar.name}</p>
                  <p className="text-muted-foreground mt-1">Ksh {stats.topCar.revenue.toLocaleString()} earned</p>
                </>
              ) : (
                <p className="text-muted-foreground mt-2">No data yet</p>
              )}
            </div>

            <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-error/10 text-error rounded-xl">
                  <ArrowDownRight size={24} />
                </div>
                <span className="text-error font-bold text-sm bg-error/10 px-3 py-1 rounded-full">Needs Attention</span>
              </div>
              <h3 className="text-muted-foreground text-sm font-bold uppercase tracking-wider">Underperforming Car</h3>
              {stats.underperformingCar ? (
                <>
                  <p className="text-2xl font-bold mt-2">{stats.underperformingCar.name}</p>
                  <p className="text-muted-foreground mt-1">Ksh {stats.underperformingCar.revenue.toLocaleString()} earned</p>
                </>
              ) : (
                <p className="text-muted-foreground mt-2">No data yet</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}