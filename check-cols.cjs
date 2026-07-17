const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://edroffvtzrowpsooszqh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc0MzY2MiwiZXhwIjoyMDkxMzE5NjYyfQ.jL_YxElgo1_RMcrsslERsioazsCTlwAzw-G0JylGJh8';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function checkCols() {
  const { data, error } = await supabaseAdmin.from('car_reservations').select('*').limit(1);
  if (error) {
    console.error("Error querying car_reservations:", error);
  } else {
    console.log("Columns in car_reservations:", data.length > 0 ? Object.keys(data[0]) : "No rows, cannot infer columns from empty array using standard select (though REST returns empty array)");
    // To get columns from empty table, we can select specific columns
    const { error: e2 } = await supabaseAdmin.from('car_reservations').select('contact_email').limit(1);
    console.log("contact_email exists:", !e2);
  }
}

checkCols();
