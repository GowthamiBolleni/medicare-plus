import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://riwyhlgutaqjrdcbfzok.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpd3lobGd1dGFxanJkY2Jmem9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTUwMTYsImV4cCI6MjA5NTYzMTAxNn0.qgPAN-8721WmrsapcoSJ6yksbv0lyyW_c2c_jh2KJsg";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  console.log("Attempting signInWithPassword for gowthami@example.com...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "gowthami@example.com",
    password: "testpassword",
  });
  
  if (error) {
    console.error("signIn Error:", error);
  } else {
    console.log("signIn Success! Session token retrieved:", data.session.access_token.slice(0, 30) + "...");
  }
}

test();
