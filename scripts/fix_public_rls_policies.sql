-- ============================================================
-- FIX: Grant anon read access to public-facing data
-- Run this in Supabase SQL Editor
-- These assets must be readable without authentication
-- ============================================================

-- ── 1. app_settings: allow anon to read public keys only ────
DROP POLICY IF EXISTS "Allow anon read public settings" ON app_settings;
CREATE POLICY "Allow anon read public settings"
ON app_settings
FOR SELECT
TO anon
USING (
  key IN (
    'site_logo',
    'homepage_cta_image',
    'about_hero_image',
    'about_team_image',
    'about_mission_image',
    'company_po_box',
    'company_signature_url',
    'contract_logo',
    'logo_url'
  )
);

DROP POLICY IF EXISTS "Allow authenticated read public settings" ON app_settings;
CREATE POLICY "Allow authenticated read public settings"
ON app_settings
FOR SELECT
TO authenticated
USING (
  key IN (
    'site_logo',
    'homepage_cta_image',
    'about_hero_image',
    'about_team_image',
    'about_mission_image',
    'company_po_box',
    'company_signature_url',
    'contract_logo',
    'logo_url'
  )
);

-- ── 2. Create public_image_settings view (if it doesn't exist) ──
CREATE OR REPLACE VIEW public_image_settings AS
SELECT key, value
FROM app_settings
WHERE key IN (
  'homepage_cta_image',
  'about_hero_image',
  'about_team_image',
  'about_mission_image'
);

-- Grant anon access to the view
GRANT SELECT ON public_image_settings TO anon;

-- ── 3. Create get_public_image_settings RPC (if it doesn't exist) ──
CREATE OR REPLACE FUNCTION get_public_image_settings()
RETURNS TABLE(key text, value text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT key, value
  FROM app_settings
  WHERE key IN (
    'homepage_cta_image',
    'about_hero_image',
    'about_team_image',
    'about_mission_image'
  );
$$;

-- Grant anon access to the RPC
GRANT EXECUTE ON FUNCTION get_public_image_settings() TO anon;

-- ── 4. contracts_master: allow anon to read active contracts ─
-- Needed so unauthenticated users can read the contract
-- during the public booking flow (Step 3)
DROP POLICY IF EXISTS "Allow anon read active contracts" ON contracts_master;
CREATE POLICY "Allow anon read active contracts"
ON contracts_master
FOR SELECT
TO anon
USING (is_active = true);

-- ── 5. Verify policies are applied ──────────────────────────
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('app_settings', 'contracts_master')
  AND 'anon' = ANY(roles)
ORDER BY tablename, policyname;
