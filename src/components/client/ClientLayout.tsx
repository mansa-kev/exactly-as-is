// @ts-nocheck
import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Car,
  FileText,
  Award,
  Inbox,
  Settings as SettingsIcon,
  Menu,
  X,
  User,
  Search,
} from 'lucide-react';
import { Logo } from '../shared/Logo';
import { LogoLoader } from '../shared/LogoLoader';
import { PortalHeader } from '../PortalHeader';
import { PortalSidebarNav, type PortalNavGroup } from '../shared/PortalSidebarNav';
import { supabase } from '../../lib/supabase';
import { clientService } from '../../services/clientService';

const importDashboard = () => import('./Dashboard');
const importDigitalGlovebox = () => import('./DigitalGlovebox');
const importMyInbox = () => import('./MyInbox');
const importMyBookings = () => import('./MyBookings');
const importMyProfile = () => import('./MyProfile');
const importSettings = () => import('./Settings');
const importLoyaltyRewards = () => import('./LoyaltyRewards');
const importBrowseAndBook = () => import('./BrowseAndBook');

const Dashboard = React.lazy(() => importDashboard().then(m => ({ default: m.Dashboard })));
const DigitalGlovebox = React.lazy(() => importDigitalGlovebox().then(m => ({ default: m.DigitalGlovebox })));
const MyInbox = React.lazy(() => importMyInbox().then(m => ({ default: m.MyInbox })));
const MyBookings = React.lazy(() => importMyBookings().then(m => ({ default: m.MyBookings })));
const MyProfile = React.lazy(() => importMyProfile().then(m => ({ default: m.MyProfile })));
const Settings = React.lazy(() => importSettings().then(m => ({ default: m.Settings })));
const LoyaltyRewards = React.lazy(() => importLoyaltyRewards().then(m => ({ default: m.LoyaltyRewards })));
const BrowseAndBook = React.lazy(() => importBrowseAndBook().then(m => ({ default: m.BrowseAndBook })));

const CLIENT_MODULE_PRELOADERS: Record<string, () => Promise<unknown>> = {
  '/client': importDashboard,
  '/client/browse': importBrowseAndBook,
  '/client/bookings': importMyBookings,
  '/client/profile': importMyProfile,
  '/client/glovebox': importDigitalGlovebox,
  '/client/rewards': importLoyaltyRewards,
  '/client/inbox': importMyInbox,
  '/client/settings': importSettings,
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
    title: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', path: '/client', icon: LayoutDashboard },
      { id: 'browse', label: 'Browse Cars', path: '/client/browse', icon: Search },
      { id: 'bookings', label: 'My Bookings', path: '/client/bookings', icon: Car },
    ],
  },
  {
    title: 'Account',
    items: [
      { id: 'profile', label: 'My Profile', path: '/client/profile', icon: User },
      { id: 'glovebox', label: 'Digital Glovebox', path: '/client/glovebox', icon: FileText, shortLabel: 'Glovebox' },
      { id: 'rewards', label: 'Loyalty & Rewards', path: '/client/rewards', icon: Award, shortLabel: 'Rewards' },
    ],
  },
  {
    title: 'Support',
    items: [
      { id: 'inbox', label: 'My Inbox', path: '/client/inbox', icon: Inbox },
      { id: 'settings', label: 'Settings', path: '/client/settings', icon: SettingsIcon },
    ],
  },
];

export function ClientLayout() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  const setIsDarkMode = (isDark: boolean) => setTheme(isDark ? 'dark' : 'light');

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
    const active = NAV_GROUPS.find(g => g.items.some(i => i.path === location.pathname));
    return active ? [active.title] : ['Main'];
  });

  const [badges, setBadges] = useState<{ bookings: number; inbox: number }>({ bookings: 0, inbox: 0 });

  const sidebarGroups = useMemo(() => NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.map(item => ({
      ...item,
      badge:
        item.path === '/client/bookings' ? badges.bookings :
        item.path === '/client/inbox' ? badges.inbox : undefined,
    })),
  })), [badges]);

  useEffect(() => {
    let cancelled = false;
    let channel: any = null;
    let userId: string | null = null;
    const refresh = async () => {
      if (!userId) return;
      try {
        const c = await clientService.getSidebarCounts(userId);
        if (!cancelled) {
          setBadges({ bookings: c.bookingsActionRequired || 0, inbox: c.unreadInbox || 0 });
        }
      } catch (e) {
        // ignore
      }
    };
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      userId = user.id;
      await refresh();
      channel = supabase
        .channel(`client-badges-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `client_id=eq.${user.id}` }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, refresh)
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

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
    CLIENT_MODULE_PRELOADERS[location.pathname]?.();

    return scheduleIdle(() => {
      ['/client', '/client/browse', '/client/bookings', '/client/glovebox'].forEach((path) => {
        if (path !== location.pathname) {
          CLIENT_MODULE_PRELOADERS[path]?.();
        }
      });
    });
  }, [location.pathname]);

  const prefetch = useCallback((path: string) => {
    CLIENT_MODULE_PRELOADERS[path]?.();
  }, []);

  const sidebarNav = (
    <PortalSidebarNav
      groups={sidebarGroups}
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
        portalType="client"
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
            <Suspense fallback={<LogoLoader />}>
              <Routes>
                <Route index element={<Dashboard />} />
                <Route path="browse" element={<BrowseAndBook />} />
                <Route path="bookings" element={<MyBookings />} />
                <Route path="profile" element={<MyProfile />} />
                <Route path="glovebox" element={<DigitalGlovebox />} />
                <Route path="rewards" element={<LoyaltyRewards />} />
                <Route path="inbox" element={<MyInbox />} />
                <Route path="settings" element={<Settings />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}
