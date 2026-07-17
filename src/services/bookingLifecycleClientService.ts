import { supabase } from '../lib/supabase';

export interface LifecycleInspectionPayload {
  fuel_level?: string;
  mileage?: number | null;
  location?: string;
  scratches_notes?: string;
  photos_exterior?: string[];
  photos_interior?: string[];
  photo_fuel_mileage?: string | null;
  gps_lat?: number | null;
  gps_lon?: number | null;
  client_signature_url?: string | null;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error('You must be signed in to complete this action.');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function submitBookingPickup(
  bookingId: string,
  payload: LifecycleInspectionPayload
) {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/bookings/${bookingId}/pickup`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.success) {
    throw new Error(body?.error || `Failed to log pickup (${response.status})`);
  }
  return body;
}

export async function submitBookingReturn(
  bookingId: string,
  payload: LifecycleInspectionPayload
) {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/bookings/${bookingId}/return`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.success) {
    throw new Error(body?.error || `Failed to log return (${response.status})`);
  }
  return body;
}
