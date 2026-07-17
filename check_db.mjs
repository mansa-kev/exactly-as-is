import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('vehicle_models').select('*').limit(1);
  if (error) console.error("Error:", error);
  else console.log("First model keys:", Object.keys(data[0] || {}));
}
run();
