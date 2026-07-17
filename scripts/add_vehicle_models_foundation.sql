-- ===============================================================
-- LinkedUp Cars — Vehicle model foundation
-- Adds model-level inventory structures without breaking current
-- unit-based bookings, reservations, or admin operations.
-- ===============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS vehicle_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  display_name TEXT,
  category TEXT,
  description TEXT,
  primary_image_url TEXT,
  gallery_urls TEXT[] DEFAULT '{}',
  video_url TEXT,
  transmission TEXT,
  fuel_type TEXT,
  seats INTEGER,
  luggage INTEGER,
  features TEXT[] DEFAULT '{}',
  base_daily_rate NUMERIC,
  overtime_rate NUMERIC DEFAULT 0,
  security_deposit NUMERIC DEFAULT 0,
  is_chauffeured_only BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Family columns may be added later by add_vehicle_model_families.sql on older DBs.
ALTER TABLE vehicle_models
  ADD COLUMN IF NOT EXISTS family_slug TEXT,
  ADD COLUMN IF NOT EXISTS family_name TEXT,
  ADD COLUMN IF NOT EXISTS variant_name TEXT;

CREATE INDEX IF NOT EXISTS idx_vehicle_models_public_sort
  ON vehicle_models(is_public, sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_models_make_model
  ON vehicle_models(make, model, year);
CREATE INDEX IF NOT EXISTS idx_vehicle_models_family_slug
  ON vehicle_models(family_slug);

ALTER TABLE vehicle_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read public vehicle models" ON vehicle_models;
CREATE POLICY "Public can read public vehicle models" ON vehicle_models
  FOR SELECT
  USING (is_public = TRUE);

DROP POLICY IF EXISTS "Admins can manage vehicle models" ON vehicle_models;
CREATE POLICY "Admins can manage vehicle models" ON vehicle_models
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

ALTER TABLE cars
  ADD COLUMN IF NOT EXISTS vehicle_model_id UUID REFERENCES vehicle_models(id) ON DELETE SET NULL;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS vehicle_model_id UUID REFERENCES vehicle_models(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cars_vehicle_model_id ON cars(vehicle_model_id);
CREATE INDEX IF NOT EXISTS idx_bookings_vehicle_model_id ON bookings(vehicle_model_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'car_reservations'
  ) THEN
    ALTER TABLE car_reservations
      ADD COLUMN IF NOT EXISTS vehicle_model_id UUID REFERENCES vehicle_models(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_car_reservations_vehicle_model_id
      ON car_reservations(vehicle_model_id);
  END IF;
END $$;

-- One public model per make/model/year (slug is unique on those three, not category).
WITH distinct_units AS (
  SELECT DISTINCT ON (make, model, year)
    make,
    model,
    year,
    category,
    description,
    primary_image_url,
    photos,
    video_url,
    transmission,
    fuel_type,
    seats,
    features,
    daily_rate,
    overtime_rate,
    security_deposit
  FROM cars
  ORDER BY make, model, year, created_at DESC NULLS LAST, id
), inserted_models AS (
  INSERT INTO vehicle_models (
    slug,
    family_slug,
    family_name,
    variant_name,
    make,
    model,
    year,
    display_name,
    category,
    description,
    primary_image_url,
    gallery_urls,
    video_url,
    transmission,
    fuel_type,
    seats,
    features,
    base_daily_rate,
    overtime_rate,
    security_deposit
  )
  SELECT
    lower(
      regexp_replace(
        trim(
          concat_ws(
            '-',
            make,
            model,
            CASE WHEN year IS NULL THEN NULL ELSE year::text END
          )
        ),
        '[^a-zA-Z0-9]+',
        '-',
        'g'
      )
    ) AS slug,
    lower(
      regexp_replace(
        trim(concat_ws(' ', make, model)),
        '[^a-zA-Z0-9]+',
        '-',
        'g'
      )
    ) AS family_slug,
    trim(concat_ws(' ', make, model)) AS family_name,
    COALESCE(year::text, 'Standard') AS variant_name,
    make,
    model,
    year,
    trim(
      concat_ws(
        ' ',
        make,
        model,
        CASE WHEN year IS NULL THEN NULL ELSE year::text END
      )
    ) AS display_name,
    category,
    description,
    primary_image_url,
    COALESCE(photos, '{}'),
    video_url,
    transmission,
    fuel_type,
    seats,
    COALESCE(features, '{}'),
    daily_rate,
    COALESCE(overtime_rate, 0),
    COALESCE(security_deposit, 0)
  FROM distinct_units du
  WHERE NOT EXISTS (
    SELECT 1
    FROM vehicle_models vm
    WHERE vm.make IS NOT DISTINCT FROM du.make
      AND vm.model IS NOT DISTINCT FROM du.model
      AND vm.year IS NOT DISTINCT FROM du.year
  )
  ON CONFLICT (slug) DO NOTHING
  RETURNING id, make, model, year
)
SELECT COUNT(*) FROM inserted_models;

UPDATE cars c
SET vehicle_model_id = vm.id
FROM vehicle_models vm
WHERE c.vehicle_model_id IS NULL
  AND vm.make IS NOT DISTINCT FROM c.make
  AND vm.model IS NOT DISTINCT FROM c.model
  AND vm.year IS NOT DISTINCT FROM c.year;

UPDATE bookings b
SET vehicle_model_id = c.vehicle_model_id
FROM cars c
WHERE b.car_id = c.id
  AND b.vehicle_model_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'car_reservations'
  ) THEN
    UPDATE car_reservations r
    SET vehicle_model_id = c.vehicle_model_id
    FROM cars c
    WHERE r.car_id = c.id
      AND r.vehicle_model_id IS NULL;
  END IF;
END $$;

COMMIT;
