import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSubdomain, type Subdomain } from '../contexts/SubdomainContext';
import { logger } from '../utils/logger';
import { supabase } from '../lib/supabase';

const sites: { id: Subdomain; label: string; color: string; path: string }[] = [
  { id: 'www', label: 'Public Site', color: 'bg-orange-500', path: '/' },
  { id: 'app', label: 'App Portal', color: 'bg-blue-500', path: '/client' },
  { id: 'app', label: 'Driver Portal', color: 'bg-purple-500', path: '/driver' },
  { id: 'fleet', label: 'Fleet Portal', color: 'bg-green-500', path: '/fleet' },
  { id: 'admin', label: 'Admin Command', color: 'bg-red-500', path: '/admin' },
];

export function SubdomainSwitcher() {
  const { subdomain, setPreviewSubdomain } = useSubdomain();
  const navigate = useNavigate();
  const location = useLocation();

  // Always show in development/preview environments
  const host = window.location.hostname;
  const isDev =
    host.includes('run.app') ||
    host === 'localhost' ||
    host.includes('127.0.0.1') ||
    host.includes('lovable.app') ||
    host.includes('lovable.dev') ||
    host.includes('lovableproject.com') ||
    host.includes('google.com');

  if (!isDev) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2">
      <div className="flex gap-2 p-2 bg-black/90 backdrop-blur-xl rounded-full border border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        {sites.map((site) => {
          const isActive = subdomain === site.id && (
            site.path === '/' 
              ? location.pathname === '/' 
              : location.pathname.startsWith(site.path)
          );

          return (
            <button
              key={site.label}
              onClick={async () => {
                logger.log('Switching to:', site.id);

                // Logout when switching to a different protected portal
                // This allows testing different roles without redirect loops
                if (site.id !== 'www' && site.id !== subdomain) {
                  await supabase.auth.signOut();
                }

                setPreviewSubdomain(site.id);
                navigate(site.path);
              }}
              className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                isActive
                  ? `${site.color} text-white scale-110 shadow-[0_0_20px_rgba(255,77,0,0.4)]`
                  : 'text-gray-500 hover:text-white hover:bg-white/10'
              }`}
            >
              {site.label}
            </button>
          );
        })}
      </div>
      <p className="text-[8px] font-bold text-white/30 uppercase tracking-[0.2em]">
        Environment: {subdomain}
      </p>
    </div>
  );
}
