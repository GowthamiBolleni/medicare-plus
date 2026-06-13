import React, { useState } from "react";
import { ShieldCheck, Lock, User, Eye, EyeOff, Sparkles, Mail, UserPlus } from "lucide-react";
import { authAPI } from "../api";

export default function Login({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Form Fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [gender, setGender] = useState("");
  
  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleToggleMode = () => {
    setIsSignUp(!isSignUp);
    setError("");
    setSuccessMsg("");
    setUsername("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setGender("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!username || !password) {
      setError("Please fill in username and password.");
      return;
    }

    if (isSignUp) {
      if (!email) {
        setError("Please enter a valid email address.");
        return;
      }
      if (!gender) {
        setError("Please select a gender.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      try {
        setLoading(true);
        await authAPI.register(username, email, password, gender);
        setSuccessMsg("Account created successfully! Please sign in.");
        setIsSignUp(false);
        setPassword("");
        setConfirmPassword("");
      } catch (err) {
        console.error("Registration failure", err);
        setError("Failed to create account. Username/Email might be taken.");
      } finally {
        setLoading(false);
      }
    } else {
      try {
        setLoading(true);
        await authAPI.login(username, password);
        onLoginSuccess();
      } catch (err) {
        console.error("Login failure", err);
        setError("Invalid username or password. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#f4f6fe] relative overflow-hidden font-sans p-4">
      {/* Decorative Floating Circles */}
      <div className="absolute top-[-10%] left-[-10%] w-[45vw] h-[45vw] rounded-full bg-brand-200/40 blur-[80px] animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-indigo-200/40 blur-[80px] animate-pulse pointer-events-none"></div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-white/85 backdrop-blur-xl border border-white/60 shadow-2xl rounded-3xl p-8 relative z-10 space-y-6">
        
        {/* Brand Logo & Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-brand-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-brand-500/30">
            <ShieldCheck className="w-9 h-9" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-1.5 font-sans">
              MediCare<span className="text-brand-600 font-extrabold">+</span> <Sparkles className="w-4 h-4 text-amber-400 fill-current" />
            </h1>
            <p className="text-slate-400 mt-1.5 text-xs font-semibold uppercase tracking-wider">
              {isSignUp ? "Create new patient portal account" : "Health Portal & Reminders"}
            </p>
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Error Message Box */}
          {error && (
            <div className="p-3.5 bg-emergency-50 border border-emergency-100 text-emergency-700 text-xs font-bold rounded-xl animate-fade-in flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emergency-600"></span>
              {error}
            </div>
          )}

          {/* Success Message Box */}
          {successMsg && (
            <div className="p-3.5 bg-success-50 border border-success-100 text-success-700 text-xs font-bold rounded-xl animate-fade-in flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-success-600"></span>
              {successMsg}
            </div>
          )}

          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="e.g. testuser1"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-semibold text-sm transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Registration Extra Fields */}
          {isSignUp && (
            <>
              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    placeholder="e.g. name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-semibold text-sm transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Gender Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-semibold text-sm transition-all"
                >
                  <option value="">Select Gender</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Non-Binary">Non-Binary</option>
                </select>
              </div>
            </>
          )}

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-semibold text-sm transition-all placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password Field for Sign Up */}
          {isSignUp && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                Confirm Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 font-semibold text-sm transition-all placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          {/* Forgot Password Link (Login Only) */}
          {!isSignUp && (
            <div className="flex items-center justify-between text-xs font-bold pt-1">
              <label className="flex items-center gap-2 text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-slate-200 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5"
                />
                Remember me
              </label>
              <a href="#forgot" className="text-brand-600 hover:underline">
                Forgot Password?
              </a>
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-extrabold py-3.5 rounded-xl shadow-lg shadow-brand-500/20 hover:shadow-brand-500/35 transition-all duration-200 font-sans mt-6 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              "Please Wait..."
            ) : isSignUp ? (
              <>
                <UserPlus className="w-4 h-4" /> Create Account
              </>
            ) : (
              "Access Portal"
            )}
          </button>
        </form>

        {/* Toggle Sign Up Mode */}
        <div className="text-center">
          <button
            type="button"
            onClick={handleToggleMode}
            className="text-xs font-bold text-brand-600 hover:underline hover:text-brand-700 transition-colors"
          >
            {isSignUp ? "Already have an account? Access Portal" : "New patient? Create Account"}
          </button>
        </div>



      </div>
    </div>
  );
}
