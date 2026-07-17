import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { 
  Activity, 
  Server, 
  Database, 
  Globe, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Zap,
  Cpu,
  HardDrive,
  Loader2
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// --- Types ---

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  uptime: string;
  latency: string;
  icon: React.ReactNode;
}

// --- Components ---

export function AdminSystemHealth() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const data = await adminService.getSystemHealth();
      const iconMap: Record<string, React.ReactNode> = {
        'Database': <Database size={18} />,
        'Authentication': <ShieldCheck size={18} />,
        'Storage': <HardDrive size={18} />,
        'API Gateway': <Globe size={18} />,
        'Payment Gateway': <Zap size={18} />,
      };
      
      const formattedServices = (data.services || []).map((s: any) => ({
        ...s,
        icon: iconMap[s.name] || <Server size={18} />
      }));
      
      setServices(formattedServices);
    } catch (error) {
      console.error('Failed to fetch system health:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const performanceData = [
    { time: '00:00', load: 30, response: 45 },
    { time: '04:00', load: 25, response: 42 },
    { time: '08:00', load: 65, response: 58 },
    { time: '12:00', load: 85, response: 72 },
    { time: '16:00', load: 70, response: 62 },
    { time: '20:00', load: 45, response: 48 },
    { time: '23:59', load: 35, response: 44 },
  ];

  if (loading && services.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Overall Status Banner */}
      <div className="bg-success/10 border border-success/20 p-6 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-success/20 text-success rounded-xl">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h3 className="font-bold text-success text-lg">All Systems Operational</h3>
            <p className="text-sm text-success/80">Platform is performing optimally. No major incidents reported in the last 24 hours.</p>
          </div>
        </div>
        <div className="hidden md:block text-right">
          <p className="text-xs font-bold text-success/60 uppercase tracking-widest mb-1">Last Checked</p>
          <p className="text-sm font-bold text-success">Just now</p>
        </div>
      </div>

      {/* Service Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {services.map((service) => (
          <div key={service.name} className="bg-card p-5 rounded-2xl border border-border shadow-sm hover:border-primary/30 transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-lg ${
                service.status === 'operational' ? 'bg-success/10 text-success' : 
                service.status === 'degraded' ? 'bg-warning/10 text-warning' : 
                'bg-error/10 text-error'
              }`}>
                {service.icon}
              </div>
              <div className={`w-2 h-2 rounded-full ${
                service.status === 'operational' ? 'bg-success' : 
                service.status === 'degraded' ? 'bg-warning' : 
                'bg-error'
              } animate-pulse`} />
            </div>
            <h4 className="font-bold text-sm text-foreground mb-1">{service.name}</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>Uptime</span>
                <span className="text-foreground">{service.uptime}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>Latency</span>
                <span className="text-foreground">{service.latency}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-card p-8 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <Cpu size={20} />
              </div>
              <h3 className="font-bold text-lg">System Load</h3>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground font-medium">Avg Load</p>
              <p className="text-lg font-bold">42%</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={200}>
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'var(--muted-foreground)'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'var(--muted-foreground)'}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '12px' }}
                  itemStyle={{ color: 'var(--primary)' }}
                />
                <Area type="monotone" dataKey="load" stroke="var(--primary)" fillOpacity={1} fill="url(#colorLoad)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card p-8 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                <Activity size={20} />
              </div>
              <h3 className="font-bold text-lg">Response Latency</h3>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground font-medium">Avg Latency</p>
              <p className="text-lg font-bold">52ms</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={200}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'var(--muted-foreground)'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'var(--muted-foreground)'}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '12px' }}
                  itemStyle={{ color: 'var(--blue-500)' }}
                />
                <Line type="monotone" dataKey="response" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Logs Placeholder */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted text-muted-foreground rounded-lg">
              <FileText size={20} />
            </div>
            <h3 className="font-bold text-lg">Recent System Logs</h3>
          </div>
          <button className="text-xs font-bold text-primary hover:underline">View All Logs</button>
        </div>
        <div className="divide-y divide-border">
          {[
            { time: '10:45:22', level: 'INFO', message: 'New user registration: user_9921', service: 'Auth' },
            { time: '10:42:15', level: 'WARN', message: 'Slow query detected on bookings table', service: 'Database' },
            { time: '10:38:05', level: 'INFO', message: 'Payout batch #882 processed successfully', service: 'Financials' },
            { time: '10:35:12', level: 'ERROR', message: 'Failed to send SMS notification to +123456789', service: 'Notifications' },
          ].map((log, i) => (
            <div key={i} className="p-4 flex items-center gap-6 hover:bg-muted/30 transition-colors">
              <span className="text-[10px] font-mono text-muted-foreground w-20">{log.time}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded w-16 text-center ${
                log.level === 'INFO' ? 'bg-success/10 text-success' : 
                log.level === 'WARN' ? 'bg-warning/10 text-warning' : 
                'bg-error/10 text-error'
              }`}>{log.level}</span>
              <span className="text-xs font-medium text-foreground flex-1">{log.message}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{log.service}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const FileText = ({ size, className }: { size?: number, className?: string }) => (
  <svg 
    width={size || 24} 
    height={size || 24} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);
