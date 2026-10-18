import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage, toMyanmarDigits } from '../context/LanguageContext';
import { 
  Clock, 
  Wallet, 
  PlusCircle, 
  LogOut, 
  User, 
  ShieldCheck, 
  Award, 
  ReceiptText, 
  LineChart,
  Bell,
  Check,
  Tag,
  Sparkles,
  Globe,
  Trophy,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { apiClient } from '../api/client';
import logoImg from '../assets/logo.png';

export default function Navbar({ activeTab, setActiveTab, onOpenDeposit, onNavigateToSlip }) {
  const { user, logout, setIsAuthModalOpen, refreshProfile } = useAuth();
  const { t, lang, toggleLanguage, num, formatDigits } = useLanguage();
  const [mmtTime, setMmtTime] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifDropdownRef = useRef(null);
  const notifListRef = useRef(null);
  const itemRefs = useRef({});
  const pendingReadIds = useRef(new Set());
  const readTimeoutRef = useRef(null);

  // Live Myanmar Standard Time (UTC+6:30) ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const mmtDate = new Date(utc + (6.5 * 3600000));
      
      const hour = mmtDate.getHours();
      const minute = mmtDate.getMinutes().toString().padStart(2, '0');
      const second = mmtDate.getSeconds().toString().padStart(2, '0');
      const isPm = hour >= 12;
      const hour12 = (hour % 12 || 12).toString().padStart(2, '0');
      
      const day = mmtDate.getDate().toString().padStart(2, '0');
      const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthNamesMm = ['ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်', 'ဇူလိုင်', 'သြဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ'];
      const monthIdx = mmtDate.getMonth();
      const year = mmtDate.getFullYear();

      if (lang === 'mm') {
        const timePeriod = isPm ? 'ညနေ' : 'နံနက်';
        const formattedTime = `${timePeriod} ${toMyanmarDigits(hour12)}:${toMyanmarDigits(minute)}:${toMyanmarDigits(second)} နာရီ`;
        const formattedDate = `${toMyanmarDigits(day)} ${monthNamesMm[monthIdx]} ${toMyanmarDigits(year)}`;
        setMmtTime(`${formattedTime} • ${formattedDate}`);
      } else {
        const timePeriod = isPm ? 'PM' : 'AM';
        const formattedTime = `${hour12}:${minute}:${second} ${timePeriod} MMT`;
        const formattedDate = `${day} ${monthNamesEn[monthIdx]} ${year}`;
        setMmtTime(`${formattedTime} • ${formattedDate}`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [lang]);

  // Live polling for notifications and user profile updates every 5 seconds
  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const interval = setInterval(() => {
      loadNotifications();
      if (refreshProfile) {
        refreshProfile();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const loadNotifications = async () => {
    try {
      const data = await apiClient.getNotifications();
      setNotifications(data || []);
      // Reset pending set for already-read items
      if (Array.isArray(data)) {
        data.forEach((n) => {
          if (n.is_read) {
            pendingReadIds.current.add(n.id);
          }
        });
      }
    } catch (err) {
      // ignore
    }
  };

  // Batch mark notifications as read (UI updates immediately, syncs with backend)
  const markAsRead = useCallback((ids) => {
    if (!ids || ids.length === 0) return;

    const newIds = ids.filter((id) => !pendingReadIds.current.has(id));
    if (newIds.length === 0) return;

    newIds.forEach((id) => pendingReadIds.current.add(id));

    // Snappy optimistic local UI update
    setNotifications((prev) =>
      prev.map((n) => (pendingReadIds.current.has(n.id) ? { ...n, is_read: true } : n))
    );

    // Debounce API sync by 250ms so scrolling batches all newly visible items together
    if (readTimeoutRef.current) {
      clearTimeout(readTimeoutRef.current);
    }
    readTimeoutRef.current = setTimeout(() => {
      const idsToSend = Array.from(pendingReadIds.current);
      if (idsToSend.length > 0) {
        apiClient.markNotificationsRead(idsToSend).catch((err) => {
          console.error('Failed to sync notification read status:', err);
        });
      }
    }, 250);
  }, []);

  // Auto-mark visible notifications as read when opening dropdown or scrolling/pulling down
  useEffect(() => {
    if (!showNotifDropdown || !notifListRef.current) return;

    const unreadItems = notifications.filter((n) => !n.is_read && !pendingReadIds.current.has(n.id));
    if (unreadItems.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleIds = [];
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = Number(entry.target.getAttribute('data-notif-id'));
            if (id) {
              visibleIds.push(id);
              observer.unobserve(entry.target);
            }
          }
        });
        if (visibleIds.length > 0) {
          markAsRead(visibleIds);
        }
      },
      {
        root: notifListRef.current,
        threshold: 0.2, // Triggered when at least 20% of the notification item is scrolled into view
      }
    );

    unreadItems.forEach((n) => {
      const el = itemRefs.current[n.id];
      if (el) {
        observer.observe(el);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [showNotifDropdown, notifications, markAsRead]);

  // Click outside listener to close notification dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setShowNotifDropdown(false);
      }
    };
    if (showNotifDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showNotifDropdown]);

  const handleMarkAllRead = async () => {
    try {
      await apiClient.markAllNotificationsRead();
      notifications.forEach((n) => pendingReadIds.current.add(n.id));
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read && !pendingReadIds.current.has(n.id)).length;

  return (
    <header className="sticky top-0 z-40 w-full glass-panel-gold border-b border-gold-600/40">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo & Platform Name (Golden Peacock Theme) */}
          <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer min-w-0" onClick={() => setActiveTab('betting')}>
            <div className="relative w-9 h-9 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-gold-600 via-gold-400 to-gold-200 p-[1.5px] sm:p-[2px] shadow-gold-sm flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-dark-bg rounded-[10px] sm:rounded-[14px] flex items-center justify-center overflow-hidden p-0.5 sm:p-1">
                <img
                  src={logoImg}
                  alt="SG4D"
                  className="w-full h-full object-contain filter drop-shadow"
                />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="font-black text-sm sm:text-lg md:text-2xl tracking-tight gold-gradient-text whitespace-nowrap">
                  {lang === 'mm' ? 'SG4D ရွှေဥဒေါင်း' : 'SG4D Myanmar'}
                </span>
                <span className="hidden md:inline-block text-[10px] bg-gold-950 text-gold-300 font-extrabold px-2 py-0.5 rounded-full border border-gold-600/60 uppercase tracking-wider shrink-0">
                  {t('peacockBadge')}
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-gold-400/90 tracking-wider uppercase font-semibold whitespace-nowrap truncate max-w-[110px] sm:max-w-none">
                {lang === 'mm' ? 'စင်ကာပူ ၄လုံးထီ' : 'Official 4D Agent'}
              </p>
            </div>
          </div>

          {/* Timezone Ticker (Myanmar Standard Time UTC+6:30) */}
          <div className="hidden md:flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-dark-card border border-gold-600/40 text-xs text-gold-300">
            <Clock className="w-3.5 h-3.5 text-gold-400 animate-pulse" />
            <span className="font-mono font-medium">{mmtTime}</span>
          </div>

          {/* Nav Tabs (Golden Accents) */}
          <nav className="hidden lg:flex items-center space-x-1.5">
            <button
              onClick={() => setActiveTab('betting')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'betting'
                  ? 'bg-gradient-to-r from-gold-600 to-gold-500 text-dark-bg font-extrabold shadow-gold-sm'
                  : 'text-gray-300 hover:text-gold-200 hover:bg-dark-hover'
              }`}
            >
              {t('tabBetting')}
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'results'
                  ? 'bg-gradient-to-r from-gold-600 to-gold-500 text-dark-bg font-extrabold shadow-gold-sm'
                  : 'text-gray-300 hover:text-gold-200 hover:bg-dark-hover'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>{t('tabResults')}</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-gold-600 to-gold-500 text-dark-bg font-extrabold shadow-gold-sm'
                  : 'text-gray-300 hover:text-gold-200 hover:bg-dark-hover'
              }`}
            >
              <ReceiptText className="w-4 h-4" />
              <span>{t('tabSlips')}</span>
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'profile'
                  ? 'bg-gradient-to-r from-gold-600 to-gold-500 text-dark-bg font-extrabold shadow-gold-sm'
                  : 'text-gray-300 hover:text-gold-200 hover:bg-dark-hover'
              }`}
            >
              <User className="w-4 h-4" />
              <span>{t('tabProfile')}</span>
            </button>
          </nav>

          {/* User Section (Right: Balance, Noti, MM/EN) */}
          <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
            {user ? (
              <div className="flex items-center space-x-1 sm:space-x-2 relative shrink-0">
                
                {/* 1. Deposit Badge for Agent (ONLY when credit enabled) / Balance Badge for User & Agent when credit disabled */}
                {user.role === 'AGENT' && user.is_agent_credit_enabled ? (
                  <div
                    onClick={() => setActiveTab('profile')}
                    title={lang === 'mm' ? 'အာမခံစပေါ်ငွေ (Security Deposit)' : 'Security Deposit'}
                    className="flex items-center space-x-1 sm:space-x-1.5 bg-dark-card border border-gold-600/50 hover:border-gold-400 px-1.5 py-1 sm:px-3 sm:py-1.5 rounded-xl shadow-gold-sm cursor-pointer transition-all active:scale-95 shrink-0"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <div className="text-left">
                      <p className="text-[8px] sm:text-[10px] text-gold-400 uppercase tracking-wider font-bold leading-none mb-0.5">
                        {lang === 'mm' ? 'စပေါ်ငွေ' : 'Deposit'}
                      </p>
                      <p className="text-[11px] sm:text-sm font-extrabold font-mono text-gold-200 leading-none whitespace-nowrap">
                        {num((user.security_deposit || 0).toLocaleString())} <span className="text-[8px] sm:text-[10px] text-gray-400 font-sans">{t('currencySymbol')}</span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={onOpenDeposit}
                    title={lang === 'mm' ? 'ငွေသွင်း၊ ငွေထုတ် ပြုလုပ်ရန်' : 'Manage Wallet'}
                    className="flex items-center space-x-1 sm:space-x-1.5 bg-dark-card border border-gold-600/50 hover:border-gold-400 px-1.5 py-1 sm:px-3 sm:py-1.5 rounded-xl shadow-gold-sm cursor-pointer transition-all active:scale-95 shrink-0"
                  >
                    <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold-400 shrink-0" />
                    <div className="text-left">
                      <p className="text-[8px] sm:text-[10px] text-gold-400 uppercase tracking-wider font-bold leading-none mb-0.5">
                        {t('balance')}
                      </p>
                      <p className="text-[11px] sm:text-sm font-extrabold font-mono text-gold-200 leading-none whitespace-nowrap">
                        {num((user.balance || 0).toLocaleString())} <span className="text-[8px] sm:text-[10px] text-gray-400 font-sans">{t('currencySymbol')}</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* 1.5 Auto-detected Agent Credit Badge (When role === 'AGENT' AND credit is enabled) */}
                {user.role === 'AGENT' && user.is_agent_credit_enabled && (
                  <div
                    onClick={() => setActiveTab('profile')}
                    title={lang === 'mm' ? 'အေးဂျင့် Credit & ကော်မရှင် စာရင်းကြည့်ရန်' : 'View Agent Credit & Commissions'}
                    className="hidden sm:flex items-center space-x-2 bg-gradient-to-r from-amber-950/80 to-navy-950 border border-amber-500/60 hover:border-amber-400 px-2.5 py-1 sm:px-3.5 sm:py-2 rounded-xl shadow-gold-sm cursor-pointer transition-all active:scale-95 shrink-0"
                  >
                    <div className="text-left font-mono">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] bg-amber-500/20 text-gold-300 font-extrabold px-1.5 py-0.5 rounded border border-amber-500/40">
                          🦚 {user.agent_code || 'AGENT'}
                        </span>
                        {user.is_betting_locked ? (
                          <span className="text-[10px] bg-rose-500/30 text-rose-300 font-bold px-1.5 py-0.5 rounded border border-rose-500/50">
                            🔒 Locked
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-400 font-bold">
                            Credit: {num(Math.max(0, (user.credit_limit || 0) - (user.used_credit || 0)).toLocaleString())} Ks
                          </span>
                        )}
                      </div>
                      {(user.used_credit || 0) > 0 && (
                        <p className="text-[10px] text-rose-400 font-bold mt-0.5 leading-none">
                          {lang === 'mm' ? 'ထိုးကြေးအကြွေး' : 'Used Credit'}: {num((user.used_credit || 0).toLocaleString())} Ks
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* 1.6 Agent Badge when Credit is Disabled */}
                {user.role === 'AGENT' && !user.is_agent_credit_enabled && (
                  <div
                    onClick={() => setActiveTab('profile')}
                    title={lang === 'mm' ? 'Agent စာရင်းကြည့်ရန်' : 'Agent Details'}
                    className="hidden sm:flex items-center space-x-1.5 bg-amber-500/10 border border-amber-500/40 hover:border-amber-400 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all active:scale-95 shrink-0"
                  >
                    <span className="text-[11px] font-extrabold text-amber-300 font-mono">
                      🦚 {user.agent_code || 'AGENT'}
                    </span>
                  </div>
                )}

                {/* 2. Notifications Bell (Noti) */}
                <div className="relative shrink-0" ref={notifDropdownRef}>
                  <button
                    onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                    title={t('noti')}
                    className="p-1.5 sm:p-2.5 rounded-xl bg-dark-card border border-gold-700/60 hover:border-gold-400 text-gray-300 hover:text-white transition-colors relative cursor-pointer shrink-0"
                  >
                    <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold-400" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-gold-500 text-[9px] sm:text-[10px] font-black text-black flex items-center justify-center animate-pulse shadow-gold-sm">
                        {num(unreadCount)}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown */}
                  {showNotifDropdown && (
                    <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-80 bg-dark-surface border border-gold-600/80 rounded-2xl shadow-gold-lg p-3 z-50">
                      <div className="flex items-center justify-between pb-2 border-b border-dark-border mb-2 text-xs">
                        <span className="font-bold text-white flex items-center space-x-1">
                          <Sparkles className="w-3.5 h-3.5 text-gold-400" />
                          <span>{t('noti')} ({num(unreadCount)} {t('notiNew')})</span>
                        </span>
                        {unreadCount > 0 && (
                          <button onClick={handleMarkAllRead} className="text-[10px] text-gold-400 hover:underline">
                            {t('markAllRead')}
                          </button>
                        )}
                      </div>
                      <div 
                        ref={notifListRef}
                        className="max-h-72 sm:max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar"
                      >
                        {notifications.length === 0 ? (
                          <p className="text-xs text-gray-500 py-4 text-center">{t('noNotif')}</p>
                        ) : (
                          notifications.map((n) => {
                            const isWon = n.notif_type === 'PAYOUT_ANNOUNCEMENT' || 
                                          (n.title && (n.title.includes('CONGRATULATIONS') || n.title.includes('You Won') || n.title.includes('ပေါက်')));

                            const isWithdrawSuccess = (n.category === 'Withdraw' || n.title?.includes('ငွေထုတ်') || n.title?.includes('Withdraw')) &&
                                                      (n.title?.includes('ပြီးစီး') || n.title?.includes('Succeeded') || n.title?.includes('accepted'));

                            const isWithdrawRejected = (n.category === 'Withdraw' || n.title?.includes('ငွေထုတ်') || n.title?.includes('Withdraw')) &&
                                                       (n.title?.includes('ပယ်ဖျက်') || n.title?.includes('Rejected') || n.title?.includes('Refunded'));

                            const isWithdrawPending = (n.category === 'Withdraw' || n.title?.includes('ငွေထုတ်') || n.title?.includes('Withdraw')) &&
                                                      (n.title?.includes('Pending') || n.title?.includes('ဆိုင်းငံ့') || n.title?.includes('Submitted'));

                            const cleanNotifMessage = (msg) => (msg || '').replace(/\s*\(\d+\s+winning tickets[^\)]*\)/gi, '');

                            return (
                              <div
                                key={n.id}
                                data-notif-id={n.id}
                                ref={(el) => {
                                  if (el) itemRefs.current[n.id] = el;
                                  else delete itemRefs.current[n.id];
                                }}
                                onClick={() => {
                                  if (!n.is_read) {
                                    apiClient.markAllNotificationsRead().catch(() => {});
                                    setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, is_read: true } : item));
                                  }
                                  setShowNotifDropdown(false);
                                  
                                  if (isWon) {
                                    const match = n.message && n.message.match(/SLIP-[\w-]+/);
                                    const slipCode = match ? match[0] : null;
                                    if (onNavigateToSlip) {
                                      onNavigateToSlip(slipCode);
                                    } else {
                                      setActiveTab('history');
                                    }
                                  } else if (isWithdrawSuccess || isWithdrawRejected || isWithdrawPending) {
                                    if (onOpenDeposit) onOpenDeposit();
                                  }
                                }}
                                className={`p-3 rounded-2xl border transition-all duration-300 cursor-pointer ${
                                  isWon
                                    ? 'bg-gradient-to-br from-amber-950 via-yellow-950/90 to-amber-900 border-2 border-yellow-400 text-yellow-100 shadow-xl shadow-amber-500/30 ring-2 ring-yellow-400/40 hover:scale-[1.02]'
                                    : isWithdrawSuccess
                                    ? 'bg-gradient-to-br from-emerald-950 via-teal-950/90 to-emerald-900 border-2 border-emerald-400 text-emerald-100 shadow-xl shadow-emerald-500/25 ring-1 ring-emerald-400/30 hover:scale-[1.01]'
                                    : isWithdrawRejected
                                    ? 'bg-gradient-to-br from-rose-950 via-red-950/90 to-rose-900 border-2 border-rose-400 text-rose-100 shadow-xl shadow-rose-500/25 ring-1 ring-rose-400/30 hover:scale-[1.01]'
                                    : isWithdrawPending
                                    ? 'bg-dark-card border border-amber-500/60 text-amber-100 shadow-sm'
                                    : n.is_read
                                    ? 'bg-dark-bg/60 border-dark-border text-gray-400 hover:bg-dark-card/60'
                                    : 'bg-dark-card border-gold-600 text-gold-100 font-medium shadow-sm hover:border-gold-400'
                                }`}
                              >
                                {isWon ? (
                                  <div>
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <div className="flex items-center space-x-1.5 text-yellow-300 font-black">
                                        <Trophy className="w-4 h-4 text-yellow-400 animate-bounce shrink-0" />
                                        <span className="text-xs tracking-wide">{n.title}</span>
                                      </div>
                                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-yellow-400 text-dark-bg shrink-0 shadow-sm">
                                        WINNER!
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-yellow-100/90 leading-snug">{cleanNotifMessage(n.message)}</p>
                                    <div className="mt-2.5 pt-1.5 border-t border-yellow-500/30 flex items-center justify-between text-[10.5px] text-yellow-300 font-bold">
                                      <span>{lang === 'mm' ? '👉 ပြေစာနှင့် ပေါက်ဂဏန်းများ ကြည့်မည်' : '👉 View Winning Numbers'}</span>
                                      <span className="text-xs font-black">→</span>
                                    </div>
                                  </div>
                                ) : isWithdrawSuccess ? (
                                  <div>
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <div className="flex items-center space-x-1.5 text-emerald-300 font-bold">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                        <span className="text-xs tracking-wide font-extrabold">{n.title}</span>
                                      </div>
                                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 shrink-0 shadow-sm">
                                        SETTLED
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-emerald-100/95 leading-relaxed">{n.message}</p>
                                    <div className="mt-2 pt-1 border-t border-emerald-500/30 flex items-center justify-between text-[10px] text-emerald-300 font-semibold">
                                      <span>{lang === 'mm' ? '👛 လက်ကျန်ငွေစာရင်း ကြည့်မည်' : '👛 View Wallet'}</span>
                                      <span className="text-xs font-black">→</span>
                                    </div>
                                  </div>
                                ) : isWithdrawRejected ? (
                                  <div>
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <div className="flex items-center space-x-1.5 text-rose-300 font-bold">
                                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                        <span className="text-xs tracking-wide font-extrabold">{n.title}</span>
                                      </div>
                                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500 text-white shrink-0 shadow-sm">
                                        REFUNDED
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-rose-100/95 leading-relaxed">{n.message}</p>
                                    <div className="mt-2 pt-1 border-t border-rose-500/30 flex items-center justify-between text-[10px] text-rose-300 font-semibold">
                                      <span>{lang === 'mm' ? '👛 ပြန်အမ်းငွေစစ်ဆေးပြီး ပြန်လည်ထုတ်ယူမည်' : '👛 Check Refund & Retry'}</span>
                                      <span className="text-xs font-black">→</span>
                                    </div>
                                  </div>
                                ) : isWithdrawPending ? (
                                  <div>
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <div className="flex items-center space-x-1.5 text-amber-300 font-bold">
                                        <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                                        <span className="text-xs tracking-wide font-extrabold">{n.title}</span>
                                      </div>
                                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 border border-amber-500/50 shrink-0">
                                        PENDING
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-amber-100/90 leading-relaxed">{n.message}</p>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="flex items-start justify-between gap-1">
                                      <p className="font-bold text-white mb-0.5">{n.title}</p>
                                      {!n.is_read && (
                                        <span className="w-2 h-2 rounded-full bg-gold-400 shrink-0 mt-1 animate-pulse" />
                                      )}
                                    </div>
                                    <p className="text-[11px] opacity-90 leading-tight">{cleanNotifMessage(n.message)}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Language Toggle (မြန်မာ / ENG) */}
                <button
                  onClick={toggleLanguage}
                  className="flex items-center space-x-1 px-1.5 py-1 sm:px-3 sm:py-2 rounded-xl bg-dark-card border border-gold-600/70 hover:border-gold-400 text-gold-300 text-[11px] sm:text-xs font-black transition-all shadow-gold-sm cursor-pointer shrink-0"
                  title={lang === 'mm' ? 'English သို့ ပြောင်းမည်' : 'Switch to Myanmar'}
                >
                  <Globe className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                  <span className="tracking-wider">{lang === 'mm' ? 'မြန်မာ' : 'ENG'}</span>
                </button>

              </div>
            ) : (
              <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
                <button
                  onClick={toggleLanguage}
                  className="flex items-center space-x-1 px-1.5 py-1 sm:px-3 sm:py-2 rounded-xl bg-dark-card border border-gold-600/70 text-gold-300 text-[11px] sm:text-xs font-black transition-all cursor-pointer shrink-0"
                >
                  <Globe className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                  <span>{lang === 'mm' ? 'မြန်မာ' : 'ENG'}</span>
                </button>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl gold-gradient-btn text-dark-bg font-extrabold text-[11px] sm:text-xs tracking-wider shadow-gold transition-all shrink-0 whitespace-nowrap"
                >
                  <User className="w-3.5 h-3.5 text-dark-bg shrink-0" />
                  <span>{lang === 'mm' ? 'အကောင့်ဝင်မည်' : 'Login'}</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
