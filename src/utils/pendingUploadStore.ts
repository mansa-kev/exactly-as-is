/**
 * IndexedDB store for booking-flow document uploads interrupted by mobile page reloads.
 */

const DB_NAME = 'linkedup_pending_uploads_v1';
const STORE = 'uploads';
const DB_VERSION = 1;

export interface PendingUploadRecord {
  key: string;
  carId: string;
  docType: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | void> {
  return openDb().then(
    (db) =>
      new Promise<T | void>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const result = fn(store);
        tx.oncomplete = () => {
          db.close();
          if (result instanceof IDBRequest) {
            resolve(result.result as T);
          } else {
            resolve();
          }
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error || new Error('IndexedDB transaction failed'));
        };
      })
  );
}

export function pendingUploadKey(carId: string, docType: string): string {
  return `${carId}::${docType}`;
}

export async function savePendingUpload(record: PendingUploadRecord): Promise<void> {
  await runTransaction('readwrite', (store) => store.put(record));
}

export async function getPendingUpload(carId: string, docType: string): Promise<PendingUploadRecord | null> {
  const key = pendingUploadKey(carId, docType);
  const result = await runTransaction<PendingUploadRecord | undefined>('readonly', (store) => store.get(key));
  return (result as PendingUploadRecord | undefined) || null;
}

export async function listPendingUploadsForCar(carId: string): Promise<PendingUploadRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      db.close();
      const all = (request.result as PendingUploadRecord[]) || [];
      resolve(all.filter((r) => r.carId === carId));
    };
    request.onerror = () => {
      db.close();
      reject(request.error || new Error('Failed to list pending uploads'));
    };
  });
}

export async function clearPendingUpload(carId: string, docType: string): Promise<void> {
  const key = pendingUploadKey(carId, docType);
  await runTransaction('readwrite', (store) => store.delete(key));
}
