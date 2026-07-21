import React, { useEffect, useMemo, useState } from 'react';
import { adminService } from '../../services/adminService';
import {
  X, Loader2, TrendingUp, TrendingDown, Car as CarIcon, DollarSign,
  Wrench, Calendar, Activity, Download, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, BarChart, Bar, Cell,
} from 'recharts';
import { KpiCard, DateRangePicker } from '../shared/reports';

interface Props {
  carId: string;
  onClose: () => void;
}

const EXPENSE_COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6'];

const fmtKsh = (n: number) =>
  new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(Math.round(n || 0));

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

export function CarReportCard({ carId, onClose }: Props) {
  const [range, setRange] = useState(180);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminService.getCarReport(carId, range).then((r) => {
      if (!cancelled) {
        setReport(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [carId, range]);

  const car = report?.car;
  const kpis = report?.kpis;

  const exportCsv = () => {
    if (!report) return;
    const rows: string[] = [];
    rows.push('Section,Field,Value');
    rows.push(`Car,Model,"${car?.make} ${car?.model}"`);
    rows.push(`Car,Plate,${car?.license_plate}`);
    rows.push(`Range,Days,${report.rangeDays}`);
    Object.entries(kpis).forEach(([k, v]) => rows.push(`KPI,${k},${v}`));
    rows.push('');
    rows.push('Month,Revenue,Cost,Trips');
    report.trend.forEach((t: any) => rows.push(`${t.month},${t.revenue},${t.cost},${t.trips}`));
    rows.push('');
    rows.push('Expense Type,Amount');
    report.expenseBreakdown.forEach((e: any) => rows.push(`${e.type},${e.amount}`));

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `car-report-${car?.license_plate || carId}-${range}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const profitPositive = (kpis?.netProfit ?? 0) >= 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl flex-shrink-0">
              <CarIcon size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold truncate">
                {loading ? 'Loading…' : `${car?.make} ${car?.model}`}
              </h2>
              <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider truncate">
                {car?.license_plate} · Report Card
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <DateRangePicker value={range} onChange={setRange} />
            <button
              onClick={exportCsv}
              disabled={!report}
              title="Export CSV"
              className="p-2 bg-muted hover:bg-muted/80 rounded-lg text-muted-foreground disabled:opacity-50"
            >
              <Download size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-muted hover:bg-muted/80 rounded-lg text-muted-foreground"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading || !report ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="animate-spin text-primary" size={40} />
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <KpiCard
                  label="Total Revenue"
                  value={`Ksh ${fmtKsh(kpis.totalRevenue)}`}
                  icon={<DollarSign size={18} />}
                  tone="primary"
                />
                <KpiCard
                  label="Total Costs"
                  value={`Ksh ${fmtKsh(kpis.totalExpenses)}`}
                  icon={<Wrench size={18} />}
                  tone="warning"
                />
                <KpiCard
                  label="Net Profit"
                  value={`Ksh ${fmtKsh(kpis.netProfit)}`}
                  icon={profitPositive ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                  tone={profitPositive ? 'success' : 'error'}
                />
                <KpiCard
                  label="ROI"
                  value={`${kpis.roi.toFixed(1)}%`}
                  icon={profitPositive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  tone={profitPositive ? 'success' : 'error'}
                />
                <KpiCard
                  label="Utilization"
                  value={`${kpis.utilizationRate}%`}
                  icon={<Activity size={18} />}
                  tone="blue"
                  bar={kpis.utilizationRate}
                />
                <KpiCard
                  label="Total Trips"
                  value={kpis.tripsCount.toString()}
                  icon={<CarIcon size={18} />}
                  tone="muted"
                />
                <KpiCard
                  label="Booked Days"
                  value={`${kpis.totalBookingDays}`}
                  icon={<Calendar size={18} />}
                  tone="muted"
                />
                <KpiCard
                  label="Avg / Trip"
                  value={`Ksh ${fmtKsh(kpis.revenuePerTrip)}`}
                  icon={<DollarSign size={18} />}
                  tone="muted"
                />
              </div>

              {/* Trend */}
              <div className="bg-muted/30 border border-border rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-sm">Revenue vs Cost Trend</h3>
                    <p className="text-[11px] text-muted-foreground">Monthly, last {range} days</p>
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={report.trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                      <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                        formatter={(v: any) => `Ksh ${fmtKsh(Number(v))}`}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="cost" name="Cost" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Expense breakdown + Recent bookings */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-muted/30 border border-border rounded-2xl p-4 sm:p-5">
                  <h3 className="font-bold text-sm mb-4">Expense Breakdown</h3>
                  {report.expenseBreakdown.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-10 text-center">No expenses recorded.</p>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={report.expenseBreakdown} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="type" fontSize={10} width={110} />
                          <Tooltip formatter={(v: any) => `Ksh ${fmtKsh(Number(v))}`} />
                          <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                            {report.expenseBreakdown.map((_: any, i: number) => (
                              <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="bg-muted/30 border border-border rounded-2xl p-4 sm:p-5">
                  <h3 className="font-bold text-sm mb-3">Recent Bookings</h3>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {report.recentBookings.length === 0 && (
                      <p className="text-xs text-muted-foreground py-4">No bookings.</p>
                    )}
                    {report.recentBookings.map((b: any) => (
                      <div key={b.id} className="flex items-center justify-between p-2.5 bg-card rounded-lg border border-border">
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{b.user_profiles?.full_name || 'Customer'}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {fmtDate(b.start_date)} → {fmtDate(b.end_date)}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="text-xs font-bold">Ksh {fmtKsh(b.total_amount)}</p>
                          <p className="text-[10px] uppercase text-muted-foreground">{b.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ops details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <InfoRow label="Last Trip" value={fmtDate(report.lastTripDate)} />
                <InfoRow label="Next Booking" value={fmtDate(report.nextBookingDate)} />
                <InfoRow label="Avg Daily Revenue" value={`Ksh ${fmtKsh(kpis.avgDailyRevenue)}`} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-bold mt-1">{value}</p>
    </div>
  );
}

export default CarReportCard;
