import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Activity, Users, Eye, Clock, TrendingUp, Globe2, Smartphone, Monitor, Tablet,
  MapPin, Car, Link2, Loader2, RefreshCw, ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { toast } from 'sonner';

type Range = 7 | 30 | 90;

interface OverviewRow {
  day: string; page_views: number; unique_visitors: number; unique_sessions: number;
  new_visitors: number; avg_session_seconds: number; bounce_rate: number;
}
interface GeoRow { country: string; region: string | null; city: string | null; visits: number; visitors: number }
interface VehicleRow { vehicle_id: string; label: string; impressions: number; clicks: number; bookings_started: number; bookings_completed: number }
interface FunnelRow { step: string; count: number }
interface DeviceRow { device_type: string; sessions: number }
interface RefRow { source: string; sessions: number }
interface PageRow { page_path: string; views: number; avg_time: number | null }

const RANGE_LABEL: Record<Range, string> = { 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days' };

export function AdminAnalyticsCenter() {
  const [range, setRange] = useState<Range>(7);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<OverviewRow[]>([]);
  const [geo, setGeo] = useState<GeoRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [funnel, setFunnel] = useState<FunnelRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [refs, setRefs] = useState<RefRow[]>([]);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [liveUsers, setLiveUsers] = useState<number>(0);

  // Realtime: distinct visitors in the last 5 minutes, polled every 30s
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const since = new Date(Date.now() - 5 * 60_000).toISOString();
      const { data } = await supabase
        .from('analytics_events')
        .select('visitor_id')
        .gte('created_at', since)
        .limit(2000);
      if (cancelled) return;
      const unique = new Set((data || []).map((r: any) => r.visitor_id).filter(Boolean));
      setLiveUsers(unique.size);
    };
    poll();
    const t = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [o, g, v, f, d, r, p] = await Promise.all([
        supabase.rpc('get_traffic_overview', { _days: range }),
        supabase.rpc('get_geo_breakdown', { _days: range }),
        supabase.rpc('get_top_vehicles', { _days: range }),
        supabase.rpc('get_funnel_breakdown', { _days: range }),
        supabase.rpc('get_device_breakdown', { _days: range }),
        supabase.rpc('get_referrer_breakdown', { _days: range }),
        supabase.rpc('get_top_pages', { _days: range }),
      ]);
      if (o.error) throw o.error;
      setOverview(o.data || []);
      setGeo(g.data || []); setVehicles(v.data || []); setFunnel(f.data || []);
      setDevices(d.data || []); setRefs(r.data || []); setPages(p.data || []);
    } catch (e: any) {
      toast.error('Failed to load analytics: ' + (e.message || 'unknown'));
    } finally { setLoading(false); }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await supabase.rpc('refresh_analytics_rollups', { _days: Math.min(range, 7) });
      await load();
      toast.success('Rollups refreshed');
    } catch (e: any) {
      toast.error('Refresh failed: ' + (e.message || 'unknown'));
    } finally { setRefreshing(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range]);

  const totals = useMemo(() => {
    const acc = { pv: 0, uv: 0, us: 0, nv: 0, avg: 0, br: 0 };
    if (!overview.length) return acc;
    for (const r of overview) {
      acc.pv += r.page_views; acc.uv += r.unique_visitors; acc.us += r.unique_sessions;
      acc.nv += r.new_visitors; acc.avg += Number(r.avg_session_seconds || 0); acc.br += Number(r.bounce_rate || 0);
    }
    acc.avg = acc.avg / overview.length;
    acc.br = acc.br / overview.length;
    return acc;
  }, [overview]);

  const countryAgg = useMemo(() => {
    const m = new Map<string, { visits: number; visitors: number }>();
    for (const g of geo) {
      const c = m.get(g.country) || { visits: 0, visitors: 0 };
      c.visits += Number(g.visits); c.visitors += Number(g.visitors);
      m.set(g.country, c);
    }
    return Array.from(m.entries()).map(([country, v]) => ({ country, ...v })).sort((a, b) => b.visits - a.visits).slice(0, 12);
  }, [geo]);

  const DEVICE_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--muted-foreground))', 'hsl(var(--secondary))'];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-[1400px] mx-auto p-6 space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" />
              Analytics Center
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Server-side ingestion · GeoIP · bot-filtered · pre-aggregated</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-semibold">{liveUsers}</span>
              <span className="text-muted-foreground text-xs">live now</span>
            </div>
            <div className="flex rounded-lg border border-border overflow-hidden bg-card">
              {([7, 30, 90] as Range[]).map(r => (
                <button key={r} onClick={() => setRange(r)}
                  className={`px-3 py-2 text-sm font-medium transition ${range === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                  {r}d
                </button>
              ))}
            </div>
            <button onClick={refresh} disabled={refreshing}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-sm">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh rollups
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Kpi icon={<Eye />} label="Page views" value={fmtInt(totals.pv)} sub={RANGE_LABEL[range]} />
              <Kpi icon={<Users />} label="Unique visitors" value={fmtInt(totals.uv)} sub={`${fmtInt(totals.nv)} new`} />
              <Kpi icon={<Activity />} label="Sessions" value={fmtInt(totals.us)} />
              <Kpi icon={<Clock />} label="Avg session" value={fmtDur(totals.avg)} />
              <Kpi icon={<TrendingUp />} label="Bounce rate" value={`${totals.br.toFixed(1)}%`} />
              <Kpi icon={<Globe2 />} label="Countries" value={fmtInt(countryAgg.length)} />
            </section>

            {/* Traffic trend */}
            <Card title="Traffic over time" icon={<Activity className="w-4 h-4" />}>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overview}>
                    <defs>
                      <linearGradient id="gPV" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gUV" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12}
                      tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <RTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                    <Legend />
                    <Area type="monotone" dataKey="page_views" name="Page views" stroke="hsl(var(--primary))" fill="url(#gPV)" strokeWidth={2} />
                    <Area type="monotone" dataKey="unique_visitors" name="Visitors" stroke="hsl(var(--accent))" fill="url(#gUV)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Two-column: Geo + Devices */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card title="Top countries" icon={<Globe2 className="w-4 h-4" />} className="lg:col-span-2">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={countryAgg} layout="vertical" margin={{ left: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis type="category" dataKey="country" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                      <RTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      <Bar dataKey="visits" name="Visits" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="Devices" icon={<Smartphone className="w-4 h-4" />}>
                <div className="h-72 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={devices} dataKey="sessions" nameKey="device_type" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4}>
                        {devices.map((_, i) => <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />)}
                      </Pie>
                      <RTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </section>

            {/* Geo detail + Referrers */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="Cities & regions" icon={<MapPin className="w-4 h-4" />}>
                <Table
                  columns={['Location', 'Visits', 'Visitors']}
                  rows={geo.slice(0, 15).map(g => [
                    <span key="l" className="flex items-center gap-2">
                      <span className="font-medium">{g.city || g.region || g.country}</span>
                      <span className="text-xs text-muted-foreground">{g.country}</span>
                    </span>,
                    fmtInt(g.visits), fmtInt(g.visitors),
                  ])} />
              </Card>

              <Card title="Traffic sources" icon={<Link2 className="w-4 h-4" />}>
                <Table
                  columns={['Source', 'Sessions']}
                  rows={refs.map(r => [r.source, fmtInt(r.sessions)])} />
              </Card>
            </section>

            {/* Funnel + Vehicles */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="Booking funnel" icon={<ChevronRight className="w-4 h-4" />}>
                <div className="space-y-2">
                  {funnel.length === 0 && <p className="text-sm text-muted-foreground">No booking activity yet.</p>}
                  {funnel.map((f, i) => {
                    const max = funnel[0]?.count || 1;
                    const pct = (Number(f.count) / max) * 100;
                    return (
                      <div key={f.step}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="capitalize">{f.step.replace(/_/g, ' ')}</span>
                          <span className="text-muted-foreground">{fmtInt(f.count)} {i > 0 && <span className="ml-2 text-xs">({((Number(f.count) / Number(funnel[0].count)) * 100).toFixed(0)}%)</span>}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-primary to-accent" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card title="Top vehicles" icon={<Car className="w-4 h-4" />}>
                <Table
                  columns={['Vehicle', 'Clicks', 'Started', 'Booked']}
                  rows={vehicles.slice(0, 10).map(v => [v.label || v.vehicle_id, fmtInt(v.clicks), fmtInt(v.bookings_started), fmtInt(v.bookings_completed)])} />
              </Card>
            </section>

            {/* Top pages */}
            <Card title="Top pages" icon={<Monitor className="w-4 h-4" />}>
              <Table
                columns={['Path', 'Views', 'Avg time on page']}
                rows={pages.map(p => [p.page_path, fmtInt(p.views), p.avg_time ? fmtDur(p.avg_time) : '—'])} />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-primary opacity-80">{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Card({ title, icon, children, className = '' }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card ${className}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        {icon && <span className="text-primary">{icon}</span>}
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Table({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No data.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            {columns.map(c => <th key={c} className="py-2 pr-3 font-medium">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              {r.map((cell, j) => <td key={j} className="py-2 pr-3">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtInt(n: number | string) { return Number(n || 0).toLocaleString(); }
function fmtDur(s: number) {
  s = Math.round(Number(s) || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); const r = s % 60;
  return `${m}m ${r}s`;
}
