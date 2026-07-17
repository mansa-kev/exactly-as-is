import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsService } from '../../services/analyticsService';

export function AnalyticsTracker() {
  const location = useLocation();
  const currentPathRef = useRef(location.pathname);
  const startTimeRef = useRef(Date.now());

  // Parse and save UTM parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');
    
    if (utmSource || utmMedium || utmCampaign) {
      const utmData = {
        source: utmSource || '',
        medium: utmMedium || '',
        campaign: utmCampaign || ''
      };
      sessionStorage.setItem('linkedup_utm', JSON.stringify(utmData));
    }
  }, [location.search]);

  useEffect(() => {
    const newPath = location.pathname;
    if (newPath !== currentPathRef.current) {
      const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
      
      const utmDataStr = sessionStorage.getItem('linkedup_utm');
      const utmData = utmDataStr ? JSON.parse(utmDataStr) : {};

      analyticsService.trackEvent('page_leave', 'time_spent', {
        page_url: currentPathRef.current,
        time_spent_seconds: timeSpent,
        metadata: { ...utmData }
      });

      currentPathRef.current = newPath;
      startTimeRef.current = Date.now();
      
      analyticsService.trackEvent('page_view', 'load', {
        page_url: newPath,
        metadata: { ...utmData }
      });
    }
  }, [location.pathname]);

  // Initial load tracking
  useEffect(() => {
    const utmDataStr = sessionStorage.getItem('linkedup_utm');
    const utmData = utmDataStr ? JSON.parse(utmDataStr) : {};

    analyticsService.trackEvent('page_view', 'initial_load', {
      page_url: location.pathname,
      metadata: { ...utmData }
    });

    // Periodic ping to track active time (every 30 seconds)
    const pingInterval = setInterval(() => {
      const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const lastInput = sessionStorage.getItem('linkedup_last_input');
      analyticsService.trackEvent('page_view', 'ping', {
        page_url: currentPathRef.current,
        time_spent_seconds: timeSpent,
        metadata: { ...utmData, is_ping: true, last_input_touched: lastInput }
      });
    }, 30000);

    const handleFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        let name = e.target.name || e.target.id || (e.target as HTMLInputElement).placeholder;
        if (name) {
          sessionStorage.setItem('linkedup_last_input', name);
        }
      }
    };
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      clearInterval(pingInterval);
      document.removeEventListener('focusin', handleFocusIn);
      const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const lastInput = sessionStorage.getItem('linkedup_last_input');
      analyticsService.trackEvent('page_leave', 'time_spent', {
        page_url: currentPathRef.current,
        time_spent_seconds: timeSpent,
        metadata: { ...utmData, last_input_touched: lastInput }
      });
    };
  }, []);

  return null;
}
