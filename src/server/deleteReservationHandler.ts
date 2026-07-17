import type { Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

function getAccessToken(req: Request): string | null {
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader?.startsWith('Bearer ')) return null;
  return authorizationHeader.slice(7);
}

export function createDeleteReservationHandler(supabase: SupabaseClient) {
  return async (req: Request, res: Response) => {
    const accessToken = getAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({ success: false, error: 'Authorization header is required.' });
    }

    const reservationId = String(req.params.reservationId || '');
    if (!reservationId) {
      return res.status(400).json({ success: false, error: 'reservationId is required.' });
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

      if (!profile || profile.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Only admins can delete reservations.' });
      }

      const { data: reservation, error: fetchError } = await supabase
        .from('car_reservations')
        .select('id, car_id, client_id, linked_booking_id')
        .eq('id', reservationId)
        .maybeSingle();

      if (fetchError || !reservation) {
        return res.status(404).json({ success: false, error: 'Reservation not found.' });
      }

      if (reservation.linked_booking_id) {
        return res.status(409).json({
          success: false,
          error: 'Cannot delete a reservation that has already been converted to a booking.',
        });
      }

      const { error: paymentDeleteError } = await supabase
        .from('reservation_payment_requests')
        .delete()
        .eq('reservation_id', reservationId);

      if (paymentDeleteError && paymentDeleteError.code !== '42P01') {
        console.warn('[delete-reservation] payment requests:', paymentDeleteError.message);
      }

      const { error: deleteError } = await supabase
        .from('car_reservations')
        .delete()
        .eq('id', reservationId);

      if (deleteError) {
        return res.status(500).json({ success: false, error: deleteError.message });
      }

      if (reservation.car_id) {
        await supabase
          .from('cars')
          .update({ status: 'available', updated_at: new Date().toISOString() })
          .eq('id', reservation.car_id)
          .then(null, (err: any) => console.warn('[delete-reservation] car status:', err?.message));
      }

      if (reservation.client_id) {
        await supabase
          .from('notifications')
          .insert({
            user_id: reservation.client_id,
            type: 'reservation_deleted',
            title: 'Reservation Removed',
            content: `Your reservation #${reservationId.slice(0, 8).toUpperCase()} was removed by admin.`,
            is_read: false,
          })
          .then(null, (err: any) => console.warn('[delete-reservation] notification:', err?.message));
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error('[delete-reservation]', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to delete reservation.',
      });
    }
  };
}
