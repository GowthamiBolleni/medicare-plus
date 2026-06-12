import React, { useState, useEffect, useRef } from "react";
import { Pill, Plus, Trash2, Clock, Check, Calendar, HelpCircle, PlusCircle, X } from "lucide-react";
import api, { medicinesAPI } from "../api";

export default function Medicines({ profile, onProfileUpdate }) {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const remindedRef = useRef({});
  const [activeTab, setActiveTab] = useState("All"); // All, Taken, Upcoming, Missed
  


  // New Medicine Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [newMed, setNewMed] = useState({
    name: "",
    dosage: "1 Tablet",
    instructions: "After Food",
    time: "08:00",
    category: "Tablet",
  });

  const loadMedicines = async () => {
    try {
      setLoading(true);
      const res = await medicinesAPI.getAll();
      setMedicines(res);
    } catch (err) {
      console.error("Error loading medicines", err);
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    loadMedicines();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentTime = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).toUpperCase();

      const today = new Date().toDateString();

      medicines.forEach((med) => {
        if (!med.time) return;

        let medicineTime;
        if (med.time.includes(":") && !med.time.toUpperCase().includes("AM") && !med.time.toUpperCase().includes("PM")) {
          medicineTime = new Date(`1970-01-01T${med.time}`)
            .toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })
            .toUpperCase();
        } else {
          medicineTime = med.time.trim().toUpperCase();
        }

        const key = `${med.id}-${medicineTime}-${today}`;

        console.log(
          "Checking:",
          med.name,
          medicineTime,
          currentTime,
          med.status
        );

        if (
          (med.status || "").toLowerCase() === "upcoming" &&
          medicineTime === currentTime &&
          !remindedRef.current[key]
        ) {
          remindedRef.current[key] = true;
          if (Notification.permission === "granted") {
            new Notification("Medicine Reminder", {
              body: `Time to take ${med.name}`,
            });
          }
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [medicines]);

  useEffect(() => {
    if (
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }
  }, []);



  const handleToggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === "Taken" ? "Upcoming" : "Taken";
    try {
      // Optimistic update
      setMedicines(medicines.map(m => m.id === id ? { ...m, status: nextStatus } : m));
      await medicinesAPI.updateStatus(id, nextStatus);
    } catch (err) {
      console.error("Error changing status", err);
      loadMedicines();
    }
  };

  const handleDeleteMedicine = async (id) => {
    if (!window.confirm("Are you sure you want to remove this medication?")) return;
    try {
      setMedicines(medicines.filter(m => m.id !== id));
      await medicinesAPI.delete(id);
    } catch (err) {
      console.error("Error deleting medicine", err);
      loadMedicines();
    }
  };

  const handleAddMedicine = async (e) => {
    e.preventDefault();
    if (!newMed.name) return alert("Please specify the medicine name.");
    try {
      const res = await medicinesAPI.create(newMed);
      setMedicines(prev => [...prev, res]);
      setShowModal(false);
      setNewMed({
        name: "",
        dosage: "1 Tablet",
        instructions: "After Food",
        time: "08:00",
        category: "Tablet",
      });
    } catch (err) {
      console.error("Error adding medicine", err);
    }
  };

  const filteredMedicines = medicines.filter((m) => {
    if (activeTab === "All") return true;
    return m.status === activeTab;
  });

  return (
    <div className="p-8 space-y-8 font-sans max-w-5xl mx-auto animate-fade-in">
      {/* Header and Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight font-sans">Medication Scheduler</h1>
          <p className="text-slate-500 mt-1 text-sm font-sans">Manage your daily reminders and logs.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-md smooth-hover flex items-center gap-2 font-sans"
        >
          <Plus className="w-4 h-4" /> Add Medicine
        </button>
      </div>



      {/* Tabs list */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-8 -mb-px">
          {["All", "Taken", "Upcoming", "Missed"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-4 text-sm font-bold border-b-2 transition-all duration-200 font-sans ${
                activeTab === tab
                  ? "border-brand-500 text-brand-600 font-sans"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab} Reminders
            </button>
          ))}
        </nav>
      </div>

      {/* Scheduler Lists */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl"></div>
          ))}
        </div>
      ) : filteredMedicines.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-premium flex flex-col items-center justify-center">
          <Pill className="w-12 h-12 text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-slate-600 font-sans">No medicines in this category</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed font-sans">
            Add a new prescription using the button in the top right to start tracking.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredMedicines.map((med) => (
            <div
              key={med.id}
              className={`p-5 bg-white border rounded-2xl shadow-premium hover-glow smooth-hover flex items-start justify-between gap-4 ${
                med.status === "Taken" ? "border-success-100" : med.status === "Missed" ? "border-rose-100" : "border-slate-100"
              }`}
            >
              <div className="flex gap-4">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    med.status === "Taken"
                      ? "bg-success-50 text-success-500"
                      : med.status === "Missed"
                      ? "bg-rose-50 text-rose-500"
                      : "bg-orange-50 text-orange-500"
                  }`}
                >
                  <Pill className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-sans">{med.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 font-sans">
                    {med.dosage} · {med.instructions}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-3 font-semibold font-sans">
                    <Clock className="w-3.5 h-3.5" /> {
                      med.time && med.time.includes(":") && !med.time.toUpperCase().includes("AM") && !med.time.toUpperCase().includes("PM")
                        ? new Date(`1970-01-01T${med.time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
                        : med.time
                    }
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3.5 justify-between h-full">
                <button
                  onClick={() => handleToggleStatus(med.id, med.status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                    med.status === "Taken"
                      ? "bg-success-50 text-success-600 hover:bg-success-100"
                      : med.status === "Missed"
                      ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                      : "bg-brand-50 text-brand-600 hover:bg-brand-100"
                  }`}
                >
                  {med.status === "Taken" ? "Taken" : med.status === "Missed" ? "Missed" : "Upcoming"}
                </button>
                <button
                  onClick={() => handleDeleteMedicine(med.id)}
                  className="p-1.5 text-slate-300 hover:text-emergency-500 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Medicine Modal Panel */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto animate-slide-up relative">
            <X
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 cursor-pointer text-slate-400 hover:text-slate-600 smooth-hover w-5 h-5"
            />

            <h3 className="text-lg font-bold text-slate-800 font-sans mb-5">Add New Prescription</h3>

            <form onSubmit={handleAddMedicine} className="space-y-4 font-sans text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Medicine Name</label>
                <input
                  type="text"
                  placeholder="e.g., Paracetamol 500mg"
                  value={newMed.name}
                  onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Dosage</label>
                  <input
                    type="text"
                    value={newMed.dosage}
                    onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Category</label>
                  <select
                    value={newMed.category}
                    onChange={(e) => setNewMed({ ...newMed, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Injection">Injection</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Time Schedule</label>
                  <input
                    type="time"
                    value={newMed.time}
                    onChange={(e) => setNewMed({ ...newMed, time: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Instructions</label>
                  <select
                    value={newMed.instructions}
                    onChange={(e) => setNewMed({ ...newMed, instructions: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
                  >
                    <option value="After Food">After Food</option>
                    <option value="Before Food">Before Food</option>
                    <option value="With Food">With Food</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-50 pt-4">
                <p className="text-xs text-slate-500 font-sans leading-relaxed">
                  📱 Browser notifications will automatically be sent for this medicine.
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 rounded-xl mt-4 shadow-md hover:shadow-lg transition-all duration-200 font-sans cursor-pointer"
              >
                Schedule Medicine
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
