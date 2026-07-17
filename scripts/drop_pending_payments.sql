-- ============================================================
-- Migration: move transaction_code into bookings, drop pending_payments
-- Run this ONCE in Supabase SQL Editor
-- ============================================================

-- 1. Add transaction_code column to bookings (if not already there)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transaction_code TEXT;

-- 2. Migrate existing M-Pesa codes from pending_payments → bookings (safe — skips if table gone)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pending_payments') THEN
    UPDATE bookings b
    SET transaction_code = pp.transaction_code
    FROM pending_payments pp
    WHERE pp.booking_id = b.id
      AND pp.transaction_code IS NOT NULL
      AND b.transaction_code IS NULL;
  END IF;
END $$;

-- 3. Also fix transactions INSERT policy (from fix_payment_rls.sql, include here too)
DROP POLICY IF EXISTS "Admins can insert transactions" ON transactions;
CREATE POLICY "Admins can insert transactions"
  ON transactions FOR INSERT
  WITH CHECK (is_admin());

-- 4. Drop the pending_payments table entirely
DROP TABLE IF EXISTS pending_payments CASCADE;

-- Done. All M-Pesa codes are now stored in bookings.transaction_code
