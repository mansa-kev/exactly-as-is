-- Adds per-model booking availability mode for admin fleet reconciliation.
-- Run in Supabase SQL editor before using reservation-only toggles in admin.

ALTER TABLE public.vehicle_models
  ADD COLUMN IF NOT EXISTS booking_mode TEXT NOT NULL DEFAULT 'both';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_models_booking_mode_check'
  ) THEN
    ALTER TABLE public.vehicle_models
      ADD CONSTRAINT vehicle_models_booking_mode_check
      CHECK (booking_mode IN ('both', 'reservation_only', 'disabled'));
  END IF;
END $$;

COMMENT ON COLUMN public.vehicle_models.booking_mode IS
  'both = Book Now + Reserve; reservation_only = Reserve only; disabled = hidden from public booking flows';
