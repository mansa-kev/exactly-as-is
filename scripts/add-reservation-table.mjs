/**
 * Add car reservations table and reservation fee settings
 */

const SUPABASE_URL = 'https://edroffvtzrowpsooszqh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc0MzY2MiwiZXhwIjoyMDkxMzE5NjYyfQ.jL_YxElgo1_RMcrsslERsioazsCTlwAzw-G0JylGJh8';

const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

async function main() {
  console.log('Creating car_reservations table...');
  
  // Create car_reservations table
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS car_reservations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
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
    CREATE INDEX IF NOT EXISTS idx_car_reservations_client_id ON car_reservations(client_id);
    CREATE INDEX IF NOT EXISTS idx_car_reservations_status ON car_reservations(status);
    CREATE INDEX IF NOT EXISTS idx_car_reservations_dates ON car_reservations(start_date, end_date);
    
    -- RLS Policies
    DROP POLICY IF EXISTS "Users can view own reservations" ON car_reservations;
    CREATE POLICY "Users can view own reservations" ON car_reservations
      FOR SELECT USING (auth.uid() = client_id);
      
    DROP POLICY IF EXISTS "Users can insert own reservations" ON car_reservations;
    CREATE POLICY "Users can insert own reservations" ON car_reservations
      FOR INSERT WITH CHECK (auth.uid() = client_id);
      
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
  `;
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sql: createTableSQL })
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error('Failed to create table:', err);
  } else {
    console.log('   car_reservations table created successfully');
  }
  
  // Add reservation fee setting to settings table
  console.log('Adding reservation fee setting...');
  const settingRes = await fetch(`${SUPABASE_URL}/rest/v1/settings`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      key: 'reservation_fee',
      value: 500,
      description: 'Default reservation fee for car reservations (KES)',
      category: 'pricing'
    })
  });
  
  if (!settingRes.ok) {
    const err = await settingRes.text();
    console.log('   Setting may already exist or failed:', err);
  } else {
    console.log('   Reservation fee setting added');
  }
  
  // Update trigger for updated_at
  console.log('Adding updated_at trigger...');
  const triggerSQL = `
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
  `;
  
  const triggerRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sql: triggerSQL })
  });
  
  if (!triggerRes.ok) {
    const err = await triggerRes.text();
    console.error('   Failed to add trigger:', err);
  } else {
    console.log('   Updated trigger added');
  }
  
  console.log('\nReservation system setup complete!');
  console.log('- car_reservations table created');
  console.log('- Default reservation fee: KES 500');
  console.log('- 24-hour expiration for reservations');
}

main().catch(console.error);
