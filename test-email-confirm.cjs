const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://edroffvtzrowpsooszqh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc0MzY2MiwiZXhwIjoyMDkxMzE5NjYyfQ.jL_YxElgo1_RMcrsslERsioazsCTlwAzw-G0JylGJh8';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function testEmailConfirm() {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: 'johns_test5@gmail.com',
    password: 'Fleet123!',
    email_confirm: false, // changed
    user_metadata: {
      role: 'fleet_owner',
      full_name: 'Alex Johns'
    }
  });

  if (error) {
    console.error("Error creating user:", error);
  } else {
    console.log("User created:", data);
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
  }
}

testEmailConfirm();
