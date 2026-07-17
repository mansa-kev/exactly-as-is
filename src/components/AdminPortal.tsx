// @ts-nocheck
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAdminTheme } from '../contexts/AdminThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Calendar,
  Car,
  Users,
  UserCheck,
  Building2,
  ShieldCheck,
  Wallet,
  TrendingUp,
  Tag,
  BarChart3,
  Inbox,
  Rocket,
  AlertTriangle,
  Settings,
  Image,
  FileText,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  Truck,
  Clock,
  CreditCard,
  Loader2,
  Star,
  PenLine,
  DollarSign
} from 'lucide-react';

import { PortalHeader } from './PortalHeader';
import { Logo } from './shared/Logo';
import { LogoLoader } from './shared/LogoLoader';

const importAdminDashboard = () => import('./admin/AdminDashboard');
const importAdminBookings = () => import('./admin/AdminBookings');
const importAdminBookingCommandCenter = () => import('./admin/AdminBookingCommandCenter');
const importAdminCars = () => import('./admin/AdminCars');
const importAdminVehicleModels = () => import('./admin/AdminVehicleModels');
const importAdminUsers = () => import('./admin/AdminUsers');
const importAdminDrivers = () => import('./admin/AdminDrivers');
const importAdminFleetOwners = () => import('./admin/AdminFleetOwners');
const importAdminVerification = () => import('./admin/AdminVerification');
const importAdminFinancials = () => import('./admin/AdminFinancials');
const importAdminTaxes = () => import('./admin/AdminTaxes');
const importAdminExpenses = () => import('./admin/AdminExpenses');
const importAdminCarEarnings = () => import('./admin/AdminCarEarnings');
const importAdminPricing = () => import('./admin/AdminPricing');
const importAdminReports = () => import('./admin/AdminReports');
const importAdminInbox = () => import('./admin/AdminInbox');
const importAdminReviews = () => import('./admin/AdminReviews');
const importAdminGrowthTools = () => import('./admin/AdminGrowthTools');
const importAdminIncidentCommand = () => import('./admin/AdminIncidentCommand');
const importAdminHeroContent = () => import('./admin/AdminHeroContent');
const importAdminContractManager = () => import('./admin/AdminContractManager');
const importAdminSystemHealth = () => import('./admin/AdminSystemHealth');
const importAdminSettings = () => import('./admin/AdminSettings');
const importAdminLogout = () => import('./admin/AdminLogout');
const importAdminAnalyticsCenter = () => import('./admin/AdminAnalyticsCenter');
const importAdminOutsourcedCars = () => import('./admin/AdminOutsourcedCars');
const importAdminPromotions = () => import('./admin/AdminPromotions');
const importAdminReservations = () => import('./admin/AdminReservations');
const importAdminReservationConcierge = () => import('./admin/AdminReservationConcierge');
const importAdminBlog = () => import('./admin/AdminBlog');
const importAdminConciergeBooking = () => import('./admin/AdminConciergeBooking');

const AdminDashboard = React.lazy(() => importAdminDashboard().then(m => ({ default: m.AdminDashboard })));
const AdminBookings = React.lazy(() => importAdminBookings().then(m => ({ default: m.AdminBookings })));
const AdminBookingCommandCenter = React.lazy(() => importAdminBookingCommandCenter().then(m => ({ default: m.AdminBookingCommandCenter })));
const AdminCars = React.lazy(() => importAdminCars().then(m => ({ default: m.AdminCars })));
const AdminVehicleModels = React.lazy(() => importAdminVehicleModels().then(m => ({ default: m.AdminVehicleModels })));
const AdminUsers = React.lazy(() => importAdminUsers().then(m => ({ default: m.AdminUsers })));
const AdminDrivers = React.lazy(() => importAdminDrivers().then(m => ({ default: m.AdminDrivers })));
const AdminFleetOwners = React.lazy(() => importAdminFleetOwners().then(m => ({ default: m.AdminFleetOwners })));
const AdminVerification = React.lazy(() => importAdminVerification().then(m => ({ default: m.AdminVerification })));
const AdminFinancials = React.lazy(() => importAdminFinancials().then(m => ({ default: m.AdminFinancials })));
const AdminTaxes = React.lazy(() => importAdminTaxes().then(m => ({ default: m.AdminTaxes })));
const AdminExpenses = React.lazy(() => importAdminExpenses().then(m => ({ default: m.AdminExpenses })));
const AdminCarEarnings = React.lazy(() => importAdminCarEarnings().then(m => ({ default: m.AdminCarEarnings })));
const AdminPricing = React.lazy(() => importAdminPricing().then(m => ({ default: m.AdminPricing })));
const AdminReports = React.lazy(() => importAdminReports().then(m => ({ default: m.AdminReports })));
const AdminInbox = React.lazy(() => importAdminInbox().then(m => ({ default: m.AdminInbox })));
const AdminReviews = React.lazy(() => importAdminReviews().then(m => ({ default: m.AdminReviews })));
const AdminGrowthTools = React.lazy(() => importAdminGrowthTools().then(m => ({ default: m.AdminGrowthTools })));
const AdminIncidentCommand = React.lazy(() => importAdminIncidentCommand().then(m => ({ default: m.AdminIncidentCommand })));
const AdminHeroContent = React.lazy(() => importAdminHeroContent().then(m => ({ default: m.AdminHeroContent })));
const AdminContractManager = React.lazy(() => importAdminContractManager().then(m => ({ default: m.AdminContractManager })));
const AdminSystemHealth = React.lazy(() => importAdminSystemHealth().then(m => ({ default: m.AdminSystemHealth })));
const AdminSettings = React.lazy(() => importAdminSettings().then(m => ({ default: m.AdminSettings })));
const AdminLogout = React.lazy(() => importAdminLogout().then(m => ({ default: m.AdminLogout })));
const AdminAnalyticsCenter = React.lazy(() => importAdminAnalyticsCenter().then(m => ({ default: m.AdminAnalyticsCenter })));
const AdminOutsourcedCars = React.lazy(() => importAdminOutsourcedCars().then(m => ({ default: m.AdminOutsourcedCars })));
const AdminPromotions = React.lazy(() => importAdminPromotions().then(m => ({ default: m.AdminPromotions })));
const AdminReservations = React.lazy(() => importAdminReservations().then(m => ({ default: m.AdminReservations })));
const AdminReservationConcierge = React.lazy(() => importAdminReservationConcierge().then(m => ({ default: m.AdminReservationConcierge })));
const AdminBlog = React.lazy(() => importAdminBlog().then(m => ({ default: m.AdminBlog })));
const AdminConciergeBooking = React.lazy(() => importAdminConciergeBooking().then(m => ({ default: m.AdminConciergeBooking })));

const ADMIN_MODULE_PRELOADERS: Record<string, () => Promise<unknown>> = {
  dashboard: importAdminDashboard,
  bookings: importAdminBookings,
  'bookings-detail': importAdminBookingCommandCenter,
  'concierge-booking': importAdminConciergeBooking,
  reservations: importAdminReservations,
  'reservation-concierge': importAdminReservationConcierge,
  cars: importAdminCars,
  'vehicle-models': importAdminVehicleModels,
  outsourced: importAdminOutsourcedCars,
  users: importAdminUsers,
  drivers: importAdminDrivers,
  'fleet-owners': importAdminFleetOwners,
  verification: importAdminVerification,
  financials: importAdminFinancials,
  taxes: importAdminTaxes,
  expenses: importAdminExpenses,
  'car-earnings': importAdminCarEarnings,
  pricing: importAdminPromotions,
  reports: importAdminReports,
  inbox: importAdminInbox,
  reviews: importAdminReviews,
  blog: importAdminBlog,
  growth: importAdminGrowthTools,
  incident: importAdminIncidentCommand,
  hero: importAdminHeroContent,
  contracts: importAdminContractManager,
  'system-health': importAdminSystemHealth,
  settings: importAdminSettings,
  logout: importAdminLogout,
  analytics: importAdminAnalyticsCenter,
};

type ModuleCategory = {
  title: string;
  items: {
    id: string;
    label: string;
    icon: React.ElementType;
  }[];
};

const MODULE_CATEGORIES: ModuleCategory[] = [
  {
    title: 'Dashboard',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ]
  },
  {
    title: 'Core Operations',
    items: [
      { id: 'bookings', label: 'Bookings Management', icon: Calendar },
      { id: 'reservations', label: 'Reservations', icon: Clock },
      { id: 'vehicle-models', label: 'Vehicle Models', icon: Image },
      { id: 'cars', label: 'Cars Management', icon: Car },
      { id: 'outsourced', label: 'Outsourced Cars', icon: Truck },
      { id: 'users', label: 'Users Management', icon: Users },
      { id: 'drivers', label: 'Drivers Management', icon: UserCheck },
    ]
  },
  {
    title: 'Partner Management',
    items: [
      { id: 'fleet-owners', label: 'Fleet Owners', icon: Building2 },
      { id: 'verification', label: 'Verification Queue', icon: ShieldCheck },
    ]
  },
  {
    title: 'Financials & Reporting',
    items: [
      { id: 'financials', label: 'Financials', icon: Wallet },
      { id: 'taxes', label: 'Tax Compliance', icon: FileText },
      { id: 'expenses', label: 'Expense Ledger', icon: DollarSign },
      { id: 'car-earnings', label: 'Car Earnings', icon: TrendingUp },
      { id: 'pricing', label: 'Pricing & Promotions', icon: Tag },
      { id: 'reports', label: 'Reports', icon: BarChart3 },
      { id: 'analytics', label: 'Analytics & Traffic', icon: TrendingUp },
    ]
  },
  {
    title: 'Communication & Growth',
    items: [
      { id: 'inbox', label: 'Inbox', icon: Inbox },
      { id: 'reviews', label: 'Reviews', icon: Star },
      { id: 'blog', label: 'Blog & Insights', icon: PenLine },
      { id: 'growth', label: 'Growth Tools', icon: Rocket },
      { id: 'incident', label: 'Incident Command', icon: AlertTriangle },
    ]
  },
  {
    title: 'System Configuration',
    items: [
      { id: 'hero', label: 'Hero Content', icon: Image },
      { id: 'contracts', label: 'Contracts', icon: FileText },
      { id: 'settings', label: 'Settings', icon: Settings },
    ]
  }
];

export function AdminPortal() {
  const location = useLocation();
  const { theme, setTheme } = useAdminTheme();
  const isDarkMode = theme === 'dark';
  const setIsDarkMode = (isDark: boolean) => setTheme(isDark ? 'dark' : 'light');

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
    const activeModule = location.pathname.split('/')[2] || 'dashboard';
    const active = MODULE_CATEGORIES.find(g => g.items.some(i => i.id === activeModule));
    return active ? [active.title] : ['Dashboard'];
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

  const toggleGroup = useCallback((category: string) => {
    setExpandedGroups(prev => 
      prev.includes(category) 
        ? prev.filter(g => g !== category)
        : [...prev, category]
    );
  }, []);

  const activeModule = location.pathname.split('/')[2] || 'dashboard';

  useEffect(() => {
    ADMIN_MODULE_PRELOADERS[activeModule]?.();
  }, [activeModule]);

  const sidebarContent = (
    <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide">
      {MODULE_CATEGORIES.map((category) => {
        const isExpanded = expandedGroups.includes(category.title);
        const hasActive = category.items.some(i => i.id === activeModule);

        return (
          <div key={category.title} className="mb-1">
            <button
              onClick={() => toggleGroup(category.title)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                hasActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{category.title}</span>
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-3 space-y-1">
                    {category.items.map((item) => {
                      const isActive = activeModule === item.id;
                      return (
                        <Link
                          key={item.id}
                          to={item.id === 'dashboard' ? '/admin' : `/admin/${item.id}`}
                          onMouseEnter={() => ADMIN_MODULE_PRELOADERS[item.id]?.()}
                          onFocus={() => ADMIN_MODULE_PRELOADERS[item.id]?.()}
                          onTouchStart={() => ADMIN_MODULE_PRELOADERS[item.id]?.()}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative group ${
                            isActive
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                          )}
                          <item.icon size={18} className={isActive ? 'text-primary' : ''} />
                          <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className={`${theme} min-h-screen bg-background flex flex-col text-foreground transition-colors duration-300`}>
      {/* Top Header */}
      <PortalHeader
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        portalType="admin"
        leftContent={
          <div className="flex items-center gap-2 md:gap-4">
            <button
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

      {/* Main Layout Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar */}
        <aside className={`hidden md:flex bg-card border-r border-border flex-col flex-shrink-0 h-full transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-0 overflow-hidden opacity-0'
        }`}>
          {sidebarContent}
        </aside>

      {/* Mobile Sidebar Overlay */}
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
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 hover:bg-muted rounded-lg text-muted-foreground"
                >
                  <X size={20} />
                </button>
              </div>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-muted/20">
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-[1600px] mx-auto">
            <Suspense fallback={<LogoLoader />}>
              <Routes>
                <Route index element={<AdminDashboard />} />
                <Route path="bookings" element={<AdminBookings />} />
                <Route path="bookings/:id" element={<AdminBookingCommandCenter />} />
                <Route path="concierge-booking" element={<AdminConciergeBooking />} />
                <Route path="reservations" element={<AdminReservations />} />
                <Route path="reservation-concierge" element={<AdminReservationConcierge />} />
                <Route path="vehicle-models" element={<AdminVehicleModels />} />
                <Route path="cars" element={<AdminCars />} />
                <Route path="outsourced" element={<AdminOutsourcedCars />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="drivers" element={<AdminDrivers />} />
                <Route path="fleet-owners" element={<AdminFleetOwners />} />
                <Route path="verification" element={<AdminVerification />} />
                <Route path="financials" element={<AdminFinancials />} />
                <Route path="taxes" element={<AdminTaxes />} />
                <Route path="expenses" element={<AdminExpenses />} />
                <Route path="car-earnings" element={<AdminCarEarnings />} />
                <Route path="pricing" element={<AdminPromotions />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="inbox" element={<AdminInbox />} />
                <Route path="reviews" element={<AdminReviews />} />
                <Route path="blog" element={<AdminBlog />} />
                <Route path="growth" element={<AdminGrowthTools />} />
                <Route path="incident" element={<AdminIncidentCommand />} />
                <Route path="hero" element={<AdminHeroContent />} />
                <Route path="contracts" element={<AdminContractManager />} />
                <Route path="system-health" element={<AdminSystemHealth />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="logout" element={<AdminLogout />} />
                <Route path="analytics" element={<AdminAnalyticsCenter />} />
                <Route path=":activeModule" element={<AdminModuleFallback />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
      </div>
    </div>
  );
}

function AdminModuleFallback() {
  const location = useLocation();
  const activeModule = location.pathname.split('/')[2] || 'dashboard';
  const activeModuleLabel = MODULE_CATEGORIES
    .flatMap(c => c.items)
    .find(i => i.id === activeModule)?.label || 'Module';

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6">
        {React.createElement(MODULE_CATEGORIES.flatMap(c => c.items).find(i => i.id === activeModule)?.icon || LayoutDashboard, { size: 40 })}
      </div>
      <h1 className="text-3xl font-bold mb-2">{activeModuleLabel}</h1>
      <p className="text-muted-foreground max-w-md">
        This module is ready to be connected to Supabase.
      </p>
    </div>
  );
}