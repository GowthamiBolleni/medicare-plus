import React, { useState, useEffect } from "react";
import { 
  Bell, 
  Settings as SettingsIcon,
  ShieldAlert, 
  Pill, 
  FileText, 
  Calendar,
  Smartphone,
  Copy,
  Check,
  Send
} from "lucide-react";
import { notificationsAPI } from "../api";
import NotificationService from "../services/NotificationService";

export default function Settings() {
  const [prefs, setPrefs] = useState({
    medicine_reminders_enabled: true,
    sos_enabled: true,
    appointment_reminders_enabled: true,
    report_notifications_enabled: true,
    push_notifications_enabled: true
  });
  const [fcmStatus, setFcmStatus] = useState({
    permission: "default",
    token: null
  });
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [testStatus, setTestStatus] = useState("");

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const data = await notificationsAPI.getPreferences();
      setPrefs(data);
    } catch (err) {
      console.error("Failed to load notification preferences:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreferences();
    // Update local FCM status indicators
    setFcmStatus({
      permission: typeof Notification !== "undefined" ? Notification.permission : "unsupported",
      token: localStorage.getItem("medicare_fcm_token")
    });
  }, []);

  const handleToggle = async (key) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    setSaving(true);
    setSuccessMsg("");
    try {
      await notificationsAPI.updatePreferences(updated);
      setSuccessMsg("Preferences updated successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Failed to update preferences:", err);
      // Revert on error
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPermission = async () => {
    setSuccessMsg("");
    try {
      const res = await NotificationService.requestPermission();
      setFcmStatus({
        permission: res.status,
        token: res.token
      });
      if (res.status === "granted") {
        setSuccessMsg("Push notifications permission granted!");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      console.error("Error setting up permission:", err);
    }
  };

  const handleSendTest = async () => {
    setTestStatus("sending");
    setSuccessMsg("");
    try {
      await NotificationService.sendTestNotification();
      setTestStatus("success");
      setSuccessMsg("Test notification sent! Check your notification feeds.");
      setTimeout(() => {
        setTestStatus("");
        setSuccessMsg("");
      }, 4000);
    } catch (err) {
      console.error("Failed to dispatch test notification:", err);
      setTestStatus("error");
      setTimeout(() => setTestStatus(""), 3000);
    }
  };

  const copyToClipboard = () => {
    if (!fcmStatus.token) return;
    navigator.clipboard.writeText(fcmStatus.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPermissionLabel = (perm) => {
    switch (perm) {
      case "granted":
        return <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">Granted</span>;
      case "denied":
        return <span className="px-2 py-0.5 text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full">Denied</span>;
      case "default":
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">Not Requested</span>;
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent flex items-center gap-2">
          <SettingsIcon className="h-7 w-7 text-rose-500" />
          Notification Settings
        </h1>
        <p className="text-slate-400 mt-1">
          Configure how you want to be reminded of medical events and manage push device tokens.
        </p>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-950/30 border border-emerald-900/50 rounded-xl text-emerald-400 text-xs text-center transition animate-fade-in">
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="h-64 bg-slate-900/50 border border-slate-850 rounded-2xl animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Preferences Settings (Toggles) */}
          <div className="md:col-span-2 bg-slate-900/40 border border-slate-850 rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Bell className="h-5 w-5 text-rose-400" />
              Alert Preferences
            </h2>

            <div className="space-y-4">
              
              {/* Medicine Reminders Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-850/30 border border-slate-800/60 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-lg mt-0.5">
                    <Pill className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white">Medicine Reminders</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Receive reminders when scheduled medication times arrive.</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleToggle("medicine_reminders_enabled")}
                  className={`w-11 h-6 rounded-full transition duration-200 relative ${
                    prefs.medicine_reminders_enabled ? "bg-rose-500" : "bg-slate-700"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all duration-200 ${
                    prefs.medicine_reminders_enabled ? "left-6" : "left-1"
                  }`} />
                </button>
              </div>

              {/* SOS Alerts Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-850/30 border border-slate-800/60 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg mt-0.5">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white">SOS Broadcasts</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Trigger real-time push alerts to your contacts in an emergency.</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleToggle("sos_enabled")}
                  className={`w-11 h-6 rounded-full transition duration-200 relative ${
                    prefs.sos_enabled ? "bg-rose-500" : "bg-slate-700"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all duration-200 ${
                    prefs.sos_enabled ? "left-6" : "left-1"
                  }`} />
                </button>
              </div>

              {/* Appointment Reminders Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-850/30 border border-slate-800/60 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-lg mt-0.5">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white">Appointment Reminders</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Receive alerts before doctor appointments.</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleToggle("appointment_reminders_enabled")}
                  className={`w-11 h-6 rounded-full transition duration-200 relative ${
                    prefs.appointment_reminders_enabled ? "bg-rose-500" : "bg-slate-700"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all duration-200 ${
                    prefs.appointment_reminders_enabled ? "left-6" : "left-1"
                  }`} />
                </button>
              </div>

              {/* Report Notifications Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-850/30 border border-slate-800/60 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg mt-0.5">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white">Report Notifications</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Receive alerts when lab report analysis has compiled.</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleToggle("report_notifications_enabled")}
                  className={`w-11 h-6 rounded-full transition duration-200 relative ${
                    prefs.report_notifications_enabled ? "bg-rose-500" : "bg-slate-700"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all duration-200 ${
                    prefs.report_notifications_enabled ? "left-6" : "left-1"
                  }`} />
                </button>
              </div>

              {/* Master Push Switch */}
              <div className="flex items-center justify-between p-4 bg-slate-850/30 border border-slate-800/60 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-700/50 border border-slate-650 text-slate-400 rounded-lg mt-0.5">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white">Master Push Status</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Enable or disable all browser/device push channels instantly.</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleToggle("push_notifications_enabled")}
                  className={`w-11 h-6 rounded-full transition duration-200 relative ${
                    prefs.push_notifications_enabled ? "bg-rose-500" : "bg-slate-700"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all duration-200 ${
                    prefs.push_notifications_enabled ? "left-6" : "left-1"
                  }`} />
                </button>
              </div>

            </div>
          </div>

          {/* FCM Token & Device Status Panel */}
          <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-6 space-y-6 flex flex-col justify-between">
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Smartphone className="h-5 w-5 text-rose-400" />
                Device Status
              </h2>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>Browser Permission</span>
                  {getPermissionLabel(fcmStatus.permission)}
                </div>

                {fcmStatus.permission !== "granted" && (
                  <button
                    onClick={handleRequestPermission}
                    className="w-full py-2 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-rose-500/25 transition"
                  >
                    Grant Permissions
                  </button>
                )}

                {fcmStatus.token && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>FCM Token Status</span>
                      <span className="text-emerald-400 font-semibold text-[10px] uppercase">Active</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 bg-slate-950/80 border border-slate-800 rounded-lg">
                      <input 
                        type="text" 
                        readOnly 
                        value={`${fcmStatus.token.substring(0, 16)}...`}
                        className="bg-transparent border-none text-[11px] text-slate-400 font-mono focus:outline-none flex-grow"
                      />
                      <button
                        onClick={copyToClipboard}
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
                        title="Copy full token"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Test Action */}
            <div className="border-t border-slate-800 pt-4 mt-6">
              <button
                disabled={!fcmStatus.token || testStatus === "sending"}
                onClick={handleSendTest}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-750 disabled:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 hover:border-slate-650 text-slate-200 font-medium text-xs rounded-xl transition"
              >
                <Send className="h-3.5 w-3.5" />
                {testStatus === "sending" ? "Sending Test..." : "Send Test Notification"}
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
