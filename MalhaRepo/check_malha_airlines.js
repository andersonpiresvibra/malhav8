import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function run() {
  const { data } = await supabase.from('malha_raiz').select('airline, airline_code');
  const codes = new Set();
  const airlines = new Set();
  data?.forEach(r => {
    if (r.airline_code) codes.add(r.airline_code);
    if (r.airline) airlines.add(r.airline);
  });
  console.log("Cias (airline_code):", Array.from(codes));
  console.log("Cias (airline):", Array.from(airlines));
}
run();
