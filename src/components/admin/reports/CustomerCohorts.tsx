import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { KpiCard, DataTable, type DataTableColumn } from '../../shared/reports';
import { Users, Repeat, TrendingUp, Loader2, Download } from 'lucide-react';
import { PAID_REVENUE_STATUSES_DB } from '../../../constants/bookingStatuses';

interface BookingRow { client_id: string; start_date: string; total_amount: number; status: string; }
interface CohortRow {
  cohort: string; // YYYY-MM of first booking
  size: number;
  retained: number;
  retentionRate: number;
  totalTrips: number;
  totalRevenue: number;
  avgTripsPerClient: number;
}

const monthKey = (d: string) => d.slice(0, 7);

export function CustomerCohorts() {
  const [months, setMonths] = useState(12);
  const [rows, setRows] = useState<CohortRow[]>([]);
  const [totals, setTotals] = useState({ clients: 0, repeat: 0, revenue: 0, trips: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const sinceISO = new Date(Date.now() - months * 30 * 86400000).toISOString();
      const { data } = await supabase
        .from('bookings')
        .select('client_id, start_date, total_amount, status')
        .gte('created_at', sinceISO)
        .in('status', PAID_REVENUE_STATUSES_DB as any)
        .limit(20000);

      const byClient: Record<string, BookingRow[]> = {};
      (data || []).forEach((b: any) => {
        if (!b.client_id) return;
        (byClient[b.client_id] ||= []).push(b);
      });

      const cohorts: Record<string, CohortRow> = {};
      let repeatCount = 0, totalRevenue = 0, totalTrips = 0;

      Object.entries(byClient).forEach(([, list]) => {
        list.sort((a, b) => a.start_date.localeCompare(b.start_date));
        const cohort = monthKey(list[0].start_date);
        const c = (cohorts[cohort] ||= { cohort, size: 0, retained: 0, retentionRate: 0, totalTrips: 0, totalRevenue: 0, avgTripsPerClient: 0 });
        c.size += 1;
        c.totalTrips += list.length;
        const rev = list.reduce((s, b) => s + Number(b.total_amount || 0), 0);
        c.totalRevenue += rev;
        totalRevenue += rev;
        totalTrips += list.length;
        if (list.length > 1) { c.retained += 1; repeatCount += 1; }
      });

      const cohortList = Object.values(cohorts).map((c) => {
        c.retentionRate = c.size > 0 ? Math.round((c.retained / c.size) * 100) : 0;
        c.avgTripsPerClient = c.size > 0 ? Math.round((c.totalTrips / c.size) * 10) / 10 : 0;
        return c;
      }).sort((a, b) => b.cohort.localeCompare(a.cohort));

      if (!cancelled) {
        setRows(cohortList);
        setTotals({ clients: Object.keys(byClient).length, repeat: repeatCount, revenue: totalRevenue, trips: totalTrips });
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [months]);

  const overallRetention = totals.clients > 0 ? Math.round((totals.repeat / totals.clients) * 100) : 0;
  const fmt = (n: number) => new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(Math.round(n || 0));

  const columns: DataTableColumn<CohortRow>[] = [
    { key: 'cohort', header: 'Cohort', render: (r) => <span className="font-bold">{r.cohort}</span> },
    { key: 'size', header: 'New Clients', align: 'right' },
    { key: 'retained', header: 'Repeat', align: 'right', render: (r) => <span className="text-success font-bold">{r.retained}</span> },
    { key: 'retentionRate', header: 'Retention', align: 'right', render: (r) => (
      <div className="flex items-center gap-2 justify-end min-w-[110px]">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full ${r.retentionRate > 40 ? 'bg-success' : r.retentionRate > 20 ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${r.retentionRate}%` }} />
        </div>
        <span className="font-bold text-[11px]">{r.retentionRate}%</span>
      </div>
    ) },
    { key: 'totalTrips', header: 'Trips', align: 'right' },
    { key: 'avgTripsPerClient', header: 'Trips / Client', align: 'right' },
    { key: 'totalRevenue', header: 'Revenue', align: 'right', render: (r) => `Ksh ${fmt(r.totalRevenue)}` },
  ];

  const exportCsv = () => {
    const header = ['Cohort', 'Size', 'Retained', 'Retention %', 'Trips', 'Trips/Client', 'Revenue'];
    const csv = [header.join(','), ...rows.map((r) => [r.cohort, r.size, r.retained, r.retentionRate, r.totalTrips, r.avgTripsPerClient, r.totalRevenue].join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `customer-cohorts-${months}m.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-primary" size={40} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Customer Cohorts</h2>
          <p className="text-sm text-muted-foreground">Group clients by first-booking month and track repeat behaviour.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="px-3 py-2 rounded-lg bg-card border border-border text-xs font-bold">
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
            <option value={24}>Last 24 months</option>
          </select>
          <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Unique Clients" value={fmt(totals.clients)} tone="blue" icon={<Users size={16} />} />
        <KpiCard label="Repeat Clients" value={fmt(totals.repeat)} tone="success" icon={<Repeat size={16} />} />
        <KpiCard label="Retention Rate" value={`${overallRetention}%`} tone={overallRetention > 30 ? 'success' : overallRetention > 15 ? 'warning' : 'error'} bar={overallRetention} icon={<TrendingUp size={16} />} />
        <KpiCard label="Total Trips" value={fmt(totals.trips)} tone="primary" hint={`Ksh ${fmt(totals.revenue)} lifetime`} />
      </div>

      <DataTable columns={columns} rows={rows} rowKey={(r) => r.cohort} emptyMessage="No completed bookings in range." />
    </div>
  );
}

export default CustomerCohorts;
