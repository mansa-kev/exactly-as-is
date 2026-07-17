import { createClient } from '@supabase/supabase-js';
import { handleSupabaseError } from '../utils/errorHandling';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://edroffvtzrowpsooszqh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_kHHCZxwXi3vC9WAtSdmnCQ_j1rLgKRS';

const missingCredentialsError = new Error('Missing Supabase credentials. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');

const createDisabledQuery = () => {
  const result = { data: null, error: missingCredentialsError };
  const query: any = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'then') return Promise.resolve(result).then.bind(Promise.resolve(result));
      if (['single', 'maybeSingle', 'csv', 'geojson', 'explain'].includes(String(prop))) {
        return () => Promise.resolve(result);
      }
      return () => query;
    },
  });
  return query;
};

const createDisabledSupabaseClient = () => ({
  from: () => createDisabledQuery(),
  rpc: () => Promise.resolve({ data: null, error: missingCredentialsError }),
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    signOut: () => Promise.resolve({ error: null }),
    signInWithPassword: () => Promise.resolve({ data: null, error: missingCredentialsError }),
    signUp: () => Promise.resolve({ data: null, error: missingCredentialsError }),
    resetPasswordForEmail: () => Promise.resolve({ data: null, error: missingCredentialsError }),
    updateUser: () => Promise.resolve({ data: null, error: missingCredentialsError }),
  },
  storage: {
    from: () => ({
      upload: () => Promise.resolve({ data: null, error: missingCredentialsError }),
      remove: () => Promise.resolve({ data: null, error: missingCredentialsError }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  },
  functions: {
    invoke: () => Promise.resolve({ data: null, error: missingCredentialsError }),
  },
});

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Login.tsx handles ?code= / token_hash explicitly via exchangeCodeForSession
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : (createDisabledSupabaseClient() as unknown as ReturnType<typeof createClient>);

export const handleSupabaseErrorWrapper = (error: any, operation: string) => {
  throw new Error(handleSupabaseError(error, operation));
};
