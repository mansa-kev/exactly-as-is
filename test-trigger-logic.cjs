const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://edroffvtzrowpsooszqh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc0MzY2MiwiZXhwIjoyMDkxMzE5NjYyfQ.jL_YxElgo1_RMcrsslERsioazsCTlwAzw-G0JylGJh8';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function testLogic() {
  const email = 'johns_test3@gmail.com';
  
  // Test 1: Bookings select
  const { data: bData, error: bError } = await supabaseAdmin.from('bookings')
    .select('metadata')
    .is('client_id', null)
    .eq('metadata->guest_info->>email', email)
    .order('created_at', { ascending: false })
    .limit(1);
    
  console.log("Bookings select error:", bError);

  // Test 2: Car reservations update
  const { data: cData, error: cError } = await supabaseAdmin.from('car_reservations')
    .update({ notes: 'test' })
    .is('client_id', null)
    .eq('contact_email', email);
    
  console.log("Car reservations update error:", cError);
  
  // Test 3: Insert profile
  const { data: pData, error: pError } = await supabaseAdmin.from('user_profiles')
    .insert({
      id: '00000000-0000-0000-0000-000000000000', // invalid uuid but let's see if it fails due to FK
      email: email,
      full_name: 'Test',
      role: 'client',
      status: 'active'
    });
    
  console.log("User profile insert error:", pError);
}

testLogic();
