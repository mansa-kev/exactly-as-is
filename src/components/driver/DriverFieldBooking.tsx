import React, { useState, useEffect, useRef } from 'react';
import { adminService } from '../../services/adminService';
import { reservationService } from '../../services/reservationService';
import { paymentService } from '../../services/paymentService';
import { enhancedContractService } from '../../services/enhancedContractService';
import { generateAndSaveContract } from '../../services/contractPdfService';
import { DirectContractDisplay } from '../public/BookingFlow/DirectContractDisplay';
import { supabase } from '../../lib/supabase';
import {
  Calendar as CalendarIcon,
  Car,
  User,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Search,
  ArrowRight,
  ArrowLeft,
  PenTool,
  Phone,
  Mail,
  Loader2,
  Building2,
  X,
  FileText,
  Plus,
  UserCheck,
  Percent
} from 'lucide-react';
import { toast } from 'sonner';
import { InternationalPhoneInput } from '../ui/InternationalPhoneInput';

interface DriverFieldBookingProps {
  onBack: () => void;
}

type Step = 'vehicle' | 'client' | 'signature' | 'payment' | 'success';

interface Broker {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  default_commission_rate: number;
}

export function DriverFieldBooking({ onBack }: DriverFieldBookingProps) {
  const [currentStep, setCurrentStep] = useState<Step>('vehicle');
  const [loading, setLoading] = useState(false);
  const [cars, setCars] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [searchCar, setSearchCar] = useState('');
  const signatureRef = useRef<HTMLCanvasElement>(null);

  // Broker referral state
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>('');
  const [brokerCommissionRate, setBrokerCommissionRate] = useState<string>('');
  
  // Booking State
  const [bookingData, setBookingData] = useState({
    carId: '',
    startDate: '',
    endDate: '',
    totalAmount: 0,
    fullName: '',
    phone: '',
    email: '',
    idNumber: '',
    documentsVerifiedPhysically: true,
    signatureUrl: '',
    paymentMethod: 'stk_push',
    bankReference: ''
  });

  const [bookingId, setBookingId] = useState<string | null>(null);
  const [paymentRequestId, setPaymentRequestId] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [contract, setContract] = useState<any>(null);
  const [loadingContract, setLoadingContract] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // Load cars, brokers and contract on mount
  useEffect(() => {
    const loadInitData = async () => {
      setLoading(true);
      try {
        const carsResult = await adminService.getCars(1, 100);
        if (carsResult?.data) setCars(carsResult.data);
        
        // Fetch brokers
        const { data: brokerData } = await supabase
          .from('brokers')
          .select('*')
          .order('name', { ascending: true });
        setBrokers(brokerData || []);

        setLoadingContract(true);
        const contractResult = await enhancedContractService.getMasterContract();
        if (contractResult) setContract(contractResult);
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
        setLoadingContract(false);
      }
    };
    loadInitData();
  }, []);

  // When broker is selected, auto-populate their default rate
  const handleBrokerSelect = (brokerId: string) => {
    setSelectedBrokerId(brokerId);
    const broker = brokers.find(b => b.id === brokerId);
    if (broker) setBrokerCommissionRate(String(broker.default_commission_rate));
    else setBrokerCommissionRate('');
  };

  const updateData = (updates: Partial<typeof bookingData>) => {
    setBookingData(prev => ({ ...prev, ...updates }));
  };

  const getBookingDays = () => {
    if (!bookingData.startDate || !bookingData.endDate) return 0;
    const start = new Date(bookingData.startDate);
    const end = new Date(bookingData.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) return 0;
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
  };

  const handleCheckAvailability = async () => {
    if (!bookingData.carId || !bookingData.startDate || !bookingData.endDate) {
      toast.error('Please select a car and date range');
      return;
    }
    
    const start = new Date(bookingData.startDate);
    const end = new Date(bookingData.endDate);
    
    if (start >= end) {
      toast.error('End date must be after start date');
      return;
    }

    setLoading(true);
    const result = await reservationService.checkAvailability(bookingData.carId, bookingData.startDate, bookingData.endDate);
    setLoading(false);

    if (result.available) {
      const selectedCar = cars.find(c => c.id === bookingData.carId);
      if (selectedCar) {
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
        updateData({ totalAmount: days * (selectedCar.daily_rate || 0) });
      }
      toast.success('Car is available!');
      setCurrentStep('client');
    } else {
      toast.error('Car is not available for these dates.');
    }
  };

  const handleClientSubmit = () => {
    if (!bookingData.fullName || !bookingData.phone || !bookingData.idNumber) {
      toast.error('Please fill in all required client fields');
      return;
    }
    setCurrentStep('signature');
  };

  // Signature canvas setup
  useEffect(() => {
    if (currentStep === 'signature' && signatureRef.current) {
      const canvas = signatureRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;

      let drawing = false;

      const getPos = (e: MouseEvent | TouchEvent) => {
        const rect = canvas.getBoundingClientRect();
        if (e instanceof MouseEvent) {
          return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        } else {
          return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
      };

      const startDrawing = (e: MouseEvent | TouchEvent) => {
        drawing = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      };

      const draw = (e: MouseEvent | TouchEvent) => {
        if (!drawing) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      };

      const stopDrawing = () => {
        drawing = false;
      };

      canvas.addEventListener('mousedown', startDrawing);
      canvas.addEventListener('mousemove', draw);
      canvas.addEventListener('mouseup', stopDrawing);

      canvas.addEventListener('touchstart', startDrawing, { passive: false });
      canvas.addEventListener('touchmove', draw, { passive: false });
      canvas.addEventListener('touchend', stopDrawing);

      return () => {
        canvas.removeEventListener('mousedown', startDrawing);
        canvas.removeEventListener('mousemove', draw);
        canvas.removeEventListener('mouseup', stopDrawing);

        canvas.removeEventListener('touchstart', startDrawing);
        canvas.removeEventListener('touchmove', draw);
        canvas.removeEventListener('touchend', stopDrawing);
      };
    }
  }, [currentStep]);

  const clearSignature = () => {
    const canvas = signatureRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const saveSignatureAndProceed = () => {
    if (!agreed) {
      toast.error('Please confirm agreement to the terms first.');
      return;
    }
    const canvas = signatureRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      updateData({ signatureUrl: dataUrl });
    } else {
      updateData({ signatureUrl: 'signed_physically_in_person' });
    }
    setCurrentStep('payment');
  };

  const handleCreateBooking = async () => {
    setLoading(true);
    try {
      // Calculate broker commission
      const brokerRate = selectedBrokerId && brokerCommissionRate ? Number(brokerCommissionRate) : 0;
      const brokerCommissionAmount = brokerRate > 0
        ? Math.round((bookingData.totalAmount * brokerRate / 100) * 100) / 100
        : 0;

      const result = await adminService.createConciergeBooking({
        carId: bookingData.carId,
        startDate: bookingData.startDate,
        endDate: bookingData.endDate,
        totalAmount: bookingData.totalAmount,
        fullName: bookingData.fullName,
        phone: bookingData.phone,
        email: bookingData.email,
        idNumber: bookingData.idNumber,
        signatureUrl: bookingData.signatureUrl,
        documentsVerifiedPhysically: bookingData.documentsVerifiedPhysically,
        paymentMethod: bookingData.paymentMethod,
        // Broker referral fields
        brokerId: selectedBrokerId || null,
        brokerCommissionRate: brokerRate,
        brokerCommissionAmount
      });
      
      setBookingId(result.id);

      const carForContract = cars.find((c) => c.id === bookingData.carId);
      if (
        contract &&
        carForContract &&
        bookingData.signatureUrl &&
        bookingData.signatureUrl !== 'signed_physically_in_person'
      ) {
        try {
          await generateAndSaveContract(result.id, {
            contract,
            bookingData: {
              fullName: bookingData.fullName,
              email: bookingData.email,
              phone: bookingData.phone,
              idNumber: bookingData.idNumber,
              startDate: bookingData.startDate,
              endDate: bookingData.endDate,
              totalAmount: bookingData.totalAmount,
              signatureUrl: bookingData.signatureUrl,
            },
            car: carForContract,
            signatureData: bookingData.signatureUrl,
          });
        } catch (contractErr: any) {
          console.error('Failed to save field booking contract PDF:', contractErr);
          toast.error(
            contractErr?.message ||
              'Booking created, but the signed contract PDF could not be saved. Regenerate it from the booking details page.'
          );
        }
      }
      
      if (bookingData.paymentMethod === 'stk_push') {
        const pushResult = await paymentService.initiateSTKPush({
          phone: bookingData.phone,
          bookingId: result.id
        });
        
        if (pushResult.success && pushResult.paymentRequestId) {
          setPaymentRequestId(pushResult.paymentRequestId);
          startPolling(pushResult.paymentRequestId, result.id);
        } else {
          toast.error(pushResult.error || 'Failed to send STK Push');
        }
      } else if (bookingData.paymentMethod === 'bank_transfer') {
        if (!bookingData.bankReference) {
          toast.error('Please provide a bank reference');
          setLoading(false);
          return;
        }
        await adminService.confirmBankTransferPayment(result.id, bookingData.bankReference);
        toast.success('Bank transfer confirmed!');
        setCurrentStep('success');
      } else if (bookingData.paymentMethod === 'payment_link') {
        toast.success('Booking recorded. Payment link generated.');
        setCurrentStep('success');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const startPolling = async (reqId: string, bId: string) => {
    setPolling(true);
    toast.info('Waiting for client to enter PIN...');
    
    const status = await paymentService.pollUntilPaid(reqId, bId);
    setPolling(false);
    
    if (status === 'paid') {
      toast.success('Payment Received!');
      setCurrentStep('success');
    } else if (status === 'timeout') {
      toast.error('Payment timed out. Client took too long.');
    } else {
      toast.error('Payment failed or was cancelled.');
    }
  };

  const selectedCar = cars.find(c => c.id === bookingData.carId);

  return (
    <div className="bg-card border border-border rounded-2xl p-6 md:p-8 animate-in slide-in-from-right-4 duration-300">
      <div className="border-b border-border pb-4 mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Plus className="text-primary" /> Create Field Booking
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Book a vehicle for a client directly from the field</p>
        </div>
        <button onClick={onBack} disabled={loading || polling} className="text-xs font-bold text-muted-foreground hover:text-foreground">Back to Portal</button>
      </div>

      {/* Wizard Steps */}
      <div className="flex justify-between items-center mb-8 bg-muted/30 border border-border rounded-xl p-3 max-w-lg mx-auto">
        {['vehicle', 'client', 'signature', 'payment'].map((step, idx) => {
          const steps = ['vehicle', 'client', 'signature', 'payment'];
          const activeIdx = steps.indexOf(currentStep);
          const isPassed = idx < activeIdx;
          const isActive = idx === activeIdx;

          return (
            <div key={step} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black uppercase tracking-wider ${
                isActive ? 'bg-primary text-primary-foreground font-bold shadow' : isPassed ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-muted border border-border text-muted-foreground'
              }`}>
                {isPassed ? <CheckCircle2 size={12} /> : idx + 1}
              </div>
              <span className="text-[9px] font-black uppercase tracking-wider hidden sm:block">{step}</span>
            </div>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="max-w-xl mx-auto">
        {currentStep === 'vehicle' && (
          <div className="space-y-6">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Select Vehicle & Dates</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Search Vehicle</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
                  <input
                    type="text"
                    placeholder="Search make or model..."
                    value={searchCar}
                    onChange={e => setSearchCar(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div className="h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border scrollbar-thin">
                {cars.filter(c => `${c.make} ${c.model}`.toLowerCase().includes(searchCar.toLowerCase())).map(car => (
                  <button
                    key={car.id}
                    onClick={() => updateData({ carId: car.id })}
                    className={`w-full text-left p-3 flex items-center gap-3 transition-colors ${
                      bookingData.carId === car.id ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-muted/50 border-l-2 border-transparent'
                    }`}
                  >
                    {car.primary_image_url ? (
                      <img src={car.primary_image_url} alt={car.make} className="w-12 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-10 rounded-lg bg-muted flex items-center justify-center"><Car size={16} className="text-muted-foreground"/></div>
                    )}
                    <div>
                      <p className="font-bold text-sm">{car.make} {car.model}</p>
                      <p className="text-xs text-primary font-bold">KES {(car.daily_rate || 0).toLocaleString()}/day</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Start Date</label>
                  <input
                    type="date"
                    value={bookingData.startDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => updateData({ startDate: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">End Date</label>
                  <input
                    type="date"
                    value={bookingData.endDate}
                    min={bookingData.startDate || new Date().toISOString().split('T')[0]}
                    onChange={e => updateData({ endDate: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <button onClick={handleCheckAvailability} disabled={loading} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/95 transition-all">
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'Check Availability'} <ArrowRight size={18} />
            </button>
          </div>
        )}

        {currentStep === 'client' && (
          <div className="space-y-6">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Client Details</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Client Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-muted-foreground" size={16} />
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    value={bookingData.fullName}
                    onChange={e => updateData({ fullName: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">M-Pesa Phone Number *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 text-muted-foreground" size={16} />
                  <InternationalPhoneInput
                    value={bookingData.phone}
                    onChange={val => updateData({ phone: val })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Email Address (Optional)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-muted-foreground" size={16} />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={bookingData.email}
                    onChange={e => updateData({ email: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">National ID / Passport Number *</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 text-muted-foreground" size={16} />
                  <input
                    type="text"
                    required
                    placeholder="ID or Passport Number"
                    value={bookingData.idNumber}
                    onChange={e => updateData({ idNumber: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {/* Broker Referral Section */}
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <UserCheck size={16} className="text-purple-500" />
                <h3 className="font-bold text-sm text-foreground">Broker / Agent Referral <span className="text-muted-foreground font-normal">(Optional)</span></h3>
              </div>
              <p className="text-xs text-muted-foreground">If this client was referred by a registered broker, select them below. Commission will be automatically calculated and queued for payout upon booking completion.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Referring Broker</label>
                  <select
                    value={selectedBrokerId}
                    onChange={e => handleBrokerSelect(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary"
                  >
                    <option value="">No broker referral</option>
                    {brokers.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.default_commission_rate}%)</option>
                    ))}
                  </select>
                </div>
                {selectedBrokerId && (
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Commission Rate (%)</label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                      <input
                        type="number"
                        value={brokerCommissionRate}
                        onChange={e => setBrokerCommissionRate(e.target.value)}
                        placeholder="10"
                        className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:border-primary"
                      />
                    </div>
                    {brokerCommissionRate && bookingData.totalAmount > 0 && (
                      <p className="text-xs text-purple-500 font-bold mt-1">
                        Commission: KSh {Math.round(bookingData.totalAmount * Number(brokerCommissionRate) / 100).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setCurrentStep('vehicle')} className="px-6 py-3 bg-muted text-muted-foreground rounded-xl font-bold flex items-center gap-2 hover:bg-muted/80 transition-colors">
                <ArrowLeft size={18} /> Back
              </button>
              <button onClick={handleClientSubmit} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/95 transition-colors">
                Continue <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {currentStep === 'signature' && (
          <div className="space-y-6">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Rental Agreement</h3>
            
            <div className="space-y-4">
              {loadingContract ? (
                <div className="p-8 bg-muted/10 rounded-2xl border border-border text-center flex flex-col items-center justify-center gap-3">
                  <Loader2 className="animate-spin text-primary" size={24} />
                  <span className="text-sm font-bold">Loading contract template...</span>
                </div>
              ) : !contract ? (
                <div className="p-8 bg-yellow-500/10 rounded-2xl border border-yellow-500/20 text-center space-y-2">
                  <AlertCircle className="mx-auto text-yellow-500" size={32} />
                  <h3 className="font-bold text-yellow-600 dark:text-yellow-400">No Active Contract Template</h3>
                  <p className="text-xs text-yellow-750/80 dark:text-yellow-300/80">
                    Please upload and activate a contract template in the admin panel first.
                  </p>
                </div>
              ) : (
                <div className="border border-border rounded-2xl overflow-hidden bg-card text-xs">
                  <DirectContractDisplay
                    contract={contract}
                    bookingData={{
                      ...bookingData,
                      days: getBookingDays(),
                    }}
                    car={selectedCar}
                  />
                </div>
              )}
            </div>

            <div className="bg-muted/10 border border-border rounded-2xl p-4 space-y-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="driver-agree-contract"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                />
                <label htmlFor="driver-agree-contract" className="text-xs font-bold text-muted-foreground select-none cursor-pointer leading-normal">
                  The client has reviewed, understood, and agrees to be bound by all terms, conditions, and policies outlined in this Rental Agreement.
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground">Digital Signature (Have the client draw below):</p>
                <div className="bg-white border border-border rounded-xl overflow-hidden relative touch-none">
                  <canvas 
                     ref={signatureRef} 
                     width={800} 
                     height={200} 
                     className="w-full max-w-full cursor-crosshair touch-none bg-white"
                     style={{ touchAction: 'none' }}
                  ></canvas>
                </div>
                <div className="flex justify-end">
                  <button onClick={clearSignature} className="text-xs font-bold text-muted-foreground hover:text-foreground">Clear Signature</button>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setCurrentStep('client')} className="px-6 py-3 bg-muted text-muted-foreground rounded-xl font-bold flex items-center gap-2 hover:bg-muted/80 transition-colors">
                <ArrowLeft size={18} /> Back
              </button>
              <button 
                onClick={saveSignatureAndProceed} 
                disabled={!agreed}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/95 transition-colors disabled:opacity-50"
              >
                Sign & Continue <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {currentStep === 'payment' && (
          <div className="space-y-6">
            <div className="flex justify-between items-end border-b border-border pb-4">
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Secure Payment</h3>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Due</p>
                <p className="text-2xl font-black text-primary">KES {bookingData.totalAmount.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button 
                onClick={() => updateData({ paymentMethod: 'stk_push' })} 
                className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                  bookingData.paymentMethod === 'stk_push' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <Phone size={24} />
                <span className="font-bold text-xs text-center">M-Pesa STK Push</span>
              </button>
              <button 
                onClick={() => updateData({ paymentMethod: 'bank_transfer' })} 
                className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                  bookingData.paymentMethod === 'bank_transfer' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <Building2 size={24} />
                <span className="font-bold text-xs text-center">Bank Transfer</span>
              </button>
              <button 
                onClick={() => updateData({ paymentMethod: 'payment_link' })} 
                className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                  bookingData.paymentMethod === 'payment_link' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <CreditCard size={24} />
                <span className="font-bold text-xs text-center">Send Payment Link</span>
              </button>
            </div>

            {bookingData.paymentMethod === 'bank_transfer' && (
              <div className="bg-muted/20 border border-border rounded-xl p-4 animate-in fade-in duration-200 space-y-3">
                 <h4 className="font-bold text-xs">Log Bank Transfer</h4>
                 <p className="text-xs text-muted-foreground">Input the bank transfer reference code to confirm payment and finalize the booking.</p>
                 <input 
                   type="text" 
                   placeholder="e.g. REF123456789" 
                   value={bookingData.bankReference}
                   onChange={e => updateData({ bankReference: e.target.value.toUpperCase() })}
                   className="w-full bg-background border border-border rounded-xl px-4 py-2.5 font-mono font-bold text-sm focus:border-primary outline-none"
                 />
              </div>
            )}

            {bookingData.paymentMethod === 'stk_push' && polling && (
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-6 flex flex-col items-center justify-center text-center animate-pulse gap-2">
                <Loader2 size={24} className="text-primary animate-spin" />
                <h4 className="font-bold text-sm text-primary">Waiting for client PIN...</h4>
                <p className="text-xs text-primary/80">Prompt sent to {bookingData.phone}.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setCurrentStep('signature')} disabled={loading || polling} className="px-6 py-3 bg-muted text-muted-foreground rounded-xl font-bold flex items-center gap-2 hover:bg-muted/80 transition-colors disabled:opacity-50">
                <ArrowLeft size={18} /> Back
              </button>
              <button onClick={handleCreateBooking} disabled={loading || polling} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/95 transition-all disabled:opacity-50">
                 {loading ? <Loader2 size={18} className="animate-spin" /> : 
                  bookingData.paymentMethod === 'stk_push' ? 'Trigger STK & Book' : 
                  bookingData.paymentMethod === 'payment_link' ? 'Generate Link & Book' : 'Confirm Transfer & Book'}
              </button>
            </div>
          </div>
        )}

        {currentStep === 'success' && (
          <div className="py-8 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-150">
             <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-4">
               <CheckCircle2 size={32} />
             </div>
             <h2 className="text-2xl font-black mb-1">Booking Confirmed!</h2>
             <p className="text-muted-foreground text-xs mb-6">The booking has been successfully saved in the ledger.</p>
             
             <div className="bg-muted/30 border border-border rounded-xl p-4 w-full text-left space-y-2 mb-6 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-bold">Booking ID</span>
                  <span className="font-mono font-bold">{bookingId?.split('-')[0].toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-bold">Client</span>
                  <span className="font-bold">{bookingData.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-bold">Vehicle</span>
                  <span className="font-bold">{selectedCar?.make} {selectedCar?.model}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="text-muted-foreground font-bold">Amount Paid</span>
                  <span className="font-black text-primary">KES {bookingData.totalAmount.toLocaleString()}</span>
                </div>
             </div>

             <div className="flex flex-col gap-3 w-full">
               {bookingData.paymentMethod === 'payment_link' && bookingId && (
                 <a 
                   href={`https://wa.me/${bookingData.phone.replace('+', '')}?text=${encodeURIComponent(`Hello ${bookingData.fullName}, your booking at LinkedUp Cars is confirmed. Please complete your payment using this secure link: ${window.location.origin}/pay/${bookingId}`)}`}
                   target="_blank"
                   rel="noreferrer"
                   className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all"
                 >
                   <Phone size={18} /> Share Payment Link on WhatsApp
                 </a>
               )}
               <button onClick={() => window.location.reload()} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/95 transition-all">
                 Done & Return
               </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
