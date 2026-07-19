-- ============================================================
-- Item B — Track actual amount paid on bookings
-- ============================================================
-- Fixes the "extension auto-marked as paid" bug by decoupling
-- "how much has been received" from the "paid/unpaid" flag.
--
-- Balance rule (client & admin UI):
--   balance = total_amount - amount_paid
--
-- payment_status becomes a derived label:
--   unpaid   -> amount_paid = 0
--   partial  -> 0 < amount_paid < total_amount
--   paid     -> amount_paid >= total_amount
-- ============================================================

BEGIN;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_method TEXT,
  ADD COLUMN IF NOT EXISTS last_payment_reference TEXT;

-- Backfill: anything currently marked 'paid' is assumed to have been
-- paid in full at the original total.
UPDATE public.bookings
   SET amount_paid = COALESCE(total_amount, 0)
 WHERE payment_status = 'paid'
   AND amount_paid = 0;

-- Auto-derive payment_status from amount_paid on every write
CREATE OR REPLACE FUNCTION public.sync_booking_payment_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  total NUMERIC := COALESCE(NEW.total_amount, 0);
  paid  NUMERIC := COALESCE(NEW.amount_paid, 0);
BEGIN
  -- Don't clobber terminal states set explicitly by admin flows
  IF NEW.payment_status IN ('refunded','failed','disputed') THEN
    RETURN NEW;
  END IF;

  IF paid <= 0 THEN
    NEW.payment_status := 'unpaid';
  ELSIF paid + 0.01 < total THEN
    NEW.payment_status := 'partial';
  ELSE
    NEW.payment_status := 'paid';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_booking_payment_status ON public.bookings;
CREATE TRIGGER trg_sync_booking_payment_status
  BEFORE INSERT OR UPDATE OF amount_paid, total_amount ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.sync_booking_payment_status();

-- Allow 'partial' in any existing payment_status CHECK
DO $$
DECLARE c TEXT;
BEGIN
  SELECT conname INTO c
    FROM pg_constraint
   WHERE conrelid = 'public.bookings'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%payment_status%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.bookings DROP CONSTRAINT %I', c);
  END IF;
END $$;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('unpaid','partial','paid','failed','refunded','disputed','pending'));

COMMIT;
