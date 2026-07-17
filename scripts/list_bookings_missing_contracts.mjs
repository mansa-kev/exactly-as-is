/**
 * Lists paid/confirmed bookings that have a client signature in metadata
 * but no row in e_contracts. Use Admin → Booking → Documents → Generate Contract PDF
 * or run contract regeneration from the admin UI for each ID.
 *
 * Usage: node scripts/list_bookings_missing_contracts.mjs
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or service role key in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

const { data: bookings, error } = await supabase
  .from('bookings')
  .select('id, status, payment_status, metadata, e_contracts(id, pdf_url)')
  .in('payment_status', ['paid', 'pending'])
  .order('created_at', { ascending: false })
  .limit(500);

if (error) {
  console.error(error.message);
  process.exit(1);
}

const missing = (bookings || []).filter((b) => {
  const hasContract = (b.e_contracts || []).some((c) => c.pdf_url);
  if (hasContract) return false;
  const meta = b.metadata || {};
  const sig = meta.signature_url || meta.signature || meta.documents?.signatureUrl;
  return !!sig && sig !== 'signed_physically_in_person';
});

console.log(`Bookings missing e_contracts PDF (${missing.length}):`);
for (const b of missing) {
  console.log(`- ${b.id}  status=${b.status}  payment=${b.payment_status}`);
}
