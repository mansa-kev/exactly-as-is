-- =====================================================================
-- Analytics v2 Schema
-- Run this in the Supabase SQL Editor (as service_role / owner).
-- Idempotent — safe to re-run.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- Raw events -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_events_v2 (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visitor_id       TEXT NOT NULL,
  session_id       TEXT NOT NULL,
  user_id          UUID,
  event_type       TEXT NOT NULL,       -- page_view | click | booking_step | error | page_leave | scroll | search
  event_name       TEXT NOT NULL,
  page_url         TEXT,
  page_path        TEXT,
  referrer         TEXT,
  referrer_domain  TEXT,
  utm_source       TEXT,
  utm_medium       TEXT,
  utm_campaign     TEXT,
  utm_term         TEXT,
  utm_content      TEXT,
  device_type      TEXT,                -- mobile | tablet | desktop
  browser          TEXT,
  os               TEXT,
  screen_size      TEXT,
  language         TEXT,
  timezone         TEXT,
  country          TEXT,
  region           TEXT,
  city             TEXT,
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  ip_hash          TEXT,
  is_bot           BOOLEAN DEFAULT FALSE,
  time_spent_seconds INTEGER,
  metadata         JSONB DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aev2_created         ON public.analytics_events_v2 (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aev2_type_created    ON public.analytics_events_v2 (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aev2_visitor         ON public.analytics_events_v2 (visitor_id);
CREATE INDEX IF NOT EXISTS idx_aev2_session         ON public.analytics_events_v2 (session_id);
CREATE INDEX IF NOT EXISTS idx_aev2_country_created ON public.analytics_events_v2 (country, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aev2_isbot           ON public.analytics_events_v2 (is_bot);

ALTER TABLE public.analytics_events_v2 ENABLE ROW LEVEL SECURITY;

-- No public insert (edge function uses service_role). Admins can read.
DROP POLICY IF EXISTS "aev2_admin_select" ON public.analytics_events_v2;
CREATE POLICY "aev2_admin_select" ON public.analytics_events_v2 FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ---------- Rollups --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_daily (
  day             DATE PRIMARY KEY,
  page_views      INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  unique_sessions INTEGER NOT NULL DEFAULT 0,
  new_visitors    INTEGER NOT NULL DEFAULT 0,
  avg_session_seconds NUMERIC(10,2) DEFAULT 0,
  bounce_rate     NUMERIC(5,2) DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.analytics_geo_daily (
  day     DATE NOT NULL,
  country TEXT NOT NULL,
  region  TEXT,
  city    TEXT,
  visits  INTEGER NOT NULL DEFAULT 0,
  visitors INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, country, COALESCE(region, ''), COALESCE(city, ''))
);

CREATE TABLE IF NOT EXISTS public.analytics_vehicle_daily (
  day        DATE NOT NULL,
  vehicle_id TEXT NOT NULL,
  label      TEXT,
  impressions INTEGER DEFAULT 0,
  clicks     INTEGER DEFAULT 0,
  bookings_started INTEGER DEFAULT 0,
  bookings_completed INTEGER DEFAULT 0,
  PRIMARY KEY (day, vehicle_id)
);

CREATE TABLE IF NOT EXISTS public.analytics_funnel_daily (
  day  DATE NOT NULL,
  step TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  PRIMARY KEY (day, step)
);

ALTER TABLE public.analytics_daily         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_geo_daily     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_vehicle_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_funnel_daily  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  FOR t IN SELECT unnest(ARRAY['analytics_daily','analytics_geo_daily','analytics_vehicle_daily','analytics_funnel_daily']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_admin_select" ON public.%s', t, t);
    EXECUTE format($p$CREATE POLICY "%s_admin_select" ON public.%s FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))$p$, t, t);
  END LOOP;
END $$;

-- ---------- Rollup refresh ------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_analytics_rollups(_days INT DEFAULT 3)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _from TIMESTAMPTZ := NOW() - (_days || ' days')::interval;
BEGIN
  -- Daily overview
  INSERT INTO analytics_daily (day, page_views, unique_visitors, unique_sessions, new_visitors, avg_session_seconds, bounce_rate)
  SELECT
    date_trunc('day', created_at)::date AS day,
    COUNT(*) FILTER (WHERE event_type='page_view' AND event_name <> 'ping') AS page_views,
    COUNT(DISTINCT visitor_id) AS unique_visitors,
    COUNT(DISTINCT session_id) AS unique_sessions,
    COUNT(DISTINCT visitor_id) FILTER (
      WHERE visitor_id NOT IN (
        SELECT DISTINCT visitor_id FROM analytics_events_v2 e2
        WHERE e2.created_at < date_trunc('day', analytics_events_v2.created_at)
      )
    ) AS new_visitors,
    COALESCE(AVG(time_spent_seconds) FILTER (WHERE event_type='page_leave'),0) AS avg_session_seconds,
    0::numeric AS bounce_rate
  FROM analytics_events_v2
  WHERE created_at >= _from AND is_bot = false
  GROUP BY 1
  ON CONFLICT (day) DO UPDATE SET
    page_views = EXCLUDED.page_views,
    unique_visitors = EXCLUDED.unique_visitors,
    unique_sessions = EXCLUDED.unique_sessions,
    new_visitors = EXCLUDED.new_visitors,
    avg_session_seconds = EXCLUDED.avg_session_seconds,
    updated_at = NOW();

  -- Bounce rate (single page-view sessions / total sessions)
  UPDATE analytics_daily d SET bounce_rate = sub.br FROM (
    SELECT date_trunc('day', created_at)::date AS day,
           ROUND(100.0 * COUNT(*) FILTER (WHERE pv=1) / NULLIF(COUNT(*),0), 2) AS br
    FROM (
      SELECT session_id, date_trunc('day', MIN(created_at))::date AS created_at,
             COUNT(*) FILTER (WHERE event_type='page_view' AND event_name <> 'ping') AS pv
      FROM analytics_events_v2 WHERE created_at >= _from AND is_bot=false
      GROUP BY session_id
    ) s
    GROUP BY 1
  ) sub WHERE d.day = sub.day;

  -- Geo daily
  DELETE FROM analytics_geo_daily WHERE day >= _from::date;
  INSERT INTO analytics_geo_daily (day, country, region, city, visits, visitors)
  SELECT date_trunc('day', created_at)::date, COALESCE(country,'Unknown'),
         COALESCE(region,''), COALESCE(city,''),
         COUNT(*) FILTER (WHERE event_type='page_view' AND event_name <> 'ping'),
         COUNT(DISTINCT visitor_id)
  FROM analytics_events_v2
  WHERE created_at >= _from AND is_bot=false
  GROUP BY 1,2,3,4;

  -- Vehicle daily
  DELETE FROM analytics_vehicle_daily WHERE day >= _from::date;
  INSERT INTO analytics_vehicle_daily (day, vehicle_id, label, impressions, clicks, bookings_started, bookings_completed)
  SELECT date_trunc('day', created_at)::date,
         COALESCE(metadata->>'vehicle_id', metadata->>'model_id', metadata->>'car_id','unknown'),
         COALESCE(metadata->>'label', metadata->>'name', metadata->>'model_name', metadata->>'vehicle_id','—'),
         COUNT(*) FILTER (WHERE event_name='vehicle_impression'),
         COUNT(*) FILTER (WHERE event_name='vehicle_card'),
         COUNT(*) FILTER (WHERE event_type='booking_step' AND event_name IN ('step_1','start')),
         COUNT(*) FILTER (WHERE event_type='booking_step' AND event_name IN ('step_4','complete','confirmation'))
  FROM analytics_events_v2
  WHERE created_at >= _from AND is_bot=false
    AND (metadata ? 'vehicle_id' OR metadata ? 'model_id' OR metadata ? 'car_id')
  GROUP BY 1,2,3;

  -- Funnel daily
  DELETE FROM analytics_funnel_daily WHERE day >= _from::date;
  INSERT INTO analytics_funnel_daily (day, step, count)
  SELECT date_trunc('day', created_at)::date, event_name, COUNT(DISTINCT session_id)
  FROM analytics_events_v2
  WHERE created_at >= _from AND is_bot=false AND event_type='booking_step'
  GROUP BY 1,2;
END $$;

-- ---------- RPCs for dashboard --------------------------------------
CREATE OR REPLACE FUNCTION public.get_traffic_overview(_days INT DEFAULT 7)
RETURNS TABLE(day DATE, page_views INT, unique_visitors INT, unique_sessions INT, new_visitors INT, avg_session_seconds NUMERIC, bounce_rate NUMERIC)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT day, page_views, unique_visitors, unique_sessions, new_visitors, avg_session_seconds, bounce_rate
  FROM analytics_daily
  WHERE day >= (NOW() - (_days || ' days')::interval)::date
  ORDER BY day;
$$;

CREATE OR REPLACE FUNCTION public.get_hourly_traffic(_days INT DEFAULT 1)
RETURNS TABLE(hour_ts TIMESTAMPTZ, page_views BIGINT, sessions BIGINT)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT date_trunc('hour', created_at) AS hour_ts,
         COUNT(*) FILTER (WHERE event_type='page_view' AND event_name<>'ping') AS page_views,
         COUNT(DISTINCT session_id) AS sessions
  FROM analytics_events_v2
  WHERE created_at >= NOW() - (_days || ' days')::interval AND is_bot=false
  GROUP BY 1 ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.get_geo_breakdown(_days INT DEFAULT 30)
RETURNS TABLE(country TEXT, region TEXT, city TEXT, visits BIGINT, visitors BIGINT)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT country, NULLIF(region,'') AS region, NULLIF(city,'') AS city,
         SUM(visits)::BIGINT, SUM(visitors)::BIGINT
  FROM analytics_geo_daily
  WHERE day >= (NOW() - (_days || ' days')::interval)::date
  GROUP BY 1,2,3 ORDER BY 4 DESC LIMIT 200;
$$;

CREATE OR REPLACE FUNCTION public.get_top_vehicles(_days INT DEFAULT 30)
RETURNS TABLE(vehicle_id TEXT, label TEXT, impressions BIGINT, clicks BIGINT, bookings_started BIGINT, bookings_completed BIGINT)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT vehicle_id, MAX(label),
         SUM(impressions)::BIGINT, SUM(clicks)::BIGINT,
         SUM(bookings_started)::BIGINT, SUM(bookings_completed)::BIGINT
  FROM analytics_vehicle_daily
  WHERE day >= (NOW() - (_days || ' days')::interval)::date
  GROUP BY vehicle_id ORDER BY 4 DESC NULLS LAST LIMIT 25;
$$;

CREATE OR REPLACE FUNCTION public.get_funnel_breakdown(_days INT DEFAULT 30)
RETURNS TABLE(step TEXT, count BIGINT)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT step, SUM(count)::BIGINT
  FROM analytics_funnel_daily
  WHERE day >= (NOW() - (_days || ' days')::interval)::date
  GROUP BY step ORDER BY 2 DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_device_breakdown(_days INT DEFAULT 30)
RETURNS TABLE(device_type TEXT, sessions BIGINT)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT COALESCE(device_type,'unknown'), COUNT(DISTINCT session_id)
  FROM analytics_events_v2
  WHERE created_at >= NOW() - (_days || ' days')::interval AND is_bot=false
  GROUP BY 1 ORDER BY 2 DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_referrer_breakdown(_days INT DEFAULT 30)
RETURNS TABLE(source TEXT, sessions BIGINT)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT COALESCE(NULLIF(utm_source,''), NULLIF(referrer_domain,''), 'direct'),
         COUNT(DISTINCT session_id)
  FROM analytics_events_v2
  WHERE created_at >= NOW() - (_days || ' days')::interval AND is_bot=false
  GROUP BY 1 ORDER BY 2 DESC LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.get_top_pages(_days INT DEFAULT 7)
RETURNS TABLE(page_path TEXT, views BIGINT, avg_time NUMERIC)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT COALESCE(page_path,'/'), COUNT(*) FILTER (WHERE event_type='page_view' AND event_name<>'ping')::BIGINT,
         ROUND(AVG(time_spent_seconds) FILTER (WHERE event_type='page_leave'),1)
  FROM analytics_events_v2
  WHERE created_at >= NOW() - (_days || ' days')::interval AND is_bot=false
  GROUP BY 1 ORDER BY 2 DESC LIMIT 25;
$$;

-- ---------- Retention -----------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_analytics_events(_days INT DEFAULT 90)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  DELETE FROM analytics_events_v2 WHERE created_at < NOW() - (_days || ' days')::interval;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- ---------- Grants ---------------------------------------------------
GRANT SELECT ON public.analytics_events_v2, public.analytics_daily,
                public.analytics_geo_daily, public.analytics_vehicle_daily,
                public.analytics_funnel_daily TO authenticated;
GRANT ALL ON public.analytics_events_v2, public.analytics_daily,
             public.analytics_geo_daily, public.analytics_vehicle_daily,
             public.analytics_funnel_daily TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_analytics_rollups(INT),
                            public.prune_analytics_events(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_traffic_overview(INT),
                            public.get_hourly_traffic(INT),
                            public.get_geo_breakdown(INT),
                            public.get_top_vehicles(INT),
                            public.get_funnel_breakdown(INT),
                            public.get_device_breakdown(INT),
                            public.get_referrer_breakdown(INT),
                            public.get_top_pages(INT) TO authenticated;
