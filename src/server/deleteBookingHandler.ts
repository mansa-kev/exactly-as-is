import type { Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

function getAccessToken(req: Request): string | null {
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader?.startsWith('Bearer ')) return null;
  return authorizationHeader.slice(7);
}

export function createDeleteBookingHandler(supabase: SupabaseClient, requireServiceRole = true) {
  return async (req: Request, res: Response) => {
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

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (!profile || (profile.role !== 'admin' && profile.role !== 'fleet_owner')) {
        return res.status(403).json({ success: false, error: 'Only admins and fleet owners can delete bookings.' });
      }

      if (profile.role === 'fleet_owner') {
        const { data: booking } = await supabase
          .from('bookings')
          .select('fleet_owner_id')
          .eq('id', bookingId)
          .maybeSingle();

        if (!booking || booking.fleet_owner_id !== authData.user.id) {
          return res.status(403).json({ success: false, error: 'You can only delete bookings for your own fleet.' });
        }
      }

      if (requireServiceRole) {
        const serviceKey =
          process.env.SB_SERVICE_ROLE_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
          '';

        if (!serviceKey) {
          return res.status(503).json({
            success: false,
            error:
              'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is required on Vercel for booking deletion.',
          });
        }
      }

      const relatedTables = [
        'booking_inspections',
        'booking_extensions',
        'e_contracts',
        'damage_reports',
        'extension_requests',
        'payment_requests',
        'pending_payments',
        'transactions',
        'payout_settlements',
        'car_reviews',
        'booking_documents',
      ];

      const cleanupErrors: string[] = [];

      for (const table of relatedTables) {
        const { error } = await supabase.from(table).delete().eq('booking_id', bookingId);
        if (error && error.code !== '42P01') {
          console.warn(`[delete-booking] ${table}:`, error.message);
          cleanupErrors.push(`${table}: ${error.message}`);
        }
      }

      // Unlink reservations (ON DELETE SET NULL may not run before explicit delete)
      await supabase
        .from('car_reservations')
        .update({ linked_booking_id: null })
        .eq('linked_booking_id', bookingId);

      const { error: bookingError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (bookingError) {
        const detail = cleanupErrors.length ? ` Related cleanup issues: ${cleanupErrors.join('; ')}` : '';
        return res.status(500).json({
          success: false,
          error: `${bookingError.message}${detail}`,
        });
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error('[delete-booking]', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to delete booking.',
      });
    }
  };
}
