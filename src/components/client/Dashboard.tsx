// @ts-nocheck
import React, { useEffect, useState, useMemo } from 'react';
import { clientService } from '../../services/clientService';
import { supabase } from '../../lib/supabase';
import { bookingService } from '../../services/bookingService';
import { toast } from 'sonner';
import {
  Phone, MapPin, Clock, ChevronRight, Calendar, FileText,
  Inbox, Award, Car, ShieldCheck, Loader2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getReturnDeadline } from '../../utils/rentalDeadline';

function formatCountdown(booking: { start_date?: string; end_date?: string; pickup_confirmed_at?: string } | null | undefined) {
  if (!booking) return '—';
  const deadline = getReturnDeadline(booking);
  if (!deadline) return '—';
  const diffMs = deadline.getTime() - Date.now();
  if (diffMs <= 0) return 'Ends today';
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `Ends in ${days} day${days === 1 ? '' : 's'}`;
  return `Ends in ${hours} hour${hours === 1 ? '' : 's'}`;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [counts, setCounts] = useState<any>({ bookingsCount: 0, bookingsActionRequired: 0, unreadInbox: 0 });
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [dashboard, sidebarCounts] = await Promise.all([
        clientService.getDashboardData(user.id),
        clientService.getSidebarCounts(user.id),
      ]);
      setData(dashboard);
      setCounts(sidebarCounts);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Realtime: refresh on any booking change for this user
    let channel: any = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      channel = supabase
        .channel(`client-dashboard-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `client_id=eq.${user.id}` }, load)
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const completion = useMemo(() => {
    const p = data?.profile;
    if (!p) return 0;
    const fields = ['full_name', 'email', 'phone_number', 'address', 'license_number', 'id_number'];
    const done = fields.filter(f => p[f]).length;
    return Math.round((done / fields.length) * 100);
  }, [data]);

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Cancel this booking? This cannot be undone.')) return;
    setCancellingId(bookingId);
    try {
      await bookingService.cancelBooking?.(bookingId);
      toast.success('Booking cancelled');
      await load();
    } catch (err: any) {
      // Fallback: direct update
      try {
        const { error } = await supabase
          .from('bookings')
          .update({ status: 'cancelled' })
          .eq('id', bookingId);
        if (error) throw error;
        toast.success('Booking cancelled');
        await load();
      } catch (e: any) {
        toast.error(e?.message || 'Failed to cancel');
      }
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-150">
      <h2 className="text-2xl font-bold">Quick-Drive Dashboard</h2>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Link to="/client/bookings" className="bg-card p-4 rounded-2xl border border-border hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between">
            <Car className="text-primary" size={18} />
            <span className="text-2xl font-black">{counts.bookingsCount}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Active / Upcoming</p>
        </Link>
        <Link to="/client/bookings" className="bg-card p-4 rounded-2xl border border-border hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between">
            <ShieldCheck className={counts.bookingsActionRequired > 0 ? 'text-error' : 'text-success'} size={18} />
            <span className={`text-2xl font-black ${counts.bookingsActionRequired > 0 ? 'text-error' : ''}`}>{counts.bookingsActionRequired}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Action Required</p>
        </Link>
        <Link to="/client/inbox" className="bg-card p-4 rounded-2xl border border-border hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between">
            <Inbox className="text-primary" size={18} />
            <span className="text-2xl font-black">{counts.unreadInbox}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Unread Messages</p>
        </Link>
        <Link to="/client/glovebox" className="bg-card p-4 rounded-2xl border border-border hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between">
            <FileText className="text-primary" size={18} />
            <span className="text-2xl font-black">{completion}%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Profile Complete</p>
        </Link>
      </div>

      {/* Active Rental Status */}
      {data?.activeBooking && (
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-4">
          <h3 className="text-lg font-semibold">Active Rental Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted rounded-xl">
              <p className="text-sm text-muted-foreground">Current Car</p>
              <p className="font-bold">{data.activeBooking.cars?.make} {data.activeBooking.cars?.model}</p>
              <p className="text-xs text-muted-foreground">{data.activeBooking.cars?.license_plate}</p>
            </div>
            <div className="p-4 bg-muted rounded-xl">
              <p className="text-sm text-muted-foreground">Pickup / Drop-off</p>
              <p className="font-bold">
                {new Date(data.activeBooking.start_date).toLocaleDateString()} – {new Date(data.activeBooking.end_date).toLocaleDateString()}
              </p>
            </div>
            <div className="p-4 bg-muted rounded-xl">
              <p className="text-sm text-muted-foreground">Countdown</p>
              <p className="font-bold text-primary">{formatCountdown(data.activeBooking)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate('/client/bookings')}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold"
            >
              <Calendar size={16} /> View Booking
            </button>
            <button
              onClick={() => navigate(`/client/inbox?action=extension&bookingId=${data.activeBooking.id}`)}
              className="flex items-center gap-2 px-4 py-2 bg-muted rounded-xl text-sm font-bold"
            >
              <Clock size={16} /> Request Extension
            </button>
            <button
              onClick={() => navigate('/client/inbox?action=support')}
              className="flex items-center gap-2 px-4 py-2 bg-muted rounded-xl text-sm font-bold"
            >
              <Phone size={16} /> Contact Support
            </button>
          </div>
        </div>
      )}

      {/* Upcoming Bookings */}
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Upcoming Bookings</h3>
          <Link to="/client/bookings" className="text-xs text-primary font-bold flex items-center gap-1">
            See all <ChevronRight size={14} />
          </Link>
        </div>
        {data?.upcomingBookings?.length > 0 ? (
          <div className="space-y-2">
            {data.upcomingBookings.slice(0, 4).map((b: any) => (
              <div key={b.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border border-border rounded-xl">
                <div>
                  <p className="font-semibold">{b.cars?.make} {b.cars?.model}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(b.start_date).toLocaleDateString()} – {new Date(b.end_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    to="/client/bookings"
                    className="px-4 py-2 bg-muted rounded-xl text-sm font-bold"
                  >
                    Details
                  </Link>
                  <button
                    onClick={() => handleCancel(b.id)}
                    disabled={cancellingId === b.id}
                    className="px-4 py-2 bg-error/10 text-error rounded-xl text-sm font-bold disabled:opacity-50"
                  >
                    {cancellingId === b.id ? 'Cancelling…' : 'Cancel'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No upcoming bookings. <Link to="/client/browse" className="text-primary font-bold">Browse cars</Link>.</p>
        )}
      </div>

      {/* Profile Completion & Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Profile Completion</h3>
          <div className="w-full bg-muted rounded-full h-4 mb-2">
            <div className="bg-primary h-4 rounded-full transition-all" style={{ width: `${completion}%` }} />
          </div>
          <p className="text-sm text-muted-foreground mb-4">Your profile is {completion}% complete for 1-click bookings.</p>
          <Link to="/client/glovebox" className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold">
            Complete Profile
          </Link>
        </div>

        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Recommended for You</h3>
          {data?.recommendations?.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {data.recommendations.map((car: any) => (
                <div key={car.id} className="min-w-[200px] p-4 border border-border rounded-xl">
                  <p className="font-semibold">{car.make} {car.model}</p>
                  <p className="text-sm text-muted-foreground mb-2">KES {Number(car.daily_rate || 0).toLocaleString()}/day</p>
                  <button
                    onClick={() => navigate(`/cars/${car.id}`)}
                    className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold"
                  >
                    Book Now
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No recommendations yet — <Link to="/client/browse" className="text-primary font-bold">browse cars</Link>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
