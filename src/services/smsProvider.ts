/**
 * SMS provider abstraction for LinkedUp Cars.
 *
 * This module wraps an external SMS gateway (Africa's Talking, Twilio, etc.)
 * behind a simple interface so the rest of the codebase never couples to a
 * specific vendor.
 *
 * To activate real delivery, set the VITE_SMS_PROVIDER and its credentials
 * in your .env file:
 *
 *   VITE_SMS_PROVIDER=africastalking          # or "twilio"
 *   VITE_AT_API_KEY=your_key_here
 *   VITE_AT_USERNAME=your_username
 *   VITE_AT_SENDER_ID=LinkedUpCars
 *
 *   # -- or for Twilio --
 *   VITE_TWILIO_ACCOUNT_SID=...
 *   VITE_TWILIO_AUTH_TOKEN=...
 *   VITE_TWILIO_FROM_NUMBER=...
 */

import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

/**
 * SMS templates use {{placeholder}} syntax. Call `formatTemplate` to
 * interpolate real values before sending.
 */
export const SMS_TEMPLATES: Record<string, string> = {
  booking_confirmation: [
    'LinkedUp Cars: Booking #{{booking_id}} confirmed!',
    'Car: {{car_name}}',
    'Dates: {{start_date}} - {{end_date}}',
    'Total: KES {{total_amount}}',
    'View details in the app.',
  ].join('\n'),

  booking_approved: [
    'LinkedUp Cars: Your booking #{{booking_id}} has been approved!',
    'Car: {{car_name}}',
    'Pickup: {{pickup_location}}',
    'Dates: {{start_date}} - {{end_date}}',
    'See you soon!',
  ].join('\n'),

  return_reminder: [
    'LinkedUp Cars: Reminder - your booking #{{booking_id}} ends on {{end_date}}.',
    'Car: {{car_name}}',
    'Please return on time or extend via the app.',
  ].join('\n'),

  extension_prompt: [
    'LinkedUp Cars: Your booking #{{booking_id}} ends very soon ({{end_date}}).',
    'Car: {{car_name}}',
    'Extend now in the app to keep driving!',
  ].join('\n'),

  payment_receipt: [
    'LinkedUp Cars: Payment of KES {{total_amount}} received for booking #{{booking_id}}.',
    'Method: {{payment_method}}',
    'Thank you!',
  ].join('\n'),

  welcome: [
    'Welcome to LinkedUp Cars, {{name}}!',
    'Browse our fleet and book your first ride today.',
  ].join('\n'),

  marketing: [
    'LinkedUp Cars: {{offer_title}}',
    '{{offer_body}}',
    '{{offer_code}}',
  ].join('\n'),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Replace every `{{key}}` in `template` with the corresponding value from
 * `data`. Unmatched placeholders are removed to keep messages clean.
 */
export function formatTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return data[key] !== undefined ? data[key] : '';
  }).replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

/**
 * Send an SMS to the given phone number.
 *
 * Currently the provider is NOT configured, so the message is logged and a
 * "queued" status is returned.  Once an API key is set the implementation
 * below can be swapped to hit the real endpoint.
 */
export async function sendSMS(
  phoneNumber: string,
  message: string,
): Promise<SMSResult> {
  // -------------------------------------------------------------------------
  // TODO: Configure your SMS provider here.
  //
  // Africa's Talking example:
  //   const at = AfricasTalking({ apiKey: SMS_API_KEY, username: SMS_USERNAME });
  //   const result = await at.SMS.send({ to: [phoneNumber], message, from: SENDER_ID });
  //
  // Twilio example:
  //   const client = twilio(TWILIO_SID, TWILIO_TOKEN);
  //   const result = await client.messages.create({ body: message, to: phoneNumber, from: TWILIO_FROM });
  // -------------------------------------------------------------------------

  // Log the outbound SMS for debugging / audit purposes.
  const { error } = await supabase.from('notification_queue').insert({
    channel: 'sms',
    recipient: phoneNumber,
    content: message,
    status: 'queued',
    attempts: 0,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('[smsProvider] Failed to queue SMS:', error.message);
    return { success: false, error: error.message };
  }

  console.info(
    `[smsProvider] SMS queued for ${phoneNumber} (provider not yet configured)`,
  );

  return {
    success: true,
    messageId: `sms_queued_${Date.now()}`,
  };
}

// ---------------------------------------------------------------------------
// Convenience: send a templated SMS
// ---------------------------------------------------------------------------

/**
 * Look up a template by key, interpolate the data, and send via `sendSMS`.
 */
export async function sendTemplatedSMS(
  phoneNumber: string,
  templateKey: string,
  data: Record<string, string>,
): Promise<SMSResult> {
  const template = SMS_TEMPLATES[templateKey];

  if (!template) {
    return { success: false, error: `Unknown SMS template: ${templateKey}` };
  }

  const message = formatTemplate(template, data);
  return sendSMS(phoneNumber, message);
}
