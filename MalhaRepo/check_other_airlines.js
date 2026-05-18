import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function run() {
  const [aero, malha] = await Promise.all([
    supabase.from('aeronaves').select('airline').then(r => r.data),
    supabase.from('malha_raiz').select('airline_code, flight_number').then(r => r.data)
  ]);
  const s = new Set();
  aero?.forEach(a => { if (a.airline) s.add(a.airline); });
  malha?.forEach(m => {
    let c = m.airline_code || (m.flight_number && m.flight_number.match(/^[A-Z]{2,3}/)?.[0]);
    if (c) s.add(c);
  });
  console.log("OTHER AIRLINES: ", Array.from(s));
}
run();
