import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('flights').select('*, operators(war_name), vehicles(fleet_number)').limit(1);
  console.log("Data:", JSON.stringify(data, null, 2));
  if (error) console.log("Error:", error);
}
run();
