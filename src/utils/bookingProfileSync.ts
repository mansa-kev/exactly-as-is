/**
 * Copy booking guest info + document URLs into user_profiles (glovebox columns).
 * Only fills empty profile fields — never overwrites existing values.
 */

export const BOOKING_DOC_TO_PROFILE_COLUMN: Record<string, string> = {
  facePhotoUrl: 'face_photo_url',
  licenseFrontUrl: 'license_front_url',
  licenseBackUrl: 'license_back_url',
  idFrontUrl: 'id_front_url',
  idBackUrl: 'id_back_url',
};

type SupabaseClientLike = {
  from: (table: string) => any;
};

export function buildProfileSyncFromBooking(
  booking: any,
  bookingData?: Record<string, any>
): Record<string, string> {
  const guest = booking?.metadata?.guest_info || {};
  const docs = booking?.metadata?.documents || {};
  const updates: Record<string, string> = {};

  const set = (key: string, value: string | null | undefined) => {
    if (value && String(value).trim()) updates[key] = String(value).trim();
  };

  set('full_name', guest.full_name || bookingData?.fullName);
  set('phone_number', guest.phone || bookingData?.phone);
  set('license_number', guest.license_number || bookingData?.license);
  set('id_number', guest.id_number || bookingData?.idNumber);

  for (const [docKey, column] of Object.entries(BOOKING_DOC_TO_PROFILE_COLUMN)) {
    const url = docs[docKey] || bookingData?.[docKey];
    if (url) updates[column] = String(url);
  }

  return updates;
}

/** Resolve client id from booking.client_id or guest email on user_profiles. */
export async function resolveClientIdForBooking(
  supabase: SupabaseClientLike,
  booking: any
): Promise<string | null> {
  if (booking?.client_id) return booking.client_id;

  const email = booking?.metadata?.guest_info?.email?.trim().toLowerCase();
  if (!email) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  return data?.id || null;
}

/** Link guest booking to client when possible, then copy documents into profile. */
export async function linkBookingAndSyncProfile(
  supabase: SupabaseClientLike,
  booking: any,
  bookingData?: Record<string, any>
): Promise<{ clientId: string | null; synced: boolean }> {
  if (!booking?.id) return { clientId: null, synced: false };

  const clientId = await resolveClientIdForBooking(supabase, booking);
  if (!clientId) return { clientId: null, synced: false };

  if (!booking.client_id) {
    const { error: linkError } = await supabase
      .from('bookings')
      .update({ client_id: clientId })
      .eq('id', booking.id);
    if (linkError) throw linkError;
  }

  const synced = await applyProfileSyncFromBooking(supabase, clientId, booking, bookingData);
  return { clientId, synced };
}

export async function applyProfileSyncFromBooking(
  supabase: SupabaseClientLike,
  clientId: string,
  booking: any,
  bookingData?: Record<string, any>
): Promise<boolean> {
  if (!clientId || !booking) return false;

  const candidate = buildProfileSyncFromBooking(booking, bookingData);
  if (Object.keys(candidate).length === 0) return false;

  const { data: existing, error: readError } = await supabase
    .from('user_profiles')
    .select('full_name, phone_number, address, license_number, id_number, face_photo_url, license_front_url, license_back_url, id_front_url, id_back_url')
    .eq('id', clientId)
    .maybeSingle();

  if (readError) throw readError;

  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries(candidate)) {
    const current = existing?.[key];
    if (!current || String(current).trim() === '') {
      merged[key] = value;
    }
  }

  if (Object.keys(merged).length === 0) return false;

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update(merged)
    .eq('id', clientId);

  if (updateError) throw updateError;
  return true;
}
