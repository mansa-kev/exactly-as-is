interface StkPushParams {
  phone: string;
  bookingId: string;
  amount?: number;
}

interface StkPushResult {
  success: boolean;
  paymentRequestId?: string;
  transactionId?: string;
  referenceId?: string;
  statusCode?: string;
  statusDescription?: string;
  error?: string;
}

interface PaymentStatusResult {
  success: boolean;
  bookingId: string;
  status: string;
  paymentStatus: string;
  paid: boolean;
  confirmed: boolean;
  paymentRequest?: any;
}

interface StkQueryResult {
  success: boolean;
  paid: boolean;
  failed: boolean;
  pending?: boolean;
  status?: string;
  description?: string;
  error?: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { supabase } = await import('../lib/supabase');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export const paymentService = {
  async initiateSTKPush(params: StkPushParams): Promise<StkPushResult> {
    try {
      const response = await fetch('/api/ncba/stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('[paymentService] STK Push error:', error);
      return { success: false, error: error.message || 'Network error' };
    }
  },

  async querySTKStatus(paymentRequestId: string): Promise<StkQueryResult> {
    try {
      const response = await fetch('/api/ncba/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentRequestId }),
      });
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('[paymentService] STK Query error:', error);
      return { success: false, paid: false, failed: false, error: error.message || 'Network error' };
    }
  },

  async getPaymentStatus(bookingId: string, statusToken?: string): Promise<PaymentStatusResult> {
    try {
      const url = statusToken
        ? `/api/ncba/payment-status/${bookingId}?token=${encodeURIComponent(statusToken)}`
        : `/api/ncba/payment-status/${bookingId}`;
      const headers = await authHeaders();
      const response = await fetch(url, { headers });
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('[paymentService] Status poll error:', error);
      return { success: false, bookingId, status: '', paymentStatus: '', paid: false, confirmed: false };
    }
  },

  async pollUntilPaid(
    paymentRequestId: string,
    bookingId: string,
    statusToken?: string,
    intervalMs = 3000,
    timeoutMs = 180000,
    initialDelayMs = 3000,
  ): Promise<'paid' | 'failed' | 'timeout'> {
    const start = Date.now();
    return new Promise((resolve) => {
      const check = async () => {
        const elapsed = Date.now() - start;
        if (elapsed > timeoutMs) {
          resolve('timeout');
          return;
        }

        // Webhook/DB updates can confirm payment before NCBA query resolves.
        const status = await this.getPaymentStatus(bookingId, statusToken);
        if (status.paid) {
          resolve('paid');
          return;
        }

        if (paymentRequestId && elapsed >= initialDelayMs) {
          const query = await this.querySTKStatus(paymentRequestId);
          if (query.paid) {
            resolve('paid');
            return;
          }
          if (query.failed && !query.pending) {
            resolve('failed');
            return;
          }
        }

        setTimeout(check, intervalMs);
      };
      check();
    });
  },
};
