import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import { Loader2, TrendingUp, TrendingDown, AlertCircle, FileText, Download } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line, ComposedChart,
} from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const BUCKET_LABELS: Record<string, string> = {
  current: 'Current',
  d30: '1-30 days',
  d60: '31-60 days',
  d90: '61-90 days',
  over90: '90+ days',
};

export function AdminFinanceExtras() {
  const [range, setRange] = useState(90);
  const [tab, setTab] = useState<'pnl' | 'aging' | 'tax'>('pnl');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminService.getFinanceExtras(range).then((r: any) => {
      if (!cancelled) {
        setData(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const exportPnl = () => {
    if (!data) return;
    const rows = ['Month,Revenue,Expenses,Payouts,Net Profit'];
    data.pnl.forEach((m: any) => rows.push(`${m.month},${m.revenue},${m.expenses},${m.payouts},${m.netProfit}`));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pnl-${range}d.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {(['pnl', 'aging', 'tax'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-xs font-bold ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {t === 'pnl' ? 'P&L Statement' : t === 'aging' ? 'Receivables Aging' : 'Tax Summary'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <select value={range} onChange={(e) => setRange(Number(e.target.value))} className="px-3 py-2 rounded-lg bg-muted text-xs border border-border">
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={180}>6 months</option>
            <option value={365}>12 months</option>
          </select>
          {tab === 'pnl' && (
            <button onClick={exportPnl} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
              <Download size={14} /> CSV
            </button>
          )}
        </div>
      </div>

      {tab === 'pnl' && (
        <>
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-bold text-sm mb-4">Profit & Loss</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.pnl}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => `Ksh ${fmt(Number(v))}`} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="netProfit" name="Net" stroke="#10b981" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="px-4 py-3 text-left uppercase text-[10px] text-muted-foreground">Month</th>
                    <th className="px-4 py-3 text-right uppercase text-[10px] text-muted-foreground">Revenue</th>
                    <th className="px-4 py-3 text-right uppercase text-[10px] text-muted-foreground">Expenses</th>
                    <th className="px-4 py-3 text-right uppercase text-[10px] text-muted-foreground">Payouts</th>
                    <th className="px-4 py-3 text-right uppercase text-[10px] text-muted-foreground">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.pnl.map((m: any) => (
                    <tr key={m.month}>
                      <td className="px-4 py-3 font-bold">{m.month}</td>
                      <td className="px-4 py-3 text-right">Ksh {fmt(m.revenue)}</td>
                      <td className="px-4 py-3 text-right text-destructive">Ksh {fmt(m.expenses)}</td>
                      <td className="px-4 py-3 text-right text-blue-500">Ksh {fmt(m.payouts)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${m.netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>Ksh {fmt(m.netProfit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'aging' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(data.receivables.buckets).map(([k, v]: any) => (
              <div key={k} className="bg-card border border-border rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">{BUCKET_LABELS[k]}</p>
                <p className={`text-lg font-black mt-1 ${k === 'over90' || k === 'd90' ? 'text-destructive' : 'text-foreground'}`}>Ksh {fmt(v)}</p>
              </div>
            ))}
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="text-warning" size={16} />
              <h3 className="font-bold text-sm">Outstanding Receivables ({data.receivables.count})</h3>
              <span className="ml-auto text-xs text-muted-foreground">Total owed: <span className="font-bold text-foreground">Ksh {fmt(data.receivables.total)}</span></span>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="px-3 py-2 text-left uppercase text-[10px] text-muted-foreground">Booking</th>
                    <th className="px-3 py-2 text-left uppercase text-[10px] text-muted-foreground">Age</th>
                    <th className="px-3 py-2 text-left uppercase text-[10px] text-muted-foreground">Bucket</th>
                    <th className="px-3 py-2 text-left uppercase text-[10px] text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-right uppercase text-[10px] text-muted-foreground">Owed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.receivables.items.map((r: any) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-mono text-[10px]">{String(r.id).slice(0, 8)}</td>
                      <td className="px-3 py-2">{r.ageDays}d</td>
                      <td className="px-3 py-2">{BUCKET_LABELS[r.bucket]}</td>
                      <td className="px-3 py-2 capitalize">{r.status}</td>
                      <td className="px-3 py-2 text-right font-bold">Ksh {fmt(r.owed)}</td>
                    </tr>
                  ))}
                  {data.receivables.items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">No outstanding receivables.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'tax' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3"><TrendingUp className="text-success" size={18} /><h4 className="text-sm font-bold">Gross Revenue</h4></div>
            <p className="text-2xl font-black">Ksh {fmt(data.tax.grossRevenue)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">VAT-inclusive, {range} days</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3"><FileText className="text-primary" size={18} /><h4 className="text-sm font-bold">VAT Collected ({(data.tax.rate * 100).toFixed(0)}%)</h4></div>
            <p className="text-2xl font-black text-primary">Ksh {fmt(data.tax.vatCollected)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">To be remitted to KRA</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3"><TrendingDown className="text-blue-500" size={18} /><h4 className="text-sm font-bold">Net of VAT</h4></div>
            <p className="text-2xl font-black">Ksh {fmt(data.tax.netOfVat)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Reportable turnover</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminFinanceExtras;
