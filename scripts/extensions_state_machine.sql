-- ============================================================
-- Booking Extensions — Unified State Machine (Item A)
-- ============================================================
-- Consolidates legacy `extension_requests` and `booking_extensions`
-- into a single source of truth with a proper state machine.
--
-- States:
--   requested         -> client (or admin-on-behalf) asked for extra time
--   quoted            -> admin priced it, waiting for client acceptance
--   awaiting_payment  -> client accepted quote, waiting for payment
--   paid              -> payment confirmed (M-Pesa/card/cash)
--   applied           -> booking.end_date + totals updated
--   rejected          -> admin rejected the request
--   cancelled         -> client cancelled before payment
--   expired           -> quote/awaiting_payment timed out
-- ============================================================

BEGIN;

-- 1. Ensure the target table exists (from booking_redesign_schema)
CREATE TABLE IF NOT EXISTS public.booking_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  days_extended INTEGER NOT NULL DEFAULT 0,
  new_end_date TIMESTAMPTZ NOT NULL,
  extension_cost NUMERIC NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'requested',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add state-machine + audit + pricing columns (idempotent)
ALTER TABLE public.booking_extensions
  ADD COLUMN IF NOT EXISTS hours_extended NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requester_role TEXT DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS base_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insurance_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS driver_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KES',
  ADD COLUMN IF NOT EXISTS pricing_breakdown JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quoted_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quote_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Migrate any legacy `extension_requests` rows into `booking_extensions`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='extension_requests') THEN
    INSERT INTO public.booking_extensions (
      booking_id, requested_by, requester_role, requested_at,
      new_end_date, days_extended, reason, total_amount, extension_cost,
      status, created_at, updated_at
    )
    SELECT
      er.booking_id,
      er.client_id,
      'client',
      er.created_at,
      er.new_end_date::timestamptz,
      GREATEST(1, (er.new_end_date::date - b.end_date::date))::int,
      er.reason,
      COALESCE(er.estimated_cost, 0),
      COALESCE(er.estimated_cost, 0),
      CASE er.status
        WHEN 'pending'  THEN 'requested'
        WHEN 'approved' THEN 'awaiting_payment'
        WHEN 'rejected' THEN 'rejected'
        ELSE 'requested'
      END,
      er.created_at,
      er.updated_at
    FROM public.extension_requests er
    LEFT JOIN public.bookings b ON b.id = er.booking_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.booking_extensions be
      WHERE be.booking_id = er.booking_id
        AND be.requested_at = er.created_at
    );
  END IF;
END $$;

-- 4. Drop old status CHECK and add the full state-machine constraint
ALTER TABLE public.booking_extensions DROP CONSTRAINT IF EXISTS booking_extensions_status_check;
ALTER TABLE public.booking_extensions
  ADD CONSTRAINT booking_extensions_status_check
  CHECK (status IN ('requested','quoted','awaiting_payment','paid','applied','rejected','cancelled','expired'));

ALTER TABLE public.booking_extensions
  ADD CONSTRAINT booking_extensions_payment_status_check
  CHECK (payment_status IN ('unpaid','partial','paid','refunded'));

ALTER TABLE public.booking_extensions
  ADD CONSTRAINT booking_extensions_requester_role_check
  CHECK (requester_role IN ('client','admin','driver','fleet_owner'));

-- 5. Backfill sane defaults on existing rows
UPDATE public.booking_extensions
   SET total_amount = COALESCE(NULLIF(total_amount,0), extension_cost, 0)
 WHERE total_amount IS NULL OR total_amount = 0;

UPDATE public.booking_extensions
   SET original_end_date = b.end_date
  FROM public.bookings b
 WHERE public.booking_extensions.booking_id = b.id
   AND public.booking_extensions.original_end_date IS NULL;

-- 6. Prevent multiple simultaneously-open extensions per booking
CREATE UNIQUE INDEX IF NOT EXISTS booking_extensions_one_open_per_booking
  ON public.booking_extensions (booking_id)
  WHERE status IN ('requested','quoted','awaiting_payment');

-- 7. Helpful lookup indexes
CREATE INDEX IF NOT EXISTS booking_extensions_booking_id_idx ON public.booking_extensions (booking_id);
CREATE INDEX IF NOT EXISTS booking_extensions_status_idx     ON public.booking_extensions (status);
CREATE INDEX IF NOT EXISTS booking_extensions_requested_at_idx ON public.booking_extensions (requested_at DESC);

-- 8. updated_at trigger
CREATE OR REPLACE FUNCTION public.set_booking_extensions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_booking_extensions_updated_at ON public.booking_extensions;
CREATE TRIGGER trg_booking_extensions_updated_at
  BEFORE UPDATE ON public.booking_extensions
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_extensions_updated_at();

-- 9. Grants (Data API + edge functions)
GRANT SELECT, INSERT, UPDATE ON public.booking_extensions TO authenticated;
GRANT ALL ON public.booking_extensions TO service_role;

-- 10. RLS refresh — replace permissive dev policies with scoped ones
ALTER TABLE public.booking_extensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.booking_extensions;
DROP POLICY IF EXISTS "Enable insert access for all authenticated users" ON public.booking_extensions;
DROP POLICY IF EXISTS "Enable update access for all authenticated users" ON public.booking_extensions;
DROP POLICY IF EXISTS "Clients read own extensions" ON public.booking_extensions;
DROP POLICY IF EXISTS "Clients create own extensions" ON public.booking_extensions;
DROP POLICY IF EXISTS "Clients cancel own extensions" ON public.booking_extensions;
DROP POLICY IF EXISTS "Admins manage extensions" ON public.booking_extensions;

CREATE POLICY "Clients read own extensions" ON public.booking_extensions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.bookings b
            WHERE b.id = booking_extensions.booking_id
              AND b.client_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "Clients create own extensions" ON public.booking_extensions
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_role = 'client'
    AND EXISTS (SELECT 1 FROM public.bookings b
                WHERE b.id = booking_id AND b.client_id = auth.uid())
  );

CREATE POLICY "Clients cancel own extensions" ON public.booking_extensions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.bookings b
            WHERE b.id = booking_extensions.booking_id
              AND b.client_id = auth.uid())
  )
  WITH CHECK (
    status IN ('requested','quoted','awaiting_payment','cancelled')
  );

CREATE POLICY "Admins manage extensions" ON public.booking_extensions
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 11. Deprecation view — anything still reading `extension_requests` keeps working
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='extension_requests'
               AND table_type='BASE TABLE') THEN
    ALTER TABLE public.extension_requests RENAME TO extension_requests_legacy;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.extension_requests AS
SELECT
  be.id,
  be.booking_id,
  b.client_id,
  be.new_end_date::date  AS new_end_date,
  be.total_amount        AS estimated_cost,
  be.reason,
  CASE be.status
    WHEN 'requested'        THEN 'pending'
    WHEN 'quoted'           THEN 'pending'
    WHEN 'awaiting_payment' THEN 'approved'
    WHEN 'paid'             THEN 'approved'
    WHEN 'applied'          THEN 'approved'
    WHEN 'rejected'         THEN 'rejected'
    WHEN 'cancelled'        THEN 'rejected'
    WHEN 'expired'          THEN 'rejected'
    ELSE be.status
  END AS status,
  be.created_at,
  be.updated_at
FROM public.booking_extensions be
LEFT JOIN public.bookings b ON b.id = be.booking_id;

GRANT SELECT ON public.extension_requests TO authenticated;
GRANT ALL    ON public.extension_requests TO service_role;

COMMIT;
