-- ============================================================
-- Fix 1: Allow clients + guests to SELECT their own pending_payments
-- (fixes 400 on bookings query that joins pending_payments)
-- ============================================================
DROP POLICY IF EXISTS "Clients can view their own pending payments" ON pending_payments;
CREATE POLICY "Clients can view their own pending payments"
  ON pending_payments FOR SELECT
  USING (auth.uid() = client_id OR client_id IS NULL);

-- ============================================================
-- Fix 2: Allow admins to INSERT into transactions
-- (fixes 403 when verifyPayment creates a transaction record)
-- ============================================================
DROP POLICY IF EXISTS "Admins can insert transactions" ON transactions;
CREATE POLICY "Admins can insert transactions"
  ON transactions FOR INSERT
  WITH CHECK (is_admin());
