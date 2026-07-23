import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { KpiCard, DateRangePicker, DataTable, type DataTableColumn } from '../../shared/reports';
import { CreditCard, CheckCircle2, XCircle, Clock, Loader2, Download } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(Math.round(n || 0));

interface MethodRow {
  method: string;
  attempts: number;
  successful: number;
  failed: number;
  pending: number;
  successRate: number;
  volume: number;
}

export function PaymentHealth() {
  const [range, setRange] = useState(30);
  const [rows, setRows] = useState<MethodRow[]>([]);
  const [totals, setTotals] = useState({ attempts: 0, success: 0, failed: 0, pending: 0, volume: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const sinceISO = new Date(Date.now() - range * 86400000).toISOString();
      const { data } = await supabase
        .from('payments')
        .select('payment_method, status, amount, created_at')
        .gte('created_at', sinceISO);

      const grouped: Record<string, MethodRow> = {};
      let tAttempts = 0, tSuccess = 0, tFailed = 0, tPending = 0, tVolume = 0;

      (data || []).forEach((p: any) => {
        const method = (p.payment_method || 'unknown').toLowerCase();
        if (!grouped[method]) {
          grouped[method] = { method, attempts: 0, successful: 0, failed: 0, pending: 0, successRate: 0, volume: 0 };
        }
        const row = grouped[method];
        row.attempts += 1;
        tAttempts += 1;
        const status = (p.status || '').toLowerCase();
        if (status === 'completed' || status === 'success' || status === 'paid') {
          row.successful += 1;
          row.volume += Number(p.amount || 0);
          tSuccess += 1;
          tVolume += Number(p.amount || 0);
        } else if (status === 'failed' || status === 'cancelled' || status === 'canceled') {
          row.failed += 1;
          tFailed += 1;
        } else {
          row.pending += 1;
          tPending += 1;
        }
      });

      const list = Object.values(grouped).map((r) => {
        r.successRate = r.attempts > 0 ? Math.round((r.successful / r.attempts) * 100) : 0;
        return r;
      });
      list.sort((a, b) => b.volume - a.volume);

      if (!cancelled) {
        setRows(list);
        setTotals({ attempts: tAttempts, success: tSuccess, failed: tFailed, pending: tPending, volume: tVolume });
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [range]);

  const overallRate = totals.attempts > 0 ? Math.round((totals.success / totals.attempts) * 100) : 0;

  const columns: DataTableColumn<MethodRow>[] = [
    { key: 'method', header: 'Method', render: (r) => <span className="font-bold uppercase text-[11px]">{r.method}</span> },
    { key: 'attempts', header: 'Attempts', align: 'right' },
    { key: 'successful', header: 'Success', align: 'right', render: (r) => <span className="text-success font-bold">{r.successful}</span> },
    { key: 'failed', header: 'Failed', align: 'right', render: (r) => <span className={r.failed > 0 ? 'text-destructive font-bold' : ''}>{r.failed}</span> },
    { key: 'pending', header: 'Pending', align: 'right', render: (r) => <span className={r.pending > 0 ? 'text-warning font-bold' : ''}>{r.pending}</span> },
    { key: 'successRate', header: 'Success %', align: 'right', render: (r) => (
      <div className="flex items-center gap-2 justify-end min-w-[110px]">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full ${r.successRate > 85 ? 'bg-success' : r.successRate > 60 ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${r.successRate}%` }} />
        </div>
        <span className="font-bold text-[11px]">{r.successRate}%</span>
      </div>
    ) },
    { key: 'volume', header: 'Volume', align: 'right', render: (r) => `Ksh ${fmt(r.volume)}` },
  ];

  const exportCsv = () => {
    const header = ['Method', 'Attempts', 'Success', 'Failed', 'Pending', 'Success %', 'Volume'];
    const csv = [header.join(','), ...rows.map((r) => [r.method, r.attempts, r.successful, r.failed, r.pending, r.successRate, r.volume].join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `payment-health-${range}d.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-primary" size={40} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Payment Health</h2>
          <p className="text-sm text-muted-foreground">Success, failure and pending rates per payment method.</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Attempts" value={fmt(totals.attempts)} tone="blue" icon={<CreditCard size={16} />} />
        <KpiCard label="Successful" value={fmt(totals.success)} tone="success" icon={<CheckCircle2 size={16} />} />
        <KpiCard label="Failed" value={fmt(totals.failed)} tone="error" icon={<XCircle size={16} />} />
        <KpiCard label="Pending" value={fmt(totals.pending)} tone="warning" icon={<Clock size={16} />} />
        <KpiCard label="Success Rate" value={`${overallRate}%`} tone={overallRate > 85 ? 'success' : overallRate > 60 ? 'warning' : 'error'} bar={overallRate} hint={`Ksh ${fmt(totals.volume)} collected`} />
      </div>

      <DataTable columns={columns} rows={rows} rowKey={(r) => r.method} emptyMessage="No payment attempts in range." />
    </div>
  );
}

export default PaymentHealth;
