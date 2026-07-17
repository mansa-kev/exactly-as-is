-- ============================================================
-- Migration: ensure client_preferences and wishlist exist
-- Run this in Supabase SQL Editor if tables are missing
-- ============================================================

-- 1. Client Preferences
CREATE TABLE IF NOT EXISTS client_preferences (
  id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  preferred_pickup_location TEXT,
  preferred_dropoff_location TEXT,
  default_payment_method TEXT DEFAULT 'mpesa',
  always_include_chauffeur BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE client_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own preferences" ON client_preferences;
CREATE POLICY "Users can manage their own preferences"
  ON client_preferences FOR ALL USING (auth.uid() = id);

DROP TRIGGER IF EXISTS update_client_preferences_updated_at ON client_preferences;
CREATE TRIGGER update_client_preferences_updated_at
  BEFORE UPDATE ON client_preferences
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 2. Wishlist
CREATE TABLE IF NOT EXISTS wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, car_id)
);

ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own wishlist" ON wishlist;
CREATE POLICY "Users can manage their own wishlist"
  ON wishlist FOR ALL USING (auth.uid() = client_id);
