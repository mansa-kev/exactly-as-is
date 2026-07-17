import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Calendar,
  Car,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  Compass,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  LogOut,
  ChevronRight,
  TrendingUp,
  Star,
  Award,
  Navigation,
  MessageSquare,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { DriverInspectionForm } from './DriverInspectionForm';
import { DriverFieldBooking } from './DriverFieldBooking';
import { DRIVER_ACTIVE_JOB_STATUSES, bookingStatusIn } from '../../constants/bookingStatuses';

type TaskType = 'all' | 'delivery' | 'chauffeur';

export function DriverPortal() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [activeStep, setActiveStep] = useState<'dashboard' | 'inspection' | 'field_booking'>('dashboard');
  const [inspectionType, setInspectionType] = useState<'pre_handover' | 'post_return'>('pre_handover');
  const [filterType, setFilterType] = useState<TaskType>('all');

  // Load user session & driver data
  useEffect(() => {
    const loadSessionAndData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUser(user);

        // Fetch driver profile
        const { data: driverProf, error: profileError } = await supabase
          .from('driver_profiles')
          .select('*, user_profiles(*)')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;
        setProfile(driverProf);

        // Fetch driver bookings
        const { data: driverBookings, error: bookingsError } = await supabase
          .from('bookings')
          .select(`
            *,
            cars (*),
            client:user_profiles!bookings_client_id_fkey (*),
            booking_inspections (*)
          `)
          .eq('driver_id', user.id)
          .order('start_date', { ascending: true });

        if (bookingsError) throw bookingsError;
        setBookings(driverBookings || []);
      } catch (err: any) {
        console.error('Error loading driver portal data:', err);
        toast.error('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    loadSessionAndData();
  }, [activeStep]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleStartInspection = (booking: any, type: 'pre_handover' | 'post_return') => {
    setSelectedBooking(booking);
    setInspectionType(type);
    setActiveStep('inspection');
  };

  const handleSOS = async (booking: any) => {
    if (!window.confirm("Are you sure you want to trigger an SOS? This alerts administration immediately.")) return;
    try {
      const msg = {
        sender_id: user.id,
        receiver_id: null, // to admin
        booking_id: booking.id,
        subject: `EMERGENCY: Driver SOS / Incident`,
        content: `Emergency alert triggered by driver for car ${booking.cars?.license_plate}. Please contact driver immediately.`,
        status: 'new',
        urgency: 'high'
      };
      const { error } = await supabase.from('messages').insert(msg);
      if (error) throw error;
      toast.success('SOS Alert sent. Administration will contact you shortly.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to send SOS. Please call admin directly.');
    }
  };

  // Filter logic
  const filteredBookings = bookings.filter(b => {
    if (filterType === 'all') return true;
    if (filterType === 'chauffeur') return b.needs_chauffeur;
    return !b.needs_chauffeur; // Delivery only
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground animate-pulse">Loading Driver Portal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-black">
              LD
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide leading-none">{profile?.user_profiles?.full_name || 'Driver Portal'}</h1>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-widest text-primary">Designated Chauffeur</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveStep('field_booking')}
              className="p-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors flex items-center gap-1"
              title="Create Field Booking"
            >
              <Plus size={16} />
              <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">New Booking</span>
            </button>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
              title="Log Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        {activeStep === 'inspection' && selectedBooking && (
          <DriverInspectionForm
            booking={selectedBooking}
            type={inspectionType}
            onBack={() => {
              setActiveStep('dashboard');
              setSelectedBooking(null);
            }}
          />
        )}

        {activeStep === 'field_booking' && (
          <DriverFieldBooking
            onBack={() => setActiveStep('dashboard')}
          />
        )}

        {activeStep === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-card border border-border p-4 rounded-2xl flex flex-col justify-between">
                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Trips Completed</p>
                <div className="flex items-end justify-between mt-2">
                  <span className="text-2xl font-black">{profile?.total_trips || bookings.filter(b => b.status === 'completed').length || 0}</span>
                  <TrendingUp size={16} className="text-emerald-500 mb-1" />
                </div>
              </div>

              <div className="bg-card border border-border p-4 rounded-2xl flex flex-col justify-between">
                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">User Rating</p>
                <div className="flex items-end justify-between mt-2">
                  <span className="text-2xl font-black">{(Number(profile?.rating) || 0.0).toFixed(1)}</span>
                  <Star size={16} className="text-amber-500 fill-amber-500 mb-1" />
                </div>
              </div>

              <div className="bg-card border border-border p-4 rounded-2xl flex flex-col justify-between">
                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Active Jobs</p>
                <div className="flex items-end justify-between mt-2">
                  <span className="text-2xl font-black">{bookings.filter(b => bookingStatusIn(b.status, DRIVER_ACTIVE_JOB_STATUSES)).length}</span>
                  <Award size={16} className="text-primary mb-1" />
                </div>
              </div>

              <div className="bg-card border border-border p-4 rounded-2xl flex flex-col justify-between">
                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Earnings (Est)</p>
                <div className="flex items-end justify-between mt-2">
                  <span className="text-lg font-black truncate pr-1">KSh {(bookings.filter(b => b.status === 'completed' && b.needs_chauffeur).reduce((sum, b) => sum + Number(b.total_amount) * 0.15, 0) || 0).toLocaleString()}</span>
                  <CreditCard size={16} className="text-emerald-500 mb-1 shrink-0" />
                </div>
              </div>
            </div>

            {/* Tasks Filter Toggle */}
            <div className="bg-card border border-border rounded-xl p-1 flex">
              {(['all', 'delivery', 'chauffeur'] as TaskType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors capitalize ${
                    filterType === type ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {type === 'delivery' ? 'Deliveries' : type === 'chauffeur' ? 'Chauffeur' : 'All Tasks'}
                </button>
              ))}
            </div>

            {/* Tasks List */}
            <div className="space-y-4">
              <h2 className="text-lg font-black tracking-wide">Assigned Tasks Ledger</h2>
              {filteredBookings.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground">
                  <Calendar className="mx-auto text-muted-foreground/30 mb-3" size={32} />
                  <p className="font-bold text-sm">No tasks assigned currently</p>
                  <p className="text-xs mt-1 text-muted-foreground/80">Check back later or contact administrators.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredBookings.map(booking => {
                    const hasPre = booking.booking_inspections?.some((i: any) => i.type === 'pre_handover');
                    const hasPost = booking.booking_inspections?.some((i: any) => i.type === 'post_return');

                    return (
                      <div key={booking.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:border-primary/20 transition-all">
                        {/* Task Card Header */}
                        <div className="p-4 border-b border-border flex justify-between items-start gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                booking.needs_chauffeur ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20' : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                              }`}>
                                {booking.needs_chauffeur ? 'Chauffeur Job' : 'Delivery & Return'}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                booking.payment_status === 'paid' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'
                              }`}>
                                {booking.payment_status?.toUpperCase() || 'UNPAID'}
                              </span>
                            </div>
                            <h3 className="font-bold text-base mt-2">{booking.cars?.make} {booking.cars?.model}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5 uppercase font-mono font-bold tracking-wider">{booking.cars?.license_plate}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Scheduled dates</p>
                            <p className="text-xs font-bold mt-1 text-foreground">{booking.start_date} to {booking.end_date}</p>
                          </div>
                        </div>

                        {/* Task Card Body - Client Details */}
                        <div className="p-4 bg-muted/10 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Client Details</p>
                            <div className="flex items-center gap-2">
                              <User size={13} className="text-muted-foreground" />
                              <span className="font-bold">{booking.client?.full_name || booking.metadata?.guest_info?.full_name || 'Guest Client'}</span>
                            </div>
                            <div className="flex gap-4">
                              <a href={`tel:${booking.client?.phone_number || booking.metadata?.guest_info?.phone || ''}`} className="flex items-center gap-1.5 text-primary hover:underline font-bold">
                                <Phone size={12} /> Call
                              </a>
                              <a href={`https://wa.me/${booking.client?.phone_number || booking.metadata?.guest_info?.phone || ''}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-emerald-500 hover:underline font-bold">
                                <MessageSquare size={12} /> WhatsApp
                              </a>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Logistics Location</p>
                            <div className="flex items-start gap-1.5">
                              <MapPin size={13} className="text-muted-foreground mt-0.5 shrink-0" />
                              <span className="font-bold text-muted-foreground">{booking.pickup_location || 'Main Office Delivery'}</span>
                            </div>
                            {booking.pickup_location && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.pickup_location)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 text-primary hover:underline font-bold"
                              >
                                <Navigation size={12} /> Navigate
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Handover inspection controls */}
                        <div className="p-4 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3">
                          <div className="flex gap-4 text-[10px] font-bold text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <CheckCircle2 size={14} className={hasPre ? 'text-emerald-500' : 'text-muted-foreground/30'} />
                              <span>Handover: {hasPre ? 'Done' : 'Pending'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <CheckCircle2 size={14} className={hasPost ? 'text-emerald-500' : 'text-muted-foreground/30'} />
                              <span>Return Check: {hasPost ? 'Done' : 'Pending'}</span>
                            </div>
                          </div>

                          <div className="flex gap-2 w-full sm:w-auto">
                            <button
                              onClick={() => handleSOS(booking)}
                              className="flex-none px-4 py-2 bg-red-500/10 text-red-500 text-xs font-black uppercase tracking-wider rounded-xl hover:bg-red-500/20 transition-colors border border-red-500/20 flex items-center gap-2"
                              title="Report Emergency / Issue"
                            >
                              <AlertTriangle size={14} /> SOS
                            </button>
                            {!hasPre && (
                              <button
                                onClick={() => handleStartInspection(booking, 'pre_handover')}
                                className="flex-1 sm:flex-none px-4 py-2 bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider rounded-xl hover:bg-primary/90 transition-colors"
                              >
                                Start Handover
                              </button>
                            )}
                            {hasPre && !hasPost && (
                              <button
                                onClick={() => handleStartInspection(booking, 'post_return')}
                                className="flex-1 sm:flex-none px-4 py-2 bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider rounded-xl hover:bg-primary/90 transition-colors"
                              >
                                Start Return Checkout
                              </button>
                            )}
                            {hasPre && hasPost && (
                              <div className="text-emerald-500 text-xs font-black uppercase tracking-wider flex items-center gap-1 py-2">
                                <CheckCircle2 size={14} /> Completed Task
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
