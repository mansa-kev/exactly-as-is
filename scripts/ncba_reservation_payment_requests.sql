-- ============================================================
-- NCBA STK Push reservation payment tracking
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS source_reservation_id UUID REFERENCES car_reservations(id) ON DELETE SET NULL;

ALTER TABLE car_reservations
  ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'ncba',
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS booking_completion_token TEXT,
  ADD COLUMN IF NOT EXISTS linked_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS booking_flow_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booking_flow_initiated_by TEXT;

ALTER TABLE car_reservations
  ALTER COLUMN status SET DEFAULT 'pending_payment';

ALTER TABLE car_reservations
  DROP CONSTRAINT IF EXISTS car_reservations_status_check;

ALTER TABLE car_reservations
  ADD CONSTRAINT car_reservations_status_check
  CHECK (status IN ('pending_payment', 'reserved', 'confirmed', 'cancelled', 'expired'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_car_reservations_booking_completion_token
  ON car_reservations(booking_completion_token)
  WHERE booking_completion_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_car_reservations_linked_booking_id
  ON car_reservations(linked_booking_id);

CREATE INDEX IF NOT EXISTS idx_bookings_source_reservation_id
  ON bookings(source_reservation_id);

CREATE TABLE IF NOT EXISTS reservation_payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES car_reservations(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_reservation_payment_requests_reservation_id ON reservation_payment_requests(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_payment_requests_provider_transaction_id ON reservation_payment_requests(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_reservation_payment_requests_status ON reservation_payment_requests(status);

ALTER TABLE reservation_payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage reservation payment requests" ON reservation_payment_requests;
CREATE POLICY "Admins can manage reservation payment requests"
  ON reservation_payment_requests FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Clients can view own reservation payment requests" ON reservation_payment_requests;
CREATE POLICY "Clients can view own reservation payment requests"
  ON reservation_payment_requests FOR SELECT
  USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Guests can create reservation payment requests through server" ON reservation_payment_requests;
CREATE POLICY "Guests can create reservation payment requests through server"
  ON reservation_payment_requests FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can insert own reservations" ON car_reservations;
CREATE POLICY "Users can insert own reservations" ON car_reservations
  ON car_reservations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "Guests can insert reservations" ON car_reservations;
CREATE POLICY "Guests can insert reservations"
  ON car_reservations FOR INSERT TO anon
  WITH CHECK (client_id IS NULL);
