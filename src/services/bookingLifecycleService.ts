import { supabase } from '../lib/supabase';

export interface LifecycleInspectionFields {
  fuel_level?: string;
  mileage?: number | null;
  location?: string;
  scratches_notes?: string;
  photos_exterior?: string[];
  photos_interior?: string[];
  photo_fuel_mileage?: string | null;
}

export interface LifecyclePayload extends LifecycleInspectionFields {
  overtime_hours?: number | null;
  overtime_charge?: number | null;
}

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('You must be signed in to update booking lifecycle.');
  }
  return token;
}

async function postLifecycle(
  bookingId: string,
  action: 'pickup' | 'return',
  payload: LifecyclePayload
) {
  const token = await getAccessToken();
  const response = await fetch(`/api/bookings/${bookingId}/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.success) {
    throw new Error(body?.error || `Failed to log ${action} (${response.status})`);
  }

  return body;
}

export async function logBookingPickup(bookingId: string, payload: LifecycleInspectionFields) {
  return postLifecycle(bookingId, 'pickup', payload);
}

export async function logBookingReturn(bookingId: string, payload: LifecyclePayload) {
  return postLifecycle(bookingId, 'return', payload);
}
