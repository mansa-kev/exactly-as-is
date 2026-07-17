interface ReservationStkPushParams {
  phone: string;
  reservationId: string;
}

interface ReservationStkPushResult {
  success: boolean;
  paymentRequestId?: string;
  transactionId?: string;
  referenceId?: string;
  statusCode?: string;
  statusDescription?: string;
  error?: string;
}

interface ReservationPaymentStatusResult {
  success: boolean;
  reservationId: string;
  status: string;
  paymentStatus: string;
  paid: boolean;
  reserved: boolean;
  linkedBookingId?: string | null;
  reservationToken?: string | null;
  paymentRequest?: any;
}

interface ReservationStkQueryResult {
  success: boolean;
  paid: boolean;
  failed: boolean;
  pending?: boolean;
  status?: string;
  description?: string;
  error?: string;
}

export const reservationPaymentService = {
  async initiateSTKPush(params: ReservationStkPushParams): Promise<ReservationStkPushResult> {
    try {
      const response = await fetch('/api/ncba/reservations/stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('[reservationPaymentService] STK Push error:', error);
      return { success: false, error: error.message || 'Network error' };
    }
  },

  async querySTKStatus(paymentRequestId: string): Promise<ReservationStkQueryResult> {
    try {
      const response = await fetch('/api/ncba/reservations/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentRequestId }),
      });
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('[reservationPaymentService] STK Query error:', error);
      return { success: false, paid: false, failed: false, error: error.message || 'Network error' };
    }
  },

  async getPaymentStatus(reservationId: string): Promise<ReservationPaymentStatusResult> {
    try {
      const response = await fetch(`/api/ncba/reservations/payment-status/${reservationId}`);
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('[reservationPaymentService] Status poll error:', error);
      return { success: false, reservationId, status: '', paymentStatus: '', paid: false, reserved: false };
    }
  },

  async pollUntilPaid(
    paymentRequestId: string,
    reservationId: string,
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

        const status = await this.getPaymentStatus(reservationId);
        if (status.paid && status.reserved) {
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
