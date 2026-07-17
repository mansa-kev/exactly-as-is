import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  X, CheckCircle2, XCircle, FileText, CreditCard, User, Car, MapPin,
  Calendar, ShieldCheck, AlertTriangle, Loader2, Clock, Send, Phone,
  ArrowRight, ExternalLink, ChevronLeft, Mail, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '../../utils/logger';
import { linkBookingAndSyncProfile } from '../../utils/bookingProfileSync';
import { getBookingVehicleDisplay } from '../../utils/bookingVehicleDisplay';
import { toProxiedAssetUrl } from '../../utils/assetUrl';

type BookingStatus = 'pending' | 'confirmed' | 'on_trip' | 'completed' | 'cancelled' | 'pending_payment_verification';

interface Booking {
  id: string;
  client_id: string;
  car_id: string;
  fleet_owner_id: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  status: BookingStatus;
  payment_status: 'paid' | 'pending' | 'failed';
  payment_method?: string;
  payment_provider?: string;
  payment_reference?: string;
  transaction_code?: string;
  document_status?: string;
  admin_notes?: string;
  pickup_location?: string;
  dropoff_location?: string;
  created_at: string;
  client?: any;
  cars?: any;
  metadata?: any;
}

interface Props {
  booking: Booking;
  onClose: () => void;
  onRefresh: () => void;
  onDelete: () => void;
}

type Step = 'payment' | 'documents' | 'communicate';
type CommunicateMode = 'approval' | 'payment_rejected' | 'docs_rejected';

export function AdminBookingDetail({ booking: initialBooking, onClose, onRefresh, onDelete }: Props) {
  const [booking, setBooking] = useState(initialBooking);
  const [step, setStep] = useState<Step>('payment');
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [communicateMode, setCommunicateMode] = useState<CommunicateMode>('approval');
  const [adminMessage, setAdminMessage] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [docRejectionReason, setDocRejectionReason] = useState('');
  const [showDocRejection, setShowDocRejection] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const handleClose = () => { onRefresh(); onClose(); };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !lightboxUrl) handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, lightboxUrl]);

  // Derived values
  const meta        = booking.metadata || {};
  const guestInfo   = meta.guest_info || {};
  const docs        = meta.documents || {};
  const clientName  = booking.client?.full_name    || guestInfo.full_name    || 'N/A';
  const clientEmail = booking.client?.email        || guestInfo.email        || 'N/A';
  const clientPhone = booking.client?.phone_number || booking.client?.phone  || guestInfo.phone || 'N/A';
  const idNumber    = guestInfo.id_number || guestInfo.national_id || docs.idNumber || docs.id_number || (meta as any).id_number || booking.client?.id_number || 'N/A';
  const licenseNum  = booking.client?.license_number || guestInfo.license_number || guestInfo.license || 'N/A';
  const transactionCode = booking.transaction_code || null;
  const isPaid      = booking.payment_status === 'paid';
  const docsOk      = booking.document_status === 'approved';
  const bookingRef  = booking.id.slice(0, 8).toUpperCase();
  const vehicle = getBookingVehicleDisplay(booking, 'admin');
  const carLine = vehicle.modelLabel;
  const carFull = vehicle.label;
  const rentalDays  = (booking.start_date && booking.end_date)
    ? Math.max(1, Math.ceil((new Date(booking.end_date).getTime() - new Date(booking.start_date).getTime()) / 86400000))
    : '—';
  const waPhone  = clientPhone.replace(/\D/g, '').replace(/^0/, '254');
  const hasPhone = waPhone.length >= 10;

  const buildMessage = (mode: CommunicateMode) => {
    if (mode === 'approval') {
      return `Dear ${clientName},\n\nGreat news! Your car rental booking has been fully reviewed and confirmed.\n\n✅ Payment Verified — KES ${Number(booking.total_amount).toLocaleString()}\n✅ Documents Approved\n✅ Vehicle Ready — ${carFull}\n\nPickup Location: ${booking.pickup_location || 'Contact us for details'}\nPickup Date: ${booking.start_date || 'N/A'}\nReturn Date: ${booking.end_date || 'N/A'}\n\nPlease bring your original driving licence and ID on pickup day.\n\nThank you for choosing LinkedUp Cars!\n\nThe LinkedUp Cars Team`;
    } else if (mode === 'payment_rejected') {
      return `Dear ${clientName},\n\nYour NCBA STK Push payment attempt for Booking #${bookingRef} was not completed successfully.\n\nNext Steps:\n1. Return to your booking payment screen\n2. Retry the NCBA STK Push using the correct phone number\n3. Enter your mobile money PIN when prompted\n\nYour booking remains pending payment verification until NCBA confirms successful payment.\n\nPlease contact us if you need assistance.\n\nThe LinkedUp Cars Team`;
    } else {
      return `Dear ${clientName},\n\nOur team has reviewed your submitted documents for Booking #${bookingRef}.\n\nUnfortunately, we were unable to approve your documents at this time.\n\nReason: ${docRejectionReason || 'Documents require correction'}\n\nNext Steps:\n1. Log into your client portal at linkedupcars.com\n2. Navigate to My Bookings\n3. Click "Resubmit Documents" to upload corrected copies\n\n✅ IMPORTANT: Your payment has been verified — you do NOT need to pay again.\n\nPlease contact us if you need help.\n\nThe LinkedUp Cars Team`;
    }
  };

  const enterCommunicateStep = (mode: CommunicateMode) => {
    setCommunicateMode(mode);
    setAdminMessage(buildMessage(mode));
    setStep('communicate');
  };

  const handleVerifyPayment = async (status: 'verified' | 'rejected') => {
    setIsVerifying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Admin authentication required'); return; }

      if (status === 'verified') {
        const { error: bookingErr } = await supabase.from('bookings').update({
          status: 'confirmed',
          payment_status: 'paid',
        }).eq('id', booking.id);

        if (bookingErr) {
          logger.error('Booking update error:', bookingErr);
          toast.error(`Failed to update booking: ${bookingErr.message}`);
          return;
        }

        // Create a transaction record so finances reflect immediately
        if (booking.client_id) {
          await supabase.from('transactions').insert({
            booking_id: booking.id,
            user_id: booking.client_id,
            amount: booking.total_amount,
            type: 'payment_in',
            status: 'completed',
            transaction_code: transactionCode || booking.id,
          }).then(null, (e: any) => logger.warn('Transaction record error:', e));
        }

        setBooking(prev => ({ ...prev, status: 'confirmed', payment_status: 'paid' }));
        toast.success('Payment verified ✓');
        setStep('documents');
      } else {
        const { error: rejectErr } = await supabase.from('bookings').update({
          payment_status: 'failed',
        }).eq('id', booking.id);
        if (rejectErr) { toast.error(`Failed to reject: ${rejectErr.message}`); return; }
        setBooking(prev => ({ ...prev, payment_status: 'failed' }));
        toast.info('Payment rejected — composing client notification');
        enterCommunicateStep('payment_rejected');
      }
    } catch (e: any) {
      logger.error('Error verifying payment:', e);
      toast.error('Failed to verify payment');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleApproveDocuments = async () => {
    setIsApproving(true);
    try {
      await supabase.from('bookings').update({
        document_status: 'approved',
        updated_at: new Date().toISOString(),
      }).eq('id', booking.id);
      setBooking(prev => ({ ...prev, document_status: 'approved' }));
      try {
        await linkBookingAndSyncProfile(supabase, booking);
      } catch (syncErr) {
        logger.warn('Profile sync from booking failed:', syncErr);
      }
      toast.success('Documents approved ✓');
      enterCommunicateStep('approval');
    } catch (e: any) {
      logger.error('Error approving documents:', e);
      toast.error('Failed to approve documents');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectDocuments = async () => {
    if (!docRejectionReason.trim()) { toast.error('Please enter a rejection reason'); return; }
    setIsApproving(true);
    try {
      await supabase.from('bookings').update({
        document_status: 'resubmission_required',
        admin_notes: docRejectionReason,
        updated_at: new Date().toISOString(),
      }).eq('id', booking.id);
      setBooking(prev => ({ ...prev, document_status: 'resubmission_required', admin_notes: docRejectionReason }));
      setShowDocRejection(false);
      toast.info('Documents rejected — composing client notification');
      enterCommunicateStep('docs_rejected');
    } catch (e: any) {
      logger.error('Error rejecting documents:', e);
      toast.error('Failed to reject documents');
    } finally {
      setIsApproving(false);
    }
  };

  const handleSendMessage = async () => {
    setIsSending(true);
    const fullMsg = adminMessage.trim() + (additionalNotes.trim() ? `\n\nAdmin Notes:\n${additionalNotes.trim()}` : '');
    const subject = communicateMode === 'approval'
      ? 'Booking Confirmed — LinkedUp Cars'
      : communicateMode === 'payment_rejected'
      ? 'Payment Review Update — LinkedUp Cars'
      : 'Action Required: Resubmit Documents — LinkedUp Cars';

    try {
      if (clientEmail !== 'N/A') {
        const htmlBody = `<div style="font-family:sans-serif;line-height:1.6;white-space:pre-wrap">${fullMsg.replace(/\n/g, '<br>')}</div>`;
        await supabase.functions.invoke('send-email', {
          body: { to: clientEmail, subject, html: htmlBody, text: fullMsg },
        }).catch(e => logger.warn('Email send error:', e));
      }

      if (booking.client_id) {
        try {
          await supabase.from('notifications').insert({
            user_id: booking.client_id,
            type: communicateMode === 'approval' ? 'booking_confirmed' : 'booking_update',
            title: communicateMode === 'approval' ? 'Booking Confirmed 🎉' : subject,
            content: fullMsg.slice(0, 300),
            is_read: false,
            link: `/booking-confirmation/${booking.id}`,
          });
        } catch (e) { logger.warn('Notification error:', e); }
      }

      if (communicateMode === 'approval') {
        await supabase.from('bookings').update({
          status: 'confirmed',
          payment_status: 'paid',
          updated_at: new Date().toISOString(),
        }).eq('id', booking.id);
        setBooking(prev => ({ ...prev, status: 'confirmed', payment_status: 'paid' }));
      }

      setSendSuccess(true);
      toast.success('Message sent! Booking updated.');
      setTimeout(() => { handleClose(); }, 1800);
    } catch (e: any) {
      logger.error('Error sending message:', e);
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const openWhatsApp = async () => {
    if (!hasPhone) { toast.error('No valid phone number on record'); return; }
    const text = encodeURIComponent(adminMessage.trim() + (additionalNotes.trim() ? `\n\nAdmin Notes:\n${additionalNotes.trim()}` : ''));
    window.open(`https://wa.me/${waPhone}?text=${text}`, '_blank', 'noopener,noreferrer');

    if (communicateMode === 'approval') {
      try {
        await supabase.from('bookings').update({
          status: 'confirmed',
          payment_status: 'paid',
          updated_at: new Date().toISOString(),
        }).eq('id', booking.id);
        setBooking(prev => ({ ...prev, status: 'confirmed', payment_status: 'paid' }));

        if (booking.client_id) {
          try {
            await supabase.from('notifications').insert({
              user_id: booking.client_id,
              type: 'booking_confirmed',
              title: 'Booking Confirmed 🎉',
              content: adminMessage.slice(0, 300),
              is_read: false,
              link: `/booking-confirmation/${booking.id}`,
            });
          } catch (e) { logger.warn('Notification error:', e); }
        }
        setSendSuccess(true);
      } catch (e: any) {
        logger.warn('WhatsApp confirm DB update failed:', e);
      }
    }
  };

  const stepConfig = [
    { id: 'payment' as Step, label: 'Payment', done: isPaid },
    { id: 'documents' as Step, label: 'Documents', done: docsOk },
    { id: 'communicate' as Step, label: 'Communicate', done: sendSuccess },
  ];

  const canNavigateTo = (s: Step) => {
    if (s === 'payment') return true;
    if (s === 'documents') return isPaid;
    if (s === 'communicate') return sendSuccess;
    return false;
  };

  // ─── Reusable sub-components ───────────────────────────────────────────────

  const SectionCard = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className="bg-muted/20 rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <p className="text-xs font-black uppercase tracking-widest text-foreground">{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );

  const Field = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
    <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-xs font-bold text-foreground mt-0.5 break-words ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );

  const ImageTile = ({ url, label }: { url?: string; label: string }) => (
    <div>
      <button
        onClick={() => url && setLightboxUrl(url)}
        disabled={!url}
        className="w-full h-28 rounded-xl overflow-hidden border border-border bg-muted/30 flex items-center justify-center hover:border-primary/50 transition-all disabled:cursor-default cursor-zoom-in"
      >
        {url
          ? <img src={url} alt={label} className="w-full h-full object-cover" />
          : <FileText size={20} className="text-muted-foreground" />}
      </button>
      <p className="text-[10px] text-muted-foreground mt-1 text-center font-medium">
        {label} {url && <span className="text-primary">· tap to zoom</span>}
      </p>
    </div>
  );

  // ── Booking strip (shown at top of every page) ─────────────────────────────
  const BookingStrip = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden shrink-0">
      {[
        { label: 'Client', value: clientName },
        { label: 'Vehicle', value: carFull },
        { label: 'Rental', value: `${booking.start_date || '—'} → ${booking.end_date || '—'}` },
        { label: 'Total', value: `KES ${Number(booking.total_amount).toLocaleString()}` },
      ].map(({ label, value }) => (
        <div key={label} className="bg-card px-3 py-2.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="text-xs font-bold text-foreground truncate mt-0.5">{value}</p>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-background/80 backdrop-blur-sm"
        onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <div className="bg-card border border-border rounded-xl md:rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

          {/* ── Modal Header ────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-border shrink-0">
            <div className="flex-1 min-w-0">
              <h2 className="text-base md:text-lg font-black text-foreground leading-tight">Booking Details</h2>
              <p className="text-xs text-muted-foreground mt-0.5">#{bookingRef} · {clientName}</p>
            </div>

            {/* Step pill navigator */}
            <div className="hidden sm:flex items-center gap-1">
              {stepConfig.map((s, i) => (
                <React.Fragment key={s.id}>
                  <button
                    onClick={() => canNavigateTo(s.id) && setStep(s.id)}
                    disabled={!canNavigateTo(s.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black transition-colors disabled:cursor-not-allowed ${
                      step === s.id
                        ? 'bg-primary text-black'
                        : s.done
                        ? 'bg-green-500/15 text-green-500 hover:bg-green-500/25'
                        : 'bg-muted/40 text-muted-foreground'
                    }`}
                  >
                    {s.done ? <CheckCircle2 size={10} /> : <span>{i + 1}</span>}
                    {s.label}
                  </button>
                  {i < stepConfig.length - 1 && <ArrowRight size={10} className="text-border" />}
                </React.Fragment>
              ))}
            </div>

            <button onClick={onDelete} title="Delete booking" className="p-2 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-xl transition-colors">
              <Trash2 size={15} />
            </button>
            <button onClick={handleClose} className="p-2 hover:bg-muted text-muted-foreground rounded-xl transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* ── Scrollable body ──────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">

            {/* ═══════════════════════════════════════════════════════════
                PAGE 1 — PAYMENT REVIEW
            ═══════════════════════════════════════════════════════════ */}
            {step === 'payment' && (
              <div className="p-4 md:p-6 space-y-4">
                <BookingStrip />

                    <SectionCard icon={<CreditCard size={13} />} title="NCBA STK Payment">
                      <div className="mb-4">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">NCBA Transaction ID</p>
                        {transactionCode ? (
                          <p className="text-4xl font-mono font-black text-warning tracking-widest">{transactionCode}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No NCBA transaction ID recorded yet</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-border">
                        <Field label="Amount" value={`KES ${Number(booking.total_amount).toLocaleString()}`} />
                        <Field label="Date Submitted" value={new Date(booking.created_at).toLocaleDateString('en-KE', { dateStyle: 'medium' })} />
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Status</p>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isPaid ? 'bg-green-500/10 text-green-500' :
                            booking.payment_status === 'failed' ? 'bg-red-500/10 text-red-500' :
                            'bg-amber-500/10 text-amber-500'
                          }`}>
                            {isPaid ? '✓ Verified' : booking.payment_status || 'pending'}
                          </span>
                        </div>
                      </div>
                    </SectionCard>

                    {/* Action area */}
                    {isPaid ? (
                      <div className="flex items-center justify-between gap-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="text-green-500 shrink-0" size={20} />
                          <div>
                            <p className="text-sm font-black text-green-500">Payment Verified</p>
                            <p className="text-xs text-muted-foreground">Proceed to review the client's documents</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setStep('documents')}
                          className="flex items-center gap-2 px-4 py-2 bg-primary text-black font-black rounded-xl text-xs uppercase tracking-wider hover:bg-primary/90 transition-colors shrink-0"
                        >
                          Review Docs <ArrowRight size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={15} />
                          <p className="text-xs text-amber-600 font-bold leading-relaxed">
                            Payment must be confirmed by NCBA STK Push. Do not manually approve this booking. Use the NCBA Payment Requests tab to sync the latest status, or ask the client to retry STK Push from their booking flow.
                          </p>
                        </div>
                      </div>
                    )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                PAGE 2 — DOCUMENT & BOOKING REVIEW
            ═══════════════════════════════════════════════════════════ */}
            {step === 'documents' && (
              <div className="p-4 md:p-6 space-y-4">

                {/* Payment verified ribbon */}
                <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <CheckCircle2 size={13} className="text-green-500 shrink-0" />
                  <span className="text-xs font-black text-green-500">Payment Verified</span>
                  <span className="text-xs font-mono text-green-500/60 ml-1">· {transactionCode}</span>
                  <span className="ml-auto text-xs font-black text-green-500">KES {Number(booking.total_amount).toLocaleString()}</span>
                </div>

                {/* Client Identity */}
                <SectionCard icon={<User size={13} />} title="Client Identity">
                  <div className="flex gap-4 items-start">
                    {docs.facePhotoUrl ? (
                      <button onClick={() => setLightboxUrl(docs.facePhotoUrl)} className="shrink-0 focus:outline-none">
                        <img src={docs.facePhotoUrl} alt="Selfie" className="w-20 h-20 rounded-xl object-cover border-2 border-primary/20 hover:border-primary cursor-zoom-in transition-all" />
                      </button>
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-muted/40 border border-border flex items-center justify-center shrink-0">
                        <User size={24} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 flex-1">
                      <Field label="Full Name" value={clientName} />
                      <Field label="Email Address" value={clientEmail} />
                      <Field label="Phone Number" value={clientPhone} />
                      <Field label="Booking Submitted" value={new Date(booking.created_at).toLocaleDateString('en-KE', { dateStyle: 'medium' })} />
                    </div>
                  </div>
                </SectionCard>

                {/* National ID */}
                <SectionCard icon={<ShieldCheck size={13} />} title="National ID">
                  <div className="mb-3">
                    <Field label="ID Number" value={idNumber} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <ImageTile url={docs.idFrontUrl} label="Front" />
                    <ImageTile url={docs.idBackUrl} label="Back" />
                  </div>
                </SectionCard>

                {/* Driver's Licence */}
                <SectionCard icon={<CreditCard size={13} />} title="Driver's Licence">
                  <div className="mb-3">
                    <Field label="Licence Number" value={licenseNum} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <ImageTile url={docs.licenseFrontUrl} label="Front" />
                    <ImageTile url={docs.licenseBackUrl} label="Back" />
                  </div>
                </SectionCard>

                {/* Booking Summary */}
                <SectionCard icon={<Car size={13} />} title="Booking Summary">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                    <Field label="Booking ID" value={`#${bookingRef}`} mono />
                    <Field label="Booked Model" value={vehicle.modelLabel} />
                    <Field label="Assigned Unit" value={vehicle.unitLabel || 'Pending allocation'} />
                    <Field label="Rental Days" value={`${rentalDays} day${rentalDays !== 1 ? 's' : ''}`} />
                    <Field label="Start Date" value={booking.start_date || 'N/A'} />
                    <Field label="End Date" value={booking.end_date || 'N/A'} />
                    <Field label="Pickup Location" value={booking.pickup_location || 'N/A'} />
                    <Field label="Dropoff Location" value={booking.dropoff_location || 'Same as pickup'} />
                  </div>
                </SectionCard>

                {/* Payment confirmation */}
                <SectionCard icon={<CreditCard size={13} />} title="Payment">
                  <div className="flex flex-wrap items-center gap-6">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Amount</p>
                      <p className="text-2xl font-black text-primary mt-0.5">KES {Number(booking.total_amount).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">NCBA Transaction ID</p>
                      <p className="text-lg font-mono font-black text-foreground mt-0.5">{transactionCode || 'N/A'}</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                      <CheckCircle2 size={15} className="text-green-500" />
                      <span className="text-xs font-black text-green-500">Verified</span>
                    </div>
                  </div>
                </SectionCard>

                {/* Contract & Signature */}
                {(meta.contract_url || docs.signatureUrl || meta.signature || meta.signature_url) && (
                  <SectionCard icon={<FileText size={13} />} title="Contract & Signature">
                    <div className="flex flex-wrap gap-4 items-start">
                      {meta.contract_url && (
                        <a href={toProxiedAssetUrl(meta.contract_url) || meta.contract_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-xl text-xs font-black text-primary hover:bg-primary/20 transition-colors">
                          <ExternalLink size={12} /> View Contract PDF
                        </a>
                      )}
                      {(docs.signatureUrl || meta.signature || meta.signature_url) && (
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Digital Signature</p>
                          <button onClick={() => setLightboxUrl(docs.signatureUrl || meta.signature || meta.signature_url)} className="cursor-zoom-in">
                            <img src={docs.signatureUrl || meta.signature || meta.signature_url} alt="Signature" className="h-16 bg-white rounded-lg p-1.5 border border-border hover:border-primary transition-colors object-contain" />
                          </button>
                        </div>
                      )}
                    </div>
                  </SectionCard>
                )}

                {/* Document rejection input */}
                {showDocRejection && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-3">
                    <p className="text-xs font-black uppercase tracking-widest text-red-500">Document Rejection Reason</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'ID document unclear',
                        'Licence document unclear',
                        'Documents don\'t match records',
                        'Incomplete submission',
                        'Photos are low quality',
                      ].map(r => (
                        <button key={r} onClick={() => setDocRejectionReason(r)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${docRejectionReason === r ? 'bg-red-600 text-white' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}>
                          {r}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={docRejectionReason}
                      onChange={e => setDocRejectionReason(e.target.value)}
                      placeholder="Or type a custom reason..."
                      rows={2}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:border-red-500"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleRejectDocuments} disabled={!docRejectionReason.trim() || isApproving}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-black hover:bg-red-700 transition-colors disabled:opacity-50">
                        {isApproving ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                        Confirm Rejection & Notify
                      </button>
                      <button onClick={() => { setShowDocRejection(false); setDocRejectionReason(''); }}
                        className="px-4 py-2.5 bg-muted text-muted-foreground rounded-xl text-xs font-bold hover:bg-muted/80 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                PAGE 3 — CLIENT COMMUNICATION
            ═══════════════════════════════════════════════════════════ */}
            {step === 'communicate' && (
              <div className="p-4 md:p-6 space-y-4">

                {/* Outcome mode banner */}
                <div className={`flex items-start gap-3 p-4 rounded-xl border ${
                  communicateMode === 'approval'
                    ? 'bg-green-500/10 border-green-500/20'
                    : 'bg-red-500/10 border-red-500/20'
                }`}>
                  {communicateMode === 'approval'
                    ? <CheckCircle2 size={20} className="text-green-500 shrink-0 mt-0.5" />
                    : <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" />}
                  <div>
                    <p className={`text-sm font-black ${communicateMode === 'approval' ? 'text-green-500' : 'text-red-500'}`}>
                      {communicateMode === 'approval' && 'Booking Fully Approved — Send Confirmation'}
                      {communicateMode === 'payment_rejected' && 'Payment Rejected — Notify Client'}
                      {communicateMode === 'docs_rejected' && 'Documents Rejected — Request Resubmission'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {communicateMode === 'approval' && 'Booking status will be set to Confirmed once you send this message.'}
                      {communicateMode === 'payment_rejected' && 'Client will be asked to retry NCBA STK Push.'}
                      {communicateMode === 'docs_rejected' && 'Client must resubmit corrected documents. Payment remains valid.'}
                    </p>
                  </div>
                </div>

                {/* Recipient strip */}
                <div className="bg-muted/20 rounded-xl border border-border p-3 flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Sending To</p>
                    <div className="flex flex-wrap gap-3">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <Mail size={11} className="text-primary" /> {clientEmail}
                      </span>
                      {hasPhone && (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                          <Phone size={11} className="text-green-500" /> {clientPhone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Editable message */}
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Message (editable)</p>
                  <textarea
                    value={adminMessage}
                    onChange={e => setAdminMessage(e.target.value)}
                    rows={11}
                    className="w-full bg-muted/20 border border-border rounded-xl px-4 py-3 text-xs text-foreground resize-y focus:outline-none focus:border-primary font-mono leading-relaxed"
                  />
                </div>

                {/* Additional notes */}
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Additional Notes <span className="normal-case font-medium text-muted-foreground/60">(appended to message)</span></p>
                  <textarea
                    value={additionalNotes}
                    onChange={e => setAdditionalNotes(e.target.value)}
                    placeholder="Any extra instructions or context for the client..."
                    rows={3}
                    className="w-full bg-muted/20 border border-border rounded-xl px-4 py-3 text-xs text-foreground resize-none focus:outline-none focus:border-primary"
                  />
                </div>

                {sendSuccess && (
                  <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <CheckCircle2 className="text-green-500 shrink-0" size={18} />
                    <p className="text-sm font-black text-green-500">Message sent! Closing...</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Footer ─────────────────────────────────────────────────────── */}
          <div className="shrink-0 px-4 md:px-6 py-3 border-t border-border bg-muted/10 flex items-center gap-2 flex-wrap">

            {/* Back button */}
            {step !== 'payment' && (
              <button
                onClick={() => setStep(step === 'communicate' ? (isPaid ? 'documents' : 'payment') : 'payment')}
                className="flex items-center gap-1.5 px-3 py-2 bg-muted text-muted-foreground rounded-xl text-xs font-bold hover:bg-muted/80 transition-colors"
              >
                <ChevronLeft size={12} /> Back
              </button>
            )}

            <div className="flex-1" />

            {/* Page 2 actions */}
            {step === 'documents' && !showDocRejection && (
              <>
                <button
                  onClick={() => setShowDocRejection(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/15 text-red-500 border border-red-500/30 rounded-xl text-xs font-black hover:bg-red-600/25 transition-colors"
                >
                  <XCircle size={13} /> Reject Documents
                </button>
                <button
                  onClick={handleApproveDocuments}
                  disabled={isApproving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-black hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {isApproving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  Approve Documents
                </button>
              </>
            )}

            {/* Page 3 actions */}
            {step === 'communicate' && !sendSuccess && (
              <>
                {hasPhone && (
                  <button
                    onClick={openWhatsApp}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-black hover:bg-green-700 transition-colors"
                  >
                    <Phone size={13} /> WhatsApp
                  </button>
                )}
                <button
                  onClick={handleSendMessage}
                  disabled={isSending || !adminMessage.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-xl text-xs font-black hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  {communicateMode === 'approval' ? 'Send & Confirm Booking' : 'Send Message'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
            <X size={20} />
          </button>
          <img src={lightboxUrl} alt="Document"
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
