import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { reservationService } from '../../services/reservationService';
import { paymentService } from '../../services/paymentService';
import { bookingService } from '../../services/bookingService';
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
  Building2,
  X,
  FileText,
  Image as ImageIcon,
  UserCheck,
  Percent
} from 'lucide-react';
import { toast } from 'sonner';
import { InternationalPhoneInput } from '../ui/InternationalPhoneInput';
import { calculateRentalDays } from '../../utils/rentalDays';

type Step = 'vehicle' | 'client' | 'documents' | 'signature' | 'payment' | 'success';

interface Broker {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  default_commission_rate: number;
}

export function AdminConciergeBooking() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('vehicle');
  const [loading, setLoading] = useState(false);
  const [vehicleModels, setVehicleModels] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [searchCar, setSearchCar] = useState(''); // keep name to avoid rewriting UI blocks; now searches models
  const signatureRef = useRef<HTMLCanvasElement>(null);

  // Broker referral state
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>('');
  const [brokerCommissionRate, setBrokerCommissionRate] = useState<string>('');
  
  // Booking State
  const [bookingData, setBookingData] = useState({
    vehicleModelId: '',
    startDate: '',
    endDate: '',
    totalAmount: 0,
    fullName: '',
    phone: '',
    email: '',
    idNumber: '',
    licenseNumber: '',
    poBox: '',
    address: '',
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

  // Load cars and brokers on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const result = await adminService.getVehicleModels(1, 500);
      if (result?.data) setVehicleModels(result.data);
      try {
        const brokerData = await adminService.getBrokers();
        setBrokers(brokerData);
      } catch (brokerError) {
        console.error('Failed to load brokers:', brokerError);
        toast.error('Broker registry unavailable. Run scripts/apply_outsourced_module_extension.sql on production.');
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // When broker is selected, auto-populate their default rate
  const handleBrokerSelect = (brokerId: string) => {
    setSelectedBrokerId(brokerId);
    const broker = brokers.find(b => b.id === brokerId);
    if (broker) setBrokerCommissionRate(String(broker.default_commission_rate));
    else setBrokerCommissionRate('');
  };

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
      const url = await bookingService.uploadDocument(file, type, `temp_concierge_${Date.now()}`);
      updateData({ [`${type}Url`]: url });
      toast.success(`${type.replace(/([A-Z])/g, ' $1')} uploaded successfully!`);
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message || err}`);
    } finally {
      setUploadingDocs(prev => ({ ...prev, [type]: false }));
    }
  };

  const getBookingDays = () => {
    return calculateRentalDays(bookingData.startDate, bookingData.endDate);
  };

  const handleCheckAvailability = async () => {
    if (!bookingData.vehicleModelId || !bookingData.startDate || !bookingData.endDate) {
      toast.error('Please select a vehicle model and date range');
      return;
    }
    
    const start = new Date(bookingData.startDate);
    const end = new Date(bookingData.endDate);
    
    if (start >= end) {
      toast.error('End date must be after start date');
      return;
    }

    setLoading(true);
    try {
      // Lightweight check: if model exists, proceed. Allocation + final availability enforcement happens in /api/bookings.
      const selectedModel = vehicleModels.find((m) => m.id === bookingData.vehicleModelId);
      if (selectedModel) {
        const days = calculateRentalDays(bookingData.startDate, bookingData.endDate);
        updateData({ totalAmount: days * Number(selectedModel.base_daily_rate || 0) });
        toast.success('Model selected. Proceeding to client details.');
        setCurrentStep('client');
      } else {
        toast.error('Vehicle model not found.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClientSubmit = () => {
    if (!bookingData.fullName || !bookingData.phone || !bookingData.idNumber || !bookingData.licenseNumber || !bookingData.address) {
      toast.error('Please fill in all required client fields');
      return;
    }
    setCurrentStep('documents');
  };

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
      // In a real app we'd upload this to Supabase Storage, here we use DataURL as a placeholder logic
      const dataUrl = canvas.toDataURL('image/png');
      updateData({ signatureUrl: dataUrl });
    } else {
      // If they skipped or physical signing
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
        vehicleModelId: bookingData.vehicleModelId,
        startDate: bookingData.startDate,
        endDate: bookingData.endDate,
        totalAmount: bookingData.totalAmount,
        fullName: bookingData.fullName,
        phone: bookingData.phone,
        email: bookingData.email,
        idNumber: bookingData.idNumber,
        licenseNumber: bookingData.licenseNumber,
        poBox: bookingData.poBox,
        address: bookingData.address,
        signatureUrl: bookingData.signatureUrl,
        documentsVerifiedPhysically: bookingData.documentsVerifiedPhysically,
        paymentMethod: bookingData.paymentMethod,
        facePhotoUrl: bookingData.facePhotoUrl,
        licenseFrontUrl: bookingData.licenseFrontUrl,
        licenseBackUrl: bookingData.licenseBackUrl,
        idFrontUrl: bookingData.idFrontUrl,
        idBackUrl: bookingData.idBackUrl,
        // Broker referral fields
        brokerId: selectedBrokerId || null,
        brokerCommissionRate: brokerRate,
        brokerCommissionAmount
      });
      
      setBookingId(result.id);

      if (contract && bookingData.signatureUrl && bookingData.signatureUrl !== 'signed_physically_in_person') {
        const { data: carForContract } = await supabase
          .from('cars')
          .select('*')
          .eq('id', result.car_id)
          .maybeSingle();
        if (carForContract) {
          try {
            await generateAndSaveContract(result.id, {
              contract,
              bookingData: {
                fullName: bookingData.fullName,
                email: bookingData.email,
                phone: bookingData.phone,
                idNumber: bookingData.idNumber,
                licenseNumber: bookingData.licenseNumber,
                poBox: bookingData.poBox,
                address: bookingData.address,
                startDate: bookingData.startDate,
                endDate: bookingData.endDate,
                totalAmount: bookingData.totalAmount,
                signatureUrl: bookingData.signatureUrl,
              },
              car: carForContract,
              signatureData: bookingData.signatureUrl,
              vehicleModelId: bookingData.vehicleModelId,
            });
          } catch (contractErr: any) {
            console.error('Failed to save concierge contract PDF:', contractErr);
            toast.error(
              contractErr?.message ||
                'Booking created, but the signed contract PDF could not be saved. Regenerate it from the booking details page.'
            );
          }
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

  // --- Signature Pad Logic ---
  useEffect(() => {
    if (currentStep === 'signature' && signatureRef.current) {
      const canvas = signatureRef.current;
      const ctx = canvas.getContext('2d');
      let isDrawing = false;

      const getPos = (e: MouseEvent | TouchEvent) => {
        const rect = canvas.getBoundingClientRect();
        if (e instanceof MouseEvent) {
          return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        } else {
          return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
      };

      const startDrawing = (e: MouseEvent | TouchEvent) => {
        isDrawing = true;
        const pos = getPos(e);
        ctx?.beginPath();
        ctx?.moveTo(pos.x, pos.y);
      };

      const draw = (e: MouseEvent | TouchEvent) => {
        if (!isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx?.lineTo(pos.x, pos.y);
        ctx?.stroke();
      };

      const stopDrawing = () => { isDrawing = false; };

      canvas.addEventListener('mousedown', startDrawing);
      canvas.addEventListener('mousemove', draw);
      canvas.addEventListener('mouseup', stopDrawing);
      canvas.addEventListener('mouseout', stopDrawing);
      
      canvas.addEventListener('touchstart', startDrawing);
      canvas.addEventListener('touchmove', draw);
      canvas.addEventListener('touchend', stopDrawing);

      return () => {
        canvas.removeEventListener('mousedown', startDrawing);
        canvas.removeEventListener('mousemove', draw);
        canvas.removeEventListener('mouseup', stopDrawing);
        canvas.removeEventListener('mouseout', stopDrawing);
        
        canvas.removeEventListener('touchstart', startDrawing);
        canvas.removeEventListener('touchmove', draw);
        canvas.removeEventListener('touchend', stopDrawing);
      };
    }
  }, [currentStep]);

  const selectedModel = vehicleModels.find((m) => m.id === bookingData.vehicleModelId);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black">Concierge Booking</h1>
          <p className="text-sm text-muted-foreground mt-1">Create assisted bookings for walk-in clients seamlessly.</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 flex justify-between items-center relative">
        <div className="absolute top-1/2 left-8 right-8 h-1 bg-muted -translate-y-1/2 z-0"></div>
        {['vehicle', 'client', 'documents', 'signature', 'payment'].map((step, idx) => {
          const steps = ['vehicle', 'client', 'documents', 'signature', 'payment'];
          const currentIndex = steps.indexOf(currentStep);
          const isActive = currentIndex === idx;
          const isPassed = currentIndex > idx;
          const isFinished = currentStep === 'success';

          return (
            <div key={step} className={`relative z-10 flex flex-col items-center gap-2 ${isPassed || isActive || isFinished ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors ${
                isPassed || isFinished ? 'bg-primary border-primary text-primary-foreground' : 
                isActive ? 'bg-background border-primary text-primary' : 'bg-muted border-muted text-muted-foreground'
              }`}>
                {isPassed || isFinished ? <CheckCircle2 size={16} /> : idx + 1}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:block">{step}</span>
            </div>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="bg-card border border-border rounded-2xl p-6 md:p-8 min-h-[400px]">
        {currentStep === 'vehicle' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-black flex items-center gap-2"><Car className="text-primary"/> Select Vehicle & Dates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Search Vehicle</label>
                  <input type="text" placeholder="Search make or model..." value={searchCar} onChange={e => setSearchCar(e.target.value)} className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary transition-colors" />
                </div>
                <div className="h-64 overflow-y-auto border border-border rounded-xl divide-y divide-border scrollbar-thin">
                  {vehicleModels
                    .filter((m) => `${m.make} ${m.model}`.toLowerCase().includes(searchCar.toLowerCase()))
                    .map((model) => (
                    <button key={model.id} onClick={() => updateData({ vehicleModelId: model.id })} className={`w-full text-left p-3 flex items-center gap-3 transition-colors ${bookingData.vehicleModelId === model.id ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-muted/50 border-l-2 border-transparent'}`}>
                      {model.primary_image_url ? (
                        <img src={model.primary_image_url} alt={model.make} className="w-12 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-10 rounded-lg bg-muted flex items-center justify-center"><Car size={16} className="text-muted-foreground"/></div>
                      )}
                      <div>
                        <p className="font-bold text-sm">{model.display_name || `${model.make} ${model.model}`}</p>
                        <p className="text-xs text-primary font-bold">KES {Number(model.base_daily_rate || 0).toLocaleString()}/day</p>
                      </div>
                    </button>
                  ))}
                  {loading && <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-muted-foreground"/></div>}
                </div>
              </div>

              <div className="space-y-4">
                 <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Start Date</label>
                  <input type="date" value={bookingData.startDate} min={new Date().toISOString().split('T')[0]} onChange={e => updateData({ startDate: e.target.value })} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">End Date</label>
                  <input type="date" value={bookingData.endDate} min={bookingData.startDate || new Date().toISOString().split('T')[0]} onChange={e => updateData({ endDate: e.target.value })} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors" />
                </div>

                <div className="pt-4">
                  <button onClick={handleCheckAvailability} disabled={loading} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : 'Check Availability & Continue'} <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'client' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-black flex items-center gap-2"><User className="text-primary"/> Client Details (Ghost Profile)</h2>
            <div className="bg-muted/20 border border-border rounded-2xl p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Full Name *</label>
                  <input type="text" placeholder="John Doe" value={bookingData.fullName} onChange={e => updateData({ fullName: e.target.value })} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Phone Number (M-Pesa) *</label>
                  <InternationalPhoneInput 
                    value={bookingData.phone} 
                    onChange={val => updateData({ phone: val })} 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">National ID / Passport *</label>
                  <input type="text" placeholder="12345678" value={bookingData.idNumber} onChange={e => updateData({ idNumber: e.target.value })} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Driver's License Number *</label>
                  <input type="text" placeholder="DL1234567" value={bookingData.licenseNumber} onChange={e => updateData({ licenseNumber: e.target.value })} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Email Address (Optional)</label>
                  <input type="email" placeholder="john@example.com" value={bookingData.email} onChange={e => updateData({ email: e.target.value })} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">P.O. Box (Optional)</label>
                  <input type="text" placeholder="00100 Nairobi" value={bookingData.poBox} onChange={e => updateData({ poBox: e.target.value })} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary transition-colors" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Physical Address *</label>
                  <input type="text" placeholder="Westlands, Nairobi" value={bookingData.address} onChange={e => updateData({ address: e.target.value })} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary transition-colors" />
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Referring Broker</label>
                  <select
                    value={selectedBrokerId}
                    onChange={e => handleBrokerSelect(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary transition-colors"
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
                        className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:border-primary transition-colors"
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
              <button onClick={handleClientSubmit} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors">
                Continue to Documents <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {currentStep === 'documents' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-black flex items-center gap-2"><ShieldCheck className="text-primary"/> Verification & Documents</h2>
            
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="mt-1">
                   <div className="w-6 h-6 rounded border border-emerald-500 flex items-center justify-center bg-emerald-500 text-white cursor-pointer" onClick={() => updateData({ documentsVerifiedPhysically: !bookingData.documentsVerifiedPhysically })}>
                     {bookingData.documentsVerifiedPhysically && <CheckCircle2 size={16} />}
                   </div>
                </div>
                <div>
                  <h3 className="font-bold text-emerald-600 dark:text-emerald-400">Documents Verified Physically In-Person</h3>
                  <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                    By checking this box, you confirm that you have physically inspected the client's original National ID and valid Driver's License. This bypasses the digital upload requirement. Your Admin ID will be logged for accountability.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Digital Document Uploads</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { type: 'facePhoto', label: 'Face Photo' },
                  { type: 'licenseFront', label: 'License Front' },
                  { type: 'licenseBack', label: 'License Back' },
                  { type: 'idFront', label: 'ID Front' },
                  { type: 'idBack', label: 'ID Back' }
                ].map(doc => {
                  const urlKey = `${doc.type}Url`;
                  const uploadedUrl = bookingData[urlKey as keyof typeof bookingData] as string;
                  const isUploading = uploadingDocs[doc.type];

                  return (
                    <div key={doc.type} className="border border-border rounded-xl p-4 bg-muted/10 space-y-3 flex flex-col justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{doc.label}</p>
                        {uploadedUrl ? (
                          <p className="text-[10px] text-emerald-500 font-bold mt-1 flex items-center gap-1">
                            <CheckCircle2 size={12} /> Uploaded
                          </p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {bookingData.documentsVerifiedPhysically ? 'Optional (Bypassed)' : 'Required'}
                          </p>
                        )}
                      </div>

                      <div className="pt-2">
                        {isUploading ? (
                          <div className="flex items-center gap-2 justify-center py-2 text-xs font-bold text-primary">
                            <Loader2 className="animate-spin" size={14} />
                            <span>Uploading...</span>
                          </div>
                        ) : uploadedUrl ? (
                          <div className="flex gap-2">
                            <a href={uploadedUrl} target="_blank" rel="noreferrer" className="flex-1 py-1.5 bg-muted text-muted-foreground text-center rounded-lg text-xs font-bold hover:bg-muted/80 transition-colors">
                              View File
                            </a>
                            <button onClick={() => updateData({ [urlKey]: '' })} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-primary/15 text-primary rounded-lg hover:bg-primary/25 transition-colors cursor-pointer text-xs font-bold text-center">
                            <Upload size={12} />
                            <span>Choose File</span>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadDocument(file, doc.type);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setCurrentStep('client')} className="px-6 py-3 bg-muted text-muted-foreground rounded-xl font-bold flex items-center gap-2 hover:bg-muted/80 transition-colors">
                <ArrowLeft size={18} /> Back
              </button>
              <button 
                onClick={() => {
                  const required = ['facePhotoUrl', 'licenseFrontUrl', 'licenseBackUrl', 'idFrontUrl', 'idBackUrl'];
                  const missing = required.filter(key => !bookingData[key as keyof typeof bookingData]);
                  
                  if (!bookingData.documentsVerifiedPhysically && missing.length > 0) {
                    toast.info('Missing digital documents. Physical verification auto-enabled to bypass.', {
                      duration: 4000
                    });
                    updateData({ documentsVerifiedPhysically: true });
                  }
                  setCurrentStep('signature');
                }} 
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
              >
                Continue to Signature <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {currentStep === 'signature' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-black flex items-center gap-2"><PenTool className="text-primary"/> Rental Agreement & Signature</h2>
            
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
                  <p className="text-xs text-yellow-700/80 dark:text-yellow-300/80">
                    Go to Admin Portal &rarr; Contract Manager to upload a master contract PDF first.
                  </p>
                </div>
              ) : (
                <div className="border border-border rounded-2xl overflow-hidden bg-card">
                  <DirectContractDisplay
                    contract={contract}
                    bookingData={{
                      ...bookingData,
                      days: getBookingDays(),
                    }}
                    car={selectedModel}
                  />
                </div>
              )}
            </div>

            <div className="bg-muted/10 border border-border rounded-2xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="agree-contract"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                />
                <label htmlFor="agree-contract" className="text-xs font-bold text-muted-foreground select-none cursor-pointer leading-normal">
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
              <button onClick={() => setCurrentStep('documents')} className="px-6 py-3 bg-muted text-muted-foreground rounded-xl font-bold flex items-center gap-2 hover:bg-muted/80 transition-colors">
                <ArrowLeft size={18} /> Back
              </button>
              <button 
                onClick={saveSignatureAndProceed} 
                disabled={!agreed} 
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Save & Continue to Payment <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {currentStep === 'payment' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-end">
              <h2 className="text-xl font-black flex items-center gap-2"><CreditCard className="text-primary"/> Payment</h2>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Amount Due</p>
                <p className="text-3xl font-black text-primary">KES {bookingData.totalAmount.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button 
                onClick={() => updateData({ paymentMethod: 'stk_push' })} 
                className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${bookingData.paymentMethod === 'stk_push' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted'}`}
              >
                <Phone size={24} />
                <span className="font-bold">M-Pesa STK Push</span>
              </button>
              <button 
                onClick={() => updateData({ paymentMethod: 'bank_transfer' })} 
                className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${bookingData.paymentMethod === 'bank_transfer' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted'}`}
              >
                <Building2 size={24} />
                <span className="font-bold">Bank Transfer</span>
              </button>
            </div>

            {bookingData.paymentMethod === 'bank_transfer' && (
              <div className="bg-muted/20 border border-border rounded-xl p-6 animate-in fade-in zoom-in-95 duration-200">
                 <h3 className="font-bold mb-4">Log Bank Transfer</h3>
                 <p className="text-sm text-muted-foreground mb-4">If the client transferred funds directly, input the official bank transaction reference code to confirm payment and complete the booking.</p>
                 <input 
                   type="text" 
                   placeholder="e.g. REF123456789" 
                   value={bookingData.bankReference}
                   onChange={e => updateData({ bankReference: e.target.value.toUpperCase() })}
                   className="w-full bg-background border border-border rounded-xl px-4 py-3 font-mono font-bold focus:border-primary transition-colors"
                 />
              </div>
            )}

            {bookingData.paymentMethod === 'stk_push' && polling && (
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-8 flex flex-col items-center justify-center text-center animate-pulse">
                <Loader2 size={32} className="text-primary animate-spin mb-4" />
                <h3 className="font-bold text-lg text-primary mb-1">Waiting for Client PIN...</h3>
                <p className="text-sm text-primary/80">An M-Pesa prompt has been sent to {bookingData.phone}.</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button onClick={() => setCurrentStep('signature')} disabled={loading || polling} className="px-6 py-3 bg-muted text-muted-foreground rounded-xl font-bold flex items-center gap-2 hover:bg-muted/80 transition-colors disabled:opacity-50">
                <ArrowLeft size={18} /> Back
              </button>
              <button onClick={handleCreateBooking} disabled={loading || polling} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50">
                 {loading ? <Loader2 size={18} className="animate-spin" /> : 
                  bookingData.paymentMethod === 'stk_push' ? 'Trigger STK Push & Book' : 'Confirm Bank Transfer & Book'}
              </button>
            </div>
          </div>
        )}

        {currentStep === 'success' && (
          <div className="py-12 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-150">
             <div className="w-24 h-24 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-6">
               <CheckCircle2 size={48} />
             </div>
             <h2 className="text-3xl font-black mb-2">Booking Completed!</h2>
             <p className="text-muted-foreground mb-8">The concierge booking has been successfully finalized.</p>
             
             <div className="bg-muted/30 border border-border rounded-xl p-6 max-w-sm w-full text-left space-y-3 mb-8">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm font-bold">Booking ID</span>
                  <span className="font-mono text-sm font-bold">{bookingId?.split('-')[0].toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm font-bold">Client</span>
                  <span className="text-sm font-bold">{bookingData.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm font-bold">Vehicle</span>
                  <span className="text-sm font-bold">{selectedModel?.display_name || `${selectedModel?.make || ''} ${selectedModel?.model || ''}`}</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-border">
                  <span className="text-muted-foreground text-sm font-bold">Amount Paid</span>
                  <span className="text-sm font-black text-primary">KES {bookingData.totalAmount.toLocaleString()}</span>
                </div>
             </div>

             <div className="flex flex-col sm:flex-row gap-3">
               <button onClick={() => window.location.reload()} className="px-6 py-3 bg-muted text-muted-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-muted/80 transition-colors">
                 Start Another Booking
               </button>
               <button onClick={() => navigate('/admin/bookings')} className="px-6 py-3 bg-muted text-muted-foreground border border-border rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-muted/80 transition-colors">
                 View Bookings List
               </button>
               {bookingId && (
                 <button onClick={() => navigate(`/admin/bookings/${bookingId}`)} className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors">
                   Manage Booking <ArrowRight size={16} />
                 </button>
               )}
             </div>
          </div>
        )}

      </div>
    </div>
  );
}
