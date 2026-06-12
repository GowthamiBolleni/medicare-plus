import React, { useState, useEffect } from "react";
import { AlertOctagon, Phone, Share2, Users, Navigation, ShieldAlert, CheckCircle } from "lucide-react";
import { emergencyAPI, hospitalsAPI, familyAPI } from "../api";

function HospitalCard({ name, distance, phone }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-50 hover:bg-slate-50/50 transition-colors">
      <div>
        <h4 className="text-xs font-bold text-slate-800 font-sans">{name}</h4>
        <span className="text-[9px] font-bold text-slate-400 mt-0.5 block font-sans">
          Distance · {distance}
        </span>
      </div>
      <a
        href={`tel:${phone || "108"}`}
        className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 hover:text-brand-600 hover:bg-brand-50 flex items-center justify-center transition-colors border border-slate-100"
      >
        <Phone className="w-4 h-4" />
      </a>
    </div>
  );
}

export default function Emergency() {
  const [sosStatus, setSosStatus] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sosLoading, setSosLoading] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState([]);

  useEffect(() => {
    const fetchEmergencyContacts = async () => {
      try {
        const res = await familyAPI.getAll();
        setEmergencyContacts(res.filter(m => m.is_emergency_contact));
      } catch (err) {
        console.error("Error loading emergency contacts", err);
      }
    };
    fetchEmergencyContacts();
  }, []);

  const loadHospitals = async (lat = null, lng = null) => {
    try {
      setLoading(true);
      let res;
      if (lat !== null && lng !== null) {
        res = await hospitalsAPI.getNearby(lat, lng);
      } else {
        res = await emergencyAPI.getNearestHospitals();
      }
      setHospitals(res);
    } catch (err) {
      console.error("Error loading hospitals", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          loadHospitals(position.coords.latitude, position.coords.longitude);
        },
        () => {
          loadHospitals();
        },
        { timeout: 5000 }
      );
    } else {
      loadHospitals();
    }
  }, []);

  const handleTriggerSOS = async () => {
    if (sosLoading) return;
    setSosLoading(true);
    setSosStatus("SENDING");
    
    const sendSOS = async (lat, lon) => {
      try {
        const res = await emergencyAPI.triggerSOS(lat, lon);
        setSosStatus(res);

        // Frontend deep links (SMS/WhatsApp) removed. Alert dispatching is handled locally on the dashboard.
      } catch (err) {
        console.error("Error triggering SOS", err);
        const errMsg = err.response?.data?.detail || "Failed to dispatch SOS alerts. Please call local emergency services directly.";
        setSosStatus({
          status: "FAILED",
          message: errMsg
        });
      } finally {
        setTimeout(() => {
          setSosLoading(false);
        }, 5000);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          sendSOS(position.coords.latitude, position.coords.longitude);
        },
        () => {
          sendSOS();
        },
        { timeout: 5000 }
      );
    } else {
      sendSOS();
    }
  };

  return (
    <div className="p-8 space-y-8 font-sans max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight font-sans">Emergency Center</h1>
        <p className="text-slate-500 mt-1 text-sm font-sans">
          Immediate alerts, direct dispatch hotlines, and partnered medical institutes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* SOS Panel */}
        <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-premium flex flex-col items-center justify-between text-center min-h-[350px]">
          <div>
            <h2 className="text-lg font-bold text-slate-800 font-sans">Emergency SOS Panics</h2>
            <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed font-sans">
              Tap the button to instantly alert family members and dispatch local ambulance services with your GPS.
            </p>
          </div>

          {/* Pulsing SOS Button */}
          <button
            onClick={handleTriggerSOS}
            disabled={sosLoading || sosStatus === "SENDING"}
            className={`w-36 h-36 rounded-full bg-emergency-100 flex items-center justify-center border-4 border-white shadow-2xl relative transition-all duration-300 ${
              sosLoading || sosStatus === "SENDING" ? "scale-95 opacity-80" : "hover:scale-105 active:scale-95 cursor-pointer"
            }`}
          >
            <div className="absolute inset-0 rounded-full bg-emergency-500 animate-ping opacity-25"></div>
            <div className="w-28 h-28 rounded-full bg-emergency-500 border border-emergency-600 flex items-center justify-center text-white font-extrabold text-2xl font-sans tracking-wider shadow-inner">
              SOS
            </div>
          </button>

          {/* SOS active pane response */}
          {sosStatus && (
            <div
              className={`p-4 rounded-2xl w-full text-xs font-bold font-sans ${
                sosStatus === "SENDING"
                  ? "bg-slate-50 text-slate-500"
                  : sosStatus.status === "TRIGGERED"
                  ? "bg-emergency-50 text-emergency-600 border border-emergency-100 animate-pulse"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {sosStatus === "SENDING" ? (
                "Broadcasting SOS signals..."
              ) : sosStatus.status === "TRIGGERED" ? (
                <div className="flex gap-2.5 items-start text-left">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <div>
                    <span className="font-extrabold block">AMBULANCE ALERTS DISPATCHED!</span>
                    <span className="font-medium text-[10px] text-slate-500 mt-1 block leading-relaxed">
                      {sosStatus.message}
                    </span>
                  </div>
                </div>
              ) : (
                sosStatus.message
              )}
            </div>
          )}
        </div>

        {/* Quick action buttons and hospitals */}
        <div className="space-y-6 flex flex-col justify-between">
          {/* Action widgets grid */}
          <div className="grid grid-cols-3 gap-4">
            <a
              href="tel:102"
              className="bg-white border border-slate-100 rounded-2xl p-4 shadow-premium hover-glow smooth-hover text-center flex flex-col items-center justify-center gap-2 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-emergency-50 text-emergency-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Phone className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-bold text-slate-700 font-sans uppercase">Ambulance</span>
            </a>

            <div
              onClick={() => alert("Location shared with emergency contacts.")}
              className="bg-white border border-slate-100 rounded-2xl p-4 shadow-premium hover-glow smooth-hover text-center flex flex-col items-center justify-center gap-2 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Navigation className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-bold text-slate-700 font-sans uppercase">Share GPS</span>
            </div>

            <div
              onClick={() => alert("Simulated SMS alerts dispatched to Family Group.")}
              className="bg-white border border-slate-100 rounded-2xl p-4 shadow-premium hover-glow smooth-hover text-center flex flex-col items-center justify-center gap-2 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Users className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-bold text-slate-700 font-sans uppercase">Contacts</span>
            </div>
          </div>

          {/* Partnered Nearest Hospitals list */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-premium flex-1">
            <h3 className="text-sm font-bold text-slate-800 font-sans mb-4">Partnered Clinics nearby</h3>

            {loading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2].map((i) => (
                  <div key={i} className="h-10 bg-slate-100 rounded-lg"></div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {hospitals.map((hospital, idx) => (
                  <HospitalCard
                    key={idx}
                    name={hospital.name}
                    distance={hospital.distance}
                    phone={hospital.phone}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
