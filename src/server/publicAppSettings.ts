import type { SupabaseClient } from '@supabase/supabase-js';

const PUBLIC_SETTING_KEYS = [
  'company_po_box',
  'company_signature_url',
  'contract_logo',
  'site_logo',
  'logo_url',
] as const;

export type PublicSettingRow = {
  key: string;
  value?: string | null;
  logo_url?: string | null;
};

function normalizeRow(row: Record<string, unknown>): PublicSettingRow {
  const key = String(row.key || '');
  const logoUrl =
    (typeof row.logo_url === 'string' && row.logo_url) ||
    (typeof row.value === 'string' && row.value.startsWith('http') ? row.value : null) ||
    null;
  const value =
    (typeof row.value === 'string' && row.value) ||
    logoUrl ||
    null;

  return { key, value, logo_url: logoUrl };
}

export async function fetchPublicAppSettings(
  supabase: SupabaseClient,
  requestedKeys?: string[]
): Promise<{ settings: PublicSettingRow[]; error?: string }> {
  const keys = (requestedKeys?.length ? requestedKeys : [...PUBLIC_SETTING_KEYS]).filter((key) =>
    (PUBLIC_SETTING_KEYS as readonly string[]).includes(key)
  );

  const withLogo = await supabase.from('app_settings').select('key, value, logo_url').in('key', keys);

  if (!withLogo.error) {
    return { settings: (withLogo.data || []).map((row) => normalizeRow(row as Record<string, unknown>)) };
  }

  const message = withLogo.error.message || '';
  const missingLogoColumn =
    message.includes('logo_url') && (message.includes('does not exist') || message.includes('42703'));

  if (!missingLogoColumn && !message.includes('does not exist')) {
    return { settings: [], error: message };
  }

  const fallback = await supabase.from('app_settings').select('key, value').in('key', keys);
  if (fallback.error) {
    if (fallback.error.message.includes('does not exist')) {
      return { settings: [], error: 'app_settings table is missing. Run scripts/fix_app_settings_table.sql.' };
    }
    return { settings: [], error: fallback.error.message };
  }

  return { settings: (fallback.data || []).map((row) => normalizeRow(row as Record<string, unknown>)) };
}
