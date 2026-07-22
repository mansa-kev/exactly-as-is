import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Search, Loader2, Download } from 'lucide-react';

type Source = 'bookings' | 'reservations' | 'cars' | 'payments' | 'expenses' | 'users';
type Format = 'csv' | 'json';

const SOURCES: { value: Source; label: string; table: string; select: string; dateCol: string }[] = [
  { value: 'bookings', label: 'Bookings', table: 'bookings', select: 'id, status, payment_status, start_date, end_date, total_amount, platform_commission, created_at, car_id, client_id, fleet_owner_id', dateCol: 'created_at' },
  { value: 'reservations', label: 'Reservations', table: 'car_reservations', select: '*', dateCol: 'created_at' },
  { value: 'cars', label: 'Cars', table: 'cars', select: 'id, make, model, year, license_plate, status, is_outsourced, fleet_owner_id, created_at', dateCol: 'created_at' },
  { value: 'payments', label: 'Payment Transactions', table: 'transactions', select: '*', dateCol: 'created_at' },
  { value: 'expenses', label: 'Expenses', table: 'expenses', select: '*', dateCol: 'date' },
  { value: 'users', label: 'Users', table: 'user_profiles', select: 'id, full_name, email, role, status, created_at', dateCol: 'created_at' },
];

function toCsv(rows: any[]): string {
  if (rows.length === 0) return '';
  const keys = Object.keys(rows[0]);
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
}

export function CustomQuery() {
  const [source, setSource] = useState<Source>('bookings');
  const [days, setDays] = useState(30);
  const [format, setFormat] = useState<Format>('csv');
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<{ rows: number; ts: string } | null>(null);

  const run = async () => {
    const cfg = SOURCES.find((s) => s.value === source)!;
    setRunning(true);
    try {
      const sinceISO = new Date(Date.now() - days * 86400000).toISOString();
      const { data, error } = await supabase.from(cfg.table).select(cfg.select).gte(cfg.dateCol, sinceISO).limit(5000);
      if (error) throw error;
      const rows = data || [];
      const now = new Date();
      const stamp = now.toISOString().split('T')[0];

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${cfg.value}-${days}d-${stamp}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      } else {
        const csv = toCsv(rows);
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${cfg.value}-${days}d-${stamp}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      }

      setLastRun({ rows: rows.length, ts: now.toLocaleTimeString() });
    } catch (e: any) {
      alert(`Query failed: ${e.message || 'unknown error'}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-card p-6 rounded-2xl border border-border shadow-sm border-l-4 border-l-primary">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-primary/10 text-primary rounded-xl">
          <Search size={22} />
        </div>
        <div>
          <h3 className="font-bold text-lg">Custom Data Query</h3>
          <p className="text-sm text-muted-foreground">Pick a data source, date window, and format — download up to 5,000 rows.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Data Source</label>
          <select value={source} onChange={(e) => setSource(e.target.value as Source)} className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20">
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date Range</label>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 6 months</option>
            <option value={365}>Last 12 months</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Format</label>
          <select value={format} onChange={(e) => setFormat(e.target.value as Format)} className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20">
            <option value="csv">CSV Spreadsheet</option>
            <option value="json">JSON Data</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={run}
            disabled={running}
            className="w-full py-2 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:scale-[1.02] transition-transform shadow-lg shadow-primary/20 disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {running ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
            {running ? 'Running…' : 'Run Query'}
          </button>
        </div>
      </div>

      {lastRun && (
        <p className="text-xs text-muted-foreground mt-4">
          Last run at {lastRun.ts}: {lastRun.rows.toLocaleString()} rows exported.
        </p>
      )}
    </div>
  );
}

export default CustomQuery;
