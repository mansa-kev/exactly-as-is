-- Run this entire script in your Supabase SQL Editor
-- This will fix the "Database error creating new user" issue

-- 1. Ensure we have the correct user_role enum values
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'fleet_owner';

-- 2. Drop the old trigger to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Create a bulletproof trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- We use NULLIF to prevent empty strings from breaking the ENUM cast
  INSERT INTO public.user_profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'Unknown'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'client')::user_role,
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- If something fails, we log it but don't prevent the user from being created
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-attach the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Ensure Fleet Owner Settings table is ready
CREATE TABLE IF NOT EXISTS fleet_owner_settings (
  id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  company_name TEXT,
  commission_rate NUMERIC DEFAULT 0.15,
  payout_method TEXT,
  payout_details JSONB,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
