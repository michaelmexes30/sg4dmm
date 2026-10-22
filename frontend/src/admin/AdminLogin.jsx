import React, { useState } from 'react';
import { Shield, Lock, User, Eye, EyeOff, ArrowLeft, ShieldCheck, KeyRound, AlertTriangle, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import logoImg from '../assets/logo.png';

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
      setErrorMsg(lang === 'mm' ? 'စီမံခန့်ခွဲသူ Username သို့မဟုတ် ဖုန်းနံပါတ် ရိုက်ထည့်ပါ' : 'Please enter your Admin username or phone');
      return;
    }
    if (!password) {
      setErrorMsg(lang === 'mm' ? 'လုံခြုံရေး စကားဝှက် ရိုက်ထည့်ပါ' : 'Please enter your password');
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
            ? 'ဝင်ရောက်ခွင့်မရှိပါ: ဤ Portal သည် Chief Administrator များသာ ဝင်ရောက်နိုင်ပါသည် (Access Denied: Admin role required).' 
            : 'Access Denied: This portal is strictly restricted to Chief Administrators only.'
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
        (lang === 'mm' ? 'Username သို့မဟုတ် Password မှားယွင်းနေပါသည်' : 'Invalid username or password')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040814] text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 font-['Outfit','Padauk',sans-serif] relative overflow-hidden">
      
      {/* Executive Background Decorative Glows */}
      <div className="absolute top-1/4 -left-40 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-30 pointer-events-none" />

      {/* Main Admin Login Card */}
      <div className="relative w-full max-w-md bg-gradient-to-b from-navy-900 via-navy-950 to-[#060c1d] border border-gold-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-6">
        
        {/* Top Header & Security Badge */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[10px] font-bold tracking-wider uppercase">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            <span>Restricted Access • Admin Console</span>
          </div>

          <div className="relative w-20 h-20 mx-auto rounded-2xl bg-navy-950/90 border border-gold-500/80 p-2.5 flex items-center justify-center shadow-lg shadow-gold-500/20">
            <img src={logoImg} alt="Logo" className="w-full h-full object-contain filter drop-shadow" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-navy-950 flex items-center justify-center text-navy-950">
              <ShieldCheck className="w-3.5 h-3.5 text-navy-950 stroke-[3]" />
            </div>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide font-serif">
              SG4D Myanmar
            </h1>
            <p className="text-xs font-bold text-transparent bg-gradient-to-r from-amber-300 via-gold-400 to-amber-200 bg-clip-text mt-0.5">
              Chief Executive Administration Portal
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              ဗဟိုစီမံခန့်ခွဲမှု စနစ် (Authorized Personnel Only)
            </p>
          </div>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2.5 shadow-lg animate-shake">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-rose-300">ဝင်ရောက်မှု အမှားအယွင်း</p>
              <p className="text-[11px] leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Admin Username / ID Field (Allows letters, text, numbers on Mobile) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>စီမံခန့်ခွဲသူ အကောင့်အမည် (Admin Username / Phone)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                autoComplete="username"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. mglikko, admin, mgnitoot"
                className="w-full bg-navy-950/90 border border-gold-500/30 rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 transition-all"
              />
            </div>
            <p className="text-[10px] text-slate-500">
              * ဖုန်းကီးဘုတ်တွင် စာလုံး/နံပါတ် (Letters & Numbers) အားလုံး ရိုက်နှိပ်နိုင်ပါသည်
            </p>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>လုံခြုံရေး စကားဝှက် (Password)</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-navy-950/90 border border-gold-500/30 rounded-xl pl-4 pr-11 py-3 text-xs sm:text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-200 transition-colors p-0.5 cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>

          {/* Sign In Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-gold-400 to-amber-500 hover:from-amber-400 hover:to-gold-300 text-navy-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30 transition-all duration-200 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-navy-950/40 border-t-navy-950 rounded-full animate-spin" />
                <span>စစ်ဆေးနေပါသည်...</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>လုံခြုံစွာ ဝင်ရောက်မည် (Admin Sign In)</span>
              </>
            )}
          </button>
        </form>

        {/* Security Notice & Return Link */}
        <div className="pt-4 border-t border-navy-800/80 space-y-3 text-center">
          <div className="p-2.5 rounded-xl bg-navy-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>256-Bit SSL Encrypted Admin Infrastructure</span>
          </div>

          <button
            type="button"
            onClick={onGoToPlayerApp || (() => { window.location.href = '/'; })}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-gold-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>ကစားသမား ဝက်ဘ်ဆိုဒ်သို့ ပြန်သွားမည် (Back to Player Website)</span>
          </button>
        </div>

      </div>

      {/* Footer Branding */}
      <p className="text-[11px] text-slate-600 mt-6 text-center font-mono">
        SG4D Myanmar Golden Peacock Platform © 2026 • Executive Portal v2.1.0
      </p>
    </div>
  );
}
