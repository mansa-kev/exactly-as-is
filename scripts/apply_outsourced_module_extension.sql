-- ============================================================
-- Outsourced Module Improvements: Suppliers & Brokers Schema Extensions
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Create brokers table
CREATE TABLE IF NOT EXISTS brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  default_commission_rate NUMERIC DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for brokers
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage brokers" ON brokers;
CREATE POLICY "Admins can manage brokers" ON brokers
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

-- 2. Extend bookings table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'broker_id') THEN
    ALTER TABLE bookings ADD COLUMN broker_id UUID REFERENCES brokers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'broker_commission_rate') THEN
    ALTER TABLE bookings ADD COLUMN broker_commission_rate NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'broker_commission_amount') THEN
    ALTER TABLE bookings ADD COLUMN broker_commission_amount NUMERIC DEFAULT 0;
  END IF;
END $$;

-- 3. Create payout_settlements table
CREATE TABLE IF NOT EXISTS payout_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('supplier', 'broker')) NOT NULL,
  target_id UUID NOT NULL, -- Either broker_id or car_id (or partner id)
  amount NUMERIC NOT NULL,
  status TEXT CHECK (status IN ('pending', 'paid', 'cancelled')) DEFAULT 'pending',
  payment_reference TEXT,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_booking_payout UNIQUE (booking_id, type)
);

-- Enable RLS for payout_settlements
ALTER TABLE payout_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage payout_settlements" ON payout_settlements;
CREATE POLICY "Admins can manage payout_settlements" ON payout_settlements
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

-- 4. Automatically generate payout settlements when booking is completed and paid
CREATE OR REPLACE FUNCTION process_booking_payouts_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_is_outsourced BOOLEAN;
  v_daily_rate NUMERIC;
  v_outsource_commission NUMERIC;
  v_days INTEGER;
  v_supplier_amount NUMERIC;
BEGIN
  -- Check if booking is completed and paid
  IF NEW.status = 'completed' AND NEW.payment_status = 'paid' THEN
    
    -- 1. Check if the vehicle is outsourced (Supplier Payout)
    SELECT is_outsourced, daily_rate, COALESCE(outsource_commission_rate, 15)
    INTO v_is_outsourced, v_daily_rate, v_outsource_commission
    FROM cars
    WHERE id = NEW.car_id;
    
    IF v_is_outsourced = TRUE THEN
      -- Calculate rental duration in days (minimum 1 day)
      v_days := GREATEST(1, EXTRACT(EPOCH FROM (NEW.end_date - NEW.start_date)) / 86400)::INTEGER;
      
      -- Supplier gets (Daily Rate * Days) minus Platform Commission
      v_supplier_amount := (v_daily_rate * v_days) * (1 - (v_outsource_commission / 100.0));
      
      -- Insert supplier payout settlement (ignore if duplicate exists)
      INSERT INTO payout_settlements (booking_id, type, target_id, amount, status)
      VALUES (NEW.id, 'supplier', NEW.car_id, v_supplier_amount, 'pending')
      ON CONFLICT (booking_id, type) DO NOTHING;
    END IF;

    -- 2. Check if a broker referral is attached (Broker Payout)
    IF NEW.broker_id IS NOT NULL AND NEW.broker_commission_amount > 0 THEN
      -- Insert broker payout settlement (ignore if duplicate exists)
      INSERT INTO payout_settlements (booking_id, type, target_id, amount, status)
      VALUES (NEW.id, 'broker', NEW.broker_id, NEW.broker_commission_amount, 'pending')
      ON CONFLICT (booking_id, type) DO NOTHING;
    END IF;

  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_process_booking_payouts ON bookings;
CREATE TRIGGER trg_process_booking_payouts
AFTER UPDATE OF status, payment_status ON bookings
FOR EACH ROW
EXECUTE FUNCTION process_booking_payouts_trigger();
