-- ============================================================
-- Fix Fleet Owner Account Creation
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Recreate handle_new_user trigger ──────────────────────
-- This trigger auto-creates a user_profiles row whenever a new
-- auth user signs up. SECURITY DEFINER bypasses RLS so it can
-- always insert regardless of who triggered the signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')::user_role,
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ── 2. Allow admins to INSERT profiles for new users ─────────
-- The existing policy only allows auth.uid() = id (self-insert).
-- Admins need to be able to insert profiles when creating
-- fleet owner / driver accounts.
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;
CREATE POLICY "Admins can insert profiles" ON user_profiles
  FOR INSERT WITH CHECK (is_admin());

-- ── 3. Allow admins to INSERT fleet_owner_settings ───────────
-- Without this, the fleet_owner_settings row cannot be created
-- by the admin (only "fleet owners manage their own settings"
-- policy exists, which requires auth.uid() = id).
DROP POLICY IF EXISTS "Admins can insert fleet owner settings" ON fleet_owner_settings;
CREATE POLICY "Admins can insert fleet owner settings" ON fleet_owner_settings
  FOR INSERT WITH CHECK (is_admin());

-- ── 4. Verify ────────────────────────────────────────────────
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'handle_new_user' AND routine_schema = 'public';

SELECT policyname, tablename, cmd
FROM pg_policies
WHERE tablename IN ('user_profiles', 'fleet_owner_settings')
  AND policyname IN (
    'Admins can insert profiles',
    'Admins can insert fleet owner settings'
  );
