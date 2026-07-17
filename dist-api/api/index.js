import express from "express";
import dotenv from "dotenv";
import { ncbaService } from "../src/services/ncbaService.js";
import { getSupabase, getSupabaseServiceRoleKey, getSupabaseUrl, isSupabaseConfigured, } from "../src/server/supabaseServer.js";
import { createInspectionUploadHandler } from "../src/server/inspectionUploadHandler.js";
import { createContractSaveHandler } from "../src/server/contractSaveHandler.js";
import { createDeleteBookingHandler } from "../src/server/deleteBookingHandler.js";
import { createBookingDocumentUploadHandler } from "../src/server/bookingDocumentUploadHandler.js";
import { createPrepareContinuationHandler } from "../src/server/reservationContinuationHandler.js";
import { createEmailSendHandler } from "../src/server/emailSendHandler.js";
import { createInspectionInsertHandler } from "../src/server/inspectionInsertHandler.js";
import { createBookingPickupHandler, createBookingReturnHandler, } from "../src/server/bookingLifecycleHandler.js";
import { createBookingExtendHandler } from "../src/server/bookingExtendHandler.js";
import { createDeleteReservationHandler } from "../src/server/deleteReservationHandler.js";
import { processBookingPayoutSettlements } from "../src/server/bookingPayoutSettlements.js";
import { buildBrokerMetadata, buildOutsourceMetadata, computeBookingFinancials, validateBookingTotalAmount, } from "../src/server/bookingFinancials.js";
import { applyProfileSyncFromBooking } from "../src/utils/bookingProfileSync.js";
import { CALENDAR_BLOCKING_STATUSES_DB } from "../src/constants/bookingStatuses.js";
import { getAvailableCarIdForModelDates } from "../src/server/modelUnitAvailability.js";
import { fetchPublicAppSettings } from "../src/server/publicAppSettings.js";
// In local dev we read .env.local; on Vercel env vars are injected directly
// and this call is a no-op (the file won't exist), which is fine.
dotenv.config({ path: '.env.local' });
// Lazy Supabase client — avoids crashing the Vercel function at import when env is missing.
const supabaseServiceRoleKey = getSupabaseServiceRoleKey();
const supabase = new Proxy({}, {
    get(_target, prop) {
        const client = getSupabase();
        const value = client[prop];
        return typeof value === 'function' ? value.bind(client) : value;
    },
});
const NCBA_DEFAULT_ACCOUNT_NO = '1006230208';
const getNcbaAccountNo = () => {
    const accountNo = (process.env.NCBA_ACCOUNT_NO || NCBA_DEFAULT_ACCOUNT_NO).replace(/\s+/g, '').trim();
    return /^\d+$/.test(accountNo) ? accountNo : NCBA_DEFAULT_ACCOUNT_NO;
};
const app = express();
const PORT = 3000;
// Simple in-memory rate limiter
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 requests per minute
const rateLimitMiddleware = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const record = rateLimitMap.get(ip);
    if (!record || now > record.resetTime) {
        // New window
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        next();
    }
    else {
        // Existing window
        if (record.count >= RATE_LIMIT_MAX) {
            return res.status(429).json({ error: 'Too many requests' });
        }
        record.count++;
        next();
    }
};
// Apply rate limiting to API routes
app.use('/api', rateLimitMiddleware);
app.get('/api/health', (_req, res) => {
    res.json({
        success: true,
        supabase: isSupabaseConfigured(),
        serviceRole: Boolean(supabaseServiceRoleKey),
    });
});
app.use('/api', (req, res, next) => {
    if (!isSupabaseConfigured()) {
        return res.status(503).json({
            success: false,
            error: 'Server misconfiguration: set SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, and VITE_SUPABASE_ANON_KEY in Vercel environment variables.',
        });
    }
    return next();
});
// Security headers middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
});
app.post('/api/inspections/upload', express.json({ limit: '12mb' }), createInspectionUploadHandler(supabase, Boolean(supabaseServiceRoleKey)));
app.post('/api/booking-documents/upload', express.json({ limit: '14mb' }), createBookingDocumentUploadHandler(supabase, Boolean(supabaseServiceRoleKey)));
app.post('/api/contracts/save-signed', express.json({ limit: '16mb' }), createContractSaveHandler(supabase, Boolean(supabaseServiceRoleKey)));
app.delete('/api/bookings/:bookingId', createDeleteBookingHandler(supabase, Boolean(supabaseServiceRoleKey)));
app.post('/api/email/send', express.json({ limit: '1mb' }), createEmailSendHandler(supabase));
app.post('/api/bookings/:bookingId/inspections', express.json({ limit: '2mb' }), createInspectionInsertHandler(supabase));
app.post('/api/bookings/:bookingId/pickup', express.json({ limit: '2mb' }), createBookingPickupHandler(supabase));
app.post('/api/bookings/:bookingId/return', express.json({ limit: '2mb' }), createBookingReturnHandler(supabase));
app.post('/api/bookings/:bookingId/extend', express.json({ limit: '1mb' }), createBookingExtendHandler(supabase));
app.delete('/api/reservations/:reservationId', createDeleteReservationHandler(supabase));
// Parse JSON bodies for API routes (must come before Vite middleware)
app.use('/api', express.json());
app.get('/api/public-app-settings', async (req, res) => {
    const requestedKeys = String(req.query.keys || '')
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean);
    const { settings, error } = await fetchPublicAppSettings(supabase, requestedKeys);
    res.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    if (error && settings.length === 0) {
        return res.status(500).json({ success: false, error, settings: [] });
    }
    return res.json({ success: true, settings, ...(error ? { warning: error } : {}) });
});
// ─── IMAGE PROXY ROUTE (Hides Supabase URL) ────────────────────────────────────────────
/**
 * GET /api/images/:filename
 * Proxies images from Supabase to hide the bucket structure and URL
 * Adds caching headers for performance
 */
app.get('/api/images/:filename', async (req, res) => {
    const { filename } = req.params;
    if (!filename) {
        return res.status(400).send('Filename required');
    }
    try {
        const imageUrl = `${getSupabaseUrl()}/storage/v1/object/public/public_assets/${filename}`;
        res.redirect(302, imageUrl);
    }
    catch (error) {
        console.error('Image proxy error:', error);
        res.status(500).send('Failed to fetch image');
    }
});
// ─── GENERIC ASSET PROXY (Hides Supabase URL + bucket/path) ───────────────────────────
app.get('/api/assets/:bucket/*', async (req, res) => {
    const bucket = String(req.params.bucket || '');
    const rawPath = String(req.params[0] || '');
    const filePath = rawPath.split('?')[0];
    if (!bucket || !filePath) {
        return res.status(400).json({ success: false, error: 'Bucket and filePath are required.' });
    }
    try {
        const redirectUrl = `${getSupabaseUrl()}/storage/v1/object/public/${bucket}/${filePath}`;
        res.redirect(302, redirectUrl);
    }
    catch (err) {
        console.error('[asset-proxy]', err);
        return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch asset' });
    }
});
// ─── NCBA STK PUSH API ROUTES ─────────────────────────────────────
const finalizeNcbaPayment = async (paymentRequest, queryResult) => {
    const now = new Date().toISOString();
    if (queryResult.paid) {
        await supabase
            .from('payment_requests')
            .update({
            status: 'success',
            status_description: queryResult.description || 'Success',
            raw_query_response: queryResult.raw || null,
            updated_at: now,
            confirmed_at: now,
        })
            .eq('id', paymentRequest.id);
        await supabase
            .from('bookings')
            .update({
            status: 'confirmed',
            payment_status: 'paid',
            payment_method: 'ncba_stk',
            payment_provider: 'ncba',
            payment_reference: paymentRequest.provider_reference_id,
            transaction_code: paymentRequest.provider_transaction_id,
        })
            .eq('id', paymentRequest.booking_id);
        const { data: existingTx } = await supabase
            .from('transactions')
            .select('id')
            .eq('booking_id', paymentRequest.booking_id)
            .eq('transaction_code', paymentRequest.provider_transaction_id)
            .maybeSingle();
        if (!existingTx) {
            await supabase.from('transactions').insert({
                booking_id: paymentRequest.booking_id,
                user_id: paymentRequest.client_id,
                amount: paymentRequest.amount,
                type: 'payment_in',
                status: 'completed',
                transaction_code: paymentRequest.provider_transaction_id,
            });
        }
        await processBookingPayoutSettlements(supabase, paymentRequest.booking_id);
        if (paymentRequest.client_id) {
            await supabase.from('notifications').insert({
                user_id: paymentRequest.client_id,
                title: 'Payment Received',
                content: `Your NCBA STK payment of KES ${Number(paymentRequest.amount).toLocaleString()} has been received. Booking confirmed!`,
                type: 'success',
                is_read: false,
                link: `/bookings/${paymentRequest.booking_id}`,
            }).then(() => { }, (err) => console.error('[NCBA] Notification insert error:', err));
        }
    }
    else if (queryResult.failed) {
        await supabase
            .from('payment_requests')
            .update({
            status: 'failed',
            status_description: queryResult.description || 'Payment failed',
            raw_query_response: queryResult.raw || null,
            updated_at: now,
            failed_at: now,
        })
            .eq('id', paymentRequest.id);
        await supabase
            .from('bookings')
            .update({
            status: 'pending_payment_verification',
            payment_status: 'pending',
            payment_method: 'ncba_stk',
            payment_provider: 'ncba',
        })
            .eq('id', paymentRequest.booking_id);
    }
    else {
        await supabase
            .from('payment_requests')
            .update({
            status: 'pending',
            status_description: queryResult.description || 'Payment pending',
            raw_query_response: queryResult.raw || null,
            updated_at: now,
        })
            .eq('id', paymentRequest.id);
    }
};
const finalizeReservationNcbaPayment = async (paymentRequest, queryResult) => {
    const now = new Date().toISOString();
    if (queryResult.paid) {
        await supabase
            .from('reservation_payment_requests')
            .update({
            status: 'success',
            status_description: queryResult.description || 'Success',
            raw_query_response: queryResult.raw || null,
            updated_at: now,
            confirmed_at: now,
        })
            .eq('id', paymentRequest.id);
        const { data: reservation } = await supabase
            .from('car_reservations')
            .select('id, car_id, vehicle_model_id, client_id, fleet_owner_id, reservation_fee, total_amount, booking_completion_token')
            .eq('id', paymentRequest.reservation_id)
            .maybeSingle();
        await supabase
            .from('car_reservations')
            .update({
            status: 'reserved',
            payment_status: 'paid',
            payment_method: 'ncba_stk',
            payment_provider: 'ncba',
            payment_reference: paymentRequest.provider_reference_id,
            transaction_code: paymentRequest.provider_transaction_id,
        })
            .eq('id', paymentRequest.reservation_id);
        if (reservation) {
            try {
                const { data: existingRevenue } = await supabase
                    .from('reservation_revenue')
                    .select('id')
                    .eq('reservation_id', reservation.id)
                    .eq('transaction_code', paymentRequest.provider_transaction_id)
                    .maybeSingle();
                if (!existingRevenue) {
                    await supabase.from('reservation_revenue').insert({
                        reservation_id: reservation.id,
                        car_id: reservation.car_id,
                        fleet_owner_id: reservation.fleet_owner_id,
                        client_id: reservation.client_id,
                        reservation_fee: reservation.reservation_fee,
                        total_reservation_value: reservation.total_amount,
                        payment_method: 'ncba_stk',
                        transaction_code: paymentRequest.provider_transaction_id,
                        recorded_at: now,
                        status: 'collected',
                    });
                }
            }
            catch (revenueError) {
                if (revenueError?.code !== '42P01' && !revenueError?.message?.includes('relation "reservation_revenue" does not exist')) {
                    console.error('[NCBA Reservation] Revenue insert error:', revenueError);
                }
            }
            if (reservation.client_id) {
                const continuationPath = reservation.car_id
                    ? `/cars/${reservation.car_id}`
                    : reservation.vehicle_model_id
                        ? `/models/${reservation.vehicle_model_id}`
                        : '/cars';
                const continuationLink = `${continuationPath}?booking=true&reservationToken=${reservation.booking_completion_token}`;
                await supabase.from('notifications').insert({
                    user_id: reservation.client_id,
                    title: 'Reservation Confirmed',
                    content: `Your NCBA reservation fee of KES ${Number(paymentRequest.amount).toLocaleString()} has been received. You can now complete the full booking flow.`,
                    type: 'success',
                    is_read: false,
                    link: continuationLink,
                }).then(() => { }, (err) => console.error('[NCBA Reservation] Notification insert error:', err));
            }
        }
    }
    else if (queryResult.failed) {
        await supabase
            .from('reservation_payment_requests')
            .update({
            status: 'failed',
            status_description: queryResult.description || 'Payment failed',
            raw_query_response: queryResult.raw || null,
            updated_at: now,
            failed_at: now,
        })
            .eq('id', paymentRequest.id);
        await supabase
            .from('car_reservations')
            .update({
            status: 'pending_payment',
            payment_status: 'pending',
            payment_method: 'ncba_stk',
            payment_provider: 'ncba',
        })
            .eq('id', paymentRequest.reservation_id);
    }
    else {
        await supabase
            .from('reservation_payment_requests')
            .update({
            status: 'pending',
            status_description: queryResult.description || 'Payment pending',
            raw_query_response: queryResult.raw || null,
            updated_at: now,
        })
            .eq('id', paymentRequest.id);
    }
};
const checkBookingAvailability = async (carId, startDate, endDate, ignoreReservationId) => {
    const { data: bookings, error: bookingError } = await supabase
        .from('bookings')
        .select('start_date, end_date, status')
        .eq('car_id', carId)
        .in('status', ['confirmed', 'on_trip']);
    let reservationQuery = supabase
        .from('car_reservations')
        .select('id, start_date, end_date, status')
        .eq('car_id', carId)
        .in('status', ['reserved', 'confirmed']);
    if (ignoreReservationId) {
        reservationQuery = reservationQuery.neq('id', ignoreReservationId);
    }
    const { data: reservations, error: reservationError } = await reservationQuery;
    if (bookingError || reservationError) {
        throw bookingError || reservationError;
    }
    const requestedStart = new Date(startDate);
    const requestedEnd = new Date(endDate);
    const hasOverlap = (existingStart, existingEnd) => {
        const currentStart = new Date(existingStart);
        const currentEnd = new Date(existingEnd);
        return ((requestedStart >= currentStart && requestedStart <= currentEnd) ||
            (requestedEnd >= currentStart && requestedEnd <= currentEnd) ||
            (requestedStart <= currentStart && requestedEnd >= currentEnd));
    };
    return !(bookings || []).some((item) => hasOverlap(item.start_date, item.end_date))
        && !(reservations || []).some((item) => hasOverlap(item.start_date, item.end_date));
};
// ─── ADMIN-DIRECTED USER DELETION AND CREATION ──────────────────────
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const authorizationHeader = req.headers.authorization;
    const accessToken = authorizationHeader?.startsWith('Bearer ')
        ? authorizationHeader.slice(7)
        : null;
    if (!accessToken) {
        return res.status(401).json({ success: false, error: 'Authorization header is required.' });
    }
    try {
        const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
        if (authError || !authData.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized session.' });
        }
        const { data: profile, error: profileErr } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', authData.user.id)
            .single();
        if (profileErr || profile?.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Forbidden: Admin access required.' });
        }
        // Delete from user_profiles to ensure UI removal
        const { error: profileDeleteError } = await supabase
            .from('user_profiles')
            .delete()
            .eq('id', id);
        if (profileDeleteError) {
            console.error('Failed to delete user profile:', profileDeleteError);
        }
        // Delete from auth.users
        const { error: deleteError } = await supabase.auth.admin.deleteUser(id);
        if (deleteError) {
            console.error('Failed to delete auth user:', deleteError);
            // We still return 200 if profile was deleted, or maybe 500 if both failed.
            // But if profile was deleted, the user is effectively gone from the app.
        }
        return res.status(200).json({ success: true, message: 'User deleted successfully.' });
    }
    catch (err) {
        console.error('Delete user error:', err);
        return res.status(500).json({ success: false, error: err.message || 'Internal server error.' });
    }
});
app.post('/api/users', async (req, res) => {
    const authorizationHeader = req.headers.authorization;
    const accessToken = authorizationHeader?.startsWith('Bearer ')
        ? authorizationHeader.slice(7)
        : null;
    if (!accessToken) {
        return res.status(401).json({ success: false, error: 'Authorization header is required.' });
    }
    try {
        const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
        if (authError || !authData.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized session.' });
        }
        const { data: profile, error: profileErr } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', authData.user.id)
            .single();
        if (profileErr || profile?.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Forbidden: Admin access required.' });
        }
        const { email, password, role, fullName, phoneNumber, licenseNumber, companyName, commissionRate } = req.body;
        if (!email || !role || !fullName || !phoneNumber) {
            return res.status(400).json({ success: false, error: 'Email, role, full name, and phone number are required.' });
        }
        // Create the user in auth.users with email auto-confirmed
        const { data: createData, error: createError } = await supabase.auth.admin.createUser({
            email,
            password: password || (role === 'fleet_owner' ? 'Fleet123!' : 'Driver123!'),
            email_confirm: true,
            user_metadata: {
                role,
                full_name: fullName,
            }
        });
        if (createError || !createData.user) {
            console.error('Error creating auth user:', createError);
            return res.status(500).json({ success: false, error: createError?.message || 'Failed to create auth user.' });
        }
        const userId = createData.user.id;
        // Upsert user profile
        const { error: profileUpsertError } = await supabase
            .from('user_profiles')
            .upsert({
            id: userId,
            full_name: fullName,
            email,
            phone_number: phoneNumber,
            role,
            status: 'active'
        });
        if (profileUpsertError) {
            console.error('Error upserting user profile:', profileUpsertError);
            return res.status(500).json({ success: false, error: profileUpsertError.message });
        }
        // Role specific profile setup
        if (role === 'fleet_owner') {
            const { error: settingsError } = await supabase
                .from('fleet_owner_settings')
                .upsert({
                id: userId,
                company_name: companyName || '',
                commission_rate: commissionRate != null ? Number(commissionRate) : 0.15,
                status: 'active'
            });
            if (settingsError) {
                console.error('Error creating fleet owner settings:', settingsError);
                return res.status(500).json({ success: false, error: settingsError.message });
            }
        }
        else if (role === 'driver') {
            const { error: driverProfileError } = await supabase
                .from('driver_profiles')
                .upsert({
                id: userId,
                license_number: licenseNumber || '',
                license_status: 'verified',
                id_status: 'verified',
                status: 'active'
            });
            if (driverProfileError) {
                console.error('Error creating driver profile:', driverProfileError);
                return res.status(500).json({ success: false, error: driverProfileError.message });
            }
        }
        return res.status(201).json({ success: true, userId, message: 'User created successfully.' });
    }
    catch (err) {
        console.error('Create user endpoint error:', err);
        return res.status(500).json({ success: false, error: err.message || 'Internal server error.' });
    }
});
app.post('/api/reservations', async (req, res) => {
    try {
        if (!supabaseServiceRoleKey) {
            return res.status(500).json({
                success: false,
                error: 'SUPABASE_SERVICE_ROLE_KEY is required for public reservation creation.',
            });
        }
        const { carId, vehicleModelId, startDate, endDate, contactName, contactEmail, contactPhone, notes } = req.body;
        if ((!carId && !vehicleModelId) || !startDate || !endDate || !contactName || !contactEmail || !contactPhone) {
            return res.status(400).json({ success: false, error: 'Missing required reservation fields.' });
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
            return res.status(400).json({ success: false, error: 'Please provide a valid reservation date range.' });
        }
        let resolvedCarId = carId || null;
        let dailyRate = 0;
        let fleetOwnerId = null;
        if (resolvedCarId) {
            const { data: car, error: carError } = await supabase
                .from('cars')
                .select('id, fleet_owner_id, daily_rate')
                .eq('id', resolvedCarId)
                .single();
            if (carError || !car) {
                return res.status(404).json({ success: false, error: 'Car not found.' });
            }
            fleetOwnerId = car.fleet_owner_id || null;
            dailyRate = Number(car.daily_rate || 0);
        }
        else {
            const { data: model, error: modelError } = await supabase
                .from('vehicle_models')
                .select('id, base_daily_rate')
                .eq('id', vehicleModelId)
                .eq('is_public', true)
                .single();
            if (modelError || !model) {
                return res.status(404).json({ success: false, error: 'Vehicle model not found.' });
            }
            dailyRate = Number(model.base_daily_rate || 0);
            const assignedCarId = await getAvailableCarIdForModelDates(supabase, vehicleModelId, startDate, endDate);
            if (!assignedCarId) {
                return res.status(409).json({
                    success: false,
                    error: 'Selected dates are not available for this model.',
                });
            }
            resolvedCarId = assignedCarId;
        }
        if (!fleetOwnerId) {
            const { data: adminUser } = await supabase
                .from('user_profiles')
                .select('id')
                .eq('role', 'admin')
                .limit(1)
                .single();
            if (adminUser) {
                fleetOwnerId = adminUser.id;
            }
            else {
                return res.status(409).json({ success: false, error: 'No general fleet is available.' });
            }
        }
        let clientId = null;
        const authorizationHeader = req.headers.authorization;
        const accessToken = authorizationHeader?.startsWith('Bearer ')
            ? authorizationHeader.slice(7)
            : null;
        if (accessToken) {
            const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
            if (authError) {
                return res.status(401).json({ success: false, error: 'Failed to verify your session.' });
            }
            clientId = authData.user?.id || null;
        }
        const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        let reservationFee = req.body.reservationFee != null ? Number(req.body.reservationFee) : null;
        if (reservationFee == null || Number.isNaN(reservationFee)) {
            const { data: feeSetting } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'reservation_fee')
                .maybeSingle();
            reservationFee = Number(feeSetting?.value || 500);
        }
        const totalAmount = reservationFee + (dailyRate * days);
        const firstTokenPart = globalThis.crypto?.randomUUID?.().replace(/-/g, '') || `${Date.now()}`;
        const secondTokenPart = globalThis.crypto?.randomUUID?.().replace(/-/g, '') || `${Math.random().toString(36).slice(2)}`;
        const continuationToken = `${firstTokenPart}${secondTokenPart}`;
        const { data: reservation, error: reservationError } = await supabase
            .from('car_reservations')
            .insert({
            car_id: resolvedCarId,
            vehicle_model_id: vehicleModelId || null,
            client_id: clientId,
            fleet_owner_id: fleetOwnerId,
            start_date: startDate,
            end_date: endDate,
            reservation_fee: reservationFee,
            total_amount: totalAmount,
            contact_name: contactName,
            contact_email: contactEmail,
            contact_phone: contactPhone,
            notes: notes || null,
            status: 'pending_payment',
            payment_status: 'pending',
            payment_method: 'ncba_stk',
            payment_provider: 'ncba',
            payment_reference: null,
            transaction_code: null,
            booking_completion_token: continuationToken,
            linked_booking_id: null,
            booking_flow_started_at: null,
            booking_flow_initiated_by: null,
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        })
            .select()
            .single();
        if (reservationError || !reservation) {
            return res.status(500).json({ success: false, error: reservationError?.message || 'Failed to create reservation.' });
        }
        return res.status(201).json({ success: true, reservation });
    }
    catch (error) {
        console.error('[API] Reservation create error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});
// Flag Booking Endpoint
app.patch('/api/bookings/:id/flag', async (req, res) => {
    try {
        const { id } = req.params;
        const { is_flagged, flag_reason } = req.body;
        const { data, error } = await supabase
            .from('bookings')
            .update({ is_flagged, flag_reason })
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        res.json({ success: true, booking: data });
    }
    catch (error) {
        console.error('[API] Flag booking error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Legacy extend path (same handler as :bookingId/extend)
app.post('/api/bookings/:id/extend', express.json({ limit: '1mb' }), createBookingExtendHandler(supabase));
// Create Inspection Endpoint
app.post('/api/bookings/:id/inspections', async (req, res) => {
    try {
        const { id } = req.params;
        const { type, fuel_level, mileage, location, scratches_notes, photos_exterior, photos_interior, photo_fuel_mileage, conducted_by } = req.body;
        const { data: inspection, error } = await supabase
            .from('booking_inspections')
            .insert([{
                booking_id: id, type, fuel_level, mileage, location,
                scratches_notes, photos_exterior, photos_interior,
                photo_fuel_mileage, conducted_by
            }])
            .select()
            .single();
        if (error)
            throw error;
        // Update booking sub_status based on inspection type
        const newSubStatus = type === 'pre_handover' ? 'in_transit' : 'completed';
        await supabase.from('bookings').update({ sub_status: newSubStatus }).eq('id', id);
        res.json({ success: true, inspection });
    }
    catch (error) {
        console.error('[API] Create inspection error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/bookings', express.json({ limit: '2mb' }), async (req, res) => {
    try {
        if (!supabaseServiceRoleKey) {
            return res.status(500).json({
                success: false,
                error: 'SUPABASE_SERVICE_ROLE_KEY is required for public booking creation.',
            });
        }
        const bookingData = req.body || {};
        const { carId: rawCarId, vehicleModelId, startDate, endDate, totalAmount, pickupLocation, dropoffLocation, location, paymentMethod, sourceReservationId, reservationContinuationToken, bookingFlowInitiatedBy, brokerId, brokerCommissionRate: brokerRate, brokerCommissionAmount, } = bookingData;
        if ((!rawCarId && !vehicleModelId) || !startDate || !endDate || totalAmount == null) {
            return res.status(400).json({ success: false, error: 'Missing required booking fields.' });
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
            return res.status(400).json({ success: false, error: 'Please provide a valid booking date range.' });
        }
        let clientId = null;
        const authorizationHeader = req.headers.authorization;
        const accessToken = authorizationHeader?.startsWith('Bearer ')
            ? authorizationHeader.slice(7)
            : null;
        if (accessToken) {
            const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
            if (authError) {
                return res.status(401).json({ success: false, error: 'Failed to verify your session.' });
            }
            clientId = authData.user?.id || null;
        }
        let sourceReservation = null;
        if (sourceReservationId) {
            const { data: reservation, error: reservationError } = await supabase
                .from('car_reservations')
                .select('id, car_id, vehicle_model_id, fleet_owner_id, client_id, start_date, end_date, status, payment_status, linked_booking_id, booking_completion_token')
                .eq('id', sourceReservationId)
                .single();
            if (reservationError || !reservation) {
                return res.status(404).json({ success: false, error: 'Reservation continuation was not found.' });
            }
            if (reservation.payment_status !== 'paid' || !['reserved', 'confirmed'].includes(reservation.status)) {
                return res.status(409).json({ success: false, error: 'Only paid active reservations can be completed into a booking.' });
            }
            if (rawCarId && reservation.car_id && reservation.car_id !== rawCarId) {
                return res.status(409).json({ success: false, error: 'This reservation does not match the selected vehicle.' });
            }
            if (vehicleModelId && reservation.vehicle_model_id && reservation.vehicle_model_id !== vehicleModelId) {
                return res.status(409).json({ success: false, error: 'This reservation does not match the selected model.' });
            }
            if (reservationContinuationToken && reservation.booking_completion_token !== reservationContinuationToken) {
                return res.status(409).json({ success: false, error: 'The reservation continuation link is no longer valid.' });
            }
            sourceReservation = reservation;
        }
        let resolvedCarId = rawCarId || null;
        let modelOnlyBooking = false;
        if (!resolvedCarId && vehicleModelId) {
            const { data: candidateCars, error: candidateCarsError } = await supabase
                .from('cars')
                .select('id')
                .eq('status', 'available')
                .eq('vehicle_model_id', vehicleModelId)
                .order('created_at', { ascending: true })
                .limit(200);
            if (candidateCarsError) {
                return res.status(500).json({ success: false, error: candidateCarsError.message || 'Failed to load available units.' });
            }
            const candidateIds = (candidateCars || []).map((c) => c.id);
            if (candidateIds.length) {
                const { data: blockingBookings, error: blockingBookingsError } = await supabase
                    .from('bookings')
                    .select('car_id, start_date, end_date')
                    .in('car_id', candidateIds)
                    .in('status', [...CALENDAR_BLOCKING_STATUSES_DB]);
                if (blockingBookingsError) {
                    return res.status(500).json({ success: false, error: blockingBookingsError.message || 'Failed to check unit availability.' });
                }
                let reservationQuery = supabase
                    .from('car_reservations')
                    .select('id, car_id, vehicle_model_id, start_date, end_date, status, expires_at')
                    .in('status', ['reserved', 'confirmed', 'pending_payment']);
                if (sourceReservationId) {
                    reservationQuery = reservationQuery.neq('id', sourceReservationId);
                }
                const { data: blockingReservations, error: blockingReservationsError } = await reservationQuery;
                if (blockingReservationsError) {
                    return res.status(500).json({ success: false, error: blockingReservationsError.message || 'Failed to check reservation availability.' });
                }
                const hasOverlap = (existingStart, existingEnd) => {
                    const requestedStart = new Date(startDate);
                    const requestedEnd = new Date(endDate);
                    const currentStart = new Date(existingStart);
                    const currentEnd = new Date(existingEnd);
                    return ((requestedStart >= currentStart && requestedStart <= currentEnd) ||
                        (requestedEnd >= currentStart && requestedEnd <= currentEnd) ||
                        (requestedStart <= currentStart && requestedEnd >= currentEnd));
                };
                const blocked = new Set();
                for (const booking of blockingBookings || []) {
                    if (hasOverlap(booking.start_date, booking.end_date)) {
                        blocked.add(booking.car_id);
                    }
                }
                let modelOnlyHolds = 0;
                for (const reservation of blockingReservations || []) {
                    if (reservation.status === 'pending_payment' && reservation.expires_at && new Date(reservation.expires_at) < new Date()) {
                        continue; // ignore expired pending_payment reservations
                    }
                    if (!hasOverlap(reservation.start_date, reservation.end_date))
                        continue;
                    if (reservation.car_id && candidateIds.includes(reservation.car_id)) {
                        blocked.add(reservation.car_id);
                    }
                    else if (!reservation.car_id && reservation.vehicle_model_id === vehicleModelId) {
                        modelOnlyHolds += 1;
                    }
                }
                const freeUnits = candidateIds.filter((id) => !blocked.has(id));
                const selected = freeUnits.length > modelOnlyHolds ? freeUnits[0] : null;
                if (selected) {
                    resolvedCarId = selected;
                }
                else {
                    modelOnlyBooking = true;
                }
            }
            else {
                modelOnlyBooking = true;
            }
        }
        if (!resolvedCarId && !modelOnlyBooking) {
            return res.status(400).json({ success: false, error: 'Missing required booking fields.' });
        }
        if (resolvedCarId) {
            const available = await checkBookingAvailability(resolvedCarId, startDate, endDate, sourceReservationId || undefined);
            if (!available) {
                return res.status(409).json({ success: false, error: 'Selected dates are not available. The car is either booked or reserved for these dates.' });
            }
        }
        let carRow = null;
        let fleetOwnerId = sourceReservation?.fleet_owner_id || null;
        let rateForValidation = 0;
        if (resolvedCarId) {
            const { data: carData, error: carRowError } = await supabase
                .from('cars')
                .select('id, fleet_owner_id, daily_rate, is_outsourced, outsource_commission_rate, outsource_owner_name, outsource_owner_email, outsource_owner_phone')
                .eq('id', resolvedCarId)
                .single();
            if (carRowError || !carData) {
                return res.status(404).json({ success: false, error: 'Could not find the selected car. Please try again.' });
            }
            carRow = carData;
            fleetOwnerId = fleetOwnerId || carRow.fleet_owner_id || null;
            rateForValidation = Number(carRow.daily_rate || 0);
        }
        else {
            const { data: modelRow } = await supabase
                .from('vehicle_models')
                .select('base_daily_rate')
                .eq('id', vehicleModelId)
                .maybeSingle();
            rateForValidation = Number(modelRow?.base_daily_rate || 0);
            carRow = {
                id: null,
                fleet_owner_id: null,
                daily_rate: rateForValidation,
                is_outsourced: false,
            };
        }
        if (!fleetOwnerId) {
            const { data: adminUser } = await supabase
                .from('user_profiles')
                .select('id')
                .eq('role', 'admin')
                .limit(1)
                .single();
            if (adminUser) {
                fleetOwnerId = adminUser.id;
            }
            else {
                return res.status(409).json({ success: false, error: 'This car is not assigned to a fleet owner and no general fleet is available.' });
            }
        }
        const total = Number(totalAmount);
        if (vehicleModelId) {
            const { data: modelRow } = await supabase
                .from('vehicle_models')
                .select('base_daily_rate')
                .eq('id', vehicleModelId)
                .maybeSingle();
            if (modelRow?.base_daily_rate != null) {
                rateForValidation = Number(modelRow.base_daily_rate);
            }
        }
        const amountCheck = validateBookingTotalAmount(total, rateForValidation, start, end);
        if (amountCheck.ok === false) {
            return res.status(400).json({ success: false, error: amountCheck.error });
        }
        const financials = await computeBookingFinancials(supabase, carRow, fleetOwnerId, total);
        const statusToken = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/-/g, '');
        const payload = {
            car_id: resolvedCarId,
            vehicle_model_id: vehicleModelId || null,
            client_id: clientId || sourceReservation?.client_id || null,
            fleet_owner_id: fleetOwnerId,
            start_date: startDate,
            end_date: endDate,
            pickup_location: pickupLocation || location,
            dropoff_location: dropoffLocation || pickupLocation || location,
            total_amount: total,
            platform_commission: financials.platformCommission,
            document_status: bookingData.documentsVerifiedPhysically ? 'approved' : 'pending',
            status: 'pending_payment_verification',
            payment_status: 'pending',
            payment_method: paymentMethod || 'ncba_stk',
            payment_provider: 'ncba',
            source_reservation_id: sourceReservationId || null,
            broker_id: brokerId || null,
            broker_commission_rate: brokerId ? Number(brokerRate) || 0 : 0,
            broker_commission_amount: brokerId ? Number(brokerCommissionAmount) || 0 : 0,
            metadata: {
                broker_info: buildBrokerMetadata(brokerId, brokerRate, brokerCommissionAmount),
                model_only_booking: modelOnlyBooking,
                reservation_context: sourceReservationId ? {
                    reservation_id: sourceReservationId,
                    continuation_token: reservationContinuationToken || null,
                } : null,
                guest_info: {
                    full_name: bookingData.fullName,
                    email: bookingData.email,
                    phone: bookingData.phone,
                    license_number: bookingData.license,
                    id_number: bookingData.idNumber || null,
                },
                signature_url: bookingData.signatureUrl,
                documentsVerifiedPhysically: !!bookingData.documentsVerifiedPhysically,
                documents: bookingData.documents ?? {
                    facePhotoUrl: bookingData.facePhotoUrl || null,
                    licenseFrontUrl: bookingData.licenseFrontUrl || null,
                    licenseBackUrl: bookingData.licenseBackUrl || null,
                    idFrontUrl: bookingData.idFrontUrl || null,
                    idBackUrl: bookingData.idBackUrl || null,
                },
                client_status_token: statusToken,
                commission_rate_applied: financials.commissionRate,
                commission_source: financials.commissionSource,
                owner_payout_amount: financials.ownerPayoutAmount,
                outsource_info: buildOutsourceMetadata(carRow),
            },
        };
        const withStatusToken = (b) => {
            if (!b)
                return b;
            const token = b?.metadata?.client_status_token || statusToken;
            return { ...b, statusToken: token };
        };
        if (sourceReservation?.linked_booking_id) {
            const { data: existingBooking, error: existingBookingError } = await supabase
                .from('bookings')
                .select('*')
                .eq('id', sourceReservation.linked_booking_id)
                .maybeSingle();
            if (!existingBookingError && existingBooking) {
                if (existingBooking.payment_status === 'paid') {
                    return res.status(409).json({ success: false, error: 'This reservation has already been completed.' });
                }
                const existingToken = existingBooking?.metadata?.client_status_token;
                const mergedPayload = existingToken
                    ? { ...payload, metadata: { ...payload.metadata, client_status_token: existingToken } }
                    : payload;
                const { data: updatedBooking, error: updateBookingError } = await supabase
                    .from('bookings')
                    .update(mergedPayload)
                    .eq('id', existingBooking.id)
                    .select()
                    .single();
                if (updateBookingError || !updatedBooking) {
                    return res.status(500).json({ success: false, error: updateBookingError?.message || 'Failed to update booking.' });
                }
                return res.json({ success: true, booking: withStatusToken(updatedBooking) });
            }
        }
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .insert([payload])
            .select()
            .single();
        if (bookingError || !booking) {
            return res.status(500).json({ success: false, error: bookingError?.message || 'Failed to create booking.' });
        }
        if (clientId) {
            try {
                await applyProfileSyncFromBooking(supabase, clientId, booking, bookingData);
            }
            catch (err) {
                console.error('Failed to sync booking documents to profile:', err);
            }
        }
        if (sourceReservationId) {
            const { error: reservationUpdateError } = await supabase
                .from('car_reservations')
                .update({
                linked_booking_id: booking.id,
                booking_flow_started_at: new Date().toISOString(),
                booking_flow_initiated_by: bookingFlowInitiatedBy || 'client',
                booking_completion_token: null,
            })
                .eq('id', sourceReservationId);
            if (reservationUpdateError) {
                return res.status(500).json({ success: false, error: reservationUpdateError.message || 'Failed to link booking to reservation.' });
            }
        }
        return res.status(201).json({ success: true, booking: withStatusToken(booking) });
    }
    catch (error) {
        console.error('[API] Booking create error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});
app.post('/api/ncba/stk-push', async (req, res) => {
    try {
        const { phone, bookingId } = req.body;
        if (!phone || !bookingId) {
            return res.status(400).json({ success: false, error: 'Missing required fields: phone, bookingId' });
        }
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('id, status, payment_status, client_id, total_amount')
            .eq('id', bookingId)
            .single();
        if (bookingError || !booking) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }
        if (booking.payment_status === 'paid') {
            return res.status(409).json({ success: false, error: 'This booking is already paid' });
        }
        const publicConfig = ncbaService.getPublicConfig();
        const accountNo = getNcbaAccountNo();
        if (!accountNo) {
            return res.status(500).json({ success: false, error: 'NCBA account number is not configured' });
        }
        const result = await ncbaService.initiateSTKPush({
            phone,
            amount: Number(booking.total_amount),
            accountNo,
        });
        const now = new Date().toISOString();
        const { data: paymentRequest, error: paymentError } = await supabase
            .from('payment_requests')
            .insert({
            booking_id: booking.id,
            client_id: booking.client_id || null,
            provider: 'ncba',
            channel: 'stk',
            phone: ncbaService.formatPhone(phone),
            amount: booking.total_amount,
            currency: 'KES',
            paybill_no: publicConfig.paybillNo,
            account_no: accountNo,
            network: publicConfig.network,
            transaction_type: publicConfig.transactionType,
            provider_transaction_id: result.transactionId || null,
            provider_reference_id: result.referenceId || null,
            status: result.success ? 'pending' : 'failed',
            status_code: result.statusCode || null,
            status_description: result.statusDescription || result.error || null,
            raw_initiate_response: result.raw || null,
            updated_at: now,
            failed_at: result.success ? null : now,
        })
            .select()
            .single();
        if (paymentError) {
            return res.status(500).json({ success: false, error: paymentError.message });
        }
        await supabase
            .from('bookings')
            .update({
            status: 'pending_payment_verification',
            payment_status: 'pending',
            payment_method: 'ncba_stk',
            payment_provider: 'ncba',
            payment_reference: result.referenceId || null,
            transaction_code: result.transactionId || null,
        })
            .eq('id', booking.id);
        return res.json({
            success: result.success,
            paymentRequestId: paymentRequest.id,
            transactionId: result.transactionId,
            referenceId: result.referenceId,
            statusCode: result.statusCode,
            statusDescription: result.statusDescription,
            error: result.error,
        });
    }
    catch (error) {
        console.error('[API] NCBA STK Push error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});
app.post('/api/ncba/query', async (req, res) => {
    try {
        const { paymentRequestId } = req.body;
        if (!paymentRequestId) {
            return res.status(400).json({ success: false, error: 'Missing paymentRequestId' });
        }
        const { data: paymentRequest, error: paymentError } = await supabase
            .from('payment_requests')
            .select('*')
            .eq('id', paymentRequestId)
            .single();
        if (paymentError || !paymentRequest) {
            return res.status(404).json({ success: false, error: 'Payment request not found' });
        }
        if (!paymentRequest.provider_transaction_id) {
            return res.json({ success: true, paid: false, failed: false, pending: true, status: 'PENDING', description: 'Waiting for NCBA to assign a transaction ID' });
        }
        if (paymentRequest.status === 'success') {
            return res.json({ success: true, paid: true, failed: false, pending: false, status: 'SUCCESS', description: 'Already confirmed' });
        }
        const result = await ncbaService.querySTKPush(paymentRequest.provider_transaction_id);
        await finalizeNcbaPayment(paymentRequest, result);
        return res.json({
            success: result.success,
            paid: result.paid,
            failed: result.failed,
            pending: result.pending,
            status: result.status,
            description: result.description,
            error: result.error,
        });
    }
    catch (error) {
        console.error('[API] NCBA Query error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});
app.get('/api/ncba/payment-status/:bookingId', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { data: booking, error } = await supabase
            .from('bookings')
            .select('id, status, payment_status, payment_method, payment_provider, payment_reference, transaction_code')
            .eq('id', bookingId)
            .single();
        if (error || !booking) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }
        let { data: paymentRequest } = await supabase
            .from('payment_requests')
            .select('*')
            .eq('booking_id', bookingId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        let currentBooking = booking;
        if (currentBooking.payment_status !== 'paid' &&
            paymentRequest?.provider_transaction_id &&
            paymentRequest.status !== 'success') {
            const ageMs = Date.now() - new Date(paymentRequest.created_at).getTime();
            if (ageMs >= 15000) {
                const result = await ncbaService.querySTKPush(paymentRequest.provider_transaction_id);
                await finalizeNcbaPayment(paymentRequest, result);
                const { data: refreshedBooking } = await supabase
                    .from('bookings')
                    .select('id, status, payment_status, payment_method, payment_provider, payment_reference, transaction_code')
                    .eq('id', bookingId)
                    .single();
                const { data: refreshedPaymentRequest } = await supabase
                    .from('payment_requests')
                    .select('*')
                    .eq('booking_id', bookingId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (refreshedBooking)
                    currentBooking = refreshedBooking;
                if (refreshedPaymentRequest)
                    paymentRequest = refreshedPaymentRequest;
            }
        }
        return res.json({
            success: true,
            bookingId: currentBooking.id,
            status: currentBooking.status,
            paymentStatus: currentBooking.payment_status,
            paid: currentBooking.payment_status === 'paid',
            confirmed: currentBooking.status === 'confirmed',
            paymentRequest,
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/ncba/sync-booking/:bookingId', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { data: paymentRequest, error: paymentError } = await supabase
            .from('payment_requests')
            .select('*')
            .eq('booking_id', bookingId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (paymentError || !paymentRequest) {
            return res.status(404).json({ success: false, error: 'No payment request found for this booking' });
        }
        if (!paymentRequest.provider_transaction_id) {
            return res.json({ success: true, paid: false, failed: false, pending: true, status: 'PENDING', description: 'Waiting for NCBA to assign a transaction ID' });
        }
        if (paymentRequest.status === 'success') {
            return res.json({
                success: true,
                paid: true,
                failed: false,
                pending: false,
                status: 'SUCCESS',
                description: 'Already confirmed',
            });
        }
        const result = await ncbaService.querySTKPush(paymentRequest.provider_transaction_id);
        await finalizeNcbaPayment(paymentRequest, result);
        return res.json({
            success: result.success,
            paid: result.paid,
            failed: result.failed,
            pending: result.pending,
            status: result.status,
            description: result.description,
            error: result.error,
        });
    }
    catch (error) {
        console.error('[API] NCBA sync-booking error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});
app.post('/api/ncba/reservations/stk-push', async (req, res) => {
    try {
        const { phone, reservationId } = req.body;
        if (!phone || !reservationId) {
            return res.status(400).json({ success: false, error: 'Missing required fields: phone, reservationId' });
        }
        const { data: reservation, error: reservationError } = await supabase
            .from('car_reservations')
            .select('id, car_id, status, payment_status, client_id, reservation_fee, booking_completion_token')
            .eq('id', reservationId)
            .single();
        if (reservationError || !reservation) {
            return res.status(404).json({ success: false, error: 'Reservation not found' });
        }
        if (reservation.payment_status === 'paid') {
            return res.status(409).json({ success: false, error: 'This reservation is already paid' });
        }
        if (['cancelled', 'expired'].includes(reservation.status)) {
            return res.status(409).json({ success: false, error: 'This reservation is no longer active' });
        }
        const publicConfig = ncbaService.getPublicConfig();
        const accountNo = getNcbaAccountNo();
        if (!accountNo) {
            return res.status(500).json({ success: false, error: 'NCBA account number is not configured' });
        }
        const amount = Number(reservation.reservation_fee);
        const result = await ncbaService.initiateSTKPush({
            phone,
            amount,
            accountNo,
        });
        const now = new Date().toISOString();
        const { data: paymentRequest, error: paymentError } = await supabase
            .from('reservation_payment_requests')
            .insert({
            reservation_id: reservation.id,
            client_id: reservation.client_id || null,
            provider: 'ncba',
            channel: 'stk',
            phone: ncbaService.formatPhone(phone),
            amount,
            currency: 'KES',
            paybill_no: publicConfig.paybillNo,
            account_no: accountNo,
            network: publicConfig.network,
            transaction_type: publicConfig.transactionType,
            provider_transaction_id: result.transactionId || null,
            provider_reference_id: result.referenceId || null,
            status: result.success ? 'pending' : 'failed',
            status_code: result.statusCode || null,
            status_description: result.statusDescription || result.error || null,
            raw_initiate_response: result.raw || null,
            updated_at: now,
            failed_at: result.success ? null : now,
        })
            .select()
            .single();
        if (paymentError) {
            return res.status(500).json({ success: false, error: paymentError.message });
        }
        await supabase
            .from('car_reservations')
            .update({
            status: 'pending_payment',
            payment_status: 'pending',
            payment_method: 'ncba_stk',
            payment_provider: 'ncba',
            payment_reference: result.referenceId || null,
            transaction_code: result.transactionId || null,
        })
            .eq('id', reservation.id);
        return res.json({
            success: result.success,
            paymentRequestId: paymentRequest.id,
            transactionId: result.transactionId,
            referenceId: result.referenceId,
            statusCode: result.statusCode,
            statusDescription: result.statusDescription,
            error: result.error,
        });
    }
    catch (error) {
        console.error('[API] NCBA Reservation STK Push error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});
app.post('/api/ncba/reservations/query', async (req, res) => {
    try {
        const { paymentRequestId } = req.body;
        if (!paymentRequestId) {
            return res.status(400).json({ success: false, error: 'Missing paymentRequestId' });
        }
        const { data: paymentRequest, error: paymentError } = await supabase
            .from('reservation_payment_requests')
            .select('*')
            .eq('id', paymentRequestId)
            .single();
        if (paymentError || !paymentRequest) {
            return res.status(404).json({ success: false, error: 'Reservation payment request not found' });
        }
        if (!paymentRequest.provider_transaction_id) {
            return res.json({ success: true, paid: false, failed: false, pending: true, status: 'PENDING', description: 'Waiting for NCBA to assign a transaction ID' });
        }
        if (paymentRequest.status === 'success') {
            return res.json({ success: true, paid: true, failed: false, pending: false, status: 'SUCCESS', description: 'Already confirmed' });
        }
        const result = await ncbaService.querySTKPush(paymentRequest.provider_transaction_id);
        await finalizeReservationNcbaPayment(paymentRequest, result);
        return res.json({
            success: result.success,
            paid: result.paid,
            failed: result.failed,
            pending: result.pending,
            status: result.status,
            description: result.description,
            error: result.error,
        });
    }
    catch (error) {
        console.error('[API] NCBA Reservation Query error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});
app.get('/api/ncba/reservations/payment-status/:reservationId', async (req, res) => {
    try {
        const { reservationId } = req.params;
        const { data: reservation, error } = await supabase
            .from('car_reservations')
            .select('id, car_id, status, payment_status, payment_method, payment_provider, payment_reference, transaction_code, booking_completion_token, linked_booking_id')
            .eq('id', reservationId)
            .single();
        if (error || !reservation) {
            return res.status(404).json({ success: false, error: 'Reservation not found' });
        }
        const { data: paymentRequest } = await supabase
            .from('reservation_payment_requests')
            .select('*')
            .eq('reservation_id', reservationId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        return res.json({
            success: true,
            reservationId: reservation.id,
            status: reservation.status,
            paymentStatus: reservation.payment_status,
            paid: reservation.payment_status === 'paid',
            reserved: reservation.status === 'reserved' || reservation.status === 'confirmed',
            linkedBookingId: reservation.linked_booking_id || null,
            reservationToken: reservation.booking_completion_token || null,
            paymentRequest,
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/reservations/:reservationId/prepare-continuation', createPrepareContinuationHandler(supabase));
app.get('/api/reservations/continuation/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { data: reservation, error } = await supabase
            .from('car_reservations')
            .select('id, car_id, vehicle_model_id, start_date, end_date, reservation_fee, total_amount, status, payment_status, contact_name, contact_email, contact_phone, linked_booking_id')
            .eq('booking_completion_token', token)
            .single();
        if (error || !reservation) {
            return res.status(404).json({ success: false, error: 'Reservation continuation link not found' });
        }
        if (reservation.payment_status !== 'paid' || !['reserved', 'confirmed'].includes(reservation.status)) {
            return res.status(409).json({ success: false, error: 'This reservation is not ready for booking completion' });
        }
        const estimatedBookingAmount = Math.max(Number(reservation.total_amount || 0) - Number(reservation.reservation_fee || 0), 0);
        return res.json({
            success: true,
            reservationId: reservation.id,
            carId: reservation.car_id,
            vehicleModelId: reservation.vehicle_model_id || null,
            startDate: reservation.start_date,
            endDate: reservation.end_date,
            contactName: reservation.contact_name,
            contactEmail: reservation.contact_email,
            contactPhone: reservation.contact_phone,
            estimatedBookingAmount,
            reservationFee: Number(reservation.reservation_fee || 0),
            linkedBookingId: reservation.linked_booking_id || null,
            bookingData: {
                startDate: reservation.start_date,
                endDate: reservation.end_date,
                fullName: reservation.contact_name,
                email: reservation.contact_email,
                phone: reservation.contact_phone,
                sourceReservationId: reservation.id,
                reservationContinuationToken: token,
                bookingFlowInitiatedBy: 'client',
            },
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});
// ─── CAR SHARE — OG TAG SERVING FOR SOCIAL CRAWLERS ─────────────────
// WhatsApp/Telegram/Facebook crawlers don't run JS, so we serve OG HTML
// server-side. Real users get next() → React SPA handles the route.
app.get('/cars/:id', async (req, res, next) => {
    const ua = req.headers['user-agent'] || '';
    const isCrawler = /facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|telegram|slackbot|discordbot|googlebot|bingbot|applebot|pinterest|snapchat|skype|yahoo|bot|crawl|spider/i.test(ua);
    if (!isCrawler)
        return next();
    try {
        const { data: car } = await supabase
            .from('cars')
            .select('id, make, model, year, daily_rate, seats, transmission, primary_image_url, photos, description, vehicle_model_id')
            .eq('id', req.params.id)
            .single();
        if (!car)
            return next();
        if (car.vehicle_model_id) {
            const { data: model } = await supabase
                .from('vehicle_models')
                .select('id, make, model, year, display_name, base_daily_rate, seats, transmission, primary_image_url, gallery_urls, description')
                .eq('id', car.vehicle_model_id)
                .single();
            if (model) {
                const modelImage = model.primary_image_url ||
                    (Array.isArray(model.gallery_urls) && model.gallery_urls[0]) ||
                    car.primary_image_url ||
                    (Array.isArray(car.photos) && car.photos[0]) ||
                    'https://linkedupcarsrentals.com/logo.png';
                const modelTitle = `${model.display_name || `${model.make} ${model.model}`} | Hire in Nairobi — LinkedUp Cars`;
                const modelDesc = `Hire the ${model.display_name || `${model.make} ${model.model}`} in Nairobi from KES ${Number(model.base_daily_rate || car.daily_rate).toLocaleString()}/day. ${model.seats || car.seats} seats · ${model.transmission || car.transmission}. Tap to book instantly.`;
                const modelUrl = `https://linkedupcarsrentals.com/models/${model.id}?booking=true`;
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.send(`<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="utf-8">
  <title>${modelTitle}</title>
  <meta name="description" content="${modelDesc}">
  <meta property="og:title"       content="${modelTitle}">
  <meta property="og:description" content="${modelDesc}">
  <meta property="og:image"       content="${modelImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url"         content="${modelUrl}">
  <meta property="og:type"        content="product">
  <meta property="og:site_name"   content="LinkedUp Cars">
  <meta name="twitter:card"       content="summary_large_image">
  <meta name="twitter:title"      content="${modelTitle}">
  <meta name="twitter:description" content="${modelDesc}">
  <meta name="twitter:image"      content="${modelImage}">
  <meta http-equiv="refresh" content="0; url=${modelUrl}">
  <script>window.location.replace("${modelUrl}");</script>
</head><body>
  <p>Redirecting&#8230; <a href="${modelUrl}">${modelTitle}</a></p>
</body></html>`);
                return;
            }
        }
        const carImage = car.primary_image_url ||
            (Array.isArray(car.photos) && car.photos[0]) ||
            'https://linkedupcarsrentals.com/logo.png';
        const carTitle = `${car.make} ${car.model} ${car.year} | Hire in Nairobi — LinkedUp Cars`;
        const carDesc = `Book the ${car.make} ${car.model} (${car.year}) in Nairobi from KES ${Number(car.daily_rate).toLocaleString()}/day. ${car.seats} seats · ${car.transmission}. Tap to book instantly.`;
        const carUrl = `https://linkedupcarsrentals.com/cars/${car.id}?booking=true`;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(`<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="utf-8">
  <title>${carTitle}</title>
  <meta name="description" content="${carDesc}">
  <meta property="og:title"       content="${carTitle}">
  <meta property="og:description" content="${carDesc}">
  <meta property="og:image"       content="${carImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url"         content="${carUrl}">
  <meta property="og:type"        content="product">
  <meta property="og:site_name"   content="LinkedUp Cars">
  <meta name="twitter:card"       content="summary_large_image">
  <meta name="twitter:title"      content="${carTitle}">
  <meta name="twitter:description" content="${carDesc}">
  <meta name="twitter:image"      content="${carImage}">
  <meta http-equiv="refresh" content="0; url=${carUrl}">
  <script>window.location.replace("${carUrl}");</script>
</head><body>
  <p>Redirecting&#8230; <a href="${carUrl}">${carTitle}</a></p>
</body></html>`);
    }
    catch (_) {
        next();
    }
});
app.get('/models/:id', async (req, res, next) => {
    const ua = req.headers['user-agent'] || '';
    const isCrawler = /facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|telegram|slackbot|discordbot|googlebot|bingbot|applebot|pinterest|snapchat|skype|yahoo|bot|crawl|spider/i.test(ua);
    if (!isCrawler)
        return next();
    try {
        const { data: model } = await supabase
            .from('vehicle_models')
            .select('id, make, model, year, display_name, base_daily_rate, seats, transmission, primary_image_url, gallery_urls, description')
            .eq('id', req.params.id)
            .single();
        if (!model)
            return next();
        const modelImage = model.primary_image_url ||
            (Array.isArray(model.gallery_urls) && model.gallery_urls[0]) ||
            'https://linkedupcarsrentals.com/logo.png';
        const modelTitle = `${model.display_name || `${model.make} ${model.model}`} | Hire in Nairobi — LinkedUp Cars`;
        const modelDesc = `Hire the ${model.display_name || `${model.make} ${model.model}`} in Nairobi from KES ${Number(model.base_daily_rate).toLocaleString()}/day. ${model.seats} seats · ${model.transmission}. Tap to book instantly.`;
        const modelUrl = `https://linkedupcarsrentals.com/models/${model.id}?booking=true`;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(`<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="utf-8">
  <title>${modelTitle}</title>
  <meta name="description" content="${modelDesc}">
  <meta property="og:title"       content="${modelTitle}">
  <meta property="og:description" content="${modelDesc}">
  <meta property="og:image"       content="${modelImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url"         content="${modelUrl}">
  <meta property="og:type"        content="product">
  <meta property="og:site_name"   content="LinkedUp Cars">
  <meta name="twitter:card"       content="summary_large_image">
  <meta name="twitter:title"      content="${modelTitle}">
  <meta name="twitter:description" content="${modelDesc}">
  <meta name="twitter:image"      content="${modelImage}">
  <meta http-equiv="refresh" content="0; url=${modelUrl}">
  <script>window.location.replace("${modelUrl}");</script>
</head><body>
  <p>Redirecting&#8230; <a href="${modelUrl}">${modelTitle}</a></p>
</body></html>`);
    }
    catch (_) {
        next();
    }
});
export default app;
