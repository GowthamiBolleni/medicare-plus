import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import { Activity, Plus, Heart, HeartPulse, ShieldAlert, Sparkles } from "lucide-react";
import { healthAPI } from "../api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function HealthTracker() {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("Week"); // Day, Week, Month, Year
  
  // Log Metric State
  const [newLog, setNewLog] = useState({
    systolic_bp: 120,
    diastolic_bp: 80,
    heart_rate: 72,
    blood_sugar: 110,
  });

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const res = await healthAPI.getMetrics();
      setMetrics(res);
    } catch (err) {
      console.error("Error loading health metrics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const handleLogMetric = async (e) => {
    e.preventDefault();
    try {
      const res = await healthAPI.logMetric(newLog);
      setMetrics([...metrics, res]);
      alert("Health metrics logged successfully!");
      setNewLog({
        systolic_bp: 120,
        diastolic_bp: 80,
        heart_rate: 72,
        blood_sugar: 110,
      });
    } catch (err) {
      console.error("Error logging metrics", err);
    }
  };

  // Prepare Chart Data
  const labels = metrics.map((m) => {
    const d = new Date(m.date);
    return d.toLocaleDateString("en-US", { weekday: "short" });
  });

  const bpData = {
    labels: labels.length > 0 ? labels : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [
      {
        label: "Systolic BP",
        data: metrics.map((m) => m.systolic_bp),
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.05)",
        fill: true,
        tension: 0.35,
        pointRadius: 4,
      },
      {
        label: "Diastolic BP",
        data: metrics.map((m) => m.diastolic_bp),
        borderColor: "#6d7ef2",
        backgroundColor: "rgba(109, 126, 242, 0.05)",
        fill: true,
        tension: 0.35,
        pointRadius: 4,
      },
    ],
  };

  const hrData = {
    labels: labels.length > 0 ? labels : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [
      {
        label: "Heart Rate (BPM)",
        data: metrics.map((m) => m.heart_rate),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.05)",
        fill: true,
        tension: 0.35,
        pointRadius: 4,
      },
    ],
  };

  const sugarData = {
    labels: labels.length > 0 ? labels : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [
      {
        label: "Blood Sugar (mg/dl)",
        data: metrics.map((m) => m.blood_sugar),
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245, 158, 11, 0.05)",
        fill: true,
        tension: 0.35,
        pointRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { font: { family: "Outfit" } } },
      tooltip: { enabled: true },
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: "#f1f5f9" } },
    },
  };

  return (
    <div className="p-8 space-y-8 font-sans max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight font-sans">Health Tracker</h1>
          <p className="text-slate-500 mt-1 text-sm font-sans">Monitor vital metrics and analyze physiological trends.</p>
        </div>

        {/* Timeframe Selector tabs */}
        <div className="bg-slate-100 p-1 rounded-xl flex gap-1 self-start sm:self-center">
          {["Day", "Week", "Month", "Year"].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 font-sans ${
                timeframe === tf ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Logs line charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* BP Line Graph */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-premium flex flex-col justify-between h-80">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-sans">Vital Metric</h3>
                <h2 className="text-lg font-bold text-slate-800 font-sans">Blood Pressure</h2>
              </div>
              <span className="text-xs font-bold bg-success-50 text-success-600 border border-success-100 px-3 py-1 rounded-lg">
                Normal
              </span>
            </div>
            <div className="flex-1 min-h-0">
              {loading ? (
                <div className="h-full bg-slate-100 rounded-xl animate-pulse"></div>
              ) : (
                <Line data={bpData} options={options} />
              )}
            </div>
          </div>

          {/* Heart Rate Line Graph */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-premium flex flex-col justify-between h-80">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-sans">Vital Metric</h3>
                <h2 className="text-lg font-bold text-slate-800 font-sans">Heart Rate</h2>
              </div>
              <span className="text-xs font-bold bg-success-50 text-success-600 border border-success-100 px-3 py-1 rounded-lg">
                Normal
              </span>
            </div>
            <div className="flex-1 min-h-0">
              {loading ? (
                <div className="h-full bg-slate-100 rounded-xl animate-pulse"></div>
              ) : (
                <Line data={hrData} options={options} />
              )}
            </div>
          </div>

          {/* Blood Sugar Graph */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-premium flex flex-col justify-between h-80">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-sans">Vital Metric</h3>
                <h2 className="text-lg font-bold text-slate-800 font-sans">Blood Sugar</h2>
              </div>
              <span className="text-xs font-bold bg-success-50 text-success-600 border border-success-100 px-3 py-1 rounded-lg">
                Normal
              </span>
            </div>
            <div className="flex-1 min-h-0">
              {loading ? (
                <div className="h-full bg-slate-100 rounded-xl animate-pulse"></div>
              ) : (
                <Line data={sugarData} options={options} />
              )}
            </div>
          </div>
        </div>

        {/* Right column: Logging form */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-premium h-fit space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <HeartPulse className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-bold text-slate-800 font-sans">Log Today's Vitals</h2>
          </div>

          <form onSubmit={handleLogMetric} className="space-y-4 font-sans text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">BP (Systolic)</label>
                <input
                  type="number"
                  value={newLog.systolic_bp}
                  onChange={(e) => setNewLog({ ...newLog, systolic_bp: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">BP (Diastolic)</label>
                <input
                  type="number"
                  value={newLog.diastolic_bp}
                  onChange={(e) => setNewLog({ ...newLog, diastolic_bp: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Heart Rate</label>
                <input
                  type="number"
                  value={newLog.heart_rate}
                  onChange={(e) => setNewLog({ ...newLog, heart_rate: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Blood Sugar</label>
                <input
                  type="number"
                  value={newLog.blood_sugar}
                  onChange={(e) => setNewLog({ ...newLog, blood_sugar: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl mt-4 shadow-md hover:shadow-lg transition-all duration-200 font-sans cursor-pointer"
            >
              Log Vital Record
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
