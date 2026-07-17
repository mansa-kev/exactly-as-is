/**
 * M-Pesa Daraja API Service (Server-side)
 *
 * Handles:
 * - OAuth token generation
 * - STK Push initiation (Lipa Na M-Pesa Online)
 * - STK Push status query
 * - Callback processing
 */

import { logger } from '../utils/logger';

const DARAJA_URLS = {
  sandbox: {
    oauth: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    stkPush: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    stkQuery: 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
  },
  production: {
    oauth: 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    stkPush: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    stkQuery: 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query',
  },
};

interface MpesaConfig {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  callbackUrl: string;
  env: 'sandbox' | 'production';
}

interface StkPushRequest {
  phone: string;
  amount: number;
  bookingId: string;
  accountReference?: string;
}

interface StkPushResponse {
  success: boolean;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  responseDescription?: string;
  error?: string;
}

interface StkQueryResponse {
  success: boolean;
  resultCode?: string;
  resultDesc?: string;
  paid?: boolean;
  mpesaReceiptNumber?: string;
  error?: string;
}

interface CallbackResult {
  success: boolean;
  resultCode: number;
  resultDesc: string;
  checkoutRequestId: string;
  merchantRequestId: string;
  mpesaReceiptNumber?: string;
  amount?: number;
  phone?: string;
  transactionDate?: string;
}

// Cache for OAuth token
let cachedToken: { token: string; expiresAt: number } | null = null;

function getConfig(): MpesaConfig {
  return {
    consumerKey: process.env.MPESA_CONSUMER_KEY || '',
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
    passkey: process.env.MPESA_PASSKEY || '',
    shortcode: process.env.MPESA_SHORTCODE || '174379',
    callbackUrl: process.env.MPESA_CALLBACK_URL || '',
    env: (process.env.MPESA_ENV as 'sandbox' | 'production') || 'sandbox',
  };
}

function getUrls() {
  const config = getConfig();
  return DARAJA_URLS[config.env];
}

/**
 * Format phone number to 254XXXXXXXXX format required by Daraja
 */
function formatPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\+]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  } else if (cleaned.startsWith('+254')) {
    cleaned = cleaned.substring(1);
  } else if (!cleaned.startsWith('254')) {
    cleaned = '254' + cleaned;
  }
  return cleaned;
}

/**
 * Generate a timestamp in the format YYYYMMDDHHmmss
 */
function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Generate the password for STK Push (Base64 of Shortcode + Passkey + Timestamp)
 */
function generatePassword(timestamp: string): string {
  const config = getConfig();
  const raw = config.shortcode + config.passkey + timestamp;
  return Buffer.from(raw).toString('base64');
}

export const mpesaService = {
  /**
   * Get OAuth access token from Daraja API.
   * Caches the token until it expires.
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
      return cachedToken.token;
    }

    const config = getConfig();
    const urls = getUrls();

    if (!config.consumerKey || !config.consumerSecret) {
      throw new Error('M-Pesa credentials not configured. Set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET.');
    }

    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');

    const response = await fetch(urls.oauth, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Daraja OAuth failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (parseInt(data.expires_in, 10) * 1000),
    };

    return data.access_token;
  },

  /**
   * Initiate an STK Push (Lipa Na M-Pesa Online) to the customer's phone.
   */
  async initiateSTKPush(request: StkPushRequest): Promise<StkPushResponse> {
    try {
      const token = await this.getAccessToken();
      const config = getConfig();
      const urls = getUrls();
      const timestamp = generateTimestamp();
      const password = generatePassword(timestamp);

      const payload = {
        BusinessShortCode: config.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.ceil(request.amount),
        PartyA: formatPhone(request.phone),
        PartyB: config.shortcode,
        PhoneNumber: formatPhone(request.phone),
        CallBackURL: config.callbackUrl,
        AccountReference: request.accountReference || `LINKEDUP_${request.bookingId.split('-')[0].toUpperCase()}`,
        TransactionDesc: `LinkedUp Car Rental - Booking ${request.bookingId.split('-')[0]}`,
      };

      logger.log('[M-Pesa] Initiating STK Push for', formatPhone(request.phone), 'Amount:', request.amount);

      const response = await fetch(urls.stkPush, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.ResponseCode === '0') {
        logger.log('[M-Pesa] STK Push sent successfully. CheckoutRequestID:', data.CheckoutRequestID);
        return {
          success: true,
          checkoutRequestId: data.CheckoutRequestID,
          merchantRequestId: data.MerchantRequestID,
          responseDescription: data.ResponseDescription,
        };
      } else {
        logger.error('[M-Pesa] STK Push failed:', data);
        return {
          success: false,
          error: data.errorMessage || data.ResponseDescription || 'STK Push request failed',
        };
      }
    } catch (error: any) {
      logger.error('[M-Pesa] STK Push error:', error);
      return {
        success: false,
        error: error.message || 'Failed to initiate M-Pesa payment',
      };
    }
  },

  /**
   * Query the status of an STK Push transaction.
   */
  async querySTKPushStatus(checkoutRequestId: string): Promise<StkQueryResponse> {
    try {
      const token = await this.getAccessToken();
      const config = getConfig();
      const urls = getUrls();
      const timestamp = generateTimestamp();
      const password = generatePassword(timestamp);

      const payload = {
        BusinessShortCode: config.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      };

      const response = await fetch(urls.stkQuery, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      // ResultCode 0 = success, 1032 = cancelled by user, 1037 = timeout
      return {
        success: true,
        resultCode: data.ResultCode?.toString(),
        resultDesc: data.ResultDesc,
        paid: data.ResultCode === '0' || data.ResultCode === 0,
        mpesaReceiptNumber: data.ResultCode === '0' || data.ResultCode === 0
          ? undefined // Receipt comes from callback, not query
          : undefined,
      };
    } catch (error: any) {
      logger.error('[M-Pesa] Query error:', error);
      return {
        success: false,
        error: error.message || 'Failed to query payment status',
      };
    }
  },

  /**
   * Parse the callback payload from Safaricom.
   */
  parseCallback(body: any): CallbackResult {
    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) {
      throw new Error('Invalid callback payload: missing stkCallback');
    }

    const result: CallbackResult = {
      success: stkCallback.ResultCode === 0,
      resultCode: stkCallback.ResultCode,
      resultDesc: stkCallback.ResultDesc,
      checkoutRequestId: stkCallback.CheckoutRequestID,
      merchantRequestId: stkCallback.MerchantRequestID,
    };

    // Extract metadata items if payment was successful
    if (stkCallback.ResultCode === 0 && stkCallback.CallbackMetadata?.Item) {
      const items = stkCallback.CallbackMetadata.Item;
      for (const item of items) {
        switch (item.Name) {
          case 'MpesaReceiptNumber':
            result.mpesaReceiptNumber = item.Value;
            break;
          case 'Amount':
            result.amount = item.Value;
            break;
          case 'PhoneNumber':
            result.phone = String(item.Value);
            break;
          case 'TransactionDate':
            result.transactionDate = String(item.Value);
            break;
        }
      }
    }

    return result;
  },
};
