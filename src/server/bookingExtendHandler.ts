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
      const hoursExtended = Number(req.body?.hours_extended) || 0;
      const extensionCost = Number(req.body?.extension_cost);
      const pricingBreakdown = req.body?.pricing_breakdown ?? {};

      if (!Number.isFinite(daysExtended) || daysExtended < 0) {
        return res.status(400).json({ success: false, error: 'days_extended must be zero or greater.' });
      }
      if ((daysExtended + hoursExtended) <= 0) {
        return res.status(400).json({ success: false, error: 'Extension must be at least 1 hour.' });
      }
      if (!Number.isFinite(extensionCost) || extensionCost < 0) {
        return res.status(400).json({ success: false, error: 'extension_cost must be zero or greater.' });
      }


      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, status, start_date, end_date, total_amount, return_confirmed_at, pickup_confirmed_at')
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

      // Enforce 6-hour cutoff before the return deadline.
      const EXTENSION_CUTOFF_HOURS = 6;
      const EXTENSION_CUTOFF_MS = EXTENSION_CUTOFF_HOURS * 60 * 60 * 1000;
      const deadlineMs = (() => {
        if (booking.pickup_confirmed_at) {
          const pickup = new Date(booking.pickup_confirmed_at).getTime();
          const start = booking.start_date ? new Date(booking.start_date).getTime() : NaN;
          const end = booking.end_date ? new Date(booking.end_date).getTime() : NaN;
          if (!Number.isNaN(pickup) && !Number.isNaN(start) && !Number.isNaN(end)) {
            const days = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)));
            return pickup + days * 24 * 60 * 60 * 1000;
          }
        }
        return booking.end_date ? new Date(booking.end_date).getTime() : NaN;
      })();
      const msLeft = Number.isFinite(deadlineMs) ? deadlineMs - Date.now() : 0;
      if (msLeft < EXTENSION_CUTOFF_MS) {
        const hoursLeft = Math.max(0, msLeft / (60 * 60 * 1000));
        return res.status(409).json({
          success: false,
          error: msLeft <= 0
            ? 'The booking has already reached its return deadline. Extensions are no longer possible.'
            : `Extensions must be requested at least ${EXTENSION_CUTOFF_HOURS} hours before return (only ${hoursLeft.toFixed(1)}h left).`,
        });
      }


      // Anchor the extension to the current end_date; don't jump to end-of-day.
      const currentEnd = new Date(booking.end_date);
      if (Number.isNaN(currentEnd.getTime())) {
        return res.status(400).json({ success: false, error: 'Booking end_date is invalid.' });
      }
      const totalMs = (daysExtended * 24 + hoursExtended) * 60 * 60 * 1000;
      const newEnd = new Date(currentEnd.getTime() + totalMs);
      const iso = newEnd.toISOString();
      const dateOnly = iso.slice(0, 10);
      const newTotal = Number(booking.total_amount || 0) + extensionCost;

      // Record the extension in awaiting_payment — do NOT auto-mark as paid.
      const { data: extension, error: extError } = await supabase
        .from('booking_extensions')
        .insert({
          booking_id: bookingId,
          days_extended: daysExtended,
          hours_extended: hoursExtended,
          new_end_date: iso,
          original_end_date: booking.end_date,
          extension_cost: extensionCost,
          total_amount: extensionCost,
          base_amount: Number(pricingBreakdown?.base) || extensionCost,
          tax_amount: Number(pricingBreakdown?.tax) || 0,
          fee_amount: Number(pricingBreakdown?.admin_fee) || 0,
          discount_amount: Number(pricingBreakdown?.discount) || 0,
          pricing_breakdown: pricingBreakdown,
          requester_role: 'admin',
          requested_by: authData.user.id,
          status: extensionCost > 0 ? 'awaiting_payment' : 'applied',
          payment_status: extensionCost > 0 ? 'unpaid' : 'paid',
          applied_at: extensionCost > 0 ? null : new Date().toISOString(),
        })
        .select()
        .single();

      if (extError) {
        return res.status(500).json({ success: false, error: extError.message });

      }

      // Only push new end_date + total when the extension is free / already paid.
      // Otherwise wait for payment confirmation to move the goalposts.
      const bookingUpdate: Record<string, any> = { sub_status: 'extended' };
      if (extensionCost <= 0) {
        bookingUpdate.end_date = dateOnly;
        bookingUpdate.total_amount = newTotal;
      }

      const { data: updated, error: updateError } = await supabase
        .from('bookings')
        .update(bookingUpdate)
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
