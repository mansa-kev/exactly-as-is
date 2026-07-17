import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://edroffvtzrowpsooszqh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc0MzY2MiwiZXhwIjoyMDkxMzE5NjYyfQ.jL_YxElgo1_RMcrsslERsioazsCTlwAzw-G0JylGJh8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  // Delete all cars created in the last hour
  const { data, error } = await supabase
    .from('cars')
    .delete()
    .gte('created_at', oneHourAgo);
    
  if (error) {
    console.error('Error deleting cars:', error);
  } else {
    console.log('Successfully deleted recently inserted cars to start over.');
  }
}

run();
