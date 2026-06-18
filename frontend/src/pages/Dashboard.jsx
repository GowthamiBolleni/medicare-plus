import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Heart,
  Pill,
  Calendar,
  Wallet,
  ArrowRight,
  TrendingUp,
  MapPin,
  Clock,
  ChevronRight,
  BellRing,
  Users,
  FileClock,
  FileText,
  X
} from "lucide-react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import { dashboardAPI, medicinesAPI, notificationsAPI } from "../api";

// Register ChartJS modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const parseSOSMessage = (msg) => {
  let hospital = "Apollo Hospital";
  let contactName = "Emergency Dispatcher";
  let phone = "+91 98765 43210";

  const hospMatch = msg.match(/Nearest Hospital:\s*(.*?)\s*has been notified/);
  if (hospMatch) {
    hospital = hospMatch[1];
  }

  const contactsMatch = msg.match(/Alerts sent to emergency contacts:\s*(.*)/);
  if (contactsMatch) {
    const rawContacts = contactsMatch[1].replace(/\.$/, "");
    const contactParts = rawContacts.split(/,\s*/);
    if (contactParts.length > 0) {
      const firstContact = contactParts[0];
      const detailsMatch = firstContact.match(/^(.*?):\s*(\+?\d[\d\s]+)/);
      if (detailsMatch) {
        contactName = detailsMatch[1];
        phone = detailsMatch[2].trim();
      } else {
        const statusMatch = firstContact.match(/^(.*?):\s*(.*?)(\s*\[.*\])?$/);
        if (statusMatch) {
          contactName = statusMatch[1];
          phone = statusMatch[2].trim();
        }
      }
    }
  }

  return { hospital, contactName, phone };
};

function AlertCard({ message, created_at, notification_type }) {
  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    } catch (e) {
      return "";
    }
  };

  const isSOS = notification_type === "sos";

  if (isSOS) {
    const { hospital, contactName, phone } = parseSOSMessage(message);
    return (
      <div className="p-4 rounded-2xl bg-emergency-50/75 border border-emergency-200/50 hover:bg-emergency-50 transition-all duration-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-emergency-600 font-extrabold text-xs tracking-wider uppercase font-sans">
          <span>🚨</span> EMERGENCY SOS TRIGGERED
        </div>
        <div className="grid grid-cols-2 gap-3 text-left">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 font-sans block">Hospital</span>
            <span className="text-xs font-semibold text-slate-800 font-sans">{hospital}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 font-sans block">Time</span>
            <span className="text-xs font-semibold text-slate-800 font-sans">{formatTime(created_at)}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 font-sans block">Contact Notified</span>
            <span className="text-xs font-semibold text-slate-800 font-sans">{contactName}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 font-sans block">Phone</span>
            <span className="text-xs font-bold text-emergency-600 font-sans">{phone}</span>
          </div>
        </div>
      </div>
    );
  }

  let emoji = "🔔";
  let cardClass = "bg-brand-50/30 border-brand-100/50 hover:bg-brand-50/50 text-brand-600";

  if (notification_type === "medicine") {
    emoji = "💊";
    cardClass = "bg-orange-50/30 border-orange-100/50 hover:bg-orange-50/50 text-orange-600";
  } else if (notification_type === "appointment") {
    emoji = "📅";
    cardClass = "bg-indigo-50/30 border-indigo-100/50 hover:bg-indigo-50/50 text-indigo-600";
  } else if (notification_type === "expense") {
    emoji = "💰";
    cardClass = "bg-amber-50/30 border-amber-100/50 hover:bg-amber-50/50 text-amber-600";
  }

  return (
    <div className={`flex gap-3.5 items-start p-3.5 rounded-xl border transition-all duration-200 shadow-sm ${cardClass}`}>
      <div className="w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center shrink-0 shadow-sm">
        <span className="text-base">{emoji}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-800 font-sans leading-relaxed">{message}</p>
        {created_at && (
          <span className="text-[10px] text-slate-400 mt-1 block font-sans font-medium">
            {formatTime(created_at)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({ profile }) {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [data, setData] = useState({
    health_score: 82,
    medicines_to_take: 3,
    appointments_today: 1,
    monthly_expenses: 7250.0,
    medicines: 0,
    appointments: 0,
    expenses: 0.0,
    today_medicines: [],
    upcoming_appointment: null,
    recent_alerts: [],
    recent_metrics: [],
    all_expenses: [],
    health_score_status: "Good",
    health_score_trend: { this_week: 82, last_week: 80, change: 2, text: "" },
    category_expenses: [],
    family_contacts_count: 0,
    medical_conditions_count: 0
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await dashboardAPI.getSummary();
      setData(res);
      const notifs = await notificationsAPI.getAll();
      setNotifications(notifs);
    } catch (err) {
      console.error("Error loading dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      const res = await dashboardAPI.getSummary();
      setData(res);
      const notifs = await notificationsAPI.getAll();
      setNotifications(notifs);
    } catch (err) {
      console.error("Error refreshing dashboard data", err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      refreshData();
    }, 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const toggleMedicineTaken = async (id, currentStatus) => {
    const nextStatus = currentStatus === "Taken" ? "Upcoming" : "Taken";
    try {
      // Optimistic update
      const updatedMeds = data.today_medicines.map((m) =>
        m.id === id ? { ...m, status: nextStatus } : m
      );
      setData((prev) => ({
        ...prev,
        today_medicines: updatedMeds,
        medicines_to_take: updatedMeds.filter((m) => m.status !== "Taken").length
      }));
      
      await medicinesAPI.updateStatus(id, nextStatus);
      await refreshData();
    } catch (err) {
      console.error("Error updating medicine status", err);
      loadData(); // rollback
    }
  };

  // Health Overview Charts Configuration - Completely dynamic based on user vitals logs
  const metricsAvailable = data.recent_metrics && data.recent_metrics.length > 0;
  const bpLabels = metricsAvailable
    ? data.recent_metrics.map(m => {
        const d = new Date(m.date);
        return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
      })
    : ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
  const bpSystolicData = metricsAvailable
    ? data.recent_metrics.map(m => m.systolic_bp || 120)
    : [120, 124, 126, 128, 125, 122, 120];
  const bpDiastolicData = metricsAvailable
    ? data.recent_metrics.map(m => m.diastolic_bp || 80)
    : [80, 82, 84, 85, 83, 81, 80];

  const bpChartData = {
    labels: bpLabels,
    datasets: [
      {
        label: "Systolic",
        data: bpSystolicData,
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.05)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
      },
      {
        label: "Diastolic",
        data: bpDiastolicData,
        borderColor: "#6d7ef2",
        backgroundColor: "rgba(109, 126, 242, 0.05)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { display: false }, min: 50, max: 180 }
    }
  };

  // Category Expense Overview Chart Config - Completely dynamic based on billing logs
  const expensesAvailable = data.all_expenses && data.all_expenses.length > 0;
  const categoriesAvailable = data.category_expenses && data.category_expenses.length > 0;

  const expenseLabels = categoriesAvailable
    ? data.category_expenses.map(c => c.category)
    : ["Consultation", "Blood Test", "ECG", "Medicines"];
  const expenseData = categoriesAvailable
    ? data.category_expenses.map(c => c.amount)
    : [500, 1200, 800, 650];

  const expensesChartData = {
    labels: expenseLabels,
    datasets: [
      {
        label: "Expenses",
        data: expenseData,
        backgroundColor: "#6d7ef2",
        borderRadius: 8,
        barThickness: 24
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { display: false } }
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-slate-200 rounded-2xl"></div>
          <div className="h-96 bg-slate-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 font-sans max-w-7xl mx-auto">
      {/* Greetings Area */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight font-sans">
          Good Morning, {profile?.full_name || "Medicare User"} 👋
        </h1>
        <p className="text-slate-500 mt-1 text-sm font-sans">
          Take care of your health, we are here to help you.
        </p>
      </div>

      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
        {/* Card 1: Health Score */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-premium flex items-center gap-4 hover-glow smooth-hover min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emergency-50 flex items-center justify-center text-emergency-500 shrink-0">
            <Heart className="w-5.5 h-5.5 fill-current" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-sans truncate">Health Score</h3>
            <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
              <span className="text-xl font-bold text-slate-800 font-sans">{data.health_score}/100</span>
              <span className={`text-[10px] font-bold font-sans ${
                data.health_score_status === "Excellent" ? "text-success-500" :
                data.health_score_status === "Good" ? "text-brand-500" :
                data.health_score_status === "Fair" ? "text-amber-500" : "text-emergency-500"
              }`}>
                {data.health_score_status || "Good"}
              </span>
            </div>
            {data.health_score_trend?.text && (
              <p className="text-[9px] text-slate-500 mt-1 font-medium font-sans leading-tight">
                {data.health_score_trend.text}
              </p>
            )}
          </div>
        </div>

        {/* Card 2: Today's Medicines */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-premium flex items-center gap-4 hover-glow smooth-hover min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
            <Pill className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-sans truncate">Today's Meds</h3>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-slate-800 font-sans">{data.medicines_to_take ?? 0}</span>
              <span className="text-[10px] font-semibold text-slate-400 font-sans">
                Remaining
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Appointments */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-premium flex items-center gap-4 hover-glow smooth-hover min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
            <Calendar className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-sans truncate">Appointments</h3>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-slate-800 font-sans">{data.appointments ?? 0}</span>
              <span className="text-[10px] font-semibold text-brand-600 font-sans">
                Total
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Monthly Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-premium flex items-center gap-4 hover-glow smooth-hover min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
            <Wallet className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-sans truncate">Monthly Expenses</h3>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-slate-800 font-sans">₹{(data.expenses ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Card 5: Family Contacts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-premium flex items-center gap-4 hover-glow smooth-hover min-w-0">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
            <Users className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-sans truncate">Family Contacts</h3>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-slate-800 font-sans">{data.family_contacts_count ?? 0}</span>
              <span className="text-[10px] font-semibold text-teal-600 font-sans">
                Saved
              </span>
            </div>
          </div>
        </div>

        {/* Card 6: Medical Conditions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-premium flex items-center gap-4 hover-glow smooth-hover min-w-0">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <FileClock className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-sans truncate">Medical Conditions</h3>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-slate-800 font-sans">{data.medical_conditions_count ?? 0}</span>
              <span className="text-[10px] font-semibold text-rose-600 font-sans">
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Card 7: Medical Reports */}
        <Link to="/reports" className="bg-white p-5 rounded-2xl border border-slate-100 shadow-premium flex items-center gap-4 hover-glow smooth-hover min-w-0 cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-650 shrink-0">
            <FileText className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-sans truncate">Medical Reports</h3>
            <div className="mt-1 space-y-0.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] font-semibold text-slate-500 font-sans">Total</span>
                <span className="text-xs font-bold text-slate-800 font-sans">{data.total_reports_uploaded ?? 0}</span>
              </div>
              {data.abnormal_findings_count > 0 && (
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9px] font-medium text-emergency-500 font-sans">Abnormal</span>
                  <span className="text-xs font-bold text-emergency-600 font-sans">{data.abnormal_findings_count}</span>
                </div>
              )}
              {data.reports_requiring_attention > 0 && (
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9px] font-medium text-amber-500 font-sans">Attention</span>
                  <span className="text-xs font-bold text-amber-600 font-sans">{data.reports_requiring_attention}</span>
                </div>
              )}
              {data.latest_report_date && (
                <p className="text-[8px] text-slate-400 font-sans truncate mt-1">
                  Latest: {data.latest_report_date}
                </p>
              )}
            </div>
          </div>
        </Link>
      </div>

      {/* Middle Row Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Today's Medicines list */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-premium flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800 font-sans">Today's Medicines</h2>
              <Link
                to="/medicines"
                className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 hover:underline font-sans"
              >
                View all medicines <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="space-y-4">
              {data.today_medicines.map((med) => (
                <div
                  key={med.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-slate-50 hover:bg-slate-50/50 smooth-hover"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      med.status === "Taken"
                        ? "bg-success-50 text-success-500"
                        : med.status === "Missed"
                        ? "bg-rose-50 text-rose-500"
                        : "bg-orange-50 text-orange-500"
                    }`}>
                      <Pill className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 font-sans">{med.name}</h4>
                      <p className="text-xs text-slate-400 font-sans mt-0.5">
                        {med.dosage} - {med.instructions}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1 font-sans">
                      <Clock className="w-3.5 h-3.5" /> {
                        med.time && med.time.includes(":") && !med.time.toUpperCase().includes("AM") && !med.time.toUpperCase().includes("PM")
                          ? new Date(`1970-01-01T${med.time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
                          : med.time
                      }
                    </span>
                    <button
                      onClick={() => toggleMedicineTaken(med.id, med.status)}
                      className={`text-xs font-bold px-4 py-2 rounded-xl transition-all duration-200 ${
                        med.status === "Taken"
                          ? "bg-success-50 text-success-600 hover:bg-success-100/70"
                          : med.status === "Missed"
                          ? "bg-rose-50 text-rose-600 hover:bg-rose-100/70"
                          : "bg-brand-50 text-brand-600 hover:bg-brand-100/70"
                      }`}
                    >
                      {med.status === "Taken" ? "Taken" : med.status === "Missed" ? "Missed" : "Upcoming"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Upcoming Appointment card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-premium flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 font-sans mb-5">Upcoming Appointment</h2>
            {data.upcoming_appointment ? (
              <div className="space-y-5">
                <div className="rounded-xl overflow-hidden aspect-[16/9] relative border border-slate-100">
                  <img
                    src="https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=400&h=225&fit=crop"
                    alt="Hospital consult"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2.5 py-1 rounded-lg text-[10px] font-bold text-brand-600 border border-slate-100 uppercase font-sans">
                    Cardio Check
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-800 font-sans">
                    {data.upcoming_appointment.hospital}
                  </h3>
                  <p className="text-xs text-slate-500 font-sans mt-0.5">
                    {data.upcoming_appointment.doctor} ({data.upcoming_appointment.specialty})
                  </p>
                </div>

                <div className="flex items-center gap-6 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 font-sans font-medium">
                    <Calendar className="w-4 h-4 text-slate-400" /> {data.upcoming_appointment.date}
                  </span>
                  <span className="flex items-center gap-1.5 font-sans font-medium">
                    <Clock className="w-4 h-4 text-slate-400" /> {data.upcoming_appointment.time}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-sm text-slate-400 font-sans">No upcoming appointments</div>
            )}
          </div>

          <Link
            to="/appointments"
            className="w-full bg-slate-50 text-slate-700 font-bold py-3 text-center rounded-xl hover:bg-slate-100 smooth-hover text-xs font-sans mt-6 block"
          >
            View Details
          </Link>
        </div>
      </div>

      {/* Bottom Charts & Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Blood Pressure tracker Line Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-premium flex flex-col gap-4 min-w-0">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-sans">Health Overview</h2>
                <h3 className="text-xl font-bold text-slate-800 font-sans mt-0.5">Blood Pressure</h3>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border font-sans ${
                !metricsAvailable ? "bg-slate-50 text-slate-400 border-slate-100" :
                (data.recent_metrics[data.recent_metrics.length - 1].systolic_bp > 130 || 
                 data.recent_metrics[data.recent_metrics.length - 1].diastolic_bp > 90) ? "bg-emergency-50 text-emergency-600 border-emergency-100" :
                "bg-success-50 text-success-600 border-success-100"
              }`}>
                {!metricsAvailable ? "N/A" :
                 (data.recent_metrics[data.recent_metrics.length - 1].systolic_bp > 130 || 
                  data.recent_metrics[data.recent_metrics.length - 1].diastolic_bp > 90) ? "High BP" : "Normal"}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 my-3">
              <span className="text-2xl font-bold text-slate-800 font-sans">
                {metricsAvailable ? `${data.recent_metrics[data.recent_metrics.length - 1].systolic_bp}/${data.recent_metrics[data.recent_metrics.length - 1].diastolic_bp}` : "0/0"}
              </span>
              <span className="text-xs text-slate-400 font-sans">mmHg</span>
            </div>
          </div>
          <div className="h-44 flex flex-col justify-end">
            {metricsAvailable ? (
              <Line data={bpChartData} options={chartOptions} />
            ) : (
              <div className="h-[140px] flex flex-col items-center justify-center text-center p-4 bg-slate-50/50 border border-dashed border-slate-100 rounded-2xl">
                <p className="text-xs font-bold text-slate-400 font-sans">No BP records logged yet.</p>
                <Link to="/health-tracker" className="text-[10px] text-brand-600 hover:underline font-extrabold mt-1.5 font-sans uppercase tracking-wider block">Log BP Vitals</Link>
              </div>
            )}
          </div>
        </div>

        {/* Expense overview Bar Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-premium flex flex-col gap-4 min-w-0">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-sans">Category Expense Overview</h2>
                <h3 className="text-xl font-bold text-slate-800 font-sans mt-0.5">₹{(data.expenses ?? 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">Total</span></h3>
              </div>
              {(data.expenses ?? 0) > 0 && (
                <span className="text-xs text-success-500 font-semibold flex items-center gap-0.5 font-sans">
                  <TrendingUp className="w-3.5 h-3.5" /> Active
                </span>
              )}
            </div>
          </div>
          <div className="h-44 flex flex-col justify-end">
            {expensesAvailable || categoriesAvailable ? (
              <Bar data={expensesChartData} options={barChartOptions} />
            ) : (
              <div className="h-[140px] flex flex-col items-center justify-center text-center p-4 bg-slate-50/50 border border-dashed border-slate-100 rounded-2xl">
                <p className="text-xs font-bold text-slate-400 font-sans">No expenses logged yet.</p>
                <Link to="/bills-expenses" className="text-[10px] text-brand-600 hover:underline font-extrabold mt-1.5 font-sans uppercase tracking-wider block">Log Expense Receipt</Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-premium flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800 font-sans">Recent Alerts</h2>
              <span onClick={() => setShowAllAlerts(true)} className="text-xs font-bold text-brand-600 hover:underline cursor-pointer font-sans">View all</span>
            </div>

            <div className="space-y-4">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 font-sans">
                  No active alerts
                </div>
              ) : (
                notifications.slice(0, 4).map((notification, idx) => (
                  <AlertCard
                    key={notification.id || idx}
                    message={notification.message}
                    created_at={notification.created_at}
                    notification_type={notification.notification_type}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showAllAlerts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowAllAlerts(false)}
          ></div>
          
          {/* Modal Container */}
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto flex flex-col gap-4 animate-scale-up z-10">
            <div className="flex items-center justify-between border-b border-slate-50 pb-4">
              <h2 className="text-lg font-bold text-slate-800 font-sans">All Health Alerts</h2>
              <button 
                onClick={() => setShowAllAlerts(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 py-2">
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-400 font-sans">
                  No alerts logged yet
                </div>
              ) : (
                notifications.map((notification, idx) => (
                  <AlertCard
                    key={notification.id || idx}
                    message={notification.message}
                    created_at={notification.created_at}
                    notification_type={notification.notification_type}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
