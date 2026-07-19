/**
 * Shared extension quote calculator.
 * Used by admin (AdminBookingCommandCenter) and client (MyInbox → Request Extension)
 * so both paths compute totals the same way.
 *
 * Anchor rule:
 *   The new end_date is measured from the CURRENT end_date (or `pickup_confirmed_at
 *   + rentalDays*24h` when the trip is on and end_date wasn't yet extended), so
 *   stacked extensions never inflate hours.
 */

export interface ExtensionQuoteInput {
  /** Booking's current end_date (ISO). Anchor for the new deadline. */
  currentEndDate: string;
  /** Vehicle daily rate (KES/day). */
  dailyRate: number;
  /** Whole days to extend by (>= 0). */
  days?: number;
  /** Extra hours to extend by, on top of days (0-23). Prorated at dailyRate/24. */
  hours?: number;
  /** Insurance premium already applied to the booking, per day. Optional. */
  insurancePerDay?: number;
  /** Driver fee per day (if a chauffeur is on the trip). Optional. */
  driverFeePerDay?: number;
  /** Flat admin fee for processing the extension. Optional. */
  adminFee?: number;
  /** VAT/tax rate as decimal (e.g. 0.16 for 16%). Applied to (base+insurance+driver+adminFee). */
  taxRate?: number;
  /** Discount amount in KES to subtract before tax. Optional. */
  discount?: number;
  /** Currency code, defaults to KES. */
  currency?: string;
}

export interface ExtensionQuoteLine {
  key: string;
  label: string;
  amount: number;
}

export interface ExtensionQuote {
  currency: string;
  days: number;
  hours: number;
  totalHours: number;
  newEndDate: string;         // ISO
  lines: ExtensionQuoteLine[];
  base: number;
  insurance: number;
  driver: number;
  adminFee: number;
  discount: number;
  tax: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeExtensionQuote(input: ExtensionQuoteInput): ExtensionQuote {
  const days = Math.max(0, Math.floor(input.days ?? 0));
  const hours = Math.max(0, Math.min(23, Math.floor(input.hours ?? 0)));
  const dailyRate = Math.max(0, Number(input.dailyRate) || 0);
  const insurancePerDay = Math.max(0, Number(input.insurancePerDay) || 0);
  const driverPerDay = Math.max(0, Number(input.driverFeePerDay) || 0);
  const adminFee = Math.max(0, Number(input.adminFee) || 0);
  const discount = Math.max(0, Number(input.discount) || 0);
  const taxRate = Math.max(0, Number(input.taxRate) || 0);
  const currency = input.currency || 'KES';

  const totalHours = days * 24 + hours;
  const durationFactor = totalHours / 24; // fractional days

  const base = round2(dailyRate * durationFactor);
  const insurance = round2(insurancePerDay * durationFactor);
  const driver = round2(driverPerDay * durationFactor);

  const subtotal = round2(base + insurance + driver + adminFee - discount);
  const tax = round2(Math.max(0, subtotal) * taxRate);
  const total = Math.max(0, round2(subtotal + tax));

  // Anchor new deadline on the current end_date
  const anchor = new Date(input.currentEndDate);
  const newEnd = Number.isFinite(anchor.getTime())
    ? new Date(anchor.getTime() + totalHours * 60 * 60 * 1000)
    : new Date(Date.now() + totalHours * 60 * 60 * 1000);

  const lines: ExtensionQuoteLine[] = [];
  if (base > 0)      lines.push({ key: 'base',      label: `Rental (${days}d ${hours}h @ ${dailyRate.toLocaleString()}/day)`, amount: base });
  if (insurance > 0) lines.push({ key: 'insurance', label: 'Insurance', amount: insurance });
  if (driver > 0)    lines.push({ key: 'driver',    label: 'Driver fee', amount: driver });
  if (adminFee > 0)  lines.push({ key: 'admin_fee', label: 'Processing fee', amount: adminFee });
  if (discount > 0)  lines.push({ key: 'discount',  label: 'Discount', amount: -discount });
  if (tax > 0)       lines.push({ key: 'tax',       label: `Tax (${(taxRate * 100).toFixed(0)}%)`, amount: tax });

  return {
    currency,
    days,
    hours,
    totalHours,
    newEndDate: newEnd.toISOString(),
    lines,
    base,
    insurance,
    driver,
    adminFee,
    discount,
    tax,
    total,
  };
}

export function formatQuoteAmount(amount: number, currency = 'KES'): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}${currency} ${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
