// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { Car } from '../../../types';
import { ArrowLeft, ShieldCheck, CheckCircle2, Loader2, AlertCircle, Lock, Smartphone, RefreshCw, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { bookingService } from '../../../services/bookingService';
import { enhancedContractService } from '../../../services/enhancedContractService';
import { buildContractData } from '../../../services/contractPdfService';
import { paymentService } from '../../../services/paymentService';
import { supabase } from '../../../lib/supabase';
import { sendTemplatedEmail } from '../../../services/emailProvider';
import { InternationalPhoneInput } from '../../ui/InternationalPhoneInput';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { analyticsService } from '../../../services/analyticsService';

interface Step4Props {
  car: Car;
  bookingData: any;
  onPrev: () => void;
  onComplete?: () => void;
  vehicleModelId?: string | null;
  uploadContextId?: string;
}

type PaymentPhase = 'ready' | 'creating_booking' | 'sending_stk' | 'waiting' | 'paid' | 'failed' | 'timeout' | 'manual_pending';

export function Step4({ car, bookingData, onPrev, onComplete, vehicleModelId, uploadContextId }: Step4Props) {
  const navigate = useNavigate();
  const contextId = uploadContextId || (vehicleModelId ? `model:${vehicleModelId}` : `car:${car.id}`);
  const [phase, setPhase] = useState<PaymentPhase>('ready');
  const [showAltPayment, setShowAltPayment] = useState(false);
  const [altPaymentNotes, setAltPaymentNotes] = useState('');
  const [phone, setPhone] = useState(bookingData.phone || '');
  const [bookingId, setBookingId] = useState<string | null>(() => sessionStorage.getItem(`pending_booking_${contextId}`));
  const [statusToken, setStatusToken] = useState<string | null>(() => sessionStorage.getItem(`pending_booking_token_${contextId}`));
  const [paymentRequestId, setPaymentRequestId] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState('');
  const [editableAmount, setEditableAmount] = useState<number>(bookingData.totalAmount || 0);

  const isBusy = phase === 'creating_booking' || phase === 'sending_stk' || phase === 'waiting';

  useEffect(() => {
    if (!bookingId) return;
    const channel = supabase
      .channel(`booking-payment-${bookingId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${bookingId}`,
      }, (payload: any) => {
        const updated = payload.new;
        // Trigger on payment_status='paid' alone — don't require status='confirmed'
        if (updated.payment_status === 'paid') {
          setPhase('paid');
          toast.success('Payment confirmed! Booking confirmed.');
          onComplete?.();
          navigate(`/booking-confirmation/${bookingId}`);
        }
      })
      .subscribe();

    // Check status immediately in case it was paid while offline/refreshing
    (async () => {
      const status = await paymentService.getPaymentStatus(bookingId, statusToken || undefined);
      if (status.paid) {
        setPhase('paid');
        toast.success('Payment confirmed! Booking confirmed.');
        onComplete?.();
        navigate(`/booking-confirmation/${bookingId}`);
      }
    })();

    return () => { supabase.removeChannel(channel); };
  }, [bookingId, statusToken, navigate, onComplete]);

  const getOrCreateBooking = async () => {
    if (bookingId) return bookingId;

    setPhase('creating_booking');
    const { contractPdfBase64, signatureData, ...bookingPayload } = bookingData;
    const booking = await bookingService.createBooking({
      ...bookingPayload,
      totalAmount: editableAmount,
      ...(vehicleModelId ? { vehicleModelId } : { carId: car.id }),
      paymentMethod: 'ncba_stk',
    });

    if (!booking?.id) throw new Error('Failed to create booking');

    setBookingId(booking.id);
    sessionStorage.setItem(`pending_booking_${contextId}`, booking.id);
    if (booking.statusToken) {
      setStatusToken(booking.statusToken);
      sessionStorage.setItem(`pending_booking_token_${contextId}`, booking.statusToken);
    }

    if (bookingData.contractId) {
      await enhancedContractService.releasePaymentHold(bookingData.contractId).catch(() => {});
    }

    if (bookingData.signatureData) {
      try {
        await enhancedContractService.saveSignedContract(
          booking.id,
          bookingData.signatureData,
          buildContractData(booking.id, bookingData, car, vehicleModelId),
          bookingData.contractPdfBase64,
          booking.statusToken || statusToken
        );
      } catch (err) {
        console.error('Failed to save signed contract:', err);
      }
    }

    return booking.id;
  };

  const handlePaid = (id: string) => {
    setPhase('paid');
    toast.success('Payment confirmed! Booking confirmed.');
    onComplete?.();
    navigate(`/booking-confirmation/${id}`);
  };

  const handleSendStk = async () => {
    const cleanPhone = phone.replace(/[\s\-+]/g, '');

    if (cleanPhone.length < 9) {
      toast.error('Enter a valid phone number for payment prompt');
      return;
    }

    let id: string | null = null;
    try {
      setLastMessage('');
      id = await getOrCreateBooking();

      setPhase('sending_stk');
      // Fire STK push with a hard client timeout so we don't get stuck on "Sending"
      const stkPromise = paymentService.initiateSTKPush({ phone: cleanPhone, bookingId: id, amount: editableAmount });
      const timeoutPromise = new Promise<any>((resolve) =>
        setTimeout(() => resolve({ __timedOut: true }), 25000)
      );
      const result: any = await Promise.race([stkPromise, timeoutPromise]);

      if (result?.paymentRequestId) {
        setPaymentRequestId(result.paymentRequestId);
      }

      if (result?.__timedOut) {
        // STK request timed out — we don't have a paymentRequestId to poll.
        // The realtime subscription will still catch any late webhook.
        setPhase('timeout');
        setLastMessage('Payment prompt is taking longer than usual. If you received the prompt on your phone, enter your PIN — this page will update automatically. Otherwise, tap Retry.');
        analyticsService.trackEvent('error', 'stk_init_timeout', { metadata: { bookingId: id } });
        toast.message('Still sending payment prompt... check your phone.');
        return;
      } else if (!result?.success && !result?.paymentRequestId) {
        // Hard failure from the server
        setPhase('failed');
        setLastMessage(result?.error || result?.statusDescription || 'Payment prompt could not be sent. Please try again.');
        analyticsService.trackEvent('error', 'stk_init_failed', { metadata: { error: result?.error, description: result?.statusDescription, bookingId: id } });
        toast.error(result?.error || 'Payment prompt failed. Please try again.');
        return;
      }

      // STK was accepted — move into "waiting" and start polling
      setPhase('waiting');
      setLastMessage(result.statusDescription || 'Payment prompt sent. Check your phone and enter your PIN.');
      toast.success('Payment prompt sent. Check your phone.');

      const pollResult = await paymentService.pollUntilPaid(
        result.paymentRequestId || '',
        id,
        statusToken || undefined,
        3000,
        180000,
      );

      if (pollResult === 'paid') {
        handlePaid(id);
      } else if (pollResult === 'failed') {
        setPhase('failed');
        analyticsService.trackEvent('error', 'stk_payment_failed', { metadata: { bookingId: id } });
        setLastMessage('Payment was not completed. You can retry without creating a new booking.');
      } else {
        setPhase('timeout');
        analyticsService.trackEvent('error', 'stk_payment_timeout', { metadata: { bookingId: id } });
        setLastMessage('Payment is still pending or timed out. You can retry the payment prompt for the same booking.');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      // If the booking was already created, don't drop into "failed" — keep listening
      if (id) {
        setPhase('waiting');
        setLastMessage('Network hiccup while sending the payment prompt. If the prompt appeared on your phone, enter your PIN — we will confirm automatically.');
        analyticsService.trackEvent('error', 'stk_network_hiccup', { metadata: { bookingId: id, error: error.message } });
      } else {
        setPhase('failed');
        setLastMessage(error.message || 'Payment could not be started. Please try again.');
        analyticsService.trackEvent('error', 'stk_creation_error', { metadata: { error: error.message } });
        toast.error(error.message || 'Payment could not be started. Please try again.');
      }
    }
  };

  const handleAltPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) {
      toast.error('Please provide a valid phone number.');
      return;
    }

    try {
      setPhase('creating_booking');
      const id = await getOrCreateBooking();
      
      // Send message to contact_messages
      const messageContent = `Alternative Payment Request (Full Booking)\nBooking ID: ${id}\nCar: ${car.make} ${car.model}\nName: ${bookingData.fullName}\nEmail: ${bookingData.email}\nPhone: ${phone}\nTotal Amount: KES ${editableAmount}\nNotes: ${altPaymentNotes}`;
      
      await supabase.from('contact_messages').insert([{
        name: bookingData.fullName,
        phone: phone,
        email: bookingData.email,
        subject: 'Alternative Payment Request',
        message: messageContent,
      }]);

      // Send email to user with tracking link
      if (bookingData.email) {
        await sendTemplatedEmail(bookingData.email, 'manual_payment_pending', {
          booking_id: id,
          car_name: `${car.make} ${car.model}`,
          total_amount: editableAmount.toLocaleString(),
          tracking_link: `${window.location.origin}/booking-confirmation/${id}` // Or my-bookings
        }).catch(err => console.error('Failed to send pending payment email', err));
      }

      toast.success('Request sent! Redirecting to WhatsApp...');
      
      // Redirect to WhatsApp
      const waMessage = encodeURIComponent(`Hello LinkedUp Cars, I would like to complete my payment for ${car.make} ${car.model} but I'm not using M-Pesa.\n\nMy name is ${bookingData.fullName} and phone is ${phone}.\nBooking ID: ${id.substring(0,8)}`);
      window.open(`https://wa.me/254714764162?text=${waMessage}`, '_blank');
      
      // Mark as manual_pending
      setPhase('manual_pending');
      setLastMessage('Waiting for admin verification. You can safely close this window or wait here for confirmation.');
      setShowAltPayment(false);

    } catch (error: any) {
      console.error('Alt payment error:', error);
      setPhase('failed');
      setLastMessage(error.message || 'Could not process request. Please try again.');
      toast.error(error.message || 'Could not process request.');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-1">
        <h3 className="text-xl sm:text-2xl md:text-3xl font-serif font-black italic text-foreground">Complete Payment</h3>
        <p className="text-muted-foreground text-xs sm:text-sm">Pay securely via M-Pesa prompt. No manual transaction code is required.</p>
      </div>

      {bookingData.contractSigned && (
        <div className="p-2.5 sm:p-3 bg-green-500/10 rounded-[12px] sm:rounded-[16px] border border-green-500/20 flex gap-2 items-center">
          <Lock className="text-green-500 shrink-0" size={14} />
          <p className="text-[10px] sm:text-xs text-green-500 font-bold uppercase tracking-widest">Contract Signed</p>
        </div>
      )}

      <div className="p-4 sm:p-5 bg-primary/5 border border-primary/20 rounded-[16px] sm:rounded-[24px] space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Smartphone size={20} className="text-primary" />
          </div>
          <div className="flex-1 flex justify-between items-center">
            <div>
              <p className="text-xs sm:text-sm font-black uppercase tracking-widest text-primary">M-Pesa Prompt</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">You will receive a payment prompt on your phone.</p>
            </div>
            <button
              onClick={() => setShowAltPayment(!showAltPayment)}
              className="text-[10px] text-primary/80 underline font-bold uppercase tracking-widest hover:text-primary transition-colors text-right ml-2"
            >
              Not using M-Pesa?
            </button>
          </div>
        </div>

        {showAltPayment ? (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 p-4 border border-primary/20 bg-primary/5 rounded-2xl">
            <p className="text-xs text-foreground/80 font-medium">Please leave your details below and our team will call you back immediately to process your payment via card or bank transfer.</p>
            <form onSubmit={handleAltPayment} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] text-primary">Phone Number</label>
                <InternationalPhoneInput
                  value={phone}
                  onChange={(val) => setPhone(val)}
                  disabled={isBusy}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] text-primary">Additional Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={altPaymentNotes}
                  onChange={(e) => setAltPaymentNotes(e.target.value)}
                  placeholder="Preferred alternative payment method (e.g. Visa, Bank Transfer)..."
                  className="w-full px-4 py-3 bg-card/50 border border-border rounded-[14px] text-sm text-foreground focus:ring-2 focus:ring-primary/30 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isBusy || !phone}
                className="w-full py-3 bg-primary rounded-[14px] text-black font-black uppercase tracking-[0.15em] text-xs hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isBusy ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Request Call Back & Go to WhatsApp'}
              </button>
            </form>
          </motion.div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] text-primary">Phone Number</label>
              <InternationalPhoneInput
                value={phone}
                onChange={(val) => setPhone(val)}
                disabled={isBusy}
              />
            </div>
            
            <div className="pt-2 border-t border-primary/10">
              <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground/70">How it works:</strong> Tap the button below, approve the payment prompt on your phone, then return here. No manual transaction code is required.
              </p>
            </div>
          </>
        )}

        {!showAltPayment && (
          <button
            type="button"
            onClick={() => setShowAltPayment(true)}
            className="w-full py-2.5 text-[10px] font-black uppercase tracking-widest text-primary border border-primary/25 rounded-xl hover:bg-primary/5 transition-colors"
          >
            Prefer a call back? Request callback
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-card/50 rounded-[14px] border border-border space-y-1">
            <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Amount (Editable)</label>
            <input
              type="number"
              value={editableAmount}
              onChange={(e) => setEditableAmount(Number(e.target.value))}
              disabled={isBusy}
              className="w-full bg-transparent text-sm sm:text-lg font-black text-foreground border-none outline-none focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="p-3 bg-card/50 rounded-[14px] border border-border">
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Vehicle</p>
            <p className="text-sm sm:text-lg font-black text-foreground truncate">{car.make} {car.model}</p>
          </div>
        </div>

        {phase !== 'ready' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-[14px] border border-border bg-card/50">
            <div className="flex items-start gap-2">
              {phase === 'creating_booking' || phase === 'sending_stk' || phase === 'waiting' || phase === 'manual_pending' ? (
                <Loader2 className={`animate-spin shrink-0 mt-0.5 ${phase === 'manual_pending' ? 'text-blue-500' : 'text-primary'}`} size={16} />
              ) : phase === 'paid' ? (
                <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={16} />
              ) : (
                <AlertCircle className="text-yellow-500 shrink-0 mt-0.5" size={16} />
              )}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-foreground">
                  {phase === 'creating_booking' && 'Creating Booking'}
                  {phase === 'sending_stk' && 'Sending payment prompt'}
                  {phase === 'waiting' && 'Waiting for payment'}
                  {phase === 'paid' && 'Payment confirmed'}
                  {phase === 'manual_pending' && 'Waiting for Verification'}
                  {phase === 'failed' && 'Payment attempt failed'}
                  {phase === 'timeout' && 'Payment still pending'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {lastMessage || 'Please wait while we process your payment.'}
                </p>
                {paymentRequestId && phase !== 'manual_pending' && (
                  <p className="text-[9px] text-muted-foreground/60 mt-1 font-mono">Request: {paymentRequestId.slice(0, 8).toUpperCase()}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div className="px-1 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] sm:text-xs text-muted-foreground">{bookingData.days} Days × KES {car.daily_rate?.toLocaleString()}</span>
          <span className="text-xs sm:text-sm text-muted-foreground">KES {(bookingData.originalAmount || bookingData.totalAmount)?.toLocaleString()}</span>
        </div>
        {bookingData.discount > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-[10px] sm:text-xs text-green-400 font-bold">{bookingData.promoTitle || 'Discount'}</span>
            <span className="text-xs sm:text-sm text-green-400 font-bold">- KES {bookingData.discount?.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between items-end pt-2 border-t border-border">
          <span className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-widest">Total Amount</span>
          <span className="text-sm sm:text-base font-black text-foreground">KES {editableAmount?.toLocaleString()}</span>
        </div>
      </div>

      <div className="p-2.5 sm:p-3 bg-primary/5 rounded-[12px] sm:rounded-[16px] flex gap-2 items-center border border-primary/10">
        <ShieldCheck className="text-primary shrink-0" size={12} />
        <p className="text-[8px] sm:text-[9px] text-primary/80 font-bold uppercase tracking-widest">Secure payment with booking retry support</p>
      </div>

      {(phase === 'failed' || phase === 'timeout') && bookingId && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-[14px] flex gap-2 items-start">
          <Clock className="text-yellow-500 shrink-0 mt-0.5" size={14} />
          <p className="text-[10px] text-yellow-500/90 font-bold uppercase tracking-widest">
            Your booking is still held as pending payment verification. Retry the payment prompt to complete payment.
          </p>
        </div>
      )}

      <div className="flex gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={isBusy}
          className="w-1/5 sm:w-1/4 py-3.5 sm:py-4 bg-card/50 rounded-[14px] sm:rounded-[20px] text-foreground font-black hover:bg-card/70 transition-all flex items-center justify-center disabled:opacity-50 border border-border"
        >
          <ArrowLeft size={18} />
        </button>
        <button
          onClick={handleSendStk}
          disabled={isBusy || !phone}
          className="flex-1 py-3.5 sm:py-4 bg-primary rounded-[14px] sm:rounded-[20px] text-primary-foreground font-black uppercase tracking-[0.12em] text-[11px] sm:text-xs flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 disabled:opacity-40 disabled:hover:scale-100"
        >
          {phase === 'creating_booking' ? (
            <><Loader2 className="animate-spin" size={16} /> Creating Booking...</>
          ) : phase === 'sending_stk' ? (
            <><Loader2 className="animate-spin" size={16} /> Sending payment prompt...</>
          ) : phase === 'waiting' ? (
            <><Loader2 className="animate-spin" size={16} /> Waiting for PIN...</>
          ) : phase === 'failed' || phase === 'timeout' ? (
            <>Retry payment prompt <RefreshCw size={16} /></>
          ) : (
            <>Pay via M-Pesa <CheckCircle2 size={16} /></>
          )}
        </button>
      </div>
    </div>
  );
}