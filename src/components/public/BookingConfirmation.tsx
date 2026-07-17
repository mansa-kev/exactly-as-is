import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Car, CheckCircle2, Download, Calendar, MapPin, CreditCard, FileText, ShieldCheck, Clock, AlertCircle, UserPlus, ArrowRight, Loader2, Phone, Hourglass, Star, MessageSquare, Send } from 'lucide-react';
import { LogoLoader } from '../shared/LogoLoader';
import { ContractModal } from './ContractModal';
import { bookingService } from '../../services/bookingService';
import { fleetService } from '../../services/fleetService';
import { clientService } from '../../services/clientService';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { paymentService } from '../../services/paymentService';
import { toast } from 'sonner';
import { getBookingVehicleDisplay } from '../../utils/bookingVehicleDisplay';

export function BookingConfirmation() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const isGuest = !user;
  const isCancelled = booking?.status === 'cancelled';
  const isPendingPayment = !isCancelled && (
    booking?.status === 'pending_payment_verification' ||
    booking?.payment_status === 'pending' ||
    booking?.status === 'pending'
  );
  const isConfirmed = booking?.status === 'confirmed' && booking?.payment_status === 'paid';
  const isTripCompleted = booking?.status === 'completed';
  const isFailed = !isCancelled && booking?.payment_status === 'failed';
  const guestInfo = booking?.metadata?.guest_info;
  const showGuestSignup = isGuest && (isConfirmed || booking?.payment_status === 'paid');

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  const vehicle = booking ? getBookingVehicleDisplay(booking, 'client') : null;

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewRating) return toast.error('Please select a rating');
    if (!reviewComment.trim()) return toast.error('Please write a comment');
    if (!user || !booking) return;
    setSubmittingReview(true);
    try {
      await fleetService.submitReview({
        booking_id: booking.id,
        car_id: booking.car_id,
        user_id: user.id,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setReviewSubmitted(true);
      toast.success('Review submitted! It will appear after admin approval.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  useEffect(() => {
    async function fetchBooking() {
      if (!bookingId) return;
      try {
        const data = await bookingService.getBookingById(bookingId);
        setBooking(data);
        if (data?.metadata?.guest_info?.email) {
          setEmail(data.metadata.guest_info.email);
        }
      } catch (error) {
        console.error('Error fetching booking:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchBooking();
  }, [bookingId]);

  // Supabase realtime: listen for booking status changes (payment confirmed)
  useEffect(() => {
    if (!bookingId) return;

    let retryCount = 0;
    const maxRetries = 3;

    const setupChannel = () => {
      const channel = supabase
        .channel(`confirmation-${bookingId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${bookingId}`,
        }, (payload: any) => {
          console.log('Booking update received:', payload.new);
          const updated = payload.new;
          setBooking((prev: any) => ({ ...prev, ...updated }));
          
          if (updated.payment_status === 'paid') {
            toast.success('Payment confirmed! Your booking is all set.');
          } else if (updated.payment_status === 'failed') {
            toast.error('Payment verification failed. Please contact support.');
          } else if (updated.status === 'cancelled') {
            toast.error('Booking has been cancelled.');
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Realtime subscription established');
            retryCount = 0; // Reset retry count on successful connection
          } else if (status === 'CHANNEL_ERROR' && retryCount < maxRetries) {
            console.log('Realtime connection error, retrying...');
            retryCount++;
            setTimeout(setupChannel, 2000 * retryCount); // Exponential backoff
          }
        });

      return channel;
    };

    const channel = setupChannel();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId]);

  // Poll NCBA while payment is still pending (covers closed-tab / missed realtime cases)
  useEffect(() => {
    if (!bookingId || !booking || isCancelled) return;
    const stillPending =
      booking.status === 'pending_payment_verification' ||
      booking.payment_status === 'pending' ||
      booking.status === 'pending';
    if (!stillPending) return;

    const statusToken = booking.metadata?.client_status_token;
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (!active) return;
      const status = await paymentService.getPaymentStatus(bookingId, statusToken);
      if (!active) return;

      if (status.paid) {
        const refreshed = await bookingService.getBookingById(bookingId);
        if (refreshed && active) setBooking(refreshed);
        toast.success('Payment confirmed! Your booking is all set.');
        return;
      }

      timeoutId = setTimeout(poll, 5000);
    };

    timeoutId = setTimeout(poll, 15000);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [bookingId, booking?.status, booking?.payment_status, booking?.metadata?.client_status_token, isCancelled]);

  const [creatingAccount, setCreatingAccount] = useState(false);
  const [showContract, setShowContract] = useState(false);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setCreatingAccount(true);
    try {
      const appUrl = import.meta.env.VITE_APP_URL || 'https://app.linkedupcarsrentals.com';
      const guestInfo = booking?.metadata?.guest_info;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${appUrl}/login`,
          data: {
            full_name: guestInfo?.full_name || '',
            phone_number: guestInfo?.phone || '',
            license_number: guestInfo?.license_number || '',
            id_number: guestInfo?.id_number || '',
            role: 'client',
            pending_booking_id: bookingId || null,
          },
        },
      });

      if (authError) throw authError;

      // Try to claim the guest booking on the spot using session token if signup
      // returned an immediately usable session (e.g. email confirmation disabled).
      if (authData.session?.access_token && bookingId) {
        try {
          const cachedToken = sessionStorage.getItem(`pending_booking_token_${booking?.car_id || ''}`)
            || booking?.metadata?.client_status_token
            || null;
          await fetch(`/api/bookings/${bookingId}/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authData.session.access_token}`,
            },
            body: JSON.stringify({ statusToken: cachedToken }),
          });
          await clientService.syncGuestBookingToProfile(authData.user!.id, booking);
        } catch (claimErr) {
          console.error('Booking claim failed:', claimErr);
        }
      }

      if (authData.user) {
        toast.success(
          authData.session
            ? 'Account created! Your booking and documents are now in your portal.'
            : 'Account created! Confirm your email, then log in — your booking details will be waiting for you.'
        );
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Failed to create account. Please try again.');
    } finally {
      setCreatingAccount(false);
    }
  };

  if (loading) return <LogoLoader fullScreen message="Loading booking details..." />;

  return (
    <div className="pt-32 pb-20 bg-background min-h-screen">
      <div className="max-w-4xl mx-auto px-6 space-y-12">
        {/* Success Header */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative p-12 rounded-[48px] bg-card border border-border text-center overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
          <div className={`w-24 h-24 ${isConfirmed ? 'bg-primary/10' : 'bg-amber-500/10'} rounded-full flex items-center justify-center mx-auto mb-8`}>
            {isConfirmed ? (
              <CheckCircle2 className="text-primary" size={48} />
            ) : (
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                <Hourglass className="text-amber-500" size={48} />
              </motion.div>
            )}
          </div>
          <h1 className="text-5xl font-serif font-black italic text-foreground mb-4 tracking-tight">
            {isConfirmed ? 'Booking Confirmed!' : 'Booking Submitted!'}
          </h1>
          <p className={`${isConfirmed ? 'text-primary' : 'text-amber-500'} font-black uppercase tracking-[0.3em] text-sm mb-8`}>
            {isConfirmed ? 'Your Adventure Awaits' : 'Awaiting Payment Verification'}
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <div className="px-6 py-3 bg-card/50 rounded-full border border-border text-xs font-bold text-muted-foreground">
              Booking ID: <span className="text-foreground">{bookingId}</span>
            </div>
            <div className="px-6 py-3 bg-card/50 rounded-full border border-border text-xs font-bold text-muted-foreground">
              Status: <span className="text-primary uppercase">{booking?.status?.replace('_', ' ')}</span>
            </div>
          </div>

          {/* Contract Status */}
          {booking?.contract_signed && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-6 bg-success/5 rounded-[24px] border border-success/20 space-y-4"
            >
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="text-success" size={20} />
                <div>
                  <p className="text-sm font-bold text-success">Contract Secured</p>
                  <p className="text-xs text-success/80">Digital signature captured and stored</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="text-success" size={16} />
                <p className="text-xs text-success/80">Payment authorization hold active</p>
              </div>
            </motion.div>
          )}

          {isPendingPayment && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-amber-500/5 rounded-[24px] border border-amber-500/20 space-y-3 mb-8 text-left"
            >
              <div className="flex items-center gap-3">
                <Phone className="text-amber-500" size={20} />
                <p className="text-sm font-bold text-amber-500">Payment Pending Verification</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your NCBA STK Push payment is being verified. This page will automatically update once NCBA confirms your payment. This usually takes under a minute.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Loader2 size={14} className="text-amber-500 animate-spin" />
                <span className="text-[10px] text-amber-500/80 font-bold uppercase tracking-widest">Listening for confirmation...</span>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs font-bold text-amber-500 hover:bg-amber-500/20 transition-colors"
              >
                Refresh Status
              </button>
            </motion.div>
          )}

          {isCancelled && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-red-500/5 rounded-[24px] border border-red-500/20 space-y-3 mb-8 text-left"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="text-red-500" size={20} />
                <p className="text-sm font-bold text-red-500">Booking Cancelled</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This booking has been cancelled. If you believe this is an error or would like a refund, please contact our support team.
              </p>
              <button
                onClick={() => navigate('/cars')}
                className="mt-3 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-bold text-red-500 hover:bg-red-500/20 transition-colors"
              >
                Browse Models
              </button>
            </motion.div>
          )}

          {isFailed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-red-500/5 rounded-[24px] border border-red-500/20 space-y-3 mb-8 text-left"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="text-red-500" size={20} />
                <p className="text-sm font-bold text-red-500">Payment Failed</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your payment could not be verified. Please contact support or try again with a different payment method.
              </p>
              <button
                onClick={() => navigate('/cars')}
                className="mt-3 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-bold text-red-500 hover:bg-red-500/20 transition-colors"
              >
                Try Again
              </button>
            </motion.div>
          )}

          <button
            onClick={() => setShowContract(true)}
            disabled={!isConfirmed}
            className="px-10 py-5 bg-card text-foreground font-black uppercase tracking-widest text-xs rounded-full flex items-center gap-3 mx-auto hover:bg-primary hover:text-primary-foreground transition-all hover:scale-105 active:scale-95 shadow-xl shadow-border/20 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed border border-border"
          >
            <Download size={18} /> Download Rental Contract
          </button>

          {showContract && booking && (
            <ContractModal booking={booking} onClose={() => setShowContract(false)} />
          )}
        </motion.div>

        {/* Glovebox auto-save notice for logged-in users */}
        {!isGuest && booking?.metadata?.documents && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-between gap-4 p-5 rounded-[24px] bg-success/5 border border-success/20"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-success shrink-0" size={20} />
              <div>
                <p className="text-sm font-bold text-success">Documents saved to your Glovebox</p>
                <p className="text-xs text-success/70 mt-0.5">Your documents are on file — next booking will be pre-filled automatically.</p>
              </div>
            </div>
            <Link
              to="/client/glovebox"
              className="shrink-0 px-4 py-2 bg-success/10 border border-success/20 rounded-xl text-xs font-bold text-success hover:bg-success/20 transition-colors flex items-center gap-1.5"
            >
              View Glovebox <ArrowRight size={12} />
            </Link>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Booking Summary */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="p-10 rounded-[40px] bg-card border border-border space-y-8"
          >
            <h2 className="text-2xl font-serif font-black italic text-foreground">Trip Summary</h2>
            
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-2xl bg-card/50 flex items-center justify-center text-primary shrink-0">
                  <Car size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vehicle</p>
                  <p className="text-sm font-bold text-foreground">
                    {vehicle?.modelLabel}
                    {vehicle?.year ? ` (${vehicle.year})` : ''}
                  </p>
                  {vehicle?.clientSubtitle && (
                    <p className="text-xs text-muted-foreground mt-1">{vehicle.clientSubtitle}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-2xl bg-card/50 flex items-center justify-center text-primary shrink-0">
                  <Calendar size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rental Period</p>
                  <p className="text-sm font-bold text-foreground">{booking?.start_date} — {booking?.end_date}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-2xl bg-card/50 flex items-center justify-center text-primary shrink-0">
                  <MapPin size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pickup Location</p>
                  <p className="text-sm font-bold text-foreground">{booking?.pickup_location}</p>
                </div>
              </div>

              <div className="pt-6 border-t border-border flex justify-between items-center">
                <div className="flex items-center gap-2 text-primary">
                  <ShieldCheck size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Fully Insured</span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Paid</p>
                  <p className="text-2xl font-black text-foreground">KES {booking?.total_amount?.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Account Creation — guests after payment */}
          {showGuestSignup ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="p-10 rounded-[40px] bg-primary/5 border border-primary/10 space-y-8"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <UserPlus size={24} />
                </div>
                <h2 className="text-2xl font-serif font-black italic text-foreground">Unlock VIP Access</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Create an account to track your rentals, manage documents, and unlock exclusive loyalty rewards.
                  {guestInfo?.full_name ? (
                    <span className="block mt-2 text-foreground font-medium">
                      We&apos;ll pre-fill your name, contact and documents from this booking.
                    </span>
                  ) : null}
                </p>
              </div>
              
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <input 
                  type="email" placeholder="Email" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-6 py-4 bg-card/50 border border-border rounded-[20px] text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    type="password" placeholder="Password" required
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-6 py-4 bg-card/50 border border-border rounded-[20px] text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                  <input 
                    type="password" placeholder="Confirm" required
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-6 py-4 bg-card/50 border border-border rounded-[20px] text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creatingAccount}
                  className="w-full py-5 bg-primary rounded-[24px] text-black font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 group disabled:opacity-50"
                >
                  {creatingAccount ? (
                    <><Loader2 className="animate-spin" size={18} /> Creating Account...</>
                  ) : (
                    <>Create My Account <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                  )}
                </button>
              </form>

              <p className="text-[10px] text-center text-muted-foreground font-bold uppercase tracking-widest">
                Already have an account? <Link to="/login" className="text-primary hover:underline">Sign In</Link>
              </p>
            </motion.div>
          ) : !isGuest ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="p-10 rounded-[40px] bg-primary/5 border border-primary/10 space-y-6 flex flex-col items-center justify-center text-center"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-2xl font-serif font-black italic text-foreground">You're All Set!</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Your booking is linked to your account. View and manage it from your dashboard.
              </p>
              <Link
                to="/client"
                className="px-8 py-4 bg-primary rounded-[20px] text-black font-black uppercase tracking-[0.15em] text-xs flex items-center gap-3 hover:scale-105 transition-all shadow-lg shadow-primary/20"
              >
                Go to My Dashboard <ArrowRight size={16} />
              </Link>
            </motion.div>
          ) : isGuest && isPendingPayment ? (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="p-10 rounded-[40px] bg-card border border-border space-y-4 text-center"
            >
              <Hourglass className="mx-auto text-amber-500" size={32} />
              <h2 className="text-xl font-bold">Account setup unlocks after payment</h2>
              <p className="text-sm text-muted-foreground">
                Once your payment is verified, you can create a portal account here and we&apos;ll import your booking details automatically.
              </p>
            </motion.div>
          ) : null}
        </div>

        {isTripCompleted && isGuest && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-[24px] bg-amber-400/5 border border-amber-400/20 text-center space-y-2"
          >
            <Star className="mx-auto text-amber-400" size={24} />
            <p className="text-sm font-bold">Want to leave a review?</p>
            <p className="text-xs text-muted-foreground">
              Create your account above, then submit a review from My Bookings after your trip is completed.
            </p>
          </motion.div>
        )}

        {/* Review Prompt — only after trip completion */}
        <AnimatePresence>
          {isTripCompleted && user && !reviewSubmitted && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ delay: 0.4 }}
              className="relative p-10 rounded-[40px] bg-card border border-border overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
              <div className="flex items-start gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-amber-400/10 flex items-center justify-center shrink-0">
                  <MessageSquare size={22} className="text-amber-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-serif font-black italic text-foreground">How Was Your Experience?</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Share your honest review of the {vehicle?.modelLabel || 'vehicle'}. It helps other customers and takes 30 seconds.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-6">
                {/* Star Rating */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Your Rating</p>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        onMouseEnter={() => setReviewHover(star)}
                        onMouseLeave={() => setReviewHover(0)}
                        className="transition-transform hover:scale-110 active:scale-95"
                      >
                        <Star
                          size={36}
                          className={`transition-colors ${
                            star <= (reviewHover || reviewRating)
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-border'
                          }`}
                        />
                      </button>
                    ))}
                    {reviewRating > 0 && (
                      <span className="ml-3 text-sm font-bold text-muted-foreground">
                        {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][reviewRating]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Your Comment</p>
                  <textarea
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    rows={4}
                    placeholder="Tell us about the car condition, pickup experience, overall value..."
                    className="w-full px-6 py-4 bg-card/50 border border-border rounded-[20px] text-sm text-foreground focus:ring-2 focus:ring-amber-400/20 outline-none transition-all resize-none"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    Your review will be visible after admin approval. Only your first name is shown.
                  </p>
                  <button
                    type="submit"
                    disabled={submittingReview || !reviewRating}
                    className="flex items-center gap-3 px-8 py-4 bg-amber-400 text-black rounded-[20px] font-black uppercase tracking-widest text-xs hover:bg-amber-300 transition-all shadow-lg shadow-amber-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingReview ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Submit Review
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {isTripCompleted && user && reviewSubmitted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-10 rounded-[40px] bg-amber-400/5 border border-amber-400/20 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-amber-400/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-amber-400" />
              </div>
              <h3 className="text-2xl font-serif font-black italic text-foreground mb-2">Review Submitted!</h3>
              <p className="text-muted-foreground text-sm">Thank you. Your review will appear on the car page once approved by our team.</p>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
