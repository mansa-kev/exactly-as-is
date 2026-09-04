import React, { useState, useEffect } from 'react';
import { reservationService } from '../../services/reservationService';
import { reservationPaymentService } from '../../services/reservationPaymentService';
import { supabase } from '../../lib/supabase';
import {
  Search,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  Calendar,
  User,
  Car,
  Loader2,
  AlertCircle,
  X,
  Trash2,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Mail,
  Phone,
  Clock,
  MapPin,
  PenTool,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { getReservationVehicleDisplay } from '../../utils/bookingVehicleDisplay';

type ReservationStatus = 'pending_payment' | 'reserved' | 'confirmed' | 'cancelled' | 'expired';
type JourneyTab = 'all' | 'pending_payment' | 'reserved' | 'confirmed' | 'converted' | 'cancelled' | 'expired';

interface Reservation {
  id: string;
  car_id?: string | null;
  vehicle_model_id?: string | null;
  client_id: string;
  start_date: string;
  end_date: string;
  reservation_fee: number;
  total_amount: number;
  status: ReservationStatus;
  payment_status: 'pending' | 'paid' | 'refunded' | 'failed';
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  notes?: string;
  expires_at: string;
  created_at: string;
  linked_booking_id?: string | null;
  latest_payment_request?: any;
  cars?: any;
  vehicle_model?: any;
  client?: any;
}

const TABS: { key: JourneyTab; label: string; icon: string; color: string }[] = [
  { key: 'all', label: 'All', icon: '📋', color: 'bg-primary text-primary-foreground border-primary' },
  { key: 'pending_payment', label: 'Pending Payment', icon: '💳', color: 'bg-amber-500 text-white border-amber-500' },
  { key: 'reserved', label: 'Reserved (Paid)', icon: '🔒', color: 'bg-indigo-500 text-white border-indigo-500' },
  { key: 'confirmed', label: 'Confirmed', icon: '✨', color: 'bg-purple-500 text-white border-purple-500' },
  { key: 'converted', label: 'Converted', icon: '🎉', color: 'bg-emerald-500 text-white border-emerald-500' },
  { key: 'cancelled', label: 'Cancelled', icon: '🚫', color: 'bg-red-500 text-white border-red-500' },
  { key: 'expired', label: 'Expired', icon: '⏳', color: 'bg-gray-500 text-white border-gray-500' },
];

const ReservationCard: React.FC<{
  reservation: Reservation;
  onViewDetails: () => void;
  onDelete: () => void;
  onUpdateStatus: (status: ReservationStatus) => void;
  onSyncPayment: () => void;
  onConvertToBooking: () => void;
  syncingId: string | null;
  preparingId: string | null;
}> = ({ reservation, onViewDetails, onDelete, onUpdateStatus, onSyncPayment, onConvertToBooking, syncingId, preparingId }) => {
  const clientName = reservation.contact_name || reservation.client?.full_name || 'Unknown';
  const clientInitials = clientName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const vehicleDisplay = getReservationVehicleDisplay(reservation, 'admin');
  const carLine = vehicleDisplay.modelLabel;
  const carSubline = vehicleDisplay.unitLabel ? `Unit: ${vehicleDisplay.unitLabel}` : null;
  const carImage =
    vehicleDisplay.imageUrl ||
    reservation.cars?.photos?.[0] ||
    reservation.cars?.primary_image_url ||
    reservation.vehicle_model?.primary_image_url ||
    (Array.isArray(reservation.vehicle_model?.gallery_urls) ? reservation.vehicle_model.gallery_urls[0] : undefined);

  const isConverted = !!reservation.linked_booking_id;
  const isPaid = reservation.payment_status === 'paid';

  const canSyncPayment = !isPaid && Boolean(reservation.latest_payment_request?.id);
  const canContinueToBooking = isPaid && ['reserved', 'confirmed'].includes(reservation.status) && !isConverted;
  const canConfirmReservation = isPaid && reservation.status === 'reserved' && !isConverted;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-colors shadow-sm flex flex-col group">
      {/* Top Section */}
      <div className="p-4 border-b border-border bg-muted/10 relative">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-black text-primary shrink-0">
              {clientInitials}
            </div>
            <div>
              <h3 className="font-black text-sm text-foreground truncate max-w-[150px]">{clientName}</h3>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">ID: {reservation.id.slice(0,8).toUpperCase()}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
             <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
               isConverted ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' :
               reservation.status === 'reserved' ? 'bg-indigo-500/15 text-indigo-500 border-indigo-500/30' :
               reservation.status === 'confirmed' ? 'bg-purple-500/15 text-purple-500 border-purple-500/30' :
               reservation.status === 'pending_payment' ? 'bg-amber-500/15 text-amber-500 border-amber-500/30' :
               'bg-muted text-muted-foreground border-border'
             }`}>
                {isConverted ? 'CONVERTED' : reservation.status.replace(/_/g, ' ')}
             </span>
             <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
               isPaid ? 'bg-green-500/15 text-green-500 border-green-500/30' : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
             }`}>
               {isPaid ? 'PAID ✓' : reservation.payment_status}
             </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
           {carImage ? (
              <img src={carImage} alt={carLine} className="w-16 h-12 rounded-lg object-cover border border-border" />
           ) : (
             <div className="w-16 h-12 rounded-lg bg-muted flex items-center justify-center border border-border">
               <Car size={16} className="text-muted-foreground" />
             </div>
           )}
           <div>
             <p className="text-sm font-bold">{carLine}</p>
             {carSubline && (
               <p className="text-[10px] text-muted-foreground font-mono">{carSubline}</p>
             )}
             <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
               <Calendar size={12} />
               {new Date(reservation.start_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })} - 
               {new Date(reservation.end_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
             </p>
           </div>
        </div>
      </div>

      {/* Financials Row */}
      <div className="grid grid-cols-2 divide-x divide-border border-b border-border bg-muted/5">
        <div className="p-3 text-center">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Reservation Fee</p>
          <p className="text-sm font-black text-warning mt-0.5">KES {reservation.reservation_fee?.toLocaleString()}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Total Amount</p>
          <p className="text-sm font-black text-foreground mt-0.5">KES {reservation.total_amount?.toLocaleString()}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 bg-card mt-auto flex flex-col gap-2">
         {/* Main Action Button */}
         {isConverted ? (
           <div className="flex items-center justify-center gap-2 py-2 bg-emerald-500/10 text-emerald-500 rounded-xl text-xs font-bold w-full mb-1">
             <CheckCircle2 size={14} /> Booking Created
           </div>
         ) : canConfirmReservation ? (
           <button onClick={() => onUpdateStatus('confirmed')} className="flex items-center justify-center gap-2 w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors mb-1">
             <CheckCircle2 size={14} /> Confirm Reservation
           </button>
         ) : canContinueToBooking ? (
           <button onClick={onConvertToBooking} disabled={preparingId === reservation.id} className="flex items-center justify-center gap-2 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors mb-1 disabled:opacity-50">
             {preparingId === reservation.id ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />} Continue to Booking
           </button>
         ) : canSyncPayment ? (
           <button onClick={onSyncPayment} disabled={syncingId === reservation.id} className="flex items-center justify-center gap-2 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors mb-1 disabled:opacity-50">
             {syncingId === reservation.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync Payment
           </button>
         ) : null}

         <div className="flex gap-2 w-full mt-1">
            <button onClick={onViewDetails} className="flex-1 flex items-center justify-center gap-2 p-2 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl text-xs font-bold transition-colors">
              <Eye size={14} /> Details
            </button>
            {!isConverted && ['pending_payment', 'reserved', 'confirmed'].includes(reservation.status) && (
              <button onClick={() => onUpdateStatus('cancelled')} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors" title="Cancel">
                <XCircle size={14} />
              </button>
            )}
            <button onClick={onDelete} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors" title="Delete">
              <Trash2 size={14} />
            </button>
         </div>
      </div>
    </div>
  );
};


export function AdminReservations() {
  const navigate = useNavigate();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<JourneyTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [syncingReservationId, setSyncingReservationId] = useState<string | null>(null);
  const [preparingBookingId, setPreparingBookingId] = useState<string | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Reservation | null>(null);
  const [generatedLinkModal, setGeneratedLinkModal] = useState<{ link: string, reservation: Reservation } | null>(null);

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const result = await reservationService.getAllReservations(page, pageSize);
      if (result) {
        setReservations(result.data || []);
        setTotalCount(result.count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch reservations:', error);
      toast.error('Failed to fetch reservations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, [page]);

  const filterByTab = (r: Reservation): boolean => {
    switch (activeTab) {
      case 'all': return true;
      case 'pending_payment': return r.status === 'pending_payment' && r.payment_status !== 'paid';
      case 'reserved': return r.status === 'reserved' && !r.linked_booking_id;
      case 'confirmed': return r.status === 'confirmed' && !r.linked_booking_id;
      case 'converted': return !!r.linked_booking_id;
      case 'cancelled': return r.status === 'cancelled';
      case 'expired': return r.status === 'expired';
      default: return true;
    }
  };

  const filteredReservations = reservations
    .filter(filterByTab)
    .filter(r => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const clientName = r.client?.full_name || r.contact_name || '';
      const vehicleDisplay = getReservationVehicleDisplay(r, 'admin');
      const carModel = `${vehicleDisplay.modelLabel} ${vehicleDisplay.unitLabel || ''}`;
      return r.id.toLowerCase().includes(q) || clientName.toLowerCase().includes(q) || carModel.toLowerCase().includes(q);
    });

  const tabCounts: Record<JourneyTab, number> = {
    all: reservations.length,
    pending_payment: reservations.filter(r => r.status === 'pending_payment' && r.payment_status !== 'paid').length,
    reserved: reservations.filter(r => r.status === 'reserved' && !r.linked_booking_id).length,
    confirmed: reservations.filter(r => r.status === 'confirmed' && !r.linked_booking_id).length,
    converted: reservations.filter(r => !!r.linked_booking_id).length,
    cancelled: reservations.filter(r => r.status === 'cancelled').length,
    expired: reservations.filter(r => r.status === 'expired').length,
  };

  const handleUpdateStatus = async (id: string, status: ReservationStatus) => {
    try {
      const { data: reservation, error: fetchError } = await supabase
        .from('car_reservations')
        .select('car_id')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('car_reservations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      if (status === 'cancelled' || status === 'expired') {
        if (reservation?.car_id) {
          await supabase
            .from('cars')
            .update({ status: 'available', updated_at: new Date().toISOString() })
            .eq('id', reservation.car_id);
        }
      }

      toast.success(`Reservation ${status} successfully`);
      fetchReservations();
    } catch (error) {
      toast.error('Failed to update reservation status');
    }
  };

  const handleDeleteReservation = async (reservation: Reservation) => {
    try {
      await reservationService.deleteReservation(reservation.id);
      toast.success('Reservation deleted successfully and car is now available!');
      fetchReservations();
      setDeleteConfirm(null);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete reservation');
    }
  };

  const handleSyncPayment = async (reservation: Reservation) => {
    try {
      setSyncingReservationId(reservation.id);
      const status = await reservationPaymentService.getPaymentStatus(reservation.id);
      const paymentRequest = reservation.latest_payment_request || status.paymentRequest;

      if (status.paid) {
        toast.success('Reservation payment is already confirmed.');
        await fetchReservations();
        return;
      }

      if (!paymentRequest?.id) throw new Error('No reservation payment request found.');

      const result = await reservationPaymentService.querySTKStatus(paymentRequest.id);

      if (result.paid) {
        toast.success('Reservation payment synced successfully.');
      } else if (result.failed) {
        toast.error(result.description || result.error || 'Reservation payment failed.');
      } else {
        toast.message(result.description || 'Reservation payment is still pending.');
      }
      fetchReservations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync reservation payment');
    } finally {
      setSyncingReservationId(null);
    }
  };

  const handleConvertToBooking = async (reservation: Reservation) => {
    try {
      setPreparingBookingId(reservation.id);
      const result = await reservationService.prepareBookingContinuation(reservation.id, 'admin', true);
      if (!result?.link) throw new Error('Booking continuation link could not be prepared');

      setGeneratedLinkModal({ link: result.link, reservation });
      fetchReservations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to prepare booking continuation');
    } finally {
      setPreparingBookingId(null);
    }
  };

  if (loading && reservations.length === 0) {
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
          <h1 className="text-2xl md:text-3xl font-black">Reservations Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Track and convert car reservations</p>
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
            onClick={() => navigate('/admin/reservation-concierge')}
            className="w-full sm:w-auto px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap"
          >
            <PenTool size={16} /> Reservation Concierge
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
      {filteredReservations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-muted/30 rounded-2xl flex items-center justify-center mb-4">
            <Calendar size={28} className="text-muted-foreground" />
          </div>
          <p className="text-lg font-bold text-foreground">No reservations found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {activeTab !== 'all' ? `No reservations in the "${TABS.find(t => t.key === activeTab)?.label}" stage` : 'No reservations match your search'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
          {filteredReservations.map(reservation => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              onViewDetails={() => setSelectedReservation(reservation)}
              onDelete={() => setDeleteConfirm(reservation)}
              onUpdateStatus={(status) => handleUpdateStatus(reservation.id, status)}
              onSyncPayment={() => handleSyncPayment(reservation)}
              onConvertToBooking={() => handleConvertToBooking(reservation)}
              syncingId={syncingReservationId}
              preparingId={preparingBookingId}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedReservation && (() => {
        const vehicle = getReservationVehicleDisplay(selectedReservation, 'admin');
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-border bg-muted/10">
              <div>
                <h2 className="text-xl font-black">Reservation Details</h2>
                <p className="text-xs font-mono text-muted-foreground mt-1">ID: {selectedReservation.id}</p>
              </div>
              <button onClick={() => setSelectedReservation(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/30 p-4 rounded-xl border border-border">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Status</p>
                    <p className="text-sm font-bold capitalize">{selectedReservation.status.replace('_', ' ')}</p>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-xl border border-border">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Payment Status</p>
                    <p className="text-sm font-bold capitalize">{selectedReservation.payment_status}</p>
                  </div>
               </div>

               <div>
                 <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2"><Car size={14} /> Vehicle & Dates</h3>
                 <div className="bg-muted/30 p-4 rounded-xl border border-border grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Vehicle</p>
                      <p className="text-sm font-bold">{vehicle.modelLabel}</p>
                      {vehicle.unitLabel && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          Unit: {vehicle.unitLabel}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Total Value</p>
                      <p className="text-sm font-black">KES {selectedReservation.total_amount?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Pick-up</p>
                      <p className="text-sm font-medium">{new Date(selectedReservation.start_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Drop-off</p>
                      <p className="text-sm font-medium">{new Date(selectedReservation.end_date).toLocaleDateString()}</p>
                    </div>
                 </div>
               </div>

               <div>
                 <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2"><User size={14} /> Client Details</h3>
                 <div className="bg-muted/30 p-4 rounded-xl border border-border grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Name</p>
                      <p className="text-sm font-bold">{selectedReservation.client?.full_name || selectedReservation.contact_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Email</p>
                      <p className="text-sm font-medium flex items-center gap-2"><Mail size={12}/> {selectedReservation.contact_email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Phone</p>
                      <p className="text-sm font-medium flex items-center gap-2"><Phone size={12}/> {selectedReservation.contact_phone}</p>
                    </div>
                 </div>
               </div>
               
               {selectedReservation.linked_booking_id && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1 flex items-center gap-2"><CheckCircle2 size={12} /> Converted to Booking</p>
                    <p className="text-sm font-mono text-emerald-700">{selectedReservation.linked_booking_id}</p>
                  </div>
               )}
            </div>
            <div className="p-4 border-t border-border bg-muted/10">
               <button onClick={() => setSelectedReservation(null)} className="w-full py-2.5 bg-card border border-border text-foreground rounded-xl font-bold hover:bg-muted transition-colors">Close</button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-6 text-center">
             <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
               <AlertCircle size={24} />
             </div>
             <h3 className="text-lg font-black mb-2">Delete Reservation?</h3>
             <p className="text-sm text-muted-foreground mb-6">This will permanently remove the reservation{deleteConfirm.car_id ? ' and release the assigned unit' : ''}. This action cannot be undone.</p>
             <div className="flex gap-3">
               <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl font-bold bg-muted hover:bg-muted/80 transition-colors">Cancel</button>
               <button onClick={() => handleDeleteReservation(deleteConfirm)} className="flex-1 py-2.5 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 transition-colors">Delete</button>
             </div>
          </div>
        </div>
      )}

      {/* Generated Link Share Modal */}
      {generatedLinkModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 p-6 text-center">
             <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
               <CheckCircle2 size={24} />
             </div>
             <h3 className="text-lg font-black mb-2">Booking Link Ready!</h3>
             <p className="text-sm text-muted-foreground mb-4">
               The client can use this link to upload their documents, sign the contract, and pay the remaining balance.
             </p>
             
             <div className="bg-muted/50 p-3 rounded-xl flex items-center gap-2 mb-6 text-left border border-border overflow-hidden">
               <span className="text-xs truncate text-muted-foreground flex-1 select-all">{generatedLinkModal.link}</span>
               <button 
                 onClick={() => {
                   navigator.clipboard.writeText(generatedLinkModal.link);
                   toast.success('Link copied to clipboard!');
                 }}
                 className="p-1.5 bg-card hover:bg-muted text-foreground rounded-lg border border-border shrink-0 transition-colors"
                 title="Copy Link"
               >
                 <Copy size={14} />
               </button>
             </div>

             <div className="flex gap-3">
               <button onClick={() => setGeneratedLinkModal(null)} className="flex-1 py-2.5 rounded-xl font-bold bg-muted hover:bg-muted/80 transition-colors text-sm">Close</button>
               <button 
                 onClick={() => {
                   const r = generatedLinkModal.reservation;
                   const phone = r.contact_phone || r.client?.phone_number || '';
                   const cleanPhone = phone.replace(/[^0-9]/g, '');
                   const message = `Hello ${r.contact_name || r.client?.full_name || ''}, your reservation is confirmed! Please use this secure link to upload your documents, sign the contract, and complete your booking payment: ${generatedLinkModal.link}`;
                   window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
                   setGeneratedLinkModal(null);
                 }} 
                 className="flex-1 py-2.5 rounded-xl font-bold bg-[#25D366] text-white hover:bg-[#20bd5a] transition-colors text-sm flex items-center justify-center gap-2"
               >
                 Share via WhatsApp
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
