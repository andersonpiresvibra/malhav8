import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const str = fs.readFileSync("./src/lib/supabase.ts", "utf-8");
const u = str.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
const k = str.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);

if (u && k) {
  const supabase = createClient(u[1], k[1]);
  async function run() {
      // Since there's no direct "list tables" in supabase-js, we can query information_schema if we have access, or try to query specific names
      const tries = ["flights", "malha_dia", "flyght", "flight"];
      for (const t of tries) {
         const { error } = await supabase.from(t).select('id').limit(1);
         console.log(t, error ? error.message : "Exists!");
      }
  }
  run();
}
