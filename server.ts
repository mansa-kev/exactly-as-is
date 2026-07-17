import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { ncbaService } from "./src/services/ncbaService.js";
import { createInspectionUploadHandler } from "./src/server/inspectionUploadHandler.js";
import { createContractSaveHandler } from "./src/server/contractSaveHandler.js";
import { createDeleteBookingHandler } from "./src/server/deleteBookingHandler.js";
import { createBookingDocumentUploadHandler } from "./src/server/bookingDocumentUploadHandler.js";
import { createPrepareContinuationHandler } from "./src/server/reservationContinuationHandler.js";
import { createEmailSendHandler } from "./src/server/emailSendHandler.js";
import { createInspectionInsertHandler } from "./src/server/inspectionInsertHandler.js";
import {
  createBookingPickupHandler,
  createBookingReturnHandler,
} from "./src/server/bookingLifecycleHandler.js";
import { createBookingExtendHandler } from "./src/server/bookingExtendHandler.js";
import { createDeleteReservationHandler } from "./src/server/deleteReservationHandler.js";
import { processBookingPayoutSettlements } from "./src/server/bookingPayoutSettlements.js";
import { applyProfileSyncFromBooking, linkBookingAndSyncProfile } from "./src/utils/bookingProfileSync.js";
import { CALENDAR_BLOCKING_STATUSES_DB } from "./src/constants/bookingStatuses.js";
import { isModelAvailableForDates, getAvailableCarIdForModelDates } from "./src/server/modelUnitAvailability.js";
import { fetchPublicAppSettings } from "./src/server/publicAppSettings.js";
import { storageDownloadToBuffer } from "./src/server/storageDownloadBuffer.js";

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Server-side Supabase client (uses service role or anon key) — lazy so missing
// env vars don't crash the dev server at module load.
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://edroffvtzrowpsooszqh.supabase.co';
const supabaseServiceRoleKey = process.env.SB_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseKey = supabaseServiceRoleKey || process.env.VITE_SUPABASE_ANON_KEY || '';

let _supabase: any = null;
const getSupabase = (): any => {
  if (!_supabase) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase env vars missing: set VITE_SUPABASE_URL and a key (SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY) in .env.local');
    }
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
};
const supabase: any = new Proxy({}, {
  get: (_t, prop) => getSupabase()[prop],
});

const NCBA_DEFAULT_ACCOUNT_NO = '1006230208';

const getNcbaAccountNo = () => {
  const accountNo = (process.env.NCBA_ACCOUNT_NO || NCBA_DEFAULT_ACCOUNT_NO).replace(/\s+/g, '').trim();
  return /^\d+$/.test(accountNo) ? accountNo : NCBA_DEFAULT_ACCOUNT_NO;
};

if (!supabaseUrl || !supabaseKey) {
  console.warn('[server] ⚠️ Supabase env vars missing — API routes that need Supabase will return errors until VITE_SUPABASE_URL and a key are set in .env.local');
}

async function startServer() {
  const app = express();
  const portArgIdx = process.argv.indexOf('--port');
  const PORT = portArgIdx !== -1 ? Number(process.argv[portArgIdx + 1]) : Number(process.env.PORT) || 8080;

  // Simple in-memory rate limiter
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  const RATE_LIMIT_MAX = 100; // 100 requests per minute

  const rateLimitMiddleware = (req: any, res: any, next: any) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now > record.resetTime) {
      // New window
      rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      next();
    } else {
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

  // Security headers middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  });

  // Inspection photo upload needs a larger body limit (base64 images)
  app.post(
    '/api/inspections/upload',
    express.json({ limit: '12mb' }),
    createInspectionUploadHandler(supabase, Boolean(supabaseServiceRoleKey))
  );

  app.post(
    '/api/booking-documents/upload',
    express.json({ limit: '14mb' }),
    createBookingDocumentUploadHandler(supabase, Boolean(supabaseServiceRoleKey))
  );

  app.post(
    '/api/contracts/save-signed',
    express.json({ limit: '16mb' }),
    createContractSaveHandler(supabase, Boolean(supabaseServiceRoleKey))
  );

  app.delete(
    '/api/bookings/:bookingId',
    createDeleteBookingHandler(supabase, Boolean(supabaseServiceRoleKey))
  );

  app.post('/api/email/send', express.json({ limit: '1mb' }), createEmailSendHandler(supabase));

  app.post(
    '/api/bookings/:bookingId/inspections',
    express.json({ limit: '2mb' }),
    createInspectionInsertHandler(supabase)
  );

  app.post(
    '/api/bookings/:bookingId/pickup',
    express.json({ limit: '2mb' }),
    createBookingPickupHandler(supabase)
  );

  app.post(
    '/api/bookings/:bookingId/return',
    express.json({ limit: '2mb' }),
    createBookingReturnHandler(supabase)
  );

  app.post(
    '/api/bookings/:bookingId/extend',
    express.json({ limit: '1mb' }),
    createBookingExtendHandler(supabase)
  );

  app.delete(
    '/api/reservations/:reservationId',
    createDeleteReservationHandler(supabase)
  );

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
      const { getSupabaseUrl } = await import('./src/server/supabaseServer.js');
      const imageUrl = `${getSupabaseUrl()}/storage/v1/object/public/public_assets/${filename}`;
      res.redirect(302, imageUrl);
    } catch (error) {
      console.error('Image proxy error:', error);
      res.status(500).send('Failed to fetch image');
    }
  });

  // ─── GENERIC ASSET PROXY (Hides Supabase URL + bucket/path) ───────────────────────────
  // Usage: /api/assets/<bucket>/<filePath>
  // Example: /api/assets/public_assets/e_contracts/signed-contract-<id>.pdf
  app.get('/api/assets/:bucket/*', async (req, res) => {
    const bucket = String(req.params.bucket || '');
    const rawPath = String((req.params as any)[0] || '');
    const filePath = rawPath.split('?')[0];

    if (!bucket || !filePath) {
      return res.status(400).json({ success: false, error: 'Bucket and filePath are required.' });
    }

    try {
      const { getSupabaseUrl } = await import('./src/server/supabaseServer.js');
      const redirectUrl = `${getSupabaseUrl()}/storage/v1/object/public/${bucket}/${filePath}`;
      res.redirect(302, redirectUrl);
    } catch (err: any) {
      console.error('[asset-proxy]', err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch asset' });
    }
  });

  // ─── DOCUMENT PROXY (Hides Supabase URL and forces inline display for PDFs) ───────────
  app.get('/api/documents/proxy/:bucket/*', async (req, res) => {
    const bucket = String(req.params.bucket || '');
    const rawPath = String((req.params as any)[0] || '');
    const filePath = rawPath.split('?')[0];

    if (!bucket || !filePath) {
      return res.status(400).send('Bucket and filePath are required.');
    }

    try {
      const { getSupabaseUrl } = await import('./src/server/supabaseServer.js');
      const targetUrl = `${getSupabaseUrl()}/storage/v1/object/public/${bucket}/${filePath}`;
      const response = await fetch(targetUrl);
      if (!response.ok) {
        return res.status(response.status).send('Document not found');
      }

      const contentType = response.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);

      res.removeHeader('X-Frame-Options');
      res.setHeader('Content-Disposition', 'inline');

      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      console.error('Doc proxy error:', err);
      res.status(500).send('Failed to load document');
    }
  });

  app.get('/api/documents/proxy', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl || !targetUrl.includes('supabase.co')) {
      return res.status(400).send('Valid URL required');
    }
    
    try {
      const response = await fetch(targetUrl);
      if (!response.ok) {
        return res.status(response.status).send('Document not found');
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      
      // Remove the global X-Frame-Options DENY header so this can be iframed
      res.removeHeader('X-Frame-Options');
      
      // Force inline display so it renders in iframes without downloading
      res.setHeader('Content-Disposition', 'inline');
      
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      console.error('Doc proxy error:', err);
      res.status(500).send('Failed to load document');
    }
  });

  // ─── NCBA STK PUSH API ROUTES ─────────────────────────────────────

  const finalizeNcbaPayment = async (paymentRequest: any, queryResult: any) => {
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
        }).then(() => {}, (err: any) => console.error('[NCBA] Notification insert error:', err));
      }
    } else if (queryResult.failed) {
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
    } else {
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

  const finalizeReservationNcbaPayment = async (paymentRequest: any, queryResult: any) => {
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
        } catch (revenueError: any) {
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
          }).then(() => {}, (err: any) => console.error('[NCBA Reservation] Notification insert error:', err));
        }
      }
    } else if (queryResult.failed) {
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
    } else {
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

  const checkBookingAvailability = async (carId: string, startDate: string, endDate: string, ignoreReservationId?: string) => {
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
    const hasOverlap = (existingStart: string, existingEnd: string) => {
      const currentStart = new Date(existingStart);
      const currentEnd = new Date(existingEnd);
      return (
        (requestedStart >= currentStart && requestedStart <= currentEnd) ||
        (requestedEnd >= currentStart && requestedEnd <= currentEnd) ||
        (requestedStart <= currentStart && requestedEnd >= currentEnd)
      );
    };

    return !(bookings || []).some((item: any) => hasOverlap(item.start_date, item.end_date))
      && !(reservations || []).some((item: any) => hasOverlap(item.start_date, item.end_date));
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
    } catch (err: any) {
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

      const {
        email,
        password,
        role,
        fullName,
        phoneNumber,
        licenseNumber,
        companyName,
        commissionRate
      } = req.body;

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

      let userId = '';

      if (createError) {
        if (createError.code === 'email_exists' || (createError as any).status === 422) {
          const { data: existingProfile } = await supabase.from('user_profiles').select('id').eq('email', email).single();
          if (existingProfile) {
            userId = existingProfile.id;
          } else {
            return res.status(422).json({ success: false, error: 'User exists but profile not found.' });
          }
        } else {
          console.error('Error creating auth user:', createError);
          const status = (createError as any)?.status || 500;
          return res.status(status).json({ success: false, error: createError?.message || 'Failed to create auth user.' });
        }
      } else {
        userId = createData.user!.id;
      }

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
      } else if (role === 'driver') {
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
    } catch (err: any) {
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

      let fleetOwnerId: string | null = null;
      let dailyRate = 0;
      let resolvedCarId: string | null = carId || null;

      if (resolvedCarId) {
        const { data: car, error: carError } = await supabase
          .from('cars')
          .select('id, fleet_owner_id, daily_rate, vehicle_model_id')
          .eq('id', resolvedCarId)
          .single();

        if (carError || !car) {
          return res.status(404).json({ success: false, error: 'Car not found.' });
        }

        fleetOwnerId = car.fleet_owner_id || null;
        dailyRate = Number(car.daily_rate || 0);
      } else {
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

        const assignedCarId = await getAvailableCarIdForModelDates(
          supabase,
          vehicleModelId,
          startDate,
          endDate
        );
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
        } else {
          return res.status(409).json({ success: false, error: 'This car is not assigned to a fleet owner and no general fleet is available.' });
        }
      }

      let clientId: string | null = null;
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
      const { data: feeSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'reservation_fee')
        .maybeSingle();

      const reservationFee = Number(feeSetting?.value || 500);
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
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (reservationError || !reservation) {
        return res.status(500).json({ success: false, error: reservationError?.message || 'Failed to create reservation.' });
      }

      return res.status(201).json({ success: true, reservation });
    } catch (error: any) {
      console.error('[API] Reservation create error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  });

  app.post('/api/bookings', async (req, res) => {
    try {
      if (!supabaseServiceRoleKey) {
        return res.status(500).json({
          success: false,
          error: 'SUPABASE_SERVICE_ROLE_KEY is required for public booking creation.',
        });
      }

      const bookingData = req.body || {};
      const {
        carId: rawCarId,
        vehicleModelId,
        startDate,
        endDate,
        totalAmount,
        pickupLocation,
        dropoffLocation,
        location,
        paymentMethod,
        sourceReservationId,
        reservationContinuationToken,
        bookingFlowInitiatedBy,
        brokerId,
        brokerCommissionRate: brokerRate,
        brokerCommissionAmount,
      } = bookingData;

      if ((!rawCarId && !vehicleModelId) || !startDate || !endDate || totalAmount == null) {
        return res.status(400).json({ success: false, error: 'Missing required booking fields.' });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
        return res.status(400).json({ success: false, error: 'Please provide a valid booking date range.' });
      }

      let clientId: string | null = null;
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

      let sourceReservation: any = null;
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

      let resolvedCarId: string | null = rawCarId || null;

      // Model-based booking: allocate a concrete unit car internally.
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

        const candidateIds = (candidateCars || []).map((c: any) => c.id);
        if (!candidateIds.length) {
          return res.status(409).json({ success: false, error: 'No available units exist for this model.' });
        }

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
          .select('id, car_id, vehicle_model_id, start_date, end_date, status')
          .in('status', ['reserved', 'confirmed', 'pending_payment']);

        if (sourceReservationId) {
          reservationQuery = reservationQuery.neq('id', sourceReservationId);
        }

        const { data: blockingReservations, error: blockingReservationsError } = await reservationQuery;
        if (blockingReservationsError) {
          return res.status(500).json({ success: false, error: blockingReservationsError.message || 'Failed to check reservation availability.' });
        }

        const hasOverlap = (existingStart: string, existingEnd: string) => {
          const requestedStart = new Date(startDate);
          const requestedEnd = new Date(endDate);
          const currentStart = new Date(existingStart);
          const currentEnd = new Date(existingEnd);
          return (
            (requestedStart >= currentStart && requestedStart <= currentEnd) ||
            (requestedEnd >= currentStart && requestedEnd <= currentEnd) ||
            (requestedStart <= currentStart && requestedEnd >= currentEnd)
          );
        };

        const blocked = new Set<string>();
        for (const booking of blockingBookings || []) {
          if (hasOverlap(booking.start_date, booking.end_date)) {
            blocked.add(booking.car_id);
          }
        }

        let modelOnlyHolds = 0;
        for (const reservation of blockingReservations || []) {
          if (!hasOverlap(reservation.start_date, reservation.end_date)) continue;
          if (reservation.car_id && candidateIds.includes(reservation.car_id)) {
            blocked.add(reservation.car_id);
          } else if (!reservation.car_id && reservation.vehicle_model_id === vehicleModelId) {
            modelOnlyHolds += 1;
          }
        }

        const freeUnits = candidateIds.filter((id: string) => !blocked.has(id));
        const selected = freeUnits.length > modelOnlyHolds ? freeUnits[0] : null;

        if (!selected) {
          return res.status(409).json({ success: false, error: 'Selected dates are not available for this model.' });
        }

        resolvedCarId = selected;
      }

      if (!resolvedCarId) {
        return res.status(400).json({ success: false, error: 'Missing required booking fields.' });
      }

      const available = await checkBookingAvailability(resolvedCarId, startDate, endDate, sourceReservationId || undefined);
      if (!available) {
        return res.status(409).json({ success: false, error: 'Selected dates are not available. The car is either booked or reserved for these dates.' });
      }

      // Always fetch the car for daily_rate (server-side amount validation)
      const { data: carRow, error: carRowError } = await supabase
        .from('cars')
        .select('id, fleet_owner_id, daily_rate, is_outsourced, outsource_commission_rate, outsource_owner_name, outsource_owner_email, outsource_owner_phone')
        .eq('id', resolvedCarId)
        .single();

      if (carRowError || !carRow) {
        return res.status(404).json({ success: false, error: 'Could not find the selected car. Please try again.' });
      }

      let fleetOwnerId = sourceReservation?.fleet_owner_id || carRow.fleet_owner_id || null;

      if (!fleetOwnerId) {
        const { data: adminUser } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('role', 'admin')
          .limit(1)
          .single();
        if (adminUser) {
          fleetOwnerId = adminUser.id;
        } else {
          return res.status(409).json({ success: false, error: 'This car is not assigned to a fleet owner and no general fleet is available.' });
        }
      }

      // ── Server-side amount validation ──
      let dailyRate = Number(carRow.daily_rate || 0);
      if (vehicleModelId) {
        const { data: modelRow } = await supabase
          .from('vehicle_models')
          .select('base_daily_rate')
          .eq('id', vehicleModelId)
          .maybeSingle();
        if (modelRow?.base_daily_rate != null) {
          dailyRate = Number(modelRow.base_daily_rate);
        }
      }
      const msPerDay = 1000 * 60 * 60 * 24;
      const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / msPerDay));
      const expected = dailyRate * days;
      const total = Number(totalAmount);

      if (!Number.isFinite(total) || total <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid total amount.' });
      }
      // Allow promo discounts down to 50% of expected, and no more than 20% above (taxes/fees).
      const minAllowed = Math.floor(expected * 0.5);
      const maxAllowed = Math.ceil(expected * 1.2);
      if (expected > 0 && (total < minAllowed || total > maxAllowed)) {
        return res.status(400).json({
          success: false,
          error: `Total amount KES ${total} does not match expected range (KES ${minAllowed}–${maxAllowed}) for ${days} day(s) @ KES ${dailyRate}/day.`,
        });
      }

      // ── Per-fleet commission rate (outsourced cars override fleet default) ──
      let commissionRate = 0.15;
      let commissionSource: 'outsource' | 'fleet_owner' | 'default' = 'default';

      if (carRow.is_outsourced && Number.isFinite(Number(carRow.outsource_commission_rate))) {
        // Outsourced cars use their own negotiated rate (Fix #1)
        commissionRate = Number(carRow.outsource_commission_rate);
        if (commissionRate > 1) commissionRate = commissionRate / 100;
        commissionSource = 'outsource';
      } else {
        const { data: fleetSettings } = await supabase
          .from('fleet_owner_settings')
          .select('commission_rate')
          .eq('id', fleetOwnerId)
          .maybeSingle();
        if (fleetSettings && Number.isFinite(Number(fleetSettings.commission_rate))) {
          commissionRate = Number(fleetSettings.commission_rate);
          if (commissionRate > 1) commissionRate = commissionRate / 100;
          commissionSource = 'fleet_owner';
        }
      }
      const platformCommission = Math.round(total * commissionRate * 100) / 100;
      const ownerPayoutAmount = Math.round((total - platformCommission) * 100) / 100;

      // ── Per-booking status token (replaces world-readable status endpoint) ──
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
        platform_commission: platformCommission,
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
          broker_info: brokerId ? {
            broker_id: brokerId,
            broker_commission_rate: Number(brokerRate) || 0,
            broker_commission_amount: Number(brokerCommissionAmount) || 0
          } : null,
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
          commission_rate_applied: commissionRate,
          commission_source: commissionSource,
          owner_payout_amount: ownerPayoutAmount,
          outsource_info: carRow.is_outsourced ? {
            is_outsourced: true,
            owner_name: carRow.outsource_owner_name || null,
            owner_email: carRow.outsource_owner_email || null,
            owner_phone: carRow.outsource_owner_phone || null,
          } : null,
        },
      };

      const withStatusToken = (b: any) => {
        if (!b) return b;
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
          // SECURITY: do not return another user's already-paid booking from a token-known reservation id.
          if (existingBooking.payment_status === 'paid') {
            return res.status(409).json({ success: false, error: 'This reservation has already been completed.' });
          }

          // Preserve any existing client_status_token rather than overwriting it.
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
        } catch (err) {
          console.error('Failed to sync booking documents to profile:', err);
        }
      }

      if (sourceReservationId) {
        // Single-use continuation token: null it out after the booking is linked.
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
    } catch (error: any) {
      console.error('[API] Booking create error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  });

  app.post('/api/ncba/stk-push', async (req, res) => {
    try {
      const { phone, bookingId } = req.body;

      if (!phone || !bookingId) {
        return res.status(400).json({ success: false, error: 'Phone and booking ID are required' });
      }

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }

      if (booking.payment_status === 'paid' && booking.status !== 'pending_payment_verification') {
        return res.status(409).json({ success: false, error: 'This booking is already paid' });
      }

      const pushAmount = Number(booking.total_amount);

      const publicConfig = ncbaService.getPublicConfig();
      const accountNo = getNcbaAccountNo();

      if (!accountNo) {
        return res.status(500).json({ success: false, error: 'NCBA account number is not configured' });
      }

      const result = await ncbaService.initiateSTKPush({
        phone,
        amount: pushAmount,
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
    } catch (error: any) {
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
    } catch (error: any) {
      console.error('[API] NCBA Query error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  });

  app.get('/api/ncba/payment-status/:bookingId', async (req, res) => {
    try {
      const { bookingId } = req.params;
      const queryToken = (req.query.token as string) || '';
      const authorizationHeader = req.headers.authorization;
      const accessToken = authorizationHeader?.startsWith('Bearer ')
        ? authorizationHeader.slice(7)
        : null;

      const { data: booking, error } = await supabase
        .from('bookings')
        .select('id, client_id, status, payment_status, payment_method, payment_provider, payment_reference, transaction_code, metadata')
        .eq('id', bookingId)
        .single();

      if (error || !booking) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }

      // ── Access control: owner (bearer) OR matching status token ──
      let authorized = false;
      const expectedToken = booking?.metadata?.client_status_token || null;
      if (queryToken && expectedToken && queryToken === expectedToken) {
        authorized = true;
      } else if (accessToken) {
        const { data: authData } = await supabase.auth.getUser(accessToken);
        if (authData?.user?.id && booking.client_id && authData.user.id === booking.client_id) {
          authorized = true;
        }
      }
      if (!authorized) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }

      let { data: paymentRequest } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let currentBooking = booking;
      if (
        currentBooking.payment_status !== 'paid' &&
        paymentRequest?.provider_transaction_id &&
        paymentRequest.status !== 'success'
      ) {
        const ageMs = Date.now() - new Date(paymentRequest.created_at).getTime();
        if (ageMs >= 15000) {
          const result = await ncbaService.querySTKPush(paymentRequest.provider_transaction_id);
          await finalizeNcbaPayment(paymentRequest, result);
          const { data: refreshedBooking } = await supabase
            .from('bookings')
            .select('id, client_id, status, payment_status, payment_method, payment_provider, payment_reference, transaction_code, metadata')
            .eq('id', bookingId)
            .single();
          const { data: refreshedPaymentRequest } = await supabase
            .from('payment_requests')
            .select('*')
            .eq('booking_id', bookingId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (refreshedBooking) currentBooking = refreshedBooking;
          if (refreshedPaymentRequest) paymentRequest = refreshedPaymentRequest;
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
    } catch (error: any) {
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
        return res.status(400).json({ success: false, error: 'Payment request has no NCBA TransactionID' });
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
    } catch (error: any) {
      console.error('[API] NCBA sync-booking error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  });

  // ─── Claim a guest booking after sign-up ────────────────────────────
  app.post('/api/bookings/:bookingId/claim', async (req, res) => {
    try {
      const { bookingId } = req.params;
      const { statusToken } = req.body || {};
      const authorizationHeader = req.headers.authorization;
      const accessToken = authorizationHeader?.startsWith('Bearer ')
        ? authorizationHeader.slice(7)
        : null;

      if (!accessToken) {
        return res.status(401).json({ success: false, error: 'Sign-in required.' });
      }

      const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !authData?.user) {
        return res.status(401).json({ success: false, error: 'Invalid session.' });
      }

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        return res.status(404).json({ success: false, error: 'Booking not found.' });
      }

      if (booking.client_id) {
        if (booking.client_id === authData.user.id) {
          try {
            await linkBookingAndSyncProfile(supabase, booking);
          } catch (syncErr) {
            console.error('Failed to sync claimed booking to profile:', syncErr);
          }
          return res.json({ success: true, booking });
        }
        return res.status(409).json({ success: false, error: 'Booking already linked to another account.' });
      }

      const tokenOk = !!statusToken && booking?.metadata?.client_status_token === statusToken;
      const emailOk = booking?.metadata?.guest_info?.email
        && authData.user.email
        && booking.metadata.guest_info.email.toLowerCase() === authData.user.email.toLowerCase();

      if (!tokenOk && !emailOk) {
        return res.status(403).json({ success: false, error: 'You are not authorised to claim this booking.' });
      }

      const { data: updated, error: updateError } = await supabase
        .from('bookings')
        .update({ client_id: authData.user.id })
        .eq('id', bookingId)
        .select()
        .single();

      if (updateError) {
        return res.status(500).json({ success: false, error: updateError.message });
      }

      try {
        await linkBookingAndSyncProfile(supabase, { ...booking, ...updated, client_id: authData.user.id });
      } catch (syncErr) {
        console.error('Failed to sync claimed booking to profile:', syncErr);
      }

      return res.json({ success: true, booking: updated });
    } catch (error: any) {
      console.error('[API] Booking claim error:', error);
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

      const amount = Number(reservation.reservation_fee);
      
      const publicConfig = ncbaService.getPublicConfig();
      const accountNo = getNcbaAccountNo();

      if (!accountNo) {
        return res.status(500).json({ success: false, error: 'NCBA account number is not configured' });
      }

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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post(
    '/api/reservations/:reservationId/prepare-continuation',
    createPrepareContinuationHandler(supabase)
  );

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
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  });

  // ─── CAR SHARE — OG TAG SERVING FOR SOCIAL CRAWLERS ─────────────────
  // WhatsApp/Telegram/Facebook crawlers don't run JS, so we serve OG HTML
  // server-side. Real users get next() → React SPA handles the route.
  app.get('/cars/:id', async (req: any, res: any, next: any) => {
    const ua = req.headers['user-agent'] || '';
    const isCrawler = /facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|telegram|slackbot|discordbot|googlebot|bingbot|applebot|pinterest|snapchat|skype|yahoo|bot|crawl|spider/i.test(ua);
    if (!isCrawler) return next();

    try {
      const { data: car } = await supabase
        .from('cars')
        .select('id, make, model, year, daily_rate, seats, transmission, primary_image_url, photos, description, vehicle_model_id')
        .eq('id', req.params.id)
        .single();
      if (!car) return next();

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
      const carDesc  = `Book the ${car.make} ${car.model} (${car.year}) in Nairobi from KES ${Number(car.daily_rate).toLocaleString()}/day. ${car.seats} seats · ${car.transmission}. Tap to book instantly.`;
      const carUrl   = `https://linkedupcarsrentals.com/cars/${car.id}?booking=true`;

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
    } catch (_) {
      next();
    }
  });

  app.get('/models/:id', async (req: any, res: any, next: any) => {
    const ua = req.headers['user-agent'] || '';
    const isCrawler = /facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|telegram|slackbot|discordbot|googlebot|bingbot|applebot|pinterest|snapchat|skype|yahoo|bot|crawl|spider/i.test(ua);
    if (!isCrawler) return next();

    try {
      const { data: model } = await supabase
        .from('vehicle_models')
        .select('id, make, model, year, display_name, base_daily_rate, seats, transmission, primary_image_url, gallery_urls, description')
        .eq('id', req.params.id)
        .single();
      if (!model) return next();

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
    } catch (_) {
      next();
    }
  });

  // ─── VITE / STATIC SERVING ────────────────────────────────────────

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const syncPendingNcbaPayments = async () => {
    try {
      const cutoff = new Date(Date.now() - 15000).toISOString();
      const { data: rows, error } = await supabase
        .from('payment_requests')
        .select('*')
        .in('status', ['pending', 'failed', 'initiated'])
        .not('provider_transaction_id', 'is', null)
        .lt('created_at', cutoff)
        .order('updated_at', { ascending: true })
        .limit(25);

      if (error || !rows?.length) return;

      for (const paymentRequest of rows) {
        const { data: booking } = await supabase
          .from('bookings')
          .select('payment_status')
          .eq('id', paymentRequest.booking_id)
          .maybeSingle();

        if (booking?.payment_status === 'paid') continue;

        const result = await ncbaService.querySTKPush(paymentRequest.provider_transaction_id);
        await finalizeNcbaPayment(paymentRequest, result);
      }
    } catch (err) {
      console.error('[NCBA] Background payment sync error:', err);
    }
  };

  const syncIntervalMs = Number(process.env.NCBA_SYNC_INTERVAL_MS || 120000);
  setInterval(() => {
    syncPendingNcbaPayments();
  }, syncIntervalMs);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    syncPendingNcbaPayments();
  });
}

startServer();
