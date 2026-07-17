import { supabase } from '../lib/supabase';
import { compressImage } from '../utils/imageCompression';

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read image file.'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('You must be signed in to upload inspection photos.');
  return token;
}

function buildFilePath(bookingId: string, subfolder: string, ext = 'jpg'): string {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `${bookingId}/${subfolder}/${rand}_${stamp}.${ext}`;
}

/**
 * Upload an inspection photo via the server API (service role bypasses storage RLS).
 * Falls back to direct Supabase storage upload when authenticated client policies exist.
 */
export async function uploadInspectionPhoto(
  bookingId: string,
  file: File,
  subfolder: 'photos' | 'fuel' | 'exterior' | 'interior' = 'photos'
): Promise<string> {
  const compressed = await compressImage(file, 1200, 1200, 0.7);
  const ext = compressed.name.split('.').pop() || 'jpg';
  const filePath = buildFilePath(bookingId, subfolder, ext);

  // Prefer server upload — reliable regardless of storage RLS on the client
  const token = await getAccessToken();
  const dataBase64 = await fileToBase64(compressed);

  const response = await fetch('/api/inspections/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      bookingId,
      filePath,
      contentType: compressed.type || 'image/jpeg',
      dataBase64,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (response.ok && payload?.publicUrl) {
    return payload.publicUrl as string;
  }

  const apiError = payload?.error || `Upload failed (${response.status})`;

  // Fallback: direct client upload when storage policies are configured
  const { error: directError } = await supabase.storage
    .from('booking_inspections')
    .upload(filePath, compressed, { contentType: compressed.type || 'image/jpeg' });

  if (!directError) {
    const { data } = supabase.storage.from('booking_inspections').getPublicUrl(filePath);
    return data.publicUrl;
  }

  throw new Error(apiError || directError.message);
}
