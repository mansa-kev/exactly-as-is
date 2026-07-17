import { compressImage } from '../utils/imageCompression';
import { supabase } from '../lib/supabase';
import { validateFile } from '../utils/fileValidation';
import {
  clearPendingUpload,
  pendingUploadKey,
  savePendingUpload,
  type PendingUploadRecord,
} from '../utils/pendingUploadStore';

export type BookingDocType =
  | 'facePhoto'
  | 'licenseFront'
  | 'licenseBack'
  | 'idFront'
  | 'idBack';

/** Wait until the tab is visible (mobile file picker may background the page). */
export function waitUntilVisible(timeoutMs = 120_000): Promise<void> {
  if (typeof document === 'undefined' || document.visibilityState === 'visible') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const start = Date.now();
    const onChange = () => {
      if (document.visibilityState === 'visible') {
        document.removeEventListener('visibilitychange', onChange);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        document.removeEventListener('visibilitychange', onChange);
        resolve();
      }
    };
    document.addEventListener('visibilitychange', onChange);
  });
}

export async function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file.'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

/** Persist file immediately so a mobile reload does not lose the selection. */
export async function stashPendingFile(
  carId: string,
  docType: BookingDocType,
  file: File
): Promise<PendingUploadRecord> {
  const record: PendingUploadRecord = {
    key: pendingUploadKey(carId, docType),
    carId,
    docType,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    blob: file,
    createdAt: Date.now(),
  };
  await savePendingUpload(record);
  return record;
}

async function uploadBytes(
  carId: string,
  docType: BookingDocType,
  file: File | Blob,
  fileName: string
): Promise<string> {
  const uploadId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const dataBase64 = await fileToBase64(file);
  const contentType =
    file.type ||
    (fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

  const response = await fetch('/api/booking-documents/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      carId,
      docType,
      contentType,
      dataBase64,
      uploadId,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (response.ok && payload?.publicUrl) {
    return payload.publicUrl as string;
  }

  const apiError = payload?.error || `Upload failed (${response.status})`;

  // Fallback: direct client upload when API/service-role is unavailable but storage policy allows it.
  const safeCarId = carId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 96);
  const ext = fileName.toLowerCase().endsWith('.pdf')
    ? 'pdf'
    : (file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg');
  const fallbackPath = `booking-docs/${safeCarId}_${docType}_${uploadId}.${ext}`;

  const { error: directError } = await supabase.storage
    .from('public_assets')
    .upload(fallbackPath, file, {
      contentType: file.type || contentType || 'image/jpeg',
      upsert: true,
    });

  if (!directError) {
    await clearPendingUpload(carId, docType);
    return `/api/assets/public_assets/${fallbackPath}`;
  }

  throw new Error(apiError || directError.message);
}

/**
 * Upload a booking-flow document via the server API (service role, no client storage RLS).
 */
export async function uploadBookingDocument(
  carId: string,
  docType: BookingDocType,
  file: File,
  options?: { skipCompress?: boolean }
): Promise<string> {
  const validation = await validateFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error || 'File validation failed');
  }

  await waitUntilVisible();

  let finalFile: File | Blob = file;
  if (!options?.skipCompress && file.type.startsWith('image/')) {
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    finalFile = await compressImage(file, 1200, 1200, 0.7);
  }

  const url = await uploadBytes(carId, docType, finalFile, file.name);
  await clearPendingUpload(carId, docType);
  return url;
}

/** Resume an upload stashed in IndexedDB before a page reload. */
export async function resumePendingUpload(record: PendingUploadRecord): Promise<string> {
  const file = new File([record.blob], record.fileName, {
    type: record.mimeType || 'application/octet-stream',
  });
  return uploadBookingDocument(record.carId, record.docType as BookingDocType, file);
}
