import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { PAID_REVENUE_STATUSES_DB } from '../../../constants/bookingStatuses';
import { KpiCard, DateRangePicker, DataTable, type DataTableColumn } from '../../shared/reports';
import { Handshake, DollarSign, Clock, Loader2, Download } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(Math.round(n || 0));

interface PartnerRow {
  name: string;
  cars: number;
  trips: number;
  gross: number;
  platformMargin: number;
  owed: number;
  paid: number;
  pending: number;
  oldestPending: number | null; // days
}

export function OutsourcedPartnerLedger() {
  const [range, setRange] = useState(90);
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const sinceISO = new Date(Date.now() - range * 86400000).toISOString();

      const [carsRes, bookingsRes, settlementsRes] = await Promise.all([
        supabase.from('cars').select('id, outsource_owner_name').eq('is_outsourced', true),
        supabase
          .from('bookings')
          .select('id, car_id, total_amount, platform_commission, created_at, status, payment_status')
          .in('status', [...PAID_REVENUE_STATUSES_DB])
          .eq('payment_status', 'paid')
          .gte('created_at', sinceISO),
        supabase
          .from('payout_settlements')
          .select('id, booking_id, type, amount, status, created_at, settled_at, booking:bookings(car_id, cars(id, is_outsourced, outsource_owner_name))')
          .gte('created_at', sinceISO),
      ]);

      const outsourcedCars = carsRes.data || [];
      const bookings = bookingsRes.data || [];
      const settlements = settlementsRes.data || [];

      const carPartner = new Map<string, string>();
      const partnerCarCount: Record<string, number> = {};
      outsourcedCars.forEach((c: any) => {
        const name = (c.outsource_owner_name || 'Unassigned Partner').trim();
        carPartner.set(c.id, name);
        partnerCarCount[name] = (partnerCarCount[name] || 0) + 1;
      });

      const rowsByPartner: Record<string, PartnerRow> = {};
      const ensure = (name: string): PartnerRow => {
        if (!rowsByPartner[name]) {
          rowsByPartner[name] = {
            name,
            cars: partnerCarCount[name] || 0,
            trips: 0,
            gross: 0,
            platformMargin: 0,
            owed: 0,
            paid: 0,
            pending: 0,
            oldestPending: null,
          };
        }
        return rowsByPartner[name];
      };

      Object.keys(partnerCarCount).forEach(ensure);

      bookings.forEach((b: any) => {
        const partner = carPartner.get(b.car_id);
        if (!partner) return;
        const row = ensure(partner);
        row.trips += 1;
        row.gross += Number(b.total_amount || 0);
        row.platformMargin += Number(b.platform_commission || 0);
      });

      const now = Date.now();
      settlements.forEach((s: any) => {
        const car = s.booking?.cars;
        if (!car?.is_outsourced) return;
        const partner = (car.outsource_owner_name || 'Unassigned Partner').trim();
        const row = ensure(partner);
        const amt = Number(s.amount || 0);
        row.owed += amt;
        if (s.status === 'paid') {
          row.paid += amt;
        } else if (s.status === 'pending') {
          row.pending += amt;
          const days = Math.floor((now - new Date(s.created_at).getTime()) / 86400000);
          row.oldestPending = row.oldestPending == null ? days : Math.max(row.oldestPending, days);
        }
      });

      const finalRows = Object.values(rowsByPartner).sort((a, b) => b.gross - a.gross);

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
      partners: rows.length,
      cars: rows.reduce((s, r) => s + r.cars, 0),
      gross: rows.reduce((s, r) => s + r.gross, 0),
      margin: rows.reduce((s, r) => s + r.platformMargin, 0),
      paid: rows.reduce((s, r) => s + r.paid, 0),
      pending: rows.reduce((s, r) => s + r.pending, 0),
    }),
    [rows],
  );

  const exportCsv = () => {
    const header = ['Partner', 'Cars', 'Trips', 'Gross', 'Platform Margin', 'Owed', 'Paid', 'Pending', 'Oldest Pending (days)'];
    const csv = [
      header.join(','),
      ...rows.map((r) =>
        [r.name, r.cars, r.trips, r.gross, r.platformMargin, r.owed, r.paid, r.pending, r.oldestPending ?? '']
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `outsourced-ledger-${range}d.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const columns: DataTableColumn<PartnerRow>[] = [
    { key: 'name', header: 'Partner', render: (r) => <span className="font-bold">{r.name}</span> },
    { key: 'cars', header: 'Cars', align: 'right' },
    { key: 'trips', header: 'Trips', align: 'right' },
    { key: 'gross', header: 'Gross', align: 'right', render: (r) => `Ksh ${fmt(r.gross)}` },
    { key: 'platformMargin', header: 'Platform Margin', align: 'right', render: (r) => `Ksh ${fmt(r.platformMargin)}` },
    { key: 'paid', header: 'Paid Out', align: 'right', render: (r) => `Ksh ${fmt(r.paid)}` },
    { key: 'pending', header: 'Pending', align: 'right', render: (r) => <span className={r.pending > 0 ? 'text-warning font-bold' : ''}>Ksh {fmt(r.pending)}</span> },
    { key: 'oldestPending', header: 'Aging (d)', align: 'right', render: (r) => (r.oldestPending == null ? '—' : <span className={r.oldestPending > 30 ? 'text-destructive font-bold' : ''}>{r.oldestPending}</span>) },
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
          <h2 className="text-xl font-bold">Outsourced Partner Ledger</h2>
          <p className="text-sm text-muted-foreground">Revenue share, settlements paid, and outstanding balances per partner.</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard label="Partners" value={fmt(totals.partners)} icon={<Handshake size={16} />} tone="primary" />
        <KpiCard label="Cars" value={fmt(totals.cars)} tone="blue" />
        <KpiCard label="Gross" value={`Ksh ${fmt(totals.gross)}`} icon={<DollarSign size={16} />} tone="success" />
        <KpiCard label="Platform Margin" value={`Ksh ${fmt(totals.margin)}`} tone="warning" />
        <KpiCard label="Paid Out" value={`Ksh ${fmt(totals.paid)}`} tone="muted" />
        <KpiCard label="Outstanding" value={`Ksh ${fmt(totals.pending)}`} icon={<Clock size={16} />} tone={totals.pending > 0 ? 'error' : 'muted'} />
      </div>

      <DataTable columns={columns} rows={rows} rowKey={(r) => r.name} emptyMessage="No outsourced activity in this range." />
    </div>
  );
}

export default OutsourcedPartnerLedger;
