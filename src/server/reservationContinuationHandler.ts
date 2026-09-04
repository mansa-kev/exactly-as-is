import type { Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateVehicleSlug } from '../utils/urlUtils.js';

function generateContinuationToken(): string {
  const first = globalThis.crypto?.randomUUID?.().replace(/-/g, '') || `${Date.now()}`;
  const second = globalThis.crypto?.randomUUID?.().replace(/-/g, '') || `${Math.random().toString(36).slice(2)}`;
  return `${first}${second}`;
}

export function createPrepareContinuationHandler(supabase: SupabaseClient) {
  return async (req: Request, res: Response) => {
    try {
      const { reservationId } = req.params;
      const initiatedBy = req.body?.initiatedBy === 'admin' ? 'admin' : 'client';
      const notifyClient = Boolean(req.body?.notifyClient);

      if (!reservationId) {
        return res.status(400).json({ success: false, error: 'Reservation ID is required.' });
      }

      const { data: reservation, error: resError } = await supabase
        .from('car_reservations')
        .select('id, car_id, vehicle_model_id, client_id, status, payment_status, booking_completion_token, linked_booking_id, vehicle_model:vehicle_models(friendly_id, family_slug)')
        .eq('id', reservationId)
        .single();

      if (resError || !reservation) {
        return res.status(404).json({ success: false, error: 'Reservation not found' });
      }

      if (reservation.linked_booking_id) {
        return res.status(409).json({
          success: false,
          error: 'This reservation has already been converted to a booking.',
        });
      }

      if (reservation.payment_status !== 'paid' || !['reserved', 'confirmed'].includes(reservation.status)) {
        return res.status(409).json({ success: false, error: 'Only paid active reservations can continue to booking' });
      }

      const continuationToken = reservation.booking_completion_token || generateContinuationToken();
      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('car_reservations')
        .update({
          booking_completion_token: continuationToken,
          booking_flow_started_at: now,
          booking_flow_initiated_by: initiatedBy,
        })
        .eq('id', reservationId);

      if (updateError) {
        return res.status(500).json({ success: false, error: updateError.message });
      }

      let origin = process.env.CLIENT_APP_URL || 'https://linkedupcarsrentals.com';
      // If running locally without CLIENT_APP_URL, default to the local Vite dev server port
      if (!process.env.CLIENT_APP_URL && (req.get('origin')?.includes('localhost') || req.get('host')?.includes('localhost'))) {
        origin = 'http://localhost:5173';
      }

      const continuationTarget = reservation.car_id
        ? `/cars/${reservation.car_id}`
        : reservation.vehicle_model_id
          ? `/vehicles/${generateVehicleSlug({id: reservation.vehicle_model_id, friendly_id: (reservation.vehicle_model as any)?.friendly_id, family_slug: (reservation.vehicle_model as any)?.family_slug})}`
          : null;

      if (!continuationTarget) {
        return res.status(409).json({ success: false, error: 'Reservation is missing both car_id and vehicle_model_id.' });
      }

      const link = `${origin}${continuationTarget}?booking=true&reservationToken=${continuationToken}`;

      if (notifyClient && reservation.client_id) {
        const { error: notificationError } = await supabase.from('notifications').insert({
          user_id: reservation.client_id,
          title: 'Complete Your Booking',
          content: 'Your reservation is paid. Use this link to complete the full booking flow.',
          type: 'info',
          is_read: false,
          link,
        });
        if (notificationError) {
          console.warn('[prepare-continuation] notification failed:', notificationError.message);
        }
      }

      return res.json({
        success: true,
        link,
        reservationId: reservation.id,
        token: continuationToken,
        carId: reservation.car_id,
        vehicleModelId: reservation.vehicle_model_id || null,
      });
    } catch (err: any) {
      console.error('[prepare-continuation]', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to prepare booking continuation',
      });
    }
  };
}
