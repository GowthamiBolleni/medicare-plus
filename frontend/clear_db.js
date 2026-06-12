import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://riwyhlgutaqjrdcbfzok.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpd3lobGd1dGFxanJkY2Jmem9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTUwMTYsImV4cCI6MjA5NTYzMTAxNn0.qgPAN-8721WmrsapcoSJ6yksbv0lyyW_c2c_jh2KJsg";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function clearDB() {
  console.log("Starting Supabase database cleanup (removing seeded data)...");

  // 1. Delete all rows from child tables
  const { error: medError } = await supabase.from("medicines").delete().neq("id", 0);
  if (medError) console.error("Error clearing medicines:", medError);
  else console.log("Cleared all medicines logs.");

  const { error: apptError } = await supabase.from("appointments").delete().neq("id", 0);
  if (apptError) console.error("Error clearing appointments:", apptError);
  else console.log("Cleared all appointments logs.");

  const { error: metricsError } = await supabase.from("health_metrics").delete().neq("id", 0);
  if (metricsError) console.error("Error clearing health metrics:", metricsError);
  else console.log("Cleared all health metrics logs.");

  const { error: expensesError } = await supabase.from("expenses").delete().neq("id", 0);
  if (expensesError) console.error("Error clearing expenses:", expensesError);
  else console.log("Cleared all expenses logs.");

  const { error: messagesError } = await supabase.from("messages").delete().neq("id", 0);
  if (messagesError) console.error("Error clearing messages:", messagesError);
  else console.log("Cleared all messages logs.");

  // 2. Reset the profile to empty baseline stats
  const { error: userError } = await supabase
    .from("users")
    .upsert({
      id: 1,
      username: "testuser1",
      email: "gowthami@example.com",
      hashed_password: "testpassword",
      full_name: "Gowthami",
      profile_image: "",
      health_score: 100,
      weight: 0.0,
      height: 0.0,
      age: 0,
      gender: "Not Specified"
    });

  if (userError) console.error("Error resetting profile stats:", userError);
  else console.log("Reset Gowthami profile stats to absolute zero.");

  console.log("Supabase cleanup completely finished! App is in pristine empty state.");
}

clearDB();
