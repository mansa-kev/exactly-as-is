import type { Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { invalidateCachePrefix } from '../utils/queryCache.js';

const MAX_PDF_BYTES = 12 * 1024 * 1024;

function getAccessToken(req: Request): string | null {
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader?.startsWith('Bearer ')) return null;
  return authorizationHeader.slice(7);
}

async function canSaveContract(
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
    .select('client_id, fleet_owner_id, driver_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) return false;
  if (booking.client_id === userId) return true;
  if (booking.fleet_owner_id === userId) return true;
  if (booking.driver_id === userId) return true;
  return false;
}

async function guestTokenAllowsSave(
  supabase: SupabaseClient,
  bookingId: string,
  statusToken?: string | null
): Promise<boolean> {
  if (!statusToken) return false;
  const { data: booking } = await supabase
    .from('bookings')
    .select('metadata')
    .eq('id', bookingId)
    .maybeSingle();
  return booking?.metadata?.client_status_token === statusToken;
}

export function createContractSaveHandler(supabase: SupabaseClient, requireServiceRole = true) {
  return async (req: Request, res: Response) => {
    const accessToken = getAccessToken(req);

    try {
      const {
        bookingId,
        signatureData,
        contractData,
        contractPdfBase64,
        statusToken,
        regenerate,
      } = req.body || {};

      if (!bookingId || !contractPdfBase64) {
        return res.status(400).json({
          success: false,
          error: 'bookingId and contractPdfBase64 are required.',
        });
      }

      let authorized = false;

      if (accessToken) {
        const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
        if (authError || !authData.user) {
          return res.status(401).json({ success: false, error: 'Unauthorized session.' });
        }
        authorized = await canSaveContract(supabase, authData.user.id, String(bookingId));
      } else {
        authorized = await guestTokenAllowsSave(supabase, String(bookingId), statusToken);
      }

      if (!authorized) {
        return res.status(403).json({
          success: false,
          error: 'You are not allowed to save a contract for this booking.',
        });
      }

      if (requireServiceRole) {
        const serviceKey =
          process.env.SB_SERVICE_ROLE_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
          '';

        if (!serviceKey) {
          return res.status(500).json({
            success: false,
            error: 'Server misconfiguration: service role key required for contract save.',
          });
        }
      }

      const { data: existing } = await supabase
        .from('e_contracts')
        .select('*')
        .eq('booking_id', bookingId)
        .order('signed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.pdf_url && !regenerate) {
        return res.json({
          success: true,
          contract: existing,
          publicUrl: existing.pdf_url,
        });
      }

      const base64Data = String(contractPdfBase64).split(',')[1] || String(contractPdfBase64);
      const pdfBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      if (!pdfBytes.length) {
        return res.status(400).json({ success: false, error: 'Empty PDF payload.' });
      }
      if (pdfBytes.length > MAX_PDF_BYTES) {
        return res.status(413).json({ success: false, error: 'Contract PDF is too large.' });
      }

      const fileName = `signed-contract-${bookingId}-${Date.now()}.pdf`;
      const filePath = `e_contracts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public_assets')
        .upload(filePath, pdfBytes, { contentType: 'application/pdf' });

      if (uploadError) {
        return res.status(500).json({ success: false, error: uploadError.message });
      }

      const publicUrl = `/api/assets/public_assets/${filePath}`;

      let contractRow;
      let insertError;

      if (existing) {
        const { data: updatedRow, error: updateError } = await supabase
          .from('e_contracts')
          .update({ pdf_url: publicUrl, signed_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();
        contractRow = updatedRow;
        insertError = updateError;
      } else {
        const { data: insertedRow, error: insertErr } = await supabase
          .from('e_contracts')
          .insert([{ booking_id: bookingId, pdf_url: publicUrl }])
          .select()
          .single();
        contractRow = insertedRow;
        insertError = insertErr;
      }

      if (insertError) {
        return res.status(500).json({ success: false, error: insertError.message });
      }

      const { data: bookingRow } = await supabase
        .from('bookings')
        .select('client_id, metadata')
        .eq('id', bookingId)
        .maybeSingle();

      await supabase
        .from('bookings')
        .update({
          metadata: {
            ...(bookingRow?.metadata || {}),
            contract_url: publicUrl,
            signature_data: signatureData || null,
            signature_url: signatureData || bookingRow?.metadata?.signature_url || null,
            contract_client_data: contractData || null,
          },
        })
        .eq('id', bookingId);

      const clientId = bookingRow?.client_id;
      if (clientId) {
        invalidateCachePrefix(`client:dashboard:${clientId}`);
        invalidateCachePrefix(`client:glovebox:${clientId}`);
        invalidateCachePrefix(`client:bookings:${clientId}`);
      }

      return res.json({
        success: true,
        contract: contractRow,
        publicUrl,
      });
    } catch (err: any) {
      console.error('[contract-save]', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to save signed contract.',
      });
    }
  };
}
