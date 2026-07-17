import {
  ContractBookingData,
  ContractCar,
  loadFilledContractHtml,
  wrapContractHtmlForPdf,
  getClientNameFromBooking,
  getTotalCostFromBooking,
  formatContractDate,
  resolveContractVehicle,
} from '../utils/contractTemplate';
import { enhancedContractService, type ContractData, type SignedContract } from './enhancedContractService';

export interface GenerateContractPdfOptions {
  contract: any;
  bookingData: ContractBookingData;
  car: ContractCar;
  signatureData: string;
  vehicleModelId?: string | null;
}

const PDF_OPTIONS = {
  margin: 10,
  filename: 'contract.pdf',
  image: { type: 'jpeg' as const, quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true, allowTaint: true },
  jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
};

export function buildContractData(
  bookingId: string,
  bookingData: ContractBookingData,
  car: ContractCar,
  vehicleModelId?: string | null
): ContractData {
  const resolved = resolveContractVehicle(car, vehicleModelId);
  return {
    booking_id: bookingId,
    client_name: getClientNameFromBooking(bookingData),
    client_email: bookingData?.email || bookingData?.metadata?.guest_info?.email || '',
    client_phone: bookingData?.phone || bookingData?.metadata?.guest_info?.phone || '',
    car_make: resolved.isModelBooking ? resolved.displayName : resolved.make,
    car_model: resolved.isModelBooking ? '(or equivalent)' : resolved.model,
    license_plate: resolved.licensePlate,
    pickup_date: String(bookingData?.startDate || bookingData?.start_date || ''),
    dropoff_date: String(bookingData?.endDate || bookingData?.end_date || ''),
    daily_rate: resolved.dailyRate,
    total_amount: getTotalCostFromBooking(bookingData),
    security_deposit: resolved.securityDeposit,
    po_box: bookingData?.poBox || bookingData?.po_box,
    id_number: bookingData?.idNumber || bookingData?.id_number,
    color: resolved.color,
  };
}

export async function generateContractPdfBase64(
  options: GenerateContractPdfOptions
): Promise<string> {
  const { contract, bookingData, car, signatureData, vehicleModelId } = options;

  if (!signatureData || signatureData === 'signed_physically_in_person') {
    throw new Error('A client digital signature is required to generate the contract PDF.');
  }

  const filledHtml = await loadFilledContractHtml(contract, bookingData, car, signatureData, vehicleModelId);
  if (!filledHtml) {
    throw new Error('No active HTML contract template found. Upload one in Admin → Contract Manager.');
  }

  // Detect mobile to reduce canvas scale and prevent OOM crashes
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  // Pass HTML string directly to html2pdf
  // It handles creating an offscreen iframe internally, completely avoiding all cropping/opacity bugs.
  const fullHtmlString = wrapContractHtmlForPdf(filledHtml);

  try {
    const html2pdf = (await import('html2pdf.js')).default;
    const pdfOptions = {
      ...PDF_OPTIONS,
      html2canvas: {
        ...PDF_OPTIONS.html2canvas,
        // Scale 1 on mobile to avoid out-of-memory crashes
        scale: isMobile ? 1 : 2,
        useCORS: true,
        allowTaint: true,
      },
    };
    return await html2pdf().from(fullHtmlString).set(pdfOptions).outputPdf('datauristring');
  } catch (error) {
    console.error('PDF Generation Error:', error);
    throw error;
  }
}

export async function generateAndSaveContract(
  bookingId: string,
  options: GenerateContractPdfOptions
): Promise<SignedContract> {
  const existing = await enhancedContractService.getContractByBooking(bookingId);
  if (existing?.contract_url) {
    return existing;
  }

  const pdfBase64 = await generateContractPdfBase64(options);
  const contractData = buildContractData(bookingId, options.bookingData, options.car, options.vehicleModelId);

  return enhancedContractService.saveSignedContract(
    bookingId,
    options.signatureData,
    contractData,
    pdfBase64
  );
}

export async function regenerateAndSaveContract(
  bookingId: string,
  options: GenerateContractPdfOptions
): Promise<SignedContract> {
  const pdfBase64 = await generateContractPdfBase64(options);
  const contractData = buildContractData(bookingId, options.bookingData, options.car, options.vehicleModelId);
  return enhancedContractService.saveSignedContract(
    bookingId,
    options.signatureData,
    contractData,
    pdfBase64,
    null,
    true
  );
}

export function buildBookingSummaryForContract(booking: any, car: any): ContractBookingData {
  const meta = booking?.metadata || {};
  const guest = meta.guest_info || {};
  return {
    fullName: guest.full_name || booking?.client?.full_name,
    email: guest.email || booking?.client?.email,
    phone: guest.phone || booking?.client?.phone_number,
    idNumber: guest.id_number || guest.license_number,
    startDate: booking?.start_date,
    endDate: booking?.end_date,
    totalAmount: booking?.total_price ?? booking?.total_amount,
    days: booking?.rental_days,
    signatureData: meta.signature_url || meta.signature || meta.documents?.signatureUrl,
    signatureUrl: meta.signature_url || meta.signature || meta.documents?.signatureUrl,
  };
}

export function formatContractSummaryLine(
  bookingData: ContractBookingData,
  car: ContractCar,
  vehicleModelId?: string | null
): string {
  const resolved = resolveContractVehicle(car, vehicleModelId);
  const vehicleLabel = resolved.isModelBooking
    ? resolved.displayName
    : `${resolved.make} ${resolved.model}`.trim();
  return `${getClientNameFromBooking(bookingData)} · ${vehicleLabel} · ${formatContractDate(bookingData?.startDate)} – ${formatContractDate(bookingData?.endDate)}`;
}
