#!/usr/bin/env node
/**
 * Smoke test: prepare-continuation + continuation load for a paid reservation.
 * Usage: node scripts/test-reservation-continuation.mjs [reservationId] [baseUrl]
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const reservationIdArg = process.argv[2] && !process.argv[2].startsWith('http') ? process.argv[2] : null;
const baseUrl = process.argv.find((a) => a.startsWith('http')) || 'http://localhost:8080';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey =
  process.env.SB_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  let reservationId = reservationIdArg;

  if (!reservationId) {
    const { data, error } = await supabase
      .from('car_reservations')
      .select('id')
      .eq('payment_status', 'paid')
      .in('status', ['reserved', 'confirmed'])
      .is('linked_booking_id', null)
      .limit(1)
      .maybeSingle();

    if (error || !data?.id) {
      console.error('No paid reservation found for smoke test. Pass a reservation ID as first argument.');
      process.exit(1);
    }
    reservationId = data.id;
  }

  console.log('Testing reservation:', reservationId);

  const prep = await fetch(`${baseUrl}/api/reservations/${reservationId}/prepare-continuation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initiatedBy: 'client' }),
  });
  const prepBody = await prep.json().catch(() => ({}));

  if (!prep.ok || !prepBody.success || !prepBody.token) {
    console.error('FAIL prepare-continuation', prep.status, prepBody);
    process.exit(1);
  }

  console.log('OK prepare-continuation token:', prepBody.token.slice(0, 16) + '...');

  const cont = await fetch(`${baseUrl}/api/reservations/continuation/${prepBody.token}`);
  const contBody = await cont.json().catch(() => ({}));

  if (!cont.ok || !contBody.success || !contBody.bookingData?.sourceReservationId) {
    console.error('FAIL continuation load', cont.status, contBody);
    process.exit(1);
  }

  console.log('OK continuation load for car:', contBody.carId);
  console.log('  sourceReservationId:', contBody.bookingData.sourceReservationId);
}

main().catch((err) => {
  console.error('FAIL', err.message);
  process.exit(1);
});
