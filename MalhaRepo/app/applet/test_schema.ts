import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function run() {
  const { data, error } = await supabase.from('base_mesh_flights').upsert([{ id: undefined }]).select();
  if (error) {
    console.log("base_mesh_flights upsert error:", error);
  } else {
    console.log("base_mesh_flights upsert success, inserted:", data);
  }
}

run();
