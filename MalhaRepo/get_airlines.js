import { createClient } from '@supabase/supabase-js';

import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('companhias').select('airline, legal_name, airline_code');
  if (error) console.error(error);
  else console.log("COMPANIES: ", JSON.stringify(data));
}
run();
