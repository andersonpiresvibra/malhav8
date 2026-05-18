import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function run() {
  const payload = {
    date: '2025-10-10',
    airline: 'GOL',
    flight_number: '1234',
    destination: 'GRU',
    etd: '10:00'
  };
  
  const { data, error } = await supabase.from('base_mesh_flights').insert([payload]).select();
  if (error) {
    console.error("Insert Error:", error);
  } else {
    console.log("Insert Success! Data:", data);
  }
}

run();
