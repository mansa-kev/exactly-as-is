export type FleetUnitBucket =
  | 'available'
  | 'on_trip'
  | 'reserved'
  | 'maintenance'
  | 'unavailable'
  | 'outsourced';

export interface FleetUnitRow {
  id: string;
  license_plate?: string;
  color?: string;
  year?: number;
  status?: string;
  maintenance_status?: string;
  vehicle_model_id?: string | null;
  make?: string;
  model?: string;
  is_outsourced?: boolean;
  primary_image_url?: string;
  fleet_owner?: { full_name?: string } | null;
}

export interface FleetUnitStatus extends FleetUnitRow {
  bucket: FleetUnitBucket;
  blockedBy?: string;
  blockedReason?: string;
}

export interface ModelFleetStatusSummary {
  total: number;
  available: number;
  on_trip: number;
  reserved: number;
  maintenance: number;
  unavailable: number;
  outsourced: number;
  units: FleetUnitStatus[];
}

const ACTIVE_BOOKING_STATUSES = [
  'confirmed',
  'on_trip',
  'pending_payment_verification',
  'pending',
  'in_progress',
] as const;

const ACTIVE_RESERVATION_STATUSES = ['reserved', 'confirmed', 'pending_payment'] as const;

function hasOverlap(
  startDate: string,
  endDate: string,
  existingStart: string,
  existingEnd: string
): boolean {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const currentStart = new Date(existingStart);
  const currentEnd = new Date(existingEnd);
  return (
    (start >= currentStart && start <= currentEnd) ||
    (end >= currentStart && end <= currentEnd) ||
    (start <= currentStart && end >= currentEnd)
  );
}

function baseBucket(unit: FleetUnitRow): FleetUnitBucket {
  if (unit.is_outsourced) return 'outsourced';
  if (unit.status === 'maintenance' || unit.maintenance_status === 'in_progress') return 'maintenance';
  if (unit.status === 'unavailable') return 'unavailable';
  if (unit.status === 'rented') return 'on_trip';
  return 'available';
}

export function buildModelFleetStatus(
  units: FleetUnitRow[],
  options: {
    startDate?: string;
    endDate?: string;
    bookings?: Array<{ id: string; car_id?: string | null; start_date: string; end_date: string; status?: string }>;
    reservations?: Array<{ id: string; car_id?: string | null; start_date: string; end_date: string; status?: string }>;
  } = {}
): ModelFleetStatusSummary {
  const { startDate, endDate, bookings = [], reservations = [] } = options;
  const dateScoped = Boolean(startDate && endDate);

  const unitsWithStatus: FleetUnitStatus[] = units.map((unit) => {
    let bucket = baseBucket(unit);
    let blockedBy: string | undefined;
    let blockedReason: string | undefined;

    if (dateScoped && bucket !== 'maintenance' && bucket !== 'unavailable') {
      const bookingConflict = bookings.find(
        (row) =>
          row.car_id === unit.id &&
          ACTIVE_BOOKING_STATUSES.includes(row.status as (typeof ACTIVE_BOOKING_STATUSES)[number]) &&
          hasOverlap(startDate!, endDate!, row.start_date, row.end_date)
      );
      if (bookingConflict) {
        bucket = bookingConflict.status === 'on_trip' ? 'on_trip' : 'reserved';
        blockedBy = bookingConflict.id;
        blockedReason = 'booking';
      } else {
        const reservationConflict = reservations.find(
          (row) =>
            row.car_id === unit.id &&
            ACTIVE_RESERVATION_STATUSES.includes(row.status as (typeof ACTIVE_RESERVATION_STATUSES)[number]) &&
            hasOverlap(startDate!, endDate!, row.start_date, row.end_date)
        );
        if (reservationConflict) {
          bucket = 'reserved';
          blockedBy = reservationConflict.id;
          blockedReason = 'reservation';
        }
      }
    }

    return { ...unit, bucket, blockedBy, blockedReason };
  });

  const count = (bucket: FleetUnitBucket) =>
    unitsWithStatus.filter((unit) => unit.bucket === bucket).length;

  return {
    total: unitsWithStatus.length,
    available: count('available'),
    on_trip: count('on_trip'),
    reserved: count('reserved'),
    maintenance: count('maintenance'),
    unavailable: count('unavailable'),
    outsourced: count('outsourced'),
    units: unitsWithStatus,
  };
}

export const FLEET_BUCKET_LABELS: Record<FleetUnitBucket, string> = {
  available: 'Available',
  on_trip: 'On trip',
  reserved: 'Reserved',
  maintenance: 'Maintenance',
  unavailable: 'Unavailable',
  outsourced: 'Outsourced',
};

export const FLEET_BUCKET_COLORS: Record<FleetUnitBucket, string> = {
  available: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  on_trip: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  reserved: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  maintenance: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  unavailable: 'bg-red-500/15 text-red-400 border-red-500/30',
  outsourced: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};
