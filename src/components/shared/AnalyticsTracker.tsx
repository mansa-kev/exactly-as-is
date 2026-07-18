import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsService } from '../../services/analyticsService';

/**
 * Visibility-aware page & interaction tracker.
 * - Records active time (pauses when tab hidden).
 * - Emits page_view on route change, page_leave with true active seconds.
 * - Global click delegation via [data-track] / anchor tags.
 * - Scroll-depth milestones (25/50/75/100).
 */
export function AnalyticsTracker() {
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  const activeMsRef = useRef(0);
  const lastTickRef = useRef(Date.now());
  const scrollHitRef = useRef<Set<number>>(new Set());

  // Tick active-time counter only while visible
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = Date.now();
      if (!document.hidden) activeMsRef.current += now - lastTickRef.current;
      lastTickRef.current = now;
      raf = window.setTimeout(tick, 1000) as unknown as number;
    };
    tick();
    const onVis = () => { lastTickRef.current = Date.now(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearTimeout(raf); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  // Page view / leave on route change
  useEffect(() => {
    const newPath = location.pathname;
    if (newPath === pathRef.current) return;
    const secs = Math.round(activeMsRef.current / 1000);
    analyticsService.track('page_leave', 'time_spent', { page_path: pathRef.current, time_spent_seconds: secs });
    pathRef.current = newPath;
    activeMsRef.current = 0;
    scrollHitRef.current.clear();
    analyticsService.track('page_view', 'load', { page_path: newPath });
  }, [location.pathname]);

  // Initial view + unload capture
  useEffect(() => {
    analyticsService.track('page_view', 'load', { page_path: location.pathname });
    const onLeave = () => {
      const secs = Math.round(activeMsRef.current / 1000);
      analyticsService.track('page_leave', 'time_spent', { page_path: pathRef.current, time_spent_seconds: secs });
    };
    window.addEventListener('pagehide', onLeave);
    return () => window.removeEventListener('pagehide', onLeave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global click delegation
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-track], a, button') as HTMLElement | null;
      if (!el) return;
      const trackName = el.getAttribute('data-track');
      if (trackName) {
        analyticsService.track('click', trackName, { metadata: parseData(el) });
      } else if (el.tagName === 'A') {
        const href = (el as HTMLAnchorElement).href;
        const external = href && !href.startsWith(window.location.origin);
        if (external) analyticsService.track('click', 'outbound_link', { metadata: { href } });
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Scroll depth
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const pct = Math.round(((h.scrollTop + window.innerHeight) / h.scrollHeight) * 100);
      for (const m of [25, 50, 75, 100]) {
        if (pct >= m && !scrollHitRef.current.has(m)) {
          scrollHitRef.current.add(m);
          analyticsService.track('scroll', `depth_${m}`, { metadata: { pct } });
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Global JS error capture
  useEffect(() => {
    const onErr = (ev: ErrorEvent) => {
      analyticsService.track('error', 'js_error', {
        metadata: { message: ev.message?.slice(0, 200), src: ev.filename, line: ev.lineno },
      });
    };
    window.addEventListener('error', onErr);
    return () => window.removeEventListener('error', onErr);
  }, []);

  return null;
}

function parseData(el: HTMLElement): Record<string, any> {
  const meta: Record<string, any> = {};
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('data-track-')) {
      meta[attr.name.replace('data-track-', '')] = attr.value;
    }
  }
  return meta;
}
