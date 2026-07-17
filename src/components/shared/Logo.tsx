import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  fallbackToDefault?: boolean;
}

import {
  LOGO_STORAGE_KEY,
  LEGACY_LOGO_STORAGE_KEY,
  readCachedLogoUrl,
  writeCachedLogoUrl,
} from '../../utils/catalogImageCache';

const DEFAULT_LOGO = '/favicon.svg';

async function fetchSiteLogoUrl(): Promise<string | null> {
  try {
    const response = await fetch('/api/public-app-settings?keys=site_logo', {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return readCachedLogoUrl();
    const body = await response.json();
    const row = (body?.settings || []).find((s: { key: string }) => s.key === 'site_logo');
    if (!row) return readCachedLogoUrl();
    const url = row.logo_url || row.value || null;
    if (url) writeCachedLogoUrl(url);
    return url;
  } catch {
    return readCachedLogoUrl();
  }
}

function syncFavicon(url: string) {
  const href = url || DEFAULT_LOGO;
  const busted = href.includes('?') ? href : `${href}?v=${Date.now()}`;
  for (const rel of ['icon', 'apple-touch-icon']) {
    let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = busted;
  }
}

// Function to clear logo cache (call this after logo update)
export function clearLogoCache() {
  localStorage.removeItem(LOGO_STORAGE_KEY);
  localStorage.removeItem(LEGACY_LOGO_STORAGE_KEY);
  sessionStorage.removeItem(LOGO_STORAGE_KEY);
}

export function Logo({ size = 'md', showText = true, className, fallbackToDefault = true }: LogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(() => readCachedLogoUrl());
  const [imgFailed, setImgFailed] = useState(false);
  const [loading, setLoading] = useState(() => !readCachedLogoUrl());

  useEffect(() => {
    const cached = readCachedLogoUrl();
    if (cached) syncFavicon(cached);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const remoteUrl = await fetchSiteLogoUrl();
        if (cancelled) return;

        if (remoteUrl) {
          if (readCachedLogoUrl() && readCachedLogoUrl() !== remoteUrl) {
            localStorage.removeItem(LEGACY_LOGO_STORAGE_KEY);
          }
          setLogoUrl(remoteUrl);
          setImgFailed(false);
          writeCachedLogoUrl(remoteUrl);
          syncFavicon(remoteUrl);
        } else {
          const cached = readCachedLogoUrl();
          if (cached) {
            setLogoUrl(cached);
            syncFavicon(cached);
          }
        }
      } catch (err) {
        console.error('Error fetching logo:', err);
        const cached = readCachedLogoUrl();
        if (cached && !cancelled) {
          setLogoUrl(cached);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const sizeClasses = {
    sm: 'h-10 w-auto object-contain object-left',
    md: 'h-14 w-auto object-contain object-left md:h-16',
    lg: 'h-14 w-auto object-contain object-left md:h-16',
    xl: 'h-14 w-auto object-contain object-left md:h-16',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-2xl',
  };

  const displayUrl = !imgFailed && logoUrl ? logoUrl : (fallbackToDefault ? DEFAULT_LOGO : null);
  const showLoading = loading && !displayUrl;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative flex items-center justify-center overflow-hidden">
        {showLoading ? (
          <div className="h-14 w-14 animate-pulse bg-muted rounded-lg" />
        ) : displayUrl ? (
          <img
            src={displayUrl}
            alt="LinkedUp Cars Rentals"
            className={sizeClasses[size]}
            loading="eager"
            fetchPriority="high"
            onError={() => {
              if (logoUrl && displayUrl === logoUrl) {
                clearLogoCache();
                setImgFailed(true);
                syncFavicon(DEFAULT_LOGO);
              }
            }}
          />
        ) : null}
      </div>

      {showText && (
        <span className={cn('font-black tracking-tighter text-primary italic', textSizes[size])}>
          LINKEDUP
        </span>
      )}
    </div>
  );
}
