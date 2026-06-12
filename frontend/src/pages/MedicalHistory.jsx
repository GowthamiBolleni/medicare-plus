import React, { useEffect, useState } from "react";
import { FileClock, Trash2, Plus, Calendar, ShieldCheck, HelpCircle, X } from "lucide-react";
import { medicalHistoryAPI } from "../api";

export default function MedicalHistory() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // New Record Form State
  const [newRec, setNewRec] = useState({
    condition: "",
    diagnosis_date: new Date().toISOString().split("T")[0],
    status: "Active",
    notes: "",
  });

  const loadRecords = async () => {
    try {
      setLoading(true);
      const res = await medicalHistoryAPI.getAll();
      setRecords(res);
    } catch (err) {
      console.error("Error loading medical records", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleAddRecord = async (e) => {
    e.preventDefault();
    if (!newRec.condition || !newRec.diagnosis_date || !newRec.status) {
      return alert("Please fill in condition, date and status.");
    }

    try {
      const res = await medicalHistoryAPI.create(newRec);
      setRecords([...records, res]);
      setShowModal(false);
      setNewRec({
        condition: "",
        diagnosis_date: new Date().toISOString().split("T")[0],
        status: "Active",
        notes: "",
      });
    } catch (err) {
      console.error("Error saving medical history record", err);
    }
  };

  const handleDeleteRecord = async (id) => {
    if (!window.confirm("Are you sure you want to remove this medical review log?")) return;
    try {
      setRecords(records.filter(r => r.id !== id));
      await medicalHistoryAPI.delete(id);
    } catch (err) {
      console.error("Error deleting record", err);
      loadRecords();
    }
  };

  return (
    <div className="p-8 space-y-8 font-sans max-w-5xl mx-auto animate-fade-in">
      {/* Header and Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight font-sans">Medical History</h1>
          <p className="text-slate-500 mt-1 text-sm font-sans">Access clinical reviews, diagnoses, and past laboratory transcripts.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-md smooth-hover flex items-center gap-2 font-sans"
        >
          <Plus className="w-4 h-4" /> Log History
        </button>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-2xl"></div>
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-premium flex flex-col items-center justify-center p-6">
          <FileClock className="w-12 h-12 text-slate-300 mb-3.5" />
          <h3 className="text-base font-bold text-slate-600 font-sans">No Medical Records Logged</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed font-sans text-center">
            You haven't logged any clinical reviews or hospital diagnoses yet. Add your clinical review summary.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {records.map((rec) => (
            <div
              key={rec.id}
              className="bg-white border border-slate-100 rounded-2xl p-6 shadow-premium hover-glow smooth-hover flex flex-col sm:flex-row justify-between sm:items-center gap-6"
            >
              <div className="flex gap-4 items-start">
                <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 border border-brand-100">
                  <FileClock className="w-5.5 h-5.5" />
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg font-sans">
                      Diagnosis Date: {rec.diagnosis_date}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg font-sans ${
                      rec.status === "Active" ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                    }`}>
                      {rec.status}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-800 font-sans">
                    {rec.condition}
                  </h3>
                  {rec.notes && (
                    <p className="text-xs text-slate-500 font-sans">
                      <span className="font-semibold text-slate-600">Notes:</span> {rec.notes}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleDeleteRecord(rec.id)}
                className="px-4 py-2.5 rounded-xl border border-slate-100 hover:border-emergency-100 text-xs font-bold text-slate-400 hover:text-emergency-600 hover:bg-emergency-50/50 flex items-center justify-center gap-2 transition-all duration-200 shrink-0 self-start sm:self-center cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Remove Log
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Record Modal Panel */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto animate-slide-up relative">
            <X
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 cursor-pointer text-slate-400 hover:text-slate-600 smooth-hover w-5 h-5"
            />

            <h3 className="text-lg font-bold text-slate-800 font-sans mb-5">Add Medical History</h3>

            <form onSubmit={handleAddRecord} className="space-y-4 font-sans text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Condition</label>
                <input
                  type="text"
                  placeholder="e.g., Diabetes"
                  value={newRec.condition}
                  onChange={(e) => setNewRec({ ...newRec, condition: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Diagnosis Date</label>
                  <input
                    type="date"
                    value={newRec.diagnosis_date}
                    onChange={(e) => setNewRec({ ...newRec, diagnosis_date: e.target.value })}
                    onClick={(e) => e.target.showPicker()}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Status</label>
                  <select
                    value={newRec.status}
                    onChange={(e) => setNewRec({ ...newRec, status: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
                  >
                    <option value="Active">Active</option>
                    <option value="Recovered">Recovered</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Notes</label>
                <textarea
                  placeholder="e.g., Taking insulin daily"
                  value={newRec.notes}
                  onChange={(e) => setNewRec({ ...newRec, notes: e.target.value })}
                  rows="3"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 rounded-xl mt-6 shadow-md hover:shadow-lg transition-all duration-200 font-sans cursor-pointer"
              >
                Save
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
