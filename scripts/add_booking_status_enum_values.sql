-- Optional: extend booking_status enum for lifecycle states used in the admin UI.
-- Safe to re-run in Supabase SQL Editor.

ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'on_trip';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending_collection';
