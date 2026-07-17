const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://edroffvtzrowpsooszqh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc0MzY2MiwiZXhwIjoyMDkxMzE5NjYyfQ.jL_YxElgo1_RMcrsslERsioazsCTlwAzw-G0JylGJh8';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: 'johns_test3@gmail.com',
    password: 'Fleet123!',
    email_confirm: true,
    user_metadata: {
      role: 'client',
      full_name: 'Alex Johns'
    }
  });

  if (error) {
    console.error("Error creating user:", error);
  } else {
    console.log("User created:", data);
    // clean up
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
  }
}

test();
