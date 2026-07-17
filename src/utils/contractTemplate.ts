import { toProxiedAssetUrl } from './assetUrl.js';

export type ContractBookingData = Record<string, any>;
export type ContractCar = Record<string, any>;

export const MODEL_BOOKING_PLATE_LABEL = 'To be assigned prior to handover';
export const MODEL_BOOKING_COLOR_LABEL = 'As confirmed during pickup';

export type ContractVehicleInfo = {
  isModelBooking: boolean;
  displayName: string;
  make: string;
  model: string;
  licensePlate: string;
  color: string;
  dailyRate: number;
  securityDeposit: number;
};

export function isModelBookingCar(car: ContractCar | null | undefined): boolean {
  if (!car) return false;
  if (car.vehicle_model) return true;
  const plate = String(car.license_plate || '').trim().toUpperCase();
  if (plate === 'MODEL') return true;
  if (car.vehicle_model_id && car.vehicle_model_id === car.id) return true;
  return false;
}

/** Normalize car vs vehicle-model fields for contracts and booking summaries. */
export function resolveContractVehicle(
  car: ContractCar | null | undefined,
  vehicleModelId?: string | null
): ContractVehicleInfo {
  const isModelBooking = !!vehicleModelId || isModelBookingCar(car);
  const vehicleModel = car?.vehicle_model;

  const make = isModelBooking
    ? String(vehicleModel?.make || car?.make || '')
    : String(car?.make || '');
  const model = isModelBooking
    ? String(vehicleModel?.model || car?.model || '')
    : String(car?.model || '');
  const displayName = isModelBooking
    ? String(
        vehicleModel?.display_name ||
          `${make} ${model}`.trim() ||
          'Selected vehicle model'
      )
    : `${make} ${model}`.trim();

  const licensePlate = isModelBooking
    ? MODEL_BOOKING_PLATE_LABEL
    : String(car?.license_plate || '');
  const color = isModelBooking
    ? MODEL_BOOKING_COLOR_LABEL
    : String(car?.color || '');

  const dailyRate = Number(
    isModelBooking
      ? vehicleModel?.base_daily_rate ?? car?.daily_rate
      : car?.daily_rate
  ) || 0;
  const securityDeposit = Number(
    isModelBooking
      ? vehicleModel?.security_deposit ?? car?.security_deposit
      : car?.security_deposit
  ) || 0;

  return {
    isModelBooking,
    displayName,
    make,
    model,
    licensePlate,
    color,
    dailyRate,
    securityDeposit,
  };
}

export function contractVehicleToCarShape(
  car: ContractCar | null | undefined,
  vehicleModelId?: string | null
): ContractCar {
  const resolved = resolveContractVehicle(car, vehicleModelId);
  return {
    ...(car || {}),
    make: resolved.isModelBooking ? resolved.displayName : resolved.make,
    model: resolved.isModelBooking ? '(or equivalent)' : resolved.model,
    license_plate: resolved.licensePlate,
    color: resolved.color,
    daily_rate: resolved.dailyRate,
    overtime_rate: Number(car?.overtime_rate ?? car?.vehicle_model?.overtime_rate ?? 500),
    security_deposit: resolved.securityDeposit,
    vehicle_display_name: resolved.displayName,
    vehicle_equivalent_clause: resolved.isModelBooking
      ? ' (or an equivalent vehicle of the same model class)'
      : '',
    is_model_booking: resolved.isModelBooking,
  };
}

const BLANK_SIGNATURE =
  'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

export function formatContractDate(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatAgreementDateParts(date: string | Date | null | undefined): {
  day: string;
  dayOrdinal: string;
  month: string;
  year: string;
  yearWords: string;
} {
  const d = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  const valid = !Number.isNaN(d.getTime()) ? d : new Date();
  const day = String(valid.getDate());
  const suffix =
    day === '1' || day === '21' || day === '31'
      ? 'st'
      : day === '2' || day === '22'
        ? 'nd'
        : day === '3' || day === '23'
          ? 'rd'
          : 'th';
  const month = valid.toLocaleDateString('en-GB', { month: 'long' });
  const year = String(valid.getFullYear());
  const yearWords = numberToWords(valid.getFullYear());
  return { day, dayOrdinal: `${day}${suffix}`, month, year, yearWords };
}

function numberToWords(n: number): string {
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (n < 20) return ones[n] || String(n);
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return `${tens[t]}${o ? ` ${ones[o]}` : ''}`.trim();
  }
  if (n < 2000) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    return `${ones[hundreds]} Hundred${rest ? ` ${numberToWords(rest)}` : ''}`.trim();
  }
  if (n < 3000) {
    const rest = n % 1000;
    return `Two Thousand${rest ? ` ${numberToWords(rest)}` : ''}`.trim();
  }
  return String(n);
}

export function getClientNameFromBooking(bookingData: ContractBookingData): string {
  return (
    bookingData?.fullName ||
    bookingData?.full_name ||
    bookingData?.metadata?.guest_info?.full_name ||
    `${bookingData?.firstName || ''} ${bookingData?.lastName || ''}`.trim() ||
    'the Client'
  );
}

export function getTotalCostFromBooking(bookingData: ContractBookingData): number {
  const totalCost =
    bookingData?.totalCost ??
    bookingData?.total_amount ??
    bookingData?.totalAmount ??
    bookingData?.amount ??
    bookingData?.total ??
    0;
  return typeof totalCost === 'number' ? totalCost : parseFloat(String(totalCost)) || 0;
}

export function getMasterTemplateUrl(contract: any): string | null {
  if (!contract) return null;
  const url = contract.preview_url || contract.pdf_url || contract.contract_url || contract.template_url;
  return url || null;
}

export function isHtmlContract(contract: any): boolean {
  const url = getMasterTemplateUrl(contract);
  return !!url && url.includes('.html');
}

export async function fetchCompanySettings(): Promise<Record<string, string>> {
  const response = await fetch(
    '/api/public-app-settings?keys=company_po_box,company_signature_url,contract_logo,site_logo,logo_url'
  );
  if (!response.ok) return {};

  const data = await response.json();
  const settings: Record<string, string> = {};
  (data.settings || []).forEach((item: any) => {
    const raw = item.logo_url || item.value || '';
    settings[item.key] = toProxiedAssetUrl(raw) || raw;
  });
  return settings;
}

export function applyTemplateReplacements(
  templateHtml: string,
  bookingData: ContractBookingData,
  car: ContractCar,
  settings: Record<string, string>,
  signatureData = '',
  vehicleModelId?: string | null
): string {
  const resolvedCar = contractVehicleToCarShape(car, vehicleModelId);
  const clientName = getClientNameFromBooking(bookingData);
  const clientSignature = signatureData || bookingData?.signatureData || bookingData?.signatureUrl || '';
  const companySig = toProxiedAssetUrl(settings.company_signature_url) || settings.company_signature_url || BLANK_SIGNATURE;
  const contractLogo =
    toProxiedAssetUrl(settings.contract_logo || settings.site_logo || settings.logo_url) ||
    settings.contract_logo ||
    settings.site_logo ||
    settings.logo_url ||
    companySig;
  const clientSigImg = `<img data-client-signature="1" src="${clientSignature || BLANK_SIGNATURE}" alt="Client Signature" style="max-height: 80px; display:block; margin:0 auto 10px auto;" />`;
  const companySigImg = `<img src="${companySig}" alt="Company Signature" style="max-height: 80px; display:block; margin:0 auto 10px auto;" />`;
  const agreementDate = formatAgreementDateParts(
    bookingData?.startDate || bookingData?.start_date || new Date()
  );
  const startParts = formatAgreementDateParts(bookingData?.startDate || bookingData?.start_date);
  const endParts = formatAgreementDateParts(bookingData?.endDate || bookingData?.end_date);
  const overtimeRate = Number(
    car?.overtime_rate ?? car?.vehicle_model?.overtime_rate ?? resolvedCar?.overtime_rate ?? 500
  );

  let replaced = templateHtml;
  replaced = replaced.replace(/\{\{clientName\}\}/g, clientName);
  replaced = replaced.replace(/\{\{idNumber\}\}/g, bookingData?.idNumber || bookingData?.id_number || '_____________');
  replaced = replaced.replace(/\{\{clientPhone\}\}/g, bookingData?.phone || bookingData?.phone_number || '_____________');
  replaced = replaced.replace(/\{\{clientPoBox\}\}/g, bookingData?.poBox || bookingData?.po_box || '_____________');
  replaced = replaced.replace(/\{\{carMake\}\}/g, resolvedCar?.make || '');
  replaced = replaced.replace(/\{\{carModel\}\}/g, resolvedCar?.model || '');
  replaced = replaced.replace(/\{\{vehicleDisplayName\}\}/g, resolvedCar?.vehicle_display_name || `${resolvedCar?.make || ''} ${resolvedCar?.model || ''}`.trim());
  replaced = replaced.replace(/\{\{vehicleEquivalentClause\}\}/g, resolvedCar?.vehicle_equivalent_clause || '');
  replaced = replaced.replace(/\{\{licensePlate\}\}/g, resolvedCar?.license_plate || '');
  replaced = replaced.replace(/\{\{color\}\}/g, resolvedCar?.color || '_____________');
  replaced = replaced.replace(/\{\{startDate\}\}/g, formatContractDate(bookingData?.startDate || bookingData?.start_date));
  replaced = replaced.replace(/\{\{endDate\}\}/g, formatContractDate(bookingData?.endDate || bookingData?.end_date));
  replaced = replaced.replace(/\{\{totalAmount\}\}/g, getTotalCostFromBooking(bookingData).toLocaleString());
  replaced = replaced.replace(/\{\{dailyRate\}\}/g, resolvedCar?.daily_rate?.toLocaleString?.() || String(resolvedCar?.daily_rate || ''));
  replaced = replaced.replace(/\{\{overtimeRate\}\}/g, overtimeRate.toLocaleString());
  replaced = replaced.replace(/\{\{mileage\}\}/g, 'as confirmed during pickup');
  replaced = replaced.replace(/\{\{agreementDay\}\}/g, agreementDate.dayOrdinal);
  replaced = replaced.replace(/\{\{agreementMonth\}\}/g, agreementDate.month);
  replaced = replaced.replace(/\{\{agreementYear\}\}/g, agreementDate.year);
  replaced = replaced.replace(/\{\{agreementYearWords\}\}/g, agreementDate.yearWords);
  replaced = replaced.replace(/\{\{startDay\}\}/g, startParts.dayOrdinal);
  replaced = replaced.replace(/\{\{startMonth\}\}/g, startParts.month);
  replaced = replaced.replace(/\{\{startYear\}\}/g, startParts.year);
  replaced = replaced.replace(/\{\{endDay\}\}/g, endParts.dayOrdinal);
  replaced = replaced.replace(/\{\{endMonth\}\}/g, endParts.month);
  replaced = replaced.replace(/\{\{endYear\}\}/g, endParts.year);
  replaced = replaced.replace(/\{\{companyPoBox\}\}/g, settings.company_po_box || '2345');
  replaced = replaced.replace(/\{\{companyLogoUrl\}\}/g, contractLogo || settings.site_logo || companySig);
  replaced = replaced.replace(/\{\{logoUrl\}\}/g, contractLogo || settings.site_logo || companySig);
  replaced = replaced.replace(
    /(src|href)\s*=\s*"\s*\{\{\s*(companySignatureUrl|company_signature_url|companySignature|company_signature|ownerSignatureUrl|owner_signature_url|ownerSignature|owner_signature|companyRepSignature|company_rep_signature)\s*\}\}\s*"/gi,
    `$1="${companySig}"`
  );
  replaced = replaced.replace(
    /\{\{\s*(companySignatureUrl|company_signature_url|ownerSignatureUrl|owner_signature_url)\s*\}\}/g,
    companySig
  );
  replaced = replaced.replace(
    /\{\{\s*(companySignature|company_signature|ownerSignature|owner_signature|companyRepSignature|company_rep_signature)\s*\}\}/g,
    companySigImg
  );
  replaced = replaced.replace(
    /<img([^>]*?)src\s*=\s*"\s*\{\{\s*(clientSignatureUrl|client_signature_url|clientSignature|client_signature|hirerSignatureUrl|hirer_signature_url|hirerSignature|hirer_signature)\s*\}\}\s*"([^>]*?)>/gi,
    `<img$1data-client-signature="1" src="${clientSignature || BLANK_SIGNATURE}"$3>`
  );
  replaced = replaced.replace(
    /(src|href)\s*=\s*"\s*\{\{\s*(clientSignatureUrl|client_signature_url|clientSignature|client_signature|hirerSignatureUrl|hirer_signature_url|hirerSignature|hirer_signature)\s*\}\}\s*"/gi,
    `$1="${clientSignature || BLANK_SIGNATURE}"`
  );
  replaced = replaced.replace(
    /\{\{\s*(clientSignatureUrl|client_signature_url|hirerSignatureUrl|hirer_signature_url)\s*\}\}/g,
    clientSignature || BLANK_SIGNATURE
  );
  replaced = replaced.replace(
    /\{\{\s*(clientSignature|client_signature|hirerSignature|hirer_signature)\s*\}\}/g,
    clientSigImg
  );
  replaced = replaced.replace(/\(as confirmed at the pickup\)/gi, '(as confirmed during pickup)');

  return replaced;
}

export async function loadFilledContractHtml(
  contract: any,
  bookingData: ContractBookingData,
  car: ContractCar,
  signatureData = '',
  vehicleModelId?: string | null
): Promise<string | null> {
  if (!isHtmlContract(contract)) return null;

  const templateUrl = getMasterTemplateUrl(contract);
  if (!templateUrl) return null;

  const [templateHtml, settings] = await Promise.all([
    fetch(templateUrl).then((res) => {
      if (!res.ok) throw new Error('Failed to load contract template');
      return res.text();
    }),
    fetchCompanySettings(),
  ]);

  return applyTemplateReplacements(templateHtml, bookingData, car, settings, signatureData, vehicleModelId);
}

export function wrapContractHtmlForPdf(html: string): string {
  // Extract all <style> blocks from the HTML string
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styles = '';
  let match;
  while ((match = styleRegex.exec(html)) !== null) {
    styles += match[1] + '\n';
  }

  // Extract content inside the <body> tag
  const bodyRegex = /<body[^>]*>([\s\S]*?)<\/body>/i;
  const bodyMatch = bodyRegex.exec(html);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;

  // Root container styles for standard A4 width
  const overrideStyles = `
    width: 794px !important;
    max-width: 794px !important;
    margin: 0 auto !important;
    padding: 32px !important;
    box-sizing: border-box !important;
    background: #ffffff !important;
    color: #111 !important;
    font-family: 'Times New Roman', Times, serif !important;
  `;

  const allStyles = `
    ${styles}
    * { box-sizing: border-box !important; }
    html, body, div, p, span, table, tr, td, th, h1, h2, h3, h4, h5, h6 { max-width: 100% !important; word-wrap: break-word !important; word-break: break-word !important; }
    img { max-width: 100% !important; height: auto !important; }
    table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; }
    .signatures { display: flex !important; flex-direction: row !important; justify-content: space-between !important; gap: 24px !important; width: 100% !important; }
    .signature-box { flex: 1 1 0 !important; min-width: 0 !important; }
  `;

  return `
    <div style="${overrideStyles}">
      <style>
        ${allStyles}
      </style>
      ${bodyContent}
    </div>
  `;
}
