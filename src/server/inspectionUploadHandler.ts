import type { Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB after base64 decode

function getAccessToken(req: Request): string | null {
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader?.startsWith('Bearer ')) return null;
  return authorizationHeader.slice(7);
}

async function canUploadInspection(
  supabase: SupabaseClient,
  userId: string,
  bookingId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.role === 'admin') return true;

  const { data: booking } = await supabase
    .from('bookings')
    .select('driver_id, fleet_owner_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) return false;
  if (booking.driver_id === userId) return true;
  if (booking.fleet_owner_id === userId) return true;
  return false;
}

function sanitizeFilePath(bookingId: string, requestedPath?: string): string {
  const safeBookingId = bookingId.replace(/[^a-zA-Z0-9-]/g, '');
  if (!requestedPath) {
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 10);
    return `${safeBookingId}/photos/${rand}_${stamp}.jpg`;
  }

  const normalized = requestedPath
    .replace(/\\/g, '/')
    .replace(/\.\./g, '')
    .replace(/^\/+/, '');

  if (!normalized.startsWith(`${safeBookingId}/`)) {
    throw new Error('Invalid file path for this booking.');
  }

  return normalized;
}

export function createInspectionUploadHandler(supabase: SupabaseClient, requireServiceRole = true) {
  return async (req: Request, res: Response) => {
    const accessToken = getAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({ success: false, error: 'Authorization header is required.' });
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !authData.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized session.' });
      }

      const { bookingId, filePath: requestedPath, contentType, dataBase64 } = req.body || {};

      if (!bookingId || !dataBase64) {
        return res.status(400).json({ success: false, error: 'bookingId and dataBase64 are required.' });
      }

      const allowed = await canUploadInspection(supabase, authData.user.id, bookingId);
      if (!allowed) {
        return res.status(403).json({ success: false, error: 'You are not allowed to upload inspection photos for this booking.' });
      }

      const buffer = Buffer.from(String(dataBase64), 'base64');
      if (!buffer.length) {
        return res.status(400).json({ success: false, error: 'Empty file payload.' });
      }
      if (buffer.length > MAX_UPLOAD_BYTES) {
        return res.status(413).json({ success: false, error: 'File too large. Please use a smaller image.' });
      }

      const filePath = sanitizeFilePath(String(bookingId), requestedPath ? String(requestedPath) : undefined);
      const mime = typeof contentType === 'string' && contentType.startsWith('image/')
        ? contentType
        : 'image/jpeg';

      if (requireServiceRole) {
        const serviceKey =
          process.env.SB_SERVICE_ROLE_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
          '';

        if (!serviceKey) {
          return res.status(500).json({
            success: false,
            error: 'Server misconfiguration: service role key required for inspection uploads.',
          });
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('booking_inspections')
        .upload(filePath, buffer, { contentType: mime, upsert: true });

      if (uploadError) {
        const fallbackPath = `booking-inspections/${filePath}`;
        const { error: fallbackError } = await supabase.storage
          .from('public_assets')
          .upload(fallbackPath, buffer, { contentType: mime, upsert: true });

        if (fallbackError) {
          return res.status(500).json({
            success: false,
            error: `${uploadError.message}. Fallback upload failed: ${fallbackError.message}. Run scripts/fix_booking_inspections_storage.sql on production.`,
          });
        }

        return res.json({
          success: true,
          publicUrl: `/api/assets/public_assets/${fallbackPath}`,
          filePath: fallbackPath,
        });
      }

      const { data: urlData } = supabase.storage
        .from('booking_inspections')
        .getPublicUrl(filePath);

      return res.json({
        success: true,
        publicUrl: `/api/assets/booking_inspections/${filePath}`,
        filePath,
      });
    } catch (err: any) {
      console.error('[inspection-upload]', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to upload inspection photo.',
      });
    }
  };
}
