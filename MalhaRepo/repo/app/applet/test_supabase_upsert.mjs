import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Testing base_mesh_flights...');
  const payload = [
    {
      airline: 'GOL',
      flight_number: '1234'
    }
  ];

  console.log('Sending payload:', payload);
  const { data, error } = await supabase.from('base_mesh_flights').upsert(payload).select();
  console.log('Upsert result:', { data, error });

  if (error) {
     console.log('Upsert failed with error message:', error.message);
  }
}

run();
