import { supabase } from '../lib/supabase';
import { invalidateCachePrefix } from '../utils/queryCache';

export interface ContractData {
  client_name: string;
  car_make: string;
  car_model: string;
  pickup_date: string;
  dropoff_date: string;
  total_amount: number;
  booking_id: string;
  client_email: string;
  client_phone: string;
  license_plate: string;
  daily_rate: number;
  security_deposit: number;
  po_box?: string;
  id_number?: string;
  color?: string;
}

export interface SignedContract {
  id: string;
  booking_id: string;
  contract_url: string;
  signed_at: string;
  signature_data?: string;
  agreement_status?: 'pending' | 'signed' | 'rejected';
  payment_hold_status?: 'pending' | 'authorized' | 'released';
  created_at: string;
}

function mapEContract(row: any, signatureData?: string): SignedContract {
  return {
    id: row.id,
    booking_id: row.booking_id,
    contract_url: row.pdf_url,
    signed_at: row.signed_at,
    signature_data: signatureData,
    agreement_status: 'signed',
    payment_hold_status: 'pending',
    created_at: row.created_at,
  };
}

export const enhancedContractService = {
  getMasterContract: async () => {
    try {
      const { data, error } = await supabase
        .from('contracts_master')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in getMasterContract:', error);
      return null;
    }
  },

  saveSignedContract: async (
    bookingId: string,
    signatureData: string,
    contractData: ContractData,
    contractPdfBase64?: string | null,
    statusToken?: string | null,
    regenerate = false
  ): Promise<SignedContract> => {
    try {
      if (!contractPdfBase64) {
        throw new Error('Final contract PDF is required');
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const response = await fetch('/api/contracts/save-signed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          bookingId,
          signatureData,
          contractData,
          contractPdfBase64,
          statusToken: statusToken || null,
          regenerate,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.contract) {
        return mapEContract(payload.contract, signatureData);
      }

      if (response.ok) {
        throw new Error('Contract save returned an unexpected response.');
      }

      const base64Data = contractPdfBase64.split(',')[1] || contractPdfBase64;
      const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      const fileName = `signed-contract-${bookingId}-${Date.now()}.pdf`;
      const filePath = `e_contracts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public_assets')
        .upload(filePath, pdfBytes, { contentType: 'application/pdf' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public_assets')
        .getPublicUrl(filePath);

      const { data, error } = await supabase
        .from('e_contracts')
        .insert([{
          booking_id: bookingId,
          pdf_url: publicUrl,
        }])
        .select()
        .single();

      if (error) throw error;

      const { data: bookingRow } = await supabase
        .from('bookings')
        .select('client_id, metadata')
        .eq('id', bookingId)
        .maybeSingle();

      await supabase
        .from('bookings')
        .update({
          contract_signed: true,
          metadata: {
            ...(bookingRow?.metadata || {}),
            contract_url: publicUrl,
            signature_data: signatureData,
            contract_client_data: contractData,
          },
        })
        .eq('id', bookingId);

      const clientId = bookingRow?.client_id;
      if (clientId) {
        invalidateCachePrefix(`client:dashboard:${clientId}`);
        invalidateCachePrefix(`client:glovebox:${clientId}`);
        invalidateCachePrefix(`client:bookings:${clientId}`);
      }

      return mapEContract(data, signatureData);
    } catch (error) {
      console.error('Error saving signed contract:', error);
      throw error;
    }
  },

  getSignedContracts: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('e_contracts')
        .select(`
          *,
          bookings!inner(
            *,
            cars!inner(*)
          )
        `)
        .eq('bookings.client_id', userId)
        .order('signed_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...mapEContract(row),
        bookings: row.bookings,
      }));
    } catch (error) {
      console.error('Error fetching signed contracts:', error);
      return [];
    }
  },

  updateContractStatus: async (
    _contractId: string,
    _status: 'pending' | 'signed' | 'rejected'
  ): Promise<void> => {
    // e_contracts table has no status column — contract presence implies signed.
  },

  triggerPaymentHold: async (_contractId: string): Promise<void> => {
    // Payment hold is not tracked on e_contracts.
  },

  releasePaymentHold: async (_contractId: string): Promise<void> => {
    // Payment hold is not tracked on e_contracts.
  },

  getContractByBooking: async (bookingId: string) => {
    try {
      const { data, error } = await supabase
        .from('e_contracts')
        .select('*')
        .eq('booking_id', bookingId)
        .order('signed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data ? mapEContract(data) : null;
    } catch (error) {
      console.error('Error fetching contract by booking:', error);
      return null;
    }
  }
};
