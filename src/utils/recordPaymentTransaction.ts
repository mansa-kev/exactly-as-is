import { supabase } from '../lib/supabase.js';
import { logger } from './logger.js';

/** Idempotent payment_in row for admin financials / transaction history. */
export async function recordPaymentTransaction(
  bookingId: string,
  clientId: string | null | undefined,
  amount: number,
  transactionCode?: string | null
): Promise<void> {
  if (!clientId || !amount) return;

  const code = transactionCode || bookingId;
  const { data: existing } = await supabase
    .from('transactions')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('transaction_code', code)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from('transactions').insert({
    booking_id: bookingId,
    user_id: clientId,
    amount,
    type: 'payment_in',
    status: 'completed',
    transaction_code: code,
  });

  if (error) {
    logger.warn('[recordPaymentTransaction]', error);
  }
}
