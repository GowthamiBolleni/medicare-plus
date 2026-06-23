import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { 
  Home as HomeIcon, 
  Pill, 
  PlusCircle, 
  FileText, 
  User, 
  AlertCircle,
  Menu,
  X
} from "lucide-react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import { authAPI, medicinesAPI, notificationsAPI } from "./api";

// Pages
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Medicines = React.lazy(() => import("./pages/Medicines"));
const Appointments = React.lazy(() => import("./pages/Appointments"));
const HealthTracker = React.lazy(() => import("./pages/HealthTracker"));
const BillsExpenses = React.lazy(() => import("./pages/BillsExpenses"));
const MedicalHistory = React.lazy(() => import("./pages/MedicalHistory"));
const Family = React.lazy(() => import("./pages/Family"));
const AIAssistant = React.lazy(() => import("./pages/AIAssistant"));
const Emergency = React.lazy(() => import("./pages/Emergency"));
const MedicalReports = React.lazy(() => import("./pages/MedicalReports"));
const Profile = React.lazy(() => import("./pages/Profile"));
const Login = React.lazy(() => import("./pages/Login"));
const Notifications = React.lazy(() => import("./pages/Notifications"));
const Settings = React.lazy(() => import("./pages/Settings"));

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-pulse">
      <div className="w-10 h-10 border-4 border-slate-200 border-t-brand-600 rounded-full animate-spin"></div>
      <p className="text-xs font-bold text-slate-400 font-sans tracking-wide">Loading page components...</p>
    </div>
  );
}


function AppContent() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("medicare_token")
  );

  // Dynamic user profile state shared globally
  const [profile, setProfile] = useState(null);

  // SMS Notification Toast State
  const [activeToast, setActiveToast] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const alertedMeds = useRef({});
  const notifiedIds = useRef({});

  useEffect(() => {
    // Initial auth check is handled by the state initialization checking localStorage 'medicare_token'
  }, []);

  const loadProfile = async () => {
    try {
      const res = await authAPI.getProfile();
      setProfile(res);
    } catch (err) {
      console.error("Error loading user profile details:", err);
      // Clear auth on profile fetch failure (e.g. token expired/invalid)
      setIsAuthenticated(false);
      localStorage.removeItem("medicare_token");
      localStorage.removeItem("medicare_user_id");
      localStorage.removeItem("medicare_username");
      localStorage.removeItem("medicare_user_fullname");
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadProfile();
    } else {
      setProfile(null);
    }
  }, [isAuthenticated]);

  const handleProfileUpdate = (updatedProfile) => {
    setProfile(updatedProfile);
  };

  // Service Worker Registration for PWA & Background Notifications
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/firebase-messaging-sw.js')
          .then((reg) => {
            console.log('[App SW] Service Worker registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.error('[App SW] Service Worker registration failed:', err);
          });
      });
    }
  }, []);

  // PWA beforeinstallprompt catcher
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  useEffect(() => {
    const handleInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('[App PWA] beforeinstallprompt event captured');
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
  }, []);

  // Background Reminder Checker to simulate SMS dispatches and send browser notifications
  useEffect(() => {
    if (!isAuthenticated || !profile || !profile.phone) return;

    // Robust parser to extract numeric hours and minutes from various string formats (e.g. "08:00 AM", "8:00 AM", "19:00", "7:40 PM")
    const parseTimeToMinutes = (timeStr) => {
      if (!timeStr) return null;
      const cleaned = timeStr.trim().toUpperCase();
      // Match formats like HH:MM and optional AM/PM
      const match = cleaned.match(/^(\d+):(\d+)\s*(AM|PM)?$/);
      if (!match) return null;

      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const ampm = match[3];

      if (ampm) {
        if (ampm === "PM" && hours < 12) hours += 12;
        if (ampm === "AM" && hours === 12) hours = 0;
      }
      return { hours, minutes };
    };

    const matchTime = (medTime) => {
      const parsedMed = parseTimeToMinutes(medTime);
      if (!parsedMed) return false;

      const now = new Date();
      return now.getHours() === parsedMed.hours && now.getMinutes() === parsedMed.minutes;
    };

    const checkReminders = async () => {
      try {
        const allMeds = await medicinesAPI.getAll();
        if (!allMeds) return;
        const medicines = allMeds.filter(m => m.status === "Upcoming");

        const nowMinute = new Date().getMinutes();

        medicines.forEach((med) => {
          if (matchTime(med.time)) {
            const alertKey = `${med.id}-${nowMinute}`;
            if (!alertedMeds.current[alertKey]) {
              alertedMeds.current[alertKey] = true;

              // 1. Show simulated SMS Toast
              setActiveToast({
                phone: profile.phone,
                medName: med.name,
                dosage: med.dosage,
                instructions: med.instructions,
                time: med.time,
              });

              // 2. Dispatch a real browser desktop push notification if allowed
              if ("Notification" in window) {
                if (Notification.permission === "granted") {
                  new Notification("MediCare+ Medicine Reminder", {
                    body: `Hello ${profile.full_name || "User"}, it's time to take your ${med.name} (${med.dosage} · ${med.instructions}) scheduled for ${med.time}.`,
                    tag: alertKey
                  });
                } else if (Notification.permission !== "denied") {
                  Notification.requestPermission().then((permission) => {
                    if (permission === "granted") {
                      new Notification("MediCare+ Medicine Reminder", {
                        body: `Hello ${profile.full_name || "User"}, it's time to take your ${med.name} (${med.dosage} · ${med.instructions}) scheduled for ${med.time}.`,
                        tag: alertKey
                      });
                    }
                  });
                }
              }

              setTimeout(() => {
                setActiveToast(null);
              }, 7000);
            }
          }
        });
      } catch (err) {
        console.error("Error in SMS simulation check:", err);
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated, profile]);

  // Step 7: Auto Popup in React - Poll backend notifications every 30 seconds
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkBackendNotifications = async () => {
      try {
        const res = await notificationsAPI.getAll();
        const unreads = res.filter(n => !n.read).length;
        setUnreadCount(unreads);

        res.forEach((notification) => {
          if (!notification.read && !notifiedIds.current[notification.id]) {
            notifiedIds.current[notification.id] = true;
            if (Notification.permission === "granted") {
              new Notification("Medicine Reminder", {
                body: notification.message,
              });
              // Automatically mark as read to prevent future spam
              notificationsAPI.markRead(notification.id).catch(() => {});
            }
          }
        });
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };

    checkBackendNotifications();
    const interval = setInterval(checkBackendNotifications, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  // If the user is not logged in, render the login page directly
  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  // Mobile Bottom Navigation config
  const mobileNavItems = [
    { name: "Home", path: "/", icon: HomeIcon },
    { name: "Medicines", path: "/medicines", icon: Pill },
    { name: "Appointments", path: "/appointments", icon: PlusCircle, isCenter: true },
    { name: "Profile", path: "/profile", icon: User },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f6fe] animate-fade-in">
      {/* Desktop Sidebar (hidden on mobile) */}
      <div className="hidden lg:block shrink-0">
        <Sidebar profile={profile} unreadCount={unreadCount} />
      </div>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={closeMobileMenu}
          ></div>
          
          <div className="relative flex flex-col w-64 max-w-xs bg-white h-full animate-slide-up shadow-2xl">
            <div className="absolute top-4 right-4">
              <button 
                onClick={closeMobileMenu}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            
            {/* Sidebar implementation cloned in mobile drawer */}
            <div className="flex-1 overflow-y-auto" onClick={closeMobileMenu}>
              <Sidebar profile={profile} unreadCount={unreadCount} />
            </div>
          </div>
        </div>
      )}

      {/* Content viewport area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <Header toggleMobileMenu={toggleMobileMenu} profile={profile} />

        {/* View Router Main Viewport */}
        <main className="flex-1 overflow-y-auto pb-24 lg:pb-8">
          <React.Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard profile={profile} />} />
              <Route path="/medicines" element={<Medicines profile={profile} onProfileUpdate={handleProfileUpdate} />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/health-tracker" element={<HealthTracker />} />
              <Route path="/bills-expenses" element={<BillsExpenses />} />
              <Route path="/medical-history" element={<MedicalHistory />} />
              <Route path="/reports" element={<MedicalReports />} />
              <Route path="/family" element={<Family />} />
              <Route path="/ai-assistant" element={<AIAssistant />} />
              <Route path="/emergency" element={<Emergency />} />
              <Route path="/profile" element={<Profile onLogout={() => setIsAuthenticated(false)} onProfileUpdate={handleProfileUpdate} />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </React.Suspense>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (hidden on desktop) */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-100 flex items-center justify-around px-4 lg:hidden z-40 shadow-lg">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          if (item.isCenter) {
            return (
              <Link
                key={item.name}
                to={item.path}
                className="w-12 h-12 rounded-full bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center -mt-6 shadow-md transition-all active:scale-95"
                aria-label={item.name}
              >
                <Icon className="w-6 h-6" aria-hidden="true" />
              </Link>
            );
          }

          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center gap-1.5 transition-colors ${
                isActive ? "text-brand-600" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon className="w-5.5 h-5.5" aria-hidden="true" />
              <span className="text-[9px] font-bold font-sans tracking-wide">{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Dynamic Simulated SMS Notification Toast */}
      {activeToast && (
        <div className="fixed top-4 right-4 z-[9999] max-w-sm w-full bg-slate-900 text-white rounded-2xl shadow-2xl p-4 border border-slate-800 animate-slide-up flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-slate-850 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-brand-600 flex items-center justify-center text-[10px] font-black font-sans text-white shadow-sm">
                M+
              </div>
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase font-sans">
                Simulated SMS Dispatcher
              </span>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              className="text-slate-500 hover:text-slate-300 text-xs font-bold font-sans cursor-pointer transition-colors"
              aria-label="Close simulated SMS notification"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-1.5 mt-1">
            <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider block font-sans">
              To: {activeToast.phone}
            </span>
            <div className="bg-slate-850 p-3 rounded-xl border border-slate-800">
              <p className="text-xs font-medium text-slate-200 leading-relaxed font-sans">
                "Hello **{profile?.full_name || "User"}**, this is a reminder from **MediCare+** to take your **{activeToast.medName}** ({activeToast.dosage} · {activeToast.instructions}) scheduled for **{activeToast.time}**."
              </p>
            </div>
            <span className="text-[9px] text-success-500 block text-right font-bold tracking-wide mt-1 font-sans">
              Simulated SMS Sent Successfully ✔
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
