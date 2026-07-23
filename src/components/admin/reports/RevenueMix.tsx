import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { PAID_REVENUE_STATUSES_DB } from '../../../constants/bookingStatuses';
import { KpiCard, DateRangePicker, DataTable, type DataTableColumn } from '../../shared/reports';
import { DollarSign, PieChart, Loader2, Download, Layers } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(Math.round(n || 0));

type Bucket = 'owned' | 'outsourced';
interface CategoryRow {
  key: string;
  label: string;
  trips: number;
  gross: number;
  commission: number;
  net: number;
  share: number;
  bucket: Bucket | 'all';
}

export function RevenueMix() {
  const [range, setRange] = useState(90);
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [byBucket, setByBucket] = useState<{ owned: number; outsourced: number }>({ owned: 0, outsourced: 0 });
  const [totals, setTotals] = useState({ gross: 0, commission: 0, net: 0, trips: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const sinceISO = new Date(Date.now() - range * 86400000).toISOString();
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, total_amount, platform_commission, car_id, cars(is_outsourced, category, make, model)')
        .in('status', [...PAID_REVENUE_STATUSES_DB])
        .eq('payment_status', 'paid')
        .gte('created_at', sinceISO);

      const grouped: Record<string, CategoryRow> = {};
      let ownedGross = 0;
      let outsourcedGross = 0;
      let tGross = 0;
      let tCommission = 0;
      let tTrips = 0;

      (bookings || []).forEach((b: any) => {
        const car = Array.isArray(b.cars) ? b.cars[0] : b.cars;
        const cat = car?.category || 'Uncategorized';
        const bucket: Bucket = car?.is_outsourced ? 'outsourced' : 'owned';
        const gross = Number(b.total_amount || 0);
        const commission = Number(b.platform_commission || 0);
        tGross += gross;
        tCommission += commission;
        tTrips += 1;
        if (bucket === 'owned') ownedGross += gross;
        else outsourcedGross += gross;

        if (!grouped[cat]) {
          grouped[cat] = { key: cat, label: cat, trips: 0, gross: 0, commission: 0, net: 0, share: 0, bucket: 'all' };
        }
        grouped[cat].trips += 1;
        grouped[cat].gross += gross;
        grouped[cat].commission += commission;
      });

      const list = Object.values(grouped).map((r) => {
        r.net = r.gross - r.commission;
        r.share = tGross > 0 ? Math.round((r.gross / tGross) * 100) : 0;
        return r;
      });
      list.sort((a, b) => b.gross - a.gross);

      if (!cancelled) {
        setRows(list);
        setByBucket({ owned: ownedGross, outsourced: outsourcedGross });
        setTotals({ gross: tGross, commission: tCommission, net: tGross - tCommission, trips: tTrips });
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [range]);

  const columns: DataTableColumn<CategoryRow>[] = [
    { key: 'label', header: 'Category', render: (r) => <span className="font-bold">{r.label}</span> },
    { key: 'trips', header: 'Trips', align: 'right' },
    { key: 'gross', header: 'Gross', align: 'right', render: (r) => `Ksh ${fmt(r.gross)}` },
    { key: 'commission', header: 'Commission', align: 'right', render: (r) => `Ksh ${fmt(r.commission)}` },
    { key: 'net', header: 'Net to Owners', align: 'right', render: (r) => `Ksh ${fmt(r.net)}` },
    { key: 'share', header: 'Share', align: 'right', render: (r) => (
      <div className="flex items-center gap-2 justify-end min-w-[100px]">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${r.share}%` }} />
        </div>
        <span className="font-bold text-[11px]">{r.share}%</span>
      </div>
    ) },
  ];

  const exportCsv = () => {
    const header = ['Category', 'Trips', 'Gross', 'Commission', 'Net', 'Share %'];
    const csv = [header.join(','), ...rows.map((r) => [r.label, r.trips, r.gross, r.commission, r.net, r.share].join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `revenue-mix-${range}d.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-primary" size={40} /></div>;

  const ownedPct = totals.gross > 0 ? Math.round((byBucket.owned / totals.gross) * 100) : 0;
  const outsourcedPct = 100 - ownedPct;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Revenue Mix</h2>
          <p className="text-sm text-muted-foreground">Gross revenue split by ownership and vehicle category.</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Gross" value={`Ksh ${fmt(totals.gross)}`} tone="success" icon={<DollarSign size={16} />} />
        <KpiCard label="Commission" value={`Ksh ${fmt(totals.commission)}`} tone="warning" />
        <KpiCard label="Net to Owners" value={`Ksh ${fmt(totals.net)}`} tone="primary" />
        <KpiCard label="Paid Trips" value={fmt(totals.trips)} tone="blue" icon={<Layers size={16} />} />
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 text-primary rounded-lg"><PieChart size={16} /></div>
          <h3 className="font-bold text-sm">Owned vs Outsourced</h3>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-muted mb-3">
          <div className="bg-primary" style={{ width: `${ownedPct}%` }} />
          <div className="bg-warning" style={{ width: `${outsourcedPct}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-primary" /><span className="font-bold">Owned Fleet</span></div>
            <p className="text-muted-foreground">Ksh {fmt(byBucket.owned)} · {ownedPct}%</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-warning" /><span className="font-bold">Outsourced</span></div>
            <p className="text-muted-foreground">Ksh {fmt(byBucket.outsourced)} · {outsourcedPct}%</p>
          </div>
        </div>
      </div>

      <DataTable columns={columns} rows={rows} rowKey={(r) => r.key} emptyMessage="No paid trips in range." />
    </div>
  );
}

export default RevenueMix;
