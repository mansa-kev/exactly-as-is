import React from 'react';

export type KpiTone = 'primary' | 'success' | 'warning' | 'error' | 'blue' | 'muted';

const TONE_MAP: Record<KpiTone, { badge: string; bar: string }> = {
  primary: { badge: 'bg-primary/10 text-primary', bar: 'bg-primary' },
  success: { badge: 'bg-success/10 text-success', bar: 'bg-success' },
  warning: { badge: 'bg-warning/10 text-warning', bar: 'bg-warning' },
  error: { badge: 'bg-destructive/10 text-destructive', bar: 'bg-destructive' },
  blue: { badge: 'bg-blue-500/10 text-blue-500', bar: 'bg-blue-500' },
  muted: { badge: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground' },
};

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: KpiTone;
  bar?: number;
  hint?: string;
  className?: string;
}

export function KpiCard({ label, value, icon, tone = 'muted', bar, hint, className = '' }: KpiCardProps) {
  const t = TONE_MAP[tone];
  return (
    <div className={`bg-card border border-border rounded-xl p-3 sm:p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        {icon && <span className={`p-1.5 rounded-lg ${t.badge}`}>{icon}</span>}
      </div>
      <p className="text-base sm:text-lg font-bold leading-tight">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
      {typeof bar === 'number' && (
        <div className="h-1 bg-muted rounded-full mt-2 overflow-hidden">
          <div className={`h-full ${t.bar}`} style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} />
        </div>
      )}
    </div>
  );
}

export default KpiCard;
