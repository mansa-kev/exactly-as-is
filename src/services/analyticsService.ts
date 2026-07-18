// Client-side analytics: batched, visibility-aware, sendBeacon on exit.
// Sends events to the `track-event` edge function which handles IP + GeoIP + bot filtering.

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-event`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const VISITOR_KEY = 'lu_visitor_id';
const SESSION_KEY = 'lu_session';
const UTM_KEY = 'lu_utm';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export type AnalyticsEventType =
  | 'page_view' | 'page_leave' | 'click' | 'booking_step'
  | 'error' | 'scroll' | 'search' | 'form';

interface Utm { source?: string; medium?: string; campaign?: string; term?: string; content?: string }
interface QueuedEvent {
  event_type: AnalyticsEventType;
  event_name: string;
  page_url?: string;
  page_path?: string;
  time_spent_seconds?: number;
  metadata?: Record<string, any>;
  ts: number;
}

function uuid() {
  return (crypto as any).randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
}

function getVisitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) { v = uuid(); localStorage.setItem(VISITOR_KEY, v); }
    return v;
  } catch { return 'anon-' + Math.random().toString(36).slice(2); }
}

function getSessionId(): string {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const now = Date.now();
    if (raw) {
      const parsed = JSON.parse(raw);
      if (now - parsed.last < SESSION_TIMEOUT_MS) {
        parsed.last = now;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
        return parsed.id;
      }
    }
    const fresh = { id: uuid(), last: now };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
    return fresh.id;
  } catch { return 'sess-' + Math.random().toString(36).slice(2); }
}

function loadUtm(): Utm {
  try {
    const p = new URLSearchParams(window.location.search);
    const fromUrl: Utm = {
      source: p.get('utm_source') || undefined,
      medium: p.get('utm_medium') || undefined,
      campaign: p.get('utm_campaign') || undefined,
      term: p.get('utm_term') || undefined,
      content: p.get('utm_content') || undefined,
    };
    if (fromUrl.source || fromUrl.medium || fromUrl.campaign) {
      sessionStorage.setItem(UTM_KEY, JSON.stringify(fromUrl));
      return fromUrl;
    }
    const cached = sessionStorage.getItem(UTM_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch { return {}; }
}

class AnalyticsService {
  private visitorId = getVisitorId();
  private queue: QueuedEvent[] = [];
  private flushTimer: number | null = null;
  private currentUserId: string | null = null;
  private screenSize = `${window.screen.width}x${window.screen.height}`;
  private timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  private language = navigator.language;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.flush(true));
      window.addEventListener('beforeunload', () => this.flush(true));
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.flush(true);
      });
    }
  }

  setUser(id: string | null) { this.currentUserId = id; }

  track(type: AnalyticsEventType, name: string, data?: { page_url?: string; page_path?: string; time_spent_seconds?: number; metadata?: Record<string, any> }) {
    this.queue.push({
      event_type: type,
      event_name: name,
      page_url: data?.page_url || window.location.href,
      page_path: data?.page_path || window.location.pathname,
      time_spent_seconds: data?.time_spent_seconds,
      metadata: data?.metadata || {},
      ts: Date.now(),
    });
    this.scheduleFlush();
  }

  trackBookingStep(step: string, metadata: Record<string, any> = {}) {
    this.track('booking_step', step, { metadata });
  }

  /** Backward-compatible alias for legacy call-sites. */
  trackEvent(type: AnalyticsEventType | string, name: string, data?: { page_url?: string; page_path?: string; time_spent_seconds?: number; metadata?: Record<string, any> }) {
    this.track(type as AnalyticsEventType, name, data);
  }

  private scheduleFlush() {
    if (this.queue.length >= 10) return this.flush();
    if (this.flushTimer !== null) return;
    this.flushTimer = window.setTimeout(() => this.flush(), 4000);
  }

  private buildPayload() {
    const utm = loadUtm();
    const sessionId = getSessionId();
    return {
      events: this.queue.map((e) => ({
        visitor_id: this.visitorId,
        session_id: sessionId,
        user_id: this.currentUserId,
        event_type: e.event_type,
        event_name: e.event_name,
        page_url: e.page_url,
        page_path: e.page_path,
        referrer: document.referrer || null,
        utm,
        screen_size: this.screenSize,
        language: this.language,
        timezone: this.timezone,
        time_spent_seconds: e.time_spent_seconds,
        metadata: e.metadata,
      })),
    };
  }

  flush(useBeacon = false) {
    if (this.flushTimer !== null) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    if (this.queue.length === 0) return;
    const payload = this.buildPayload();
    this.queue = [];

    const body = JSON.stringify(payload);
    if (useBeacon && 'sendBeacon' in navigator) {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(EDGE_URL + `?apikey=${ANON_KEY}`, blob);
        return;
      } catch { /* fall through to fetch */ }
    }
    fetch(EDGE_URL, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body,
    }).catch(() => { /* silent */ });
  }
}

export const analyticsService = new AnalyticsService();
