const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://edroffvtzrowpsooszqh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc0MzY2MiwiZXhwIjoyMDkxMzE5NjYyfQ.jL_YxElgo1_RMcrsslERsioazsCTlwAzw-G0JylGJh8';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function checkCols() {
  const cols = [
    'id', 'email', 'full_name', 'role', 'status',
    'id_number', 'face_photo_url', 'license_front_url', 'license_back_url', 'id_front_url', 'id_back_url'
  ];
  
  for (const col of cols) {
    const { error } = await supabaseAdmin.from('user_profiles').select(col).limit(1);
    if (error) {
      console.log(`Column ${col} missing or error:`, error.message);
    } else {
      console.log(`Column ${col} OK`);
    }
  }
}

checkCols();
