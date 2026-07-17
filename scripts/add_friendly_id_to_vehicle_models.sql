-- Add friendly_id to vehicle_models for SEO-friendly URLs
-- Run this in your Supabase SQL Editor

-- 1. Add the column (BIGSERIAL automatically creates a sequence and sets default)
ALTER TABLE public.vehicle_models
  ADD COLUMN IF NOT EXISTS friendly_id BIGSERIAL;

-- 2. Add a unique constraint to ensure fast lookups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_models_friendly_id_key'
  ) THEN
    ALTER TABLE public.vehicle_models
      ADD CONSTRAINT vehicle_models_friendly_id_key UNIQUE (friendly_id);
  END IF;
END $$;

-- 3. Add an index for performance
CREATE INDEX IF NOT EXISTS idx_vehicle_models_friendly_id ON public.vehicle_models(friendly_id);

COMMENT ON COLUMN public.vehicle_models.friendly_id IS 'Short integer ID for SEO-friendly URLs';
