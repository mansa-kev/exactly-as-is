import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { KpiCard, DateRangePicker, DataTable, type DataTableColumn } from '../../shared/reports';
import { Megaphone, Users, MousePointerClick, Target, Loader2, Download } from 'lucide-react';

interface SourceRow {
  source: string;
  medium: string;
  campaign: string;
  visitors: number;
  sessions: number;
  bookingSteps: number;
  conversions: number;
  convRate: number;
}

const fmt = (n: number) => new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(Math.round(n || 0));

export function MarketingAttribution() {
  const [range, setRange] = useState(30);
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [totals, setTotals] = useState({ visitors: 0, sessions: 0, conversions: 0, steps: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const sinceISO = new Date(Date.now() - range * 86400000).toISOString();
      const { data } = await supabase
        .from('analytics_events')
        .select('visitor_id, session_id, event_type, event_name, utm, referrer')
        .gte('created_at', sinceISO)
        .limit(50000);

      const grouped: Record<string, {
        source: string; medium: string; campaign: string;
        visitors: Set<string>; sessions: Set<string>; steps: number; conversions: number;
      }> = {};

      let allVisitors = new Set<string>();
      let allSessions = new Set<string>();
      let allSteps = 0, allConversions = 0;

      (data || []).forEach((e: any) => {
        const utm = e.utm || {};
        let source = utm.source || '';
        const medium = utm.medium || '';
        const campaign = utm.campaign || '';
        if (!source) {
          const ref = (e.referrer || '').toLowerCase();
          if (!ref) source = 'direct';
          else if (ref.includes('google')) source = 'google (organic)';
          else if (ref.includes('facebook') || ref.includes('fb.')) source = 'facebook';
          else if (ref.includes('instagram')) source = 'instagram';
          else if (ref.includes('twitter') || ref.includes('t.co')) source = 'twitter';
          else if (ref.includes('tiktok')) source = 'tiktok';
          else source = 'referral';
        }
        const key = `${source}|${medium}|${campaign}`;
        const g = (grouped[key] ||= { source, medium, campaign, visitors: new Set(), sessions: new Set(), steps: 0, conversions: 0 });
        if (e.visitor_id) { g.visitors.add(e.visitor_id); allVisitors.add(e.visitor_id); }
        if (e.session_id) { g.sessions.add(e.session_id); allSessions.add(e.session_id); }
        if (e.event_type === 'booking_step') { g.steps += 1; allSteps += 1; }
        const name = (e.event_name || '').toLowerCase();
        if (name === 'booking_completed' || name === 'checkout_complete' || name === 'reservation_paid') {
          g.conversions += 1; allConversions += 1;
        }
      });

      const list: SourceRow[] = Object.values(grouped).map((g) => ({
        source: g.source,
        medium: g.medium,
        campaign: g.campaign,
        visitors: g.visitors.size,
        sessions: g.sessions.size,
        bookingSteps: g.steps,
        conversions: g.conversions,
        convRate: g.visitors.size > 0 ? Math.round((g.conversions / g.visitors.size) * 1000) / 10 : 0,
      })).sort((a, b) => b.visitors - a.visitors);

      if (!cancelled) {
        setRows(list);
        setTotals({ visitors: allVisitors.size, sessions: allSessions.size, conversions: allConversions, steps: allSteps });
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [range]);

  const overallConv = totals.visitors > 0 ? Math.round((totals.conversions / totals.visitors) * 1000) / 10 : 0;

  const columns: DataTableColumn<SourceRow>[] = [
    { key: 'source', header: 'Source', render: (r) => <span className="font-bold">{r.source}</span> },
    { key: 'medium', header: 'Medium', render: (r) => <span className="text-muted-foreground">{r.medium || '—'}</span> },
    { key: 'campaign', header: 'Campaign', render: (r) => <span className="text-muted-foreground">{r.campaign || '—'}</span> },
    { key: 'visitors', header: 'Visitors', align: 'right' },
    { key: 'sessions', header: 'Sessions', align: 'right' },
    { key: 'bookingSteps', header: 'Steps', align: 'right', render: (r) => <span className="text-warning font-bold">{r.bookingSteps}</span> },
    { key: 'conversions', header: 'Conversions', align: 'right', render: (r) => <span className="text-success font-bold">{r.conversions}</span> },
    { key: 'convRate', header: 'CVR', align: 'right', render: (r) => <span className="font-bold">{r.convRate}%</span> },
  ];

  const exportCsv = () => {
    const header = ['Source', 'Medium', 'Campaign', 'Visitors', 'Sessions', 'Booking Steps', 'Conversions', 'CVR %'];
    const csv = [header.join(','), ...rows.map((r) => [r.source, r.medium, r.campaign, r.visitors, r.sessions, r.bookingSteps, r.conversions, r.convRate].join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `marketing-attribution-${range}d.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-primary" size={40} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Marketing Attribution</h2>
          <p className="text-sm text-muted-foreground">UTM + referrer source performance from analytics events.</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Visitors" value={fmt(totals.visitors)} tone="blue" icon={<Users size={16} />} />
        <KpiCard label="Sessions" value={fmt(totals.sessions)} tone="primary" icon={<MousePointerClick size={16} />} />
        <KpiCard label="Booking Steps" value={fmt(totals.steps)} tone="warning" icon={<Megaphone size={16} />} />
        <KpiCard label="Conversions" value={`${fmt(totals.conversions)}`} tone="success" icon={<Target size={16} />} hint={`${overallConv}% CVR overall`} />
      </div>

      <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.source}|${r.medium}|${r.campaign}`} emptyMessage="No analytics events in range." />
    </div>
  );
}

export default MarketingAttribution;
