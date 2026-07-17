/**
 * Environment Variable Validation
 * Validates required environment variables on startup
 */

const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY'
];

const optionalEnvVars = [
  'VITE_FLEET_URL',
  'VITE_ADMIN_URL',
  'VITE_CLIENT_URL',
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
  'MPESA_PASSKEY',
  'MPESA_SHORTCODE',
  'MPESA_CALLBACK_URL',
  'MPESA_ENV'
];

export function validateEnv(): void {
  const missing: string[] = [];

  requiredEnvVars.forEach(varName => {
    if (!import.meta.env[varName]) {
      missing.push(varName);
    }
  });

  if (missing.length > 0) {
    console.warn(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please set these in your .env file and restart the development server.`
    );
    return;
  }

  // Log warnings for optional env vars
  optionalEnvVars.forEach(varName => {
    if (!import.meta.env[varName]) {
      console.warn(`Optional environment variable not set: ${varName}`);
    }
  });
}

// Auto-validate on import
validateEnv();
