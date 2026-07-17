import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { logger } from '../utils/logger';

export type Subdomain = 'www' | 'app' | 'admin' | 'fleet' | 'drivers';

interface SubdomainContextType {
  subdomain: Subdomain;
  setPreviewSubdomain: (newSubdomain: Subdomain) => void;
}

const SubdomainContext = createContext<SubdomainContextType | undefined>(undefined);

export function SubdomainProvider({ children }: { children: ReactNode }) {
  const [subdomain, setSubdomain] = useState<Subdomain>('www');

  const detectSubdomain = () => {
    const hostname = window.location.hostname;
    
    // SECURITY: Removed query parameter override to prevent unauthorized access
    // Admin access now requires proper authentication
    
    // Check actual subdomain (for production)
    if (hostname.startsWith('admin.')) {
      logger.log('[SubdomainContext] Detected via hostname: admin');
      setSubdomain('admin');
    } else if (hostname.startsWith('app.')) {
      logger.log('[SubdomainContext] Detected via hostname: app');
      setSubdomain('app');
    } else if (hostname.startsWith('fleet.')) {
      logger.log('[SubdomainContext] Detected via hostname: fleet');
      setSubdomain('fleet');
    } else if (hostname.startsWith('drivers.')) {
      logger.log('[SubdomainContext] Detected via hostname: drivers');
      setSubdomain('drivers');
    } else {
      logger.log('[SubdomainContext] Detected via hostname: default (www)');
      setSubdomain('www');
    }
  };

  useEffect(() => {
    detectSubdomain();
    
    // Listen for popstate (back/forward buttons)
    window.addEventListener('popstate', detectSubdomain);
    return () => window.removeEventListener('popstate', detectSubdomain);
  }, []);

  const setPreviewSubdomain = (newSubdomain: Subdomain) => {
    logger.log('[SubdomainContext] Manually switching to:', newSubdomain);
    // SECURITY: Removed URL parameter manipulation to prevent unauthorized access
    // This function now only updates the internal state for development
    setSubdomain(newSubdomain);
  };

  return (
    <SubdomainContext.Provider value={{ subdomain, setPreviewSubdomain }}>
      {children}
    </SubdomainContext.Provider>
  );
}

export function useSubdomain() {
  const context = useContext(SubdomainContext);
  if (context === undefined) {
    throw new Error('useSubdomain must be used within a SubdomainProvider');
  }
  return context;
}
