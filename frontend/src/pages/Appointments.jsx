import React, { useState, useEffect } from "react";
import { Calendar, Clock, MapPin, Plus, Trash2, ShieldAlert, Award, X, Sparkles } from "lucide-react";
import { appointmentsAPI } from "../api";

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Upcoming");
  
  // Book Appointment State
  const [showModal, setShowModal] = useState(false);
  const [newAppt, setNewAppt] = useState({
    hospital: "Apollo Hospital",
    doctor: "Dr. Sharma",
    specialty: "Cardiologist",
    date: new Date().toISOString().split("T")[0],
    time: "11:00",
    description: "",
  });

  const doctorsList = [
    { name: "Dr. Sharma", specialty: "Cardiologist", hospital: "Apollo Hospital" },
    { name: "Dr. Mehta", specialty: "Neurologist", hospital: "City Hospital" },
    { name: "Dr. Patel", specialty: "Orthopedic", hospital: "Sunrise Hospital" },
  ];

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const res = await appointmentsAPI.getAll();
      setAppointments(res);
    } catch (err) {
      console.error("Error loading appointments", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    try {
      // Find matching doctor specialty and hospital details
      const doc = doctorsList.find((d) => d.name === newAppt.doctor) || doctorsList[0];
      const payload = {
        ...newAppt,
        specialty: doc.specialty,
        hospital: doc.hospital,
      };
      const res = await appointmentsAPI.book(payload);
      setAppointments([...appointments, res]);
      setShowModal(false);
      setNewAppt({
        hospital: "Apollo Hospital",
        doctor: "Dr. Sharma",
        specialty: "Cardiologist",
        date: new Date().toISOString().split("T")[0],
        time: "11:00",
        description: "",
      });
    } catch (err) {
      console.error("Error booking appointment", err);
    }
  };

  const handleCancelAppointment = async (id) => {
    if (!window.confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      setAppointments(appointments.filter((a) => a.id !== id));
      await appointmentsAPI.cancel(id);
    } catch (err) {
      console.error("Error cancelling appointment", err);
      loadAppointments();
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === "Completed" ? "Upcoming" : "Completed";
    try {
      // Optimistic update
      setAppointments(appointments.map(a => a.id === id ? { ...a, status: nextStatus } : a));
      await appointmentsAPI.update(id, { status: nextStatus });
    } catch (err) {
      console.error("Error changing appointment status", err);
      loadAppointments();
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch (e) {
      return dateStr;
    }
  };

  const filteredAppts = appointments.filter((a) => {
    if (activeTab === "All") return true;
    return a.status === activeTab;
  });

  return (
    <div className="p-8 space-y-8 font-sans max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight font-sans">Appointments Planner</h1>
          <p className="text-slate-500 mt-1 text-sm font-sans">Track and book consultations with specialist medical staff.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-md smooth-hover flex items-center gap-2 font-sans"
        >
          <Sparkles className="w-4 h-4" /> Book Appointment
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-8 -mb-px">
          {["All", "Upcoming", "Completed", "Missed"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-4 text-sm font-bold border-b-2 transition-all duration-200 font-sans ${
                activeTab === tab
                  ? "border-brand-500 text-brand-600 font-sans"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab} Consultations
            </button>
          ))}
        </nav>
      </div>

      {/* Listings */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-44 bg-slate-100 rounded-2xl"></div>
          ))}
        </div>
      ) : filteredAppts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-premium flex flex-col items-center justify-center">
          <Calendar className="w-12 h-12 text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-slate-600 font-sans">No consultations scheduled</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed font-sans">
            Schedule a session at one of our partnered medical institutes today.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredAppts.map((appt) => (
            <div
              key={appt.id}
              className={`bg-white border rounded-2xl p-5 shadow-premium flex flex-col justify-between hover-glow smooth-hover ${
                appt.status === "Completed"
                  ? "border-success-100"
                  : appt.status === "Missed"
                  ? "border-rose-100"
                  : "border-slate-100"
              }`}
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <div className="flex gap-2 items-center flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-2 py-0.5 rounded-lg font-sans">
                        {appt.specialty}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg font-sans ${
                        appt.status === "Completed"
                          ? "text-success-600 bg-success-50"
                          : appt.status === "Missed"
                          ? "text-rose-600 bg-rose-50"
                          : "text-indigo-600 bg-indigo-50"
                      }`}>
                        {appt.status}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-800 mt-1.5 font-sans">
                      {appt.doctor}
                    </h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1 font-sans">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {appt.hospital}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl border border-slate-100 overflow-hidden shrink-0">
                    <img
                      src={`https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=100&h=100&fit=crop`}
                      alt="Doctor profile"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {appt.description && (
                  <p className="text-xs text-slate-500 leading-relaxed font-sans italic bg-slate-50/50 p-2.5 rounded-xl border border-slate-50">
                    "{appt.description}"
                  </p>
                )}

                <div className="flex items-center gap-5 text-xs text-slate-400 border-t border-slate-50 pt-4">
                  <span className="flex items-center gap-1.5 font-medium font-sans">
                    <Calendar className="w-4 h-4 text-slate-400" /> {formatDate(appt.date)}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium font-sans">
                    <Clock className="w-4 h-4 text-slate-400" /> {appt.time}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => handleToggleStatus(appt.id, appt.status)}
                  className={`flex-1 font-bold py-2.5 rounded-xl text-xs font-sans transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    appt.status === "Completed"
                      ? "bg-indigo-50 hover:bg-indigo-100 text-indigo-600"
                      : "bg-success-50 hover:bg-success-100 text-success-600"
                  }`}
                >
                  {appt.status === "Completed" ? "Mark as Incomplete" : "Mark as Completed"}
                </button>
                <button
                  onClick={() => handleCancelAppointment(appt.id)}
                  className="bg-slate-50 hover:bg-emergency-50 hover:text-emergency-600 text-slate-400 p-2.5 rounded-xl transition-all duration-200"
                  title="Cancel Appointment"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Book Appointment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto animate-slide-up relative">
            <X
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 cursor-pointer text-slate-400 hover:text-slate-600 smooth-hover w-5 h-5"
            />

            <h3 className="text-lg font-bold text-slate-800 font-sans mb-5 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-500" /> Schedule Clinical Session
            </h3>

            <form onSubmit={handleBookAppointment} className="space-y-4 font-sans text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Select Doctor</label>
                <select
                  value={newAppt.doctor}
                  onChange={(e) => {
                    const doc = doctorsList.find((d) => d.name === e.target.value);
                    setNewAppt({
                      ...newAppt,
                      doctor: e.target.value,
                      hospital: doc.hospital,
                      specialty: doc.specialty,
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
                >
                  {doctorsList.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name} ({d.specialty}) – {d.hospital}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Consultation Date</label>
                  <input
                    type="date"
                    value={newAppt.date}
                    onChange={(e) => setNewAppt({ ...newAppt, date: e.target.value })}
                    onClick={(e) => e.target.showPicker()}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Consultation Time</label>
                  <input
                    type="time"
                    value={newAppt.time}
                    onChange={(e) => setNewAppt({ ...newAppt, time: e.target.value })}
                    onClick={(e) => e.target.showPicker()}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Reason for Visit</label>
                <textarea
                  placeholder="Describe your symptoms or objectives..."
                  value={newAppt.description}
                  onChange={(e) => setNewAppt({ ...newAppt, description: e.target.value })}
                  rows="3"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 rounded-xl mt-6 shadow-md hover:shadow-lg transition-all duration-200 font-sans"
              >
                Confirm Appointment
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
