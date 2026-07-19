import { calculateRentalDays } from './rentalDays';

/**
 * Pickup-anchored return deadline.
 *
 * When the driver logs pickup, the countdown must run for exactly the booked
 * duration (rentalDays * 24h) starting at pickup_confirmed_at — NOT to the
 * scheduled end_date (which is often stretched to end-of-day and ignores
 * when the car actually left the lot).
 *
 * Falls back to end_date when pickup hasn't been logged yet.
 */
export function getReturnDeadline(booking: {
  start_date?: string | null;
  end_date?: string | null;
  pickup_confirmed_at?: string | null;
}): Date | null {
  if (booking?.pickup_confirmed_at) {
    const pickup = new Date(booking.pickup_confirmed_at);
    if (!Number.isNaN(pickup.getTime())) {
      const days = calculateRentalDays(booking.start_date, booking.end_date) || 1;
      return new Date(pickup.getTime() + days * 24 * 60 * 60 * 1000);
    }
  }
  if (booking?.end_date) {
    const end = new Date(booking.end_date);
    if (!Number.isNaN(end.getTime())) return end;
  }
  return null;
}

export function getTimeLeftMs(
  booking: { start_date?: string | null; end_date?: string | null; pickup_confirmed_at?: string | null },
  now: number = Date.now()
): number {
  const deadline = getReturnDeadline(booking);
  if (!deadline) return 0;
  return deadline.getTime() - now;
}
