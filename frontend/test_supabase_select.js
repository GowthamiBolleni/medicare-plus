import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://riwyhlgutaqjrdcbfzok.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpd3lobGd1dGFxanJkY2Jmem9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTUwMTYsImV4cCI6MjA5NTYzMTAxNn0.qgPAN-8721WmrsapcoSJ6yksbv0lyyW_c2c_jh2KJsg";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  console.log("Querying users table for testuser1...");
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", "testuser1")
    .maybeSingle();
  
  if (error) {
    console.error("Select Error:", error);
  } else {
    console.log("Select Success! User record:", data);
  }
}

test();
