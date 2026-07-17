/**
 * Seeds test data: fleet owner, car, and master contract.
 */

const SUPABASE_URL = 'https://edroffvtzrowpsooszqh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc0MzY2MiwiZXhwIjoyMDkxMzE5NjYyfQ.jL_YxElgo1_RMcrsslERsioazsCTlwAzw-G0JylGJh8';

const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

async function main() {
  // ─── 1. Create Fleet Owner Auth User ─────────────────────────
  console.log('1. Creating fleet owner auth user...');
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: 'fleet@linkedupcars.com',
      password: 'Fleet@2026#',
      email_confirm: true,
      user_metadata: { full_name: 'Test Fleet Owner', role: 'fleet_owner' },
    }),
  });
  
  let fleetUserId;
  if (!authRes.ok) {
    const err = await authRes.json();
    if (err.msg?.includes('already') || err.message?.includes('already')) {
      console.log('   Fleet owner auth user already exists, looking up...');
      const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers });
      const listData = await listRes.json();
      const existing = listData.users?.find(u => u.email === 'fleet@linkedupcars.com');
      fleetUserId = existing?.id;
    } else {
      console.error('   Failed:', err);
      process.exit(1);
    }
  } else {
    const authUser = await authRes.json();
    fleetUserId = authUser.id;
  }
  console.log(`   ✓ Fleet user ID: ${fleetUserId}`);

  // ─── 2. Create Fleet Owner Profile ───────────────────────────
  console.log('2. Creating fleet owner profile...');
  await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify({
      id: fleetUserId,
      full_name: 'Test Fleet Owner',
      email: 'fleet@linkedupcars.com',
      phone_number: '0712345678',
      role: 'fleet_owner',
      status: 'active',
    }),
  });
  console.log('   ✓ Profile created/updated');

  // ─── 3. Create Fleet Owner Settings ──────────────────────────
  console.log('3. Creating fleet owner settings...');
  await fetch(`${SUPABASE_URL}/rest/v1/fleet_owner_settings`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify({
      id: fleetUserId,
      company_name: 'LinkedUp Fleet Co.',
      commission_rate: 0.15,
      status: 'active',
    }),
  });
  console.log('   ✓ Fleet settings created');

  // ─── 4. Create a Test Car ────────────────────────────────────
  console.log('4. Creating test car...');
  const carRes = await fetch(`${SUPABASE_URL}/rest/v1/cars`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fleet_owner_id: fleetUserId,
      make: 'Toyota',
      model: 'Land Cruiser V8',
      year: 2024,
      color: 'Pearl White',
      license_plate: 'KDA 001A',
      category: 'SUV',
      daily_rate: 15000,
      seats: 7,
      fuel_type: 'Diesel',
      transmission: 'Automatic',
      description: 'Premium 2024 Toyota Land Cruiser V8 — the ultimate safari and city cruiser. Full leather interior, sunroof, 4WD, and advanced safety features. Perfect for family trips or executive travel across Kenya.',
      features: ['4WD', 'Leather Seats', 'Sunroof', 'Bluetooth', 'GPS Navigation', 'Reverse Camera', 'Climate Control', 'USB Charging'],
      photos: [
        'https://images.unsplash.com/photo-1594611396059-8a589e93ef7b?w=1200',
        'https://images.unsplash.com/photo-1625231334401-6d36eb3af27c?w=1200',
        'https://images.unsplash.com/photo-1606611013016-969c19ba27ea?w=1200'
      ],
      primary_image_url: 'https://images.unsplash.com/photo-1594611396059-8a589e93ef7b?w=1200',
      status: 'available',
      location_lat: -1.2921,
      location_lon: 36.8219,
      is_approved: true,
    }),
  });

  if (!carRes.ok) {
    const err = await carRes.text();
    console.error('   Failed to create car:', err);
  } else {
    const carData = await carRes.json();
    console.log(`   ✓ Car created: ${carData[0]?.id || 'OK'} — Toyota Land Cruiser V8`);
  }

  // ─── 5. Create a Second Car ──────────────────────────────────
  console.log('5. Creating second test car...');
  const car2Res = await fetch(`${SUPABASE_URL}/rest/v1/cars`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fleet_owner_id: fleetUserId,
      make: 'Mercedes-Benz',
      model: 'E-Class',
      year: 2025,
      color: 'Obsidian Black',
      license_plate: 'KDB 200B',
      category: 'Luxury',
      daily_rate: 25000,
      seats: 5,
      fuel_type: 'Petrol',
      transmission: 'Automatic',
      description: 'Brand new 2025 Mercedes-Benz E-Class. Elegance meets performance with AMG styling, panoramic roof, and premium Burmester sound system. Ideal for business executives and special occasions.',
      features: ['AMG Package', 'Panoramic Roof', 'Burmester Sound', 'Heated Seats', 'Apple CarPlay', 'Android Auto', 'Ambient Lighting', '360 Camera'],
      photos: [
        'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1200',
        'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=1200'
      ],
      primary_image_url: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1200',
      status: 'available',
      location_lat: -1.2640,
      location_lon: 36.8034,
      is_approved: true,
    }),
  });

  if (!car2Res.ok) {
    const err = await car2Res.text();
    console.error('   Failed to create car 2:', err);
  } else {
    const car2Data = await car2Res.json();
    console.log(`   ✓ Car created: ${car2Data[0]?.id || 'OK'} — Mercedes-Benz E-Class`);
  }

  // ─── 6. Create Master Contract ───────────────────────────────
  console.log('6. Creating master contract...');
  const contractRes = await fetch(`${SUPABASE_URL}/rest/v1/contracts_master`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      version: '1.0',
      pdf_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      is_active: true,
    }),
  });

  if (!contractRes.ok) {
    const err = await contractRes.text();
    console.error('   Failed to create contract:', err);
  } else {
    const contractData = await contractRes.json();
    console.log(`   ✓ Contract created: ${contractData[0]?.id || 'OK'}`);
  }

  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║  TEST DATA SEEDED SUCCESSFULLY                 ║');
  console.log('║                                                 ║');
  console.log('║  Fleet Owner: fleet@linkedupcars.com            ║');
  console.log('║  Password:    Fleet@2026#                       ║');
  console.log('║  Company:     LinkedUp Fleet Co.                ║');
  console.log('║                                                 ║');
  console.log('║  Cars:                                          ║');
  console.log('║  1. Toyota Land Cruiser V8 — KES 15,000/day     ║');
  console.log('║  2. Mercedes-Benz E-Class  — KES 25,000/day     ║');
  console.log('║                                                 ║');
  console.log('║  Contract: Standard Rental Agreement v1.0       ║');
  console.log('╚════════════════════════════════════════════════╝');
}

main().catch(console.error);
