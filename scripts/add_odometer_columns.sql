-- Add odometer columns to bookings for mileage tracking
-- Run in Supabase SQL Editor

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_odometer INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS return_odometer INTEGER;
-- km_driven is computed on the fly: return_odometer - pickup_odometer
