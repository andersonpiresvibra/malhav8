import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { supabase } from './src/lib/supabase';

async function run() {
  const { data, error } = await supabase.from('companhias').select('airline_code, airline, legal_name, category');
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

run();
