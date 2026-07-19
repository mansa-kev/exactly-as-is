import React, { useState, useEffect, useMemo } from 'react';
import { computeExtensionQuote, formatQuoteAmount } from '../../utils/extensionQuote';
import { extensionPaymentService } from '../../services/extensionPaymentService';


import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { resolveAssetUrl } from '../../utils/assetUrl';
import { 
  ChevronLeft, Loader2, CreditCard, FileText, CheckCircle2, 
  XCircle, Car, MapPin, Flag, AlertTriangle, ShieldCheck, 
  Calendar, Clock, User, ArrowRight, Save, Image as ImageIcon, Send, X,
  Trash2, Mail, Phone, ExternalLink, MessageSquare, Ban, RotateCcw, Sparkles, Download
} from 'lucide-react';
import { logger } from '../../utils/logger';
import { adminService } from '../../services/adminService';
import { enhancedContractService } from '../../services/enhancedContractService';
import { buildBookingSummaryForContract, generateAndSaveContract, regenerateAndSaveContract } from '../../services/contractPdfService';
import { PdfViewer } from './PdfViewer';
import { sendAdminEmail } from '../../services/adminEmailService';
import { recordPaymentTransaction } from '../../utils/recordPaymentTransaction';
import { linkBookingAndSyncProfile } from '../../utils/bookingProfileSync';
import { AdminBookingLifecycle } from './AdminBookingLifecycle';
import { ModelFleetStatusPanel } from './ModelFleetStatusPanel';
import { getBookingVehicleDisplay } from '../../utils/bookingVehicleDisplay';
import type { ModelFleetStatusSummary } from '../../utils/modelFleetStatus';
import { generateVehicleSlug } from '../../utils/urlUtils';
type ModalType = 'pickup' | 'return' | 'extend' | 'flag' | null;
type CommunicateMode = 'approval' | 'payment_rejected' | 'docs_rejected';

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in km
}

async function syncClientProfileFromBooking(booking: any) {
  try {
    await linkBookingAndSyncProfile(supabase, booking);
  } catch (e) {
    logger.warn('Profile sync from booking failed:', e);
  }
}

export function AdminBookingCommandCenter() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'financials' | 'documents' | 'communications' | 'inspections'>('overview');
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // States for Modals & Actions
  const [flagReason, setFlagReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [extensionDays, setExtensionDays] = useState(1);
  const [extensionHours, setExtensionHours] = useState(0);
  const [extensionAdminFee, setExtensionAdminFee] = useState(0);
  const [extensionDiscount, setExtensionDiscount] = useState(0);
  const [extensionTaxRate, setExtensionTaxRate] = useState(0);


  // States for Communications & Docs
  const [communicateMode, setCommunicateMode] = useState<CommunicateMode>('approval');
  const [adminMessage, setAdminMessage] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [regeneratingContract, setRegeneratingContract] = useState(false);
  const [isSyncingPayment, setIsSyncingPayment] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [docRejectionReason, setDocRejectionReason] = useState('');
  const [showDocRejection, setShowDocRejection] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Admin STK Push
  const [showAdminStkPush, setShowAdminStkPush] = useState(false);
  const [adminStkPhone, setAdminStkPhone] = useState('');
  const [adminStkSending, setAdminStkSending] = useState(false);
  const [adminStkResult, setAdminStkResult] = useState<{ success: boolean; message: string } | null>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [isAssigningDriver, setIsAssigningDriver] = useState(false);
  const [fleetUnits, setFleetUnits] = useState<any[]>([]);
  const [fleetStatus, setFleetStatus] = useState<ModelFleetStatusSummary | null>(null);
  const [loadingFleetStatus, setLoadingFleetStatus] = useState(false);
  const [isAssigningUnit, setIsAssigningUnit] = useState(false);
  const [showOutsourceModal, setShowOutsourceModal] = useState(false);
  const [savingOutsource, setSavingOutsource] = useState(false);
  const [settingReservationOnly, setSettingReservationOnly] = useState(false);
  const [outsourceForm, setOutsourceForm] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    license_plate: '',
    color: '',
    daily_rate: 0,
    outsource_owner_name: '',
    outsource_owner_phone: '',
  });
  const [existingOutsourcedCars, setExistingOutsourcedCars] = useState<any[]>([]);
  const [loadingOutsourced, setLoadingOutsourced] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [conductors, setConductors] = useState<Record<string, string>>({});

  const fetchDrivers = async () => {
    try {
      const data = await adminService.getDrivers();
      setDrivers(data || []);
    } catch (err) {
      logger.error('Failed to fetch drivers:', err);
    }
  };

  const handleAssignDriver = async (driverId: string | null) => {
    setIsAssigningDriver(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ driver_id: driverId })
        .eq('id', booking.id);

      if (error) throw error;
      toast.success(driverId ? 'Driver allocated successfully' : 'Driver unallocated successfully');
      fetchBooking(true);
    } catch (e: any) {
      toast.error('Failed to allocate driver: ' + e.message);
    } finally {
      setIsAssigningDriver(false);
    }
  };

  const fetchFleetUnits = async (modelId: string) => {
    try {
      const variantIds = await adminService.getVehicleModelVariantIds(modelId);
      const units = await adminService.getCarsByVehicleModelIds(variantIds);
      setFleetUnits(units || []);
    } catch (err) {
      logger.error('Failed to fetch fleet units:', err);
      setFleetUnits([]);
    }
  };

  const fetchFleetStatus = async (modelId: string, startDate?: string, endDate?: string) => {
    if (!startDate || !endDate) {
      setFleetStatus(null);
      return;
    }
    setLoadingFleetStatus(true);
    try {
      const variantIds = await adminService.getVehicleModelVariantIds(modelId);
      const status = await adminService.getModelFleetStatus(variantIds, { startDate, endDate });
      setFleetStatus(status);
    } catch (err) {
      logger.error('Failed to fetch fleet status:', err);
      setFleetStatus(null);
    } finally {
      setLoadingFleetStatus(false);
    }
  };

  const openOutsourceModal = async () => {
    const vehicle = booking?.vehicle_model;
    setOutsourceForm({
      make: vehicle?.make || booking?.cars?.make || '',
      model: vehicle?.model || booking?.cars?.model || '',
      year: booking?.cars?.year || new Date().getFullYear(),
      license_plate: '',
      color: '',
      daily_rate: Number(vehicle?.base_daily_rate || booking?.cars?.daily_rate || 0),
      outsource_owner_name: '',
      outsource_owner_phone: '',
    });
    setShowOutsourceModal(true);
    setLoadingOutsourced(true);
    try {
      const { data, error } = await supabase
        .from('cars')
        .select('id, make, model, year, color, license_plate, status, daily_rate, is_outsourced, outsource_owner_name, outsource_owner_phone, vehicle_model_id')
        .eq('is_outsourced', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setExistingOutsourcedCars(data || []);
      setShowAddForm((data || []).length === 0);
    } catch (err) {
      logger.error('Failed to fetch outsourced cars:', err);
    } finally {
      setLoadingOutsourced(false);
    }
  };

  const handleSourceOutsourcedUnit = async () => {
    if (!booking?.id || !booking?.vehicle_model_id) return;
    if (!outsourceForm.make || !outsourceForm.model || !outsourceForm.license_plate || !outsourceForm.outsource_owner_name) {
      toast.error('Make, model, plate, and supplier name are required.');
      return;
    }
    setSavingOutsource(true);
    try {
      await adminService.addOutsourcedCarForBooking(booking.id, {
        ...outsourceForm,
        vehicle_model_id: booking.vehicle_model_id,
      });
      toast.success('Outsourced unit created and assigned to this booking');
      setShowOutsourceModal(false);
      await fetchBooking(true);
      await fetchFleetUnits(booking.vehicle_model_id);
      await fetchFleetStatus(booking.vehicle_model_id, booking.start_date, booking.end_date);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to source outsourced unit');
    } finally {
      setSavingOutsource(false);
    }
  };

  const handleSetReservationOnly = async () => {
    if (!booking?.vehicle_model_id) return;
    setSettingReservationOnly(true);
    try {
      const variantIds = await adminService.getVehicleModelVariantIds(booking.vehicle_model_id);
      await adminService.setVehicleModelBookingMode(variantIds, 'reservation_only');
      toast.success('Model switched to reservation-only on the public site');
      await fetchBooking(true);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update booking mode');
    } finally {
      setSettingReservationOnly(false);
    }
  };

  const handleAssignUnit = async (carId: string) => {
    if (!carId || !booking?.id) return;
    setIsAssigningUnit(true);
    try {
      await adminService.assignBookingUnit(booking.id, carId);
      toast.success('Fleet unit assigned successfully');
      await fetchBooking(true);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to assign fleet unit');
    } finally {
      setIsAssigningUnit(false);
    }
  };

  const fetchBooking = async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          cars (*),
          vehicle_model:vehicle_models (*),
          client:user_profiles!bookings_client_id_fkey (*),
          driver:user_profiles!bookings_driver_id_fkey (*),
          booking_inspections (*),
          booking_extensions (*),
          e_contracts (*)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      setBooking(data);

      // Fetch conductors details
      const inspects = data.booking_inspections || [];
      const userIds = inspects.map((i: any) => i.conducted_by).filter(Boolean);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('id', userIds);
        if (profiles) {
          const mapping = profiles.reduce((acc: any, curr: any) => {
            acc[curr.id] = curr.full_name;
            return acc;
          }, {});
          setConductors(mapping);
        }
      }
    } catch (err) {
      logger.error('Error fetching booking:', err);
      toast.error('Failed to load booking details');
      navigate('/admin/bookings');
    } finally {
      if (!silent) setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBooking();
    fetchDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (booking?.vehicle_model_id) {
      fetchFleetUnits(booking.vehicle_model_id);
      fetchFleetStatus(booking.vehicle_model_id, booking.start_date, booking.end_date);
    } else {
      setFleetUnits([]);
      setFleetStatus(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.vehicle_model_id, booking?.start_date, booking?.end_date]);

  // Handle ESC for lightbox
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxUrl(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchBooking(true);
  };

  const handleDownloadContract = async () => {
    if (!booking) return;
    const rawUrl = booking.e_contracts?.[0]?.pdf_url || booking.metadata?.contract_url;
    if (!rawUrl) return;
    
    const resolvedUrl = resolveAssetUrl(rawUrl);
    const url = resolvedUrl && resolvedUrl.includes('supabase.co') 
      ? `/api/documents/proxy?url=${encodeURIComponent(resolvedUrl)}` 
      : resolvedUrl;
      
    if (!url) return;
    const ref = booking.id.slice(0, 8).toUpperCase();

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `contract-${ref}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleRegenerateContract = async () => {
    if (!booking?.cars && !booking?.vehicle_model) {
      toast.error('Vehicle details are required to generate the contract.');
      return;
    }

    const meta = booking.metadata || {};
    const docs = meta.documents || {};
    const signature = docs.signatureUrl || meta.signature || meta.signature_url;

    if (!signature || signature === 'signed_physically_in_person') {
      toast.error('A stored digital client signature is required to regenerate the contract PDF.');
      return;
    }

    setRegeneratingContract(true);
    try {
      const masterContract = await enhancedContractService.getMasterContract();
      if (!masterContract) {
        throw new Error('No active HTML contract template found. Upload one in Contract Manager.');
      }

      const vehicleModelId = booking.vehicle_model_id || booking.vehicle_model?.id || null;
      const contractCar = {
        ...(booking.cars || {}),
        vehicle_model: booking.vehicle_model || booking.cars?.vehicle_model,
      };

      await regenerateAndSaveContract(booking.id, {
        contract: masterContract,
        bookingData: buildBookingSummaryForContract(booking, contractCar),
        car: contractCar,
        signatureData: signature,
        vehicleModelId,
      });

      toast.success('Signed contract PDF generated successfully.');
      await fetchBooking(true);
    } catch (err: any) {
      logger.error('Contract regeneration failed:', err);
      toast.error(err?.message || 'Failed to generate contract PDF');
    } finally {
      setRegeneratingContract(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this booking? This action cannot be undone.')) return;
    setIsDeleting(true);
    try {
      const result = await adminService.deleteBooking(booking.id);
      if (result && result.success) {
        toast.success('Booking deleted successfully');
        navigate('/admin/bookings');
      } else {
        throw new Error('Deletion failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete booking');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFlagToggle = async () => {
    setIsSubmitting(true);
    try {
      const newStatus = !booking.is_flagged;
      const res = await fetch(`/api/bookings/${booking.id}/flag`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_flagged: newStatus, flag_reason: newStatus ? flagReason : null })
      });
      if (!res.ok) throw new Error('Failed to update flag');
      toast.success(newStatus ? 'Booking flagged' : 'Flag removed');
      setActiveModal(null);
      setFlagReason('');
      fetchBooking(true);
    } catch (e) {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Live extension quote — recomputed as admin tweaks inputs
  const extensionQuote = useMemo(() => computeExtensionQuote({
    currentEndDate: booking?.end_date || new Date().toISOString(),
    dailyRate: Number(booking?.cars?.daily_rate) || 0,
    days: extensionDays,
    hours: extensionHours,
    adminFee: extensionAdminFee,
    discount: extensionDiscount,
    taxRate: extensionTaxRate,
  }), [booking?.end_date, booking?.cars?.daily_rate, extensionDays, extensionHours, extensionAdminFee, extensionDiscount, extensionTaxRate]);

  const handleAddExtension = async () => {
    setIsSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('You must be signed in to add an extension.');

      const res = await fetch(`/api/bookings/${booking.id}/extend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          days_extended: extensionQuote.days,
          hours_extended: extensionQuote.hours,
          extension_cost: extensionQuote.total,
          pricing_breakdown: {
            base: extensionQuote.base,
            admin_fee: extensionQuote.adminFee,
            discount: extensionQuote.discount,
            tax: extensionQuote.tax,
            tax_rate: extensionTaxRate,
          },
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `Failed to add extension (${res.status})`);
      }
      toast.success(extensionQuote.total > 0
        ? `Extension queued — KES ${extensionQuote.total.toLocaleString()} pending payment`
        : 'Extension applied');
      setActiveModal(null);
      fetchBooking(true);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add extension');
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleCancelBooking = async () => {
    const reason = window.prompt('Enter cancellation reason (client will be notified):');
    if (!reason || !reason.trim()) return;
    const refund = window.confirm('Issue full refund for any paid amount? OK = Yes, Cancel = No');
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const updates: any = {
        status: 'cancelled',
        sub_status: refund ? 'refund_pending' : 'cancelled',
        admin_notes: `[CANCELLED by admin] ${reason}`,
      };
      const { error } = await supabase.from('bookings').update(updates).eq('id', booking.id);
      if (error) throw error;

      if (refund && booking.payment_status === 'paid' && booking.client_id) {
        await supabase.from('transactions').insert({
          booking_id: booking.id,
          user_id: booking.client_id,
          amount: -Math.abs(Number(booking.total_amount) || 0),
          type: 'refund',
          status: 'pending',
          transaction_code: `REFUND-${booking.id.slice(0,8).toUpperCase()}`,
        }).then(null, (e: any) => logger.warn('Refund tx error:', e));
      }

      if (booking.client_id) {
        await supabase.from('notifications').insert({
          user_id: booking.client_id,
          type: 'booking_cancelled',
          title: 'Booking Cancelled',
          content: `Your booking #${booking.id.slice(0,8).toUpperCase()} was cancelled. Reason: ${reason}${refund ? ' A refund has been initiated.' : ''}`,
          is_read: false,
          link: `/booking-confirmation/${booking.id}`,
        }).then(null, (e:any) => logger.warn('Notif error:', e));
      }

      toast.success(refund ? 'Booking cancelled — refund queued' : 'Booking cancelled');
      fetchBooking(true);
    } catch (e: any) {
      toast.error('Cancellation failed: ' + (e.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };


  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (!booking) return null;

  // --- Derived Values ---
  const meta        = booking.metadata || {};
  const guestInfo   = meta.guest_info || {};
  const docs        = meta.documents || {};
  const clientName  = booking.client?.full_name    || guestInfo.full_name    || 'Guest';
  const clientEmail = booking.client?.email        || guestInfo.email        || 'N/A';
  const clientPhone = booking.client?.phone_number || booking.client?.phone  || guestInfo.phone || 'N/A';
  const idNumber    = guestInfo.id_number || guestInfo.national_id || docs.idNumber || docs.id_number || (meta as any).id_number || booking.client?.id_number || 'N/A';
  const licenseNum  = booking.client?.license_number || guestInfo.license_number || guestInfo.license || 'N/A';
  const transactionCode = booking.transaction_code || null;
  const isPaid      = booking.payment_status === 'paid';
  const docsOk =
    booking.document_status === 'approved' ||
    meta.documentsVerifiedPhysically === true;
  
  const eContract = booking.e_contracts?.[0];
  const rawContractUrl = eContract?.pdf_url || meta.contract_url;
  const resolvedContractUrl = resolveAssetUrl(rawContractUrl);
  const contractUrl = resolvedContractUrl && resolvedContractUrl.includes('supabase.co') 
    ? `/api/documents/proxy?url=${encodeURIComponent(resolvedContractUrl)}` 
    : resolvedContractUrl;
  const signatureData = docs.signatureUrl || meta.signature || meta.signature_url;

  const bookingRef  = booking.id.slice(0, 8).toUpperCase();
  const vehicle = getBookingVehicleDisplay(booking, 'admin');
  const carLine = vehicle.modelLabel;
  const carFull = vehicle.label;
  const waPhone     = clientPhone.replace(/\D/g, '').replace(/^0/, '254');
  const hasPhone    = waPhone.length >= 10;
  
  const today = new Date();
  const endDate = new Date(booking.end_date);
  const isOverdue = booking.status === 'on_trip' && endDate < today;

  const rentalDays  = (booking.start_date && booking.end_date)
    ? Math.max(1, Math.ceil((new Date(booking.end_date).getTime() - new Date(booking.start_date).getTime()) / 86400000))
    : 1;

  const totalCost = Number(booking.total_amount) || 0;
  const amountPaid = Number((booking as any).amount_paid) || (isPaid ? totalCost : 0);
  const balance = Math.max(0, totalCost - amountPaid);


  const inspections = booking.booking_inspections || [];
  const preInspection = inspections.find((i: any) => i.type === 'pre_handover');
  const postInspection = inspections.find((i: any) => i.type === 'post_return');

  const pickupAlreadyLogged =
    !!booking.pickup_confirmed_at ||
    !!preInspection ||
    booking.status === 'on_trip' ||
    ['returned', 'completed'].includes(booking.status);

  const returnAlreadyLogged =
    !!booking.return_confirmed_at ||
    !!postInspection ||
    ['returned', 'completed'].includes(booking.status);

  const canStartPickup =
    (booking.status === 'confirmed' || booking.status === 'pending_collection') &&
    !pickupAlreadyLogged;

  const canProcessReturn = booking.status === 'on_trip' && !returnAlreadyLogged;

  const canExtend = booking.status === 'on_trip' && !returnAlreadyLogged;

  // --- Helpers ---
  const buildMessage = (mode: CommunicateMode) => {
    if (mode === 'approval') {
      return `Dear ${clientName},\n\nGreat news! Your car rental booking has been fully reviewed and confirmed.\n\n✅ Payment Verified — KES ${totalCost.toLocaleString()}\n✅ Documents Approved\n✅ Vehicle Ready — ${carFull}\n\nPickup Location: ${booking.pickup_location || 'Contact us for details'}\nPickup Date: ${booking.start_date || 'N/A'}\nReturn Date: ${booking.end_date || 'N/A'}\n\nPlease bring your original driving licence and ID on pickup day.\n\nThank you for choosing LinkedUp Cars!\n\nThe LinkedUp Cars Team`;
    } else if (mode === 'payment_rejected') {
      return `Dear ${clientName},\n\nYour NCBA STK Push payment attempt for Booking #${bookingRef} was not completed successfully.\n\nNext Steps:\n1. Return to your booking payment screen\n2. Retry the NCBA STK Push using the correct phone number\n3. Enter your mobile money PIN when prompted\n\nYour booking remains pending payment verification until NCBA confirms successful payment.\n\nPlease contact us if you need assistance.\n\nThe LinkedUp Cars Team`;
    } else {
      return `Dear ${clientName},\n\nOur team has reviewed your submitted documents for Booking #${bookingRef}.\n\nUnfortunately, we were unable to approve your documents at this time.\n\nReason: ${docRejectionReason || 'Documents require correction'}\n\nNext Steps:\n1. Log into your client portal at linkedupcars.com\n2. Navigate to My Bookings\n3. Click "Resubmit Documents" to upload corrected copies\n\n✅ IMPORTANT: Your payment has been verified — you do NOT need to pay again.\n\nPlease contact us if you need help.\n\nThe LinkedUp Cars Team`;
    }
  };

  const enterCommunicateStep = (mode: CommunicateMode) => {
    setCommunicateMode(mode);
    setAdminMessage(buildMessage(mode));
    setActiveTab('communications');
  };

  const handleSyncNcbaPayment = async () => {
    setIsSyncingPayment(true);
    try {
      const result = await adminService.syncPaymentByBookingId(booking.id);
      if (result.paid) {
        toast.success('NCBA payment confirmed — booking updated');
        fetchBooking(true);
      } else if (result.failed) {
        toast.error(result.description || 'NCBA reports payment was not completed');
        fetchBooking(true);
      } else {
        toast.message(result.description || 'Payment still pending at NCBA');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to sync NCBA payment');
    } finally {
      setIsSyncingPayment(false);
    }
  };

  const handleAdminStkPush = async () => {
    const cleanPhone = adminStkPhone.replace(/[\s\-+]/g, '');
    if (cleanPhone.length < 9) {
      toast.error('Enter a valid phone number');
      return;
    }
    setAdminStkSending(true);
    setAdminStkResult(null);
    try {
      const response = await fetch('/api/ncba/stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, bookingId: booking.id }),
      });
      const data = await response.json();
      if (data.success) {
        setAdminStkResult({ success: true, message: data.statusDescription || 'M-Pesa prompt sent to client. They should enter their PIN now.' });
        toast.success('M-Pesa prompt sent to client phone');
        fetchBooking(true);
      } else {
        setAdminStkResult({ success: false, message: data.error || 'Failed to send M-Pesa prompt' });
        toast.error(data.error || 'Failed to send M-Pesa prompt');
      }
    } catch (err: any) {
      setAdminStkResult({ success: false, message: err.message || 'Network error' });
      toast.error(err.message || 'Failed to send M-Pesa prompt');
    } finally {
      setAdminStkSending(false);
    }
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
        if (bookingErr) throw bookingErr;

        await recordPaymentTransaction(
          booking.id,
          booking.client_id,
          Number(booking.total_amount),
          transactionCode || booking.payment_reference || booking.id
        );
        toast.success('Payment verified ✓');
        fetchBooking(true);
        setActiveTab('documents');
      } else {
        const { error: rejectErr } = await supabase.from('bookings').update({
          payment_status: 'failed',
        }).eq('id', booking.id);
        if (rejectErr) throw rejectErr;
        toast.info('Payment rejected — composing client notification');
        fetchBooking(true);
        enterCommunicateStep('payment_rejected');
      }
    } catch (e: any) {
      toast.error('Failed to update payment status');
    } finally {
      setIsVerifying(false);
    }
  };

  const sendClientEmail = async (subject: string, fullMsg: string) => {
    if (clientEmail === 'N/A') {
      return { success: false, error: 'No client email on record' };
    }
    const htmlBody = `<div style="font-family:sans-serif;line-height:1.6;white-space:pre-wrap">${fullMsg.replace(/\n/g, '<br>')}</div>`;
    return sendAdminEmail({ to: clientEmail, subject, html: htmlBody, text: fullMsg });
  };

  const handleApproveDocuments = async () => {
    setIsApproving(true);
    const approvalMsg = buildMessage('approval');

    try {
      const { data, error } = await supabase.from('bookings').update({
        document_status: 'approved',
        status: 'confirmed',
        payment_status: 'paid',
      }).eq('id', booking.id).select('document_status, status, payment_status').single();

      if (error) throw error;
      if (!data || data.document_status !== 'approved') {
        throw new Error('Document approval did not persist. Check admin permissions.');
      }

      setBooking((prev: any) =>
        prev ? { ...prev, document_status: 'approved', status: 'confirmed', payment_status: 'paid' } : prev
      );

      await recordPaymentTransaction(
        booking.id,
        booking.client_id,
        Number(booking.total_amount),
        booking.payment_reference || booking.transaction_code || booking.id
      );

      const emailResult = await sendClientEmail('Booking Confirmed — LinkedUp Cars', approvalMsg);
      if (emailResult.success) {
        toast.success('Documents approved — confirmation email sent ✓');
      } else {
        toast.warning(`Documents approved, but email failed: ${emailResult.error}`);
      }

      if (booking.client_id) {
        await syncClientProfileFromBooking(booking);
        try {
          await supabase.from('notifications').insert({
            user_id: booking.client_id,
            type: 'booking_confirmed',
            title: 'Booking Confirmed 🎉',
            content: approvalMsg.slice(0, 300),
            is_read: false,
            link: `/booking-confirmation/${booking.id}`,
          });
        } catch (e) {
          logger.warn('Notification error:', e);
        }
      }

      fetchBooking(true);
      enterCommunicateStep('approval');
    } catch (e: any) {
      logger.error('Approve documents failed:', e);
      toast.error(e?.message || 'Failed to approve documents');
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
      }).eq('id', booking.id);
      setShowDocRejection(false);
      toast.info('Documents rejected — composing client notification');
      fetchBooking(true);
      enterCommunicateStep('docs_rejected');
    } catch (e: any) {
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
      const emailResult = await sendClientEmail(subject, fullMsg);
      if (!emailResult.success) {
        throw new Error(emailResult.error || 'Email could not be sent');
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

      if (communicateMode === 'approval' && booking.status !== 'confirmed') {
        const { error: confirmError } = await supabase.from('bookings').update({
          status: 'confirmed',
          payment_status: 'paid',
          document_status: 'approved',
        }).eq('id', booking.id);
        if (confirmError) throw confirmError;
        setBooking((prev: any) => prev ? { ...prev, status: 'confirmed', payment_status: 'paid', document_status: 'approved' } : prev);
        await syncClientProfileFromBooking(booking);
        await recordPaymentTransaction(
          booking.id,
          booking.client_id,
          Number(booking.total_amount),
          booking.payment_reference || booking.transaction_code || booking.id
        );
        fetchBooking(true);
      }

      toast.success('Email sent successfully!');
      setAdminMessage('');
      setAdditionalNotes('');
    } catch (e: any) {
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const openWhatsApp = async () => {
    if (!hasPhone) { toast.error('No valid phone number on record'); return; }
    const text = encodeURIComponent(adminMessage.trim() + (additionalNotes.trim() ? `\n\nAdmin Notes:\n${additionalNotes.trim()}` : ''));
    window.open(`https://wa.me/${waPhone}?text=${text}`, '_blank', 'noopener,noreferrer');

    toast.message('WhatsApp opened — send the message manually from your device.');
  };

  // --- Reusable Layout Components ---
  const SectionCard = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h3 className="text-xs font-black uppercase tracking-widest text-foreground">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );

  const Field = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold text-foreground mt-1 break-words ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );

  const ImageTile = ({ url, label }: { url?: string; label: string }) => (
    <div>
      <button
        onClick={() => url && setLightboxUrl(url)}
        disabled={!url}
        className="w-full h-32 rounded-xl overflow-hidden border border-border bg-muted/30 flex items-center justify-center hover:border-primary/50 transition-all disabled:cursor-default cursor-zoom-in group"
      >
        {url
          ? <img src={url} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-150" />
          : <FileText size={24} className="text-muted-foreground opacity-50" />}
      </button>
      <p className="text-xs text-muted-foreground mt-2 text-center font-medium">
        {label} {url && <span className="text-primary">· zoom</span>}
      </p>
    </div>
  );

  // Banner Colors
  let bannerColor = 'bg-primary border-primary';
  let bannerText = 'text-primary-foreground';
  if (booking.is_flagged) {
    bannerColor = 'bg-red-600 border-red-600';
    bannerText = 'text-white';
  } else if (isOverdue) {
    bannerColor = 'bg-red-700 border-red-700';
    bannerText = 'text-white';
  } else if (booking.status === 'on_trip') {
    bannerColor = 'bg-blue-600 border-blue-600';
    bannerText = 'text-white';
  } else if (booking.status === 'pending_collection') {
    bannerColor = 'bg-orange-500 border-orange-500';
    bannerText = 'text-white';
  } else if (booking.status === 'completed') {
    bannerColor = 'bg-gray-600 border-gray-600';
    bannerText = 'text-white';
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150 max-w-6xl mx-auto pb-20">
      {/* Top Nav */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('/admin/bookings')}
          className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} /> Back to Bookings
        </button>
        <div className="flex items-center gap-3">
          {isRefreshing && <Loader2 size={14} className="animate-spin text-primary" />}
          <span className="text-xs font-mono text-muted-foreground">ID: {booking.id.toUpperCase()}</span>
          <button onClick={handleDelete} disabled={isDeleting} className="p-2 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-xl transition-colors" title="Delete Booking">
            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        </div>
      </div>

      {/* === Lifecycle Stepper — Sequential Command Control === */}
      {(() => {
        const stages = [
          { key: 'submitted',   label: 'Submitted',    icon: FileText,       done: true },
          { key: 'payment',     label: 'Payment',      icon: CreditCard,     done: isPaid },
          { key: 'docs',        label: 'Documents',    icon: ShieldCheck,    done: docsOk },
          { key: 'confirmed',   label: 'Confirmed',    icon: CheckCircle2,   done: booking.status !== 'pending' && booking.status !== 'pending_payment_verification' && booking.status !== 'cancelled' },
          { key: 'pickup',      label: 'Pickup',       icon: MapPin,         done: !!booking.pickup_confirmed_at || ['on_trip','returned','completed'].includes(booking.status) },
          { key: 'transit',     label: 'In Transit',   icon: Car,            done: ['on_trip','returned','completed'].includes(booking.status) },
          { key: 'returned',    label: 'Returned',     icon: RotateCcw,      done: !!booking.return_confirmed_at || ['returned','completed'].includes(booking.status) },
          { key: 'completed',   label: 'Completed',    icon: Sparkles,       done: ['completed', 'returned'].includes(booking.status) },
        ];
        const isCancelled = booking.status === 'cancelled';
        const currentIdx = stages.findIndex(s => !s.done);
        const activeIdx = currentIdx === -1 ? stages.length - 1 : currentIdx;
        return (
          <div className="relative bg-gradient-to-br from-card via-card to-muted/30 border border-border rounded-3xl p-5 md:p-6 shadow-sm overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_50%)] pointer-events-none" />
            <div className="relative flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Lifecycle</p>
                <p className="text-sm font-black text-foreground mt-0.5">
                  {isCancelled ? 'Booking Cancelled' : `Stage ${activeIdx + 1} of ${stages.length} · ${stages[activeIdx].label}`}
                </p>
              </div>
              {!isCancelled && (
                <div className="hidden md:block text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Progress</p>
                  <p className="text-2xl font-black text-primary tabular-nums">
                    {Math.round(((stages.filter(s => s.done).length) / stages.length) * 100)}%
                  </p>
                </div>
              )}
            </div>
            <div className="relative flex items-start justify-between gap-1 overflow-x-auto scrollbar-none">
              {stages.map((s, i) => {
                const isActive = i === activeIdx && !isCancelled;
                const isDone = s.done && !isCancelled;
                const Icon = s.icon;
                return (
                  <React.Fragment key={s.key}>
                    <div className="flex flex-col items-center gap-2 min-w-[60px] flex-1">
                      <div className={`relative w-10 h-10 md:w-11 md:h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                        isCancelled ? 'bg-muted text-muted-foreground/40' :
                        isDone ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-100' :
                        isActive ? 'bg-primary/15 text-primary ring-2 ring-primary/40 ring-offset-2 ring-offset-card scale-110 animate-pulse' :
                        'bg-muted/50 text-muted-foreground/50'
                      }`}>
                        <Icon size={16} />
                        {isDone && <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-[10px] text-white font-black border-2 border-card">✓</div>}
                      </div>
                      <p className={`text-[9px] md:text-[10px] font-black uppercase tracking-wider text-center leading-tight ${
                        isCancelled ? 'text-muted-foreground/50' :
                        isActive ? 'text-primary' :
                        isDone ? 'text-foreground' : 'text-muted-foreground'
                      }`}>{s.label}</p>
                    </div>
                    {i < stages.length - 1 && (
                      <div className={`h-0.5 flex-1 mt-5 md:mt-5 rounded-full transition-all duration-500 ${
                        isCancelled ? 'bg-muted' :
                        stages[i + 1].done || s.done ? 'bg-primary/60' : 'bg-muted'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            {isCancelled && (
              <div className="relative mt-4 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs font-bold text-red-500 flex items-center gap-2">
                <Ban size={14} /> This booking has been cancelled and is no longer active.
              </div>
            )}
          </div>
        );
      })()}


      {/* Banner */}
      <div className={`rounded-3xl p-6 md:p-8 border shadow-xl ${bannerColor} ${bannerText} relative overflow-hidden flex flex-col md:flex-row md:items-end justify-between gap-6`}>
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="px-4 py-1.5 bg-white/20 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-md border border-white/20">
              {booking.status.replace(/_/g, ' ')}
            </span>
            {booking.sub_status && (
              <span className="px-4 py-1.5 bg-black/20 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-md border border-black/20">
                {booking.sub_status.replace(/_/g, ' ')}
              </span>
            )}
            {booking.is_flagged && (
              <span className="flex items-center gap-1.5 px-4 py-1.5 bg-black/30 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-md border border-black/20 text-red-100 shadow-sm">
                <Flag size={12} /> Flagged
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight">{clientName}</h1>
          <p className="text-base font-bold opacity-90 flex items-center gap-2">
            <Car size={18} /> {carFull}
            {vehicle.unitLabel ? (
              <span className="font-mono bg-black/20 px-2 py-0.5 rounded">Unit: {vehicle.unitLabel}</span>
            ) : (
              <span className="font-mono bg-black/20 px-2 py-0.5 rounded">Unit pending</span>
            )}
          </p>
        </div>

        <div className="relative z-10 flex flex-col md:items-end gap-1">
          <p className="text-xs font-black uppercase tracking-widest opacity-80">Total Value</p>
          <p className="text-4xl font-black">KES {totalCost.toLocaleString()}</p>
          <p className={`text-sm font-bold ${balance > 0 ? 'text-red-200' : 'text-green-200'}`}>
            {balance > 0 ? `Unpaid: KES ${balance.toLocaleString()}` : 'Fully Paid'}
          </p>
        </div>
      </div>

      {/* Action Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {canStartPickup ? (
          <button onClick={() => setActiveModal('pickup')} className="col-span-2 py-4 bg-orange-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-orange-600 transition-all shadow-lg hover:shadow-orange-500/20">
            <MapPin size={18} /> Start Trip (Pickup Log)
          </button>
        ) : null}

        {canProcessReturn || canExtend ? (
          <>
            {canProcessReturn ? (
              <button onClick={() => setActiveModal('return')} className="col-span-2 py-4 bg-teal-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-teal-600 transition-all shadow-lg hover:shadow-teal-500/20">
                <CheckCircle2 size={18} /> Process Return
              </button>
            ) : null}
            {canExtend ? (
              <button onClick={() => setActiveModal('extend')} className="py-4 bg-purple-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-purple-600 transition-all">
                <Calendar size={18} /> Extend
              </button>
            ) : null}
          </>
        ) : null}

        {/* Global Action: Flag */}
        <button 
          onClick={() => booking.is_flagged ? handleFlagToggle() : setActiveModal('flag')} 
          className={`py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
            (booking.status === 'confirmed' || booking.status === 'pending_collection' || booking.status === 'on_trip') ? '' : 'col-span-2 md:col-span-1'
          } ${
            booking.is_flagged 
              ? 'bg-green-500/10 text-green-500 border border-green-500/30 hover:bg-green-500/20' 
              : 'bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20'
          }`}
        >
          <Flag size={18} /> {booking.is_flagged ? 'Unflag Booking' : 'Flag Booking'}
        </button>

        {booking.status !== 'cancelled' && booking.status !== 'completed' && (
          <button
            onClick={handleCancelBooking}
            disabled={isSubmitting}
            className="py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 bg-red-600/10 text-red-600 border border-red-600/30 hover:bg-red-600/20 transition-all disabled:opacity-50"
          >
            <Ban size={18} /> Cancel & Refund
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-border overflow-x-auto scrollbar-none">
        {['overview', 'financials', 'documents', 'communications', 'inspections'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`py-4 border-b-2 text-sm font-black uppercase tracking-widest transition-colors whitespace-nowrap ${
              activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
            {tab === 'documents' && !docsOk && <span className="ml-2 inline-flex w-2 h-2 rounded-full bg-red-500" />}
            {tab === 'financials' && !isPaid && <span className="ml-2 inline-flex w-2 h-2 rounded-full bg-amber-500" />}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <SectionCard title="Rental Timeline" icon={<Clock size={16} />}>
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                  <div className="relative">
                    <div className="absolute -left-[27px] top-1 w-3 h-3 bg-primary rounded-full ring-4 ring-card" />
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Pick-up</p>
                    <p className="text-base font-black">{new Date(booking.start_date).toLocaleDateString('en-KE', { weekday: 'short', month: 'long', day: 'numeric' })}</p>
                    <p className="text-sm text-muted-foreground mt-1">{booking.pickup_location || 'No location specified'}</p>
                  </div>
                  <div className="relative">
                    <div className={`absolute -left-[27px] top-1 w-3 h-3 rounded-full ring-4 ring-card ${isOverdue ? 'bg-red-500' : 'bg-border'}`} />
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>Drop-off</p>
                    <p className="text-base font-black">{new Date(booking.end_date).toLocaleDateString('en-KE', { weekday: 'short', month: 'long', day: 'numeric' })}</p>
                    <p className="text-sm text-muted-foreground mt-1">{booking.dropoff_location || booking.pickup_location || 'No location specified'}</p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Client Information" icon={<User size={16} />}>
                <div className="grid grid-cols-2 gap-y-4">
                  <Field label="Name" value={clientName} />
                  <Field label="ID Number" value={idNumber} />
                  <Field label="Phone" value={clientPhone} />
                  <Field label="Email" value={clientEmail} />
                </div>
              </SectionCard>
            </div>

            <div className="space-y-6">
              <SectionCard title="Fleet Unit Allocation" icon={<Car size={16} />}>
                <div className="space-y-4">
                  {booking.vehicle_model_id && booking.cars?.vehicle_model_id &&
                    booking.vehicle_model_id !== booking.cars.vehicle_model_id && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 flex items-start gap-2.5 text-xs font-bold leading-normal">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                      <div>
                        <p>Unit mismatch</p>
                        <p className="text-[10px] text-red-300/80 font-normal mt-0.5">
                          The assigned unit is linked to a different catalog model than the one the client booked.
                          Reassign a unit from the booked model below.
                        </p>
                      </div>
                    </div>
                  )}

                  {booking.cars ? (
                    <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
                      <p className="text-[10px] font-black uppercase text-primary tracking-widest">Currently Assigned Unit</p>
                      <p className="text-sm font-black text-foreground mt-1">
                        {booking.cars.year ? `${booking.cars.year} · ` : ''}
                        {booking.cars.color || 'N/A'}
                      </p>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">
                        {booking.cars.license_plate || 'No plate'} · {booking.cars.make} {booking.cars.model}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl p-3 text-xs font-bold">
                      No fleet unit linked to this booking yet.
                    </div>
                  )}

                  {booking.vehicle_model && (
                    <p className="text-xs text-muted-foreground">
                      Booked model: <span className="font-semibold text-foreground">
                        {booking.vehicle_model.display_name || `${booking.vehicle_model.make} ${booking.vehicle_model.model}`}
                      </span>
                    </p>
                  )}

                  {booking.vehicle_model_id ? (
                    <div className="space-y-3 pt-2 border-t border-border/50">
                      <ModelFleetStatusPanel
                        status={fleetStatus}
                        loading={loadingFleetStatus}
                        compact
                        dateRangeLabel={
                          booking.start_date && booking.end_date
                            ? `for booking dates`
                            : undefined
                        }
                        onSelectUnit={handleAssignUnit}
                        selectedUnitId={booking.car_id}
                        highlightBuckets={['available', 'outsourced']}
                      />

                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                        {booking.cars ? 'Reassign fleet unit' : 'Assign fleet unit'}
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={booking.car_id || ''}
                          onChange={(e) => {
                            if (e.target.value) handleAssignUnit(e.target.value);
                          }}
                          disabled={isAssigningUnit || fleetUnits.length === 0}
                          className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-sm"
                        >
                          <option value="">
                            {fleetUnits.length === 0
                              ? 'No units linked to this model family'
                              : '-- Select unit for handover --'}
                          </option>
                          {fleetUnits.map((unit) => (
                            <option key={unit.id} value={unit.id}>
                              {unit.license_plate || 'No plate'} · {unit.year || '—'} · {unit.color || 'N/A'} ({unit.status}{unit.is_outsourced ? ', outsourced' : ''})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={openOutsourceModal}
                          className="px-3 py-2 rounded-xl text-xs font-bold border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-colors"
                        >
                          Source outsourced vehicle
                        </button>
                        {fleetStatus && fleetStatus.available === 0 && (
                          <button
                            type="button"
                            onClick={handleSetReservationOnly}
                            disabled={settingReservationOnly}
                            className="px-3 py-2 rounded-xl text-xs font-bold border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 transition-colors disabled:opacity-60"
                          >
                            {settingReservationOnly ? 'Updating…' : 'Set model reservation-only'}
                          </button>
                        )}
                      </div>

                      {booking.vehicle_model_id && (
                        <a
                          href={`/vehicles/${generateVehicleSlug({id: booking.vehicle_model_id, friendly_id: booking.vehicle_model?.friendly_id, family_slug: booking.vehicle_model?.family_slug, make: booking.cars?.make, model: booking.cars?.model})}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                        >
                          <ExternalLink size={12} /> View public model page
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      This is a legacy unit-only booking with no catalog model link.
                    </p>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Driver & Logistics Allocation" icon={<Car size={16} />}>
                <div className="space-y-4">
                  {booking.driver ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase text-primary tracking-widest">Currently Assigned Driver</p>
                          <p className="text-sm font-black text-foreground mt-1">{booking.driver.full_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{booking.driver.phone_number || booking.driver.phone || 'No Phone'}</p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          booking.needs_chauffeur 
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {booking.needs_chauffeur ? 'Chauffeur' : 'Delivery Staff'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl p-3 flex items-start gap-2.5 text-xs font-bold leading-normal">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                      <div>
                        <p>No Driver Allocated</p>
                        <p className="text-[10px] text-amber-500/80 font-normal mt-0.5">
                          {booking.needs_chauffeur 
                            ? 'This booking requires a chauffeur. Please allocate a driver.' 
                            : 'Allocate a delivery agent to coordinate vehicle handover.'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                      {booking.driver ? 'Reallocate / Change Driver' : 'Select Driver for Allocation'}
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={booking.driver_id || ''}
                        onChange={(e) => handleAssignDriver(e.target.value || null)}
                        disabled={isAssigningDriver}
                        className="flex-1 bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                      >
                        <option value="">-- Unallocated / Select Driver --</option>
                        {drivers.map((d: any) => (
                          <option key={d.id} value={d.id}>
                            {d.full_name} ({d.driver_profiles?.status || 'pending'})
                          </option>
                        ))}
                      </select>
                      {booking.driver_id && (
                        <button
                          onClick={() => handleAssignDriver(null)}
                          disabled={isAssigningDriver}
                          className="px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 text-xs font-bold rounded-xl transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>

              {booking.is_flagged && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={18} className="text-red-500" />
                    <h3 className="text-sm font-black text-red-500 uppercase tracking-widest">Flagged Reason</h3>
                  </div>
                  <p className="text-sm text-red-400 leading-relaxed font-bold">
                    {booking.flag_reason || 'No specific reason provided.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FINANCIALS TAB */}
        {activeTab === 'financials' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SectionCard title="Financial Ledger" icon={<CreditCard size={16} />}>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-border/50">
                  <span className="text-sm font-bold text-muted-foreground">Base Rental Cost</span>
                  <span className="text-base font-black">KES {totalCost.toLocaleString()}</span>
                </div>
                {booking.metadata?.extensions?.map((ext: any, i: number) => (
                  <div key={i} className="flex justify-between items-center py-3 border-b border-border/50 text-purple-400">
                    <span className="text-sm font-bold">Extension ({ext.days} days)</span>
                    <span className="text-base font-black">+ KES {ext.cost?.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center py-4 bg-muted/20 px-4 rounded-xl mt-4">
                  <span className="text-xs font-black uppercase tracking-widest">Total Received</span>
                  <span className="text-xl font-black text-green-500">KES {(isPaid ? totalCost : 0).toLocaleString()}</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="NCBA STK Payment" icon={<CreditCard size={16} />}>
              <div className="mb-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">NCBA Transaction ID</p>
                {transactionCode ? (
                  <p className="text-3xl font-mono font-black text-primary tracking-widest">{transactionCode}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic font-medium">No NCBA transaction ID recorded yet</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border mb-6">
                <Field label="Amount" value={`KES ${totalCost.toLocaleString()}`} />
                <Field label="Date Submitted" value={new Date(booking.created_at).toLocaleDateString('en-KE', { dateStyle: 'medium' })} />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Status</p>
                  <span className={`inline-flex mt-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    isPaid ? 'bg-green-500/15 text-green-500' :
                    booking.payment_status === 'failed' ? 'bg-red-500/15 text-red-500' :
                    'bg-amber-500/15 text-amber-500'
                  }`}>
                    {isPaid ? '✓ Verified' : booking.payment_status || 'pending'}
                  </span>
                </div>
              </div>

              {!isPaid && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-4 mt-2">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                    <p className="text-xs text-amber-600 font-bold leading-relaxed">
                      Payment must be confirmed by NCBA STK Push. Sync with NCBA first, then force-verify only if needed.
                    </p>
                  </div>

                  {/* Admin-triggered STK Push */}
                  <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary">Send M-Pesa Prompt to Client</p>
                      <button
                        onClick={() => {
                          setShowAdminStkPush(!showAdminStkPush);
                          if (!adminStkPhone && clientPhone !== 'N/A') {
                            setAdminStkPhone(clientPhone);
                          }
                        }}
                        className="text-[10px] font-bold text-primary underline"
                      >
                        {showAdminStkPush ? 'Hide' : 'Expand'}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      If the client's session expired or they closed the browser, you can send the M-Pesa payment prompt directly to their phone from here.
                    </p>
                    {showAdminStkPush && (
                      <div className="space-y-3 pt-2 border-t border-border">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Client Phone</label>
                          <input
                            type="tel"
                            value={adminStkPhone}
                            onChange={(e) => setAdminStkPhone(e.target.value)}
                            placeholder="e.g. 0712345678 or 254712345678"
                            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <CreditCard size={12} />
                          <span>Amount: <strong className="text-foreground">KES {totalCost.toLocaleString()}</strong> (from booking total)</span>
                        </div>
                        <button
                          onClick={handleAdminStkPush}
                          disabled={adminStkSending || !adminStkPhone.replace(/[\s\-+]/g, '').length}
                          className="w-full py-2.5 bg-green-600 text-white rounded-lg text-xs font-black hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                        >
                          {adminStkSending ? (
                            <><Loader2 size={14} className="animate-spin" /> Sending prompt...</>
                          ) : (
                            <><Send size={14} /> Send M-Pesa Prompt Now</>
                          )}
                        </button>
                        {adminStkResult && (
                          <div className={`p-3 rounded-lg text-xs font-bold flex items-start gap-2 ${
                            adminStkResult.success
                              ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                              : 'bg-red-500/10 text-red-500 border border-red-500/20'
                          }`}>
                            {adminStkResult.success ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <XCircle size={14} className="shrink-0 mt-0.5" />}
                            <span>{adminStkResult.message}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleSyncNcbaPayment}
                    disabled={isSyncingPayment || !transactionCode}
                    className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-xs font-black hover:bg-primary/90 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSyncingPayment ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                    Sync NCBA Status
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => handleVerifyPayment('verified')} disabled={isVerifying} className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-xs font-black hover:bg-green-700 flex items-center justify-center gap-2">
                      {isVerifying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Force Verify
                    </button>
                    <button onClick={() => handleVerifyPayment('rejected')} disabled={isVerifying} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-xs font-black hover:bg-red-700 flex items-center justify-center gap-2">
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${docsOk ? 'bg-green-500/15 text-green-500' : 'bg-amber-500/15 text-amber-500'}`}>
                  {docsOk ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                  {docsOk ? 'Documents Approved' : 'Pending Review'}
                </span>
              </div>
              {!docsOk && (
                <div className="flex gap-2">
                  <button onClick={() => setShowDocRejection(true)} className="px-4 py-2 bg-red-600/15 text-red-500 rounded-lg text-xs font-black hover:bg-red-600/25 transition-colors">
                    Reject
                  </button>
                  <button onClick={handleApproveDocuments} disabled={isApproving} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-black hover:bg-green-700 transition-colors">
                    {isApproving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve
                  </button>
                </div>
              )}
            </div>

            {showDocRejection && (
              <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-4">
                <p className="text-xs font-black uppercase tracking-widest text-red-500">Document Rejection Reason</p>
                <div className="flex flex-wrap gap-2">
                  {['ID document unclear', 'Licence document unclear', 'Documents don\'t match records', 'Incomplete submission'].map(r => (
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
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground resize-none focus:outline-none focus:border-red-500 font-medium"
                />
                <div className="flex gap-2 pt-2">
                  <button onClick={handleRejectDocuments} disabled={!docRejectionReason.trim() || isApproving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-black hover:bg-red-700 transition-colors disabled:opacity-50">
                    {isApproving ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Confirm Rejection
                  </button>
                  <button onClick={() => { setShowDocRejection(false); setDocRejectionReason(''); }}
                    className="px-6 py-3 bg-muted text-muted-foreground rounded-xl text-sm font-bold hover:bg-muted/80 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard title="Client Identity" icon={<User size={16} />}>
                <div className="flex gap-6 items-start">
                  {docs.facePhotoUrl ? (
                    <button onClick={() => setLightboxUrl(docs.facePhotoUrl)} className="shrink-0 focus:outline-none group">
                      <img src={docs.facePhotoUrl} alt="Selfie" className="w-24 h-24 rounded-2xl object-cover border-2 border-primary/20 group-hover:border-primary transition-colors" />
                    </button>
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-muted/40 border border-border flex items-center justify-center shrink-0">
                      <User size={32} className="text-muted-foreground opacity-50" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 flex-1">
                    <Field label="Full Name" value={clientName} />
                    <Field label="Email" value={clientEmail} />
                    <Field label="Phone" value={clientPhone} />
                    <Field label="Booking Date" value={new Date(booking.created_at).toLocaleDateString('en-KE')} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="National ID" icon={<ShieldCheck size={16} />}>
                <div className="mb-4">
                  <Field label="ID Number" value={idNumber} mono />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <ImageTile url={docs.idFrontUrl} label="Front" />
                  <ImageTile url={docs.idBackUrl} label="Back" />
                </div>
              </SectionCard>

              <SectionCard title="Driver's Licence" icon={<CreditCard size={16} />}>
                <div className="mb-4">
                  <Field label="Licence Number" value={licenseNum} mono />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <ImageTile url={docs.licenseFrontUrl} label="Front" />
                  <ImageTile url={docs.licenseBackUrl} label="Back" />
                </div>
              </SectionCard>

              <SectionCard title="Contract & Signature" icon={<FileText size={16} />}>
                <div className="flex flex-col gap-6">
                  {contractUrl ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={contractUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl text-sm font-black text-primary hover:bg-primary/20 transition-colors"
                        >
                          <ExternalLink size={16} /> Open PDF
                        </a>
                        <button
                          type="button"
                          onClick={handleDownloadContract}
                          className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 bg-muted/40 border border-border rounded-xl text-sm font-black text-foreground hover:bg-muted transition-colors"
                        >
                          <Download size={16} /> Download PDF
                        </button>
                      </div>
                      <div className="rounded-xl border border-border overflow-hidden bg-white">
                        <PdfViewer
                          url={contractUrl}
                          className="w-full"
                          style={{ height: '520px', border: 'none' }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
                      <FileText size={28} className="mx-auto mb-2 text-muted-foreground opacity-60" />
                      <p className="text-sm font-bold text-foreground">No signed contract PDF on file</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {signatureData
                          ? 'Generate the final PDF from the stored client signature and active contract template.'
                          : 'Complete the booking contract step with a client signature to enable PDF generation.'}
                      </p>
                      {signatureData && signatureData !== 'signed_physically_in_person' && (
                        <button
                          type="button"
                          onClick={handleRegenerateContract}
                          disabled={regeneratingContract}
                          className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-black disabled:opacity-50"
                        >
                          {regeneratingContract ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                          {regeneratingContract ? 'Generating…' : 'Generate Contract PDF'}
                        </button>
                      )}
                    </div>
                  )}

                  {signatureData && signatureData !== 'signed_physically_in_person' && (
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Digital Signature Specimen</p>
                      <button type="button" onClick={() => setLightboxUrl(signatureData)} className="cursor-zoom-in w-full">
                        <img src={signatureData} alt="Signature" className="h-24 w-full bg-white rounded-xl p-2 border border-border hover:border-primary transition-colors object-contain" />
                      </button>
                    </div>
                  )}

                  {contractUrl && signatureData && signatureData !== 'signed_physically_in_person' && (
                    <button
                      type="button"
                      onClick={handleRegenerateContract}
                      disabled={regeneratingContract}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-xl text-xs font-black text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
                    >
                      {regeneratingContract ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                      Regenerate PDF from template
                    </button>
                  )}
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {/* COMMUNICATIONS TAB */}
        {activeTab === 'communications' && (
          <div className="max-w-3xl space-y-6">
            <div className={`flex items-start gap-4 p-5 rounded-2xl border shadow-sm ${
              communicateMode === 'approval'
                ? 'bg-green-500/10 border-green-500/20'
                : 'bg-red-500/10 border-red-500/20'
            }`}>
              {communicateMode === 'approval'
                ? <CheckCircle2 size={24} className="text-green-500 shrink-0" />
                : <XCircle size={24} className="text-red-500 shrink-0" />}
              <div>
                <p className={`text-base font-black ${communicateMode === 'approval' ? 'text-green-500' : 'text-red-500'}`}>
                  {communicateMode === 'approval' && 'Booking Approved — Send Confirmation'}
                  {communicateMode === 'payment_rejected' && 'Payment Rejected — Notify Client'}
                  {communicateMode === 'docs_rejected' && 'Documents Rejected — Request Resubmission'}
                </p>
                <p className="text-sm text-muted-foreground mt-1 font-medium">
                  {communicateMode === 'approval' && 'Booking status will be set to Confirmed once you send this message.'}
                  {communicateMode === 'payment_rejected' && 'Client will be asked to retry NCBA STK Push.'}
                  {communicateMode === 'docs_rejected' && 'Client must resubmit corrected documents. Payment remains valid.'}
                </p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-border">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Recipient</p>
                  <div className="flex flex-wrap gap-4">
                    <span className="flex items-center gap-2 text-sm font-bold bg-muted/40 px-3 py-1.5 rounded-lg">
                      <Mail size={14} className="text-primary" /> {clientEmail}
                    </span>
                    {hasPhone && (
                      <span className="flex items-center gap-2 text-sm font-bold bg-muted/40 px-3 py-1.5 rounded-lg">
                        <Phone size={14} className="text-green-500" /> {clientPhone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Message Content</p>
                  <textarea
                    value={adminMessage}
                    onChange={e => setAdminMessage(e.target.value)}
                    rows={12}
                    className="w-full bg-muted/20 border border-border rounded-xl px-4 py-4 text-sm text-foreground resize-y focus:outline-none focus:border-primary font-mono leading-relaxed"
                  />
                </div>

                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Admin Notes (Appended)</p>
                  <textarea
                    value={additionalNotes}
                    onChange={e => setAdditionalNotes(e.target.value)}
                    placeholder="Add any extra instructions..."
                    rows={3}
                    className="w-full bg-muted/20 border border-border rounded-xl px-4 py-3 text-sm text-foreground resize-none focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-border">
                  {hasPhone && (
                    <button
                      onClick={openWhatsApp}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-black hover:bg-green-700 transition-colors"
                    >
                      <Phone size={16} /> WhatsApp
                    </button>
                  )}
                  {hasPhone && (
                    <button
                      onClick={() => toast.info('SMS integration coming soon')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition-colors"
                    >
                      <MessageSquare size={16} /> SMS
                    </button>
                  )}
                  <button
                    onClick={handleSendMessage}
                    disabled={isSending || !adminMessage.trim()}
                    className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-black hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {communicateMode === 'approval' ? 'Resend Confirmation Email' : 'Send Message'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* INSPECTIONS TAB */}
        {activeTab === 'inspections' && (
          <div className="space-y-6">
            {!preInspection && !postInspection && (
              <div className="text-center py-20 bg-card border border-border rounded-3xl">
                <ShieldCheck size={48} className="mx-auto text-muted-foreground opacity-30 mb-4" />
                <h3 className="text-lg font-black text-foreground">No Inspections Logged</h3>
                <p className="text-sm text-muted-foreground mt-2">Inspections will appear here once the vehicle is picked up or returned.</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {preInspection && (() => {
                const conductorName = conductors[preInspection.conducted_by] || 'System / Staff';
                const hasCarCoords = booking.cars?.location_lat && booking.cars?.location_lon;
                const hasInspectCoords = preInspection.gps_lat && preInspection.gps_lon;
                let distance: number | null = null;
                if (hasCarCoords && hasInspectCoords) {
                  distance = calculateDistance(
                    Number(preInspection.gps_lat),
                    Number(preInspection.gps_lon),
                    Number(booking.cars.location_lat),
                    Number(booking.cars.location_lon)
                  );
                }

                return (
                  <SectionCard title="Pre-Handover Inspection" icon={<MapPin size={16} />}>
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Date Logged" value={new Date(preInspection.created_at).toLocaleString('en-KE')} />
                        <Field label="Conducted By" value={conductorName} />
                        <Field label="Odometer" value={`${preInspection.mileage?.toLocaleString() || 'N/A'} km`} mono />
                        <Field label="Fuel Level" value={preInspection.fuel_level?.toUpperCase() || 'N/A'} />
                      </div>

                      {/* GPS & Location Logging */}
                      <div className="bg-muted/10 p-4 rounded-xl border border-border space-y-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Handover Location Check</p>
                        <p className="text-sm font-bold text-foreground">{preInspection.location || 'Field Handover'}</p>
                        {hasInspectCoords ? (
                          <div className="space-y-2 pt-1">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${preInspection.gps_lat},${preInspection.gps_lon}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-bold"
                            >
                              <ExternalLink size={12} /> View Submission GPS Pin ({Number(preInspection.gps_lat).toFixed(5)}, {Number(preInspection.gps_lon).toFixed(5)})
                            </a>
                            {distance !== null && (
                              <div className={`p-2.5 rounded-lg text-xs font-bold border ${
                                distance > 1.0 
                                  ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                                  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              }`}>
                                {distance > 1.0 ? (
                                  <span className="flex items-center gap-1">
                                    <AlertTriangle size={14} className="shrink-0" />
                                    Distance Mismatch Alert: Submitted {distance.toFixed(2)} km from depot!
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 size={14} className="shrink-0" />
                                    Location Verified: Submitted {distance.toFixed(2)} km from depot.
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-amber-500 font-bold flex items-center gap-1">
                            <AlertTriangle size={13} /> No GPS coordinates logged.
                          </p>
                        )}
                      </div>

                      {preInspection.scratches_notes && (
                        <div className="bg-muted/30 p-4 rounded-xl border border-border">
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Condition Notes</p>
                          <p className="text-sm font-medium">{preInspection.scratches_notes}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3">Dashboard (Fuel/Odo)</p>
                          <ImageTile url={preInspection.photo_fuel_mileage} label="Dashboard Proof" />
                        </div>
                        {preInspection.client_signature_url && (
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3">Client Signature Verification</p>
                            <button
                              onClick={() => setLightboxUrl(preInspection.client_signature_url)}
                              className="w-full h-32 rounded-xl border border-border bg-white flex items-center justify-center p-2 cursor-zoom-in hover:border-primary/50 transition-all"
                            >
                              <img src={preInspection.client_signature_url} alt="Client Signature" className="h-full object-contain" />
                            </button>
                            <p className="text-xs text-muted-foreground mt-2 text-center font-medium">Signed Agreement · zoom</p>
                          </div>
                        )}
                      </div>

                      {(preInspection.photos_exterior?.length > 0 || preInspection.photos_interior?.length > 0) && (
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3">Additional Visual Evidence</p>
                          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                            {[...(preInspection.photos_exterior || []), ...(preInspection.photos_interior || [])].map((img, i) => (
                              <button key={i} onClick={() => setLightboxUrl(img)} className="w-24 h-24 shrink-0 rounded-xl overflow-hidden border border-border cursor-zoom-in">
                                <img src={img} alt="Evidence" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </SectionCard>
                );
              })()}

              {postInspection && (() => {
                const conductorName = conductors[postInspection.conducted_by] || 'System / Staff';
                const hasCarCoords = booking.cars?.location_lat && booking.cars?.location_lon;
                const hasInspectCoords = postInspection.gps_lat && postInspection.gps_lon;
                let distance: number | null = null;
                if (hasCarCoords && hasInspectCoords) {
                  distance = calculateDistance(
                    Number(postInspection.gps_lat),
                    Number(postInspection.gps_lon),
                    Number(booking.cars.location_lat),
                    Number(booking.cars.location_lon)
                  );
                }

                return (
                  <SectionCard title="Post-Return Inspection" icon={<CheckCircle2 size={16} />}>
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Date Logged" value={new Date(postInspection.created_at).toLocaleString('en-KE')} />
                        <Field label="Conducted By" value={conductorName} />
                        <Field label="Odometer" value={`${postInspection.mileage?.toLocaleString() || 'N/A'} km`} mono />
                        <Field label="Fuel Level" value={postInspection.fuel_level?.toUpperCase() || 'N/A'} />
                      </div>

                      {/* GPS & Location Logging */}
                      <div className="bg-muted/10 p-4 rounded-xl border border-border space-y-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Return Location Check</p>
                        <p className="text-sm font-bold text-foreground">{postInspection.location || 'Field Return'}</p>
                        {hasInspectCoords ? (
                          <div className="space-y-2 pt-1">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${postInspection.gps_lat},${postInspection.gps_lon}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-bold"
                            >
                              <ExternalLink size={12} /> View Submission GPS Pin ({Number(postInspection.gps_lat).toFixed(5)}, {Number(postInspection.gps_lon).toFixed(5)})
                            </a>
                            {distance !== null && (
                              <div className={`p-2.5 rounded-lg text-xs font-bold border ${
                                distance > 1.0 
                                  ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                                  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              }`}>
                                {distance > 1.0 ? (
                                  <span className="flex items-center gap-1">
                                    <AlertTriangle size={14} className="shrink-0" />
                                    Distance Mismatch Alert: Submitted {distance.toFixed(2)} km from depot!
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 size={14} className="shrink-0" />
                                    Location Verified: Submitted {distance.toFixed(2)} km from depot.
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-amber-500 font-bold flex items-center gap-1">
                            <AlertTriangle size={13} /> No GPS coordinates logged.
                          </p>
                        )}
                      </div>

                      {postInspection.scratches_notes && (
                        <div className="bg-muted/30 p-4 rounded-xl border border-border">
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Return Notes</p>
                          <p className="text-sm font-medium">{postInspection.scratches_notes}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3">Dashboard (Fuel/Odo)</p>
                          <ImageTile url={postInspection.photo_fuel_mileage} label="Dashboard Proof" />
                        </div>
                        {postInspection.client_signature_url && (
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3">Client Signature Verification</p>
                            <button
                              onClick={() => setLightboxUrl(postInspection.client_signature_url)}
                              className="w-full h-32 rounded-xl border border-border bg-white flex items-center justify-center p-2 cursor-zoom-in hover:border-primary/50 transition-all"
                            >
                              <img src={postInspection.client_signature_url} alt="Client Signature" className="h-full object-contain" />
                            </button>
                            <p className="text-xs text-muted-foreground mt-2 text-center font-medium">Signed Agreement · zoom</p>
                          </div>
                        )}
                      </div>

                      {(postInspection.photos_exterior?.length > 0 || postInspection.photos_interior?.length > 0) && (
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3">Additional Visual Evidence</p>
                          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                            {[...(postInspection.photos_exterior || []), ...(postInspection.photos_interior || [])].map((img, i) => (
                              <button key={i} onClick={() => setLightboxUrl(img)} className="w-24 h-24 shrink-0 rounded-xl overflow-hidden border border-border cursor-zoom-in">
                                <img src={img} alt="Evidence" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </SectionCard>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}
      {/* Pickup / Return Modal */}
      {(activeModal === 'pickup' || activeModal === 'return') && (
        <AdminBookingLifecycle
          booking={booking}
          mode={activeModal === 'return' ? 'return' : 'pickup'}
          onClose={() => setActiveModal(null)}
          onRefresh={() => fetchBooking(true)}
        />
      )}

      {/* Add Extension Modal */}
      {activeModal === 'extend' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="p-6 md:p-8">
              <h3 className="text-xl font-black mb-1">Add Extension</h3>
              <p className="text-sm text-muted-foreground mb-6">Extend the rental period. The client will be charged the balance below.</p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2">Extra Days</label>
                  <input
                    type="number" min="0"
                    value={extensionDays}
                    onChange={e => setExtensionDays(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl font-black text-lg focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2">Extra Hours</label>
                  <input
                    type="number" min="0" max="23"
                    value={extensionHours}
                    onChange={e => setExtensionHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                    className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl font-black text-lg focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2">Admin Fee</label>
                  <input type="number" min="0" value={extensionAdminFee}
                    onChange={e => setExtensionAdminFee(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl font-bold text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2">Discount</label>
                  <input type="number" min="0" value={extensionDiscount}
                    onChange={e => setExtensionDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl font-bold text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2">Tax %</label>
                  <input type="number" min="0" max="100" step="0.1"
                    value={extensionTaxRate * 100}
                    onChange={e => setExtensionTaxRate(Math.max(0, (parseFloat(e.target.value) || 0) / 100))}
                    className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-xl font-bold text-sm" />
                </div>
              </div>

              {/* Live quote */}
              <div className="bg-muted/40 border border-border rounded-2xl p-4 space-y-2 mb-6">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-bold uppercase tracking-widest">New Return</span>
                  <span className="font-black">{new Date(extensionQuote.newEndDate).toLocaleString()}</span>
                </div>
                <div className="h-px bg-border" />
                {extensionQuote.lines.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Enter days or hours to see a breakdown.</p>
                ) : extensionQuote.lines.map(line => (
                  <div key={line.key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{line.label}</span>
                    <span className={`font-bold ${line.amount < 0 ? 'text-green-500' : ''}`}>{formatQuoteAmount(line.amount, extensionQuote.currency)}</span>
                  </div>
                ))}
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest">Client Pays</span>
                  <span className="text-lg font-black text-primary">{formatQuoteAmount(extensionQuote.total, extensionQuote.currency)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setActiveModal(null)} className="flex-1 py-3.5 bg-muted text-muted-foreground rounded-xl font-black text-sm hover:bg-muted/80 transition-colors">Cancel</button>
                <button
                  onClick={handleAddExtension}
                  disabled={isSubmitting || extensionQuote.totalHours <= 0}
                  className="flex-1 py-3.5 bg-primary text-primary-foreground rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : (extensionQuote.total > 0 ? 'Queue for Payment' : 'Apply Extension')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Flag Modal */}
      {activeModal === 'flag' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-red-500/30 rounded-3xl shadow-2xl shadow-red-500/10 w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500"><Flag size={20} /></div>
                <h3 className="text-xl font-black text-red-500">Flag Booking</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-8">Mark this booking for special attention or issues.</p>
              
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2">Reason (Optional)</label>
                <textarea 
                  value={flagReason} 
                  onChange={e => setFlagReason(e.target.value)}
                  placeholder="e.g. Client unresponsive, vehicle damaged..."
                  rows={4}
                  className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl font-medium text-sm focus:ring-2 focus:ring-red-500/20 resize-none"
                />
              </div>

              <div className="flex gap-3 mt-8">
                <button onClick={() => setActiveModal(null)} className="flex-1 py-3.5 bg-muted text-muted-foreground rounded-xl font-black text-sm hover:bg-muted/80 transition-colors">Cancel</button>
                <button onClick={handleFlagToggle} disabled={isSubmitting} className="flex-1 py-3.5 bg-red-600 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-red-700 transition-colors">
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Flag Booking'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showOutsourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-foreground">Source outsourced vehicle</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Assign an already listed outsourced unit, or register a new one.
                  </p>
                </div>
                <button onClick={() => setShowOutsourceModal(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                  <X size={18} className="text-muted-foreground" />
                </button>
              </div>

              {/* Toggle Form / List Button */}
              {existingOutsourcedCars.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="w-full py-2.5 px-4 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-primary/20 transition-all flex items-center justify-center gap-1.5"
                >
                  {showAddForm ? 'View listed outsourced cars' : '＋ Register new outsourced car'}
                </button>
              )}

              {/* Loading State */}
              {loadingOutsourced ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="animate-spin text-primary" size={28} />
                  <p className="text-xs text-muted-foreground">Loading outsourced partners...</p>
                </div>
              ) : !showAddForm ? (
                /* Listed Outsourced Cars Section */
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Listed Outsourced Vehicles</p>
                  {existingOutsourcedCars.length === 0 ? (
                    <div className="text-center py-8 bg-muted/10 border border-dashed border-border rounded-2xl">
                      <p className="text-xs text-muted-foreground">No outsourced cars listed yet.</p>
                      <button
                        type="button"
                        onClick={() => setShowAddForm(true)}
                        className="mt-2 text-xs font-bold text-primary hover:underline"
                      >
                        Register the first one now
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                      {existingOutsourcedCars.map((car) => {
                        const isMatch = car.vehicle_model_id === booking?.vehicle_model_id;
                        return (
                          <div
                            key={car.id}
                            className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                              isMatch ? 'bg-primary/5 border-primary/20 hover:border-primary/40' : 'bg-muted/10 border-border hover:border-border-hover'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-foreground">
                                  {car.make} {car.model} ({car.year})
                                </span>
                                {isMatch && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary/20 text-primary uppercase">
                                    Model Class Match
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                                <div>Plate: <span className="font-mono text-foreground uppercase">{car.license_plate}</span></div>
                                <div>Color: <span className="text-foreground">{car.color || 'N/A'}</span></div>
                                <div>Supplier: <span className="text-foreground">{car.outsource_owner_name || 'N/A'}</span></div>
                                <div>Daily Rate: <span className="text-foreground font-semibold">KES {Number(car.daily_rate).toLocaleString()}</span></div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                await handleAssignUnit(car.id);
                                setShowOutsourceModal(false);
                              }}
                              disabled={isAssigningUnit}
                              className="px-3.5 py-2 bg-primary text-black rounded-xl text-xs font-black uppercase tracking-wider hover:bg-primary/95 transition-all shadow-md shadow-primary/10 disabled:opacity-50"
                            >
                              Assign
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Add New Outsourced Car Form Section */
                <div className="space-y-4 animate-in fade-in duration-200">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Register & Add New Outsourced Car</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Make</label>
                      <input
                        value={outsourceForm.make}
                        onChange={(e) => setOutsourceForm((prev) => ({ ...prev, make: e.target.value }))}
                        placeholder="e.g. Toyota"
                        className="px-3 py-2 bg-muted/30 border border-border rounded-xl text-sm outline-none focus:border-primary transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Model</label>
                      <input
                        value={outsourceForm.model}
                        onChange={(e) => setOutsourceForm((prev) => ({ ...prev, model: e.target.value }))}
                        placeholder="e.g. Prado VXL"
                        className="px-3 py-2 bg-muted/30 border border-border rounded-xl text-sm outline-none focus:border-primary transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Year</label>
                      <input
                        type="number"
                        value={outsourceForm.year}
                        onChange={(e) => setOutsourceForm((prev) => ({ ...prev, year: Number(e.target.value) }))}
                        placeholder="e.g. 2023"
                        className="px-3 py-2 bg-muted/30 border border-border rounded-xl text-sm outline-none focus:border-primary transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">License Plate</label>
                      <input
                        value={outsourceForm.license_plate}
                        onChange={(e) => setOutsourceForm((prev) => ({ ...prev, license_plate: e.target.value }))}
                        placeholder="e.g. KDP 120H"
                        className="px-3 py-2 bg-muted/30 border border-border rounded-xl text-sm font-mono uppercase outline-none focus:border-primary transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Color</label>
                      <input
                        value={outsourceForm.color}
                        onChange={(e) => setOutsourceForm((prev) => ({ ...prev, color: e.target.value }))}
                        placeholder="e.g. Gray"
                        className="px-3 py-2 bg-muted/30 border border-border rounded-xl text-sm outline-none focus:border-primary transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Daily Rate (KES)</label>
                      <input
                        type="number"
                        value={outsourceForm.daily_rate}
                        onChange={(e) => setOutsourceForm((prev) => ({ ...prev, daily_rate: Number(e.target.value) }))}
                        placeholder="e.g. 15000"
                        className="px-3 py-2 bg-muted/30 border border-border rounded-xl text-sm outline-none focus:border-primary transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Supplier / Owner Name</label>
                      <input
                        value={outsourceForm.outsource_owner_name}
                        onChange={(e) => setOutsourceForm((prev) => ({ ...prev, outsource_owner_name: e.target.value }))}
                        placeholder="e.g. Kevin Ventures"
                        className="px-3 py-2 bg-muted/30 border border-border rounded-xl text-sm outline-none focus:border-primary transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Supplier Phone Number</label>
                      <input
                        value={outsourceForm.outsource_owner_phone}
                        onChange={(e) => setOutsourceForm((prev) => ({ ...prev, outsource_owner_phone: e.target.value }))}
                        placeholder="e.g. 0712345678"
                        className="px-3 py-2 bg-muted/30 border border-border rounded-xl text-sm outline-none focus:border-primary transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowOutsourceModal(false)}
                      className="flex-1 py-3 bg-muted text-muted-foreground rounded-xl font-bold text-sm hover:bg-muted/80 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSourceOutsourcedUnit}
                      disabled={savingOutsource}
                      className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/95 transition-all"
                    >
                      {savingOutsource ? <Loader2 size={16} className="animate-spin" /> : 'Create & assign'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in"
          onClick={() => setLightboxUrl(null)}
        >
          <button 
            onClick={() => setLightboxUrl(null)}
            className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
          >
            <X size={24} />
          </button>
          <img 
            src={lightboxUrl} 
            alt="Expanded view"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl animate-in zoom-in-95"
            onClick={e => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  );
}
