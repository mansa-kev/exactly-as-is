-- ============================================================
-- NCBA STK Push payment request tracking
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transaction_code TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'ncba';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_reference TEXT;

CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  client_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'ncba',
  channel TEXT NOT NULL DEFAULT 'stk',
  phone TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  paybill_no TEXT,
  account_no TEXT,
  network TEXT NOT NULL DEFAULT 'Safaricom',
  transaction_type TEXT NOT NULL DEFAULT 'CustomerPayBillOnline',
  provider_transaction_id TEXT,
  provider_reference_id TEXT,
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'pending', 'success', 'failed', 'timeout', 'cancelled')),
  status_code TEXT,
  status_description TEXT,
  raw_initiate_response JSONB,
  raw_query_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_booking_id ON payment_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_provider_transaction_id ON payment_requests(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);

ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage payment requests" ON payment_requests;
CREATE POLICY "Admins can manage payment requests"
  ON payment_requests FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Clients can view own payment requests" ON payment_requests;
CREATE POLICY "Clients can view own payment requests"
  ON payment_requests FOR SELECT
  USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Guests can create payment requests through server" ON payment_requests;
CREATE POLICY "Guests can create payment requests through server"
  ON payment_requests FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can insert transactions" ON transactions;
CREATE POLICY "Admins can insert transactions"
  ON transactions FOR INSERT
  WITH CHECK (is_admin());
