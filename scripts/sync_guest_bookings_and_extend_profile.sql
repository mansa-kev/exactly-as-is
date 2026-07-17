-- ============================================================
-- Migration: Extend user_profiles & Auto-sync Guest Bookings
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Extend user_profiles table with document columns
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS id_number TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS face_photo_url TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS license_front_url TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS license_back_url TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS id_front_url TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS id_back_url TEXT;

-- 2. Create/Update handle_new_user trigger function to auto-sync guest info
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  found_id_number TEXT;
  found_face_photo TEXT;
  found_license_front TEXT;
  found_license_back TEXT;
  found_id_front TEXT;
  found_id_back TEXT;
BEGIN
  -- Search for any past unlinked guest booking matching this email to harvest docs
  SELECT 
    (metadata->'guest_info'->>'id_number') as guest_id_number,
    (metadata->'documents'->>'facePhotoUrl') as guest_face_photo,
    (metadata->'documents'->>'licenseFrontUrl') as guest_license_front,
    (metadata->'documents'->>'licenseBackUrl') as guest_license_back,
    (metadata->'documents'->>'idFrontUrl') as guest_id_front,
    (metadata->'documents'->>'idBackUrl') as guest_id_back
  INTO 
    found_id_number,
    found_face_photo,
    found_license_front,
    found_license_back,
    found_id_front,
    found_id_back
  FROM public.bookings
  WHERE client_id IS NULL 
    AND LOWER(metadata->'guest_info'->>'email') = LOWER(NEW.email)
  ORDER BY created_at DESC
  LIMIT 1;

  -- Create the profile row
  INSERT INTO public.user_profiles (
    id, 
    email, 
    full_name, 
    role, 
    status,
    id_number,
    face_photo_url,
    license_front_url,
    license_back_url,
    id_front_url,
    id_back_url
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')::user_role,
    'active',
    found_id_number,
    found_face_photo,
    found_license_front,
    found_license_back,
    found_id_front,
    found_id_back
  )
  ON CONFLICT (id) DO UPDATE SET
    id_number = COALESCE(user_profiles.id_number, EXCLUDED.id_number),
    face_photo_url = COALESCE(user_profiles.face_photo_url, EXCLUDED.face_photo_url),
    license_front_url = COALESCE(user_profiles.license_front_url, EXCLUDED.license_front_url),
    license_back_url = COALESCE(user_profiles.license_back_url, EXCLUDED.license_back_url),
    id_front_url = COALESCE(user_profiles.id_front_url, EXCLUDED.id_front_url),
    id_back_url = COALESCE(user_profiles.id_back_url, EXCLUDED.id_back_url);

  -- Update all unlinked bookings matching the email to link them
  UPDATE public.bookings
  SET client_id = NEW.id
  WHERE client_id IS NULL
    AND LOWER(metadata->'guest_info'->>'email') = LOWER(NEW.email);

  -- Update all unlinked reservations matching the email to link them
  UPDATE public.car_reservations
  SET client_id = NEW.id
  WHERE client_id IS NULL
    AND LOWER(contact_email) = LOWER(NEW.email);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-create trigger just to be safe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
