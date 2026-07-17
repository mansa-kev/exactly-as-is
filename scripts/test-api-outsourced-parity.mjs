#!/usr/bin/env node
/**
 * Smoke test: api/index.ts outsourced booking + payout parity helpers.
 * Usage: node scripts/test-api-outsourced-parity.mjs
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey =
  process.env.SB_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('FAIL Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exit(1);
  }
  console.log('OK', msg);
}

async function testFinancialHelpers() {
  const {
    buildBrokerMetadata,
    buildOutsourceMetadata,
    computeBookingFinancials,
    validateBookingTotalAmount,
  } = await import('../src/server/bookingFinancials.ts');

  const carRow = {
    id: 'test',
    fleet_owner_id: null,
    daily_rate: 5000,
    is_outsourced: true,
    outsource_commission_rate: 20,
    outsource_owner_name: 'Owner',
    outsource_owner_email: 'owner@test.com',
    outsource_owner_phone: '+254700000000',
  };

  const financials = await computeBookingFinancials(supabase, carRow, 'admin-fallback-id', 10000);
  assert(financials.commissionSource === 'outsource', 'outsourced car uses outsource commission source');
  assert(financials.commissionRate === 0.2, '20% commission normalizes to 0.2');
  assert(financials.platformCommission === 2000, 'platform commission = 20% of 10000');
  assert(financials.ownerPayoutAmount === 8000, 'owner payout = 8000');

  const brokerMeta = buildBrokerMetadata('broker-1', 10, 500);
  assert(brokerMeta?.broker_id === 'broker-1' && brokerMeta.broker_commission_amount === 500, 'broker metadata');

  const outsourceMeta = buildOutsourceMetadata(carRow);
  assert(outsourceMeta?.is_outsourced && outsourceMeta.owner_email === 'owner@test.com', 'outsource metadata');

  const start = new Date('2026-06-10');
  const end = new Date('2026-06-12');
  const amountCheck = validateBookingTotalAmount(10000, 5000, start, end);
  assert(amountCheck.ok, 'amount validation accepts 2-day booking total');
}

async function testPayoutSettlementInsert() {
  const { data: tableCheck, error: tableError } = await supabase
    .from('payout_settlements')
    .select('id')
    .limit(1);

  if (tableError) {
    console.log('SKIP payout_settlements table — run scripts/apply_outsourced_module_extension.sql');
    return;
  }

  const { data: car } = await supabase
    .from('cars')
    .select('id')
    .eq('is_outsourced', true)
    .limit(1)
    .maybeSingle();

  if (!car?.id) {
    console.log('SKIP payout insert — no outsourced car in DB');
    return;
  }

  const bookingId = randomUUID();
  const { error: bookingError } = await supabase.from('bookings').insert({
    id: bookingId,
    car_id: car.id,
    client_id: null,
    fleet_owner_id: (await supabase.from('user_profiles').select('id').eq('role', 'admin').limit(1).maybeSingle()).data?.id,
    start_date: '2026-06-10',
    end_date: '2026-06-11',
    total_amount: 5000,
    platform_commission: 750,
    status: 'confirmed',
    payment_status: 'paid',
    metadata: {
      owner_payout_amount: 4250,
      commission_rate_applied: 0.15,
      outsource_info: { is_outsourced: true, owner_email: null },
      broker_info: null,
    },
  });

  if (bookingError) {
    console.log('SKIP payout insert — could not seed test booking:', bookingError.message);
    return;
  }

  const { processBookingPayoutSettlements } = await import('../src/server/bookingPayoutSettlements.ts');
  await processBookingPayoutSettlements(supabase, bookingId, '[TEST]');

  const { data: settlement } = await supabase
    .from('payout_settlements')
    .select('id, type, amount, target_id')
    .eq('booking_id', bookingId)
    .eq('type', 'supplier')
    .maybeSingle();

  assert(!!settlement && Number(settlement.amount) === 4250, 'supplier settlement created on paid booking');

  await supabase.from('payout_settlements').delete().eq('booking_id', bookingId);
  await supabase.from('bookings').delete().eq('id', bookingId);
  console.log('OK payout settlement cleanup');
}

async function main() {
  console.log('Testing API outsourced parity helpers...');
  await testFinancialHelpers();
  await testPayoutSettlementInsert();
  console.log('\nAPI outsourced parity checks passed.');
}

main().catch((err) => {
  console.error('FAIL', err.message);
  process.exit(1);
});
