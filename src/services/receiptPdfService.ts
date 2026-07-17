import { fetchCompanySettings } from '../utils/contractTemplate';
import { getBookingVehicleDisplay } from '../utils/bookingVehicleDisplay';

export interface BookingReceiptInput {
  id: string;
  start_date?: string;
  end_date?: string;
  total_amount?: number;
  payment_status?: string;
  payment_method?: string;
  payment_reference?: string;
  transaction_code?: string;
  created_at?: string;
  cars?: {
    make?: string;
    model?: string;
    license_plate?: string;
    year?: number;
  } | null;
  client?: {
    full_name?: string;
    email?: string;
    phone_number?: string;
  } | null;
  metadata?: {
    guest_info?: {
      full_name?: string;
      email?: string;
      phone?: string;
    };
  };
}

export interface ReceiptTransactionInput {
  amount?: number;
  transaction_code?: string | null;
  created_at?: string;
  status?: string;
}

function formatMoney(amount: number): string {
  return `KES ${Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
}

function shortRef(id: string): string {
  return (id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
}

function getClientName(booking: BookingReceiptInput): string {
  return (
    booking.client?.full_name ||
    booking.metadata?.guest_info?.full_name ||
    'Customer'
  );
}

function getClientEmail(booking: BookingReceiptInput): string {
  return booking.client?.email || booking.metadata?.guest_info?.email || '—';
}

function buildReceiptHtml(
  booking: BookingReceiptInput,
  transaction: ReceiptTransactionInput | null,
  logoUrl: string
): string {
  const receiptNo =
    transaction?.transaction_code ||
    booking.transaction_code ||
    booking.payment_reference ||
    `RCP-${shortRef(booking.id)}`;
  const paidAt = transaction?.created_at || booking.created_at;
  const amount = Number(transaction?.amount ?? booking.total_amount ?? 0);
  const vehicle = getBookingVehicleDisplay(booking, 'client');
  const carLabel = vehicle.modelLabel || 'Rental vehicle';
  const plate = vehicle.isModelBooking ? 'Assigned prior to handover' : (vehicle.unitLabel || '—');
  const paymentMethod = (booking.payment_method || 'mpesa').replace(/_/g, ' ').toUpperCase();

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #111; max-width: 720px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #ff6b00; padding-bottom: 20px; margin-bottom: 24px;">
        <div>
          <img src="${logoUrl}" alt="LinkedUp Cars Rentals" style="height: 56px; width: auto; object-fit: contain; margin-bottom: 8px;" />
          <div style="font-size: 11px; color: #666; line-height: 1.5;">
            LinkedUp Cars Rentals<br />
            Nairobi, Kenya<br />
            support@linkedupcarsrentals.com
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 24px; font-weight: 800; color: #ff6b00; letter-spacing: 1px;">PAYMENT RECEIPT</div>
          <div style="font-size: 12px; color: #666; margin-top: 8px;">
            Receipt No: <strong>${receiptNo}</strong><br />
            Date: <strong>${formatDate(paidAt)}</strong>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">Billed To</div>
          <div style="font-size: 15px; font-weight: 700;">${getClientName(booking)}</div>
          <div style="font-size: 12px; color: #475569; margin-top: 4px;">${getClientEmail(booking)}</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">Booking Reference</div>
          <div style="font-size: 15px; font-weight: 700;">#${shortRef(booking.id)}</div>
          <div style="font-size: 12px; color: #475569; margin-top: 4px;">Status: ${(booking.payment_status || 'paid').toUpperCase()}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background: #0f172a; color: #fff;">
            <th style="text-align: left; padding: 12px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;">Description</th>
            <th style="text-align: right; padding: 12px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 14px; vertical-align: top;">
              <div style="font-weight: 700; font-size: 14px;">${carLabel}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                Plate: ${plate}<br />
                Rental period: ${formatDate(booking.start_date)} – ${formatDate(booking.end_date)}
              </div>
            </td>
            <td style="padding: 14px; text-align: right; font-weight: 700; font-size: 14px;">${formatMoney(amount)}</td>
          </tr>
        </tbody>
      </table>

      <div style="display: flex; justify-content: flex-end; margin-bottom: 28px;">
        <div style="min-width: 260px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: #fff7ed; border-bottom: 1px solid #fed7aa;">
            <span style="font-weight: 700; color: #9a3412;">Total Paid</span>
            <span style="font-weight: 800; color: #ea580c; font-size: 18px;">${formatMoney(amount)}</span>
          </div>
          <div style="padding: 12px 16px; font-size: 12px; color: #475569;">
            Payment method: <strong>${paymentMethod}</strong>
          </div>
        </div>
      </div>

      <div style="border-top: 1px dashed #cbd5e1; padding-top: 16px; font-size: 11px; color: #64748b; text-align: center; line-height: 1.6;">
        Thank you for choosing LinkedUp Cars Rentals.<br />
        This is a computer-generated receipt and is valid without a physical signature.
      </div>
    </div>
  `;
}

const PDF_OPTIONS = {
  margin: [12, 12, 12, 12] as [number, number, number, number],
  filename: 'payment-receipt.pdf',
  image: { type: 'jpeg' as const, quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true, allowTaint: true },
  jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
};

export async function openBookingReceiptPdf(
  booking: BookingReceiptInput,
  transaction?: ReceiptTransactionInput | null
): Promise<void> {
  const settings = await fetchCompanySettings();
  const logoUrl =
    settings.site_logo ||
    settings.logo_url ||
    settings.contract_logo ||
    `${window.location.origin}/favicon.svg`;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildReceiptHtml(booking, transaction || null, logoUrl);
  wrapper.style.padding = '24px';
  wrapper.style.background = '#fff';
  wrapper.style.width = '794px';
  document.body.appendChild(wrapper);

  try {
    const html2pdf = (await import('html2pdf.js')).default;
    const blob: Blob = await html2pdf().from(wrapper).set(PDF_OPTIONS).outputPdf('blob');
    const url = URL.createObjectURL(blob);
    const tab = window.open(url, '_blank');
    if (!tab) {
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${shortRef(booking.id)}.pdf`;
      link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } finally {
    document.body.removeChild(wrapper);
  }
}
