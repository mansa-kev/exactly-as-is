import { toProxiedAssetUrl } from './assetUrl.js';

/** Normalize stored upload URLs and append cache-busting for fresh proxy reads. */
export function resolveDocumentPreviewUrl(
  url: string | null | undefined,
  bustCache = false
): string | null {
  if (!url) return null;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;

  const proxied = toProxiedAssetUrl(url) || url;
  if (!bustCache) return proxied;
  const separator = proxied.includes('?') ? '&' : '?';
  return `${proxied}${separator}v=${Date.now()}`;
}
