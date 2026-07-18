// Supabase Edge Function: track-event
// Deploy: supabase functions deploy track-event --project-ref <ref> --no-verify-jwt
// Secrets required (set via `supabase secrets set` or dashboard):
//   IPINFO_TOKEN                – ipinfo.io API token
//   SUPABASE_URL                – auto-provided
//   SUPABASE_SERVICE_ROLE_KEY   – auto-provided
//
// Accepts POST body: { events: EventPayload[] }
// EventPayload = {
//   visitor_id, session_id, user_id?, event_type, event_name,
//   page_url?, page_path?, referrer?, utm?, device_type?, browser?, os?,
//   screen_size?, language?, timezone?, time_spent_seconds?, metadata?
// }

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IPINFO_TOKEN = Deno.env.get("IPINFO_TOKEN") || "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// In-memory geo cache (per warm instance)
const geoCache = new Map<string, { data: any; ts: number }>();
const GEO_TTL_MS = 24 * 60 * 60 * 1000;

const BOT_RE = /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|linkedinbot|whatsapp|telegrambot|discordbot|slackbot|headless|python-requests|axios|curl|wget|monitor|uptime|pingdom|lighthouse|gtmetrix|pagespeed/i;

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0].trim();
  return first || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "";
}

async function hashIp(ip: string): Promise<string> {
  if (!ip) return "";
  const buf = new TextEncoder().encode(ip + "|linkedup-analytics");
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function lookupGeo(ip: string) {
  if (!ip || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.") || ip === "::1") {
    return { country: "Unknown", region: "", city: "", latitude: null, longitude: null };
  }
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.ts < GEO_TTL_MS) return cached.data;
  try {
    const url = IPINFO_TOKEN
      ? `https://ipinfo.io/${ip}/json?token=${IPINFO_TOKEN}`
      : `https://ipinfo.io/${ip}/json`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`ipinfo ${r.status}`);
    const j = await r.json();
    const [lat, lng] = (j.loc || ",").split(",");
    const data = {
      country: j.country || "Unknown",
      region: j.region || "",
      city: j.city || "",
      latitude: lat ? parseFloat(lat) : null,
      longitude: lng ? parseFloat(lng) : null,
    };
    geoCache.set(ip, { data, ts: Date.now() });
    return data;
  } catch (_e) {
    return { country: "Unknown", region: "", city: "", latitude: null, longitude: null };
  }
}

function parseUA(ua: string) {
  const u = (ua || "").toLowerCase();
  let device = "desktop";
  if (/tablet|ipad|playbook|silk|(android(?!.*mobi))/.test(u)) device = "tablet";
  else if (/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/.test(u)) device = "mobile";
  let browser = "Other";
  if (/edg\//.test(u)) browser = "Edge";
  else if (/chrome\//.test(u) && !/edg\//.test(u)) browser = "Chrome";
  else if (/safari\//.test(u) && !/chrome\//.test(u)) browser = "Safari";
  else if (/firefox\//.test(u)) browser = "Firefox";
  let os = "Other";
  if (/windows/.test(u)) os = "Windows";
  else if (/mac os x|macintosh/.test(u)) os = "macOS";
  else if (/android/.test(u)) os = "Android";
  else if (/iphone|ipad|ios/.test(u)) os = "iOS";
  else if (/linux/.test(u)) os = "Linux";
  return { device, browser, os };
}

function refDomain(ref: string) {
  if (!ref) return "";
  try { return new URL(ref).hostname.replace(/^www\./, ""); } catch { return ""; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  let body: any;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400, headers: corsHeaders }); }
  const events: any[] = Array.isArray(body?.events) ? body.events : [];
  if (events.length === 0) return new Response(JSON.stringify({ ok: true, n: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (events.length > 50) events.length = 50; // hard cap

  const ua = req.headers.get("user-agent") || "";
  const isBot = BOT_RE.test(ua);
  const ip = clientIp(req);
  const [ipHash, geo] = await Promise.all([hashIp(ip), lookupGeo(ip)]);
  const parsed = parseUA(ua);

  const rows = events.map((e) => ({
    visitor_id: String(e.visitor_id || "unknown").slice(0, 64),
    session_id: String(e.session_id || "unknown").slice(0, 64),
    user_id: e.user_id || null,
    event_type: String(e.event_type || "unknown").slice(0, 32),
    event_name: String(e.event_name || "unknown").slice(0, 64),
    page_url: e.page_url || null,
    page_path: e.page_path || null,
    referrer: e.referrer || null,
    referrer_domain: refDomain(e.referrer || ""),
    utm_source: e.utm?.source || null,
    utm_medium: e.utm?.medium || null,
    utm_campaign: e.utm?.campaign || null,
    utm_term: e.utm?.term || null,
    utm_content: e.utm?.content || null,
    device_type: e.device_type || parsed.device,
    browser: e.browser || parsed.browser,
    os: e.os || parsed.os,
    screen_size: e.screen_size || null,
    language: e.language || null,
    timezone: e.timezone || null,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    latitude: geo.latitude,
    longitude: geo.longitude,
    ip_hash: ipHash,
    is_bot: isBot,
    time_spent_seconds: typeof e.time_spent_seconds === "number" ? Math.min(Math.max(0, e.time_spent_seconds | 0), 3600) : null,
    metadata: e.metadata || {},
  }));

  const { error } = await supabase.from("analytics_events_v2").insert(rows);
  if (error) {
    console.error("insert failed", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ ok: true, n: rows.length }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
