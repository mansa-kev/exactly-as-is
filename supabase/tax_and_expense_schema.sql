-- ============================================================
-- Tax Compliance (KRA eTIMS) & Extended Expenses Schema Extensions
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Create tax_ledger table
CREATE TABLE IF NOT EXISTS tax_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  client_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  client_kra_pin TEXT,
  gross_amount NUMERIC NOT NULL,
  taxable_value NUMERIC NOT NULL,
  vat_amount NUMERIC NOT NULL,
  wht_amount NUMERIC DEFAULT 0,
  etims_status TEXT CHECK (etims_status IN ('pending', 'submitted', 'exempt', 'failed')) DEFAULT 'pending',
  etims_receipt_number TEXT,
  etims_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for tax_ledger
ALTER TABLE tax_ledger ENABLE ROW LEVEL SECURITY;

-- Only Admins can manage tax_ledger
DROP POLICY IF EXISTS "Admins can manage tax_ledger" ON tax_ledger;
CREATE POLICY "Admins can manage tax_ledger" ON tax_ledger
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 2. Extend expenses table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'car_id') THEN
    ALTER TABLE expenses ADD COLUMN car_id UUID REFERENCES cars(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'type') THEN
    ALTER TABLE expenses ADD COLUMN type TEXT CHECK (type IN ('insurance', 'tracker', 'accident_repair', 'maintenance_cost', 'corporate_general', 'other')) DEFAULT 'other';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'metadata') THEN
    ALTER TABLE expenses ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 3. Extend cars table for tracking tracker & insurance expiries
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cars' AND column_name = 'insurance_expiry') THEN
    ALTER TABLE cars ADD COLUMN insurance_expiry DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cars' AND column_name = 'gps_tracker_expiry') THEN
    ALTER TABLE cars ADD COLUMN gps_tracker_expiry DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cars' AND column_name = 'insurance_policy_number') THEN
    ALTER TABLE cars ADD COLUMN insurance_policy_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cars' AND column_name = 'gps_tracker_provider') THEN
    ALTER TABLE cars ADD COLUMN gps_tracker_provider TEXT;
  END IF;
END $$;
