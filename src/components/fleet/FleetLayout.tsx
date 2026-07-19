// @ts-nocheck
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Car,
  Wrench,
  AlertTriangle,
  DollarSign,
  Receipt,
  Inbox,
  CalendarCheck,
  FileText,
  TrendingUp,
  Settings as SettingsIcon,
  Menu,
  X,
  Loader2,
  PenTool,
} from 'lucide-react';
import { Logo } from '../shared/Logo';
import { PortalHeader } from '../PortalHeader';
import { PortalSidebarNav, type PortalNavGroup } from '../shared/PortalSidebarNav';

const importFleetDashboard = () => import('./FleetDashboard');
const importMyCars = () => import('./MyCars');
const importMyInbox = () => import('./MyInbox');
const importExpenseTracker = () => import('./ExpenseTracker');
const importBookingRequests = () => import('./BookingRequests');
const importDigitalVault = () => import('./DigitalVault');
const importGrowthAndInsights = () => import('./GrowthAndInsights');
const importMaintenanceLogs = () => import('./MaintenanceLogs');
const importDamageReports = () => import('./DamageReports');
const importFinancialCenter = () => import('./FinancialCenter');
const importFleetSettings = () => import('./FleetSettings');
const importFleetConciergeBooking = () => import('./FleetConciergeBooking');
const importFleetReports = () => import('./FleetReports');

const FleetDashboard = React.lazy(() => importFleetDashboard().then(m => ({ default: m.FleetDashboard })));
const MyCars = React.lazy(() => importMyCars().then(m => ({ default: m.MyCars })));
const MyInbox = React.lazy(() => importMyInbox().then(m => ({ default: m.MyInbox })));
const ExpenseTracker = React.lazy(() => importExpenseTracker().then(m => ({ default: m.ExpenseTracker })));
const BookingRequests = React.lazy(() => importBookingRequests().then(m => ({ default: m.BookingRequests })));
const DigitalVault = React.lazy(() => importDigitalVault().then(m => ({ default: m.DigitalVault })));
const GrowthAndInsights = React.lazy(() => importGrowthAndInsights().then(m => ({ default: m.GrowthAndInsights })));
const MaintenanceLogs = React.lazy(() => importMaintenanceLogs().then(m => ({ default: m.default })));
const DamageReports = React.lazy(() => importDamageReports().then(m => ({ default: m.default })));
const FinancialCenter = React.lazy(() => importFinancialCenter().then(m => ({ default: m.FinancialCenter })));
const FleetSettings = React.lazy(() => importFleetSettings().then(m => ({ default: m.FleetSettings })));
const FleetConciergeBooking = React.lazy(() => importFleetConciergeBooking().then(m => ({ default: m.FleetConciergeBooking })));
const FleetReports = React.lazy(() => importFleetReports().then(m => ({ default: m.FleetReports })));

const FLEET_MODULE_PRELOADERS: Record<string, () => Promise<unknown>> = {
  '/fleet': importFleetDashboard,
  '/fleet/cars': importMyCars,
  '/fleet/maintenance': importMaintenanceLogs,
  '/fleet/damage': importDamageReports,
  '/fleet/financials': importFinancialCenter,
  '/fleet/expenses': importExpenseTracker,
  '/fleet/inbox': importMyInbox,
  '/fleet/booking-requests': importBookingRequests,
  '/fleet/concierge-booking': importFleetConciergeBooking,
  '/fleet/vault': importDigitalVault,
  '/fleet/growth': importGrowthAndInsights,
  '/fleet/settings': importFleetSettings,
  '/fleet/reports': importFleetReports,
};



const scheduleIdle = (cb: () => void) => {
  if (typeof window === 'undefined') return () => {};
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(cb, { timeout: 1200 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(cb, 250);
  return () => window.clearTimeout(id);
};

const NAV_GROUPS: PortalNavGroup[] = [
  {
    title: 'Strategic Dashboard',
    items: [
      { id: 'dashboard', label: 'Dashboard', path: '/fleet', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Fleet Management',
    items: [
      { id: 'cars', label: 'My Cars', path: '/fleet/cars', icon: Car },
      { id: 'maintenance', label: 'Maintenance Logs', path: '/fleet/maintenance', icon: Wrench, shortLabel: 'Maintenance' },
      { id: 'damage', label: 'Damage Reports', path: '/fleet/damage', icon: AlertTriangle, shortLabel: 'Damage' },
    ],
  },
  {
    title: 'Financials',
    items: [
      { id: 'financials', label: 'Earnings & Payouts', path: '/fleet/financials', icon: DollarSign, shortLabel: 'Earnings' },
      { id: 'expenses', label: 'Expense Tracker', path: '/fleet/expenses', icon: Receipt, shortLabel: 'Expenses' },
    ],
  },
  {
    title: 'Operations & Communication',
    items: [
      { id: 'concierge', label: 'Field Booking', path: '/fleet/concierge-booking', icon: PenTool },
      { id: 'inbox', label: 'My Inbox', path: '/fleet/inbox', icon: Inbox },
      { id: 'booking-requests', label: 'Booking Requests', path: '/fleet/booking-requests', icon: CalendarCheck, shortLabel: 'Requests' },
      { id: 'vault', label: 'Digital Vault', path: '/fleet/vault', icon: FileText, shortLabel: 'Vault' },
    ],
  },
  {
    title: 'Growth & Optimization',
    items: [
      { id: 'growth', label: 'Growth & Insights', path: '/fleet/growth', icon: TrendingUp, shortLabel: 'Insights' },
    ],
  },
  {
    title: 'Account Settings',
    items: [
      { id: 'settings', label: 'Settings', path: '/fleet/settings', icon: SettingsIcon },
    ],
  },
];

export function FleetLayout() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  const setIsDarkMode = (isDark: boolean) => setTheme(isDark ? 'dark' : 'light');

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
    const active = NAV_GROUPS.find(g => g.items.some(i => i.path === location.pathname));
    return active ? [active.title] : ['Strategic Dashboard'];
  });

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  const toggleGroup = useCallback((title: string) => {
    setExpandedGroups(prev =>
      prev.includes(title) ? prev.filter(g => g !== title) : [...prev, title]
    );
  }, []);

  useEffect(() => {
    FLEET_MODULE_PRELOADERS[location.pathname]?.();

    return scheduleIdle(() => {
      ['/fleet', '/fleet/cars', '/fleet/financials', '/fleet/booking-requests', '/fleet/inbox'].forEach((path) => {
        if (path !== location.pathname) {
          FLEET_MODULE_PRELOADERS[path]?.();
        }
      });
    });
  }, [location.pathname]);

  const prefetch = useCallback((path: string) => {
    FLEET_MODULE_PRELOADERS[path]?.();
  }, []);

  const sidebarNav = (
    <PortalSidebarNav
      groups={NAV_GROUPS}
      activePath={location.pathname}
      expandedGroups={expandedGroups}
      onToggleGroup={toggleGroup}
      onPrefetch={prefetch}
      onNavigate={() => { if (isMobile) setSidebarOpen(false); }}
    />
  );

  return (
    <div className={`${theme} min-h-screen bg-background flex flex-col text-foreground transition-colors duration-300`}>
      <PortalHeader
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        portalType="fleet"
        leftContent={
          <div className="flex items-center gap-2 md:gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu size={20} />
            </button>
            <Logo size="lg" showText={!isMobile} />
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden relative">
        <aside className={`hidden md:flex bg-card border-r border-border flex-col flex-shrink-0 h-full transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-0 overflow-hidden opacity-0'
        }`}>
          {sidebarNav}
        </aside>

        <AnimatePresence>
          {isMobile && sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/60 z-40"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed left-0 top-0 h-full w-72 bg-card border-r border-border z-50 flex flex-col shadow-2xl"
              >
                <div className="p-6 flex items-center justify-between">
                  <Logo size="xl" showText={false} />
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="p-2 hover:bg-muted rounded-lg text-muted-foreground"
                  >
                    <X size={20} />
                  </button>
                </div>
                {sidebarNav}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-muted/20">
          <main className="flex-1 p-4 md:p-8">
            <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary" size={32} /></div>}>
              <Routes>
                <Route index element={<FleetDashboard />} />
                <Route path="cars" element={<MyCars />} />
                <Route path="maintenance" element={<MaintenanceLogs />} />
                <Route path="damage" element={<DamageReports />} />
                <Route path="financials" element={<FinancialCenter />} />
                <Route path="expenses" element={<ExpenseTracker />} />
                <Route path="inbox" element={<MyInbox />} />
                <Route path="booking-requests" element={<BookingRequests />} />
                <Route path="concierge-booking" element={<FleetConciergeBooking />} />
                <Route path="vault" element={<DigitalVault />} />
                <Route path="growth" element={<GrowthAndInsights />} />
                <Route path="settings" element={<FleetSettings />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}
