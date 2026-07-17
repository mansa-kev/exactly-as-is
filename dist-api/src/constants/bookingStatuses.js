/**
 * Canonical booking status groupings for analytics, dashboards, and availability.
 * Lifecycle UI uses on_trip / pending_collection; legacy code used in_progress.
 */
/** Paid bookings that count toward gross revenue / commission (client-side checks). */
export const PAID_REVENUE_STATUSES = [
    'confirmed',
    'pending_collection',
    'on_trip',
    'completed',
    'in_progress',
];
/**
 * Safe for Supabase `.in('status', …)` — only values that exist in booking_status enum.
 * Do not include pending_collection / in_progress until migrated in production DB.
 */
export const PAID_REVENUE_STATUSES_DB = [
    'confirmed',
    'on_trip',
    'completed',
];
/** Bookings currently in the rental pipeline (client-side checks). */
export const ACTIVE_BOOKING_STATUSES = [
    'confirmed',
    'pending_collection',
    'on_trip',
    'in_progress',
];
export const ACTIVE_BOOKING_STATUSES_DB = ['confirmed', 'on_trip'];
/** Statuses that block a car on the calendar / availability search. */
export const CALENDAR_BLOCKING_STATUSES = [
    'confirmed',
    'pending_collection',
    'on_trip',
    'in_progress',
];
export const CALENDAR_BLOCKING_STATUSES_DB = ['confirmed', 'on_trip'];
/** Client dashboard: currently driving. */
export const CLIENT_ACTIVE_STATUSES = ['on_trip', 'in_progress'];
export const CLIENT_ACTIVE_STATUSES_DB = ['on_trip'];
/** Client dashboard: paid, awaiting pickup. */
export const CLIENT_UPCOMING_STATUSES = ['confirmed', 'pending_collection'];
export const CLIENT_UPCOMING_STATUSES_DB = ['confirmed'];
/** Client sidebar / badge counts. */
export const CLIENT_VISIBLE_STATUSES = [
    'pending',
    'confirmed',
    'pending_collection',
    'on_trip',
    'in_progress',
];
export const CLIENT_VISIBLE_STATUSES_DB = [
    'pending',
    'confirmed',
    'on_trip',
    'pending_payment_verification',
];
/** Driver portal: jobs requiring action or in progress. */
export const DRIVER_ACTIVE_JOB_STATUSES = [
    'confirmed',
    'pending_collection',
    'on_trip',
    'in_progress',
];
export function isPaidRevenueStatus(status) {
    return PAID_REVENUE_STATUSES.includes(status);
}
export function isActiveBookingStatus(status) {
    return ACTIVE_BOOKING_STATUSES.includes(status);
}
export function isOnTripStatus(status) {
    return status === 'on_trip' || status === 'in_progress';
}
export function bookingStatusIn(status, allowed) {
    return allowed.includes(status);
}
