const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://edroffvtzrowpsooszqh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc0MzY2MiwiZXhwIjoyMDkxMzE5NjYyfQ.jL_YxElgo1_RMcrsslERsioazsCTlwAzw-G0JylGJh8';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function checkFleetOwners() {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, full_name, role, status, fleet_owner_settings(*)')
    .eq('role', 'fleet_owner');
    
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Fleet Owners:", JSON.stringify(data, null, 2));
  }
}

checkFleetOwners();
