-- Migration: allow clients to cancel their own bookings
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

-- Clients can cancel their own confirmed bookings.
-- USING: targets only their own bookings that are in a cancellable state.
-- WITH CHECK: the only write allowed is setting status = 'cancelled' (still their booking).
DROP POLICY IF EXISTS "Clients can cancel their own bookings" ON bookings;
CREATE POLICY "Clients can cancel their own bookings" ON bookings
  FOR UPDATE
  USING (
    client_id = auth.uid()
    AND status IN ('confirmed', 'pending', 'pending_payment_verification')
  )
  WITH CHECK (
    client_id = auth.uid()
    AND status = 'cancelled'
  );
