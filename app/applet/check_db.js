import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const configStr = fs.readFileSync('./src/lib/supabase.ts', 'utf-8');
const urlMatch = configStr.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = configStr.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);

if (!urlMatch || !keyMatch) {
    console.error("Could not extract Supabase credentials");
    process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
    const { data, error } = await supabase.from('malha_dia').select('date, etd, flight_number, destination, model');
    if (error) {
        console.error("Error:", error);
    } else {
        const dates = [...new Set(data?.map(d => d.date))];
        console.log("Distinct dates in malha_dia:", dates);
        console.log("First 3 rows:", data?.slice(0, 3));
        console.log("Total rows:", data?.length);
    }
}
run();
