import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://edroffvtzrowpsooszqh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc0MzY2MiwiZXhwIjoyMDkxMzE5NjYyfQ.jL_YxElgo1_RMcrsslERsioazsCTlwAzw-G0JylGJh8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const carsToAdd = [
  { make: 'Mazda', model: 'Demio', daily_rate: 3500, category: 'Compact' },
  { make: 'Nissan', model: 'Note (Normal)', daily_rate: 3000, category: 'Compact' },
  { make: 'Nissan', model: 'Note ePower', daily_rate: 3500, category: 'Compact' },
  { make: 'Nissan', model: 'Note Nismo', daily_rate: 3500, category: 'Compact' },
  { make: 'Toyota', model: 'Harrier', daily_rate: 8000, category: 'SUV' },
  { make: 'Toyota', model: 'Prado Petrol', daily_rate: 12000, category: 'SUV' },
  { make: 'Toyota', model: 'Prado Diesel', daily_rate: 13000, category: 'SUV' },
  { make: 'Nissan', model: 'X-Trail', daily_rate: 6500, category: 'SUV' },
  { make: 'Mazda', model: 'CX-5', daily_rate: 6500, category: 'SUV' },
  { make: 'Mazda', model: 'Axela', daily_rate: 5000, category: 'Sedan' },
  { make: 'Mazda', model: 'CX-3', daily_rate: 6000, category: 'SUV' },
  { make: 'Toyota', model: 'Axio', daily_rate: 4000, category: 'Sedan' },
  { make: 'Toyota', model: 'Fielder', daily_rate: 4500, category: 'Station Wagon' },
  { make: 'Mazda', model: 'CX-8', daily_rate: 8000, category: 'SUV' },
  { make: 'Mitsubishi', model: 'Outlander', daily_rate: 7000, category: 'SUV' },
  { make: 'Toyota', model: 'Noah/Voxy', daily_rate: 6500, category: 'Van' },
  { make: 'Nissan', model: 'Serena', daily_rate: 6000, category: 'Van' },
  { make: 'Toyota', model: 'Landcruiser V8', daily_rate: 25000, category: 'SUV' },
  { make: 'Mercedes-Benz', model: 'G-Wagon', daily_rate: 120000, category: 'Luxury', description: 'Chauffeured' },
  { make: 'Land Rover', model: 'Range Rover Sport', daily_rate: 70000, category: 'Luxury', description: 'Chauffeured' },
  { make: 'Toyota', model: 'RAV4', daily_rate: 9000, category: 'SUV' },
  { make: 'Mercedes-Benz', model: 'C200', daily_rate: 18000, category: 'Luxury' },
  { make: 'Mercedes-Benz', model: 'E250', daily_rate: 22000, category: 'Luxury' }
];

async function run() {
  console.log('Fetching fleet owner...');
  const { data: users, error: userError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('role', 'fleet_owner')
    .limit(1);

  let fleetOwnerId = null;
  if (users && users.length > 0) {
    fleetOwnerId = users[0].id;
  } else {
    const { data: allUsers } = await supabase.from('user_profiles').select('id').limit(1);
    if (allUsers && allUsers.length > 0) fleetOwnerId = allUsers[0].id;
  }

  if (!fleetOwnerId) {
    console.error('No users found to assign cars to.');
    return;
  }

  for (const car of carsToAdd) {
    const tempLicensePlate = `TEMP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    const { data, error } = await supabase
      .from('cars')
      .insert({
        fleet_owner_id: fleetOwnerId,
        make: car.make,
        model: car.model,
        daily_rate: car.daily_rate,
        category: car.category,
        description: car.description || '',
        license_plate: tempLicensePlate,
        status: 'available',
        is_approved: true
      })
      .select();

    if (error) {
      console.error(`Failed to insert ${car.make} ${car.model}:`, error);
    } else {
      console.log(`Successfully inserted ${car.make} ${car.model} with temp plate ${tempLicensePlate}`);
    }
  }

  console.log('Finished inserting cars.');
}

run();
