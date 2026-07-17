-- Idempotent migration: booking_inspections table + storage bucket + RLS policies
-- Run in Supabase SQL Editor or: psql "$DATABASE_URL" -f scripts/fix_booking_inspections_storage.sql

-- ── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('pre_handover', 'post_return')),
  fuel_level TEXT,
  mileage INTEGER,
  location TEXT,
  scratches_notes TEXT,
  photos_exterior JSONB DEFAULT '[]'::jsonb,
  photos_interior JSONB DEFAULT '[]'::jsonb,
  photo_fuel_mileage TEXT,
  conducted_by UUID REFERENCES auth.users(id),
  gps_lat NUMERIC,
  gps_lon NUMERIC,
  client_signature_url TEXT,
  checklist_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE booking_inspections ENABLE ROW LEVEL SECURITY;

-- Driver portal columns (safe if already applied)
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

-- ── Table RLS (admin + driver policies from driver_portal_schema) ─────────────
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON booking_inspections;
DROP POLICY IF EXISTS "Enable insert access for all authenticated users" ON booking_inspections;
DROP POLICY IF EXISTS "Enable update access for all authenticated users" ON booking_inspections;

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
    OR EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_inspections.booking_id
      AND bookings.fleet_owner_id = auth.uid()
    )
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
    OR EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_id
      AND bookings.fleet_owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers cannot update inspections" ON booking_inspections;
CREATE POLICY "Drivers cannot update inspections" ON booking_inspections
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin');

-- Prevent duplicate handover records per booking (skip if duplicates already exist)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM booking_inspections
    GROUP BY booking_id, type
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS booking_inspections_booking_type_unique
      ON booking_inspections (booking_id, type);
  END IF;
END $$;

-- ── Storage bucket ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('booking_inspections', 'booking_inspections', true)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public Access for booking_inspections" ON storage.objects;
CREATE POLICY "Public Access for booking_inspections"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'booking_inspections');

DROP POLICY IF EXISTS "Authenticated users can upload to booking_inspections" ON storage.objects;
CREATE POLICY "Authenticated users can upload to booking_inspections"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'booking_inspections');

DROP POLICY IF EXISTS "Admins can delete booking_inspections objects" ON storage.objects;
CREATE POLICY "Admins can delete booking_inspections objects"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'booking_inspections'
    AND (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );
