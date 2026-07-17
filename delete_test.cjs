const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://edroffvtzrowpsooszqh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc0MzY2MiwiZXhwIjoyMDkxMzE5NjYyfQ.jL_YxElgo1_RMcrsslERsioazsCTlwAzw-G0JylGJh8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDelete() {
  const { data, error } = await supabase.auth.admin.deleteUser('c331ee33-1961-4885-82da-95954e1f852d');
  console.log("Delete User Error:", error);
}

testDelete();
