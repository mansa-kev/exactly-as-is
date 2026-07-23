import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import { TrendingUp, Users, Car, LayoutGrid, Handshake, Building2, GitBranch, Search, Loader2, PieChart, Activity, CreditCard } from 'lucide-react';
import { FleetOwnerPortfolio } from './reports/FleetOwnerPortfolio';
import { OutsourcedPartnerLedger } from './reports/OutsourcedPartnerLedger';
import { BookingFunnel } from './reports/BookingFunnel';
import { CustomQuery } from './reports/CustomQuery';
import { RevenueMix } from './reports/RevenueMix';
import { UtilizationHeatmap } from './reports/UtilizationHeatmap';
import { PaymentHealth } from './reports/PaymentHealth';

type TabId = 'overview' | 'fleet-owners' | 'outsourced' | 'revenue-mix' | 'heatmap' | 'payments' | 'funnel' | 'custom';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ size?: number | string }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'fleet-owners', label: 'Fleet Owners', icon: Building2 },
  { id: 'outsourced', label: 'Outsourced Partners', icon: Handshake },
  { id: 'revenue-mix', label: 'Revenue Mix', icon: PieChart },
  { id: 'heatmap', label: 'Utilization Heatmap', icon: Activity },
  { id: 'payments', label: 'Payment Health', icon: CreditCard },
  { id: 'funnel', label: 'Booking Funnel', icon: GitBranch },
  { id: 'custom', label: 'Custom Query', icon: Search },
];

function Overview() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await adminService.getReportStats();
        if (!cancelled) setStats(s);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Reports Overview</h2>
        <p className="text-sm text-muted-foreground">High-level platform health. Drill into a tab above for detail.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl"><TrendingUp size={20} /></div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Platform Growth</h3>
          </div>
          <p className="text-2xl font-bold">+{stats?.platformGrowth || 0}% <span className="text-xs text-success font-bold">vs last month</span></p>
        </div>
        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl"><Users size={20} /></div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Active Users</h3>
          </div>
          <p className="text-2xl font-bold">{stats?.activeUsers?.toLocaleString() || 0} <span className="text-xs text-success font-bold">+{stats?.newUsers || 0} new</span></p>
        </div>
        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-warning/10 text-warning rounded-xl"><Car size={20} /></div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Fleet Health</h3>
          </div>
          <p className="text-2xl font-bold">{stats?.fleetHealth || 0}% <span className="text-xs text-success font-bold">Operational</span></p>
        </div>
      </div>

      <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
        <h3 className="font-bold text-sm mb-3">Available Report Modules</h3>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li>· <span className="text-foreground font-medium">Fleet Owners</span> — per-owner utilization, gross, commission, payouts, dormant owners.</li>
          <li>· <span className="text-foreground font-medium">Outsourced Partners</span> — partner-level revenue share, settlement aging, outstanding balance.</li>
          <li>· <span className="text-foreground font-medium">Booking Funnel</span> — reservation → paid → pickup → completed conversion.</li>
          <li>· <span className="text-foreground font-medium">Custom Query</span> — ad-hoc exports (CSV / JSON) across bookings, cars, users, payments, expenses.</li>
        </ul>
        <p className="text-xs text-muted-foreground mt-4">More modules (revenue mix, utilization heatmap, payment health, customer cohorts, marketing attribution) roll out in the next phase.</p>
      </div>
    </div>
  );
}

export function AdminReports() {
  const [tab, setTab] = useState<TabId>('overview');

  return (
    <div className="space-y-6">
      {/* Sticky sub-nav — pins under the app header while the reports scroll */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="animate-in fade-in duration-150">
        {tab === 'overview' && <Overview />}
        {tab === 'fleet-owners' && <FleetOwnerPortfolio />}
        {tab === 'outsourced' && <OutsourcedPartnerLedger />}
        {tab === 'revenue-mix' && <RevenueMix />}
        {tab === 'heatmap' && <UtilizationHeatmap />}
        {tab === 'payments' && <PaymentHealth />}
        {tab === 'funnel' && <BookingFunnel />}
        {tab === 'custom' && <CustomQuery />}
      </div>
    </div>
  );
}

export default AdminReports;
