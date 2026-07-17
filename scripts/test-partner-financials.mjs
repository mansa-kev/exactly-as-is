#!/usr/bin/env node
/**
 * Unit smoke test for partner financial breakdown helpers.
 * Usage: npx tsx scripts/test-partner-financials.mjs
 */
import {
  buildPayoutBreakdown,
  buildBrokerReconciliation,
  buildBookingReconciliation,
  buildMonthlyPartnerChart,
} from '../src/utils/partnerFinancials.ts';

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exit(1);
  }
  console.log('OK', msg);
}

const outsourcedCarIds = new Set(['car-out-1']);

const settlements = [
  {
    booking_id: 'b1',
    type: 'supplier',
    target_id: 'car-out-1',
    amount: 8000,
    status: 'pending',
    created_at: '2026-06-01T10:00:00Z',
    booking: {
      id: 'b1',
      total_amount: 10000,
      platform_commission: 2000,
      created_at: '2026-06-01T09:00:00Z',
      car_id: 'car-out-1',
      cars: { is_outsourced: true, outsource_owner_name: 'Samuel' },
    },
  },
  {
    booking_id: 'b1',
    type: 'broker',
    target_id: 'broker-1',
    amount: 500,
    status: 'paid',
    settled_at: '2026-06-02T10:00:00Z',
    created_at: '2026-06-01T10:00:00Z',
    booking: {
      id: 'b1',
      total_amount: 10000,
      platform_commission: 2000,
      created_at: '2026-06-01T09:00:00Z',
      car_id: 'car-out-1',
      cars: { is_outsourced: true, outsource_owner_name: 'Samuel' },
    },
  },
  {
    booking_id: 'b2',
    type: 'supplier',
    target_id: 'car-fleet-1',
    amount: 4250,
    status: 'paid',
    settled_at: '2026-06-03T10:00:00Z',
    created_at: '2026-06-03T09:00:00Z',
    booking: {
      id: 'b2',
      total_amount: 5000,
      platform_commission: 750,
      created_at: '2026-06-03T08:00:00Z',
      car_id: 'car-fleet-1',
      cars: { is_outsourced: false, fleet_owner_id: 'fleet-1' },
    },
  },
];

const brokers = [{ id: 'broker-1', name: 'John Referrals' }];
const bookingsById = new Map([
  ['b1', { total_amount: 10000 }],
  ['b2', { total_amount: 5000 }],
]);

const breakdown = buildPayoutBreakdown(settlements, outsourcedCarIds);
assert(breakdown.supplierOutsourced.pending === 8000, 'outsourced supplier pending');
assert(breakdown.supplierFleet.paid === 4250, 'fleet supplier paid');
assert(breakdown.broker.paid === 500, 'broker paid');

const brokerRows = buildBrokerReconciliation(settlements, brokers, bookingsById);
assert(brokerRows.length === 1 && brokerRows[0].referralCount === 1, 'broker reconciliation count');
assert(brokerRows[0].grossReferred === 10000, 'broker gross referred');
assert(brokerRows[0].balance === 0 && brokerRows[0].commissionPaid === 500, 'broker paid balance');

const bookingRows = buildBookingReconciliation(settlements, brokers);
assert(bookingRows.length === 2, 'two booking reconciliation rows');
const withBroker = bookingRows.find((r) => r.brokerName);
assert(withBroker?.brokerName === 'John Referrals', 'booking row broker name');

const chart = buildMonthlyPartnerChart(
  [{ created_at: '2026-06-01T09:00:00Z', total_amount: 10000 }],
  settlements,
  outsourcedCarIds
);
assert(chart.some((m) => m.revenue > 0), 'monthly chart has revenue');

console.log('\nPartner financial helpers passed.');
