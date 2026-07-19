interface ExtStkResult {
  success: boolean;
  paymentRequestId?: string;
  transactionId?: string;
  referenceId?: string;
  statusCode?: string;
  statusDescription?: string;
  error?: string;
}

interface ExtQueryResult {
  success: boolean;
  paid: boolean;
  failed: boolean;
  pending?: boolean;
  status?: string;
  description?: string;
  error?: string;
}

interface ExtStatusResult {
  success: boolean;
  extensionId: string;
  status: string;
  paymentStatus: string;
  paid: boolean;
  applied: boolean;
  paymentRequest?: any;
}

async function authHeader(): Promise<Record<string, string>> {
  try {
    const { supabase } = await import('../lib/supabase');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

export const extensionPaymentService = {
  async initiateSTKPush(params: { phone: string; extensionId: string }): Promise<ExtStkResult> {
    try {
      const res = await fetch('/api/ncba/extensions/stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error' };
    }
  },

  async querySTKStatus(paymentRequestId: string): Promise<ExtQueryResult> {
    try {
      const res = await fetch('/api/ncba/extensions/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentRequestId }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, paid: false, failed: false, error: e?.message || 'Network error' };
    }
  },

  async getStatus(extensionId: string): Promise<ExtStatusResult> {
    try {
      const res = await fetch(`/api/ncba/extensions/payment-status/${extensionId}`);
      return await res.json();
    } catch (e: any) {
      return { success: false, extensionId, status: '', paymentStatus: '', paid: false, applied: false };
    }
  },

  async markPaidCash(params: { bookingId: string; extensionId: string; reference?: string; method?: 'cash' | 'waived' }): Promise<{ success: boolean; error?: string }> {
    try {
      const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
      const res = await fetch(`/api/bookings/${params.bookingId}/extensions/${params.extensionId}/mark-paid-cash`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reference: params.reference, method: params.method || 'cash' }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error' };
    }
  },

  async pollUntilPaid(paymentRequestId: string, extensionId: string, intervalMs = 3000, timeoutMs = 180000): Promise<'paid' | 'failed' | 'timeout'> {
    const start = Date.now();
    return new Promise((resolve) => {
      const check = async () => {
        if (Date.now() - start > timeoutMs) return resolve('timeout');
        const status = await this.getStatus(extensionId);
        if (status.paid) return resolve('paid');
        if (paymentRequestId) {
          const q = await this.querySTKStatus(paymentRequestId);
          if (q.paid) return resolve('paid');
          if (q.failed && !q.pending) return resolve('failed');
        }
        setTimeout(check, intervalMs);
      };
      check();
    });
  },
};
