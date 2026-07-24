import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { KpiCard, DateRangePicker, DataTable, type DataTableColumn } from '../../shared/reports';
import { Car, Star, CheckCircle2, Loader2, Download, UserCheck } from 'lucide-react';
import { PAID_REVENUE_STATUSES_DB } from '../../../constants/bookingStatuses';

interface DriverRow {
  id: string;
  name: string;
  status: string;
  rating: number;
  trips: number;
  completed: number;
  inProgress: number;
  revenue: number;
  completionRate: number;
}

const fmt = (n: number) => new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(Math.round(n || 0));

export function DriverPerformance() {
  const [range, setRange] = useState(30);
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [totals, setTotals] = useState({ drivers: 0, active: 0, trips: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const sinceISO = new Date(Date.now() - range * 86400000).toISOString();

      const [driversRes, bookingsRes] = await Promise.all([
        supabase.from('driver_profiles').select('id, full_name, status, rating').limit(2000),
        supabase.from('bookings')
          .select('driver_id, status, total_amount, created_at')
          .not('driver_id', 'is', null)
          .gte('created_at', sinceISO)
          .limit(20000),
      ]);

      const drivers = driversRes.data || [];
      const bookings = bookingsRes.data || [];

      const map: Record<string, DriverRow> = {};
      drivers.forEach((d: any) => {
        map[d.id] = {
          id: d.id,
          name: d.full_name || '—',
          status: d.status || 'unknown',
          rating: Number(d.rating || 0),
          trips: 0, completed: 0, inProgress: 0, revenue: 0, completionRate: 0,
        };
      });

      let totalTrips = 0, totalRevenue = 0;
      bookings.forEach((b: any) => {
        const row = map[b.driver_id];
        if (!row) return;
        row.trips += 1; totalTrips += 1;
        const st = (b.status || '').toLowerCase();
        if (st === 'completed') row.completed += 1;
        else if (st === 'on_trip' || st === 'in_progress') row.inProgress += 1;
        if (PAID_REVENUE_STATUSES_DB.includes(st as any)) {
          row.revenue += Number(b.total_amount || 0);
          totalRevenue += Number(b.total_amount || 0);
        }
      });

      const list = Object.values(map).map((r) => {
        r.completionRate = r.trips > 0 ? Math.round((r.completed / r.trips) * 100) : 0;
        return r;
      }).sort((a, b) => b.revenue - a.revenue || b.trips - a.trips);

      const activeCount = drivers.filter((d: any) => (d.status || '').toLowerCase() === 'active').length;

      if (!cancelled) {
        setRows(list);
        setTotals({ drivers: drivers.length, active: activeCount, trips: totalTrips, revenue: totalRevenue });
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [range]);

  const columns: DataTableColumn<DriverRow>[] = [
    { key: 'name', header: 'Driver', render: (r) => <span className="font-bold">{r.name}</span> },
    { key: 'status', header: 'Status', render: (r) => (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
        r.status === 'active' ? 'bg-success/10 text-success'
        : r.status === 'suspended' ? 'bg-destructive/10 text-destructive'
        : 'bg-warning/10 text-warning'
      }`}>{r.status}</span>
    ) },
    { key: 'rating', header: 'Rating', align: 'right', render: (r) => (
      <span className="flex items-center gap-1 justify-end"><Star size={12} className="text-warning" /> {r.rating.toFixed(1)}</span>
    ) },
    { key: 'trips', header: 'Trips', align: 'right' },
    { key: 'completed', header: 'Done', align: 'right', render: (r) => <span className="text-success font-bold">{r.completed}</span> },
    { key: 'inProgress', header: 'Active', align: 'right', render: (r) => <span className="text-blue-500 font-bold">{r.inProgress}</span> },
    { key: 'completionRate', header: 'Completion', align: 'right', render: (r) => (
      <div className="flex items-center gap-2 justify-end min-w-[110px]">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full ${r.completionRate > 80 ? 'bg-success' : r.completionRate > 50 ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${r.completionRate}%` }} />
        </div>
        <span className="font-bold text-[11px]">{r.completionRate}%</span>
      </div>
    ) },
    { key: 'revenue', header: 'Revenue', align: 'right', render: (r) => `Ksh ${fmt(r.revenue)}` },
  ];

  const exportCsv = () => {
    const header = ['Driver', 'Status', 'Rating', 'Trips', 'Completed', 'In Progress', 'Completion %', 'Revenue'];
    const csv = [header.join(','), ...rows.map((r) => [r.name, r.status, r.rating, r.trips, r.completed, r.inProgress, r.completionRate, r.revenue].join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `driver-performance-${range}d.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-primary" size={40} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Driver Performance</h2>
          <p className="text-sm text-muted-foreground">Trip volume, completion, and revenue per driver.</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Drivers" value={fmt(totals.drivers)} tone="blue" icon={<UserCheck size={16} />} />
        <KpiCard label="Active" value={fmt(totals.active)} tone="success" icon={<CheckCircle2 size={16} />} />
        <KpiCard label="Trips (range)" value={fmt(totals.trips)} tone="primary" icon={<Car size={16} />} />
        <KpiCard label="Revenue" value={`Ksh ${fmt(totals.revenue)}`} tone="warning" />
      </div>

      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyMessage="No drivers yet." />
    </div>
  );
}

export default DriverPerformance;
