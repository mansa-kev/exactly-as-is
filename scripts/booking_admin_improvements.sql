-- ============================================================
-- Booking Admin Improvements Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Prevent duplicate pending_payments per booking ────────
-- One booking should only ever have one pending payment record
ALTER TABLE pending_payments
  DROP CONSTRAINT IF EXISTS pending_payments_booking_id_key;

ALTER TABLE pending_payments
  ADD CONSTRAINT pending_payments_booking_id_key UNIQUE (booking_id);

-- ── 2. Add document_status to bookings ──────────────────────
-- Tracks whether submitted documents are approved/rejected
-- independently of the booking status (payment can be verified
-- while docs are still under review)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS document_status TEXT
    DEFAULT 'pending'
    CHECK (document_status IN ('pending', 'approved', 'rejected', 'resubmission_required', 'resubmitted'));

-- ── 3. Add admin_notes to bookings ───────────────────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- ── 4. Add submitted_at to pending_payments (if missing) ─────
ALTER TABLE pending_payments
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT now();

-- Backfill submitted_at for existing rows
UPDATE pending_payments
SET submitted_at = now()
WHERE submitted_at IS NULL;

-- ── 5. RLS: clients can update document fields on own bookings ─
-- Clients need to set document_status='resubmitted' and update metadata.documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bookings' AND policyname = 'clients_update_own_booking_documents'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY clients_update_own_booking_documents ON bookings
        FOR UPDATE TO authenticated
        USING (client_id = auth.uid())
        WITH CHECK (client_id = auth.uid())
    $policy$;
  END IF;
END $$;

-- ── 6. Verify ────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name IN ('bookings', 'pending_payments')
  AND column_name IN ('document_status', 'admin_notes', 'submitted_at')
ORDER BY table_name, column_name;
