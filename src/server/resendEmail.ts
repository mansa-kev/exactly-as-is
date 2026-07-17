const FROM_EMAIL = 'LinkedUp Cars <noreply@office.linkedupcarsrentals.com>';

export interface SendEmailParams {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendViaResend(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY || '';
  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY is not configured on the server.' };
  }

  if (!params.to || !params.subject) {
    return { success: false, error: 'to and subject are required.' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [params.to],
        subject: params.subject,
        html: params.html || undefined,
        text: params.text || undefined,
        reply_to: params.replyTo || undefined,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: data?.message || data?.error || `Resend API error (${res.status})`,
      };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to send email' };
  }
}
