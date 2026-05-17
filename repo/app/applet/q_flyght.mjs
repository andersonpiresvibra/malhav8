import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const str = fs.readFileSync("./src/lib/supabase.ts", "utf-8");
const u = str.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
const k = str.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);

if (u && k) {
  const supabase = createClient(u[1], k[1]);
  async function run() {
      const { data, error } = await supabase.from("flyght").select("*").limit(1);
      if (error) console.log("flyght error:", error);
      else console.log("flyght data:", data);
  }
  run();
}
