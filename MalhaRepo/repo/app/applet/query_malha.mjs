import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const configStr = fs.readFileSync('./src/lib/supabase.ts', 'utf-8');
const urlMatch = configStr.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = configStr.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);

if (urlMatch && keyMatch) {
    const supabase = createClient(urlMatch[1], keyMatch[1]);

    async function run() {
        const { data, error } = await supabase.from('malha_dia').select('date, flight_number, destination').limit(10);
        if (error) {
            console.error(error);
        } else {
            console.log("DATES IN MALHA DIA:", [...new Set(data.map(d => d.date))]);
        }
    }
    run();
} else {
    console.error("credentials not found");
}
