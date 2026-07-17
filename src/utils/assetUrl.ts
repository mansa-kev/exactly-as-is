export function toProxyUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/api/documents/proxy/')) return url;

  const marker = '/storage/v1/object/public/';
  const idx = url.indexOf(marker);
  if (idx === -1) return url;

  const after = url.slice(idx + marker.length);
  const firstSlash = after.indexOf('/');
  if (firstSlash === -1) return url;

  const bucket = after.slice(0, firstSlash);
  const path = after.slice(firstSlash + 1);
  if (!bucket || !path) return url;

  return `/api/documents/proxy/${bucket}/${path}`;
}

export function toProxiedAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return toProxyUrl(url) || url;
}

export function resolveAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  if (url.startsWith('/api/documents/proxy/')) {
    const parts = url.split('/').filter(Boolean);
    if (parts.length >= 4) {
      const bucket = parts[2];
      const path = parts.slice(3).join('/');
      return `https://edroffvtzrowpsooszqh.supabase.co/storage/v1/object/public/${bucket}/${path}`;
    }
  }

  if (url.startsWith('/api/assets/')) {
    const parts = url.split('/').filter(Boolean);
    if (parts.length >= 4) {
      const bucket = parts[2];
      const path = parts.slice(3).join('/');
      return `https://edroffvtzrowpsooszqh.supabase.co/storage/v1/object/public/${bucket}/${path}`;
    }
  }

  if (url.startsWith('/api/images/')) {
    const parts = url.split('/').filter(Boolean);
    if (parts.length >= 3) {
      const path = parts.slice(2).join('/');
      return `https://edroffvtzrowpsooszqh.supabase.co/storage/v1/object/public/public_assets/${path}`;
    }
  }

  return url;
}

