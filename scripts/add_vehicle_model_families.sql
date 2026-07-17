-- ===============================================================
-- LinkedUp Cars — Persist vehicle model family metadata
-- Adds explicit family fields so grouping is data-driven instead of
-- relying only on make/model string heuristics.
-- Run after add_vehicle_models_foundation.sql.
-- Safe to re-run.
-- ===============================================================

BEGIN;

ALTER TABLE vehicle_models
  ADD COLUMN IF NOT EXISTS family_slug TEXT,
  ADD COLUMN IF NOT EXISTS family_name TEXT,
  ADD COLUMN IF NOT EXISTS variant_name TEXT;

CREATE INDEX IF NOT EXISTS idx_vehicle_models_family_slug
  ON vehicle_models(family_slug);

CREATE INDEX IF NOT EXISTS idx_vehicle_models_family_name
  ON vehicle_models(family_name);

WITH normalized AS (
  SELECT
    id,
    make,
    model,
    display_name,
    COALESCE(
      NULLIF(trim(family_name), ''),
      trim(concat_ws(' ', make, model))
    ) AS next_family_name,
    lower(
      coalesce(make, '') || ' ' ||
      coalesce(model, '') || ' ' ||
      coalesce(display_name, '')
    ) AS combined_text
  FROM vehicle_models
),
ruled AS (
  SELECT
    id,
    CASE
      WHEN combined_text LIKE '%toyota%'
        AND combined_text ~ '\yv8\y'
        AND combined_text ~ '(land\s*cruiser|prado|\blc\b)'
        THEN 'Toyota Land Cruiser Prado V8'
      WHEN combined_text LIKE '%toyota%'
        AND combined_text ~ '(land\s*cruiser\s*prado|\bprado\b|lc\s*prado)'
        AND combined_text !~ '\yv8\y'
        THEN 'Toyota Land Cruiser Prado'
      WHEN combined_text LIKE '%mercedes%'
        AND combined_text ~ '(g\s*class|g\s*wagon|\bg[0-9]{2,3}\b)'
        THEN 'Mercedes-Benz G-Class'
      ELSE next_family_name
    END AS ruled_family_name
  FROM normalized
)
UPDATE vehicle_models vm
SET
  family_name = r.ruled_family_name,
  family_slug = COALESCE(
    NULLIF(trim(vm.family_slug), ''),
    lower(
      regexp_replace(
        r.ruled_family_name,
        '[^a-zA-Z0-9]+',
        '-',
        'g'
      )
    )
  ),
  variant_name = CASE
    WHEN vm.year IS NULL THEN COALESCE(NULLIF(trim(vm.variant_name), ''), 'Standard')
    ELSE COALESCE(NULLIF(trim(vm.variant_name), ''), vm.year::text)
  END
FROM ruled r
WHERE vm.id = r.id;

COMMIT;
