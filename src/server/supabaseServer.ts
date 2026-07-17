import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://edroffvtzrowpsooszqh.supabase.co'
  );
}

export function getSupabaseServiceRoleKey(): string {
  return (
    process.env.SB_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    ''
  );
}

export function getSupabaseAnonKey(): string {
  return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
}

export function getSupabaseApiKey(): string {
  return getSupabaseServiceRoleKey() || getSupabaseAnonKey();
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseApiKey());
}

let cachedClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = getSupabaseUrl();
  const key = getSupabaseApiKey();

  if (!key) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_SERVICE_ROLE_KEY (and SUPABASE_URL / VITE_SUPABASE_URL) in Vercel environment variables.',
    );
  }

  cachedClient = createClient(url, key);
  return cachedClient;
}
