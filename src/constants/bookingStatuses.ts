/**
 * Canonical booking status groupings for analytics, dashboards, and availability.
 * Lifecycle UI uses on_trip / pending_collection; legacy code used in_progress.
 */

export type BookingStatusValue =
  | 'pending'
  | 'confirmed'
  | 'pending_collection'
  | 'on_trip'
  | 'completed'
  | 'cancelled'
  | 'pending_payment_verification'
  | 'in_progress'; // legacy alias for on_trip (not in DB enum)

/** Paid bookings that count toward gross revenue / commission (client-side checks). */
export const PAID_REVENUE_STATUSES = [
  'confirmed',
  'pending_collection',
  'on_trip',
  'completed',
  'in_progress',
] as const;

/**
 * Safe for Supabase `.in('status', …)` — only values that exist in booking_status enum.
 * Do not include pending_collection / in_progress until migrated in production DB.
 */
export const PAID_REVENUE_STATUSES_DB = [
  'confirmed',
  'on_trip',
  'completed',
] as const;

/** Bookings currently in the rental pipeline (client-side checks). */
export const ACTIVE_BOOKING_STATUSES = [
  'confirmed',
  'pending_collection',
  'on_trip',
  'in_progress',
] as const;

export const ACTIVE_BOOKING_STATUSES_DB = ['confirmed', 'on_trip'] as const;

/** Statuses that block a car on the calendar / availability search. */
export const CALENDAR_BLOCKING_STATUSES = [
  'confirmed',
  'pending_collection',
  'on_trip',
  'in_progress',
] as const;

export const CALENDAR_BLOCKING_STATUSES_DB = ['confirmed', 'on_trip'] as const;

/** Client dashboard: currently driving. */
export const CLIENT_ACTIVE_STATUSES = ['on_trip', 'in_progress'] as const;
export const CLIENT_ACTIVE_STATUSES_DB = ['on_trip'] as const;

/** Client dashboard: paid, awaiting pickup. */
export const CLIENT_UPCOMING_STATUSES = ['confirmed', 'pending_collection'] as const;
export const CLIENT_UPCOMING_STATUSES_DB = ['confirmed'] as const;

/** Client sidebar / badge counts. */
export const CLIENT_VISIBLE_STATUSES = [
  'pending',
  'confirmed',
  'pending_collection',
  'on_trip',
  'in_progress',
] as const;

export const CLIENT_VISIBLE_STATUSES_DB = [
  'pending',
  'confirmed',
  'on_trip',
  'pending_payment_verification',
] as const;

/** Driver portal: jobs requiring action or in progress. */
export const DRIVER_ACTIVE_JOB_STATUSES = [
  'confirmed',
  'pending_collection',
  'on_trip',
  'in_progress',
] as const;

export function isPaidRevenueStatus(status: string): boolean {
  return (PAID_REVENUE_STATUSES as readonly string[]).includes(status);
}

export function isActiveBookingStatus(status: string): boolean {
  return (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(status);
}

export function isOnTripStatus(status: string): boolean {
  return status === 'on_trip' || status === 'in_progress';
}

export function bookingStatusIn(
  status: string,
  allowed: readonly string[]
): boolean {
  return allowed.includes(status);
}
