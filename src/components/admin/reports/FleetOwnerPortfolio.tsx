import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { PAID_REVENUE_STATUSES_DB } from '../../../constants/bookingStatuses';
import { KpiCard, DateRangePicker, DataTable, type DataTableColumn } from '../../shared/reports';
import { Users, Car as CarIcon, DollarSign, TrendingUp, Loader2, Download } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(Math.round(n || 0));

interface OwnerRow {
  id: string;
  name: string;
  email: string;
  cars: number;
  trips: number;
  bookedDays: number;
  utilization: number;
  gross: number;
  commission: number;
  payouts: number;
  pending: number;
  net: number;
}

export function FleetOwnerPortfolio() {
  const [range, setRange] = useState(90);
  const [rows, setRows] = useState<OwnerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const sinceISO = new Date(Date.now() - range * 86400000).toISOString();

      const [ownersRes, bookingsRes, payoutsRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, full_name, email, cars(id)')
          .eq('role', 'fleet_owner'),
        supabase
          .from('bookings')
          .select('id, fleet_owner_id, total_amount, platform_commission, status, payment_status, start_date, end_date, created_at')
          .in('status', [...PAID_REVENUE_STATUSES_DB])
          .eq('payment_status', 'paid')
          .gte('created_at', sinceISO),
        supabase.from('payouts').select('fleet_owner_id, amount, status, created_at').gte('created_at', sinceISO),
      ]);

      const owners = ownersRes.data || [];
      const bookings = bookingsRes.data || [];
      const payouts = payoutsRes.data || [];

      const carsPerOwner = new Map<string, number>();
      owners.forEach((o: any) => carsPerOwner.set(o.id, o.cars?.length || 0));

      const grouped: Record<string, OwnerRow> = {};
      owners.forEach((o: any) => {
        grouped[o.id] = {
          id: o.id,
          name: o.full_name || 'Unnamed',
          email: o.email || '',
          cars: o.cars?.length || 0,
          trips: 0,
          bookedDays: 0,
          utilization: 0,
          gross: 0,
          commission: 0,
          payouts: 0,
          pending: 0,
          net: 0,
        };
      });

      bookings.forEach((b: any) => {
        const row = grouped[b.fleet_owner_id];
        if (!row) return;
        row.trips += 1;
        row.gross += Number(b.total_amount || 0);
        row.commission += Number(b.platform_commission || 0);
        if (b.start_date && b.end_date) {
          const days = Math.max(1, Math.round((new Date(b.end_date).getTime() - new Date(b.start_date).getTime()) / 86400000));
          row.bookedDays += days;
        }
      });

      payouts.forEach((p: any) => {
        const row = grouped[p.fleet_owner_id];
        if (!row) return;
        const amt = Math.abs(Number(p.amount || 0));
        if (p.status === 'completed' || p.status === 'paid') row.payouts += amt;
        else if (p.status === 'pending') row.pending += amt;
      });

      const finalRows = Object.values(grouped).map((r) => {
        r.utilization = r.cars > 0 ? Math.min(100, Math.round((r.bookedDays / (r.cars * range)) * 100)) : 0;
        r.net = r.gross - r.commission;
        return r;
      });
      finalRows.sort((a, b) => b.gross - a.gross);

      if (!cancelled) {
        setRows(finalRows);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const totals = useMemo(
    () => ({
      owners: rows.length,
      cars: rows.reduce((s, r) => s + r.cars, 0),
      gross: rows.reduce((s, r) => s + r.gross, 0),
      commission: rows.reduce((s, r) => s + r.commission, 0),
      payouts: rows.reduce((s, r) => s + r.payouts, 0),
      pending: rows.reduce((s, r) => s + r.pending, 0),
      dormant: rows.filter((r) => r.trips === 0 && r.cars > 0).length,
    }),
    [rows],
  );

  const exportCsv = () => {
    const header = ['Owner', 'Email', 'Cars', 'Trips', 'Booked Days', 'Utilization %', 'Gross', 'Commission', 'Paid Out', 'Pending Payout', 'Net'];
    const csv = [
      header.join(','),
      ...rows.map((r) =>
        [r.name, r.email, r.cars, r.trips, r.bookedDays, r.utilization, r.gross, r.commission, r.payouts, r.pending, r.net]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fleet-owner-portfolio-${range}d.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const columns: DataTableColumn<OwnerRow>[] = [
    { key: 'name', header: 'Owner', render: (r) => (
      <div>
        <p className="font-bold">{r.name}</p>
        <p className="text-[10px] text-muted-foreground">{r.email}</p>
      </div>
    ) },
    { key: 'cars', header: 'Cars', align: 'right' },
    { key: 'trips', header: 'Trips', align: 'right' },
    { key: 'utilization', header: 'Util', align: 'right', render: (r) => (
      <div className="flex items-center gap-2 justify-end min-w-[110px]">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full ${r.utilization > 70 ? 'bg-success' : r.utilization > 40 ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${r.utilization}%` }} />
        </div>
        <span className="font-bold text-[11px]">{r.utilization}%</span>
      </div>
    ) },
    { key: 'gross', header: 'Gross', align: 'right', render: (r) => `Ksh ${fmt(r.gross)}` },
    { key: 'commission', header: 'Commission', align: 'right', render: (r) => `Ksh ${fmt(r.commission)}` },
    { key: 'payouts', header: 'Paid Out', align: 'right', render: (r) => `Ksh ${fmt(r.payouts)}` },
    { key: 'pending', header: 'Pending', align: 'right', render: (r) => <span className={r.pending > 0 ? 'text-warning font-bold' : ''}>Ksh {fmt(r.pending)}</span> },
    { key: 'net', header: 'Net to Owner', align: 'right', render: (r) => <span className="font-bold text-success">Ksh {fmt(r.net)}</span> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Fleet Owner Portfolio</h2>
          <p className="text-sm text-muted-foreground">Per-owner utilization, revenue, commissions and payouts.</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard label="Owners" value={fmt(totals.owners)} icon={<Users size={16} />} tone="primary" />
        <KpiCard label="Cars" value={fmt(totals.cars)} icon={<CarIcon size={16} />} tone="blue" />
        <KpiCard label="Gross" value={`Ksh ${fmt(totals.gross)}`} icon={<DollarSign size={16} />} tone="success" />
        <KpiCard label="Commission" value={`Ksh ${fmt(totals.commission)}`} icon={<TrendingUp size={16} />} tone="warning" />
        <KpiCard label="Paid Out" value={`Ksh ${fmt(totals.payouts)}`} tone="muted" />
        <KpiCard label="Dormant Owners" value={fmt(totals.dormant)} tone={totals.dormant > 0 ? 'error' : 'muted'} hint="no paid trips in range" />
      </div>

      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyMessage="No fleet owners in this range." />
    </div>
  );
}

export default FleetOwnerPortfolio;
