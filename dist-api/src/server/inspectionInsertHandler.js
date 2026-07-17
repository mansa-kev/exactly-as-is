function getAccessToken(req) {
    const authorizationHeader = req.headers.authorization;
    if (!authorizationHeader?.startsWith('Bearer '))
        return null;
    return authorizationHeader.slice(7);
}
async function canManageInspection(supabase, userId, bookingId) {
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
export function createInspectionInsertHandler(supabase) {
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
            const allowed = await canManageInspection(supabase, authData.user.id, bookingId);
            if (!allowed) {
                return res.status(403).json({ success: false, error: 'You are not allowed to log inspections for this booking.' });
            }
            const { type, fuel_level, mileage, location, scratches_notes, photos_exterior, photos_interior, photo_fuel_mileage, } = req.body || {};
            if (!type || !['pre_handover', 'post_return'].includes(type)) {
                return res.status(400).json({ success: false, error: 'type must be pre_handover or post_return.' });
            }
            const { data, error } = await supabase
                .from('booking_inspections')
                .insert({
                booking_id: bookingId,
                type,
                fuel_level: fuel_level || null,
                mileage: mileage != null ? Number(mileage) : null,
                location: location || null,
                scratches_notes: scratches_notes || null,
                photos_exterior: photos_exterior || [],
                photos_interior: photos_interior || [],
                photo_fuel_mileage: photo_fuel_mileage || null,
                conducted_by: authData.user.id,
            })
                .select()
                .single();
            if (error) {
                if (error.code === '23505') {
                    return res.status(409).json({
                        success: false,
                        error: 'An inspection of this type already exists for this booking.',
                    });
                }
                return res.status(500).json({ success: false, error: error.message });
            }
            return res.status(201).json({ success: true, inspection: data });
        }
        catch (err) {
            console.error('[inspection-insert]', err);
            return res.status(500).json({
                success: false,
                error: err?.message || 'Failed to save inspection.',
            });
        }
    };
}
