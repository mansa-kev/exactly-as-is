import { logger } from '../utils/logger.js';
/** NCBA returns status FAILED for query errors — not always a declined payment. */
const RETRYABLE_QUERY_PHRASES = [
    'error occurred while processing query',
    'system internal error',
    'still processing',
    'pending',
    'not found',
    'try again',
];
const DEFINITIVE_FAILURE_PHRASES = [
    'cancel',
    'declined',
    'rejected',
    'insufficient',
    'invalid pin',
    'wrong pin',
    'no response from user',
    'user failed',
];
function classifyNcbaQueryResult(data, httpOk) {
    const status = String(data?.status ?? data?.Status ?? '').trim();
    const normalized = status.toUpperCase();
    const description = String(data?.description ?? data?.Description ?? data?.message ?? '').trim();
    const descLower = description.toLowerCase();
    if (normalized === 'SUCCESS') {
        return { paid: true, failed: false, pending: false, status, description };
    }
    if (!httpOk || !normalized) {
        return {
            paid: false,
            failed: false,
            pending: true,
            status: status || 'PENDING',
            description: description || 'Awaiting NCBA response',
        };
    }
    if (normalized === 'FAILED') {
        const isRetryable = RETRYABLE_QUERY_PHRASES.some((phrase) => descLower.includes(phrase));
        if (isRetryable) {
            return { paid: false, failed: false, pending: true, status, description };
        }
        const isDefinitiveFailure = DEFINITIVE_FAILURE_PHRASES.some((phrase) => descLower.includes(phrase));
        if (isDefinitiveFailure) {
            return { paid: false, failed: true, pending: false, status, description };
        }
        // Unknown FAILED — prefer retry over wrongly marking the payment failed.
        return { paid: false, failed: false, pending: true, status, description };
    }
    return {
        paid: false,
        failed: false,
        pending: true,
        status: status || 'PENDING',
        description: description || 'Payment still pending',
    };
}
let cachedToken = null;
const NCBA_DEFAULT_ACCOUNT_NO = '1006230208';
function getConfig() {
    return {
        baseUrl: process.env.NCBA_BASE_URL || 'https://c2bapis.ncbagroup.com',
        username: process.env.NCBA_USERNAME || '',
        password: process.env.NCBA_PASSWORD || '',
        paybillNo: process.env.NCBA_PAYBILL_NO || '',
        accountNo: process.env.NCBA_ACCOUNT_NO || NCBA_DEFAULT_ACCOUNT_NO,
        network: process.env.NCBA_NETWORK || 'Safaricom',
        transactionType: process.env.NCBA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
        tokenMethod: ((process.env.NCBA_TOKEN_METHOD || 'GET').toUpperCase() === 'POST' ? 'POST' : 'GET'),
    };
}
function formatPhone(phone) {
    let cleaned = phone.replace(/[\s\-+]/g, '');
    if (cleaned.startsWith('0'))
        cleaned = `254${cleaned.slice(1)}`;
    else if (!cleaned.startsWith('254'))
        cleaned = `254${cleaned}`;
    return cleaned;
}
async function readJsonSafe(response) {
    const text = await response.text();
    try {
        return text ? JSON.parse(text) : {};
    }
    catch {
        return { rawText: text };
    }
}
export const ncbaService = {
    formatPhone,
    getPublicConfig() {
        const config = getConfig();
        return {
            paybillNo: config.paybillNo,
            accountNo: config.accountNo,
            network: config.network,
            transactionType: config.transactionType,
        };
    },
    async getAccessToken() {
        if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
            return cachedToken.token;
        }
        const config = getConfig();
        if (!config.username || !config.password) {
            throw new Error('NCBA credentials not configured. Set NCBA_USERNAME and NCBA_PASSWORD.');
        }
        const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
        const response = await fetch(`${config.baseUrl}/payments/api/v1/auth/token`, {
            method: config.tokenMethod,
            headers: {
                Authorization: `Basic ${auth}`,
                Accept: 'application/json',
            },
            signal: AbortSignal.timeout(10000),
        });
        const data = await readJsonSafe(response);
        if (!response.ok || !data.access_token) {
            throw new Error(`NCBA token request failed (${response.status}): ${data.message || data.rawText || 'Unknown error'}`);
        }
        cachedToken = {
            token: data.access_token,
            expiresAt: Date.now() + (Number(data.expires_in || 18000) * 1000),
        };
        return data.access_token;
    },
    async initiateSTKPush(request) {
        try {
            const config = getConfig();
            if (!config.paybillNo)
                throw new Error('NCBA_PAYBILL_NO is not configured.');
            if (!config.accountNo && !request.accountNo)
                throw new Error('NCBA_ACCOUNT_NO is not configured.');
            const token = await this.getAccessToken();
            const payload = {
                TelephoneNo: formatPhone(request.phone),
                Amount: String(Math.ceil(Number(request.amount))),
                PayBillNo: config.paybillNo,
                AccountNo: request.accountNo || config.accountNo,
                Network: config.network,
                TransactionType: config.transactionType,
            };
            logger.log('[NCBA] Initiating STK Push', { phone: payload.TelephoneNo, amount: payload.Amount, accountNo: payload.AccountNo });
            const response = await fetch(`${config.baseUrl}/payments/api/v1/stk-push/initiate`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(10000),
            });
            const data = await readJsonSafe(response);
            const statusCode = String(data.StatusCode ?? '');
            const success = response.ok && statusCode === '0' && Boolean(data.TransactionID);
            return {
                success,
                transactionId: data.TransactionID || undefined,
                referenceId: data.ReferenceID || undefined,
                statusCode,
                statusDescription: data.StatusDescription || data.message || undefined,
                raw: data,
                error: success ? undefined : (data.StatusDescription || data.message || `NCBA STK request failed (${response.status})`),
            };
        }
        catch (error) {
            logger.error('[NCBA] STK Push error:', error);
            return { success: false, error: error.message || 'Failed to initiate NCBA STK Push' };
        }
    },
    async querySTKPush(transactionId) {
        try {
            const config = getConfig();
            const token = await this.getAccessToken();
            const response = await fetch(`${config.baseUrl}/payments/api/v1/stk-push/query`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({ TransactionID: transactionId }),
                signal: AbortSignal.timeout(10000),
            });
            const data = await readJsonSafe(response);
            const classified = classifyNcbaQueryResult(data, response.ok);
            if (classified.pending && !classified.paid) {
                logger.log('[NCBA] Query still pending', { transactionId, description: classified.description });
            }
            return {
                success: response.ok,
                ...classified,
                raw: data,
                error: response.ok ? undefined : (data.message || classified.description || `NCBA query failed (${response.status})`),
            };
        }
        catch (error) {
            logger.error('[NCBA] Query error:', error);
            return {
                success: false,
                paid: false,
                failed: false,
                pending: true,
                error: error.message || 'Failed to query NCBA payment status',
            };
        }
    },
};
