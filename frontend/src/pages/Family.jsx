import React, { useEffect, useState } from "react";
import { Users, Plus, ShieldCheck, HeartPulse, Heart, Trash2, X } from "lucide-react";
import { familyAPI } from "../api";
const getRelationEmoji = (relation) => {
  const r = relation ? relation.toLowerCase() : "";
  if (r.includes("mother") || r.includes("parent")) return "👩";
  if (r.includes("father")) return "👨";
  if (r.includes("spouse") || r.includes("wife") || r.includes("husband")) return "💑";
  if (r.includes("daughter")) return "👧";
  if (r.includes("son")) return "👦";
  if (r.includes("brother") || r.includes("sister") || r.includes("sibling")) return "🧑";
  return "👤";
};

export default function Family() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // New Member Form State
  const [newMember, setNewMember] = useState({
    name: "",
    relation: "Spouse",
    phone: "",
    is_emergency_contact: false,
    age: "",
    health_score: 95,
  });

  const loadMembers = async () => {
    try {
      setLoading(true);
      const res = await familyAPI.getAll();
      setMembers(res);
    } catch (err) {
      console.error("Error loading family members", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const handleLinkAccount = async (e) => {
    e.preventDefault();
    if (!newMember.name || !newMember.age) {
      return alert("Please specify the family member name and age.");
    }

    try {
      const res = await familyAPI.create(newMember);
      setMembers([...members, res]);
      setShowModal(false);
      setNewMember({
        name: "",
        relation: "Spouse",
        phone: "",
        is_emergency_contact: false,
        age: "",
        health_score: 95,
      });
    } catch (err) {
      console.error("Error linking family member account", err);
    }
  };

  const handleUnlinkMember = async (id) => {
    if (!window.confirm("Are you sure you want to unlink this family member's health account?")) return;
    try {
      setMembers(members.filter(m => m.id !== id));
      await familyAPI.delete(id);
    } catch (err) {
      console.error("Error unlinking member", err);
      loadMembers();
    }
  };

  return (
    <div className="p-8 space-y-8 font-sans max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight font-sans">Family Accounts</h1>
          <p className="text-slate-500 mt-1 text-sm font-sans">Switch between family members to manage their medication schedules.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-md smooth-hover flex items-center gap-2 font-sans"
        >
          <Plus className="w-4 h-4" /> Link Account
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-slate-100 rounded-3xl"></div>
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-premium flex flex-col items-center justify-center p-6">
          <Users className="w-12 h-12 text-slate-300 mb-3.5" />
          <h3 className="text-base font-bold text-slate-600 font-sans">No Family Accounts Linked</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed font-sans text-center">
            You haven't linked any family member profiles yet. Manage your household's active context side-by-side.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {members.map((member) => (
            <div
              key={member.id}
              className="bg-white border border-slate-100 rounded-3xl p-5 shadow-premium flex flex-col justify-between hover-glow smooth-hover text-center min-h-[260px]"
            >
              <div className="space-y-4 flex flex-col items-center relative">
                {/* Delete button absolute corner */}
                <button
                  onClick={() => handleUnlinkMember(member.id)}
                  className="absolute top-0 right-0 p-1 text-slate-300 hover:text-emergency-500 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="w-16 h-16 rounded-full overflow-hidden border border-slate-100 relative shadow-md bg-slate-50 flex items-center justify-center text-3xl shrink-0">
                  {member.image ? (
                    <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="select-none">{getRelationEmoji(member.relation)}</span>
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-800 font-sans flex items-center justify-center gap-1.5">
                    {getRelationEmoji(member.relation)} {member.name}
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                    Relation: {member.relation} · {member.age} Yrs
                  </span>
                  {member.phone && (
                    <span className="text-xs text-slate-600 block font-sans font-medium">
                      Phone: {member.phone}
                    </span>
                  )}
                  {member.is_emergency_contact && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emergency-600 bg-emergency-50 border border-emergency-100 px-2 py-0.5 rounded-lg mt-1.5 uppercase tracking-wide animate-pulse">
                      🚨 Emergency Contact
                    </span>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-50 pt-4 mt-6 flex justify-between items-center w-full">
                <span className="text-xs text-slate-400 font-semibold flex items-center gap-1 font-sans">
                  <Heart className="w-4 h-4 text-emergency-500 fill-current" /> Vitals
                </span>
                <span className="text-sm font-bold text-slate-800 font-sans flex items-center gap-1.5">
                  {member.health_score}% <span className="text-[10px] font-semibold text-success-500">Good</span>
                </span>
              </div>

              <button
                onClick={() => alert(`Active context switched to ${member.name}. Now managing their health records.`)}
                className="w-full bg-slate-50 text-slate-600 font-bold py-2 rounded-xl text-xs font-sans mt-4 hover:bg-slate-100 smooth-hover cursor-pointer"
              >
                Switch Account
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Link Account Modal Panel */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto animate-slide-up relative">
            <X
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 cursor-pointer text-slate-400 hover:text-slate-600 smooth-hover w-5 h-5"
            />

            <h3 className="text-lg font-bold text-slate-800 font-sans mb-5">Link Family Profile</h3>

            <form onSubmit={handleLinkAccount} className="space-y-4 font-sans text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Family Member Name</label>
                <input
                  type="text"
                  placeholder="e.g., Ramesh Kumar"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Relation</label>
                  <select
                    value={newMember.relation}
                    onChange={(e) => setNewMember({ ...newMember, relation: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
                  >
                    <option value="Spouse">Spouse</option>
                    <option value="Daughter">Daughter</option>
                    <option value="Son">Son</option>
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Sibling">Sibling</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Age (Years)</label>
                  <input
                    type="number"
                    placeholder="e.g., 34"
                    value={newMember.age}
                    onChange={(e) => setNewMember({ ...newMember, age: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Est. Health Score (%)</label>
                <input
                  type="number"
                  placeholder="e.g., 95"
                  value={newMember.health_score}
                  onChange={(e) => setNewMember({ ...newMember, health_score: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Phone Number</label>
                <input
                  type="text"
                  placeholder="Phone Number"
                  value={newMember.phone}
                  onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_emergency_contact"
                  checked={newMember.is_emergency_contact}
                  onChange={(e) => setNewMember({ ...newMember, is_emergency_contact: e.target.checked })}
                  className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500 cursor-pointer"
                />
                <label htmlFor="is_emergency_contact" className="text-xs font-bold text-slate-500 uppercase tracking-wide cursor-pointer select-none">
                  Emergency Contact
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 rounded-xl mt-6 shadow-md hover:shadow-lg transition-all duration-200 font-sans cursor-pointer"
              >
                Link Family Account
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
