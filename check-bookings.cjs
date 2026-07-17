const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://edroffvtzrowpsooszqh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc0MzY2MiwiZXhwIjoyMDkxMzE5NjYyfQ.jL_YxElgo1_RMcrsslERsioazsCTlwAzw-G0JylGJh8';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function checkBookings() {
  const { data, error } = await supabaseAdmin.from('bookings').select('*').limit(1);
  if (error) {
    console.error("Error querying bookings:", error);
  } else {
    console.log("Columns in bookings:", data.length > 0 ? Object.keys(data[0]) : "No rows");
    
    // Test if the SELECT in the trigger works
    const { data: triggerTest, error: triggerError } = await supabaseAdmin.rpc('exec_sql', { query: "SELECT metadata->'guest_info'->>'email' FROM bookings LIMIT 1" });
    if (triggerError) {
      console.log("Trigger SQL error:", triggerError);
    } else {
      console.log("Trigger SQL success:", triggerTest);
    }
  }
}

checkBookings();
