import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateRentalDays } from '../utils/rentalDays.js';

export type CommissionSource = 'outsource' | 'fleet_owner' | 'default';

export interface CarFinancialRow {
  id: string;
  fleet_owner_id: string | null;
  daily_rate: number | null;
  is_outsourced?: boolean | null;
  outsource_commission_rate?: number | null;
  outsource_owner_name?: string | null;
  outsource_owner_email?: string | null;
  outsource_owner_phone?: string | null;
}

export interface BookingFinancials {
  commissionRate: number;
  commissionSource: CommissionSource;
  platformCommission: number;
  ownerPayoutAmount: number;
}

export async function computeBookingFinancials(
  supabase: SupabaseClient,
  carRow: CarFinancialRow,
  fleetOwnerId: string,
  total: number
): Promise<BookingFinancials> {
  let commissionRate = 0.15;
  let commissionSource: CommissionSource = 'default';

  if (carRow.is_outsourced && Number.isFinite(Number(carRow.outsource_commission_rate))) {
    commissionRate = Number(carRow.outsource_commission_rate);
    if (commissionRate > 1) commissionRate = commissionRate / 100;
    commissionSource = 'outsource';
  } else {
    const { data: fleetSettings } = await supabase
      .from('fleet_owner_settings')
      .select('commission_rate')
      .eq('id', fleetOwnerId)
      .maybeSingle();

    if (fleetSettings && Number.isFinite(Number(fleetSettings.commission_rate))) {
      commissionRate = Number(fleetSettings.commission_rate);
      if (commissionRate > 1) commissionRate = commissionRate / 100;
      commissionSource = 'fleet_owner';
    }
  }

  const platformCommission = Math.round(total * commissionRate * 100) / 100;
  const ownerPayoutAmount = Math.round((total - platformCommission) * 100) / 100;

  return { commissionRate, commissionSource, platformCommission, ownerPayoutAmount };
}

export function validateBookingTotalAmount(
  total: number,
  dailyRate: number,
  start: Date,
  end: Date
): { ok: true; days: number; minAllowed: number; maxAllowed: number } | { ok: false; error: string } {
  if (!Number.isFinite(total) || total <= 0) {
    return { ok: false, error: 'Invalid total amount.' };
  }

  const days = calculateRentalDays(start, end);
  const expected = dailyRate * days;
  const minAllowed = Math.floor(expected * 0.5);
  const maxAllowed = Math.ceil(expected * 1.2);

  if (expected > 0 && (total < minAllowed || total > maxAllowed)) {
    return {
      ok: false,
      error: `Total amount KES ${total} does not match expected range (KES ${minAllowed}–${maxAllowed}) for ${days} day(s) @ KES ${dailyRate}/day.`,
    };
  }

  return { ok: true, days, minAllowed, maxAllowed };
}

export function buildOutsourceMetadata(carRow: CarFinancialRow) {
  if (!carRow.is_outsourced) return null;
  return {
    is_outsourced: true,
    owner_name: carRow.outsource_owner_name || null,
    owner_email: carRow.outsource_owner_email || null,
    owner_phone: carRow.outsource_owner_phone || null,
  };
}

export function buildBrokerMetadata(
  brokerId: string | null | undefined,
  brokerRate: number | string | null | undefined,
  brokerCommissionAmount: number | string | null | undefined
) {
  if (!brokerId) return null;
  return {
    broker_id: brokerId,
    broker_commission_rate: Number(brokerRate) || 0,
    broker_commission_amount: Number(brokerCommissionAmount) || 0,
  };
}
