-- Idempotent: ensure guest booking document uploads work (booking flow step 2).
-- Run in Supabase SQL Editor if /api/booking-documents/upload returns 500.

INSERT INTO storage.buckets (id, name, public)
VALUES ('public_assets', 'public_assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can upload booking documents" ON storage.objects;
CREATE POLICY "Anyone can upload booking documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'public_assets'
    AND (storage.foldername(name))[1] = 'booking-docs'
  );

DROP POLICY IF EXISTS "Public read public_assets" ON storage.objects;
CREATE POLICY "Public read public_assets"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'public_assets');
