import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('vehicle_models').select('id, slug, family_slug, make, model, year').limit(5);
  if (error) console.error("Error:", error);
  else console.log(JSON.stringify(data, null, 2));
}
run();
