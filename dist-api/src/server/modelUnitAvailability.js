import { CALENDAR_BLOCKING_STATUSES_DB } from '../constants/bookingStatuses.js';
export function datesOverlap(startDate, endDate, existingStart, existingEnd) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const currentStart = new Date(existingStart);
    const currentEnd = new Date(existingEnd);
    return ((start >= currentStart && start <= currentEnd) ||
        (end >= currentStart && end <= currentEnd) ||
        (start <= currentStart && end >= currentEnd));
}
export async function isModelAvailableForDates(supabase, vehicleModelId, startDate, endDate, options = {}) {
    const { data: candidateCars, error: candidateCarsError } = await supabase
        .from('cars')
        .select('id')
        .eq('status', 'available')
        .eq('vehicle_model_id', vehicleModelId)
        .order('created_at', { ascending: true })
        .limit(200);
    if (candidateCarsError)
        return false;
    const candidateIds = (candidateCars || []).map((car) => car.id);
    if (!candidateIds.length)
        return false;
    let bookingQuery = supabase
        .from('bookings')
        .select('id, car_id, start_date, end_date')
        .in('car_id', candidateIds)
        .in('status', [...CALENDAR_BLOCKING_STATUSES_DB]);
    if (options.ignoreBookingId) {
        bookingQuery = bookingQuery.neq('id', options.ignoreBookingId);
    }
    const { data: blockingBookings, error: blockingBookingsError } = await bookingQuery;
    if (blockingBookingsError)
        return false;
    let reservationQuery = supabase
        .from('car_reservations')
        .select('id, car_id, vehicle_model_id, start_date, end_date, status, expires_at')
        .in('status', ['reserved', 'confirmed', 'pending_payment']);
    if (options.ignoreReservationId) {
        reservationQuery = reservationQuery.neq('id', options.ignoreReservationId);
    }
    const { data: blockingReservations, error: blockingReservationsError } = await reservationQuery;
    if (blockingReservationsError)
        return false;
    const blocked = new Set();
    for (const booking of blockingBookings || []) {
        if (datesOverlap(startDate, endDate, booking.start_date, booking.end_date)) {
            blocked.add(booking.car_id);
        }
    }
    let modelOnlyHolds = 0;
    for (const reservation of blockingReservations || []) {
        if (['reserved', 'pending_payment'].includes(reservation.status) && reservation.expires_at && new Date(reservation.expires_at) < new Date()) {
            continue;
        }
        if (!datesOverlap(startDate, endDate, reservation.start_date, reservation.end_date))
            continue;
        if (reservation.car_id && candidateIds.includes(reservation.car_id)) {
            blocked.add(reservation.car_id);
        }
        else if (!reservation.car_id && reservation.vehicle_model_id === vehicleModelId) {
            modelOnlyHolds += 1;
        }
    }
    const freeUnits = candidateIds.filter((id) => !blocked.has(id));
    return freeUnits.length > modelOnlyHolds;
}
export async function getAvailableCarIdForModelDates(supabase, vehicleModelId, startDate, endDate, options = {}) {
    const { data: candidateCars, error: candidateCarsError } = await supabase
        .from('cars')
        .select('id')
        .eq('status', 'available')
        .eq('vehicle_model_id', vehicleModelId)
        .order('created_at', { ascending: true })
        .limit(200);
    if (candidateCarsError)
        return null;
    const candidateIds = (candidateCars || []).map((car) => car.id);
    if (!candidateIds.length)
        return null;
    let bookingQuery = supabase
        .from('bookings')
        .select('id, car_id, start_date, end_date')
        .in('car_id', candidateIds)
        .in('status', [...CALENDAR_BLOCKING_STATUSES_DB]);
    if (options.ignoreBookingId) {
        bookingQuery = bookingQuery.neq('id', options.ignoreBookingId);
    }
    const { data: blockingBookings } = await bookingQuery;
    let reservationQuery = supabase
        .from('car_reservations')
        .select('id, car_id, vehicle_model_id, start_date, end_date, status, expires_at')
        .in('status', ['reserved', 'confirmed', 'pending_payment']);
    if (options.ignoreReservationId) {
        reservationQuery = reservationQuery.neq('id', options.ignoreReservationId);
    }
    const { data: blockingReservations } = await reservationQuery;
    const blocked = new Set();
    for (const booking of blockingBookings || []) {
        if (datesOverlap(startDate, endDate, booking.start_date, booking.end_date)) {
            blocked.add(booking.car_id);
        }
    }
    let modelOnlyHolds = 0;
    for (const reservation of blockingReservations || []) {
        if (['reserved', 'pending_payment'].includes(reservation.status) && reservation.expires_at && new Date(reservation.expires_at) < new Date()) {
            continue;
        }
        if (!datesOverlap(startDate, endDate, reservation.start_date, reservation.end_date))
            continue;
        if (reservation.car_id && candidateIds.includes(reservation.car_id)) {
            blocked.add(reservation.car_id);
        }
        else if (!reservation.car_id && reservation.vehicle_model_id === vehicleModelId) {
            modelOnlyHolds += 1;
        }
    }
    const freeUnits = candidateIds.filter((id) => !blocked.has(id));
    if (freeUnits.length > modelOnlyHolds) {
        return freeUnits[modelOnlyHolds];
    }
    return null;
}
