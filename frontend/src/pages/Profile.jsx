import React, { useEffect, useState } from "react";
import { User, Weight, Ruler, Calendar, Heart, ShieldAlert, CheckCircle2, Award, Sparkles } from "lucide-react";
import api, { authAPI } from "../api";

export default function Profile({ onLogout, onProfileUpdate }) {
  const [profile, setProfile] = useState({
    username: "",
    email: "",
    full_name: "",
    health_score: 0,
    weight: 0,
    height: 0,
    age: 0,
    gender: "",
    phone: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.error("Signout error:", err);
    }
    if (onLogout) {
      onLogout();
    } else {
      window.location.reload();
    }
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get("/profile");
      if (res.data) {
        setProfile({
          username: res.data.username || "",
          email: res.data.email || "",
          full_name: res.data.full_name || "",
          health_score: res.data.health_score || 0,
          weight: res.data.weight || 0,
          height: res.data.height || 0,
          age: res.data.age || 0,
          gender: res.data.gender || "",
          phone: res.data.phone || "",
        });
      }
    } catch (err) {
      console.error("Error loading user profile", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSaveSuccess(false);
      const res = await api.put("/profile", {
        full_name: profile.full_name,
        weight: parseFloat(profile.weight) || 0.0,
        height: parseFloat(profile.height) || 0.0,
        age: parseInt(profile.age) || 0,
        gender: profile.gender,
        phone: profile.phone,
      });
      setProfile(res.data);
      setSaveSuccess(true);
      if (onProfileUpdate) {
        onProfileUpdate(res.data);
      }
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving profile details", err);
      alert("Failed to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  // Dynamic calculations: BMI
  const hasVitals = profile.weight > 0 && profile.height > 0;
  const heightInMeters = profile.height / 100;
  const bmi = hasVitals ? (profile.weight / (heightInMeters * heightInMeters)).toFixed(1) : "N/A";
  
  // Dynamic predictions based on BMI
  let bmiCategory = "Unknown";
  let bmiColor = "text-slate-600 bg-slate-50 border-slate-100";
  let predictionText = "Please complete your profile details to see dynamic BMI calculations and health predictions.";

  if (hasVitals) {
    const bmiVal = parseFloat(bmi);
    if (bmiVal < 18.5) {
      bmiCategory = "Underweight";
      bmiColor = "text-warning-600 bg-warning-50 border-warning-100";
      predictionText = "Your BMI is under 18.5, indicating you are underweight. Consider consults with clinical dieticians for structured nutrient plans (+2 daily compliance required).";
    } else if (bmiVal >= 25 && bmiVal < 30) {
      bmiCategory = "Overweight";
      bmiColor = "text-orange-600 bg-orange-50 border-orange-100";
      predictionText = "Your BMI indicates you are in the overweight range. Consider reducing daily sodium and complex sugars to improve your blood pressure score, and track heart rate logs!";
    } else if (bmiVal >= 30) {
      bmiCategory = "Obese";
      bmiColor = "text-emergency-600 bg-emergency-50 border-emergency-100";
      predictionText = "Clinical Alert: Your BMI indicates obesity. We highly recommend booking a consultation with Dr. Sharma (Cardiologist) to inspect arterial health and vital parameters.";
    } else {
      bmiCategory = "Normal Weight";
      bmiColor = "text-success-600 bg-success-50 border-success-100";
      predictionText = "Excellent! Your BMI is in the normal range. Your predicted health score remains high (+5 compliance bonus). Keep up the healthy choices!";
    }
  }

  // Dynamic daily water intake calculation: weight * 35 ml
  const waterIntake = hasVitals ? ((profile.weight * 35) / 1000).toFixed(1) : null;
  const isProfileIncomplete = !profile.full_name || !profile.age || !profile.gender || !profile.weight || !profile.height;

  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-pulse max-w-4xl mx-auto">
        <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-44 bg-slate-200 rounded-2xl md:col-span-1"></div>
          <div className="h-80 bg-slate-200 rounded-2xl md:col-span-2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 font-sans max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight font-sans">User Profile</h1>
        <p className="text-slate-500 mt-1 text-sm font-sans">
          Manage height, weight, and vital stats for custom health calculations.
        </p>
      </div>

      {isProfileIncomplete && (
        <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-2xl flex items-center gap-3 font-sans text-sm animate-fade-in shadow-sm">
          <ShieldAlert className="w-5 h-5 text-orange-600 flex-shrink-0" />
          <div>
            <span className="font-bold">Please complete your profile</span>. Fill in your details below to get customized health prediction, water target, and BMI calculation.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Left Column: Avatar & Dynamic BMI calculations Card */}
        <div className="md:col-span-1 space-y-6">
          {/* Avatar widget */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-premium text-center space-y-4">
            <div className="w-20 h-20 rounded-full overflow-hidden border border-slate-100 mx-auto">
              <img
                src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=faces"
                alt={profile.full_name || "User avatar"}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 font-sans">{profile.full_name || "Anonymous"}</h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1 block">
                {profile.gender || "No Gender"} · {profile.age ? `${profile.age} Yrs` : "No Age"} {profile.phone && `· ${profile.phone}`}
              </span>
            </div>
            <div className="border-t border-slate-50 pt-4 flex justify-between items-center w-full">
              <span className="text-xs text-slate-400 font-semibold font-sans">Health Score</span>
              <span className="text-sm font-extrabold text-slate-800 font-sans">{profile.health_score}/100</span>
            </div>
          </div>

          {/* Dynamic BMI widget */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-premium space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-brand-600" />
              <h3 className="text-sm font-bold text-slate-800 font-sans">Dynamic Predictions</h3>
            </div>
            
            <div className="flex justify-between items-center bg-slate-50/70 p-3 rounded-xl border border-slate-50">
              <span className="text-xs text-slate-500 font-semibold font-sans">Calculated BMI</span>
              <div className="text-right">
                <span className="text-base font-extrabold text-slate-800 font-sans">{bmi}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider block mt-1 px-2 py-0.5 rounded border font-sans text-center md:inline-block md:ml-2 align-middle max-w-fit mx-auto md:mx-0 leading-none min-h-0 bg-white shadow-sm font-semibold text-slate-600">
                  {bmiCategory}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center bg-slate-50/70 p-3 rounded-xl border border-slate-50">
              <span className="text-xs text-slate-500 font-semibold font-sans">Daily Hydration</span>
              <span className="text-sm font-extrabold text-slate-800 font-sans">{waterIntake ? `${waterIntake} Litres` : "N/A"}</span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed font-sans italic bg-brand-50/30 p-3 rounded-xl border border-brand-100/50">
              {predictionText}
            </p>
          </div>
        </div>

        {/* Right Column: Profile Edit Form */}
        <form onSubmit={handleSave} className="md:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-premium space-y-6">
          <h3 className="text-base font-bold text-slate-800 font-sans flex items-center gap-2 pb-3 border-b border-slate-50">
            <User className="w-5 h-5 text-brand-600" /> General Demographics
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="fullName" className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Full Name</label>
              <input
                id="fullName"
                type="text"
                value={profile.full_name || ""}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Email Address</label>
              <input
                id="email"
                type="email"
                value={profile.email || ""}
                disabled
                className="w-full bg-slate-100 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none text-slate-400 font-medium cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="age" className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Age</label>
              <input
                id="age"
                type="number"
                value={profile.age || ""}
                onChange={(e) => setProfile({ ...profile, age: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
              />
            </div>
            <div>
              <label htmlFor="gender" className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Gender</label>
              <select
                id="gender"
                value={profile.gender || ""}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
              >
                <option value="">Select Gender</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-Binary">Non-Binary</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="mobile" className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Mobile Number</label>
              <input
                id="mobile"
                type="tel"
                placeholder="e.g. +91 98765 43210"
                value={profile.phone || ""}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
              />
            </div>
          </div>

          <h3 className="text-base font-bold text-slate-800 font-sans flex items-center gap-2 pb-3 pt-3 border-b border-slate-50">
            <Ruler className="w-5 h-5 text-brand-600" /> Physical Vitals
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="weight" className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Weight className="w-3.5 h-3.5 text-slate-400" /> Body Weight (kg)
              </label>
              <input
                id="weight"
                type="number"
                step="0.1"
                value={profile.weight || ""}
                onChange={(e) => setProfile({ ...profile, weight: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
              />
            </div>
            <div>
              <label htmlFor="height" className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Ruler className="w-3.5 h-3.5 text-slate-400" /> Body Height (cm)
              </label>
              <input
                id="height"
                type="number"
                step="0.1"
                value={profile.height || ""}
                onChange={(e) => setProfile({ ...profile, height: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-medium"
              />
            </div>
          </div>

          {saveSuccess && (
            <p className="text-xs text-success-600 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-success-500" /> Demographics saved, vital parameters updated dynamically.
            </p>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 font-sans cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving Details..." : "Save Demographics"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-6 bg-slate-55 hover:bg-slate-100 text-slate-500 hover:text-slate-800 font-bold py-3.5 rounded-xl border border-slate-100 transition-all duration-200 font-sans cursor-pointer flex items-center justify-center gap-1.5"
            >
              Sign Out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
