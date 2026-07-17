/**
 * Creates the initial admin user for LinkedUp Cars.
 * Uses Supabase Auth Admin API (service role key).
 */

const SUPABASE_URL = 'https://edroffvtzrowpsooszqh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc0MzY2MiwiZXhwIjoyMDkxMzE5NjYyfQ.jL_YxElgo1_RMcrsslERsioazsCTlwAzw-G0JylGJh8';

const ADMIN_EMAIL = 'Linkedupcarsrentals@gmail.com';
const ADMIN_PASSWORD = 'Linked@2026#';
const ADMIN_NAME = 'Linkedup Cars';

const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

async function main() {
  console.log('Creating admin user...\n');

  // 1. Create auth user
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ADMIN_NAME },
    }),
  });

  if (!authRes.ok) {
    const err = await authRes.json();
    if (err.msg?.includes('already been registered') || err.message?.includes('already been registered')) {
      console.log('⚠ User already exists. Fetching existing user...');
      // List users to find existing one
      const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`, {
        headers,
      });
      const listData = await listRes.json();
      const existingUser = listData.users?.find(u => u.email === ADMIN_EMAIL);
      if (existingUser) {
        console.log(`  Found user: ${existingUser.id}`);
        await createProfile(existingUser.id);
        return;
      }
    }
    console.error('❌ Failed to create auth user:', err);
    process.exit(1);
  }

  const authUser = await authRes.json();
  console.log(`✓ Auth user created: ${authUser.id}`);
  console.log(`  Email: ${ADMIN_EMAIL}`);

  // 2. Create user_profiles row with admin role
  await createProfile(authUser.id);
}

async function createProfile(userId) {
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
    method: 'POST',
    headers: {
      ...headers,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      id: userId,
      full_name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      role: 'admin',
      status: 'active',
      loyalty_tier: 'Platinum',
    }),
  });

  if (!profileRes.ok) {
    const err = await profileRes.text();
    if (err.includes('duplicate key') || err.includes('already exists')) {
      console.log('⚠ Profile already exists. Updating role to admin...');
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ role: 'admin', status: 'active' }),
      });
      if (updateRes.ok) {
        console.log('✓ Profile updated to admin role');
      } else {
        console.error('❌ Failed to update profile:', await updateRes.text());
      }
      return;
    }
    console.error('❌ Failed to create profile:', err);
    process.exit(1);
  }

  const profile = await profileRes.json();
  console.log(`✓ Admin profile created`);
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  ADMIN ACCOUNT CREATED               ║`);
  console.log(`║  Email: ${ADMIN_EMAIL.padEnd(25)}║`);
  console.log(`║  Password: ${ADMIN_PASSWORD.padEnd(23)}║`);
  console.log(`║  Role: admin                         ║`);
  console.log(`╚══════════════════════════════════════╝`);
}

main().catch(console.error);
