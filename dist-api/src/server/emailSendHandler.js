import { sendViaResend } from './resendEmail.js';
function getAccessToken(req) {
    const authorizationHeader = req.headers.authorization;
    if (!authorizationHeader?.startsWith('Bearer '))
        return null;
    return authorizationHeader.slice(7);
}
async function requireAdmin(supabase, accessToken) {
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData.user) {
        throw Object.assign(new Error('Unauthorized session.'), { status: 401 });
    }
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', authData.user.id)
        .maybeSingle();
    if (!profile || profile.role !== 'admin') {
        throw Object.assign(new Error('Only admins can send transactional emails.'), { status: 403 });
    }
    return authData.user;
}
export function createEmailSendHandler(supabase) {
    return async (req, res) => {
        const accessToken = getAccessToken(req);
        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'Authorization header is required.' });
        }
        try {
            await requireAdmin(supabase, accessToken);
            const { to, subject, html, text, replyTo } = req.body || {};
            const result = await sendViaResend({ to, subject, html, text, replyTo });
            if (!result.success) {
                return res.status(502).json({ success: false, error: result.error || 'Email send failed' });
            }
            return res.json({ success: true, messageId: result.messageId });
        }
        catch (err) {
            const status = err?.status || 500;
            return res.status(status).json({
                success: false,
                error: err?.message || 'Failed to send email',
            });
        }
    };
}
