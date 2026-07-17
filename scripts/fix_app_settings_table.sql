-- Idempotent: create app_settings + public read policies for logo and contract assets.
-- Run in Supabase SQL Editor if /api/public-app-settings returns 500.

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  logo_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS value TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage app settings" ON app_settings;
CREATE POLICY "Admins can manage app settings"
ON app_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Allow anon read public settings" ON app_settings;
CREATE POLICY "Allow anon read public settings"
ON app_settings
FOR SELECT
TO anon, authenticated
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

-- Backfill value from logo_url where admins only stored logo_url.
UPDATE app_settings
SET value = logo_url
WHERE (value IS NULL OR value = '')
  AND logo_url IS NOT NULL
  AND logo_url <> '';
