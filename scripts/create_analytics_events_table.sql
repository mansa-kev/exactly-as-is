-- Migration to create analytics_events table
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  page_url TEXT,
  time_spent_seconds INTEGER,
  device_type TEXT,
  region TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow public to insert events (anonymous tracking)
CREATE POLICY "Allow public insert to analytics_events"
  ON public.analytics_events FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow authenticated admins to view events
CREATE POLICY "Allow admins to select analytics_events"
  ON public.analytics_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'
    )
  );
