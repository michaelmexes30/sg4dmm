import React, { useState } from 'react';
import { Shield, Lock, User, Eye, EyeOff, ArrowLeft, ShieldAlert, KeyRound, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function AdminLogin({ onLoginSuccess, onGoToPlayerApp }) {
  const { login, logout } = useAuth();
  const { lang } = useLanguage();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanId = identifier.trim();
    if (!cleanId) {
      setErrorMsg(lang === 'mm' ? 'စီမံခန့်ခွဲသူ Username ရိုက်ထည့်ပါ' : 'Please enter Admin username');
      return;
    }
    if (!password) {
      setErrorMsg(lang === 'mm' ? 'လုံခြုံရေး စကားဝှက် ရိုက်ထည့်ပါ' : 'Please enter Admin password');
      return;
    }

    try {
      setLoading(true);
      const res = await login(cleanId, password);
      
      // Strict Admin Role Enforcement
      if (!res.user || res.user.role !== 'ADMIN') {
        logout();
        setErrorMsg(
          lang === 'mm' 
            ? 'ဝင်ရောက်ခွင့် မရှိပါ: ဤ Portal သည် စနစ်စီမံခန့်ခွဲသူ (ADMIN) များသာ ဝင်ရောက်ခွင့်ရှိပါသည် (Access Denied: Admin privileges required).' 
            : 'Access Denied: This console is strictly restricted to System Administrators only.'
        );
        return;
      }

      if (onLoginSuccess) {
        onLoginSuccess(res.user);
      }
    } catch (err) {
      console.error('Admin login failed:', err);
      setErrorMsg(
        err.message || 
        (lang === 'mm' ? 'Username သို့မဟုတ် Password မှားယွင်းနေပါသည်' : 'Invalid Admin credentials')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 font-['Outfit','Padauk',sans-serif] relative overflow-hidden select-none">
      
      {/* Enterprise Cyber Tech Grid & Background Glows (Completely distinct from frontend Gold theme) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b18_1px,transparent_1px),linear-gradient(to_bottom,#1e293b18_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-1/4 -left-48 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Admin Console Container */}
      <div className="relative w-full max-w-md bg-[#0d1322] border border-slate-700/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/90 space-y-6">
        
        {/* Top Accent Gradient Bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 rounded-t-3xl" />

        {/* Console Header */}
        <div className="text-center space-y-3 pt-2">
          
          {/* Security Status Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-[11px] font-semibold text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-emerald-400 tracking-wider">SECURE CONSOLE</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">ADMIN GATEWAY</span>
          </div>

          {/* Central Enterprise Icon */}
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/10 border border-blue-500/40 p-3.5 flex items-center justify-center shadow-lg shadow-blue-500/10">
            <Shield className="w-9 h-9 text-blue-400" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-white tracking-wide font-sans">
              SG4D BACKOFFICE
            </h1>
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mt-1">
              Central Management System
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-sans">
              ဗဟိုစီမံခန့်ခွဲမှု စနစ် (Authorized Personnel Only)
            </p>
          </div>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2.5 shadow-lg animate-shake">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{errorMsg}</div>
          </div>
        )}

        {/* Admin Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Administrator Username / Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>စီမံခန့်ခွဲသူ Username (Admin ID)</span>
              <span className="text-[10px] text-blue-400 font-mono">REQUIRED</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="text"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Admin username သို့မဟုတ် ဖုန်းနံပါတ်"
                className="w-full bg-[#080d18] border border-slate-700 rounded-xl pl-10 pr-3.5 py-3 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none font-sans transition-all"
              />
            </div>
          </div>

          {/* Master Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>လုံခြုံရေး စကားဝှက် (Password)</span>
              <span className="text-[10px] text-blue-400 font-mono">PROTECTED</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#080d18] border border-slate-700 rounded-xl pl-10 pr-10 py-3 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none font-sans tracking-wider transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>စစ်ဆေးနေပါသည်...</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>စီမံခန့်ခွဲမှု စနစ်သို့ ဝင်ရောက်မည် (Sign In)</span>
              </>
            )}
          </button>
        </form>

        {/* Security Warning Notice */}
        <div className="pt-2 space-y-3 text-center border-t border-slate-800">
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2 text-left">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-slate-200">သတိပေးချက်:</strong> ဤနေရာသည် စနစ်စီမံခန့်ခွဲသူ (Admin) များ သီးသန့်ဖြစ်ပါသည်။ ခွင့်ပြုချက်မရှိဘဲ ဝင်ရောက်ရန် ကြိုးစားမှုများကို စနစ်မှ အလိုအလျောက် မှတ်တမ်းတင်ထားပါမည်။
            </p>
          </div>

          {/* Back to Member Website Link */}
          <div>
            <button
              type="button"
              onClick={onGoToPlayerApp || (() => { window.location.href = '/'; })}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-blue-400 transition-colors cursor-pointer py-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>ကစားသမား ဝက်ဘ်ဆိုဒ်သို့ ပြန်သွားမည် (Back to Player Portal)</span>
            </button>
          </div>
        </div>

      </div>

      {/* Corporate Console Footer */}
      <div className="mt-6 text-center space-y-1">
        <p className="text-[11px] text-slate-500 font-mono">
          SG4D Enterprise Backoffice Core v2.4.0 • Node SG-SIN-01
        </p>
        <p className="text-[10px] text-slate-600">
          End-to-End SSL Encrypted Administrative Infrastructure
        </p>
      </div>

    </div>
  );
}
