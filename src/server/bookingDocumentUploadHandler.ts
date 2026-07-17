import type { Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB after base64 decode

const ALLOWED_DOC_TYPES = new Set([
  'facePhoto',
  'licenseFront',
  'licenseBack',
  'idFront',
  'idBack',
]);

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 96);
}

function extensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'application/pdf') return 'pdf';
  return 'jpg';
}

function hasServiceRoleKey(): boolean {
  return Boolean(
    process.env.SB_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  );
}

export function createBookingDocumentUploadHandler(
  supabase: SupabaseClient,
  requireServiceRole = true
) {
  return async (req: Request, res: Response) => {
    try {
      if (requireServiceRole && !hasServiceRoleKey()) {
        return res.status(500).json({
          success: false,
          error:
            'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is required for booking document uploads. Run scripts/fix_booking_document_upload_storage.sql if the bucket policy is missing.',
        });
      }

      const { carId, docType, contentType, dataBase64, uploadId } = req.body || {};

      if (!carId || !docType || !dataBase64) {
        return res.status(400).json({
          success: false,
          error: 'carId, docType, and dataBase64 are required.',
        });
      }

      if (!ALLOWED_DOC_TYPES.has(String(docType))) {
        return res.status(400).json({ success: false, error: 'Invalid document type.' });
      }

      const buffer = Buffer.from(String(dataBase64), 'base64');
      if (!buffer.length) {
        return res.status(400).json({ success: false, error: 'Empty file payload.' });
      }
      if (buffer.length > MAX_UPLOAD_BYTES) {
        return res.status(413).json({ success: false, error: 'File too large. Please use a smaller file.' });
      }

      const mime =
        typeof contentType === 'string' && contentType.length > 0
          ? contentType
          : 'image/jpeg';

      const safeCarId = sanitizeId(String(carId));
      const safeUploadId = uploadId ? sanitizeId(String(uploadId)) : `${Date.now()}`;
      const ext = extensionForMime(mime);
      const filePath = `booking-docs/${safeCarId}_${docType}_${safeUploadId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('public_assets')
        .upload(filePath, buffer, { contentType: mime, upsert: true });

      if (uploadError) {
        return res.status(500).json({
          success: false,
          error: `${uploadError.message}. Ensure the public_assets bucket exists and run scripts/fix_booking_document_upload_storage.sql on production.`,
        });
      }

      const proxyUrl = `/api/assets/public_assets/${filePath}`;

      return res.json({
        success: true,
        publicUrl: proxyUrl,
        filePath,
      });
    } catch (err: any) {
      console.error('[booking-document-upload]', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to upload booking document.',
      });
    }
  };
}
