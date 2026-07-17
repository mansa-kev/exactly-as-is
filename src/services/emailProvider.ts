/**
 * Email provider for LinkedUp Cars using Resend via Supabase Edge Function.
 *
 * Transactional emails (booking confirmations, etc.) are sent via the
 * `send-email` edge function which calls the Resend API.
 *
 * Auth emails (signup confirmation, password reset) are handled by
 * Supabase Auth's built-in SMTP integration configured in the dashboard.
 */

import { supabase } from '../lib/supabase';

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// HTML Email Templates
// ---------------------------------------------------------------------------

function wrapInHtml(title: string, bodyContent: string): string {
  const logoUrl = 'https://edroffvtzrowpsooszqh.supabase.co/storage/v1/object/public/public_assets/logo.png';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#0f172a;padding:32px 40px;text-align:center;">
      <h1 style="margin:0;color:#f59e0b;font-size:24px;font-weight:800;letter-spacing:-0.5px;font-style:italic;">LINKEDUP CARS</h1>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-weight:700;">${title}</h2>
      ${bodyContent}
    </div>
    <div style="background:#f8fafc;padding:32px 40px;text-align:center;border-top:1px solid #e2e8f0;">
      <div style="margin:0 0 16px;">
        <img src="${logoUrl}" alt="LinkedUp Cars Logo" style="width:120px;height:auto;max-width:100%;" />
      </div>
      <p style="margin:0;color:#94a3b8;font-size:12px;">LinkedUp Cars Rentals &bull; Nairobi, Kenya</p>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:11px;">This email was sent from noreply@office.linkedupcarsrentals.com</p>
    </div>
  </div>
</body>
</html>`;
}

export const EMAIL_TEMPLATES: Record<string, { subject: string; html: (data: Record<string, string>) => string; text: (data: Record<string, string>) => string }> = {
  booking_confirmation: {
    subject: 'Booking #{{booking_id}} Confirmed - LinkedUp Cars',
    html: (d) => wrapInHtml('Booking Confirmed!', `
      <p style="color:#334155;line-height:1.6;margin:0 0 16px;">Your booking has been confirmed. Here are the details:</p>
      <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:0 0 16px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Booking ID</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#0f172a;">#${d.booking_id}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Vehicle</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#0f172a;">${d.car_name}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Dates</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#0f172a;">${d.start_date} - ${d.end_date}</td></tr>
          <tr style="border-top:1px solid #e2e8f0;"><td style="padding:12px 0 0;color:#64748b;font-size:13px;font-weight:700;">Total</td><td style="padding:12px 0 0;text-align:right;font-weight:800;color:#f59e0b;font-size:18px;">KES ${d.total_amount}</td></tr>
        </table>
      </div>
      <p style="color:#334155;line-height:1.6;margin:0;">You will receive further details before your pickup date. Drive safe!</p>
    `),
    text: (d) => `Booking #${d.booking_id} Confirmed!\n\nCar: ${d.car_name}\nDates: ${d.start_date} - ${d.end_date}\nTotal: KES ${d.total_amount}\n\nYou will receive further details before your pickup date.\n\n- LinkedUp Cars Team`,
  },

  booking_approved: {
    subject: 'Booking #{{booking_id}} Approved - LinkedUp Cars',
    html: (d) => wrapInHtml('Booking Approved!', `
      <p style="color:#334155;line-height:1.6;margin:0 0 16px;">Great news! Your booking has been approved.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:0 0 16px;">
        <p style="margin:0 0 8px;font-weight:600;color:#166534;">Car: ${d.car_name}</p>
        <p style="margin:0 0 8px;color:#166534;">Pickup: ${d.pickup_location}</p>
        <p style="margin:0;color:#166534;">Dates: ${d.start_date} - ${d.end_date}</p>
      </div>
      <p style="color:#334155;line-height:1.6;margin:0;">See you soon!</p>
    `),
    text: (d) => `Booking #${d.booking_id} Approved!\n\nCar: ${d.car_name}\nPickup: ${d.pickup_location}\nDates: ${d.start_date} - ${d.end_date}\n\n- LinkedUp Cars Team`,
  },

  return_reminder: {
    subject: 'Return Reminder - Booking #{{booking_id}}',
    html: (d) => wrapInHtml('Return Reminder', `
      <p style="color:#334155;line-height:1.6;margin:0 0 16px;">Your booking <strong>#${d.booking_id}</strong> ends tomorrow (<strong>${d.end_date}</strong>).</p>
      <div style="background:#fffbeb;border:1px solid #fed7aa;border-radius:12px;padding:20px;margin:0 0 16px;">
        <p style="margin:0 0 8px;font-weight:600;color:#92400e;">Car: ${d.car_name}</p>
        <p style="margin:0;color:#92400e;">Please return on time to avoid late fees.</p>
      </div>
      <p style="color:#334155;line-height:1.6;margin:0;">Need more time? You can extend your booking from the app.</p>
    `),
    text: (d) => `Return Reminder\n\nBooking #${d.booking_id} ends tomorrow (${d.end_date}).\nCar: ${d.car_name}\n\nPlease return on time or extend via the app.\n\n- LinkedUp Cars Team`,
  },

  payment_receipt: {
    subject: 'Payment Receipt - Booking #{{booking_id}}',
    html: (d) => wrapInHtml('Payment Received', `
      <p style="color:#334155;line-height:1.6;margin:0 0 16px;">We have received your payment.</p>
      <div style="background:#f8fafc;border-radius:12px;padding:20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Amount</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#0f172a;">KES ${d.total_amount}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Method</td><td style="padding:8px 0;text-align:right;color:#0f172a;">${d.payment_method}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Booking</td><td style="padding:8px 0;text-align:right;color:#0f172a;">#${d.booking_id}</td></tr>
        </table>
      </div>
    `),
    text: (d) => `Payment of KES ${d.total_amount} received for booking #${d.booking_id}.\nMethod: ${d.payment_method}\n\nThank you!\n- LinkedUp Cars Team`,
  },

  welcome: {
    subject: 'Welcome to LinkedUp Cars!',
    html: (d) => wrapInHtml('Welcome!', `
      <p style="color:#334155;line-height:1.6;margin:0 0 16px;">Hi <strong>${d.name}</strong>, welcome to LinkedUp Cars!</p>
      <p style="color:#334155;line-height:1.6;margin:0 0 24px;">Browse our fleet, book a car, and hit the road in minutes. We're excited to have you on board.</p>
      <a href="https://www.linkedupcarsrentals.com/cars" style="display:inline-block;background:#f59e0b;color:#0f172a;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px;">Browse Fleet</a>
    `),
    text: (d) => `Hi ${d.name}, welcome to LinkedUp Cars!\n\nBrowse our fleet and book your first ride today.\n\n- LinkedUp Cars Team`,
  },

  welcome_after_confirmation: {
    subject: 'Email Confirmed - Welcome to LinkedUp Cars!',
    html: (d) => wrapInHtml('Welcome to LinkedUp Cars!', `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:0 0 24px;">
        <p style="margin:0;color:#166534;font-weight:600;font-size:14px;">✓ Your email has been confirmed</p>
      </div>
      <p style="color:#334155;line-height:1.6;margin:0 0 16px;">Hi <strong>${d.name}</strong>, your account is now active!</p>
      <p style="color:#334155;line-height:1.6;margin:0 0 24px;">You can now log in to your account and start booking cars. Browse our premium fleet and experience the best car rental service in Nairobi.</p>
      <a href="${d.login_url}" style="display:inline-block;background:#f59e0b;color:#0f172a;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px;">Login Now</a>
      <p style="color:#647488;line-height:1.6;margin:24px 0 0;font-size:13px;">Need help? Contact us at support@linkedupcarsrentals.com</p>
    `),
    text: (d) => `Hi ${d.name},\n\nYour email has been confirmed and your account is now active!\n\nYou can now log in to start booking cars.\n\nLogin at: ${d.login_url}\n\nNeed help? Contact us at support@linkedupcarsrentals.com\n\n- LinkedUp Cars Team`,
  },

  fleet_owner_welcome: {
    subject: 'Your LinkedUp Fleet Owner Account',
    html: (d) => wrapInHtml('Welcome, Fleet Owner!', `
      <p style="color:#334155;line-height:1.6;margin:0 0 16px;">Hi <strong>${d.name}</strong>, your fleet owner account has been created.</p>
      <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:0 0 16px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Email</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#0f172a;">${d.email}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Temporary Password</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#ef4444;">Fleet123!</td></tr>
        </table>
      </div>
      <p style="color:#dc2626;font-weight:600;margin:0 0 16px;">Please change your password immediately after your first login.</p>
      <a href="https://fleet.linkedupcarsrentals.com/login" style="display:inline-block;background:#f59e0b;color:#0f172a;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px;">Login Now</a>
    `),
    text: (d) => `Hi ${d.name},\n\nYour fleet owner account has been created.\nEmail: ${d.email}\nTemporary Password: Fleet123!\n\nPlease change your password immediately after first login.\n\nLogin at: https://fleet.linkedupcarsrentals.com/login\n\n- LinkedUp Cars Team`,
  },

  manual_payment_pending: {
    subject: 'Booking Received - Pending Payment - LinkedUp Cars',
    html: (d) => wrapInHtml('Payment Pending', `
      <p style="color:#334155;line-height:1.6;margin:0 0 16px;">We have received your alternative payment request for Booking <strong>#${d.booking_id}</strong>.</p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin:0 0 16px;">
        <p style="margin:0 0 8px;font-weight:600;color:#1e3a8a;">Car: ${d.car_name}</p>
        <p style="margin:0;color:#1e3a8a;">Amount Due: KES ${d.total_amount}</p>
      </div>
      <p style="color:#334155;line-height:1.6;margin:0 0 16px;">Our team is processing your request. If you close your browser, you can always track your booking status here:</p>
      <a href="${d.tracking_link}" style="display:inline-block;background:#f59e0b;color:#0f172a;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px;">Track Booking Status</a>
    `),
    text: (d) => `We received your payment request for Booking #${d.booking_id}.\nCar: ${d.car_name}\nAmount: KES ${d.total_amount}\n\nTrack your booking here: ${d.tracking_link}\n\n- LinkedUp Cars Team`,
  },
};

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

function formatSubject(subject: string, data: Record<string, string>): string {
  return subject.replace(/\{\{(\w+)\}\}/g, (_m, key) => data[key] ?? '');
}

// ---------------------------------------------------------------------------
// Core send function via Supabase Edge Function → Resend
// ---------------------------------------------------------------------------

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<EmailResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { to, subject, html, text },
    });

    if (error) {
      console.error('[emailProvider] Edge function error:', error.message);
      // Fallback: queue in notification_queue for retry
      await queueFallback(to, subject, html, text);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[emailProvider] Failed to send email:', err.message);
    await queueFallback(to, subject, html, text);
    return { success: false, error: err.message };
  }
}

async function queueFallback(to: string, subject: string, html: string, text?: string) {
  await supabase.from('notification_queue').insert({
    channel: 'email',
    recipient: to,
    content: JSON.stringify({ subject, html, text }),
    status: 'queued',
    attempts: 0,
    created_at: new Date().toISOString(),
  }).then(({ error }) => {
    if (error) console.error('[emailProvider] Fallback queue failed:', error.message);
  });
}

// ---------------------------------------------------------------------------
// Send a templated email
// ---------------------------------------------------------------------------

export async function sendTemplatedEmail(
  to: string,
  templateKey: string,
  data: Record<string, string>,
): Promise<EmailResult> {
  const template = EMAIL_TEMPLATES[templateKey];
  if (!template) {
    return { success: false, error: `Unknown email template: ${templateKey}` };
  }

  const subject = formatSubject(template.subject, data);
  const html = template.html(data);
  const text = template.text(data);
  return sendEmail(to, subject, html, text);
}
