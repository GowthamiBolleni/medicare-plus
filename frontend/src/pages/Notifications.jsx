import React, { useState, useEffect } from "react";
import { 
  Bell, 
  Trash2, 
  Check, 
  Pill, 
  AlertOctagon, 
  Info, 
  FileText,
  Filter,
  CheckCheck,
  Calendar,
  ArrowUpDown
} from "lucide-react";
import { notificationsAPI, medicinesAPI } from "../api";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all"); // all, unread, read, medicine, sos, appointment, system
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortOrder, setSortOrder] = useState("desc"); // desc, asc
  const [actionStates, setActionStates] = useState({}); // id -> "taken" | "snoozed" | "dismissed"

  const loadNotifications = async () => {
    setLoading(true);
    setError("");
    try {
      let typeParam = null;
      let readParam = null;

      if (activeFilter === "unread") readParam = false;
      else if (activeFilter === "read") readParam = true;
      else if (activeFilter !== "all") typeParam = activeFilter;

      const data = await notificationsAPI.getAll(typeParam, readParam);
      setNotifications(data);
    } catch (err) {
      console.error("Failed to load notifications history:", err);
      setError("Unable to retrieve notification history. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [activeFilter]);

  const handleMarkRead = async (id) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications(prev => 
        prev.map(item => item.id === id ? { ...item, read: true, status: "Read" } : item)
      );
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationsAPI.delete(id);
      setNotifications(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const unreadList = notifications.filter(n => !n.read);
      await Promise.all(unreadList.map(n => notificationsAPI.markRead(n.id)));
      setNotifications(prev => prev.map(item => ({ ...item, read: true, status: "Read" })));
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to permanently clear all notifications?")) return;
    try {
      await notificationsAPI.clearAll();
      setNotifications([]);
    } catch (err) {
      console.error("Failed to clear notifications:", err);
    }
  };

  const handleTakeMed = async (notifId, logId) => {
    try {
      await medicinesAPI.takeLog(logId);
      setActionStates(prev => ({ ...prev, [notifId]: "taken" }));
      await handleMarkRead(notifId);
    } catch (err) {
      console.error("Failed to mark medicine as taken:", err);
    }
  };

  const handleSnoozeMed = async (notifId, logId) => {
    try {
      await medicinesAPI.snoozeLog(logId);
      setActionStates(prev => ({ ...prev, [notifId]: "snoozed" }));
      await handleMarkRead(notifId);
    } catch (err) {
      console.error("Failed to snooze medicine:", err);
    }
  };

  const handleDismissMed = async (notifId, logId) => {
    try {
      await medicinesAPI.dismissLog(logId);
      setActionStates(prev => ({ ...prev, [notifId]: "dismissed" }));
      await handleMarkRead(notifId);
    } catch (err) {
      console.error("Failed to dismiss medicine:", err);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case "medicine":
        return <Pill className="h-5 w-5 text-rose-500" />;
      case "sos":
        return <AlertOctagon className="h-5 w-5 text-red-500 animate-pulse" />;
      case "appointment":
        return <Calendar className="h-5 w-5 text-blue-500" />;
      case "report":
        return <FileText className="h-5 w-5 text-violet-500" />;
      case "system":
      default:
        return <Info className="h-5 w-5 text-emerald-500" />;
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const sortedNotifications = [...notifications].sort((a, b) => {
    const dateA = new Date(a.created_at);
    const dateB = new Date(b.created_at);
    return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
  });

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 font-sans">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 flex items-center gap-2.5 font-sans">
            Notification Center
          </h1>
          <p className="text-slate-500 mt-1 text-sm font-sans flex items-center flex-wrap gap-2">
            Stay updated with real-time medicine schedules, emergency logs, and system alerts.
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200 rounded-full font-sans">
                {unreadCount} Unread
              </span>
            )}
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex gap-2 self-stretch sm:self-auto shrink-0">
          {unreadCount > 0 && (
            <button 
              onClick={handleMarkAllRead}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-205 rounded-xl transition shadow-sm font-sans"
            >
              <CheckCheck className="h-4 w-4 text-emerald-500" />
              Mark All Read
            </button>
          )}
          {notifications.length > 0 && (
            <button 
              onClick={handleClearAll}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-rose-50 hover:bg-rose-100/60 text-rose-600 border border-rose-200 rounded-xl transition shadow-sm font-sans"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Filter and Sort Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Segmented Filter Bar */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 border border-slate-200/80 rounded-xl">
          {[
            { id: "all", label: "All" },
            { id: "unread", label: "Unread" },
            { id: "read", label: "Read" },
            { id: "medicine", label: "Medicine Reminders" },
            { id: "sos", label: "SOS Alerts" },
            { id: "appointment", label: "Appointment Reminders" },
            { id: "system", label: "System Notifications" }
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
                activeFilter === filter.id 
                  ? "bg-rose-500 text-white shadow-sm" 
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/40"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Sort Order Selector */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <span className="text-xs font-semibold text-slate-400 font-sans">Sort:</span>
          <button
            onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 border border-slate-200 rounded-xl transition shadow-sm font-sans"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
            {sortOrder === "desc" ? "Newest First" : "Oldest First"}
          </button>
        </div>
      </div>

      {/* Notifications History List */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-center font-medium font-sans">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-slate-100 border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : sortedNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-100 shadow-sm rounded-2xl text-center space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-full text-slate-400">
            <Bell className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 font-sans">No Notifications</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto mt-1 font-sans">
              You are completely caught up! New reminders, reports, or emergency triggers will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedNotifications.map(notif => (
            <div 
              key={notif.id}
              className={`flex gap-4 p-4 border rounded-2xl transition duration-200 ${
                notif.read 
                  ? "bg-white border-slate-150/70 hover:bg-slate-50/50 shadow-sm" 
                  : "bg-gradient-to-r from-rose-50/10 to-white border-rose-100 hover:from-rose-50/20 shadow-sm"
              }`}
            >
              {/* Type Icon Indicator */}
              <div className="flex-shrink-0 mt-0.5">
                <div className={`p-2.5 rounded-xl border ${
                  notif.read 
                    ? "bg-slate-50 border-slate-200/65" 
                    : "bg-rose-50/40 border-rose-100/60 shadow-sm"
                }`}>
                  {getIcon(notif.type)}
                </div>
              </div>

              {/* Text Context */}
              <div className="flex-grow space-y-1 min-w-0">
                <div className="flex justify-between items-start gap-4">
                  <h3 className={`font-bold text-sm truncate ${notif.read ? "text-slate-600" : "text-slate-800"}`}>
                    {notif.title}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-semibold whitespace-nowrap shrink-0 font-sans">
                    {formatDate(notif.created_at)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap break-words font-sans">
                  {notif.message}
                </p>

                {/* Interactive Medicine Log Buttons */}
                {notif.type === "medicine" && notif.medicine_log_id && !notif.read && !actionStates[notif.id] && (
                  <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleTakeMed(notif.id, notif.medicine_log_id)}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm transition"
                    >
                      Mark Taken
                    </button>
                    <button
                      onClick={() => handleSnoozeMed(notif.id, notif.medicine_log_id)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-sm transition"
                    >
                      Snooze 10 Min
                    </button>
                    <button
                      onClick={() => handleDismissMed(notif.id, notif.medicine_log_id)}
                      className="px-3 py-1.5 bg-slate-500 hover:bg-slate-600 text-white text-xs font-bold rounded-lg shadow-sm transition"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Feedback state label */}
                {actionStates[notif.id] && (
                  <div className="mt-2 text-xs font-bold text-slate-500 italic flex items-center gap-1.5">
                    {actionStates[notif.id] === "taken" && "✅ Marked as Taken"}
                    {actionStates[notif.id] === "snoozed" && "⏰ Snoozed for 10 minutes"}
                    {actionStates[notif.id] === "dismissed" && "❌ Dismissed"}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 self-center flex-shrink-0">
                {!notif.read && (
                  <button
                    onClick={() => handleMarkRead(notif.id)}
                    title="Mark as read"
                    className="p-1.5 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 border border-slate-200 hover:border-emerald-200 text-slate-500 rounded-lg transition"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(notif.id)}
                  title="Delete notification"
                  className="p-1.5 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-slate-500 rounded-lg transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
