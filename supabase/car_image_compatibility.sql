-- Compatibility patch for older deployed bundles that still select cars.images and cars.image_url.
-- The current app uses cars.photos and cars.primary_image_url.

ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS images TEXT[] GENERATED ALWAYS AS (photos) STORED,
  ADD COLUMN IF NOT EXISTS image_url TEXT GENERATED ALWAYS AS (primary_image_url) STORED;
