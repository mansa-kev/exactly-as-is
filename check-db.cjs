const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://edroffvtzrowpsooszqh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc0MzY2MiwiZXhwIjoyMDkxMzE5NjYyfQ.jL_YxElgo1_RMcrsslERsioazsCTlwAzw-G0JylGJh8';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function checkDB() {
  // Check if car_reservations exists
  const { data: resData, error: resError } = await supabaseAdmin.from('car_reservations').select('id').limit(1);
  console.log("car_reservations:", resError ? resError.message : "Exists");

  // Check if id_number exists in user_profiles
  const { data: profileData, error: profileError } = await supabaseAdmin.from('user_profiles').select('id_number').limit(1);
  console.log("user_profiles.id_number:", profileError ? profileError.message : "Exists");
}

checkDB();
