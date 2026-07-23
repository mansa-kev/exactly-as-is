import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { PAID_REVENUE_STATUSES_DB } from '../../../constants/bookingStatuses';
import { KpiCard, DateRangePicker } from '../../shared/reports';
import { Activity, Loader2, Calendar } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function UtilizationHeatmap() {
  const [range, setRange] = useState(90);
  const [matrix, setMatrix] = useState<number[][]>(() => Array.from({ length: 7 }, () => Array(24).fill(0)));
  const [peak, setPeak] = useState<{ day: string; hour: number; count: number } | null>(null);
  const [totals, setTotals] = useState({ pickups: 0, best: 0, worst: 24 * 7 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const sinceISO = new Date(Date.now() - range * 86400000).toISOString();
      const { data } = await supabase
        .from('bookings')
        .select('start_date, pickup_confirmed_at, status, payment_status')
        .in('status', [...PAID_REVENUE_STATUSES_DB])
        .gte('created_at', sinceISO);

      const m: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
      let total = 0;
      (data || []).forEach((b: any) => {
        const raw = b.pickup_confirmed_at || b.start_date;
        if (!raw) return;
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return;
        m[d.getDay()][d.getHours()] += 1;
        total += 1;
      });

      let pk = { day: DAYS[0], hour: 0, count: 0 };
      let best = 0;
      m.forEach((row, di) => row.forEach((c, hi) => {
        if (c > pk.count) pk = { day: DAYS[di], hour: hi, count: c };
        if (c > best) best = c;
      }));

      if (!cancelled) {
        setMatrix(m);
        setPeak(pk);
        setTotals({ pickups: total, best, worst: total > 0 ? Math.min(...m.flat().filter((x) => x > 0)) : 0 });
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [range]);

  const max = useMemo(() => Math.max(1, ...matrix.flat()), [matrix]);

  const cellColor = (v: number) => {
    if (v === 0) return 'bg-muted/40';
    const t = v / max;
    if (t > 0.75) return 'bg-primary';
    if (t > 0.5) return 'bg-primary/70';
    if (t > 0.25) return 'bg-primary/40';
    return 'bg-primary/20';
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-primary" size={40} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Utilization Heatmap</h2>
          <p className="text-sm text-muted-foreground">Pickup density by day-of-week and hour-of-day.</p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Pickups" value={totals.pickups} tone="primary" icon={<Activity size={16} />} />
        <KpiCard label="Peak Day" value={peak?.day || '—'} tone="success" icon={<Calendar size={16} />} />
        <KpiCard label="Peak Hour" value={peak ? `${String(peak.hour).padStart(2, '0')}:00` : '—'} tone="warning" />
        <KpiCard label="Peak Volume" value={peak?.count || 0} tone="blue" hint="pickups in a single hour" />
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid" style={{ gridTemplateColumns: '48px repeat(24, minmax(0, 1fr))' }}>
            <div />
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="text-[9px] text-center text-muted-foreground pb-1">{h}</div>
            ))}
            {DAYS.map((day, di) => (
              <React.Fragment key={day}>
                <div className="text-[10px] font-bold text-muted-foreground flex items-center pr-2">{day}</div>
                {matrix[di].map((v, hi) => (
                  <div
                    key={hi}
                    className={`aspect-square m-[1px] rounded-sm ${cellColor(v)} hover:ring-2 hover:ring-primary transition-all cursor-help`}
                    title={`${day} ${String(hi).padStart(2, '0')}:00 — ${v} pickups`}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-4 text-[10px] text-muted-foreground">
            <span>Less</span>
            <div className="w-3 h-3 rounded-sm bg-muted/40" />
            <div className="w-3 h-3 rounded-sm bg-primary/20" />
            <div className="w-3 h-3 rounded-sm bg-primary/40" />
            <div className="w-3 h-3 rounded-sm bg-primary/70" />
            <div className="w-3 h-3 rounded-sm bg-primary" />
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UtilizationHeatmap;
