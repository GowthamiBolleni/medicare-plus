import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://riwyhlgutaqjrdcbfzok.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpd3lobGd1dGFxanJkY2Jmem9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTUwMTYsImV4cCI6MjA5NTYzMTAxNn0.qgPAN-8721WmrsapcoSJ6yksbv0lyyW_c2c_jh2KJsg";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function seed() {
  console.log("Starting Supabase database seeding...");

  // 1. Seed user
  const { data: user, error: userError } = await supabase
    .from("users")
    .upsert({
      id: 1,
      username: "testuser1",
      email: "gowthami@example.com",
      hashed_password: "testpassword",
      full_name: "Gowthami",
      profile_image: "",
      health_score: 82,
      weight: 58.0,
      height: 162.0,
      age: 28,
      gender: "Female"
    })
    .select();

  if (userError) {
    console.error("Error seeding user:", userError);
    return;
  }
  console.log("Seeded user Gowthami successfully.");

  // 2. Seed medicines
  const medicines = [
    { name: "Paracetamol 500mg", dosage: "1 Tablet", instructions: "After Food", time: "08:00 AM", category: "Tablet", status: "Taken", user_id: 1 },
    { name: "Vitamin D3", dosage: "1 Tablet", instructions: "After Food", time: "12:00 PM", category: "Tablet", status: "Upcoming", user_id: 1 },
    { name: "Omega 3", dosage: "1 Capsule", instructions: "After Food", time: "08:00 PM", category: "Capsule", status: "Upcoming", user_id: 1 },
    { name: "Calcium", dosage: "1 Tablet", instructions: "After Food", time: "09:00 PM", category: "Tablet", status: "Upcoming", user_id: 1 }
  ];

  const { error: medError } = await supabase.from("medicines").upsert(medicines);
  if (medError) {
    console.error("Error seeding medicines:", medError);
  } else {
    console.log("Seeded default medicines successfully.");
  }

  // 3. Seed appointments
  const appointments = [
    { hospital: "Apollo Hospital", doctor: "Dr. Sharma", specialty: "Cardiologist", date: "25 May 2026", time: "11:00 AM", status: "Upcoming", description: "Routine cardiac checkup and medicine titration", user_id: 1 },
    { hospital: "City Hospital", doctor: "Dr. Mehta", specialty: "Neurologist", date: "02 June 2026", time: "04:00 PM", status: "Upcoming", description: "Follow-up consultation on sleep quality", user_id: 1 },
    { hospital: "Sunrise Hospital", doctor: "Dr. Patel", specialty: "Orthopedic", date: "10 June 2026", time: "10:00 AM", status: "Upcoming", description: "Physiotherapy reviews", user_id: 1 }
  ];

  const { error: apptError } = await supabase.from("appointments").upsert(appointments);
  if (apptError) {
    console.error("Error seeding appointments:", apptError);
  } else {
    console.log("Seeded default appointments successfully.");
  }

  // 4. Seed health metrics
  const now = new Date();
  const metrics = [];
  const baseBP = [
    { sys: 118, dia: 78, hr: 70, bs: 108 },
    { sys: 121, dia: 81, hr: 73, bs: 112 },
    { sys: 120, dia: 79, hr: 72, bs: 110 },
    { sys: 119, dia: 80, hr: 71, bs: 109 },
    { sys: 122, dia: 82, hr: 74, bs: 113 },
    { sys: 120, dia: 80, hr: 72, bs: 110 },
    { sys: 121, dia: 79, hr: 73, bs: 111 }
  ];

  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    metrics.push({
      systolic_bp: baseBP[i].sys,
      diastolic_bp: baseBP[i].dia,
      heart_rate: baseBP[i].hr,
      blood_sugar: baseBP[i].bs,
      date: d.toISOString(),
      user_id: 1
    });
  }

  const { error: healthError } = await supabase.from("health_metrics").upsert(metrics);
  if (healthError) {
    console.error("Error seeding health metrics:", healthError);
  } else {
    console.log("Seeded default health metrics successfully.");
  }

  // 5. Seed expenses
  const expenses = [
    { hospital: "Apollo Hospital", description: "Consultation", amount: 500.0, date: "20 May 2026", user_id: 1 },
    { hospital: "City Hospital", description: "Blood Test", amount: 1200.0, date: "18 May 2026", user_id: 1 },
    { hospital: "Sunrise Hospital", description: "X-Ray", amount: 800.0, date: "15 May 2026", user_id: 1 },
    { hospital: "Apollo Hospital", description: "Cardiology Treatment", amount: 4750.0, date: "10 May 2026", user_id: 1 }
  ];

  const { error: expError } = await supabase.from("expenses").upsert(expenses);
  if (expError) {
    console.error("Error seeding expenses:", expError);
  } else {
    console.log("Seeded default expenses successfully.");
  }

  // 6. Seed messages
  const messages = [
    { sender: "user", content: "I have headache and mild fever since yesterday.", user_id: 1 },
    { sender: "ai", content: "It could be due to a mild viral infection, stress, or lack of sleep. Make sure to:\n• Drink warm water\n• Rest well\n• Take Paracetamol if needed\n• Consult a doctor if fever continues\n\nHow can I help you next?", user_id: 1 }
  ];

  const { error: msgError } = await supabase.from("messages").upsert(messages);
  if (msgError) {
    console.error("Error seeding messages:", msgError);
  } else {
    console.log("Seeded default messages successfully.");
  }

  console.log("Supabase database seeding completed successfully!");
}

seed();
