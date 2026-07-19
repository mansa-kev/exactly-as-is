import React, { useEffect, useMemo, useState } from 'react';
import { fleetService } from '../../services/fleetService';
import { supabase } from '../../lib/supabase';
import {
  Activity, AlertCircle, Car as CarIcon, DollarSign, Download,
  Loader2, TrendingUp, TrendingDown, Wrench,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const RANGES = [
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '6 months', value: 180 },
  { label: '12 months', value: 365 },
];
const fmt = (n: number) => new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export function FleetReports() {
  const [range, setRange] = useState(90);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const r = await fleetService.getFleetReport(user.id, range);
      if (!cancelled) {
        setReport(r);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const totals = report?.totals;

  const exportCsv = () => {
    if (!report) return;
    const rows: string[] = ['Section,Field,Value'];
    Object.entries(totals).forEach(([k, v]) => rows.push(`Totals,${k},${v}`));
    rows.push('', 'Car,Plate,Trips,Booked Days,Utilization %,Revenue,Expenses,Net');
    report.perCar.forEach((c: any) =>
      rows.push(`"${c.label}",${c.license_plate},${c.trips},${c.bookedDays},${c.utilization},${c.revenue},${c.expenses},${c.net}`),
    );
    rows.push('', 'Month,Revenue,Expenses,Payouts,Net');
    report.monthlyPnl.forEach((m: any) => rows.push(`${m.month},${m.revenue},${m.expenses},${m.payouts},${m.revenue - m.expenses}`));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fleet-report-${range}d.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }
  if (!report) return <div className="p-8">No data available.</div>;

  const profitPositive = totals.netProfit >= 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Fleet Reports</h2>
          <p className="text-sm text-muted-foreground">Utilization, idle cars, and monthly P&amp;L.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={range} onChange={(e) => setRange(Number(e.target.value))} className="px-3 py-2 rounded-lg bg-muted text-xs border border-border outline-none focus:ring-2 focus:ring-primary/20">
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Kpi label="Cars" value={fmt(totals.cars)} icon={<CarIcon size={18} />} tone="primary" />
        <Kpi label="Avg Utilization" value={`${totals.avgUtilization}%`} icon={<Activity size={18} />} tone="blue" bar={totals.avgUtilization} />
        <Kpi label="Idle Cars" value={fmt(totals.idleCount)} icon={<AlertCircle size={18} />} tone={totals.idleCount > 0 ? 'warning' : 'muted'} />
        <Kpi label="Revenue" value={`Ksh ${fmt(totals.revenue)}`} icon={<DollarSign size={18} />} tone="success" />
        <Kpi label="Expenses" value={`Ksh ${fmt(totals.expenses)}`} icon={<Wrench size={18} />} tone="error" />
        <Kpi
          label="Net Profit"
          value={`Ksh ${fmt(totals.netProfit)}`}
          icon={profitPositive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          tone={profitPositive ? 'success' : 'error'}
        />
      </div>

      {/* Monthly P&L chart */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-bold text-sm mb-4">Monthly P&amp;L</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={report.monthlyPnl}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => `Ksh ${fmt(Number(v))}`} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="payouts" name="Payouts" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Idle Cars */}
      {report.idleCars.length > 0 && (
        <div className="bg-warning/5 border border-warning/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="text-warning" size={18} />
            <h3 className="font-bold text-sm">Idle Cars ({report.idleCars.length})</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">No paid bookings in the last {range} days.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {report.idleCars.map((c: any) => (
              <div key={c.id} className="bg-card border border-border rounded-xl p-3">
                <p className="text-sm font-bold">{c.label}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.license_plate} · {c.status}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Last booked: {fmtDate(c.lastBookedAt)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Utilization Board */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-bold text-sm">Utilization Board</h3>
          <p className="text-xs text-muted-foreground">Per-car performance in the last {range} days.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="px-4 py-3 uppercase text-[10px] font-bold text-muted-foreground">Car</th>
                <th className="px-4 py-3 uppercase text-[10px] font-bold text-muted-foreground">Utilization</th>
                <th className="px-4 py-3 uppercase text-[10px] font-bold text-muted-foreground">Trips</th>
                <th className="px-4 py-3 uppercase text-[10px] font-bold text-muted-foreground">Booked Days</th>
                <th className="px-4 py-3 uppercase text-[10px] font-bold text-muted-foreground">Revenue</th>
                <th className="px-4 py-3 uppercase text-[10px] font-bold text-muted-foreground">Expenses</th>
                <th className="px-4 py-3 uppercase text-[10px] font-bold text-muted-foreground">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.perCar.map((c: any) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-bold">{c.label}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">{c.license_plate}</p>
                  </td>
                  <td className="px-4 py-3 w-48">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${c.utilization > 70 ? 'bg-success' : c.utilization > 40 ? 'bg-warning' : 'bg-destructive'}`}
                          style={{ width: `${c.utilization}%` }}
                        />
                      </div>
                      <span className="font-bold">{c.utilization}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{c.trips}</td>
                  <td className="px-4 py-3">{c.bookedDays}</td>
                  <td className="px-4 py-3 font-bold">Ksh {fmt(c.revenue)}</td>
                  <td className="px-4 py-3 text-destructive">Ksh {fmt(c.expenses)}</td>
                  <td className={`px-4 py-3 font-bold ${c.net >= 0 ? 'text-success' : 'text-destructive'}`}>Ksh {fmt(c.net)}</td>
                </tr>
              ))}
              {report.perCar.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No cars registered.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon, tone, bar }: { label: string; value: string; icon: React.ReactNode; tone: string; bar?: number }) {
  const map: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    error: 'bg-destructive/10 text-destructive',
    blue: 'bg-blue-500/10 text-blue-500',
    muted: 'bg-muted text-muted-foreground',
  };
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`p-1.5 rounded-lg ${map[tone]}`}>{icon}</span>
      </div>
      <p className="text-base font-bold leading-tight">{value}</p>
      {typeof bar === 'number' && (
        <div className="h-1 bg-muted rounded-full mt-2 overflow-hidden">
          <div className={map[tone].split(' ')[1].replace('text', 'bg')} style={{ width: `${bar}%`, height: '100%' }} />
        </div>
      )}
    </div>
  );
}

export default FleetReports;
