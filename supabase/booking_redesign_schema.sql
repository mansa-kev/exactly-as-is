-- Add tracking columns to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS flag_reason TEXT,
ADD COLUMN IF NOT EXISTS sub_status TEXT;

-- Create booking_inspections table
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for booking_inspections
ALTER TABLE booking_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" ON booking_inspections
  FOR SELECT TO authenticated USING (true);
  
CREATE POLICY "Enable insert access for all authenticated users" ON booking_inspections
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for all authenticated users" ON booking_inspections
  FOR UPDATE TO authenticated USING (true);

-- Create booking_extensions table
CREATE TABLE IF NOT EXISTS booking_extensions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  days_extended INTEGER NOT NULL,
  new_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  extension_cost NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for booking_extensions
ALTER TABLE booking_extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" ON booking_extensions
  FOR SELECT TO authenticated USING (true);
  
CREATE POLICY "Enable insert access for all authenticated users" ON booking_extensions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for all authenticated users" ON booking_extensions
  FOR UPDATE TO authenticated USING (true);

-- Create storage bucket for inspections if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('booking_inspections', 'booking_inspections', true)
ON CONFLICT (id) DO NOTHING;

-- Setup storage policies for inspections bucket
CREATE POLICY "Public Access for booking_inspections" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'booking_inspections');

CREATE POLICY "Authenticated users can upload to booking_inspections" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'booking_inspections');
