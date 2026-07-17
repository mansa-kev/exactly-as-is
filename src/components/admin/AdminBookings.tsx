import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Eye, CheckCircle2, XCircle, Calendar, User, Car,
  Loader2, AlertCircle, X, CreditCard, Clock, Trash2, Phone,
  Flag, AlertTriangle, ChevronDown, ArrowRight, DollarSign,
  MapPin, Plus, FileText, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '../../utils/logger';
import { getBookingVehicleDisplay } from '../../utils/bookingVehicleDisplay';
import { bookingFromReservation } from '../../utils/bookingSource';

// No longer using separate countdown hooks per card to prevent performance bottlenecks.
// Real-time updates are driven by a single parent clock in the main component.

const formatTimeLeft = (ms: number) => {
  if (ms <= 0) return '00:00:00';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// --- Types ---
type BookingStatus = 'pending' | 'confirmed' | 'pending_collection' | 'on_trip' | 'returned' | 'completed' | 'cancelled' | 'pending_payment_verification';

type JourneyTab = 'all' | 'flagged' | 'pending_payment' | 'pending_collection' | 'in_transit' | 'returns_due' | 'overdue' | 'extended' | 'completed' | 'from_reservation';

interface Booking {
  id: string;
  client_id: string;
  car_id: string;
  driver_id?: string;
  fleet_owner_id: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  platform_commission: number;
  status: BookingStatus;
  payment_status: 'paid' | 'pending' | 'failed';
  document_status?: string;
  admin_notes?: string;
  is_flagged?: boolean;
  flag_reason?: string;
  sub_status?: string;
  pickup_confirmed_at?: string;
  return_confirmed_at?: string;
  return_condition?: string;
  overtime_hours?: number;
  overtime_charge?: number;
  created_at: string;
  client?: any;
  fleet_owner?: any;
  cars?: any;
  vehicle_model?: any;
  metadata?: any;
}

// --- Tab Config ---
const TABS: { key: JourneyTab; label: string; icon: string; color: string }[] = [
  { key: 'all', label: 'All', icon: '📋', color: 'bg-primary text-primary-foreground border-primary' },
  { key: 'flagged', label: 'Action Required', icon: '🚩', color: 'bg-red-600 text-white border-red-600' },
  { key: 'pending_payment', label: 'Pending Payment', icon: '💳', color: 'bg-amber-500 text-white border-amber-500' },
  { key: 'pending_collection', label: 'Pending Collection', icon: '🔑', color: 'bg-orange-500 text-white border-orange-500' },
  { key: 'in_transit', label: 'In Transit', icon: '🚗', color: 'bg-blue-500 text-white border-blue-500' },
  { key: 'returns_due', label: 'Returns Due', icon: '⏰', color: 'bg-yellow-500 text-black border-yellow-500' },
  { key: 'overdue', label: 'Overdue', icon: '🚨', color: 'bg-red-700 text-white border-red-700' },
  { key: 'extended', label: 'Extended', icon: '📅', color: 'bg-purple-500 text-white border-purple-500' },
  { key: 'completed', label: 'Completed', icon: '✅', color: 'bg-gray-500 text-white border-gray-500' },
  { key: 'from_reservation', label: 'From Reservation', icon: '📝', color: 'bg-emerald-500 text-white border-emerald-500' },
];

// --- Status Badge ---
const StatusBadge = ({ status, is_flagged }: { status: BookingStatus; is_flagged?: boolean }) => {
  const styles: Record<string, string> = {
    pending: 'bg-warning/15 text-warning border-warning/30',
    confirmed: 'bg-success/15 text-success border-success/30',
    pending_collection: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    on_trip: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    returned: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    completed: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
    cancelled: 'bg-error/15 text-error border-error/30',
    pending_payment_verification: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  };

  return (
    <div className="flex items-center gap-1.5">
      {is_flagged && <Flag size={10} className="text-red-500" />}
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[status] || styles.pending}`}>
        {status.replace(/_/g, ' ')}
      </span>
    </div>
  );
};

// --- Booking Card ---
const BookingCard: React.FC<{
  booking: Booking;
  now: number;
  onManage: () => void;
  onViewDetails: () => void;
  onDelete: () => void;
  onSyncPayment?: () => void;
  isSyncing?: boolean;
}> = ({ booking, now, onManage, onViewDetails, onDelete, onSyncPayment, isSyncing }) => {
  const clientName = booking.client?.full_name || booking.metadata?.guest_info?.full_name || 'Guest';
  const clientInitials = clientName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const vehicle = getBookingVehicleDisplay(booking, 'admin');
  const carLine = vehicle.modelLabel;
  const carImage = booking.vehicle_model?.primary_image_url || booking.cars?.photos?.[0] || booking.cars?.primary_image_url;
  const totalPaid = booking.payment_status === 'paid' ? booking.total_amount : 0;
  const balance = booking.total_amount - totalPaid;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const endDate = new Date(booking.end_date);
  endDate.setHours(23, 59, 59, 999);

  // Real-time Countdown logic calculated from a single parent clock
  const timeLeftMs = endDate.getTime() - now;
  const pickupAt = booking.pickup_confirmed_at ? new Date(booking.pickup_confirmed_at) : null;
  const elapsedSincePickupMs = pickupAt ? Math.max(0, now - pickupAt.getTime()) : null;
  const isOverdue = booking.status === 'on_trip' && timeLeftMs <= 0;
  const isLessThanAnHour = booking.status === 'on_trip' && timeLeftMs > 0 && timeLeftMs <= 3600000;
  const isApproaching = booking.status === 'on_trip' && timeLeftMs > 3600000 && timeLeftMs <= 10800000; // < 3 hours

  return (
    <div className={`bg-card rounded-2xl border overflow-hidden transition-all hover:shadow-lg hover:border-primary/30 group ${
      booking.is_flagged ? 'border-red-500/40 shadow-red-500/5' : isOverdue ? 'border-red-600/30' : 'border-border'
    }`}>
      {/* Flag Banner */}
      {booking.is_flagged && (
        <div className="px-4 py-1.5 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2">
          <Flag size={10} className="text-red-500" />
          <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Flagged</span>
          {booking.flag_reason && <span className="text-[10px] text-red-400 truncate">· {booking.flag_reason}</span>}
        </div>
      )}

      {/* Card Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {clientInitials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{clientName}</p>
              <p className="text-[11px] text-muted-foreground font-mono">#{booking.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
          <StatusBadge status={booking.status} is_flagged={booking.is_flagged} />
        </div>
      </div>

      {/* Car Info */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-3 bg-muted/30 rounded-xl p-2.5">
          {carImage ? (
            <img src={carImage} alt={carLine} className="w-14 h-10 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-14 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Car size={16} className="text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground truncate">{vehicle.label}</p>
            {vehicle.unitLabel && (
              <p className="text-[10px] text-muted-foreground font-mono truncate">Unit: {vehicle.unitLabel}</p>
            )}
            <p className="text-[10px] text-muted-foreground">
              {new Date(booking.start_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })} → {new Date(booking.end_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Live Timer for In Transit */}
      {booking.status === 'on_trip' && (
        <div className="px-4 pb-3 space-y-2">
          <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
            isOverdue ? 'bg-red-500/10 border-red-500/30 text-red-500' :
            isLessThanAnHour ? 'bg-red-500/10 border-red-500 animate-pulse text-red-500' :
            isApproaching ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400' :
            'bg-blue-500/10 border-blue-500/30 text-blue-500'
          }`}>
            <div className="flex items-center gap-2">
              <Clock size={14} className={isLessThanAnHour ? 'animate-bounce' : ''} />
              <span className="text-xs font-bold uppercase tracking-wider">
                {isOverdue ? 'Return Overdue' : pickupAt ? 'Time Remaining' : 'Awaiting Pickup'}
              </span>
            </div>
            <span className="font-mono font-black text-sm">
              {pickupAt ? (isOverdue ? '00:00:00' : formatTimeLeft(timeLeftMs)) : '—'}
            </span>
          </div>
          {pickupAt && elapsedSincePickupMs != null && (
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider px-1">
              On trip for {formatTimeLeft(elapsedSincePickupMs)}
            </p>
          )}
        </div>
      )}

      {/* Financials */}
      <div className="px-4 pb-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Total</p>
          <p className="text-sm font-black text-foreground">KES {booking.total_amount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Balance</p>
          <p className={`text-sm font-black ${balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
            {balance > 0 ? `KES ${balance.toLocaleString()}` : 'Paid ✓'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex gap-2">
        {booking.payment_status !== 'paid' && booking.status !== 'cancelled' && onSyncPayment && (
          <button
            onClick={onSyncPayment}
            disabled={isSyncing}
            className="p-2.5 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl text-amber-500 transition-colors disabled:opacity-50"
            title="Sync NCBA payment"
          >
            {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        )}
        <button
          onClick={onManage}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors"
        >
          Manage Booking <ArrowRight size={12} />
        </button>
        <button
          onClick={onViewDetails}
          className="p-2.5 bg-muted/50 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors"
          title="View Details"
        >
          <Eye size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-2.5 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-400 hover:text-red-500 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// --- Main Component ---
export function AdminBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<JourneyTab>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<Booking | null>(null);
  const [syncingBookingId, setSyncingBookingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // A single timer for the entire bookings list, only running if there are bookings currently on trip.
  useEffect(() => {
    const hasOnTripBookings = bookings.some((b) => b.status === 'on_trip');
    if (!hasOnTripBookings) return;

    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(intervalId);
  }, [bookings]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const result = await adminService.getBookings(page, pageSize);
      if (result && 'data' in result) {
        setBookings(result.data || []);
        setTotalCount(result.count || 0);
      }
    } catch (error: any) {
      logger.error('Failed to fetch bookings:', error);
      toast.error(`Failed to fetch bookings: ${error?.message || error?.code || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, [page]);

  const handleDeleteBooking = async (booking: Booking) => {
    try {
      const result = await adminService.deleteBooking(booking.id);
      if (result !== undefined) {
        toast.success('Booking deleted successfully');
        fetchBookings();
        setDeleteConfirm(null);
      } else {
        toast.error('Failed to delete booking');
      }
    } catch (error) {
      logger.error('Error deleting booking:', error);
      toast.error('Failed to delete booking');
    }
  };

  // --- Filtering ---
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const filterByTab = (b: Booking): boolean => {
    switch (activeTab) {
      case 'all': return true;
      case 'flagged': return !!b.is_flagged;
      case 'pending_payment': return b.payment_status !== 'paid' && b.status !== 'cancelled';
      case 'pending_collection': return (b.status === 'confirmed' || b.status === 'pending_collection') && b.payment_status === 'paid';
      case 'in_transit': return b.status === 'on_trip' && new Date(b.end_date) >= today;
      case 'returns_due': return b.status === 'on_trip' && new Date(b.end_date) >= today && new Date(b.end_date) < tomorrow;
      case 'overdue': return b.status === 'on_trip' && new Date(b.end_date) < today;
      case 'extended': return b.sub_status === 'extended';
      case 'completed': return b.status === 'completed' || b.status === 'returned';
      case 'from_reservation': return bookingFromReservation(b);
      default: return true;
    }
  };

  const filteredBookings = bookings
    .filter(filterByTab)
    .filter(b => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const name = b.client?.full_name || b.metadata?.guest_info?.full_name || '';
      return b.id.toLowerCase().includes(q) || name.toLowerCase().includes(q);
    });

  // --- Tab Counts ---
  const tabCounts: Record<JourneyTab, number> = {
    all: bookings.length,
    flagged: bookings.filter(b => !!b.is_flagged).length,
    pending_payment: bookings.filter(b => b.payment_status !== 'paid' && b.status !== 'cancelled').length,
    pending_collection: bookings.filter(b => (b.status === 'confirmed' || b.status === 'pending_collection') && b.payment_status === 'paid').length,
    in_transit: bookings.filter(b => b.status === 'on_trip' && new Date(b.end_date) >= today).length,
    returns_due: bookings.filter(b => b.status === 'on_trip' && new Date(b.end_date) >= today && new Date(b.end_date) < tomorrow).length,
    overdue: bookings.filter(b => b.status === 'on_trip' && new Date(b.end_date) < today).length,
    extended: bookings.filter(b => b.sub_status === 'extended').length,
    completed: bookings.filter(b => b.status === 'completed' || b.status === 'returned').length,
    from_reservation: bookings.filter((b) => bookingFromReservation(b)).length,
  };

  const handleManageBooking = (booking: Booking) => {
    navigate(`/admin/bookings/${booking.id}`);
  };

  const handleSyncPayment = async (booking: Booking) => {
    setSyncingBookingId(booking.id);
    try {
      const result = await adminService.syncPaymentByBookingId(booking.id);
      if (result.paid) {
        toast.success('Payment confirmed via NCBA');
        fetchBookings();
      } else if (result.failed) {
        toast.error(result.description || 'Payment not completed at NCBA');
      } else {
        toast.message(result.description || 'Payment still pending at NCBA');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync NCBA payment');
    } finally {
      setSyncingBookingId(null);
    }
  };

  if (loading && bookings.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black">Bookings Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Track every booking through its complete journey</p>
        </div>
        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name or ID..."
              className="w-full pl-9 pr-3 py-2.5 bg-muted/30 border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <button
            onClick={() => navigate('/admin/concierge-booking')}
            className="w-full sm:w-auto px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap"
          >
            <Calendar size={16} /> New Concierge Booking
          </button>
        </div>
      </div>

      {/* Journey Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              activeTab === tab.key ? tab.color + ' shadow-sm' : 'bg-card text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tabCounts[tab.key] > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === tab.key ? 'bg-white/20' : 'bg-muted text-muted-foreground'
              }`}>{tabCounts[tab.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Card Grid */}
      {filteredBookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-muted/30 rounded-2xl flex items-center justify-center mb-4">
            <Calendar size={28} className="text-muted-foreground" />
          </div>
          <p className="text-lg font-bold text-foreground">No bookings found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {activeTab !== 'all' ? `No bookings in the "${TABS.find(t => t.key === activeTab)?.label}" stage` : 'No bookings match your search'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredBookings.map((booking: Booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              now={now}
              onManage={() => handleManageBooking(booking)}
              onViewDetails={() => handleManageBooking(booking)}
              onDelete={() => { setDeleteConfirm(booking); }}
              onSyncPayment={() => handleSyncPayment(booking)}
              isSyncing={syncingBookingId === booking.id}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-error/10">
                <AlertCircle className="w-6 h-6 text-error" />
              </div>
              <h3 className="text-lg font-black text-center mb-2">Delete Booking</h3>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Are you sure? This action cannot be undone and all related data will be permanently lost.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold border border-border bg-card hover:bg-muted transition-colors text-sm">
                  Cancel
                </button>
                <button onClick={() => handleDeleteBooking(deleteConfirm)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold bg-error text-white hover:bg-error/90 transition-colors text-sm">
                  Delete Forever
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
