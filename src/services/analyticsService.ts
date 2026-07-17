import { supabase } from '../lib/supabase';

export type AnalyticsEventType = 'page_view' | 'click' | 'booking_step' | 'error' | 'page_leave';

export interface AnalyticsEventData {
  page_url?: string;
  time_spent_seconds?: number;
  metadata?: Record<string, any>;
}

class AnalyticsService {
  private sessionId: string;
  private region: string | null = null;
  private deviceType: string;
  private isInitializing = false;
  private pendingEvents: any[] = [];
  
  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.deviceType = this.detectDeviceType();
    this.initRegion();
  }

  private getOrCreateSessionId(): string {
    let sid = sessionStorage.getItem('linkedup_session_id');
    if (!sid) {
      sid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('linkedup_session_id', sid);
    }
    return sid;
  }

  private detectDeviceType(): string {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }

  private async initRegion() {
    try {
      // Try to get from sessionStorage first
      const cached = sessionStorage.getItem('linkedup_user_region');
      if (cached) {
        this.region = cached;
        return;
      }
      
      this.isInitializing = true;
      // Using ipapi.co as it is free and does not require an API key for low-volume client-side calls
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        const loc = `${data.city || data.region || 'Unknown'}, ${data.country_name || 'Unknown'}`;
        this.region = loc;
        sessionStorage.setItem('linkedup_user_region', loc);
      }
    } catch (err) {
      console.warn('Failed to resolve region:', err);
      this.region = 'Unknown';
    } finally {
      this.isInitializing = false;
      this.flushPendingEvents();
    }
  }

  private async flushPendingEvents() {
    if (this.pendingEvents.length === 0) return;
    const eventsToPush = [...this.pendingEvents];
    this.pendingEvents = [];
    
    for (const event of eventsToPush) {
      await this.pushToSupabase(event);
    }
  }

  private async pushToSupabase(event: any) {
    try {
      await supabase.from('analytics_events').insert([{
        session_id: this.sessionId,
        event_type: event.event_type,
        event_name: event.event_name,
        page_url: event.page_url || window.location.pathname,
        time_spent_seconds: event.time_spent_seconds || null,
        device_type: this.deviceType,
        region: this.region || 'Unknown',
        metadata: event.metadata || {}
      }]);
    } catch (err) {
      console.error('Failed to log analytics:', err);
    }
  }

  public trackEvent(eventType: AnalyticsEventType, eventName: string, data?: AnalyticsEventData) {
    const event = {
      event_type: eventType,
      event_name: eventName,
      page_url: data?.page_url || window.location.pathname,
      time_spent_seconds: data?.time_spent_seconds,
      metadata: data?.metadata || {},
    };

    if (this.isInitializing) {
      this.pendingEvents.push(event);
    } else {
      this.pushToSupabase(event);
    }
  }

  // Helper method specifically for booking dropoffs and neighborhood tracking
  public trackBookingStep(stepName: string, metadata: Record<string, any>) {
    this.trackEvent('booking_step', stepName, { metadata });
  }
}

export const analyticsService = new AnalyticsService();
