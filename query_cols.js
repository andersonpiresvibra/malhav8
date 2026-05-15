import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function run() {
  const { data, error } = await supabase.from('base_mesh_flights').select('*').limit(1);
  if (error) {
    console.error("Query Error:", error);
  } else {
    console.log("Success! Returned array length:", data.length);
    if (data.length > 0) {
      console.log("Columns:", Object.keys(data[0]));
    }
  }
}

run();
