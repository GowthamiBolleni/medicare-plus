import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Settings, Menu, X, Check } from "lucide-react";

export default function Header({ toggleMobileMenu, notifications = [], profile }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [alerts, setAlerts] = useState(
    notifications.length > 0 ? notifications : [
      { id: 1, text: "Medicine reminder for Vitamin D3", time: "12:00 PM", read: false },
      { id: 2, text: "Appointment reminder for Dr. Sharma", time: "Today", read: false }
    ]
  );

  const markAllRead = () => {
    setAlerts(alerts.map(a => ({ ...a, read: true })));
  };

  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <header className="h-20 bg-white/70 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-8 sticky top-0 z-40">
      {/* Mobile navigation toggle */}
      <button
        onClick={toggleMobileMenu}
        className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-xl smooth-hover"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Breadcrumb / Title area */}
      <div className="hidden sm:block">
        <h2 className="text-lg font-bold text-slate-800 font-sans tracking-tight">MediCare+ Health Portal</h2>
      </div>

      {/* Header quick actions */}
      <div className="flex items-center gap-4 ml-auto">
        {/* Notification Bell with Badge */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl smooth-hover border border-slate-100 relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emergency-500 ring-2 ring-white"></span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden animate-slide-up z-50">
              <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <span className="font-bold text-sm text-slate-800">Recent Alerts</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-brand-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Check className="w-3 h-3" /> Mark all read
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                {unreadCount === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">No active alerts</div>
                ) : (
                  alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 text-xs transition-colors ${
                        alert.read ? "bg-white text-slate-500" : "bg-brand-50/20 text-slate-800 font-medium"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <span className="leading-relaxed">{alert.text}</span>
                        <span className="text-slate-400 font-normal whitespace-nowrap">{alert.time}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User photo - links to Profile view */}
        <Link 
          to="/profile" 
          className="w-10 h-10 rounded-xl overflow-hidden border border-slate-100 smooth-hover hover:scale-105 cursor-pointer block"
        >
          <img
            src={profile?.profile_image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop"}
            alt={profile?.full_name || "User profile"}
            className="w-full h-full object-cover"
          />
        </Link>
      </div>
    </header>
  );
}

