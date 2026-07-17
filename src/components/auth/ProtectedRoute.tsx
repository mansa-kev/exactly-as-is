import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, resolveAuthRole } from '../../contexts/AuthContext';
import { useSubdomain, Subdomain } from '../../contexts/SubdomainContext';
import { LogoLoader } from '../shared/LogoLoader';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'fleet_owner' | 'client' | 'driver';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, profile, loading, profileLoading } = useAuth();
  const { setPreviewSubdomain } = useSubdomain();
  const location = useLocation();

  if (loading || (user && profileLoading)) {
    return <LogoLoader fullScreen message="Loading your portal..." />;
  }

  if (!user) {
    const isDriversSubdomain = window.location.hostname.startsWith('drivers.');
    const loginPath = (requiredRole === 'driver' && !isDriversSubdomain) ? '/driver/login' : '/login';
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (requiredRole) {
    const userRole = resolveAuthRole(user, profile);

    if (!userRole) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground max-w-md">
            Your account is signed in but your profile is still being set up. Please try refreshing the page.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold"
          >
            Refresh
          </button>
        </div>
      );
    }

    if (userRole !== requiredRole) {
      const targetSubdomain: Subdomain = userRole === 'admin' ? 'admin' :
                          userRole === 'fleet_owner' ? 'fleet' :
                          userRole === 'driver' ? 'drivers' :
                          'app';
      const redirectPath = userRole === 'admin' ? '/admin' :
                          userRole === 'fleet_owner' ? '/fleet' :
                          userRole === 'driver' ? '/' :
                          '/client';

      setPreviewSubdomain(targetSubdomain);
      return <Navigate to={redirectPath} replace />;
    }
  }

  return <>{children}</>;
}
