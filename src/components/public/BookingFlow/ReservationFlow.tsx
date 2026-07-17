// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  User, 
  Mail, 
  Phone, 
  CreditCard,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  X,
  ShieldCheck,
  Smartphone,
  RefreshCw,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { reservationService, ReservationData } from '../../../services/reservationService';
import { reservationPaymentService } from '../../../services/reservationPaymentService';
import { Car } from '../../../types';
import { supabase } from '../../../lib/supabase';
import { sendTemplatedEmail } from '../../../services/emailProvider';
import { InternationalPhoneInput } from '../../ui/InternationalPhoneInput';
import { calculateRentalDays } from '../../../utils/rentalDays';
import { generateVehicleSlug } from '../../../utils/urlUtils';

interface ReservationFlowProps {
  car: Car;
  onClose: () => void;
  vehicleModelId?: string | null;
}

export function ReservationFlow({ car, onClose, vehicleModelId }: ReservationFlowProps) {
  const navigate = useNavigate();
  const displayName = `${car.make} ${car.model}`;
  const continuationPath = vehicleModelId ? `/vehicles/${generateVehicleSlug({id: vehicleModelId})}` : `/cars/${car.id}`;
  const [step, setStep] = useState(1);
  const [reservationFee, setReservationFee] = useState(500);
  const [phone, setPhone] = useState('');
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [paymentRequestId, setPaymentRequestId] = useState<string | null>(null);
  const [reservationToken, setReservationToken] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState('');
  const [showAltPayment, setShowAltPayment] = useState(false);
  const [altPaymentNotes, setAltPaymentNotes] = useState('');
  const [phase, setPhase] = useState<'ready' | 'creating_reservation' | 'sending_stk' | 'waiting' | 'paid' | 'failed' | 'timeout' | 'manual_pending'>('ready');
  const [formData, setFormData] = useState<ReservationData>({
    ...(vehicleModelId ? { vehicleModelId } : { carId: car.id }),
    startDate: '',
    endDate: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    notes: ''
  });

  const isBusy = phase === 'creating_reservation' || phase === 'sending_stk' || phase === 'waiting';

  useEffect(() => {
    reservationService.getReservationFee().then(setReservationFee);
  }, []);

  useEffect(() => {
    if (!reservationId) return;

    const channel = supabase
      .channel(`reservation-payment-${reservationId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'car_reservations',
        filter: `id=eq.${reservationId}`,
      }, (payload: any) => {
        const updated = payload.new;
        if (updated.booking_completion_token && !reservationToken) {
          setReservationToken(updated.booking_completion_token);
        }
        if (updated.payment_status === 'paid' && ['reserved', 'confirmed'].includes(updated.status)) {
          setPhase('paid');
          toast.success('Reservation fee confirmed! You can now continue to the full booking flow.');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reservationId, reservationToken]);

  useEffect(() => {
    if (!phone && formData.contactPhone) {
      setPhone(formData.contactPhone);
    }
  }, [formData.contactPhone, phone]);

  const calculateDays = () => calculateRentalDays(formData.startDate, formData.endDate);

  const calculateTotal = () => {
    const days = calculateDays();
    const rentalAmount = car.daily_rate * days;
    return reservationFee + rentalAmount;
  };

  const calculateBookingAmount = () => {
    const days = calculateDays();
    return car.daily_rate * days;
  };

  const validateStep = (currentStep: number) => {
    switch (currentStep) {
      case 1:
        if (!formData.startDate || !formData.endDate) {
          toast.error('Please select both pickup and return dates');
          return false;
        }
        if (formData.startDate >= formData.endDate) {
          toast.error('Return date must be after pickup date');
          return false;
        }
        return true;
      case 2:
        if (!formData.contactName || !formData.contactEmail || !formData.contactPhone) {
          toast.error('Please fill in all contact information fields');
          return false;
        }
        return true;
      case 3:
        if (!formData.startDate || !formData.endDate || !formData.contactName || !formData.contactEmail || !formData.contactPhone) {
          toast.error('Please complete all required information');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const getOrCreateReservation = async () => {
    if (reservationId) return reservationId;

    setPhase('creating_reservation');
    const availability = vehicleModelId
      ? await reservationService.checkModelAvailability(vehicleModelId, formData.startDate, formData.endDate)
      : await reservationService.checkAvailability(formData.carId!, formData.startDate, formData.endDate);

    if (!availability.available) {
      throw new Error('Selected dates are no longer available. Please choose different dates.');
    }

    const reservation = await reservationService.createReservation({
      ...formData,
      reservationFee
    } as any);

    if (!reservation?.id) {
      throw new Error('Failed to create reservation');
    }

    setReservationId(reservation.id);
    if (reservation.booking_completion_token) {
      setReservationToken(reservation.booking_completion_token);
    }

    return reservation.id;
  };

  const handleSendStk = async () => {
    const cleanPhone = phone.replace(/[\s\-+]/g, '');

    if (cleanPhone.length < 9) {
      toast.error('Enter a valid phone number for STK Push');
      return;
    }

    try {
      setLastMessage('');
      const id = await getOrCreateReservation();

      setPhase('sending_stk');
      const stkPromise = reservationPaymentService.initiateSTKPush({ phone: cleanPhone, reservationId: id });
      const timeoutPromise = new Promise<any>((resolve) =>
        setTimeout(() => resolve({ __timedOut: true }), 25000)
      );
      const result: any = await Promise.race([stkPromise, timeoutPromise]);

      if (result?.paymentRequestId) {
        setPaymentRequestId(result.paymentRequestId);
      }

      if (result?.__timedOut) {
        // STK request timed out — we don't have a paymentRequestId to poll.
        setPhase('timeout');
        setLastMessage('Payment prompt is taking longer than usual. If you received the prompt on your phone, enter your PIN — this page will update automatically. Otherwise, tap Retry.');
        toast.message('Still sending STK… check your phone.');
        return;
      } else if (!result?.success && !result?.paymentRequestId) {
        setPhase('failed');
        setLastMessage(result?.error || result?.statusDescription || 'STK Push could not be sent. Please try again.');
        toast.error(result?.error || 'Reservation payment could not be started.');
        return;
      }

      // STK was accepted — move into "waiting" and start polling
      setPhase('waiting');
      setLastMessage(result.statusDescription || 'STK Push sent. Check your phone and enter your PIN.');
      toast.success('Reservation STK Push sent. Check your phone.');

      const pollResult = await reservationPaymentService.pollUntilPaid(
        result.paymentRequestId || '',
        id,
        3000,
        180000,
        3000,
      );

      if (pollResult === 'paid') {
        setPhase('paid');
      } else if (pollResult === 'failed') {
        setPhase('failed');
        setLastMessage('Payment was not completed. You can retry the reservation fee STK Push without creating a new reservation.');
      } else {
        setPhase('timeout');
        setLastMessage('Payment is still pending or timed out. You can retry STK Push for the same reservation.');
      }
    } catch (error: any) {
      console.error('Reservation payment error:', error);
      setPhase('failed');
      setLastMessage(error.message || 'Payment could not be started. Please try again.');
      toast.error(error.message || 'Payment could not be started. Please try again.');
    }
  };

  const handleAltPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) {
      toast.error('Please provide a valid phone number.');
      return;
    }

    try {
      setPhase('creating_reservation');
      const id = await getOrCreateReservation();
      
      const messageContent = `Alternative Payment Request (Reservation Fee)\nReservation ID: ${id}\nVehicle: ${displayName}\nName: ${formData.contactName}\nEmail: ${formData.contactEmail}\nPhone: ${phone}\nReservation Fee: KES ${reservationFee}\nNotes: ${altPaymentNotes}`;
      
      await supabase.from('contact_messages').insert([{
        name: formData.contactName,
        phone: phone,
        email: formData.contactEmail,
        subject: 'Alternative Payment Request (Reservation)',
        message: messageContent,
      }]);

      // Send email to user with tracking link if they provided an email
      if (formData.contactEmail) {
        await sendTemplatedEmail(formData.contactEmail, 'manual_payment_pending', {
          booking_id: id,
          car_name: displayName,
          total_amount: reservationFee.toLocaleString(),
          tracking_link: `${window.location.origin}/booking-confirmation/${id}` // Or my-bookings
        }).catch(err => console.error('Failed to send pending payment email', err));
      }

      toast.success('Request sent! Redirecting to WhatsApp...');
      
      const waMessage = encodeURIComponent(`Hello LinkedUp Cars, I would like to pay the reservation fee for ${displayName} but I'm not using M-Pesa.\n\nMy name is ${formData.contactName} and phone is ${phone}.\nReservation ID: ${id.substring(0,8)}`);
      window.open(`https://wa.me/254714764162?text=${waMessage}`, '_blank');
      
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

  const handleContinueToBooking = async () => {
    try {
      const activeReservationId = reservationId;
      if (!activeReservationId) {
        throw new Error('Reservation was not found');
      }

      // Token is issued at reservation create — use it directly when available (avoids guest RLS issues).
      let token = reservationToken;
      if (!token) {
        const result = await reservationService.prepareBookingContinuation(activeReservationId, 'client');
        token = result?.token || null;
      } else {
        // Best-effort: record flow start via server (service role) without blocking navigation.
        void reservationService.prepareBookingContinuation(activeReservationId, 'client').catch(() => {});
      }

      if (!token) {
        throw new Error('Booking continuation link could not be prepared');
      }

      onClose();
      navigate(`${continuationPath}?booking=true&reservationToken=${token}`);
    } catch (error: any) {
      toast.error(error.message || 'Could not start the booking flow.');
    }
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    } else {
      toast.error('Please fill in all required fields');
    }
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  return (
    <>
      {phase === 'paid' ? (
        <div className="p-8 text-center space-y-4">
          <div className="w-20 h-20 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <h3 className="text-2xl font-serif font-black italic">Reservation Secured!</h3>
          <p className="text-muted-foreground text-sm">Your NCBA reservation fee has been received. This fee is separate and non-deductible from the full booking amount.</p>
          <div className="p-4 bg-warning/10 border border-warning/20 rounded-xl text-left space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reservation Fee Paid</span>
              <span className="font-bold text-warning">KES {reservationFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Booking Amount Due Later</span>
              <span className="font-bold">KES {calculateBookingAmount().toLocaleString()}</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={handleContinueToBooking}
              className="px-5 py-3 bg-warning rounded-xl text-black font-black uppercase tracking-[0.15em] text-xs flex items-center justify-center gap-2 hover:scale-[1.02] transition-all"
            >
              <Lock size={16} />
              Complete Full Booking
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 bg-card/50 border border-border rounded-xl text-foreground font-black uppercase tracking-[0.15em] text-xs hover:bg-card/70 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()} className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 max-h-[90vh] md:max-h-none overflow-y-auto md:overflow-visible">
          <div className="space-y-1">
            <h3 className="text-xl sm:text-2xl md:text-3xl font-serif font-black italic text-warning">Reserve This {vehicleModelId ? 'Model' : 'Car'}</h3>
            <p className="text-muted-foreground text-xs sm:text-sm">Pay the reservation fee via NCBA STK Push to hold this {vehicleModelId ? 'model' : 'car'} for your dates.</p>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-2 sticky top-0 bg-card z-10 pb-2">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  s <= step ? 'bg-warning text-black' : 'bg-muted text-muted-foreground'
                }`}>
                  {s}
                </div>
                {s < 4 && <div className={`flex-1 h-1 rounded-full transition-colors ${
                  s < step ? 'bg-warning' : 'bg-muted'
                }`} />}
              </div>
            ))}
          </div>

      {/* Step 1: Select Dates */}
      {step === 1 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <h4 className="font-bold text-lg">Select Reservation Dates</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pickup Date *</label>
              <input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-warning/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Return Date *</label>
              <input
                type="date"
                required
                min={formData.startDate || new Date().toISOString().split('T')[0]}
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-warning/20"
              />
            </div>
          </div>

          {formData.startDate && formData.endDate && (
            <div className="p-4 bg-warning/5 rounded-xl border border-warning/20">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Rental Period</span>
                <span className="font-bold">{calculateDays()} days</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-muted-foreground">Estimated Booking Amount</span>
                <span className="font-bold">KES {calculateBookingAmount().toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-warning/20">
                <span className="text-sm text-muted-foreground">Reservation Fee Due Now</span>
                <span className="font-bold text-warning">KES {reservationFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-warning/20">
                <span className="text-sm font-bold">Combined Cost if You Later Book</span>
                <span className="text-lg font-bold text-warning">KES {calculateTotal().toLocaleString()}</span>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Step 2: Contact Information */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <h4 className="font-bold text-lg">Contact Information</h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name *</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  type="text"
                  required
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-warning/20"
                  placeholder="John Doe"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address *</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  type="email"
                  required
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-warning/20"
                  placeholder="john@example.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone Number *</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <InternationalPhoneInput
                  required
                  value={formData.contactPhone}
                  onChange={(val) => setFormData({ ...formData, contactPhone: val })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes (Optional)</label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-warning/20"
                placeholder="Any special requests or notes..."
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Step 3: Review & Confirm */}
      {step === 3 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <h4 className="font-bold text-lg">Review & Confirm</h4>
          
          <div className="p-4 bg-warning/5 rounded-xl border border-warning/20 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{vehicleModelId ? 'Model' : 'Car'}</span>
              <span className="font-bold">{displayName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Dates</span>
              <span className="font-bold">{formData.startDate} to {formData.endDate}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Duration</span>
              <span className="font-bold">{calculateDays()} days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Contact</span>
              <span className="font-bold">{formData.contactName}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-warning/20">
              <span className="text-sm text-muted-foreground">Reservation Fee Due Now</span>
              <span className="font-bold text-warning">KES {reservationFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-muted-foreground">Full Booking Amount Due Later</span>
              <span className="font-bold">KES {calculateBookingAmount().toLocaleString()}</span>
            </div>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-amber-600 mt-0.5 flex-shrink-0" size={20} />
              <div className="text-sm text-amber-800">
                <p className="font-bold mb-1">Important Information:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Reservation fee is non-refundable</li>
                  <li>Reservation expires in 24 hours if not paid</li>
                  <li>This holds the car for your selected dates</li>
                  <li>The reservation fee is separate and non-deductible from the full booking amount</li>
                  <li>Full booking payment is completed later in the booking flow</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {step === 4 && phase !== 'paid' && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <h4 className="font-bold text-lg">Pay Reservation Fee</h4>
          
          <div className="p-3 sm:p-5 bg-warning/5 border border-warning/20 rounded-[16px] sm:rounded-[24px] space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
                <Smartphone className="text-warning" size={18} />
              </div>
              <div className="flex-1 flex justify-between items-center">
                <p className="text-xs sm:text-sm font-black uppercase tracking-widest text-warning">NCBA STK Push</p>
                <button
                  type="button"
                  onClick={() => setShowAltPayment(!showAltPayment)}
                  className="text-[10px] text-warning/80 underline font-bold uppercase tracking-widest hover:text-warning transition-colors ml-2"
                >
                  Not using M-Pesa?
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-card/50 rounded-[14px] border border-border space-y-1">
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reservation Fee (STK Amount)</p>
                <p className="text-sm sm:text-lg font-black text-warning">KES {reservationFee.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-card/50 rounded-[14px] border border-border">
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Full Booking Due Later</p>
                <p className="text-sm sm:text-lg font-black text-foreground">KES {calculateBookingAmount().toLocaleString()}</p>
              </div>
            </div>

            {showAltPayment ? (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 p-4 border border-warning/20 bg-warning/5 rounded-2xl">
                <p className="text-xs text-foreground/80 font-medium">Please leave your details below and our team will call you back immediately to process your payment via card or bank transfer.</p>
                <form onSubmit={handleAltPayment} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] text-warning">Phone Number</label>
                    <InternationalPhoneInput
                      value={phone}
                      onChange={(val) => setPhone(val)}
                      disabled={isBusy}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] text-warning">Additional Notes (Optional)</label>
                    <textarea
                      rows={2}
                      value={altPaymentNotes}
                      onChange={(e) => setAltPaymentNotes(e.target.value)}
                      placeholder="Preferred alternative payment method (e.g. Visa, Bank Transfer)..."
                      className="w-full px-4 py-3 bg-card/50 border border-border rounded-[14px] text-sm text-foreground focus:ring-2 focus:ring-warning/30 outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isBusy || !phone}
                    className="w-full py-3 bg-warning rounded-[14px] text-black font-black uppercase tracking-[0.15em] text-xs hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isBusy ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Request Call Back & Go to WhatsApp'}
                  </button>
                </form>
              </motion.div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] text-warning">Phone Number</label>
                  <InternationalPhoneInput
                    value={phone}
                    onChange={(val) => setPhone(val)}
                    disabled={isBusy}
                  />
                </div>

                <div className="pt-2 border-t border-warning/10">
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-relaxed">
                    <strong className="text-foreground/70">How it works:</strong> Tap the button below, approve the NCBA STK Push prompt on your phone, then return here. No manual transaction code is required.
                  </p>
                </div>
              </>
            )}

            {!showAltPayment && (
              <button
                type="button"
                onClick={() => setShowAltPayment(true)}
                className="w-full py-2.5 text-[10px] font-black uppercase tracking-widest text-warning border border-warning/25 rounded-xl hover:bg-warning/5 transition-colors"
              >
                Prefer a call back? Request callback
              </button>
            )}
          </div>

          {phase !== 'ready' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-[14px] border border-border bg-card/50">
              <div className="flex items-start gap-2">
                {phase === 'creating_reservation' || phase === 'sending_stk' || phase === 'waiting' || phase === 'manual_pending' ? (
                  <Loader2 className={`animate-spin shrink-0 mt-0.5 ${phase === 'manual_pending' ? 'text-blue-500' : 'text-warning'}`} size={16} />
                ) : (
                  <AlertCircle className="text-yellow-500 shrink-0 mt-0.5" size={16} />
                )}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-foreground">
                    {phase === 'creating_reservation' && 'Creating reservation'}
                    {phase === 'sending_stk' && 'Sending STK Push'}
                    {phase === 'waiting' && 'Waiting for payment'}
                    {phase === 'manual_pending' && 'Waiting for Verification'}
                    {phase === 'failed' && 'Payment attempt failed'}
                    {phase === 'timeout' && 'Payment still pending'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {lastMessage || 'Please wait while we process your reservation fee payment.'}
                  </p>
                  {paymentRequestId && (
                    <p className="text-[9px] text-muted-foreground/60 mt-1 font-mono">Request: {paymentRequestId.slice(0, 8).toUpperCase()}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          <div className="p-2.5 sm:p-3 bg-primary/5 rounded-[12px] sm:rounded-[16px] flex gap-2 items-center border border-primary/10">
            <ShieldCheck className="text-primary shrink-0" size={12} />
            <p className="text-[8px] sm:text-[9px] text-primary/80 font-bold uppercase tracking-widest">Secure NCBA reservation fee with retry support and 24-hour hold activation after payment</p>
          </div>

          {(phase === 'failed' || phase === 'timeout') && reservationId && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-[14px] flex gap-2 items-start">
              <Clock className="text-yellow-500 shrink-0 mt-0.5" size={14} />
              <p className="text-[10px] text-yellow-500/90 font-bold uppercase tracking-widest">
                Your reservation record is still open as pending payment. Retry STK Push to complete the reservation fee.
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Navigation Buttons */}
          <div className="flex gap-2 sm:gap-4">
            <button
              type="button"
              onClick={step === 1 ? onClose : prevStep}
              disabled={isBusy}
              className="w-1/5 sm:w-1/4 py-3.5 sm:py-5 bg-card/50 rounded-[14px] sm:rounded-[24px] text-foreground font-black uppercase tracking-widest hover:bg-card/70 transition-all flex items-center justify-center border border-border disabled:opacity-50 disabled:hover:bg-card/50"
            >
              {step === 1 ? <X size={18} /> : <ArrowLeft size={18} />}
            </button>
            
            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={isBusy}
                className="flex-1 py-3.5 sm:py-5 bg-warning rounded-[14px] sm:rounded-[24px] text-black font-black uppercase tracking-[0.15em] text-[11px] sm:text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-warning/20 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Processing...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            ) : step === 3 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={isBusy}
                className="flex-1 py-3.5 sm:py-5 bg-warning rounded-[14px] sm:rounded-[24px] text-black font-black uppercase tracking-[0.15em] text-[11px] sm:text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-warning/20 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Processing...
                  </>
                ) : (
                  <>
                    Proceed to Reservation Payment
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSendStk}
                disabled={isBusy || !phone}
                className="flex-1 py-3.5 sm:py-5 bg-warning rounded-[14px] sm:rounded-[24px] text-black font-black uppercase tracking-[0.15em] text-[11px] sm:text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-warning/20 disabled:opacity-40 disabled:hover:scale-100"
              >
                {phase === 'creating_reservation' ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Creating Reservation...
                  </>
                ) : phase === 'sending_stk' ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Sending STK...
                  </>
                ) : phase === 'waiting' ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Waiting for PIN...
                  </>
                ) : phase === 'failed' || phase === 'timeout' ? (
                  <>
                    Retry STK Push <RefreshCw size={18} />
                  </>
                ) : (
                  <>
                    <CreditCard size={18} />
                    Send NCBA STK Push
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      )}
    </>
  );
}