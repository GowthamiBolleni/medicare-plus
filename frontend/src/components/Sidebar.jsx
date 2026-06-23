import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Pill,
  Calendar,
  Activity,
  Receipt,
  FileClock,
  FileText,
  BarChart3,
  Users,
  MessageSquare,
  AlertOctagon,
  ChevronRight,
  Bell,
  Settings
} from "lucide-react";

export default function Sidebar({ profile, unreadCount }) {
  const location = useLocation();

  const menuItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Medicines", path: "/medicines", icon: Pill },
    { name: "Appointments", path: "/appointments", icon: Calendar },
    { name: "Health Tracker", path: "/health-tracker", icon: Activity },
    { name: "Bills & Expenses", path: "/bills-expenses", icon: Receipt },
    { name: "Medical History", path: "/medical-history", icon: FileClock },
    { name: "Medical Reports", path: "/reports", icon: FileText },
    { name: "Family", path: "/family", icon: Users },
    { name: "AI Assistant", path: "/ai-assistant", icon: MessageSquare },
    { name: "Notifications", path: "/notifications", icon: Bell },
    { name: "Settings", path: "/settings", icon: Settings },
    { name: "Emergency", path: "/emergency", icon: AlertOctagon, isEmergency: true },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0 font-sans">
      {/* Brand Logo */}
      <div className="p-6 flex items-center gap-2.5 border-b border-slate-50">
        <div className="w-9 h-9 rounded-xl bg-emergency-50 flex items-center justify-center">
          <span className="text-emergency-500 font-extrabold text-xl font-sans">+</span>
        </div>
        <span className="text-xl font-bold tracking-tight text-slate-900 font-sans">MediCare<span className="text-brand-500 font-extrabold">+</span></span>
      </div>

      {/* Navigation menu */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? item.isEmergency
                    ? "bg-emergency-50 text-emergency-600 shadow-sm"
                    : "bg-brand-50 text-brand-600 shadow-sm"
                  : item.isEmergency
                  ? "text-emergency-500 hover:bg-emergency-50/50"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/70"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "" : item.isEmergency ? "text-emergency-500" : "text-slate-400"}`} />
              <span className="font-sans flex-1">{item.name}</span>
              {item.name === "Notifications" && unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold bg-rose-500 text-white rounded-full">
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User profile section */}
      <div className="p-4 border-t border-slate-50">
        <Link to="/profile" aria-label="View user profile" className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 smooth-hover cursor-pointer w-full">
          <img
            src={profile?.profile_image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop"}
            alt={profile?.full_name || "User"}
            className="w-10 h-10 rounded-full object-cover border border-slate-100"
          />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-slate-800 truncate font-sans">{profile?.full_name || "Medicare User"}</h4>
            <p className="text-xs text-slate-400 truncate font-sans">View Profile</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </Link>
      </div>
    </aside>
  );
}
