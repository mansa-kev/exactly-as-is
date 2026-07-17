import { supabase } from '../lib/supabase';

export interface InspectionPayload {
  type: 'pre_handover' | 'post_return';
  fuel_level?: string;
  mileage?: number | null;
  location?: string;
  scratches_notes?: string;
  photos_exterior?: string[];
  photos_interior?: string[];
  photo_fuel_mileage?: string | null;
}

export async function insertBookingInspection(bookingId: string, payload: InspectionPayload) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error('You must be signed in to log inspections.');
  }

  const response = await fetch(`/api/bookings/${bookingId}/inspections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.success) {
    throw new Error(body?.error || `Failed to save inspection (${response.status})`);
  }

  return body.inspection;
}
