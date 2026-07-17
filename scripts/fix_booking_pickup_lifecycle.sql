-- Ensures driver pre-handover / pickup logging works (fixes 500 on /api/bookings/:id/pickup).
-- Run in Supabase SQL Editor after fix_booking_inspections_storage.sql.

-- Lifecycle booking statuses
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'on_trip';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending_collection';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'returned';

-- Pickup / return tracking columns
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_confirmed_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_pickup_location TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_odometer INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS return_confirmed_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS return_confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS return_odometer INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS return_notes TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS sub_status TEXT;
