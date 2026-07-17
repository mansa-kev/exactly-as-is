#!/usr/bin/env node
/**
 * Audit and backfill booking records:
 * - document_status stuck on 'pending' while booking is already confirmed/paid
 * - paid bookings missing e_contracts PDF
 *
 * Usage:
 *   node scripts/backfill_booking_records.mjs              # report only
 *   node scripts/backfill_booking_records.mjs --apply      # fix document_status rows
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const apply = process.argv.includes('--apply');

const url = process.env.VITE_SUPABASE_URL;
const key =
  process.env.SB_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or service role key in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

const { data: bookings, error } = await supabase
  .from('bookings')
  .select('id, status, payment_status, document_status, metadata, created_at, e_contracts(id, pdf_url)')
  .order('created_at', { ascending: false })
  .limit(1000);

if (error) {
  console.error(error.message);
  process.exit(1);
}

const rows = bookings || [];

const staleDocStatus = rows.filter((b) => {
  const paidish = b.payment_status === 'paid';
  const progressed = ['confirmed', 'pending_collection', 'on_trip', 'returned', 'completed'].includes(b.status);
  const docsPending = b.document_status === 'pending' || b.document_status == null;
  const physicallyVerified = b.metadata?.documentsVerifiedPhysically === true;
  return paidish && progressed && docsPending && !physicallyVerified;
});

const missingContracts = rows.filter((b) => {
  const hasPdf = (b.e_contracts || []).some((c) => c.pdf_url);
  if (hasPdf) return false;
  const meta = b.metadata || {};
  const sig = meta.signature_url || meta.signature || meta.documents?.signatureUrl;
  return !!sig && sig !== 'signed_physically_in_person' && b.payment_status === 'paid';
});

console.log('=== Booking backfill report ===\n');
console.log(`Stale document_status (paid + active, still pending): ${staleDocStatus.length}`);
for (const b of staleDocStatus) {
  console.log(`  - ${b.id}  status=${b.status}  payment=${b.payment_status}  docs=${b.document_status}`);
}

console.log(`\nMissing e_contracts PDF (paid + signature in metadata): ${missingContracts.length}`);
for (const b of missingContracts) {
  console.log(`  - ${b.id}  status=${b.status}`);
  console.log(`    → Regenerate in Admin → Booking → Documents → Generate Contract PDF`);
}

if (!apply) {
  if (staleDocStatus.length) {
    console.log('\nRun with --apply to set document_status=approved on stale rows above.');
  }
  process.exit(0);
}

if (!staleDocStatus.length) {
  console.log('\nNo document_status rows to update.');
  process.exit(0);
}

let updated = 0;
for (const b of staleDocStatus) {
  const { error: updateError } = await supabase
    .from('bookings')
    .update({ document_status: 'approved' })
    .eq('id', b.id);

  if (updateError) {
    console.error(`  FAIL ${b.id}:`, updateError.message);
  } else {
    updated += 1;
    console.log(`  UPDATED ${b.id} → document_status=approved`);
  }
}

console.log(`\nDone. Updated ${updated} booking(s).`);
