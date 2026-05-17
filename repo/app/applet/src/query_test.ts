import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const str = fs.readFileSync('./src/lib/supabase.ts', 'utf-8');
const u = str.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
const k = str.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);

if (u && k) {
  const supabase = createClient(u[1], k[1]);
  async function run() {
    const { data, error } = await supabase.from('malha_dia').select('*');
    if (error) {
       console.error("ERRO", error);
    } else {
       console.log("Total entries in malha_dia:", data.length);
       if (data.length > 0) {
         console.log("Columns:", Object.keys(data[0]));
         console.log("First entry:", data[0]);
       }
    }
  }
  run();
} else {
  console.log("No config");
}
