import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  User,
  LogOut,
  Settings,
  Sun,
  Moon,
  Search,
  CheckCircle2,
  AlertCircle,
  Info,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Notification {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
  link?: string;
}

interface PortalHeaderProps {
  isDarkMode: boolean;
  setIsDarkMode: (isDark: boolean) => void;
  portalType: 'client' | 'fleet' | 'admin';
  leftContent?: React.ReactNode;
}

export function PortalHeader({ isDarkMode, setIsDarkMode, portalType, leftContent }: PortalHeaderProps) {
  const navigate = useNavigate();
  const { profile: user } = useAuth();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchNotifications(user);
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotificationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [user]);

  const fetchNotifications = async (user: any) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } else {
      const mockNotifications: Notification[] = [
        {
          id: '1',
          title: 'Welcome to LinkedUp!',
          content: 'Thank you for joining our platform. Start exploring cars today.',
          type: 'success',
          is_read: false,
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          title: 'Profile Incomplete',
          content: 'Please upload your driver\'s license to start booking.',
          type: 'warning',
          is_read: false,
          created_at: new Date(Date.now() - 3600000).toISOString(),
          link: '/client/profile'
        }
      ];
      setNotifications(mockNotifications);
      setUnreadCount(mockNotifications.length);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const markAsRead = async (id: string) => {
    if (!user) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="text-green-500" size={16} />;
      case 'warning': return <AlertCircle className="text-yellow-500" size={16} />;
      case 'error': return <X className="text-red-500" size={16} />;
      default: return <Info className="text-blue-500" size={16} />;
    }
  };

  return (
    <header className="h-14 md:h-16 bg-card border-b border-border flex items-center justify-between px-4 md:px-8 relative z-50">
      <div className="flex items-center gap-4">
        {leftContent}
        {/* Search - hidden on mobile */}
        <div className="relative w-48 lg:w-64 hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input type="text" placeholder="Search..." className="w-full pl-9 pr-4 py-2 bg-muted rounded-xl text-sm outline-none" />
        </div>
      </div>

      {/* Spacer on mobile */}
      <div className="md:hidden flex-1" />

      <div className="flex items-center gap-2 md:gap-4">
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
          title="Toggle Theme"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
            className="p-2 hover:bg-muted rounded-lg relative text-muted-foreground"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full" />
            )}
          </button>

          {showNotificationDropdown && (
            <div className="absolute right-0 mt-2 w-72 md:w-80 bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="p-3 md:p-4 border-b border-border flex items-center justify-between">
                <h4 className="font-bold text-sm">Notifications</h4>
                <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {unreadCount} New
                </span>
              </div>
              <div className="max-h-80 md:max-h-96 overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 md:p-4 border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer ${!notification.is_read ? 'bg-primary/5' : ''}`}
                      onClick={() => {
                        if (!notification.is_read) markAsRead(notification.id);
                        if (notification.link) navigate(notification.link);
                      }}
                    >
                      <div className="flex gap-3">
                        <div className="mt-1">{getIcon(notification.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{notification.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                            {notification.content}
                          </p>
                          <p className="text-[9px] text-muted-foreground mt-2">
                            {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-xs text-muted-foreground">No notifications yet</p>
                  </div>
                )}
              </div>
              <div className="p-3 bg-muted/30 text-center border-t border-border">
                <button className="text-[10px] font-bold text-primary hover:underline">
                  View All Notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="flex items-center gap-2 md:gap-3 p-1 md:pl-3 hover:bg-muted rounded-full transition-colors border border-transparent hover:border-border"
          >
            <div className="text-right hidden lg:block">
              <p className="text-xs font-bold leading-none">{user?.full_name || 'User'}</p>
              <p className="text-[10px] text-muted-foreground mt-1 capitalize">{portalType} Portal</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary overflow-hidden border border-primary/20">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={16} />
              )}
            </div>
          </button>

          {showProfileDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="p-4 bg-muted/30 border-b border-border">
                <p className="text-xs font-bold truncate">{user?.full_name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <div className="p-2">
                <button
                  onClick={() => {
                    if (portalType === 'client') navigate('/client/profile');
                    else if (portalType === 'fleet') navigate('/fleet/settings');
                    else navigate('/admin/settings');
                    setShowProfileDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground rounded-xl transition-colors"
                >
                  <User size={16} />
                  My Profile
                </button>
                <button
                  onClick={() => {
                    if (portalType === 'client') navigate('/client/settings');
                    else if (portalType === 'fleet') navigate('/fleet/settings');
                    else navigate('/admin/settings');
                    setShowProfileDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground rounded-xl transition-colors"
                >
                  <Settings size={16} />
                  Account Settings
                </button>
                <hr className="my-2 border-border" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-error hover:bg-error/10 rounded-xl transition-colors"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
