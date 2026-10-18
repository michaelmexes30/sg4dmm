import React, { useState, useEffect, useRef } from 'react';
import { X, Lock, Phone, User, ShieldCheck, KeyRound, CheckCircle2, Sparkles, Send, Check, HelpCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiClient } from '../api/client';

export default function AuthModal({ isOpen, onClose, allowClose = true }) {
  const { login, register } = useAuth();
  const { t, lang } = useLanguage();
  // mode: 'login' | 'register' | 'forgot_password'
  const [authMode, setAuthMode] = useState('login');
  
  // Fields
  const [identifier, setIdentifier] = useState(''); // Username OR Phone Number
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [countryCode, setCountryCode] = useState('+95');
  const [referralCode, setReferralCode] = useState('');
  const [agentVerified, setAgentVerified] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Telegram Verification State
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [isTelegramVerified, setIsTelegramVerified] = useState(false);
  const [telegramBotUser, setTelegramBotUser] = useState('@SG4DMyanmarBot');
  const [telegramDeepLink, setTelegramDeepLink] = useState('https://t.me/SG4DMyanmarBot');
  const [sentViaBot, setSentViaBot] = useState(false);

  // Scroll Container Refs
  const modalScrollRef = useRef(null);
  const modalTopRef = useRef(null);

  const scrollToTop = () => {
    setTimeout(() => {
      if (modalScrollRef.current) {
        modalScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (modalTopRef.current) {
        modalTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  useEffect(() => {
    if (errorMsg || successMsg) {
      scrollToTop();
    }
  }, [errorMsg, successMsg]);

  useEffect(() => {
    if (authMode === 'register' && referralCode && referralCode.length >= 3) {
      checkAgentCode(referralCode);
    } else {
      setAgentVerified(null);
    }
  }, [referralCode, authMode]);

  const checkAgentCode = async (code) => {
    try {
      const res = await apiClient.verifyAgentCode(code);
      setAgentVerified(res);
    } catch {
      setAgentVerified({ valid: false, message: lang === 'mm' ? 'အေးဂျင့်ကုဒ် မမှန်ကန်ပါ' : 'Invalid code' });
    }
  };

  if (!isOpen) return null;

  // Request Telegram OTP (Used for Register and Forgot Password)
  const handleRequestTelegramOtp = async () => {
    const targetPhone = phone.trim();
    if (!targetPhone || targetPhone.length < 3) {
      setErrorMsg(
        authMode === 'forgot_password'
          ? (lang === 'mm' ? 'ကျေးဇူးပြု၍ မှတ်ပုံတင်ထားသော User ID သို့မဟုတ် ဖုန်းနံပါတ် အရင်ရိုက်ထည့်ပါ ခင်ဗျာ။' : 'Please enter your registered User ID or phone number first.')
          : (lang === 'mm' ? 'တယ်လီဂရမ် OTP ရယူရန် မှန်ကန်သော ဖုန်းနံပါတ် အရင်ရိုက်ထည့်ပါ ခင်ဗျာ။' : 'Please enter a valid phone number first to request Telegram OTP.')
      );
      return;
    }

    try {
      setErrorMsg('');
      setOtpSending(true);
      const res = await apiClient.requestTelegramOtp(
        targetPhone,
        authMode === 'forgot_password' ? 'reset_password' : 'register'
      );
      setOtpSent(true);
      setSuccessMsg(res.message);
      if (res.telegram_bot) setTelegramBotUser(res.telegram_bot);
      if (res.deep_link) setTelegramDeepLink(res.deep_link);
      setSentViaBot(!!res.sent_via_bot);
      if (res.phone && res.phone !== targetPhone) {
        setPhone(res.phone);
      }
      setOtpCode(''); // Keep strictly blank for user to type code received from Telegram
    } catch (err) {
      setErrorMsg(err.message || (lang === 'mm' ? 'တယ်လီဂရမ် OTP ပို့ဆောင်ခြင်း မအောင်မြင်ပါ' : 'Failed to send Telegram OTP.'));
    } finally {
      setOtpSending(false);
    }
  };

  // Verify Telegram OTP
  const handleVerifyTelegramOtp = async () => {
    const targetPhone = phone.trim();
    if (!otpCode) {
      setErrorMsg(lang === 'mm' ? 'ကျေးဇူးပြု၍ ၆ လုံးပါ တယ်လီဂရမ် OTP ကုဒ်ကို ရိုက်ထည့်ပါ' : 'Please enter the 6-digit Telegram OTP code.');
      scrollToTop();
      return;
    }

    try {
      setErrorMsg('');
      const res = await apiClient.verifyTelegramOtp(targetPhone, otpCode.trim());
      setIsTelegramVerified(true);
      setSuccessMsg(res.message || (lang === 'mm' ? 'တယ်လီဂရမ်ဖြင့် ဖုန်းနံပါတ် အောင်မြင်စွာ အတည်ပြုပြီးပါပြီ!' : 'Phone verified via Telegram!'));
      scrollToTop();
    } catch (err) {
      setIsTelegramVerified(false);
      setErrorMsg(err.message || 'Invalid OTP verification code.');
      scrollToTop();
    }
  };

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (authMode === 'login') {
        // LOGIN: ONLY requires Username / Phone + Password (NO Agent Code required)
        await login(identifier.trim(), password);
        onClose();
      } else if (authMode === 'register') {
        // REGISTER: Requires Agent Code + Telegram Phone Verification
        if (!referralCode) {
          setErrorMsg(lang === 'mm' ? 'အကောင့်ဖွင့်ရန် အေးဂျင့်ကုဒ် မဖြစ်မနေ လိုအပ်ပါသည်' : 'Agent / Referral Code is strictly required to register.');
          setLoading(false);
          return;
        }
        if (!isTelegramVerified) {
          setErrorMsg(lang === 'mm' ? 'တယ်လီဂရမ် အတည်ပြုချက် လိုအပ်ပါသည်! ကျေးဇူးပြု၍ OTP တောင်းယူပြီး အတည်ပြုပေးပါ' : 'Telegram Phone Verification is required! Please request and verify OTP code before registering.');
          setLoading(false);
          return;
        }
        const regPhone = phone.trim();
        await apiClient.register(
          regPhone, 
          fullName.trim() || username.trim(), 
          password, 
          countryCode, 
          referralCode.trim(), 
          username.trim()
        );
        // Switch to login page as requested
        setSuccessMsg(lang === 'mm' ? 'အကောင့်ဖွင့်ခြင်း အောင်မြင်ပါသည်! စကားဝှက်ဖြင့် စတင် Login ဝင်ရောက်ပါ ခင်ဗျာ။' : 'Registration successful! Please login with your credentials.');
        setAuthMode('login');
        setIdentifier(regPhone);
        setPassword('');
        setOtpCode('');
        setIsTelegramVerified(false);
      } else if (authMode === 'forgot_password') {
        // FORGOT PASSWORD: Reset via Telegram OTP
        if (!phone.trim()) {
          setErrorMsg(lang === 'mm' ? 'ကျေးဇူးပြု၍ မှတ်ပုံတင်ထားသော ဖုန်းနံပါတ် ရိုက်ထည့်ပါ' : 'Please enter your registered phone number.');
          setLoading(false);
          return;
        }
        if (!otpCode.trim()) {
          setErrorMsg(lang === 'mm' ? 'ကျေးဇူးပြု၍ တယ်လီဂရမ်သို့ ပေးပို့ထားသော OTP ကုဒ် ရိုက်ထည့်ပါ' : 'Please enter the OTP code sent via Telegram.');
          setLoading(false);
          return;
        }
        if (!newPassword || newPassword.length < 6) {
          setErrorMsg(lang === 'mm' ? 'စကားဝှက်အသစ်သည် အနည်းဆုံး ၆ လုံး ရှိရပါမည်' : 'New password must be at least 6 characters.');
          setLoading(false);
          return;
        }

        const res = await apiClient.resetPassword(phone.trim(), otpCode.trim(), newPassword);
        setSuccessMsg(res.message || (lang === 'mm' ? 'စကားဝှက် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ! အကောင့်ဝင်ရောက်နိုင်ပါပြီ' : 'Password reset successfully! Please login now.'));
        // Switch to login mode
        setTimeout(() => {
          setAuthMode('login');
          setIdentifier(phone.trim());
          setPassword('');
          setOtpCode('');
        }, 1500);
      }
    } catch (err) {
      setErrorMsg(err.message || (lang === 'mm' ? 'လုပ်ဆောင်ချက် မအောင်မြင်ပါ' : 'Authentication failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      ref={modalScrollRef}
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 py-4 sm:py-8 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <div 
        ref={modalTopRef}
        className="relative w-full max-w-md bg-dark-surface border border-gold-600/60 rounded-3xl shadow-gold-lg p-5 sm:p-6 text-gray-200 my-2 sm:my-6"
      >
        
        {/* Back Button (top-left) for Register & Forgot Password modes */}
        {authMode !== 'login' && (
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className="absolute top-5 left-5 text-gray-400 hover:text-gold-300 p-2 rounded-xl bg-dark-bg/60 border border-gold-900/50 hover:border-gold-500/60 hover:bg-dark-card transition-all cursor-pointer flex items-center justify-center group"
            title={t('backToLoginBtn')}
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
          </button>
        )}

        {/* Close Button (shown only when allowed) */}
        {allowClose && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-dark-card transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Modal Header with Golden Peacock */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-dark-bg border border-gold-500/80 p-1 flex items-center justify-center shadow-gold-sm">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain filter drop-shadow" />
          </div>
          <h3 className="text-xl font-black text-white gold-gradient-text">
            {authMode === 'login' && t('loginTitle')}
            {authMode === 'register' && t('registerTitle')}
            {authMode === 'forgot_password' && t('forgotPasswordTitle')}
          </h3>
          {authMode !== 'register' && (
            <p className="text-xs text-gold-400/90 mt-1 font-medium">
              {authMode === 'login' && t('loginSubtitle')}
              {authMode === 'forgot_password' && t('forgotPasswordSubtitle')}
            </p>
          )}
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/70 border border-red-600 text-red-200 text-xs text-center font-medium space-y-2">
            <p>{errorMsg}</p>
            {authMode === 'forgot_password' && errorMsg.includes('Sign Up') && (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setAuthMode('register');
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-gold-500 hover:bg-gold-400 text-dark-bg font-extrabold text-[11px] shadow-gold-sm transition-all cursor-pointer"
                >
                  👉 {t('goToSignUp')}
                </button>
              </div>
            )}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-green-950/70 border border-green-600 text-green-200 text-xs text-center font-medium">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* MODE 1: LOGIN (NO Agent Code Field) */}
          {authMode === 'login' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  {t('phoneLabel')}
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="09888888888"
                    className="w-full bg-dark-bg border border-gold-900 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white font-mono focus:border-gold-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-300">
                    {t('passwordLabel')}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('forgot_password');
                      setErrorMsg('');
                      setSuccessMsg('');
                      if (identifier.startsWith('09')) setPhone(identifier);
                    }}
                    className="text-[11px] text-gold-400 hover:underline cursor-pointer"
                  >
                    {t('forgotPasswordLink')}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-dark-bg border border-gold-900 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white focus:border-gold-400 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl gold-gradient-btn text-dark-bg font-extrabold text-xs tracking-wider shadow-gold transition-all cursor-pointer"
              >
                {loading ? (lang === 'mm' ? 'စစ်ဆေးနေပါသည်...' : 'Validating...') : t('loginBtn')}
              </button>
            </>
          )}

          {/* MODE 2: REGISTER (Agent Code + Telegram Verification required) */}
          {authMode === 'register' && (
            <>
              {/* Agent Referral Code - ONLY ON REGISTRATION */}
              <div className="p-3 bg-dark-card rounded-xl border border-gold-700/70">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gold-300 flex items-center space-x-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-gold-400" />
                    <span>{t('agentCodeLabel')}</span>
                  </label>
                  {agentVerified && agentVerified.valid && (
                    <span className="text-[10px] text-green-400 font-bold flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{t('verifiedBadge')}</span>
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder={lang === 'mm' ? 'ရည်ညွှန်းကုဒ် ရိုက်ထည့်ပါ (ဥပမာ: AGT8899)' : 'Enter referral code (e.g. AGT8899)'}
                  className="w-full bg-dark-bg border border-gold-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white uppercase focus:border-gold-400 focus:outline-none"
                />
                {agentVerified && (
                  <p className={`text-[11px] mt-1.5 flex items-center space-x-1 ${
                    agentVerified.valid ? 'text-green-300' : 'text-red-400'
                  }`}>
                    {agentVerified.valid ? (
                      <span>✓ {agentVerified.message}</span>
                    ) : (
                      <span>✕ {agentVerified.message}</span>
                    )}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  {t('usernameLabel')}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. TestMich"
                    className="w-full bg-dark-bg border border-gold-900 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white focus:border-gold-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  {t('fullNameLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={lang === 'mm' ? 'ဥပမာ: ဒေါ်စန်းစန်း' : 'e.g. Daw San San'}
                  className="w-full bg-dark-bg border border-gold-900 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-gold-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  {t('phoneLabel')} *
                </label>
                <div className="flex space-x-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="bg-dark-bg border border-gold-900 rounded-xl px-2.5 py-2.5 text-xs text-white focus:border-gold-400 focus:outline-none"
                  >
                    <option value="+95">+95 (MM)</option>
                    <option value="+66">+66 (TH)</option>
                    <option value="+65">+65 (SG)</option>
                    <option value="+82">+82 (KR)</option>
                    <option value="+81">+81 (JP)</option>
                  </select>
                  <div className="relative flex-1">
                    <Phone className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="09888888888"
                      className="w-full bg-dark-bg border border-gold-900 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white font-mono focus:border-gold-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Telegram Phone Verification Box */}
              <div className="p-3.5 rounded-2xl bg-dark-card border border-gold-700/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gold-300 flex items-center space-x-1.5">
                    <Send className="w-3.5 h-3.5 text-sky-400" />
                    <span>{t('telegramVerificationTitle')}</span>
                  </span>
                  {isTelegramVerified && (
                    <span className="text-[10px] text-green-400 font-extrabold flex items-center space-x-1 bg-green-950/90 px-2.5 py-1 rounded-xl border border-green-500 shadow-sm">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>{t('verifiedBadge')} ✓</span>
                    </span>
                  )}
                </div>

                {isTelegramVerified ? (
                  <div className="p-3.5 rounded-xl bg-green-950/80 border border-green-500/90 flex items-center space-x-3 text-green-300 text-xs font-bold shadow-md">
                    <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0" />
                    <div>
                      <p className="text-sm font-extrabold text-green-400">အတည်ပြုခြင်း အောင်မြင်ပါသည် ✓</p>
                      <p className="text-[11px] text-green-200/90 font-normal mt-0.5">ဖုန်းနံပါတ် {phone} ကို Telegram ဖြင့် အတည်ပြုပြီးပါပြီ</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* One-click open Telegram Bot button */}
                    <a
                      href={telegramDeepLink || `https://t.me/SG4DMyanmarBot?start=otp_${phone.trim()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5 text-white" />
                      <span>{lang === 'mm' ? 'Telegram Bot (@SG4DMyanmarBot) ဖွင့်၍ OTP ရယူရန်' : 'Open Telegram Bot (@SG4DMyanmarBot)'}</span>
                    </a>

                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder={t('enterOtpPlaceholder')}
                        maxLength={6}
                        className="flex-1 bg-dark-bg border border-gold-900 rounded-lg px-3 py-2 text-xs font-mono font-bold text-center text-white focus:border-gold-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyTelegramOtp}
                        className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        {t('verifyBtn')}
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <p className="text-[10px] text-sky-300/90">
                        * {lang === 'mm' ? 'Telegram တွင် Start နှိပ်၍ ကုဒ် ရယူပါ' : 'Start Telegram Bot to get code'}
                      </p>
                      <button
                        type="button"
                        onClick={handleRequestTelegramOtp}
                        disabled={otpSending}
                        className="text-[11px] text-sky-400 hover:text-sky-300 underline font-bold cursor-pointer"
                      >
                        {otpSending ? t('sendingOtp') : (otpSent ? t('resendOtpBtn') : t('sendOtpBtn'))}
                      </button>
                    </div>

                    {sentViaBot && (
                      <p className="text-[10px] text-emerald-400 font-medium">
                        ✓ OTP ကုဒ်ကို Telegram (@SG4DMyanmarBot) သို့ ပေးပို့လိုက်ပါပြီ!
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  {t('passwordLabel')} *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-dark-bg border border-gold-900 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white focus:border-gold-400 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl gold-gradient-btn text-dark-bg font-extrabold text-xs tracking-wider shadow-gold transition-all cursor-pointer"
              >
                {loading ? (lang === 'mm' ? 'အကောင့်ဖွင့်နေပါသည်...' : 'Registering...') : t('registerBtn')}
              </button>
            </>
          )}

          {/* MODE 3: FORGOT PASSWORD (Reset with Telegram OTP) */}
          {authMode === 'forgot_password' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  {t('userIdOrPhoneLabel')}
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t('userIdOrPhonePlaceholder')}
                    className="w-full bg-dark-bg border border-gold-900 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white font-mono focus:border-gold-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Telegram OTP Request for Reset */}
              <div className="p-3.5 rounded-2xl bg-dark-card border border-gold-700/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gold-300 flex items-center space-x-1.5">
                    <Send className="w-3.5 h-3.5 text-sky-400" />
                    <span>{t('sendOtpBtn')}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleRequestTelegramOtp}
                    disabled={otpSending}
                    className="text-[11px] text-sky-400 hover:text-sky-300 underline font-bold cursor-pointer"
                  >
                    {otpSending ? t('sendingOtp') : (otpSent ? t('resendOtpBtn') : t('sendOtpBtn'))}
                  </button>
                </div>

                <div className="space-y-2">
                  <a
                    href={telegramDeepLink || `https://t.me/SG4DMyanmarBot?start=otp_${phone.trim()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 text-white" />
                    <span>{lang === 'mm' ? 'Telegram Bot (@SG4DMyanmarBot) ဖွင့်၍ OTP ရယူရန်' : 'Open Telegram Bot (@SG4DMyanmarBot)'}</span>
                  </a>

                  <input
                    type="text"
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder={t('enterOtpPlaceholder')}
                    maxLength={6}
                    className="w-full bg-dark-bg border border-gold-900 rounded-lg px-3 py-2 text-xs font-mono font-bold text-center text-white focus:border-gold-400 focus:outline-none"
                  />

                  {sentViaBot ? (
                    <p className="text-[10px] text-emerald-400 font-medium">
                      ✓ OTP ကုဒ်ကို Telegram (@SG4DMyanmarBot) သို့ ပေးပို့လိုက်ပါပြီ!
                    </p>
                  ) : (
                    <p className="text-[10px] text-sky-300/90 leading-relaxed">
                      * {lang === 'mm' ? 'Telegram Bot (@SG4DMyanmarBot) တွင် ကုဒ် ၆ လုံး ရယူပြီး ရိုက်ထည့်ပေးပါ ခင်ဗျာ။' : 'Receive 6-digit code via Telegram Bot and enter it above.'}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  {t('newPasswordLabel')}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={lang === 'mm' ? '•••••••• (အနည်းဆုံး ၆ လုံး)' : '•••••••• (Min 6 characters)'}
                    className="w-full bg-dark-bg border border-gold-900 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white focus:border-gold-400 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl gold-gradient-btn text-dark-bg font-extrabold text-xs tracking-wider shadow-gold transition-all cursor-pointer"
              >
                {loading ? (lang === 'mm' ? 'စကားဝှက် ပြောင်းလဲနေပါသည်...' : 'Resetting Password...') : t('resetPasswordBtn')}
              </button>

              <button
                type="button"
                onClick={() => { setAuthMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
                className="w-full text-center text-xs text-gray-400 hover:text-white flex items-center justify-center space-x-1.5 pt-2 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t('backToLoginBtn')}</span>
              </button>
            </>
          )}

        </form>

        {/* Switch mode */}
        {authMode !== 'forgot_password' && (
          <div className="mt-5 pt-3 border-t border-dark-border text-center">
            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="text-xs text-gold-400 hover:underline font-bold cursor-pointer"
            >
              {authMode === 'login' ? t('goToSignUp') : t('goToLogin')}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
