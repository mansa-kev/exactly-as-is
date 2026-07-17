-- ============================================================
-- Driver Portal Schema Extensions & RLS Policies
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Extend booking_inspections table with tracking metrics
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'booking_inspections' AND column_name = 'gps_lat') THEN
    ALTER TABLE booking_inspections ADD COLUMN gps_lat NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'booking_inspections' AND column_name = 'gps_lon') THEN
    ALTER TABLE booking_inspections ADD COLUMN gps_lon NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'booking_inspections' AND column_name = 'client_signature_url') THEN
    ALTER TABLE booking_inspections ADD COLUMN client_signature_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'booking_inspections' AND column_name = 'checklist_details') THEN
    ALTER TABLE booking_inspections ADD COLUMN checklist_details JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 2. Setup precise security policies for drivers

-- Bookings RLS policies for drivers
DROP POLICY IF EXISTS "Drivers can view their assigned bookings" ON bookings;
CREATE POLICY "Drivers can view their assigned bookings" ON bookings
  FOR SELECT TO authenticated
  USING (
    driver_id = auth.uid()
  );

-- User Profiles RLS policies for drivers to access client contact details
DROP POLICY IF EXISTS "Drivers can view client profiles of assigned bookings" ON user_profiles;
CREATE POLICY "Drivers can view client profiles of assigned bookings" ON user_profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings 
      WHERE bookings.client_id = user_profiles.id 
      AND bookings.driver_id = auth.uid()
    )
  );

-- Booking Inspections RLS policies for drivers
DROP POLICY IF EXISTS "Drivers can view inspections for their assigned bookings" ON booking_inspections;
CREATE POLICY "Drivers can view inspections for their assigned bookings" ON booking_inspections
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings 
      WHERE bookings.id = booking_inspections.booking_id 
      AND bookings.driver_id = auth.uid()
    )
    OR (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Drivers can insert inspections for their assigned bookings" ON booking_inspections;
CREATE POLICY "Drivers can insert inspections for their assigned bookings" ON booking_inspections
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings 
      WHERE bookings.id = booking_id 
      AND bookings.driver_id = auth.uid()
    )
    OR (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

-- Restrict drivers from updating submitted inspections (Immutable Handover Records)
DROP POLICY IF EXISTS "Drivers cannot update inspections" ON booking_inspections;
CREATE POLICY "Drivers cannot update inspections" ON booking_inspections
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow drivers to read cars details
DROP POLICY IF EXISTS "Drivers can view all cars" ON cars;
CREATE POLICY "Drivers can view all cars" ON cars
  FOR SELECT TO authenticated
  USING (true);
