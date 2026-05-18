import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');
async function main() {
  const { data, error } = await supabase.from('malha_dia').select('*').limit(3);
  if (error) console.error(error);
  else console.log(data);
}
main();
