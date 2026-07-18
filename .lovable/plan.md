
# Analytics Module Audit (no fixes yet)

## What exists today

**Data pipeline (3 pieces):**
- `src/services/analyticsService.ts` — singleton in the browser. Generates a `sessionStorage` session id, sniffs device type from UA, resolves region once from `https://ipapi.co/json/`, and inserts rows directly into the `analytics_events` table via the anon Supabase client.
- `src/components/shared/AnalyticsTracker.tsx` — mounted in `App.tsx`. Fires `page_view/load`, `page_view/initial_load`, `page_view/ping` (every 30s), `page_leave/time_spent`, and stashes UTM params in `sessionStorage`. Also tracks the last focused input name.
- `src/components/admin/AdminAnalyticsCenter.tsx` — admin view. Pulls the whole `analytics_events` table (`select *`) for 7d / 30d / all, then aggregates client-side into KPIs, funnel, hourly/daily charts, top cars, neighborhoods, regions.

**Schema:** `scripts/create_analytics_events_table.sql` — `session_id, event_type, event_name, page_url, time_spent_seconds, device_type, region, metadata jsonb, created_at`. RLS: public INSERT allowed, admin SELECT via `user_profiles.role = 'admin'` subquery.

**Emitters found in code:** `page_view`, `page_leave`, `booking_step` (from `BookingFlow.tsx`), plus click events named `vehicle_card`, `whatsapp_support`, `request_callback`, `sign_up_submit` (the dashboard reads these; there are patch files `patch_clicks.mjs` suggesting they were wired in).

## Gaps and inaccuracies

### 1. IP / location resolution is the weakest link
- **Client-side geolocation via `ipapi.co`**: free tier, no key, rate-limited (~1k/day per IP), CORS-dependent, and any adblocker (uBlock, Brave shields) blocks it silently → row saved as `region = 'Unknown'`. Mobile Safari private mode also blocks third-party fetches.
- **Cached per session only**: a returning visitor tomorrow re-hits ipapi; roaming users get stamped with their first city forever within a session.
- **No country / city / lat-lng columns** — the whole location is a free-text `"City, Country"` string, so you can't group by country, plot a map, or filter "Kenya only".
- **No server-side truth**: the real client IP (available on the edge via `x-forwarded-for`) is never captured. All geo depends on the browser succeeding at a third-party call.
- **VPN / proxy / bot traffic** is indistinguishable from real users.

### 2. Sessions and uniqueness are unreliable
- `session_id` lives in `sessionStorage`, so it resets on every tab close and is per-tab. "Unique sessions" ≠ unique visitors, and the same person opening two tabs counts twice.
- No `visitor_id` (persistent `localStorage` UUID) → you can't compute returning vs new, DAU/MAU, or retention.
- No `user_id` linkage even after login → authenticated behavior can't be tied to the anonymous journey.

### 3. Event coverage is thin and inconsistent
- Only 4 explicit click events (`vehicle_card`, `whatsapp_support`, `request_callback`, `sign_up_submit`). No global click delegation, no scroll depth, no rage-clicks, no form-abandonment, no outbound-link tracking, no error/JS-exception capture.
- Funnel has only 3 booking steps; step 4 (payment/confirmation) and drop-off reasons aren't tracked, so conversion rate can't be computed.
- No `referrer` column — UTM is captured but *organic referrer* (`document.referrer`) is thrown away.
- No `user_agent`, `browser`, `os`, `screen_size`, `language`, `timezone` — device_type is a coarse regex.
- Pings every 30s inflate row count massively but aren't distinguished from real views in the dashboard (`pageViews.length` counts pings too → **page-view KPI is inflated ~3-6x**).

### 4. Time-on-page is inaccurate
- `time_spent_seconds` is wall-clock since mount; background tabs, sleeping laptops, and idle users all count. No visibility API (`document.hidden`), no idle detection, no `sendBeacon` on `pagehide` → last-page duration is lost when the tab closes.

### 5. Dashboard reads and computes wrong / at scale won't work
- `select *` with no `limit` — will download every row from the table for "all time". Once you have 100k+ rows, the admin page will time out or crash the browser.
- All aggregation happens in JS (`reduce`) instead of in SQL / an RPC or materialized view. No indexes are declared on `created_at`, `event_type`, `session_id`.
- KPIs conflate `page_view` with `ping` events (see above).
- `Top Cars` block is rendered **twice** (once as "Most Clicked Models", once as "Top Cars by Engagement" — identical `topCars` array).
- Hex colors hardcoded in chart props bypass the design tokens; charts won't respect dark/light mode.
- Time range uses local browser timezone (`toLocaleDateString`) → daily buckets shift for admins in other TZs.

### 6. Data quality / integrity
- No bot filtering (Googlebot, health checks, uptime pings all counted).
- No dedupe on double-fire (React 18 StrictMode double-mounts in dev; and the tracker also fires both `initial_load` and `load` on first render).
- No sampling or batching — every event is one round-trip insert. Slow networks lose events; a burst of clicks = burst of inserts.
- No retention policy — table grows forever. No aggregate/rollup tables.
- Anon INSERT with no rate-limit / no CAPTCHA → the endpoint can be spammed to pollute the table.
- PII risk: the tracker stores the *name* of the last focused input in metadata (`last_input_touched`); if a field name is sensitive (`email`, `phone`) that's fine, but if any page uses field names that reveal content it leaks.

### 7. Missing dimensions a "detailed" module would need
- Country, region, city, lat/lng (from server-side IP lookup).
- ISP / connection type, is_bot, is_vpn.
- New vs returning visitor, session duration, pages per session, bounce rate.
- Entry page, exit page, referrer domain.
- Conversion attribution: which UTM/referrer led to a completed booking, revenue per source.
- Vehicle funnel: impressions → card clicks → booking start → booking complete, per model.
- Search terms / filter usage on `CarShowroom`.
- Error events (JS errors, failed API calls) as a separate `error` stream.

## What a rebuild would look like (high level, for later approval)

1. **Move ingestion server-side.** New Supabase Edge Function `track-event` that receives batched events via `navigator.sendBeacon`, reads client IP from headers, resolves geo server-side (MaxMind GeoLite2 as a bundled DB, or ipinfo/ipapi with a key and server-side caching by IP → 1 lookup per unique IP per day instead of one per session).
2. **Split identity model:** persistent `visitor_id` in `localStorage`, ephemeral `session_id` (30-min inactivity window), optional `user_id` when authenticated. Add columns for all three.
3. **Expand schema** with `country`, `region`, `city`, `lat`, `lng`, `ip_hash` (not raw IP for privacy), `referrer`, `referrer_domain`, `utm_*` as first-class columns, `user_agent`, `browser`, `os`, `screen`, `is_bot`, `visitor_id`, `user_id`. Add indexes on `(created_at)`, `(event_type, created_at)`, `(session_id)`, `(visitor_id)`.
4. **Bot & noise filtering** in the edge function (UA denylist, ignore `Googlebot`, health checks, and `document.hidden` pings).
5. **Rollup tables** (`analytics_daily`, `analytics_hourly`, `analytics_funnel_daily`) refreshed by a cron edge function. The admin dashboard reads rollups, not raw events — makes it fast forever.
6. **Correct visibility-aware time-on-page** using `visibilitychange` + `pagehide` + `sendBeacon`, capped per event.
7. **Broader instrumentation**: global click delegation with data-attributes (`data-track="cta:whatsapp"`), scroll-depth (25/50/75/100), search & filter usage, add step 4 (payment/confirm) to the funnel, capture JS errors.
8. **Dashboard rebuild** on SQL RPCs (`get_traffic_overview(range)`, `get_funnel(range)`, `get_geo_breakdown(range)`, `get_top_vehicles(range)`) — pagination, real KPIs (page_views exclude pings), map view for geo, new-vs-returning, bounce rate, conversion %. De-dup the "Top Cars" section. Use design tokens for chart colors.
9. **Retention & privacy**: 90/180-day retention on raw events, indefinite on rollups; hash IPs; document what's stored.

## Report — bottom line

The current module is a **v0 prototype**: it writes rows and draws charts, but the geo layer relies on a blockable third-party call from the browser, "unique sessions" aren't unique, page-view counts are inflated by 30-second pings, the funnel stops at step 3, the whole raw table is downloaded to the browser on every dashboard load, and one card is duplicated. To get to "near-accurate", ingestion needs to move server-side (real IP + real geo), the schema needs proper dimensions and indexes, the dashboard needs to read pre-aggregated rollups, and event coverage needs to expand.

No code changes were made — awaiting your go-ahead on which of the nine rebuild items above to include in the first pass (my recommendation: 1, 2, 3, 4, 8 as phase 1; 5, 6, 7, 9 as phase 2).
