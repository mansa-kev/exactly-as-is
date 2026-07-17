const MODEL_IMAGE_CACHE_VERSION = 'v2';
const MODEL_IMAGE_CACHE_PREFIX = `model_image_${MODEL_IMAGE_CACHE_VERSION}_`;
const LEGACY_MODEL_IMAGE_PREFIX = 'model_image_';

export const LOGO_STORAGE_KEY = 'linkedup_logo_url_v2';
export const LEGACY_LOGO_STORAGE_KEY = 'linkedup_logo_url';

export function readCachedLogoUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return (
      sessionStorage.getItem(LOGO_STORAGE_KEY) ||
      localStorage.getItem(LOGO_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_LOGO_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function writeCachedLogoUrl(url: string) {
  if (typeof window === 'undefined' || !url) return;
  try {
    localStorage.setItem(LOGO_STORAGE_KEY, url);
    sessionStorage.setItem(LOGO_STORAGE_KEY, url);
    localStorage.removeItem(LEGACY_LOGO_STORAGE_KEY);
  } catch {
    // ignore quota errors
  }
}

function isPersistableImageUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('blob:')) return false;
  if (url.includes('picsum.photos')) return false;
  return url.startsWith('http') || url.startsWith('/');
}

export function modelImageCacheKey(modelId: string): string {
  return `${MODEL_IMAGE_CACHE_PREFIX}${modelId}`;
}

export function clearLegacyModelImageCaches(modelId?: string) {
  if (typeof localStorage === 'undefined') return;
  if (modelId) {
    localStorage.removeItem(`${LEGACY_MODEL_IMAGE_PREFIX}${modelId}`);
    return;
  }
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(LEGACY_MODEL_IMAGE_PREFIX) && !key.startsWith(MODEL_IMAGE_CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

export function resolveModelCardImageUrl(
  modelId: string,
  primaryImageUrl?: string | null,
  galleryUrls: string[] = []
): string {
  const candidates = [primaryImageUrl, ...galleryUrls].filter(isPersistableImageUrl) as string[];
  const dbUrl = candidates[0];

  if (dbUrl) {
    try {
      localStorage.setItem(modelImageCacheKey(modelId), dbUrl);
      localStorage.removeItem(`${LEGACY_MODEL_IMAGE_PREFIX}${modelId}`);
    } catch {
      // ignore quota errors
    }
    return dbUrl;
  }

  try {
    const cached = localStorage.getItem(modelImageCacheKey(modelId));
    if (cached && isPersistableImageUrl(cached)) {
      return cached;
    }
    localStorage.removeItem(modelImageCacheKey(modelId));
    localStorage.removeItem(`${LEGACY_MODEL_IMAGE_PREFIX}${modelId}`);
  } catch {
    // ignore
  }

  return '/placeholder-car.svg';
}

export function rememberFailedModelImage(modelId: string) {
  try {
    localStorage.removeItem(modelImageCacheKey(modelId));
    localStorage.removeItem(`${LEGACY_MODEL_IMAGE_PREFIX}${modelId}`);
  } catch {
    // ignore
  }
}
