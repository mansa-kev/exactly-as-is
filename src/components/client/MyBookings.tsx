import React, { useEffect, useState, useCallback } from 'react';
import { clientService } from '../../services/clientService';
import { supabase } from '../../lib/supabase';
import { bookingService } from '../../services/bookingService';
import { Search, Calendar, Car, Clock, CheckCircle, XCircle, RefreshCw, FileText, CreditCard, Phone, AlertTriangle, Upload, X, Loader2, CheckCircle2, MapPin, DollarSign, Star, MessageSquare, Send } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { isOnTripStatus } from '../../constants/bookingStatuses';
import { openBookingReceiptPdf } from '../../services/receiptPdfService';
import { fleetService } from '../../services/fleetService';
import { toProxiedAssetUrl } from '../../utils/assetUrl';
import { getBookingVehicleDisplay } from '../../utils/bookingVehicleDisplay';
import { getBookingRebookPath } from '../../utils/bookingSource';
import { generateVehicleSlug } from '../../utils/urlUtils';

type DocType = 'facePhoto' | 'licenseFront' | 'licenseBack' | 'idFront' | 'idBack';

const DOC_LABELS: Record<DocType, string> = {
  facePhoto:    'Face / Passport Photo',
  licenseFront: 'License Front',
  licenseBack:  'License Back',
  idFront:      'ID Front',
  idBack:       'ID Back',
};

export function MyBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [detailsBooking, setDetailsBooking] = useState<any | null>(null);

  // Resubmission modal state
  const [resubmitBooking, setResubmitBooking] = useState<any | null>(null);
  const [resubmitDocs, setResubmitDocs] = useState<Record<DocType, string>>({
    facePhoto: '', licenseFront: '', licenseBack: '', idFront: '', idBack: ''
  });
  const [uploadingDoc, setUploadingDoc] = useState<DocType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [receiptLoadingId, setReceiptLoadingId] = useState<string | null>(null);
  const [reviewByBookingId, setReviewByBookingId] = useState<Record<string, { status: string; rating: number }>>({});
  const [reviewBooking, setReviewBooking] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      channel = supabase
        .channel(`my-bookings-${user.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `client_id=eq.${user.id}`,
        }, () => { fetchBookings(); })
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const fetchBookings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const data = await clientService.getAllBookings(user.id);
        setBookings(data || []);
        const completedIds = (data || []).filter((b: any) => b.status === 'completed').map((b: any) => b.id);
        const reviews = await clientService.getReviewsForBookings(user.id, completedIds);
        const map: Record<string, { status: string; rating: number }> = {};
        reviews.forEach((r: any) => {
          if (r.booking_id) map[r.booking_id] = { status: r.status, rating: r.rating };
        });
        setReviewByBookingId(map);
      }
    } catch (err) {
      console.error("Error fetching bookings:", err);
    } finally {
      setLoading(false);
    }
  };

  const openReviewModal = (booking: any) => {
    setReviewBooking(booking);
    setReviewRating(0);
    setReviewHover(0);
    setReviewComment('');
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewRating) return toast.error('Please select a rating');
    if (!reviewComment.trim()) return toast.error('Please write a comment');
    if (!reviewBooking) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSubmittingReview(true);
    try {
      await fleetService.submitReview({
        booking_id: reviewBooking.id,
        car_id: reviewBooking.car_id,
        user_id: user.id,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setReviewByBookingId(prev => ({
        ...prev,
        [reviewBooking.id]: { status: 'pending', rating: reviewRating },
      }));
      setReviewBooking(null);
      toast.success('Review submitted! It will appear on the website after admin approval.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleUploadDoc = useCallback(async (file: File, type: DocType, bookingId: string) => {
    setUploadingDoc(type);
    try {
      const url = await bookingService.uploadDocument(file, type, bookingId);
      setResubmitDocs(prev => ({ ...prev, [type]: url }));
      toast.success(`${DOC_LABELS[type]} uploaded`);
    } catch (err) {
      toast.error(`Failed to upload ${DOC_LABELS[type]}`);
    } finally {
      setUploadingDoc(null);
    }
  }, []);

  const handleResubmitDocuments = async () => {
    if (!resubmitBooking) return;
    const hasAny = Object.values(resubmitDocs).some(v => v);
    if (!hasAny) {
      toast.error('Please upload at least one document before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const existing = resubmitBooking.metadata?.documents || {};
      const updated = {
        facePhotoUrl:    resubmitDocs.facePhoto    || existing.facePhotoUrl    || null,
        licenseFrontUrl: resubmitDocs.licenseFront || existing.licenseFrontUrl || null,
        licenseBackUrl:  resubmitDocs.licenseBack  || existing.licenseBackUrl  || null,
        idFrontUrl:      resubmitDocs.idFront      || existing.idFrontUrl      || null,
        idBackUrl:       resubmitDocs.idBack       || existing.idBackUrl       || null,
      };

      const { error } = await supabase
        .from('bookings')
        .update({
          document_status: 'resubmitted',
          metadata: { ...resubmitBooking.metadata, documents: updated },
          updated_at: new Date().toISOString()
        })
        .eq('id', resubmitBooking.id);

      if (error) throw error;

      toast.success('Documents resubmitted! The admin will review them shortly.');
      setResubmitBooking(null);
      setResubmitDocs({ facePhoto: '', licenseFront: '', licenseBack: '', idFront: '', idBack: '' });
      fetchBookings();
    } catch (err) {
      toast.error('Failed to submit documents. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    setCancelling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', bookingId)
        .eq('client_id', user?.id);

      if (error) throw error;

      if (user) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'booking_cancelled',
          title: 'Booking Cancelled',
          content: `Your booking #${bookingId} has been cancelled as requested. Contact support if you need a refund.`,
          link: `/booking-confirmation/${bookingId}`,
          is_read: false,
          created_at: new Date().toISOString(),
        });
      }

      toast.success('Booking cancelled successfully.');
      setCancelConfirmId(null);
      fetchBookings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel booking. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const openContract = async (booking: any) => {
    // 1. metadata fallback (legacy)
    const legacy = booking.metadata?.contract_url;
    if (legacy) {
      const proxied = toProxiedAssetUrl(legacy) || legacy;
      window.open(proxied, '_blank', 'noopener,noreferrer');
      return;
    }
    // 2. e_contracts table
    try {
      const { data, error } = await supabase
        .from('e_contracts')
        .select('pdf_url')
        .eq('booking_id', booking.id)
        .order('signed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data?.pdf_url) {
        const proxied = toProxiedAssetUrl(data.pdf_url) || data.pdf_url;
        window.open(proxied, '_blank', 'noopener,noreferrer');
        return;
      }
      toast.error('Contract not available yet. It will appear once signed.');
    } catch {
      toast.error('Unable to load contract.');
    }
  };

  const openReceipt = async (booking: any) => {
    const legacy = booking.metadata?.receipt_url;
    if (legacy) { window.open(legacy, '_blank'); return; }

    if (booking.payment_status !== 'paid') {
      toast.error('Receipt is available after payment is completed.');
      return;
    }

    setReceiptLoadingId(booking.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let profile: { full_name?: string; email?: string; phone_number?: string } | null = null;
      if (user) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('full_name, email, phone_number')
          .eq('id', user.id)
          .maybeSingle();
        profile = profileData;
      }

      const { data: transaction, error } = await supabase
        .from('transactions')
        .select('amount, transaction_code, created_at, type, status')
        .eq('booking_id', booking.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      await openBookingReceiptPdf(
        { ...booking, client: profile },
        transaction
      );
    } catch (err: any) {
      console.error('Receipt error:', err);
      toast.error(err?.message || 'Unable to generate receipt.');
    } finally {
      setReceiptLoadingId(null);
    }
  };

  const filteredBookings = bookings.filter(b => {
    if (!b.cars) return false;
    const matchesFilter =
      filter === 'all' ||
      b.status === filter ||
      (filter === 'on_trip' && isOnTripStatus(b.status));
    const carLabel = getBookingVehicleDisplay(b, 'client').modelLabel.toLowerCase();
    const matchesSearch = !searchTerm || carLabel.includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-xs font-bold">Confirmed</span>;
      case 'on_trip':
      case 'in_progress':
        return <span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-xs font-bold">On Trip</span>;
      case 'pending_collection':
        return <span className="px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-xs font-bold">Pending Collection</span>;
      case 'completed':
        return <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">Completed</span>;
      case 'cancelled':
        return <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-xs font-bold">Cancelled</span>;
      default:
        return <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs font-bold">{status}</span>;
    }
  };

  if (loading) return <div className="p-8">Loading your bookings...</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">My Bookings</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input 
              type="text" 
              placeholder="Search car..." 
              className="pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="px-4 py-2 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="on_trip">On Trip</option>
            <option value="pending_collection">Pending Collection</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredBookings.length > 0 ? (
          filteredBookings.map((booking) => (
            <div key={booking.id} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              {/* Document resubmission alert banner */}
              {booking.document_status === 'resubmission_required' && (
                <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                    <p className="text-sm font-bold text-amber-500">
                      Action Required: Your documents were rejected. Please resubmit.
                      {booking.admin_notes && <span className="font-normal text-amber-400/80 ml-1">Reason: {booking.admin_notes}</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setResubmitBooking(booking);
                      setResubmitDocs({ facePhoto: '', licenseFront: '', licenseBack: '', idFront: '', idBack: '' });
                    }}
                    className="shrink-0 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition-colors flex items-center gap-1.5"
                  >
                    <Upload size={12} /> Resubmit Documents
                  </button>
                </div>
              )}
              {booking.document_status === 'resubmitted' && (
                <div className="px-6 py-2 bg-blue-500/10 border-b border-blue-500/30 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-blue-400" />
                  <p className="text-xs font-bold text-blue-400">Documents resubmitted — awaiting admin review</p>
                </div>
              )}

              <div className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Car Info */}
                  {(() => {
                    const vehicle = getBookingVehicleDisplay(booking, 'client');
                    return (
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-muted rounded-xl flex items-center justify-center overflow-hidden">
                      {vehicle.imageUrl ? (
                        <img src={vehicle.imageUrl} alt={vehicle.modelLabel} className="w-full h-full object-cover" />
                      ) : (
                        <Car className="text-muted-foreground" size={32} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg">{vehicle.modelLabel}</h3>
                        {getStatusBadge(booking.status)}
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar size={14} /> {new Date(booking.start_date).toLocaleDateString()} - {new Date(booking.end_date).toLocaleDateString()}
                      </p>
                      {vehicle.clientSubtitle && (
                        <p className="text-xs text-muted-foreground mt-1">{vehicle.clientSubtitle}</p>
                      )}
                    </div>
                  </div>
                    );
                  })()}

                  {/* Financial Summary */}
                  <div className="flex flex-col lg:items-end">
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-xl font-bold text-primary">KES {booking.total_amount.toLocaleString()}</p>
                    <p className={`text-xs font-medium mt-1 ${booking.payment_status === 'paid' ? 'text-green-500' : 'text-yellow-500'}`}>
                      Payment: {booking.payment_status?.toUpperCase() || 'N/A'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setDetailsBooking(booking)}
                      className="flex-1 sm:flex-none px-4 py-2 bg-muted hover:bg-muted/80 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    >
                      <FileText size={16} /> Details
                    </button>
                    
                    {booking.document_status === 'resubmission_required' && (
                      <button
                        onClick={() => {
                          setResubmitBooking(booking);
                          setResubmitDocs({ facePhoto: '', licenseFront: '', licenseBack: '', idFront: '', idBack: '' });
                        }}
                        className="flex-1 sm:flex-none px-4 py-2 bg-amber-500 text-white hover:bg-amber-600 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                      >
                        <Upload size={16} /> Resubmit Docs
                      </button>
                    )}

                    {booking.is_reservation && booking.status === 'pending_payment' && (
                      <button
                        onClick={() => {
                          const url = `/vehicles/${generateVehicleSlug({id: booking.vehicle_model_id, friendly_id: booking.vehicle_model?.friendly_id, family_slug: booking.vehicle_model?.family_slug, make: booking.cars?.make, model: booking.cars?.model})}?booking=true&reservationToken=${booking.booking_completion_token || booking.id}`;
                          window.location.href = url;
                        }}
                        className="flex-1 sm:flex-none px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                      >
                        Complete Payment
                      </button>
                    )}

                    {booking.status === 'confirmed' && (
                      cancelConfirmId === booking.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Confirm cancel?</span>
                          <button
                            onClick={() => handleCancelBooking(booking.id)}
                            disabled={cancelling}
                            className="px-3 py-2 bg-error text-white rounded-xl text-xs font-bold hover:bg-error/90 transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            {cancelling ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Yes, Cancel
                          </button>
                          <button
                            onClick={() => setCancelConfirmId(null)}
                            className="px-3 py-2 bg-muted text-muted-foreground rounded-xl text-xs font-bold hover:bg-muted/80 transition-colors"
                          >
                            Keep
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setCancelConfirmId(booking.id)}
                          className="flex-1 sm:flex-none px-4 py-2 bg-error/10 text-error hover:bg-error/20 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                        >
                          <XCircle size={16} /> Cancel
                        </button>
                      )
                    )}

                    {isOnTripStatus(booking.status) && (
                      <>
                        <button
                          onClick={() => navigate(`/client/inbox?action=extension&bookingId=${booking.id}`)}
                          className="flex-1 sm:flex-none px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                        >
                          <Clock size={16} /> Extend
                        </button>
                        <button
                          onClick={() => navigate(`/client/inbox?action=support&bookingId=${booking.id}`)}
                          className="flex-1 sm:flex-none px-4 py-2 bg-muted hover:bg-muted/80 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                        >
                          <Phone size={16} /> Support
                        </button>
                      </>
                    )}

                    {booking.status === 'completed' && (
                      <>
                        {!reviewByBookingId[booking.id] ? (
                          <button
                            onClick={() => openReviewModal(booking)}
                            className="flex-1 sm:flex-none px-4 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                          >
                            <Star size={16} /> Leave Review
                          </button>
                        ) : (
                          <span className="flex-1 sm:flex-none px-4 py-2 bg-muted rounded-xl text-xs font-bold text-muted-foreground flex items-center justify-center gap-2">
                            <Star size={14} className="text-amber-400 fill-amber-400" />
                            Review {reviewByBookingId[booking.id].status === 'approved' ? 'published' : 'pending approval'}
                          </span>
                        )}
                        <button
                          onClick={() => navigate(getBookingRebookPath(booking))}
                          className="flex-1 sm:flex-none px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                        >
                          <RefreshCw size={16} /> Re-book
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Footer Links */}
              <div className="px-6 py-3 bg-muted/30 border-t border-border flex flex-wrap gap-4 text-xs font-medium text-muted-foreground">
                <button onClick={() => openContract(booking)} className="hover:text-primary flex items-center gap-1">
                  <FileText size={14} /> View Contract
                </button>
                <button
                  onClick={() => openReceipt(booking)}
                  disabled={receiptLoadingId === booking.id}
                  className="hover:text-primary flex items-center gap-1 disabled:opacity-50"
                >
                  {receiptLoadingId === booking.id ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                  View Receipt
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-card rounded-2xl border border-dashed border-border">
            <Car className="mx-auto text-muted-foreground mb-4" size={48} />
            <p className="text-muted-foreground font-medium">No bookings found matching your criteria.</p>
            <button onClick={() => navigate('/cars')} className="mt-4 text-primary font-bold hover:underline">Browse Cars</button>
          </div>
        )}
      </div>

      {/* Document Resubmission Modal */}
      {resubmitBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="font-bold text-lg">Resubmit Documents</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Your payment is verified. Upload correct documents to proceed.</p>
              </div>
              <button onClick={() => setResubmitBooking(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X size={16} />
              </button>
            </div>

            {resubmitBooking.admin_notes && (
              <div className="mx-5 mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <p className="text-xs text-amber-500 font-bold">Rejection reason: <span className="font-normal">{resubmitBooking.admin_notes}</span></p>
              </div>
            )}

            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {(Object.keys(DOC_LABELS) as DocType[]).map((type) => {
                const uploaded = resubmitDocs[type];
                const isUploading = uploadingDoc === type;
                return (
                  <div key={type} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border">
                    <div className="flex items-center gap-3">
                      {uploaded ? (
                        <CheckCircle2 size={16} className="text-success shrink-0" />
                      ) : (
                        <FileText size={16} className="text-muted-foreground shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{DOC_LABELS[type]}</p>
                        {uploaded && <p className="text-xs text-success">Uploaded ✓</p>}
                      </div>
                    </div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        disabled={isUploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadDoc(file, type, resubmitBooking.id);
                        }}
                      />
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                        isUploading
                          ? 'bg-muted text-muted-foreground'
                          : uploaded
                          ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}>
                        {isUploading ? <><Loader2 size={12} className="animate-spin" /> Uploading...</> : uploaded ? 'Replace' : <><Upload size={12} /> Upload</>}
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>

            <div className="p-5 border-t border-border flex gap-3">
              <button
                onClick={() => setResubmitBooking(null)}
                className="flex-1 px-4 py-2 bg-muted rounded-xl text-sm font-bold hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResubmitDocuments}
                disabled={submitting || !Object.values(resubmitDocs).some(v => v)}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting...</> : 'Submit Documents'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      {detailsBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => setDetailsBooking(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="font-bold text-lg">Booking Details</h3>
                <p className="text-xs text-muted-foreground mt-0.5">#{String(detailsBooking.id).slice(0, 8)}</p>
              </div>
              <button onClick={() => setDetailsBooking(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
                <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                  {(() => {
                    const vehicle = getBookingVehicleDisplay(detailsBooking, 'client');
                    return vehicle.imageUrl
                      ? <img src={vehicle.imageUrl} alt="" className="w-full h-full object-cover" />
                      : <Car className="text-muted-foreground" size={24} />;
                  })()}
                </div>
                <div>
                  {(() => {
                    const vehicle = getBookingVehicleDisplay(detailsBooking, 'client');
                    return (
                      <>
                        <p className="font-bold">{vehicle.modelLabel}</p>
                        {vehicle.clientSubtitle && (
                          <p className="text-xs text-muted-foreground">{vehicle.clientSubtitle}</p>
                        )}
                      </>
                    );
                  })()}
                  <div className="mt-1">{getStatusBadge(detailsBooking.status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-muted/30 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Calendar size={10} /> Pickup</p>
                  <p className="font-medium mt-1">{new Date(detailsBooking.start_date).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Calendar size={10} /> Drop-off</p>
                  <p className="font-medium mt-1">{new Date(detailsBooking.end_date).toLocaleString()}</p>
                </div>
                {detailsBooking.pickup_location && (
                  <div className="p-3 bg-muted/30 rounded-xl col-span-2">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><MapPin size={10} /> Pickup Location</p>
                    <p className="font-medium mt-1">{detailsBooking.pickup_location}</p>
                  </div>
                )}
                <div className="p-3 bg-muted/30 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><DollarSign size={10} /> Total</p>
                  <p className="font-bold text-primary mt-1">KES {Number(detailsBooking.total_amount).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Payment</p>
                  <p className="font-medium mt-1">{(detailsBooking.payment_status || 'pending').toUpperCase()}</p>
                </div>
              </div>

              {detailsBooking.admin_notes && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <p className="text-xs font-bold text-amber-500">Admin note</p>
                  <p className="text-xs text-amber-400/80 mt-1">{detailsBooking.admin_notes}</p>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-border flex flex-wrap gap-2">
              <button onClick={() => openContract(detailsBooking)} className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <FileText size={14} /> Contract
              </button>
              <button
                onClick={() => openReceipt(detailsBooking)}
                disabled={receiptLoadingId === detailsBooking.id}
                className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {receiptLoadingId === detailsBooking.id ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                Receipt
              </button>
              {isOnTripStatus(detailsBooking.status) && (
                <button
                  onClick={() => { navigate(`/client/inbox?action=extension&bookingId=${detailsBooking.id}`); setDetailsBooking(null); }}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Clock size={14} /> Extend
                </button>
              )}
              <button onClick={() => setDetailsBooking(null)} className="ml-auto px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <MessageSquare size={20} className="text-amber-400" />
                <div>
                  <h3 className="font-bold text-lg">Leave a Review</h3>
                  <p className="text-xs text-muted-foreground">
                    {getBookingVehicleDisplay(reviewBooking, 'client').modelLabel}
                  </p>
                </div>
              </div>
              <button onClick={() => setReviewBooking(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmitReview} className="p-5 space-y-5">
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
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        size={32}
                        className={star <= (reviewHover || reviewRating) ? 'text-amber-400 fill-amber-400' : 'text-border'}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Your Comment</p>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={4}
                  placeholder="Tell others about your experience..."
                  className="w-full px-4 py-3 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  required
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Your review is sent to admin for approval before it appears on the website.
              </p>
              <button
                type="submit"
                disabled={submittingReview || !reviewRating}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submittingReview ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Submit Review
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
