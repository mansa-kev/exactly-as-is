// @ts-nocheck
import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { AnalyticsTracker } from './components/shared/AnalyticsTracker';
import { ScrollToTop } from './components/shared/ScrollToTop';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'sonner';
import { ThemeProvider } from './contexts/ThemeContext';
import { PublicThemeProvider } from './contexts/PublicThemeContext';
import { AdminThemeProvider } from './contexts/AdminThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { useSubdomain } from './contexts/SubdomainContext';
import { SubdomainSwitcher } from './components/SubdomainSwitcher';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './components/auth/Login';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { DriverOnboardingForm } from './components/public/DriverOnboardingForm';
import { PublicHome } from './components/public/PublicHome';
import { AboutUs } from './components/public/AboutUs';
import { Contact } from './components/public/Contact';
import { BrowseCars } from './components/public/BrowseCars';
import { CarDetails } from './components/public/CarDetails';
import { VehicleModelDetails } from './components/public/VehicleModelDetails';
import { BookingConfirmation } from './components/public/BookingConfirmation';
import { HowItWorks } from './components/public/HowItWorks';
import { FAQ } from './components/public/FAQ';
import { InsightsHome } from './components/public/InsightsHome';
import { InsightsDetail } from './components/public/InsightsDetail';
import { Terms } from './components/public/Terms';
import { Privacy } from './components/public/Privacy';
import { SunsetRays } from './components/SunsetRays';
import { Analytics } from '@vercel/analytics/react';
import { LogoLoader } from './components/shared/LogoLoader';

// Lazy load layout components
const AdminPortal = React.lazy(() => import('./components/AdminPortal').then(m => ({ default: m.AdminPortal })));
const FleetLayout = React.lazy(() => import('./components/fleet/FleetLayout').then(m => ({ default: m.FleetLayout })));
const ClientLayout = React.lazy(() => import('./components/client/ClientLayout').then(m => ({ default: m.ClientLayout })));
const PublicLayout = React.lazy(() => import('./components/public/PublicLayout').then(m => ({ default: m.PublicLayout })));
const DriverPortal = React.lazy(() => import('./components/driver/DriverPortal').then(m => ({ default: m.DriverPortal })));


function OldModelRedirect() {
  const { id } = useParams();
  const location = useLocation();
  return <Navigate to={`/vehicles/${id}${location.search}`} replace />;
}

export default function App() {
  const { subdomain } = useSubdomain();

  return (
    <HelmetProvider>
    <ErrorBoundary>
      <BrowserRouter>
        <ScrollToTop />
          <AnalyticsTracker />
        <ThemeProvider>
          <AuthProvider>
            <div className="relative min-h-screen">
              <Toaster position="top-right" richColors />
              <SunsetRays />
              
              {subdomain === 'www' && (
              <PublicThemeProvider>
                <Suspense fallback={<LogoLoader fullScreen message="Loading..." />}>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/*" element={
                      <PublicLayout>
                        <Routes>
                          <Route path="/" element={<PublicHome />} />
                          <Route path="/about" element={<AboutUs />} />
                          <Route path="/contact" element={<Contact />} />
                          <Route path="/cars" element={<BrowseCars />} />
                          <Route path="/cars/:id" element={<CarDetails />} />

                          <Route path="/vehicles/:slug" element={<VehicleModelDetails />} />
                          <Route path="/models/:id" element={<OldModelRedirect />} />
                          <Route path="/booking-confirmation/:bookingId" element={<BookingConfirmation />} />
                          <Route path="/how-it-works" element={<HowItWorks />} />
                          <Route path="/faq" element={<FAQ />} />
                          <Route path="/insights" element={<InsightsHome />} />
                          <Route path="/insights/:slug" element={<InsightsDetail />} />
                          <Route path="/terms" element={<Terms />} />
                          <Route path="/privacy" element={<Privacy />} />
                          <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                      </PublicLayout>
                    } />
                  </Routes>
                </Suspense>
              </PublicThemeProvider>
            )}
          
          {subdomain === 'onboarding' && (
            <Routes>
              <Route path="/" element={<DriverOnboardingForm />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
          
          {subdomain === 'app' && (
            <div className="min-h-screen bg-background">
              <Suspense fallback={<LogoLoader fullScreen message="Loading your portal..." />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/driver/login" element={<Login />} />
                  <Route path="/client/*" element={
                    <ProtectedRoute requiredRole="client">
                      <ClientLayout />
                    </ProtectedRoute>
                  } />
                  <Route path="*" element={<Navigate to="/client" replace />} />
                </Routes>
              </Suspense>
            </div>
          )}

          {subdomain === 'admin' && (
            <AdminThemeProvider>
              <div className="min-h-screen bg-background">
                <Suspense fallback={<LogoLoader fullScreen message="Loading admin portal..." />}>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/admin/*" element={
                      <ProtectedRoute requiredRole="admin">
                        <AdminPortal />
                      </ProtectedRoute>
                    } />
                    <Route path="*" element={<Navigate to="/admin" replace />} />
                  </Routes>
                </Suspense>
              </div>
            </AdminThemeProvider>
          )}

          {subdomain === 'fleet' && (
            <div className="min-h-screen bg-background">
              <Suspense fallback={<LogoLoader fullScreen message="Loading fleet portal..." />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/fleet/*" element={
                    <ProtectedRoute requiredRole="fleet_owner">
                      <FleetLayout />
                    </ProtectedRoute>
                  } />
                  <Route path="*" element={<Navigate to="/fleet" replace />} />
                </Routes>
              </Suspense>
            </div>
          )}

          {subdomain === 'drivers' && (
            <div className="min-h-screen bg-background">
              <Suspense fallback={<LogoLoader fullScreen message="Loading driver portal..." />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/*" element={
                    <ProtectedRoute requiredRole="driver">
                      <DriverPortal />
                    </ProtectedRoute>
                  } />
                </Routes>
              </Suspense>
            </div>
          )}
          
          {/* Dev Switcher for previewing subdomains */}
          <SubdomainSwitcher />
        </div>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
    <Analytics />
    </ErrorBoundary>
    </HelmetProvider>
  );
}