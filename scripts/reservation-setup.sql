-- Create car_reservations table
CREATE TABLE IF NOT EXISTS car_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  vehicle_model_id UUID REFERENCES vehicle_models(id) ON DELETE SET NULL,
  client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fleet_owner_id UUID NOT NULL REFERENCES user_profiles(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reservation_fee NUMERIC NOT NULL DEFAULT 500,
  total_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'cancelled', 'expired')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed')),
  payment_method TEXT,
  transaction_code TEXT,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  notes TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE car_reservations ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_car_reservations_car_id ON car_reservations(car_id);
CREATE INDEX IF NOT EXISTS idx_car_reservations_vehicle_model_id ON car_reservations(vehicle_model_id);
CREATE INDEX IF NOT EXISTS idx_car_reservations_client_id ON car_reservations(client_id);
CREATE INDEX IF NOT EXISTS idx_car_reservations_status ON car_reservations(status);
CREATE INDEX IF NOT EXISTS idx_car_reservations_dates ON car_reservations(start_date, end_date);

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own reservations" ON car_reservations;
CREATE POLICY "Users can view own reservations" ON car_reservations
  FOR SELECT USING (auth.uid() = client_id);
  
DROP POLICY IF EXISTS "Users can insert own reservations" ON car_reservations;
CREATE POLICY "Users can insert own reservations" ON car_reservations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = client_id);

 DROP POLICY IF EXISTS "Guests can insert reservations" ON car_reservations;
 CREATE POLICY "Guests can insert reservations" ON car_reservations
  FOR INSERT TO anon
  WITH CHECK (client_id IS NULL);
  
DROP POLICY IF EXISTS "Fleet owners can view their car reservations" ON car_reservations;
CREATE POLICY "Fleet owners can view their car reservations" ON car_reservations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cars 
      WHERE cars.id = car_reservations.car_id 
      AND cars.fleet_owner_id = auth.uid()
    )
  );
  
DROP POLICY IF EXISTS "Admins can manage all reservations" ON car_reservations;
CREATE POLICY "Admins can manage all reservations" ON car_reservations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add reservation fee setting
INSERT INTO settings (key, value, description) 
VALUES ('reservation_fee', '500'::jsonb, 'Default reservation fee for car reservations (KES)')
ON CONFLICT (key) DO UPDATE SET value = '500'::jsonb, description = 'Default reservation fee for car reservations (KES)';

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_car_reservations_updated_at ON car_reservations;
CREATE TRIGGER update_car_reservations_updated_at
  BEFORE UPDATE ON car_reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
