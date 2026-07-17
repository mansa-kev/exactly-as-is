function getAccessToken(req) {
    const authorizationHeader = req.headers.authorization;
    if (!authorizationHeader?.startsWith('Bearer '))
        return null;
    return authorizationHeader.slice(7);
}
export async function canManageLifecycle(supabase, userId, bookingId) {
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
    if (profile?.role === 'admin')
        return true;
    const { data: booking } = await supabase
        .from('bookings')
        .select('driver_id, fleet_owner_id')
        .eq('id', bookingId)
        .maybeSingle();
    if (!booking)
        return false;
    if (booking.driver_id === userId)
        return true;
    if (booking.fleet_owner_id === userId)
        return true;
    return false;
}
function parseInspectionBody(body) {
    const b = body || {};
    return {
        fuel_level: typeof b.fuel_level === 'string' ? b.fuel_level : undefined,
        mileage: b.mileage != null ? Number(b.mileage) : null,
        location: typeof b.location === 'string' ? b.location : undefined,
        scratches_notes: typeof b.scratches_notes === 'string' ? b.scratches_notes : undefined,
        photos_exterior: Array.isArray(b.photos_exterior) ? b.photos_exterior : [],
        photos_interior: Array.isArray(b.photos_interior) ? b.photos_interior : [],
        photo_fuel_mileage: typeof b.photo_fuel_mileage === 'string'
            ? b.photo_fuel_mileage
            : b.photo_fuel_mileage == null
                ? null
                : String(b.photo_fuel_mileage),
        gps_lat: b.gps_lat != null ? Number(b.gps_lat) : null,
        gps_lon: b.gps_lon != null ? Number(b.gps_lon) : null,
        client_signature_url: typeof b.client_signature_url === 'string' ? b.client_signature_url : null,
    };
}
async function insertInspection(supabase, bookingId, type, payload, conductedBy) {
    const { data, error } = await supabase
        .from('booking_inspections')
        .insert({
        booking_id: bookingId,
        type,
        fuel_level: payload.fuel_level || null,
        mileage: payload.mileage != null ? Number(payload.mileage) : null,
        location: payload.location || null,
        scratches_notes: payload.scratches_notes || null,
        photos_exterior: payload.photos_exterior || [],
        photos_interior: payload.photos_interior || [],
        photo_fuel_mileage: payload.photo_fuel_mileage || null,
        gps_lat: payload.gps_lat ?? null,
        gps_lon: payload.gps_lon ?? null,
        client_signature_url: payload.client_signature_url ?? null,
        conducted_by: conductedBy,
    })
        .select()
        .single();
    if (error) {
        const detail = error.message || 'Failed to save inspection record.';
        if (error.code === '23505') {
            return {
                error: 'An inspection of this type already exists for this booking.',
                status: 409,
            };
        }
        if (error.code === '42P01') {
            return {
                error: 'booking_inspections table is missing. Run scripts/fix_booking_inspections_storage.sql.',
                status: 500,
            };
        }
        return { error: detail, status: 500 };
    }
    return { inspection: data };
}
export function createBookingPickupHandler(supabase) {
    return async (req, res) => {
        const accessToken = getAccessToken(req);
        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'Authorization header is required.' });
        }
        const bookingId = String(req.params.bookingId || '');
        if (!bookingId) {
            return res.status(400).json({ success: false, error: 'bookingId is required.' });
        }
        try {
            const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
            if (authError || !authData.user) {
                return res.status(401).json({ success: false, error: 'Unauthorized session.' });
            }
            const allowed = await canManageLifecycle(supabase, authData.user.id, bookingId);
            if (!allowed) {
                return res.status(403).json({ success: false, error: 'You are not allowed to log pickup for this booking.' });
            }
            const { data: booking, error: bookingError } = await supabase
                .from('bookings')
                .select('id, status, pickup_confirmed_at, car_id')
                .eq('id', bookingId)
                .maybeSingle();
            if (bookingError || !booking) {
                return res.status(404).json({ success: false, error: 'Booking not found.' });
            }
            if (booking.pickup_confirmed_at || booking.status === 'on_trip') {
                return res.status(409).json({ success: false, error: 'Pickup has already been logged for this booking.' });
            }
            if (!['confirmed', 'pending_collection'].includes(booking.status)) {
                return res.status(409).json({
                    success: false,
                    error: `Cannot log pickup while booking status is "${booking.status}".`,
                });
            }
            const payload = parseInspectionBody(req.body);
            const inspectionResult = await insertInspection(supabase, bookingId, 'pre_handover', payload, authData.user.id);
            if ('error' in inspectionResult && inspectionResult.error) {
                return res.status(inspectionResult.status).json({ success: false, error: inspectionResult.error });
            }
            const now = new Date().toISOString();
            const pickupOdometer = payload.mileage != null ? Number(payload.mileage) : null;
            const fullUpdate = {
                status: 'on_trip',
                sub_status: 'in_transit',
                pickup_confirmed_at: now,
                pickup_confirmed_by: authData.user.id,
                actual_pickup_location: payload.location || null,
                ...(pickupOdometer != null ? { pickup_odometer: pickupOdometer } : {}),
            };
            let updated = null;
            let updateError = null;
            ({ data: updated, error: updateError } = await supabase
                .from('bookings')
                .update(fullUpdate)
                .eq('id', bookingId)
                .select()
                .single());
            if (updateError) {
                console.warn('[booking-pickup] full update failed, retrying minimal:', updateError.message);
                ({ data: updated, error: updateError } = await supabase
                    .from('bookings')
                    .update({
                    status: 'on_trip',
                    pickup_confirmed_at: now,
                })
                    .eq('id', bookingId)
                    .select()
                    .single());
            }
            if (updateError || !updated) {
                console.error('[booking-pickup] status update failed:', updateError);
                return res.status(500).json({
                    success: false,
                    error: updateError?.message ||
                        'Pickup inspection saved but booking status could not be updated. Run scripts/fix_booking_pickup_lifecycle.sql on production.',
                });
            }
            if (booking.car_id) {
                await supabase.from('cars').update({ status: 'rented' }).eq('id', booking.car_id);
            }
            return res.json({
                success: true,
                booking: updated,
                inspection: inspectionResult.inspection,
            });
        }
        catch (err) {
            console.error('[booking-pickup]', err);
            return res.status(500).json({
                success: false,
                error: err?.message || 'Failed to log pickup.',
            });
        }
    };
}
export function createBookingReturnHandler(supabase) {
    return async (req, res) => {
        const accessToken = getAccessToken(req);
        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'Authorization header is required.' });
        }
        const bookingId = String(req.params.bookingId || '');
        if (!bookingId) {
            return res.status(400).json({ success: false, error: 'bookingId is required.' });
        }
        try {
            const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
            if (authError || !authData.user) {
                return res.status(401).json({ success: false, error: 'Unauthorized session.' });
            }
            const allowed = await canManageLifecycle(supabase, authData.user.id, bookingId);
            if (!allowed) {
                return res.status(403).json({ success: false, error: 'You are not allowed to log return for this booking.' });
            }
            const { data: booking, error: bookingError } = await supabase
                .from('bookings')
                .select('id, status, return_confirmed_at, pickup_confirmed_at, car_id')
                .eq('id', bookingId)
                .maybeSingle();
            if (bookingError || !booking) {
                return res.status(404).json({ success: false, error: 'Booking not found.' });
            }
            if (booking.return_confirmed_at || booking.status === 'completed') {
                return res.status(409).json({ success: false, error: 'Return has already been logged for this booking.' });
            }
            if (booking.status !== 'on_trip' && !booking.pickup_confirmed_at) {
                return res.status(409).json({
                    success: false,
                    error: 'Pickup must be logged before return can be recorded.',
                });
            }
            const body = req.body || {};
            const payload = parseInspectionBody(body);
            const overtimeHours = body.overtime_hours != null ? Number(body.overtime_hours) : null;
            const overtimeCharge = body.overtime_charge != null ? Number(body.overtime_charge) : null;
            const inspectionResult = await insertInspection(supabase, bookingId, 'post_return', payload, authData.user.id);
            if ('error' in inspectionResult && inspectionResult.error) {
                return res.status(inspectionResult.status).json({ success: false, error: inspectionResult.error });
            }
            const now = new Date().toISOString();
            const returnOdometer = payload.mileage != null ? Number(payload.mileage) : null;
            const { data: updated, error: updateError } = await supabase
                .from('bookings')
                .update({
                status: 'completed',
                sub_status: 'completed',
                return_confirmed_at: now,
                return_confirmed_by: authData.user.id,
                return_notes: payload.scratches_notes || null,
                ...(overtimeHours != null ? { overtime_hours: overtimeHours } : {}),
                ...(overtimeCharge != null ? { overtime_charge: overtimeCharge } : {}),
                ...(returnOdometer != null ? { return_odometer: returnOdometer } : {}),
            })
                .eq('id', bookingId)
                .select()
                .single();
            if (updateError || !updated) {
                console.error('[booking-return] status update failed:', updateError);
                return res.status(500).json({
                    success: false,
                    error: updateError?.message || 'Return inspection saved but booking status could not be updated.',
                });
            }
            if (booking.car_id) {
                await supabase.from('cars').update({ status: 'available' }).eq('id', booking.car_id);
            }
            return res.json({
                success: true,
                booking: updated,
                inspection: inspectionResult.inspection,
            });
        }
        catch (err) {
            console.error('[booking-return]', err);
            return res.status(500).json({
                success: false,
                error: err?.message || 'Failed to log return.',
            });
        }
    };
}
