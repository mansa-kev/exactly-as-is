import { getTimeLeftMs } from './rentalDeadline';

/**
 * Extension cutoff: a booking can no longer be extended once fewer than
 * this many hours remain before the return deadline.
 */
export const EXTENSION_CUTOFF_HOURS = 6;
export const EXTENSION_CUTOFF_MS = EXTENSION_CUTOFF_HOURS * 60 * 60 * 1000;

export interface ExtensionEligibility {
  eligible: boolean;
  hoursLeft: number;
  reason?: string;
}

export function checkExtensionEligibility(
  booking: {
    start_date?: string | null;
    end_date?: string | null;
    pickup_confirmed_at?: string | null;
    return_confirmed_at?: string | null;
    status?: string | null;
  } | null | undefined,
  now: number = Date.now()
): ExtensionEligibility {
  if (!booking) {
    return { eligible: false, hoursLeft: 0, reason: 'Booking not found.' };
  }
  if (booking.return_confirmed_at || booking.status === 'completed') {
    return { eligible: false, hoursLeft: 0, reason: 'This booking has already been returned.' };
  }
  const msLeft = getTimeLeftMs(booking, now);
  const hoursLeft = msLeft / (60 * 60 * 1000);
  if (msLeft < EXTENSION_CUTOFF_MS) {
    return {
      eligible: false,
      hoursLeft,
      reason: msLeft <= 0
        ? 'The booking has already reached its return deadline. Extensions are no longer possible.'
        : `Extensions must be requested at least ${EXTENSION_CUTOFF_HOURS} hours before the return deadline (only ${hoursLeft.toFixed(1)}h left).`,
    };
  }
  return { eligible: true, hoursLeft };
}
