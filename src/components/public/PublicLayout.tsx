import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Search,
  Calendar,
  User,
  Menu,
  X,
  Phone,
  Info,
  HelpCircle,
  FileText,
  Shield,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from '../shared/Logo';
import { FloatingSupportWidget } from './FloatingSupportWidget';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const mainNav: NavItem[] = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Browse', path: '/cars', icon: Search },
];

const secondaryNav: NavItem[] = [
  { label: 'About Us', path: '/about', icon: Info },
  { label: 'How It Works', path: '/how-it-works', icon: HelpCircle },
  { label: 'Insights', path: '/insights', icon: BookOpen },
  { label: 'Contact', path: '/contact', icon: Phone },
  { label: 'FAQ', path: '/faq', icon: HelpCircle },
  { label: 'Terms', path: '/terms', icon: FileText },
  { label: 'Privacy', path: '/privacy', icon: Shield },
];

function getLoginUrl(): string {
  const hostname = window.location.hostname;
  const isDev = hostname.includes('run.app') || hostname === 'localhost' || hostname.includes('google.com');
  if (isDev) return '/login';
  return (import.meta.env.VITE_APP_URL || 'https://app.linkedupcarsrentals.com') + '/login';
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const loginUrl = getLoginUrl();
  const isExternalLogin = loginUrl.startsWith('http');

  const LoginButton = ({ className, children: btnChildren }: { className: string; children: React.ReactNode }) => {
    if (isExternalLogin) {
      return <a href={loginUrl} className={className}>{btnChildren}</a>;
    }
    return <Link to={loginUrl} className={className}>{btnChildren}</Link>;
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Desktop Header */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 min-h-20 glass z-50 items-center justify-between px-8">
        <Link to="/" className="flex items-center">
          <Logo size="lg" showText={false} />
        </Link>

        <nav className="flex items-center gap-8">
          {mainNav.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`text-sm font-bold uppercase tracking-widest transition-colors ${
                location.pathname === item.path ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </Link>
          ))}
          {secondaryNav.filter(item => ['/about', '/how-it-works', '/insights', '/faq'].includes(item.path)).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`text-sm font-bold uppercase tracking-widest transition-colors ${
                location.pathname === item.path ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            to="/contact"
            className="px-6 py-2 border border-primary/20 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-all"
          >
            Contact
          </Link>
          <LoginButton className="px-6 py-2 bg-primary text-white rounded-full text-xs font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary/20">
            Login / Sign Up
          </LoginButton>
        </div>
      </header>

      {/* Mobile Top Bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 min-h-16 glass z-50 flex items-center justify-between px-5">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <Menu size={24} />
        </button>

        {/* Centered brand name */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-baseline gap-1 pointer-events-none select-none">
          <span className="font-serif font-black italic text-[17px] tracking-tight text-foreground leading-none">
            LinkedUp
          </span>
          <span className="font-serif font-black italic text-[17px] tracking-tight text-primary leading-none">
            Cars
          </span>
        </div>

        <Link to="/" className="flex items-center shrink-0">
          <Logo size="lg" showText={false} />
        </Link>
      </header>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-[80%] max-w-sm bg-card z-[70] p-8 flex flex-col"
            >
              <div className="flex items-center justify-between mb-12">
                <Logo size="xl" showText={false} />
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-muted-foreground">
                  <X size={24} />
                </button>
              </div>

              <nav className="flex flex-col gap-6">
                <Link to="/cars" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 text-lg font-bold text-muted-foreground hover:text-primary transition-colors">
                  <Search size={20} /> Browse Models
                </Link>
                {secondaryNav.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsSidebarOpen(false)}
                    className="flex items-center gap-4 text-lg font-bold text-muted-foreground hover:text-primary transition-colors"
                  >
                    <item.icon size={20} />
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-auto pt-8 border-t border-border">
                <LoginButton className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-center block shadow-lg shadow-primary/20">
                  Login / Sign Up
                </LoginButton>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={`flex-1 pb-20 md:pb-0 ${location.pathname === '/' ? 'pt-0' : 'pt-20 md:pt-20'}`}>
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 glass-dark z-50 flex items-center justify-around px-2 border-t border-white/5">
        {[
          { label: 'Home', path: '/', icon: Home },
            { label: 'Browse', path: '/cars', icon: Search },
          { label: 'Insights', path: '/insights', icon: BookOpen },
          { label: 'FAQ', path: '/faq', icon: HelpCircle },
          { label: 'Login', path: loginUrl, icon: User },
        ].map((item) => {
          const isActive = location.pathname === item.path;
          const isExternal = item.path.startsWith('http');

          const content = (
            <>
              <div className={`p-2 rounded-xl transition-all ${
                isActive ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/20' : 'text-muted-foreground group-hover:text-foreground'
              }`}>
                <item.icon size={20} />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-tighter ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}>
                {item.label}
              </span>
            </>
          );

          if (isExternal) {
            return (
              <a key={item.path} href={item.path} className="flex flex-col items-center gap-1 group">
                {content}
              </a>
            );
          }

          return (
            <Link key={item.path} to={item.path} className="flex flex-col items-center gap-1 group">
              {content}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <footer className="block md:block relative bg-card border-t border-border py-12 md:py-20 px-6 md:px-8 overflow-hidden">
        {/* Glow Effect */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[300px] h-[200px] bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[200px] bg-amber-500/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 relative z-10">
          <div className="col-span-2">
            <Logo size="xl" showText={false} className="mb-6 scale-110" />
            <p className="text-muted-foreground max-w-sm leading-relaxed">
              Experience the pinnacle of luxury car rentals. Our curated fleet and personalized service ensure every journey is unforgettable.
            </p>
            <div className="mt-6 space-y-2 text-sm text-muted-foreground">
              <p>Lanphil Arcade, Ridgeways, Kiambu Road</p>
              <p>info@linkedupcarsrentals.com</p>
              <a href="https://wa.me/254714764162" target="_blank" rel="noreferrer" className="block hover:text-primary transition-colors">+254 714 764 162</a>
            </div>
          </div>
          <div>
            <h4 className="font-bold uppercase tracking-widest text-xs mb-6 text-foreground">Quick Links</h4>
            <div className="flex flex-col gap-4">
              <Link to="/cars" className="text-sm text-muted-foreground hover:text-primary transition-colors">Browse Models</Link>
              {secondaryNav.slice(0, 4).map(item => (
                <Link key={item.path} to={item.path} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold uppercase tracking-widest text-xs mb-6 text-foreground">Legal</h4>
            <div className="flex flex-col gap-4">
              {secondaryNav.slice(4).map(item => (
                <Link key={item.path} to={item.path} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {item.label}
                </Link>
              ))}
              <LoginButton className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Client / Fleet Login
              </LoginButton>
              <a 
                href={loginUrl.replace('/login', '/driver/login')} 
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Driver Portal Login
              </a>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-border flex justify-between items-center relative z-10">
          <p className="text-xs text-muted-foreground">© 2026 LinkedUp Car Rentals. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/terms" className="text-xs text-muted-foreground hover:text-primary transition-colors">Terms</Link>
            <Link to="/privacy" className="text-xs text-muted-foreground hover:text-primary transition-colors">Privacy</Link>
            <Link to="/contact" className="text-xs text-muted-foreground hover:text-primary transition-colors">Contact</Link>
          </div>
        </div>
      </footer>

      <FloatingSupportWidget context="LinkedUp public site" />
    </div>
  );
}
