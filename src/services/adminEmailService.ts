import { supabase } from '../lib/supabase';

export interface AdminEmailPayload {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export async function sendAdminEmail(payload: AdminEmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    return { success: false, error: 'You must be signed in as admin to send email.' };
  }

  const response = await fetch('/api/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.success) {
    return { success: false, error: body?.error || `Email failed (${response.status})` };
  }

  return { success: true, messageId: body.messageId };
}
