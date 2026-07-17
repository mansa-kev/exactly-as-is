import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fleetService } from '../../services/fleetService';
import { bookingService } from '../../services/bookingService';
import { paymentService } from '../../services/paymentService';
import { enhancedContractService } from '../../services/enhancedContractService';
import { generateAndSaveContract } from '../../services/contractPdfService';
import { supabase } from '../../lib/supabase';
import { DirectContractDisplay } from '../public/BookingFlow/DirectContractDisplay';
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
  Upload,
  Phone,
  Mail,
  Loader2,
  RefreshCw,
  X,
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { InternationalPhoneInput } from '../ui/InternationalPhoneInput';

type Step = 'vehicle' | 'client' | 'documents' | 'signature' | 'payment' | 'success';

export function FleetConciergeBooking() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('vehicle');
  const [loading, setLoading] = useState(false);
  const [cars, setCars] = useState<any[]>([]);
  const [searchCar, setSearchCar] = useState('');
  const signatureRef = useRef<HTMLCanvasElement>(null);
  
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
    facePhotoUrl: '',
    licenseFrontUrl: '',
    licenseBackUrl: '',
    idFrontUrl: '',
    idBackUrl: '',
    paymentMethod: 'stk_push',
    bankReference: ''
  });

  const [bookingId, setBookingId] = useState<string | null>(null);
  const [paymentRequestId, setPaymentRequestId] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState<Record<string, boolean>>({});
  
  const [contract, setContract] = useState<any>(null);
  const [loadingContract, setLoadingContract] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // Load owned cars on mount
  useEffect(() => {
    const fetchCars = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: carsData, error } = await supabase
            .from('cars')
            .select('*')
            .eq('fleet_owner_id', user.id);
          if (!error && carsData) setCars(carsData);
        }
      } catch (err) {
        console.error('Error fetching fleet owner cars:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCars();
  }, []);

  // Load active contract template on mount
  useEffect(() => {
    const fetchContract = async () => {
      setLoadingContract(true);
      try {
        const contract = await enhancedContractService.getMasterContract();
        if (contract) setContract(contract);
      } catch (error) {
        console.error('Error fetching contract:', error);
      } finally {
        setLoadingContract(false);
      }
    };
    fetchContract();
  }, []);

  const updateData = (updates: Partial<typeof bookingData>) => {
    setBookingData(prev => ({ ...prev, ...updates }));
  };

  const handleUploadDocument = async (file: File, type: string) => {
    setUploadingDocs(prev => ({ ...prev, [type]: true }));
    try {
      const url = await bookingService.uploadDocument(file, type, `temp_fleet_concierge_${Date.now()}`);
      updateData({ [`${type}Url`]: url });
      toast.success(`${type.replace(/([A-Z])/g, ' $1')} uploaded successfully!`);
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message || err}`);
    } finally {
      setUploadingDocs(prev => ({ ...prev, [type]: false }));
    }
  };

  const getBookingDays = () => {
    if (!bookingData.startDate || !bookingData.endDate) return 0;
    const start = new Date(bookingData.startDate);
    const end = new Date(bookingData.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const calculateAmount = () => {
    const car = cars.find(c => c.id === bookingData.carId);
    if (!car) return 0;
    const days = getBookingDays();
    return car.daily_rate * days;
  };

  useEffect(() => {
    const amt = calculateAmount();
    updateData({ totalAmount: amt });
  }, [bookingData.carId, bookingData.startDate, bookingData.endDate, cars]);

  // Signature Pad Handling
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateData({ signatureUrl: '' });
  };

  const saveSignature = async () => {
    const canvas = signatureRef.current;
    if (!canvas) return;
    
    // Check if canvas is blank
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      toast.error('Please provide a signature first.');
      return;
    }

    try {
      setLoading(true);
      const dataUrl = canvas.toDataURL('image/png');
      const blob = await fetch(dataUrl).then(res => res.blob());
      const file = new File([blob], 'signature.png', { type: 'image/png' });
      const url = await bookingService.uploadDocument(file, 'signature', `sig_concierge_${Date.now()}`);
      updateData({ signatureUrl: url });
      toast.success('Signature saved successfully!');
    } catch (err: any) {
      toast.error(`Signature save failed: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBooking = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload = {
        carId: bookingData.carId,
        startDate: bookingData.startDate,
        endDate: bookingData.endDate,
        totalAmount: bookingData.totalAmount,
        pickupLocation: 'Nairobi',
        dropoffLocation: 'Nairobi',
        paymentMethod: bookingData.paymentMethod === 'stk_push' ? 'ncba_stk' : 'cash',
        bookingFlowInitiatedBy: 'fleet_owner',
        fullName: bookingData.fullName,
        phone: bookingData.phone,
        email: bookingData.email,
        idNumber: bookingData.idNumber,
        signatureUrl: bookingData.signatureUrl,
        facePhotoUrl: bookingData.facePhotoUrl,
        licenseFrontUrl: bookingData.licenseFrontUrl,
        licenseBackUrl: bookingData.licenseBackUrl,
        idFrontUrl: bookingData.idFrontUrl,
        idBackUrl: bookingData.idBackUrl,
      };

      const booking = await bookingService.createBooking(payload);
      if (!booking?.id) throw new Error('Booking creation returned empty payload');

      setBookingId(booking.id);
      
      if (
        contract &&
        bookingData.signatureUrl &&
        bookingData.signatureUrl !== 'signed_physically_in_person' &&
        selectedCarDetails
      ) {
        try {
          await generateAndSaveContract(booking.id, {
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
            car: selectedCarDetails,
            signatureData: bookingData.signatureUrl,
          });
        } catch (contractErr: any) {
          console.error('Failed to create contract:', contractErr);
          toast.error(
            contractErr?.message ||
              'Booking created, but the signed contract PDF could not be saved. Regenerate it from the booking details page.'
          );
        }
      }

      if (bookingData.paymentMethod === 'stk_push') {
        setCurrentStep('payment');
        handleSendStk(booking.id);
      } else {
        // Direct cash payment approval
        const { error: payError } = await supabase
          .from('bookings')
          .update({ payment_status: 'paid', status: 'confirmed' })
          .eq('id', booking.id);
        if (payError) throw payError;
        setCurrentStep('success');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create concierge booking');
    } finally {
      setLoading(false);
    }
  };

  const handleSendStk = async (bId: string) => {
    const targetId = bId || bookingId;
    if (!targetId) return;

    setPolling(true);
    try {
      const cleanPhone = bookingData.phone.replace(/[\s\-+]/g, '');
      const result = await paymentService.initiateSTKPush({
        phone: cleanPhone,
        bookingId: targetId
      });

      if (result.paymentRequestId) {
        setPaymentRequestId(result.paymentRequestId);
      }

      if (!result.success || !result.paymentRequestId) {
        toast.error(result.error || 'STK Push failed to initiate.');
        setPolling(false);
        return;
      }

      toast.success('STK Push sent to customer phone!');
      
      const pollResult = await paymentService.pollUntilPaid(result.paymentRequestId, targetId);
      if (pollResult === 'paid') {
        toast.success('Payment confirmed!');
        setCurrentStep('success');
      } else {
        toast.error('STK Push timed out or failed.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Payment processing error');
    } finally {
      setPolling(false);
    }
  };

  const selectedCarDetails = cars.find(c => c.id === bookingData.carId);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Concierge Field Booking</h2>
        <p className="text-muted-foreground text-sm">Register a booking directly for a walk-in client.</p>
      </div>

      {/* Progress Steps */}
      <div className="flex justify-between items-center bg-card p-4 rounded-2xl border border-border">
        {['vehicle', 'client', 'documents', 'signature', 'payment', 'success'].map((step, idx) => (
          <div key={step} className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              currentStep === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {idx + 1}
            </span>
            <span className="text-xs font-medium uppercase tracking-wider hidden md:inline">{step}</span>
          </div>
        ))}
      </div>

      <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
        {/* Step 1: Vehicle Selection */}
        {currentStep === 'vehicle' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold">1. Select Vehicle & Dates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Car</label>
                <select 
                  value={bookingData.carId} 
                  onChange={(e) => updateData({ carId: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="">-- Choose Car --</option>
                  {cars.map(c => (
                    <option key={c.id} value={c.id}>{c.make} {c.model} ({c.license_plate})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Start Date</label>
                  <input 
                    type="date" 
                    value={bookingData.startDate}
                    onChange={(e) => updateData({ startDate: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">End Date</label>
                  <input 
                    type="date" 
                    value={bookingData.endDate}
                    onChange={(e) => updateData({ endDate: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
              </div>
            </div>

            {selectedCarDetails && getBookingDays() > 0 && (
              <div className="p-4 bg-muted rounded-xl flex justify-between items-center text-sm font-bold">
                <span>Daily Rate: Ksh {selectedCarDetails.daily_rate.toLocaleString()} × {getBookingDays()} Days</span>
                <span className="text-primary text-lg">Total: Ksh {bookingData.totalAmount.toLocaleString()}</span>
              </div>
            )}

            <button 
              onClick={() => setCurrentStep('client')}
              disabled={!bookingData.carId || !bookingData.startDate || !bookingData.endDate}
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
            >
              Continue <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Step 2: Client Profile Info */}
        {currentStep === 'client' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold">2. Client Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</label>
                <input 
                  type="text" 
                  value={bookingData.fullName}
                  onChange={(e) => updateData({ fullName: e.target.value })}
                  placeholder="Client Name"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone Number</label>
                <InternationalPhoneInput 
                  value={bookingData.phone}
                  onChange={(val) => updateData({ phone: val })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address</label>
                <input 
                  type="email" 
                  value={bookingData.email}
                  onChange={(e) => updateData({ email: e.target.value })}
                  placeholder="client@example.com"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">National ID / Passport</label>
                <input 
                  type="text" 
                  value={bookingData.idNumber}
                  onChange={(e) => updateData({ idNumber: e.target.value })}
                  placeholder="ID Number"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setCurrentStep('vehicle')}
                className="px-6 py-4 bg-muted hover:bg-muted/80 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <ArrowLeft size={18} /> Back
              </button>
              <button 
                onClick={() => setCurrentStep('documents')}
                disabled={!bookingData.fullName || !bookingData.phone || !bookingData.email || !bookingData.idNumber}
                className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
              >
                Next: Verification Docs <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Document Uploads */}
        {currentStep === 'documents' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold">3. Verification Documents</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { type: 'facePhoto', label: 'Face Photo' },
                { type: 'licenseFront', label: 'License Front' },
                { type: 'licenseBack', label: 'License Back' },
                { type: 'idFront', label: 'ID Front' },
                { type: 'idBack', label: 'ID Back' }
              ].map(slot => {
                const url = (bookingData as any)[`${slot.type}Url`];
                const uploading = uploadingDocs[slot.type];
                return (
                  <div key={slot.type} className="p-4 bg-muted/30 border border-border rounded-2xl flex flex-col justify-between gap-4">
                    <div>
                      <p className="font-bold text-sm">{slot.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">JPEG, PNG, or PDF</p>
                    </div>
                    {url ? (
                      <div className="flex items-center gap-2 text-success font-bold text-xs">
                        <CheckCircle2 size={16} /> Uploaded ✓
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 py-3 bg-background border border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                        {uploading ? <Loader2 className="animate-spin text-primary" size={16} /> : <Upload size={16} />}
                        <span className="text-xs font-bold">Choose File</span>
                        <input 
                          type="file" 
                          accept="image/*,.pdf" 
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadDocument(file, slot.type);
                          }}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex gap-3 items-start">
              <ShieldCheck className="text-primary mt-0.5" size={18} />
              <div>
                <p className="text-xs text-primary font-bold">PHYSICAL DOCUMENTS VERIFIED</p>
                <p className="text-[10px] text-primary/80 mt-1">
                  Ensure you have physically inspected original customer ID and Driving License documents before handing over the keys.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setCurrentStep('client')}
                className="px-6 py-4 bg-muted hover:bg-muted/80 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <ArrowLeft size={18} /> Back
              </button>
              <button 
                onClick={() => setCurrentStep('signature')}
                disabled={!bookingData.facePhotoUrl || !bookingData.licenseFrontUrl || !bookingData.licenseBackUrl}
                className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
              >
                Next: Digital Contract Signature <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Digital Contract Agreement & Signature */}
        {currentStep === 'signature' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold">4. Master Contract & Client Signature</h3>

            <div className="bg-muted/30 p-4 rounded-2xl border border-border h-80 overflow-y-auto">
              {loadingContract ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={24} /></div>
              ) : contract ? (
                <DirectContractDisplay 
                  contract={contract} 
                  bookingData={{
                    startDate: bookingData.startDate,
                    endDate: bookingData.endDate,
                    totalAmount: bookingData.totalAmount,
                    fullName: bookingData.fullName,
                    email: bookingData.email
                  }}
                  car={selectedCarDetails}
                />
              ) : (
                <p className="text-sm text-muted-foreground italic">Could not load Master Contract template.</p>
              )}
            </div>

            {/* Signature Draw Pad */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Draw Signature on Screen *</label>
              <div className="border border-border rounded-2xl bg-white overflow-hidden relative">
                <canvas 
                  ref={signatureRef}
                  width={600}
                  height={200}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-[200px] cursor-crosshair touch-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button 
                  onClick={clearSignature}
                  className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-bold hover:bg-muted/80 transition-colors"
                >
                  Clear Pad
                </button>
                <button 
                  onClick={saveSignature}
                  className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/95 transition-colors"
                >
                  Save Signature
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setCurrentStep('documents')}
                className="px-6 py-4 bg-muted hover:bg-muted/80 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <ArrowLeft size={18} /> Back
              </button>
              <button 
                onClick={handleCreateBooking}
                disabled={!bookingData.signatureUrl || loading}
                className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                Confirm & Create Booking
              </button>
            </div>
          </div>
        )}

        {/* Step 5: STK Push Payment */}
        {currentStep === 'payment' && (
          <div className="space-y-6 text-center py-6">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
              <CreditCard size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Awaiting NCBA Payment</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                An STK Push has been sent to client phone **{bookingData.phone}** for KSh {bookingData.totalAmount.toLocaleString()}.
              </p>
            </div>

            {polling && (
              <div className="flex items-center justify-center gap-2 text-sm text-primary font-bold">
                <Loader2 className="animate-spin" size={16} /> Waiting for customer to enter PIN...
              </div>
            )}

            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              <button 
                onClick={() => handleSendStk(bookingId || '')}
                disabled={polling}
                className="w-full py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-primary/95 transition-all"
              >
                <RefreshCw size={14} /> Send STK Again
              </button>
              <button 
                onClick={() => setCurrentStep('success')}
                className="w-full py-3 bg-muted text-muted-foreground rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
              >
                Skip to Confirmation (Mark as Cash)
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Booking Confirmation */}
        {currentStep === 'success' && (
          <div className="space-y-6 text-center py-8">
            <div className="w-20 h-20 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">Concierge Booking Created!</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                The booking for <strong>{bookingData.fullName}</strong> has been successfully registered and confirmed in the database.
              </p>
              {bookingId && (
                <p className="text-xs font-mono text-muted-foreground">Booking ID: {bookingId}</p>
              )}
            </div>

            <div className="flex gap-3 justify-center max-w-sm mx-auto pt-6">
              <button 
                onClick={() => navigate('/fleet')}
                className="w-1/2 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-primary/95 transition-all"
              >
                Go to Dashboard
              </button>
              <button 
                onClick={() => {
                  setCurrentStep('vehicle');
                  setBookingData({
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
                    facePhotoUrl: '',
                    licenseFrontUrl: '',
                    licenseBackUrl: '',
                    idFrontUrl: '',
                    idBackUrl: '',
                    paymentMethod: 'stk_push',
                    bankReference: ''
                  });
                  setBookingId(null);
                  setPaymentRequestId(null);
                }}
                className="w-1/2 py-3 bg-muted text-muted-foreground rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
              >
                New Booking
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
