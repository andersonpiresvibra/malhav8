const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const str = fs.readFileSync('./src/lib/supabase.ts', 'utf-8');
const u = str.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
const k = str.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);

if (u && k) {
  const supabase = createClient(u[1], k[1]);
  supabase.from("flyght").select("*").limit(1).then(res1 => {
      console.log("flyght:", res1);
  });
  supabase.from("flights").select("*").limit(1).then(res2 => {
      console.log("flights length:", res2.data ? res2.data.length : res2.error);
  });
}
