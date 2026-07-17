/**
 * Image Proxy Utility
 * Converts Supabase storage URLs to proxy URLs to hide bucket structure
 * Only proxies in local development; production serves directly
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PROXY_BASE = '/api/images';

/**
 * Extracts filename from Supabase storage URL and returns proxy URL
 * @param supabaseUrl - Full Supabase storage URL
 * @returns Proxy URL or original URL if not a Supabase URL
 */
export function toProxyUrl(supabaseUrl: string | undefined): string {
  if (!supabaseUrl) return '';
  // Only proxy in local development — in production serve directly
  if (import.meta.env.DEV && import.meta.env.VITE_USE_IMAGE_PROXY === 'true') {
    if (!supabaseUrl.includes('supabase.co')) return supabaseUrl;
    const urlParts = supabaseUrl.split('/public_assets/');
    if (!urlParts[1]) return supabaseUrl;
    return `/api/images/${urlParts[1]}`;
  }
  // In production: return the Supabase URL directly
  return supabaseUrl;
}

/**
 * Batch converts an array of Supabase URLs to proxy URLs
 */
export function toProxyUrls(urls: (string | undefined)[]): string[] {
  return urls.map(url => toProxyUrl(url));
}
