import React from 'react';
import {
  buildModelFleetStatus,
  FLEET_BUCKET_COLORS,
  FLEET_BUCKET_LABELS,
  FleetUnitBucket,
  ModelFleetStatusSummary,
} from '../../utils/modelFleetStatus';
import { Car, Loader2 } from 'lucide-react';

interface ModelFleetStatusPanelProps {
  status: ModelFleetStatusSummary | null;
  loading?: boolean;
  dateRangeLabel?: string;
  compact?: boolean;
  onSelectUnit?: (unitId: string) => void;
  selectedUnitId?: string | null;
  highlightBuckets?: FleetUnitBucket[];
  onUnreserve?: (reservationId: string) => void;
}

const SUMMARY_BUCKETS: FleetUnitBucket[] = [
  'available',
  'on_trip',
  'reserved',
  'maintenance',
  'outsourced',
];

export const ModelFleetStatusPanel: React.FC<ModelFleetStatusPanelProps> = ({
  status,
  loading,
  dateRangeLabel,
  compact,
  onSelectUnit,
  selectedUnitId,
  highlightBuckets = ['available'],
  onUnreserve,
}) => {
  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="space-y-4">
      {dateRangeLabel && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Fleet status {dateRangeLabel}
        </p>
      )}

      <div className={`grid gap-2 ${compact ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
        {SUMMARY_BUCKETS.map((bucket) => (
          <div
            key={bucket}
            className={`rounded-xl border p-2.5 text-center ${FLEET_BUCKET_COLORS[bucket]}`}
          >
            <p className="text-lg font-black leading-none">{status[bucket]}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider mt-1">{FLEET_BUCKET_LABELS[bucket]}</p>
          </div>
        ))}
        {!compact && (
          <div className="rounded-xl border border-border bg-muted/20 p-2.5 text-center">
            <p className="text-lg font-black leading-none">{status.total}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider mt-1 text-muted-foreground">Total</p>
          </div>
        )}
      </div>

      {status.units.length > 0 && (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {status.units.map((unit) => {
            const selectable =
              onSelectUnit && highlightBuckets.includes(unit.bucket);
            return (
              <button
                key={unit.id}
                type="button"
                disabled={!selectable}
                onClick={() => selectable && onSelectUnit(unit.id)}
                className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border text-left transition-colors ${
                  selectedUnitId === unit.id
                    ? 'border-primary bg-primary/10'
                    : selectable
                      ? 'border-border bg-muted/20 hover:border-primary/40'
                      : 'border-border/60 bg-muted/10 opacity-80'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {unit.primary_image_url ? (
                    <img
                      src={unit.primary_image_url}
                      alt=""
                      className="w-10 h-8 rounded-lg object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Car size={12} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">
                      {unit.license_plate || 'No plate'} · {unit.year || '—'} · {unit.color || 'N/A'}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {unit.fleet_owner?.full_name || (unit.is_outsourced ? 'Outsourced' : 'Fleet unit')}
                      {unit.blockedReason ? ` · blocked by ${unit.blockedReason}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onUnreserve && unit.blockedReason === 'reservation' && unit.blockedBy && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnreserve(unit.blockedBy!);
                      }}
                      className="px-2 py-1 text-[10px] font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors"
                    >
                      Unreserve
                    </button>
                  )}
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${FLEET_BUCKET_COLORS[unit.bucket]}`}
                  >
                    {FLEET_BUCKET_LABELS[unit.bucket]}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export { buildModelFleetStatus };
