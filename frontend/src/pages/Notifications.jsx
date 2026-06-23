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
  CheckCheck
} from "lucide-react";
import { notificationsAPI } from "../api";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all"); // all, unread, read, medicine, sos, system
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        prev.map(item => item.id === id ? { ...item, read: true } : item)
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
      setNotifications(prev => prev.map(item => ({ ...item, read: true })));
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

  const getIcon = (type) => {
    switch (type) {
      case "medicine":
        return <Pill className="h-5 w-5 text-rose-500" />;
      case "sos":
        return <AlertOctagon className="h-5 w-5 text-red-500 animate-pulse" />;
      case "report":
        return <FileText className="h-5 w-5 text-blue-500" />;
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

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Notification Center
          </h1>
          <p className="text-slate-400 mt-1">
            Stay updated with real-time medicine schedules, emergency logs, and system alerts.
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full">
                {unreadCount} Unread
              </span>
            )}
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button 
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition"
            >
              <CheckCheck className="h-4 w-4" />
              Mark All Read
            </button>
          )}
          {notifications.length > 0 && (
            <button 
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 border border-rose-900/60 rounded-lg transition"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Segmented Filter Bar */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl max-w-max">
        {[
          { id: "all", label: "All" },
          { id: "unread", label: "Unread" },
          { id: "read", label: "Read" },
          { id: "medicine", label: "Medicines" },
          { id: "sos", label: "SOS Alerts" },
          { id: "system", label: "System" }
        ].map(filter => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              activeFilter === filter.id 
                ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Notifications History List */}
      {error && (
        <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-red-400 text-center">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-slate-900/50 border border-slate-850 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-900/30 border border-slate-850 rounded-2xl text-center space-y-4">
          <div className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-full text-slate-500">
            <Bell className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-300">No Notifications</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto mt-1">
              You are completely caught up! New reminders, reports, or emergency triggers will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(notif => (
            <div 
              key={notif.id}
              className={`flex gap-4 p-4 border rounded-2xl transition duration-200 ${
                notif.read 
                  ? "bg-slate-900/40 border-slate-850 hover:bg-slate-850/40" 
                  : "bg-gradient-to-r from-rose-950/10 to-slate-900/70 border-rose-950/40 hover:from-rose-950/15 hover:to-slate-850/70"
              }`}
            >
              {/* Type Icon Indicator */}
              <div className="flex-shrink-0 mt-0.5">
                <div className={`p-2 rounded-xl border ${
                  notif.read 
                    ? "bg-slate-800/50 border-slate-750" 
                    : "bg-rose-950/30 border-rose-900/30 shadow-lg shadow-rose-950/10"
                }`}>
                  {getIcon(notif.type)}
                </div>
              </div>

              {/* Text Context */}
              <div className="flex-grow space-y-1">
                <div className="flex justify-between items-start gap-4">
                  <h3 className={`font-semibold text-sm ${notif.read ? "text-slate-300" : "text-white"}`}>
                    {notif.title}
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                    {formatDate(notif.created_at)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">
                  {notif.message}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 self-center flex-shrink-0">
                {!notif.read && (
                  <button
                    onClick={() => handleMarkRead(notif.id)}
                    title="Mark as read"
                    className="p-1.5 bg-slate-800/80 hover:bg-emerald-950/30 hover:text-emerald-400 border border-slate-700/60 hover:border-emerald-900/50 text-slate-400 rounded-lg transition"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(notif.id)}
                  title="Delete notification"
                  className="p-1.5 bg-slate-800/80 hover:bg-rose-950/30 hover:text-rose-400 border border-slate-700/60 hover:border-rose-900/50 text-slate-400 rounded-lg transition"
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
