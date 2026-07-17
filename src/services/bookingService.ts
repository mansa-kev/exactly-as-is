import { supabase, handleSupabaseErrorWrapper as handleSupabaseError } from '../lib/supabase';
import { BOOKING_WITH_VEHICLE_SELECT } from '../utils/bookingVehicleDisplay';

const DEFAULT_COMMISSION_RATE = 0.15; // 15% platform commission

export const bookingService = {
  createBooking: async (bookingData: any) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          ...bookingData,
          platformCommission: Math.round(Number(bookingData.totalAmount || 0) * DEFAULT_COMMISSION_RATE * 100) / 100,
        }),
      });

      const rawResponse = await response.text();
      let result: any = null;
      try {
        result = rawResponse ? JSON.parse(rawResponse) : null;
      } catch {
        const snippet = rawResponse?.slice(0, 180).trim() || 'Empty server response';
        throw new Error(
          response.ok
            ? `Invalid server response while creating booking: ${snippet}`
            : snippet.startsWith('{')
              ? snippet
              : `Booking request failed (${response.status}): ${snippet}`
        );
      }

      if (!response.ok || result?.error || !result?.booking) {
        throw new Error(result?.error || rawResponse || 'Failed to create booking');
      }

      return result.booking;
    } catch (error) {
      return handleSupabaseError(error, 'createBooking');
    }
  },

  getBookingById: async (id: string) => {
    const { data, error } = await supabase
      .from('bookings')
      .select(BOOKING_WITH_VEHICLE_SELECT)
      .eq('id', id)
      .single();
    if (error) return handleSupabaseError(error, 'getBookingById');
    return data;
  },

  uploadDocument: async (file: File, type: string, carOrBookingId: string) => {
    const { uploadBookingDocument } = await import('./bookingDocumentUploadService');
    return uploadBookingDocument(carOrBookingId, type as any, file);
  }
};
