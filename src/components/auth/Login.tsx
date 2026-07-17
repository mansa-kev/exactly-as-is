import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Mail, Lock, Loader2, AlertCircle, ArrowRight, Clock, UserPlus, Eye, EyeOff, X, CheckCircle2, User } from 'lucide-react';
import { InternationalPhoneInput } from '../ui/InternationalPhoneInput';
import { Logo } from '../shared/Logo';
import { motion, AnimatePresence } from 'motion/react';
import { useSubdomain } from '../../contexts/SubdomainContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { notificationService } from '../../services/notificationService';
import { analyticsService } from '../../services/analyticsService';
import { sendTemplatedEmail } from '../../services/emailProvider';
import { linkBookingAndSyncProfile } from '../../utils/bookingProfileSync';

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
interface RateLimitState {
  attempts: number;
  lockoutUntil: number | null;
}

const RATE_LIMIT_KEY = 'login_rate_limit';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Portal detection
// ---------------------------------------------------------------------------
type PortalType = 'admin' | 'fleet' | 'client' | 'driver' | 'www';

function detectPortal(subdomain: string, pathname: string): PortalType {
  if (subdomain === 'admin' || pathname.startsWith('/admin')) return 'admin';
  if (subdomain === 'fleet' || pathname.startsWith('/fleet')) return 'fleet';
  if (subdomain === 'drivers' || pathname.includes('/driver')) return 'driver';
  if (subdomain === 'app' || pathname.startsWith('/client')) return 'client';
  return 'www';
}

const PORTAL_CONFIG: Record<PortalType, { title: string; subtitle: string; allowSignUp: boolean; roleLabel: string }> = {
  admin: { title: 'Admin Portal', subtitle: 'Manage your platform', allowSignUp: false, roleLabel: 'Administrator' },
  fleet: { title: 'Fleet Portal', subtitle: 'Manage your fleet', allowSignUp: false, roleLabel: 'Fleet Owner' },
  client: { title: 'Client Portal', subtitle: 'Your driving experience', allowSignUp: true, roleLabel: 'Client' },
  driver: { title: 'Driver Portal', subtitle: 'Trip Sheets & Handover Logs', allowSignUp: false, roleLabel: 'Driver' },
  www: { title: 'LinkedUp Cars', subtitle: 'Premium car rentals', allowSignUp: true, roleLabel: 'Client' },
};

async function ensureUserProfile(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }) {
  const { data: existing, error: readError } = await supabase
    .from('user_profiles')
    .select('role, status, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message || 'Could not load your profile');
  }

  const meta = user.user_metadata || {};

  if (!existing) {
    const { error: upsertError } = await supabase.from('user_profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: (meta.full_name as string) || '',
      phone_number: (meta.phone_number as string) || '',
      license_number: (meta.license_number as string) || '',
      role: (meta.role as string) || 'client',
      status: 'active',
    }, { onConflict: 'id' });

    if (upsertError) {
      throw new Error(upsertError.message || 'Could not create your profile. Please contact support.');
    }
  }

  if (meta.pending_booking_id) {
    const pendingBookingId = meta.pending_booking_id as string;
    await supabase
      .from('bookings')
      .update({ client_id: user.id })
      .eq('id', pendingBookingId);
    await supabase.auth.updateUser({ data: { pending_booking_id: null } });

    const { data: linkedBooking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', pendingBookingId)
      .maybeSingle();
    if (linkedBooking) {
      try {
        await linkBookingAndSyncProfile(supabase, { ...linkedBooking, client_id: user.id });
      } catch (syncErr) {
        console.error('Failed to sync booking documents to profile:', syncErr);
      }
    }
  }

  if (existing) {
    return existing;
  }

  const { data: created, error: reloadError } = await supabase
    .from('user_profiles')
    .select('role, status, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (reloadError || !created) {
    throw new Error('Profile was created but could not be loaded. Please refresh and try again.');
  }

  return created;
}

// ---------------------------------------------------------------------------
// Main Login Component
// ---------------------------------------------------------------------------
export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { subdomain, setPreviewSubdomain } = useSubdomain();
  const { refreshProfile } = useAuth();
  const portal = detectPortal(subdomain, location.pathname);
  const config = PORTAL_CONFIG[portal];

  // Auth state
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'force-change' | 'verify-otp'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sign up fields
  const [signUpName, setSignUpName] = useState('');
  const [signUpPhone, setSignUpPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // OTP verification
  const [otpCode, setOtpCode] = useState('');
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Forgot password
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Force password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Rate limiting
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({ attempts: 0, lockoutUntil: null });

  useEffect(() => {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    if (stored) setRateLimitState(JSON.parse(stored));
  }, []);

  const isLockedOut = () => rateLimitState.lockoutUntil ? Date.now() < rateLimitState.lockoutUntil : false;
  const getRemainingLockoutTime = () => rateLimitState.lockoutUntil ? Math.ceil((rateLimitState.lockoutUntil - Date.now()) / 60000) : 0;

  const updateRateLimit = (state: RateLimitState) => {
    setRateLimitState(state);
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(state));
  };

  const incrementAttempts = () => {
    const newAttempts = rateLimitState.attempts + 1;
    if (newAttempts >= MAX_ATTEMPTS) {
      updateRateLimit({ attempts: newAttempts, lockoutUntil: Date.now() + LOCKOUT_DURATION });
      setError(`Too many failed attempts. Locked for ${LOCKOUT_DURATION / 60000} minutes.`);
    } else {
      updateRateLimit({ ...rateLimitState, attempts: newAttempts });
    }
  };

  const resetRateLimit = () => updateRateLimit({ attempts: 0, lockoutUntil: null });

  // ---------------------------------------------------------------------------
  // Domain helpers
  // ---------------------------------------------------------------------------
  const getPortalUrl = (portalKey: 'app' | 'fleet' | 'admin' | 'drivers') => {
    const urls: Record<string, string> = {
      app: import.meta.env.VITE_APP_URL || 'https://app.linkedupcarsrentals.com',
      fleet: import.meta.env.VITE_FLEET_URL || 'https://fleet.linkedupcarsrentals.com',
      admin: import.meta.env.VITE_ADMIN_URL || 'https://admin.linkedupcarsrentals.com',
      drivers: import.meta.env.VITE_DRIVERS_URL || 'https://drivers.linkedupcarsrentals.com',
    };
    return urls[portalKey];
  };

  const isDev = (() => {
    const h = window.location.hostname;
    return h.includes('run.app') || h === 'localhost' || h.includes('google.com');
  })();

  // ---------------------------------------------------------------------------
  // Redirect logic
  // ---------------------------------------------------------------------------
  const redirectAfterLogin = (userRole: string) => {
    const targetSubdomain = portal === 'admin' ? 'admin'
      : portal === 'fleet' ? 'fleet'
      : portal === 'driver' ? 'drivers'
      : userRole === 'admin' ? 'admin'
      : userRole === 'fleet_owner' ? 'fleet'
      : userRole === 'driver' ? 'drivers'
      : 'app';

    if (isDev) {
      setPreviewSubdomain(targetSubdomain as any);
      if (targetSubdomain === 'admin') navigate('/admin');
      else if (targetSubdomain === 'fleet') navigate('/fleet');
      else if (targetSubdomain === 'drivers') navigate('/');
      else navigate('/client');
    } else {
      const portalUrl = getPortalUrl(targetSubdomain as 'app' | 'fleet' | 'admin' | 'drivers');
      const path = targetSubdomain === 'app' ? '/client' : (targetSubdomain === 'drivers' ? '/' : `/${targetSubdomain}`);
      window.location.href = `${portalUrl}${path}`;
    }
  };

  // Email confirmation links land on /login with ?code= (PKCE) or ?token_hash=&type=
  useEffect(() => {
    let cancelled = false;

    const finishConfirmedLogin = async (user: { id: string; email?: string; user_metadata?: Record<string, unknown> }) => {
      const profile = await ensureUserProfile(user);
      if (cancelled) return;
      await refreshProfile();
      const role = profile?.role || (user.user_metadata?.role as string) || 'client';
      redirectAfterLogin(role);
    };

    const clearAuthParams = () => {
      window.history.replaceState({}, '', window.location.pathname);
    };

    (async () => {
      const params = new URLSearchParams(location.search);
      const authError = params.get('error_description') || params.get('error');
      if (authError) {
        setError(decodeURIComponent(authError.replace(/\+/g, ' ')));
        clearAuthParams();
        return;
      }

      const code = params.get('code');
      const tokenHash = params.get('token_hash');
      const otpType = params.get('type');

      if (!code && !(tokenHash && otpType)) return;

      setLoading(true);
      setError(null);

      try {
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          clearAuthParams();
          if (!data.session?.user) {
            throw new Error('Email confirmed but no session was created. Please log in.');
          }
          setSuccessMsg('Email confirmed! Signing you in...');
          await finishConfirmedLogin(data.session.user);
          return;
        }

        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash!,
          type: otpType as 'signup' | 'email' | 'recovery' | 'invite' | 'magiclink' | 'email_change',
        });
        if (error) throw error;
        clearAuthParams();
        if (!data.user) {
          throw new Error('Email confirmed but no session was created. Please log in.');
        }
        setSuccessMsg('Email confirmed! Signing you in...');
        await finishConfirmedLogin(data.user);
      } catch (err: any) {
        clearAuthParams();
        setError(err?.message || 'Confirmation link expired or invalid. Log in or enter the code from your email.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [location.search, refreshProfile]);

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isLockedOut()) {
      setError(`Account locked. Try again in ${getRemainingLockoutTime()} minutes.`);
      setLoading(false);
      return;
    }

    if (!email || !password) {
      setError('Please enter both email and password');
      setLoading(false);
      return;
    }

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        const msg = signInError.message || '';
        if (msg.toLowerCase().includes('email not confirmed')) {
          // Account exists but email isn't verified yet — show OTP entry
          setPendingVerifyEmail(email);
          setOtpCode('');
          setMode('verify-otp');
          startResendCooldown();
          return;
        }
        incrementAttempts();
        setError(msg || 'Invalid email or password');
        return;
      }

      if (data.user) {
        resetRateLimit();

        const profile = await ensureUserProfile(data.user);
        await refreshProfile();

        const userRole = profile?.role || data.user.user_metadata?.role || 'client';
        const userName = profile?.full_name || data.user.user_metadata?.full_name || 'Valued Customer';

        // Portal role enforcement — reject logins from users with the wrong role
        if (portal === 'fleet' && userRole !== 'fleet_owner') {
          await supabase.auth.signOut();
          setError('This portal is for fleet owners only. Please use the correct login portal for your account type.');
          return;
        }
        if (portal === 'admin' && userRole !== 'admin') {
          await supabase.auth.signOut();
          setError('This portal is for administrators only. Please use the correct login portal.');
          return;
        }
        if (portal === 'driver' && userRole !== 'driver') {
          await supabase.auth.signOut();
          setError('This portal is for drivers only. Please use the correct login portal.');
          return;
        }

        // Check if this is first login after email confirmation
        const welcomeEmailKey = `welcome_sent_${data.user.id}`;
        const welcomeEmailSent = localStorage.getItem(welcomeEmailKey);

        if (!welcomeEmailSent && data.user.email_confirmed_at && userRole === 'client') {
          const appUrl = isDev ? window.location.origin : getPortalUrl('app');
          const loginUrl = `${appUrl}/login`;

          sendTemplatedEmail(
            data.user.email!,
            'welcome_after_confirmation',
            { name: userName, login_url: loginUrl }
          ).then(() => {
            localStorage.setItem(welcomeEmailKey, 'true');
          }).catch((err) => {
            console.error('Failed to send welcome email:', err);
          });
        }

        // Check if fleet owner needs to change default password
        if (userRole === 'fleet_owner' && password === 'Fleet123!') {
          setMode('force-change');
          return;
        }

        redirectAfterLogin(userRole);
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Sign Up (clients only)
  // ---------------------------------------------------------------------------
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    analyticsService.trackEvent('click', 'sign_up_submit');
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }
    if (!signUpName.trim()) {
      setError('Please enter your full name');
      setLoading(false);
      return;
    }

    try {
      const appUrl = isDev ? window.location.origin : getPortalUrl('app');

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${appUrl}/login`,
          data: {
            full_name: signUpName,
            phone_number: signUpPhone,
            role: 'client',
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        setPendingVerifyEmail(email);
        setOtpCode('');
        setPassword('');
        setConfirmPassword('');
        setMode('verify-otp');
        startResendCooldown();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // OTP Verification
  // ---------------------------------------------------------------------------
  const startResendCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.trim().length < 6) {
      setError('Please enter the verification code from your email');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: pendingVerifyEmail,
        token: otpCode.trim(),
        type: 'signup',
      });
      if (verifyError) throw verifyError;

      const user = data.user;
      if (user) {
        await ensureUserProfile(user);
        await refreshProfile();
        const meta = user.user_metadata || {};
        redirectAfterLogin((meta.role as string) || 'client');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: pendingVerifyEmail,
      });
      if (resendError) throw resendError;
      setSuccessMsg('New code sent — check your inbox.');
      startResendCooldown();
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    }
  };

  // ---------------------------------------------------------------------------
  // Forgot Password
  // ---------------------------------------------------------------------------
  const handleForgotPassword = async () => {
    if (!resetEmail) {
      setError('Please enter your email address');
      return;
    }
    setResetLoading(true);
    setError(null);

    try {
      // Redirect to the current portal's login after reset
      const resetRedirectUrl = isDev ? window.location.origin : (() => {
        if (portal === 'fleet') return getPortalUrl('fleet');
        if (portal === 'admin') return getPortalUrl('admin');
        return getPortalUrl('app');
      })();

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${resetRedirectUrl}/login`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setResetLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Force Password Change (fleet owners on first login)
  // ---------------------------------------------------------------------------
  const handleForcePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPassword(true);
    setError(null);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      setChangingPassword(false);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match');
      setChangingPassword(false);
      return;
    }
    if (newPassword === 'Fleet123!') {
      setError('Please choose a different password');
      setChangingPassword(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success('Password changed successfully!');
      redirectAfterLogin('fleet_owner');
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex">
      {/* Left side - Background image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Placeholder background - user will provide image later */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <img
            src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&q=80"
            alt="Luxury car"
            className="w-full h-full object-cover opacity-40"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/70" />
        </div>

        {/* Overlay content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div>
            <h2 className="text-4xl font-serif font-black italic text-white tracking-tight leading-tight">
              LINKEDUP<br />CARS
            </h2>
            <p className="text-white/50 text-sm mt-2 font-medium">Premium Car Rentals</p>
          </div>

          <div className="space-y-6">
            <blockquote className="text-xl text-white/80 font-serif italic leading-relaxed">
              "The road is your canvas. Drive your masterpiece."
            </blockquote>
            <div className="flex items-center gap-8 text-white/40 text-xs font-bold uppercase tracking-widest">
              <span>Nairobi</span>
              <span>&bull;</span>
              <span>Mombasa</span>
              <span>&bull;</span>
              <span>Kisumu</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-background relative">
        {/* Mobile background */}
        <div className="absolute inset-0 lg:hidden overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=60"
            alt=""
            className="w-full h-full object-cover opacity-5"
            referrerPolicy="no-referrer"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md"
        >
          {/* Success message */}
          <AnimatePresence>
            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-start gap-3"
              >
                <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-sm font-bold text-green-600">{successMsg}</p>
                </div>
                <button onClick={() => setSuccessMsg(null)} className="text-green-500/60 hover:text-green-500 ml-auto shrink-0">
                  <X size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-8 pb-0 flex flex-col items-center">
              <div className="mb-5">
                <Logo size="lg" showText={false} />
              </div>
              <h1 className="text-2xl font-serif font-black tracking-tighter text-foreground italic mb-1">
                {config.title}
              </h1>
              <p className="text-muted-foreground text-sm font-medium">
                {mode === 'force-change' ? 'Change your password to continue' : config.subtitle}
              </p>

              {/* Portal badge */}
              {portal !== 'www' && (
                <div className="mt-3 px-3 py-1 bg-primary/5 rounded-full">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{config.roleLabel}</span>
                </div>
              )}
            </div>

            {/* --------------- Force Password Change --------------- */}
            {mode === 'force-change' && (
              <form onSubmit={handleForcePasswordChange} className="p-8 space-y-5">
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <p className="text-sm text-amber-600 font-medium">
                    You are using a temporary password. Please set a new secure password to continue.
                  </p>
                </div>

                {error && <ErrorAlert message={error} />}

                <PasswordField
                  label="New Password"
                  value={newPassword}
                  onChange={setNewPassword}
                  show={showPassword}
                  onToggle={() => setShowPassword(!showPassword)}
                  placeholder="Min 8 characters"
                />
                <PasswordField
                  label="Confirm New Password"
                  value={confirmNewPassword}
                  onChange={setConfirmNewPassword}
                  show={showPassword}
                  onToggle={() => setShowPassword(!showPassword)}
                  placeholder="Repeat password"
                />

                <SubmitButton loading={changingPassword} disabled={changingPassword}>
                  Set New Password
                </SubmitButton>
              </form>
            )}

            {/* --------------- Login Form --------------- */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="p-8 space-y-5">
                {error && <ErrorAlert message={error} />}

                {isLockedOut() && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3">
                    <Clock className="text-amber-500 shrink-0" size={18} />
                    <div className="text-sm text-amber-600">
                      <span className="font-bold">Account locked.</span> Try again in {getRemainingLockoutTime()} minutes.
                    </div>
                  </motion.div>
                )}

                {!isLockedOut() && rateLimitState.attempts > 0 && (
                  <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-sm text-orange-600 flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    {MAX_ATTEMPTS - rateLimitState.attempts} attempts remaining
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-muted border border-transparent focus:border-primary/30 rounded-xl outline-none transition-all font-medium text-sm"
                      placeholder="name@example.com" required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Password</label>
                    <button type="button" onClick={() => { setMode('forgot'); setResetEmail(email); setError(null); }} className="text-[10px] font-bold text-primary hover:underline">
                      Forgot Password?
                    </button>
                  </div>
                  <PasswordField
                    value={password} onChange={setPassword}
                    show={showPassword} onToggle={() => setShowPassword(!showPassword)}
                    placeholder="••••••••"
                  />
                </div>

                <SubmitButton loading={loading} disabled={loading || isLockedOut()}>
                  Sign In
                </SubmitButton>
              </form>
            )}

            {/* --------------- Verify OTP --------------- */}
            {mode === 'verify-otp' && (
              <form onSubmit={handleVerifyOtp} className="p-8 space-y-5">
                {error && <ErrorAlert message={error} />}

                <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl text-center space-y-1">
                  <p className="text-sm font-bold text-foreground">Check your email</p>
                  <p className="text-xs text-muted-foreground">
                    We sent a verification code to <span className="font-bold text-foreground">{pendingVerifyEmail}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Verification Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={otpCode}
                    onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '')); setError(null); }}
                    className="w-full px-4 py-4 bg-muted border border-transparent focus:border-primary/30 rounded-xl outline-none transition-all font-mono text-2xl text-center tracking-[0.5em] text-foreground"
                    placeholder="--------"
                    autoFocus
                    required
                  />
                </div>

                <SubmitButton loading={loading} disabled={loading || otpCode.length < 6}>
                  Verify &amp; Sign In
                </SubmitButton>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                  </button>
                </div>
              </form>
            )}

            {/* --------------- Sign Up Form (clients only) --------------- */}
            {mode === 'signup' && (
              <form onSubmit={handleSignUp} className="p-8 space-y-5">
                {error && <ErrorAlert message={error} />}

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                      type="text" value={signUpName} onChange={(e) => setSignUpName(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-muted border border-transparent focus:border-primary/30 rounded-xl outline-none transition-all font-medium text-sm"
                      placeholder="John Doe" required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-muted border border-transparent focus:border-primary/30 rounded-xl outline-none transition-all font-medium text-sm"
                      placeholder="name@example.com" required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Phone Number</label>
                  <div className="relative">
                    <InternationalPhoneInput
                      value={signUpPhone}
                      onChange={setSignUpPhone}
                      placeholder="Phone Number"
                      className="bg-muted border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <PasswordField
                    label="Password" value={password} onChange={setPassword}
                    show={showPassword} onToggle={() => setShowPassword(!showPassword)}
                    placeholder="Min 6 chars"
                  />
                  <PasswordField
                    label="Confirm" value={confirmPassword} onChange={setConfirmPassword}
                    show={showPassword} onToggle={() => setShowPassword(!showPassword)}
                    placeholder="Repeat"
                  />
                </div>

                <SubmitButton loading={loading} disabled={loading}>
                  <UserPlus size={18} /> Create Account
                </SubmitButton>
              </form>
            )}

            {/* --------------- Forgot Password --------------- */}
            {mode === 'forgot' && (
              <div className="p-8 space-y-5">
                {resetSent ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
                      <CheckCircle2 className="text-green-500" size={18} />
                      <p className="text-sm font-medium text-green-600">Password reset link sent! Check your email inbox.</p>
                    </div>
                    <button
                      onClick={() => { setMode('login'); setResetSent(false); setError(null); }}
                      className="w-full py-3 bg-muted rounded-xl text-sm font-bold text-foreground hover:bg-muted/80 transition-colors"
                    >
                      Back to Sign In
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Enter your email and we'll send you a link to reset your password.</p>
                    {error && <ErrorAlert message={error} />}
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                      <input
                        type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-muted border border-transparent focus:border-primary/30 rounded-xl outline-none transition-all font-medium text-sm"
                        placeholder="name@example.com"
                      />
                    </div>
                    <SubmitButton loading={resetLoading} disabled={resetLoading} onClick={handleForgotPassword} type="button">
                      Send Reset Link
                    </SubmitButton>
                    <button
                      onClick={() => { setMode('login'); setError(null); }}
                      className="w-full py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Back to Sign In
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="p-6 bg-muted/30 border-t border-border text-center">
              {mode === 'login' && config.allowSignUp && (
                <p className="text-xs text-muted-foreground">
                  Don't have an account?{' '}
                  <button onClick={() => { setMode('signup'); setError(null); setSuccessMsg(null); }} className="font-bold text-primary hover:underline">
                    Sign Up
                  </button>
                </p>
              )}
              {mode === 'login' && !config.allowSignUp && (
                <p className="text-xs text-muted-foreground">
                  Account issues? Contact <span className="font-bold text-primary">support@linkedupcarsrentals.com</span>
                </p>
              )}
              {mode === 'signup' && (
                <p className="text-xs text-muted-foreground">
                  Already have an account?{' '}
                  <button onClick={() => { setMode('login'); setError(null); }} className="font-bold text-primary hover:underline">
                    Sign In
                  </button>
                </p>
              )}
              {mode === 'verify-otp' && (
                <p className="text-xs text-muted-foreground">
                  Wrong email?{' '}
                  <button onClick={() => { setMode('signup'); setError(null); setOtpCode(''); }} className="font-bold text-primary hover:underline">
                    Go back
                  </button>
                </p>
              )}
              {mode === 'forgot' && !resetSent && (
                <p className="text-xs text-muted-foreground">
                  Remember your password?{' '}
                  <button onClick={() => { setMode('login'); setError(null); }} className="font-bold text-primary hover:underline">
                    Sign In
                  </button>
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ErrorAlert({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-4 bg-error/10 border border-error/20 rounded-xl flex items-center gap-3 text-error text-sm"
    >
      <AlertCircle size={18} className="shrink-0" />
      <span>{message}</span>
    </motion.div>
  );
}

function PasswordField({ label, value, onChange, show, onToggle, placeholder }: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      {label && <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">{label}</label>}
      <div className="relative">
        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-12 pr-12 py-3.5 bg-muted border border-transparent focus:border-primary/30 rounded-xl outline-none transition-all font-medium text-sm"
          placeholder={placeholder || '••••••••'}
          required
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function SubmitButton({ loading, disabled, children, onClick, type = 'submit' }: {
  loading: boolean;
  disabled: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'submit' | 'button';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:hover:scale-100 text-sm"
    >
      {loading ? (
        <Loader2 className="animate-spin" size={20} />
      ) : (
        <>
          {children}
          <ArrowRight size={18} />
        </>
      )}
    </button>
  );
}
