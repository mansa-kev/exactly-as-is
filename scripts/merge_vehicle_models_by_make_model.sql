-- ===============================================================
-- Merge vehicle_models rows that share the same make + model family
-- (e.g. Mazda CX-8 2018/2020/2022 -> one public Mazda CX-8 card)
--
-- Run AFTER add_vehicle_models_foundation.sql on production.
-- Safe to re-run. Uses inline CTEs only (no temp tables) so Supabase
-- SQL editor can run the whole script in one shot.
-- ===============================================================

BEGIN;

-- Ensure family columns exist before merge updates reference them.
ALTER TABLE vehicle_models
  ADD COLUMN IF NOT EXISTS family_slug TEXT,
  ADD COLUMN IF NOT EXISTS family_name TEXT,
  ADD COLUMN IF NOT EXISTS variant_name TEXT;

-- 1) Point cars at the canonical keeper per family slug
WITH model_stats AS (
  SELECT
    vm.id,
    lower(
      regexp_replace(
        trim(concat_ws('-', vm.make, vm.model)),
        '[^a-zA-Z0-9]+',
        '-',
        'g'
      )
    ) AS family_slug,
    ROW_NUMBER() OVER (
      PARTITION BY lower(
        regexp_replace(
          trim(concat_ws('-', vm.make, vm.model)),
          '[^a-zA-Z0-9]+',
          '-',
          'g'
        )
      )
      ORDER BY
        (SELECT COUNT(*)::int FROM cars c WHERE c.vehicle_model_id = vm.id) DESC,
        vm.sort_order ASC NULLS LAST,
        vm.created_at ASC NULLS LAST,
        vm.id ASC
    ) AS rn,
    FIRST_VALUE(vm.id) OVER (
      PARTITION BY lower(
        regexp_replace(
          trim(concat_ws('-', vm.make, vm.model)),
          '[^a-zA-Z0-9]+',
          '-',
          'g'
        )
      )
      ORDER BY
        (SELECT COUNT(*)::int FROM cars c WHERE c.vehicle_model_id = vm.id) DESC,
        vm.sort_order ASC NULLS LAST,
        vm.created_at ASC NULLS LAST,
        vm.id ASC
    ) AS keep_id
  FROM vehicle_models vm
),
dupes AS (
  SELECT id AS dup_id, keep_id
  FROM model_stats
  WHERE rn > 1
)
UPDATE cars c
SET vehicle_model_id = d.keep_id
FROM dupes d
WHERE c.vehicle_model_id = d.dup_id;

-- 2) Point bookings at canonical keeper
WITH model_stats AS (
  SELECT
    vm.id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(
        regexp_replace(
          trim(concat_ws('-', vm.make, vm.model)),
          '[^a-zA-Z0-9]+',
          '-',
          'g'
        )
      )
      ORDER BY
        (SELECT COUNT(*)::int FROM cars c WHERE c.vehicle_model_id = vm.id) DESC,
        vm.sort_order ASC NULLS LAST,
        vm.created_at ASC NULLS LAST,
        vm.id ASC
    ) AS rn,
    FIRST_VALUE(vm.id) OVER (
      PARTITION BY lower(
        regexp_replace(
          trim(concat_ws('-', vm.make, vm.model)),
          '[^a-zA-Z0-9]+',
          '-',
          'g'
        )
      )
      ORDER BY
        (SELECT COUNT(*)::int FROM cars c WHERE c.vehicle_model_id = vm.id) DESC,
        vm.sort_order ASC NULLS LAST,
        vm.created_at ASC NULLS LAST,
        vm.id ASC
    ) AS keep_id
  FROM vehicle_models vm
),
dupes AS (
  SELECT id AS dup_id, keep_id
  FROM model_stats
  WHERE rn > 1
)
UPDATE bookings b
SET vehicle_model_id = d.keep_id
FROM dupes d
WHERE b.vehicle_model_id = d.dup_id;

-- 3) Point reservations at canonical keeper (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'car_reservations'
  ) THEN
    WITH model_stats AS (
      SELECT
        vm.id,
        ROW_NUMBER() OVER (
          PARTITION BY lower(
            regexp_replace(
              trim(concat_ws('-', vm.make, vm.model)),
              '[^a-zA-Z0-9]+',
              '-',
              'g'
            )
          )
          ORDER BY
            (SELECT COUNT(*)::int FROM cars c WHERE c.vehicle_model_id = vm.id) DESC,
            vm.sort_order ASC NULLS LAST,
            vm.created_at ASC NULLS LAST,
            vm.id ASC
        ) AS rn,
        FIRST_VALUE(vm.id) OVER (
          PARTITION BY lower(
            regexp_replace(
              trim(concat_ws('-', vm.make, vm.model)),
              '[^a-zA-Z0-9]+',
              '-',
              'g'
            )
          )
          ORDER BY
            (SELECT COUNT(*)::int FROM cars c WHERE c.vehicle_model_id = vm.id) DESC,
            vm.sort_order ASC NULLS LAST,
            vm.created_at ASC NULLS LAST,
            vm.id ASC
        ) AS keep_id
      FROM vehicle_models vm
    ),
    dupes AS (
      SELECT id AS dup_id, keep_id
      FROM model_stats
      WHERE rn > 1
    )
    UPDATE car_reservations r
    SET vehicle_model_id = d.keep_id
    FROM dupes d
    WHERE r.vehicle_model_id = d.dup_id;
  END IF;
END $$;

-- 4) Delete duplicate family rows BEFORE updating slugs
WITH model_stats AS (
  SELECT
    vm.id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(
        regexp_replace(
          trim(concat_ws('-', vm.make, vm.model)),
          '[^a-zA-Z0-9]+',
          '-',
          'g'
        )
      )
      ORDER BY
        (SELECT COUNT(*)::int FROM cars c WHERE c.vehicle_model_id = vm.id) DESC,
        vm.sort_order ASC NULLS LAST,
        vm.created_at ASC NULLS LAST,
        vm.id ASC
    ) AS rn
  FROM vehicle_models vm
)
DELETE FROM vehicle_models vm
USING model_stats ms
WHERE vm.id = ms.id
  AND ms.rn > 1;

-- 5) Canonicalize surviving rows (one slug per family)
UPDATE vehicle_models vm
SET
  slug = lower(
    regexp_replace(
      trim(concat_ws('-', vm.make, vm.model)),
      '[^a-zA-Z0-9]+',
      '-',
      'g'
    )
  ),
  family_slug = lower(
    regexp_replace(
      trim(concat_ws(' ', vm.make, vm.model)),
      '[^a-zA-Z0-9]+',
      '-',
      'g'
    )
  ),
  family_name = trim(concat_ws(' ', vm.make, vm.model)),
  variant_name = COALESCE(vm.variant_name, 'Standard'),
  display_name = trim(concat_ws(' ', vm.make, vm.model)),
  year = NULL;

COMMIT;
