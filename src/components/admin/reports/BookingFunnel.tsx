import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { KpiCard, DateRangePicker } from '../../shared/reports';
import { Loader2, TrendingDown, Download } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

export function BookingFunnel() {
  const [range, setRange] = useState(90);
  const [loading, setLoading] = useState(true);
  const [stages, setStages] = useState<{ label: string; value: number }[]>([]);
  const [cancelReasons, setCancelReasons] = useState<{ reason: string; count: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const sinceISO = new Date(Date.now() - range * 86400000).toISOString();

      const [reservationsRes, bookingsRes] = await Promise.all([
        supabase.from('car_reservations').select('id, status, created_at').gte('created_at', sinceISO),
        supabase
          .from('bookings')
          .select('id, status, payment_status, pickup_confirmed_at, created_at')
          .gte('created_at', sinceISO),
      ]);

      const reservations = reservationsRes.data || [];
      const bookings = bookingsRes.data || [];

      const reserved = reservations.length;
      const created = bookings.length;
      const paid = bookings.filter((b: any) => b.payment_status === 'paid').length;
      const pickedUp = bookings.filter((b: any) => !!b.pickup_confirmed_at).length;
      const completed = bookings.filter((b: any) => b.status === 'completed').length;
      const cancelled = bookings.filter((b: any) => b.status === 'cancelled').length;

      const stagesData = [
        { label: 'Reservations', value: reserved },
        { label: 'Bookings Created', value: created },
        { label: 'Paid', value: paid },
        { label: 'Picked Up', value: pickedUp },
        { label: 'Completed', value: completed },
      ];

      const cancelledCount = bookings.filter((b: any) => b.status === 'cancelled').length;
      const reasons = [
        { reason: 'Cancelled bookings', count: cancelledCount },
      ].filter((r) => r.count > 0);

      if (!cancelled) {
        setStages(stagesData);
        setCancelReasons(reasons);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const summary = useMemo(() => {
    const reserved = stages[0]?.value || 0;
    const paid = stages[2]?.value || 0;
    const completed = stages[4]?.value || 0;
    return {
      reserved,
      paid,
      completed,
      reserveToPaid: pct(paid, reserved),
      paidToCompleted: pct(completed, paid),
    };
  }, [stages]);

  const exportCsv = () => {
    const csv = ['Stage,Count', ...stages.map((s) => `${s.label},${s.value}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `booking-funnel-${range}d.csv`;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Booking Funnel</h2>
          <p className="text-sm text-muted-foreground">Conversion from reservation through completed trip.</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Reservations" value={fmt(summary.reserved)} tone="blue" />
        <KpiCard label="Paid" value={fmt(summary.paid)} tone="success" />
        <KpiCard label="Completed" value={fmt(summary.completed)} tone="primary" />
        <KpiCard label="Reserve → Paid" value={`${summary.reserveToPaid}%`} bar={summary.reserveToPaid} tone="warning" />
        <KpiCard label="Paid → Completed" value={`${summary.paidToCompleted}%`} bar={summary.paidToCompleted} tone="success" />
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-bold text-sm mb-4">Funnel Volume</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stages} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" width={130} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="text-destructive" size={18} />
          <h3 className="font-bold text-sm">Top Cancellation Reasons</h3>
        </div>
        {cancelReasons.length === 0 ? (
          <p className="text-xs text-muted-foreground">No cancellations recorded in this range.</p>
        ) : (
          <div className="space-y-2">
            {cancelReasons.map((r) => (
              <div key={r.reason} className="flex items-center justify-between text-xs border-b border-border pb-2">
                <span className="text-muted-foreground truncate mr-4">{r.reason}</span>
                <span className="font-bold">{r.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BookingFunnel;
