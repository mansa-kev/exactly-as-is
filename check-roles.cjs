const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://edroffvtzrowpsooszqh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc0MzY2MiwiZXhwIjoyMDkxMzE5NjYyfQ.jL_YxElgo1_RMcrsslERsioazsCTlwAzw-G0JylGJh8';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function checkRoles() {
  const { data, error } = await supabaseAdmin.from('user_profiles').select('role').limit(1);
  if (error) {
    console.error("Error querying roles:", error);
  } else {
    console.log("Roles found:", data);
  }
}

checkRoles();
