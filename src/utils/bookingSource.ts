import { generateVehicleSlug } from '../utils/urlUtils';
/** True when a booking was created from a paid reservation continuation. */
export function bookingFromReservation(booking: {
  source_reservation_id?: string | null;
  metadata?: Record<string, any> | null;
}): boolean {
  const meta = booking.metadata || {};
  return !!(
    booking.source_reservation_id ||
    meta.reservation_context?.reservation_id ||
    meta.from_reservation?.reservation_id
  );
}

export function getBookingReservationId(booking: {
  source_reservation_id?: string | null;
  metadata?: Record<string, any> | null;
}): string | null {
  const meta = booking.metadata || {};
  return (
    booking.source_reservation_id ||
    meta.reservation_context?.reservation_id ||
    meta.from_reservation?.reservation_id ||
    null
  );
}

export function getBookingRebookPath(booking: {
  car_id?: string | null;
  vehicle_model_id?: string | null;
  vehicle_model?: { id?: string } | null;
}): string {
  const modelId = booking.vehicle_model_id || booking.vehicle_model?.id;
  if (modelId) return `/vehicles/${generateVehicleSlug({id: modelId})}`;
  if (booking.car_id) return `/cars/${booking.car_id}`;
  return '/cars';
}
