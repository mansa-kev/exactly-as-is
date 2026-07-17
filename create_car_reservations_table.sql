-- Create car_reservations table for LinkedUp Cars
-- Run this in your Supabase SQL Editor

CREATE TABLE car_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  vehicle_model_id UUID REFERENCES vehicle_models(id) ON DELETE SET NULL,
  client_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  fleet_owner_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reservation_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'cancelled', 'expired', 'converted')),
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

-- Create indexes for better performance
CREATE INDEX idx_car_reservations_car_id ON car_reservations(car_id);
CREATE INDEX idx_car_reservations_vehicle_model_id ON car_reservations(vehicle_model_id);
CREATE INDEX idx_car_reservations_client_id ON car_reservations(client_id);
CREATE INDEX idx_car_reservations_fleet_owner_id ON car_reservations(fleet_owner_id);
CREATE INDEX idx_car_reservations_status ON car_reservations(status);
CREATE INDEX idx_car_reservations_payment_status ON car_reservations(payment_status);
CREATE INDEX idx_car_reservations_expires_at ON car_reservations(expires_at);
CREATE INDEX idx_car_reservations_created_at ON car_reservations(created_at);

-- Create RLS policies (if you're using Row Level Security)
ALTER TABLE car_reservations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own reservations
CREATE POLICY "Users can view own reservations" ON car_reservations
  FOR SELECT USING (auth.uid() = client_id);

-- Policy: Fleet owners can see reservations for their cars
CREATE POLICY "Fleet owners can view car reservations" ON car_reservations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cars 
      WHERE cars.id = car_reservations.car_id 
      AND cars.fleet_owner_id = auth.uid()
    )
  );

-- Policy: Admins can do everything
CREATE POLICY "Admins full access to reservations" ON car_reservations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_car_reservations_updated_at 
  BEFORE UPDATE ON car_reservations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON car_reservations TO authenticated;
GRANT ALL ON car_reservations TO service_role;
