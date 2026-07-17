-- ============================================================
-- Fix Infinite Recursion in user_profiles RLS policies
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Ensure is_admin() is strictly SECURITY DEFINER and bypasses RLS safely
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Drop the recursive UPDATE policy that uses SELECT inside WITH CHECK
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile" ON user_profiles 
FOR UPDATE 
USING (auth.uid() = id);

-- 3. Redefine SELECT policies so they do not trigger nested checks
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
CREATE POLICY "Admins can view all profiles" ON user_profiles 
FOR SELECT 
USING (public.is_admin() OR auth.uid() = id);

-- 4. Fix Driver policy so it uses a clean lookup without triggering deeper RLS checks
DROP POLICY IF EXISTS "Drivers can view client profiles of assigned bookings" ON user_profiles;
CREATE POLICY "Drivers can view client profiles of assigned bookings" ON user_profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.client_id = user_profiles.id
      AND bookings.driver_id = auth.uid()
    )
  );

-- 5. Quick Verification
SELECT policyname, tablename, cmd
FROM pg_policies
WHERE tablename = 'user_profiles' 
ORDER BY policyname;
