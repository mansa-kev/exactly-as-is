import { createClient } from '@supabase/supabase-js';
export function getSupabaseUrl() {
    return (process.env.SUPABASE_URL ||
        process.env.VITE_SUPABASE_URL ||
        'https://edroffvtzrowpsooszqh.supabase.co');
}
export function getSupabaseServiceRoleKey() {
    return (process.env.SB_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
        '');
}
export function getSupabaseAnonKey() {
    return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
}
export function getSupabaseApiKey() {
    return getSupabaseServiceRoleKey() || getSupabaseAnonKey();
}
export function isSupabaseConfigured() {
    return Boolean(getSupabaseUrl() && getSupabaseApiKey());
}
let cachedClient = null;
export function getSupabase() {
    if (cachedClient)
        return cachedClient;
    const url = getSupabaseUrl();
    const key = getSupabaseApiKey();
    if (!key) {
        throw new Error('Supabase is not configured. Set SUPABASE_SERVICE_ROLE_KEY (and SUPABASE_URL / VITE_SUPABASE_URL) in Vercel environment variables.');
    }
    cachedClient = createClient(url, key);
    return cachedClient;
}
