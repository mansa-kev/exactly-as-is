-- ============================================================
-- FIX: Remove blob: URLs from cars table
-- Blob URLs are browser-local and expire immediately after
-- the upload session ends — they must never be stored in DB
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── 1. Clear blob: primary_image_url ────────────────────────
UPDATE cars
SET primary_image_url = NULL
WHERE primary_image_url LIKE 'blob:%';

-- ── 2. Clean blob: entries inside photos JSONB array ────────
UPDATE cars
SET photos = (
  SELECT jsonb_agg(photo)
  FROM jsonb_array_elements_text(photos) AS photo
  WHERE photo NOT LIKE 'blob:%'
)
WHERE photos IS NOT NULL
  AND photos::text LIKE '%blob:%';

-- ── 3. Clean blob: entries inside images JSONB array ─────────
UPDATE cars
SET images = (
  SELECT jsonb_agg(img)
  FROM jsonb_array_elements_text(images) AS img
  WHERE img NOT LIKE 'blob:%'
)
WHERE images IS NOT NULL
  AND images::text LIKE '%blob:%';

-- ── 4. Verify: check if any blob: URLs remain ───────────────
SELECT id, make, model,
  primary_image_url,
  photos,
  images
FROM cars
WHERE primary_image_url LIKE 'blob:%'
   OR photos::text    LIKE '%blob:%'
   OR images::text    LIKE '%blob:%';

-- Expected: 0 rows returned
