import type { Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { canManageLifecycle } from './bookingLifecycleHandler.js';

function getAccessToken(req: Request): string | null {
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader?.startsWith('Bearer ')) return null;
  return authorizationHeader.slice(7);
}

function addDaysToEndDate(endDateStr: string, days: number): { dateOnly: string; iso: string } {
  const end = new Date(endDateStr);
  if (Number.isNaN(end.getTime())) {
    throw new Error('Booking end_date is invalid.');
  }
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + days);
  return {
    dateOnly: end.toISOString().slice(0, 10),
    iso: end.toISOString(),
  };
}

export function createBookingExtendHandler(supabase: SupabaseClient) {
  return async (req: Request, res: Response) => {
    const accessToken = getAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({ success: false, error: 'Authorization header is required.' });
    }

    const bookingId = String(req.params.bookingId || req.params.id || '');
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
        return res.status(403).json({ success: false, error: 'You are not allowed to extend this booking.' });
      }

      const daysExtended = Number(req.body?.days_extended);
      const extensionCost = Number(req.body?.extension_cost);

      if (!Number.isFinite(daysExtended) || daysExtended < 1) {
        return res.status(400).json({ success: false, error: 'days_extended must be at least 1.' });
      }
      if (!Number.isFinite(extensionCost) || extensionCost < 0) {
        return res.status(400).json({ success: false, error: 'extension_cost must be zero or greater.' });
      }

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, status, end_date, total_amount, return_confirmed_at')
        .eq('id', bookingId)
        .maybeSingle();

      if (bookingError || !booking) {
        return res.status(404).json({ success: false, error: 'Booking not found.' });
      }

      if (booking.return_confirmed_at || booking.status === 'completed') {
        return res.status(409).json({ success: false, error: 'Cannot extend a completed booking.' });
      }

      if (booking.status !== 'on_trip') {
        return res.status(409).json({
          success: false,
          error: 'Extensions can only be added while the vehicle is on trip.',
        });
      }

      const { dateOnly, iso } = addDaysToEndDate(booking.end_date, daysExtended);
      const newTotal = Number(booking.total_amount || 0) + extensionCost;

      const { data: extension, error: extError } = await supabase
        .from('booking_extensions')
        .insert({
          booking_id: bookingId,
          days_extended: daysExtended,
          new_end_date: iso,
          extension_cost: extensionCost,
          status: 'pending_payment',
        })
        .select()
        .single();

      if (extError) {
        return res.status(500).json({ success: false, error: extError.message });
      }

      const { data: updated, error: updateError } = await supabase
        .from('bookings')
        .update({
          end_date: dateOnly,
          sub_status: 'extended',
          total_amount: newTotal,
        })
        .eq('id', bookingId)
        .select()
        .single();

      if (updateError || !updated) {
        console.error('[booking-extend] booking update failed:', updateError);
        return res.status(500).json({
          success: false,
          error: updateError?.message || 'Extension recorded but booking could not be updated.',
        });
      }

      return res.json({ success: true, extension, booking: updated });
    } catch (err: any) {
      console.error('[booking-extend]', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to add extension.',
      });
    }
  };
}
