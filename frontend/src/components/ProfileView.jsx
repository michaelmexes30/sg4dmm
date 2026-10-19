import React, { useState, useEffect } from 'react';
import { 
  User, 
  Phone, 
  Tag, 
  Wallet, 
  ShieldCheck, 
  Lock, 
  History, 
  Headphones, 
  LogOut, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Send, 
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Check,
  Users,
  Sparkles,
  AlertTriangle,
  Award,
  Shield,
  Trophy
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiClient } from '../api/client';

export default function ProfileView({ onOpenWallet, onOpenAdmin }) {
  const { user, logout } = useAuth();
  const { t, lang, num, formatMoney, formatDigits, formatDateTime } = useLanguage();

  const isAgent = user?.role === 'AGENT';
  const [activeSection, setActiveSection] = useState(isAgent ? 'agent' : 'history'); // 'agent' | 'history' | 'password' | 'contact'
  
  // Agent Summary State
  const [agentData, setAgentData] = useState(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const isCreditEnabled = Boolean(agentData?.is_agent_credit_enabled ?? user?.is_agent_credit_enabled);

  // Transaction History State
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txFilter, setTxFilter] = useState('ALL'); // 'ALL' | 'DEPOSIT' | 'WITHDRAWAL'

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  useEffect(() => {
    loadTransactions();
    if (user?.role === 'AGENT') {
      loadAgentSummary();
    }
  }, [user]);

  const loadAgentSummary = async () => {
    try {
      setAgentLoading(true);
      const res = await apiClient.getAgentSummary();
      setAgentData(res);
    } catch (err) {
      console.error('Failed to load agent summary:', err);
    } finally {
      setAgentLoading(false);
    }
  };

  const handleCopyAgentCode = () => {
    const code = agentData?.agent_code || user?.agent_code || 'AGT8899';
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const loadTransactions = async () => {
    try {
      setTxLoading(true);
      const data = await apiClient.getMyTransactions();
      setTransactions(data || []);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setTxLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (newPassword.length < 6) {
      setPwError(lang === 'mm' ? 'စကားဝှက်အသစ်သည် အနည်းဆုံး ၆ လုံး ရှိရပါမည်။' : 'New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError(lang === 'mm' ? 'စကားဝှက်အသစ် နှစ်ခု တူညီမှုမရှိပါ။' : 'New passwords do not match.');
      return;
    }

    try {
      setPwLoading(true);
      const res = await apiClient.changePassword(currentPassword, newPassword);
      setPwSuccess(res.message || (lang === 'mm' ? 'စကားဝှက် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။' : 'Password updated successfully!'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwError(err.message || (lang === 'mm' ? 'စကားဝှက် ပြောင်းလဲခြင်း မအောင်မြင်ပါ။' : 'Failed to change password.'));
    } finally {
      setPwLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(t => {
    if (txFilter === 'ALL') return true;
    return t.tx_type === txFilter;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* 1. User Profile Header Card */}
      <div className="glass-panel-gold rounded-3xl p-6 border border-gold-600/60 shadow-gold relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-gold-600 to-gold-400 p-[2px] shadow-gold-sm flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-dark-bg rounded-[14px] flex items-center justify-center">
                <User className="w-8 h-8 text-gold-300" />
              </div>
            </div>
            
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black text-white">{user?.username || user?.full_name || 'Player'}</h2>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-gold-950 text-gold-300 border border-gold-600/60">
                  {isAgent ? `⭐ ${agentData?.level || user?.level || 'Level 1'} Agent` : (user?.role || 'USER')}
                </span>
              </div>
              <p className="text-xs text-gold-400/90 font-mono mt-0.5 flex items-center space-x-1">
                <Phone className="w-3.5 h-3.5" />
                <span>{formatDigits(user?.phone)}</span>
              </p>
              
              {/* Linked Agent info */}
              <div className="mt-2 flex items-center space-x-2 text-xs">
                <span className="text-gray-400">{t('agentBound')}:</span>
                <span className="px-2 py-0.5 rounded-lg bg-dark-card border border-gold-700/80 font-mono font-bold text-gold-300 flex items-center space-x-1">
                  <Tag className="w-3 h-3 text-gold-400" />
                  <span>{user?.referred_by_code || user?.agent_code || 'AGT8899'}</span>
                  <CheckCircle2 className="w-3 h-3 text-green-400 ml-1" />
                </span>
              </div>
            </div>
          </div>

          {/* Balance & Wallet Action */}
          <div className="w-full sm:w-auto p-4 rounded-2xl bg-dark-card border border-gold-600/50 flex sm:flex-col items-center sm:items-end justify-between gap-3 shadow-gold-sm">
            {isAgent && (user?.is_agent_credit_enabled || agentData?.is_agent_credit_enabled) ? (
              <div className="text-left sm:text-right">
                <p className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">
                  {lang === 'mm' ? 'အာမခံ စပေါ်ငွေ (Deposit)' : 'Security Deposit'}
                </p>
                <p className="text-2xl font-black font-mono text-gold-200">
                  {formatMoney(user?.security_deposit || 0)}
                </p>
                <div className="text-xs font-mono text-emerald-400 font-bold mt-1">
                  Credit: {num(Math.max(0, (user?.credit_limit || 0) - (user?.used_credit || 0)).toLocaleString())} Ks
                </div>
              </div>
            ) : (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gold-400 font-bold">{t('currentBalance')}</p>
                <p className="text-2xl font-black font-mono text-gold-200">
                  {formatMoney(user?.balance || 0)}
                </p>
              </div>
            )}
            {onOpenWallet && (
              <button
                type="button"
                onClick={onOpenWallet}
                className="px-4 py-2 rounded-xl gold-gradient-btn text-dark-bg font-extrabold text-xs shadow-gold transition-all active:scale-95 cursor-pointer flex items-center space-x-1.5"
              >
                <Wallet className="w-3.5 h-3.5 text-dark-bg" />
                <span>{lang === 'mm' ? 'ငွေသွင်း / ငွေထုတ်' : 'Top Up / Withdraw'}</span>
              </button>
            )}
            {isAgent && (
              <button
                type="button"
                onClick={() => setActiveSection('agent')}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-dark-bg font-extrabold text-xs shadow-gold transition-all active:scale-95 cursor-pointer flex items-center space-x-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-dark-bg" />
                <span>{lang === 'mm' ? 'Agent စာရင်းကြည့်ရန်' : 'Agent Details'}</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* 2. Sub-Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-gold-900/60 pb-2 overflow-x-auto">
        {isAgent && (
          <button
            type="button"
            onClick={() => setActiveSection('agent')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeSection === 'agent'
                ? 'gold-gradient-btn text-dark-bg shadow-gold-sm font-extrabold'
                : 'bg-dark-card text-gold-300 hover:text-white border border-gold-600/50'
            }`}
          >
            <Sparkles className="w-4 h-4 text-gold-400" />
            <span>🦚 Agent Dashboard</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveSection('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeSection === 'history'
              ? 'gold-gradient-btn text-dark-bg shadow-gold-sm font-extrabold'
              : 'bg-dark-card text-gray-400 hover:text-white border border-dark-border'
          }`}
        >
          <History className="w-4 h-4" />
          <span>{t('cashHistoryTitle')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('password')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeSection === 'password'
              ? 'gold-gradient-btn text-dark-bg shadow-gold-sm font-extrabold'
              : 'bg-dark-card text-gray-400 hover:text-white border border-dark-border'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>{t('changePassword')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('contact')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeSection === 'contact'
              ? 'gold-gradient-btn text-dark-bg shadow-gold-sm font-extrabold'
              : 'bg-dark-card text-gray-400 hover:text-white border border-dark-border'
          }`}
        >
          <Headphones className="w-4 h-4" />
          <span>{t('contactUsTitle')}</span>
        </button>
      </div>

      {/* 3. Section Content */}

      {/* SECTION 0: Agent Dashboard (Auto-detected for Agent accounts) */}
      {isAgent && activeSection === 'agent' && (
        <div className="space-y-5">
          {/* Status Alert Banner */}
          {agentData?.is_betting_locked ? (
            <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/50 flex items-start space-x-3 text-rose-200 text-xs">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-rose-300">
                  {lang === 'mm' ? '⚠️ အပတ်စဉ် စာရင်းရှင်းရန် ကျန်ရှိနေပါသည် (ထိုးခွင့်ယာယီပိတ်ထားပါသည်)' : '⚠️ Weekly Settlement Overdue (Betting Locked)'}
                </p>
                <p className="mt-1 leading-relaxed opacity-90">
                  {lang === 'mm' 
                    ? `သင်၏ အပတ်စဉ် မရှင်းရသေးသော အကြွေးကျန်ငွေ (${(agentData?.used_credit || 0).toLocaleString()} ကျပ်) ရှိနေပါသဖြင့် 30% ကော်မရှင်ကို ဆိုင်းငံ့ထားပြီး ထိုးခွင့်ယာယီပိတ်ထားပါသည်။ ကျေးဇူးပြု၍ Admin ထံ စာရင်းရှင်းလင်းပေးပါခင်ဗျာ။`
                    : `You have an overdue credit balance of ${(agentData?.used_credit || 0).toLocaleString()} MMK. 30% commission is withheld and betting is locked. Please contact Admin to clear settlement.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-gold-950/70 border border-gold-600/40 flex items-start space-x-3 text-gold-200 text-xs">
              <Sparkles className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-gold-300">
                  {lang === 'mm' ? '🦚 တရားဝင် Agent Dashboard (30% ကော်မရှင် & ခရက်ဒစ် စနစ်)' : '🦚 Official Agent Dashboard (30% Cashback & Credit)'}
                </p>
                <p className="mt-1 leading-relaxed opacity-90 text-[11px]">
                  {lang === 'mm'
                    ? 'မိမိ Agent Code ဖြင့် ကစားသူများ၏ ထိုးကြေး (သို့မဟုတ်) မိမိကိုယ်တိုင် တင်သော ထိုးကြေးအားလုံး၏ 30% ကော်မရှင်ကို အပတ်စဉ် အင်္ဂါနေ့ နံနက် ၁၁:၀၀ နာရီတွင် အပြီးသတ်ရှင်းလင်း ထည့်သွင်းပေးပါမည်။'
                    : 'Earn 30% commission on both player bets and self-placed bets. Settled every Tuesday at 11:00 AM MMT.'}
                </p>
              </div>
            </div>
          )}

          {/* Agent Level & VIP Tier Progress Card */}
          {agentData?.level_info && (
            <div className="glass-panel-gold rounded-2xl p-5 border border-gold-600/50 shadow-gold space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gold-900/60 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-300 p-[1.5px] flex items-center justify-center shrink-0">
                    <div className="w-full h-full bg-dark-bg rounded-xl flex items-center justify-center text-lg">
                      ⭐
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-black text-white">
                        {lang === 'mm' ? 'Agent Level အဆင့် သတ်မှတ်ချက်' : 'Agent Level Status'}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-amber-500/20 text-gold-300 border border-amber-500/40">
                        {agentData.level_info.level}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {isCreditEnabled
                        ? (lang === 'mm'
                            ? `စပေါ်ငွေပေါ်မူတည်ပြီး Credit (${agentData.level_info.credit_multiplier || 1.6} ဆ) ခံစားခွင့်ရရှိပါမည်`
                            : `${agentData.level_info.credit_multiplier || 1.6}x Credit Multiplier on Security Deposit`)
                        : (lang === 'mm'
                            ? 'လောင်းကြေးများကို Cash Balance ဖြင့် တိုက်ရိုက်ထိုးခွင့်ရရှိပါသည်'
                            : 'Bets placed directly with Cash Balance')}
                    </p>
                  </div>
                </div>

                {/* Credit Multiplier Tag or Commission Tag */}
                <div className="flex items-center space-x-2 bg-dark-bg/80 px-3 py-1.5 rounded-xl border border-gold-700/60">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-300">
                    {isCreditEnabled 
                      ? `${agentData.level_info.credit_multiplier || 1.6}x Credit Benefit` 
                      : `${agentData?.level_info?.commission_rate_str || agentData?.commission_rate_str || '15%'} Commission Benefit`}
                  </span>
                </div>
              </div>

              {/* Turnover Breakdown 3 Cols */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-dark-bg/90 border border-dark-border">
                  <span className="text-[10px] text-gray-400 block font-semibold">
                    {lang === 'mm' ? 'မိမိကိုယ်တိုင် ထိုးကြေး' : 'Agent Self-Bets Turnover'}
                  </span>
                  <p className="text-sm font-black font-mono text-gold-200 mt-1">
                    {num((agentData.level_info.self_turnover || 0).toLocaleString())} <span className="text-[10px] text-gray-400 font-normal">Ks</span>
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-dark-bg/90 border border-dark-border">
                  <span className="text-[10px] text-gray-400 block font-semibold">
                    {lang === 'mm' ? 'လက်အောက် ကစားသူများ ထိုးကြေး' : 'Downline Players Turnover'}
                  </span>
                  <p className="text-sm font-black font-mono text-gold-200 mt-1">
                    {num((agentData.level_info.downline_turnover || 0).toLocaleString())} <span className="text-[10px] text-gray-400 font-normal">Ks</span>
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-dark-bg/90 border border-amber-500/40">
                  <span className="text-[10px] text-amber-300 block font-bold">
                    {lang === 'mm' ? 'စုစုပေါင်း ထိုးကြေး (Combined)' : 'Total Combined Turnover'}
                  </span>
                  <p className="text-sm font-black font-mono text-amber-400 mt-1">
                    {num((agentData.level_info.total_turnover || 0).toLocaleString())} <span className="text-[10px] text-amber-300 font-normal">Ks</span>
                  </p>
                </div>
              </div>

              {/* Level Up Progress */}
              {agentData.level_info.next_level ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300">
                      {lang === 'mm' ? 'နောက်ထပ်တက်ရောက်မည့်အဆင့်:' : 'Next Level:'} <strong className="text-gold-300">{agentData.level_info.next_level}</strong>
                      <span className="text-gray-400 ml-2">
                        ({lang === 'mm' ? 'ထပ်မံလိုအပ်သော ထိုးကြေး:' : 'Required:'} {num((agentData.level_info.turnover_remaining || 0).toLocaleString())} Ks)
                      </span>
                    </span>
                    <span className="font-mono font-bold text-amber-400">
                      {num(agentData.level_info.progress_percent)}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-dark-bg border border-dark-border overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-gold-300 transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, agentData.level_info.progress_percent))}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/40 text-center text-xs text-purple-300 font-bold flex items-center justify-center space-x-2">
                  <Award className="w-4 h-4 text-purple-400" />
                  <span>{lang === 'mm' ? '🏆 အမြင့်ဆုံး Level 5 (Diamond / Master Agent) သို့ ရောက်ရှိပြီးဖြစ်ပါသည်!' : '🏆 Max Level 5 (Diamond Master Agent) Reached!'}</span>
                </div>
              )}
            </div>
          )}

          {/* Cash Balance Mode Banner (When Credit is Suspended) */}
          {agentData && !isCreditEnabled && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="font-bold block">
                    {lang === 'mm' ? 'Cash Balance စနစ်ဖြင့် တိုက်ရိုက်လောင်းနိုင်ပါသည်' : 'Cash Balance Betting Mode Active'}
                  </span>
                  <span className="text-[11px] text-gray-300">
                    {lang === 'mm'
                      ? `လုံခြုံရေးအရ Agent Credit စနစ်အား ခေတ္တဆိုင်းငံ့ထားပြီး မိမိ Wallet Balance ဖြင့်သာ တိုက်ရိုက်လောင်းကြေးထိုးခွင့် ရရှိပါမည်။ (${agentData?.level_info?.commission_rate_str || agentData?.commission_rate_str || '15%'} ကော်မရှင် ဆက်လက်ရရှိပါသည်)`
                      : `Agent bets deduct from Cash Balance while Credit is suspended. You continue to earn ${agentData?.level_info?.commission_rate_str || agentData?.commission_rate_str || '15%'} weekly commissions.`}
                  </span>
                </div>
              </div>
              {onOpenWallet && (
                <button
                  type="button"
                  onClick={onOpenWallet}
                  className="px-3.5 py-1.5 rounded-xl gold-gradient-btn text-dark-bg text-xs font-extrabold shrink-0 cursor-pointer shadow-gold"
                >
                  {lang === 'mm' ? 'ငွေသွင်းမည်' : 'Top Up Wallet'}
                </button>
              )}
            </div>
          )}

          {/* 4 Agent Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* Card 1: Agent Code */}
            <div className="glass-panel-gold rounded-2xl p-4 border border-gold-600/40">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">{lang === 'mm' ? 'မိမိ Agent Code' : 'Agent Invite Code'}</span>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xl font-black font-mono text-gold-300">{agentData?.agent_code || user?.agent_code || 'AGT8899'}</span>
                <button
                  type="button"
                  onClick={handleCopyAgentCode}
                  className="px-2.5 py-1 rounded-lg bg-dark-bg border border-gold-700/80 hover:border-gold-400 text-gold-300 text-[11px] font-bold flex items-center space-x-1 cursor-pointer transition-all active:scale-95"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? (lang === 'mm' ? 'ကူးပြီး' : 'Copied') : (lang === 'mm' ? 'ကူးမည်' : 'Copy')}</span>
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">ကစားသူများ အကောင့်ဖွင့်ရာတွင် အသုံးပြုရန်</p>
            </div>

            {/* Card 2: When credit enabled -> Deposit & Credit Limit | When credit suspended -> Wallet Balance */}
            {isCreditEnabled ? (
              <div className="glass-panel-gold rounded-2xl p-4 border border-gold-600/40">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">{lang === 'mm' ? 'စပေါ်ငွေ / Credit ထိုးခွင့်' : 'Deposit / Credit Limit'}</span>
                <p className="text-lg font-black font-mono text-purple-300 mt-1.5">
                  {num((agentData?.credit_limit || 0).toLocaleString())} <span className="text-xs text-gray-400 font-normal">Ks</span>
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  စပေါ်ငွေ: <span className="text-amber-300 font-mono font-bold">{num((agentData?.security_deposit || 0).toLocaleString())} Ks</span>
                </p>
              </div>
            ) : (
              <div className="glass-panel-gold rounded-2xl p-4 border border-gold-600/40">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">{lang === 'mm' ? 'လက်ကျန်ငွေ (Wallet Balance)' : 'Wallet Balance'}</span>
                <p className="text-lg font-black font-mono text-gold-200 mt-1.5">
                  {formatMoney(user?.balance || agentData?.balance || 0)}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {lang === 'mm' ? 'ထိုးကြေးအဖြစ် သုံးစွဲနိုင်သော လက်ကျန်ငွေ' : 'Available cash for betting'}
                </p>
              </div>
            )}

            {/* Card 3: When credit enabled -> Used Credit & Available Credit | When credit suspended -> Downline Players */}
            {isCreditEnabled ? (
              <div className="glass-panel-gold rounded-2xl p-4 border border-gold-600/40">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">{lang === 'mm' ? 'ရရှိနိုင်သော Credit ကျန်ငွေ' : 'Available Credit'}</span>
                <p className="text-lg font-black font-mono text-emerald-300 mt-1.5">
                  {num((agentData?.available_credit || 0).toLocaleString())} <span className="text-xs text-gray-400 font-normal">Ks</span>
                </p>
                <p className={`text-[10px] mt-1 font-mono ${(agentData?.used_credit || 0) > 0 ? 'text-rose-400 font-bold' : 'text-gray-400'}`}>
                  မရှင်းရသေးသောအကြွေး: {num((agentData?.used_credit || 0).toLocaleString())} Ks
                </p>
              </div>
            ) : (
              <div className="glass-panel-gold rounded-2xl p-4 border border-gold-600/40">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">{lang === 'mm' ? 'လက်အောက် ကစားသူများ' : 'Downline Players'}</span>
                <p className="text-lg font-black font-mono text-emerald-300 mt-1.5">
                  {num(agentData?.downline_players?.length || 0)} <span className="text-xs text-gray-400 font-normal">{lang === 'mm' ? 'ဦး' : 'Players'}</span>
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {lang === 'mm' ? 'မိမိကုဒ်ဖြင့် အကောင့်ဖွင့်ထားသူများ' : 'Registered under your invite code'}
                </p>
              </div>
            )}

            {/* Card 4: Commission Breakdown */}
            <div className="glass-panel-gold rounded-2xl p-4 border border-gold-600/40">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">
                {lang === 'mm' ? `အပတ်စဉ် ${agentData?.level_info?.commission_rate_str || agentData?.commission_rate_str || ''} ကော်မရှင်` : `Weekly ${agentData?.level_info?.commission_rate_str || agentData?.commission_rate_str || ''} Commission`}
              </span>
              <p className="text-lg font-black font-mono text-gold-200 mt-1.5">
                +{num((agentData?.pending_commission || 0).toLocaleString())} <span className="text-xs text-amber-400 font-normal">(Pending)</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                ထုတ်ယူပြီး: <span className="text-emerald-400 font-mono font-bold">{num((agentData?.settled_commission || 0).toLocaleString())} Ks</span>
              </p>
            </div>

          </div>

          {/* Downline Players List & Recent Commission Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* Left 5 Cols: Downline Players */}
            <div className="lg:col-span-5 glass-panel-gold rounded-2xl p-4 border border-gold-600/40 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gold-900/40">
                <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <Users className="w-4 h-4 text-gold-400" />
                  <span>{lang === 'mm' ? 'လက်အောက် ကစားသူများ' : 'Downline Players'} ({agentData?.downline_players_count || 0})</span>
                </h4>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {(!agentData?.downline_players || agentData.downline_players.length === 0) ? (
                  <p className="text-xs text-gray-500 py-6 text-center">
                    {lang === 'mm' ? 'လက်အောက် ကစားသူ မရှိသေးပါ' : 'No downline players yet'}
                  </p>
                ) : (
                  agentData.downline_players.map((p, idx) => (
                    <div key={p.id || idx} className="p-2.5 rounded-xl bg-dark-bg/80 border border-dark-border flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-white">{p.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{p.phone}</p>
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">{p.joined_at}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right 7 Cols: Recent 30% Commissions */}
            <div className="lg:col-span-7 glass-panel-gold rounded-2xl p-4 border border-gold-600/40 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gold-900/40">
                <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <Award className="w-4 h-4 text-gold-400" />
                  <span>{lang === 'mm' ? 'လတ်တလော ကော်မရှင် မှတ်တမ်းများ' : 'Recent Commission Logs'}</span>
                </h4>
                <button
                  type="button"
                  onClick={loadAgentSummary}
                  className="text-[10px] text-gold-400 hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${agentLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {(!agentData?.recent_commissions || agentData.recent_commissions.length === 0) ? (
                  <p className="text-xs text-gray-500 py-6 text-center">
                    {lang === 'mm' ? 'ကော်မရှင် မှတ်တမ်း မရှိသေးပါ' : 'No commission records yet'}
                  </p>
                ) : (
                  agentData.recent_commissions.map((c, idx) => (
                    <div key={c.id || idx} className="p-2.5 rounded-xl bg-dark-bg/80 border border-dark-border flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white">{c.player_name}</span>
                          <span className="text-[10px] font-mono text-gray-400">({c.voucher})</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          ထိုးကြေး: <span className="font-mono text-gray-300">{num((c.bet_total_stake || 0).toLocaleString())} Ks</span> • {c.created_at}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-emerald-400 text-xs block">
                          +{num((c.commission_amount || 0).toLocaleString())} Ks
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                          c.settlement_status === 'SETTLED'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {c.settlement_status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* SECTION 1: Cash In / Cash Out History */}
      {activeSection === 'history' && (
        <div className="glass-panel-gold rounded-2xl p-5 border border-gold-700/60 shadow-gold space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <History className="w-4 h-4 text-gold-400" />
              <span>{t('cashHistoryTitle')}</span>
            </h3>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={loadTransactions}
                className="p-1.5 rounded-lg bg-dark-card border border-gold-900/60 text-gold-400 hover:text-white transition-colors cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${txLoading ? 'animate-spin' : ''}`} />
              </button>
              
              {['ALL', 'DEPOSIT', 'WITHDRAWAL', 'WIN_PAYOUT'].map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTxFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    txFilter === f
                      ? 'bg-gold-500 text-dark-bg'
                      : 'bg-dark-card text-gray-400 hover:text-white border border-dark-border'
                  }`}
                >
                  {f === 'ALL' 
                    ? t('filterAll') 
                    : (f === 'DEPOSIT' 
                    ? t('filterDeposit') 
                    : (f === 'WITHDRAWAL' 
                    ? t('filterWithdraw') 
                    : `🏆 ${t('filterPrize')}`))}
                </button>
              ))}
            </div>
          </div>

          {txLoading ? (
            <div className="text-center py-10 text-gold-400 text-xs font-bold">{t('loadingTransactions')}</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 space-y-2">
              <History className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-xs font-medium text-gray-400">{t('noTransactions')}</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {filteredTransactions.map(tx => {
                const isDeposit = tx.tx_type === 'DEPOSIT';
                const isPrize = tx.tx_type === 'WIN_PAYOUT';
                const isApproved = tx.status === 'AUTO_APPROVED' || tx.status === 'COMPLETED';
                const isPending = tx.status === 'MANUAL_REVIEW';
                
                return (
                  <div
                    key={tx.id}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                      isPrize
                        ? 'bg-gradient-to-r from-amber-950/60 via-dark-card to-yellow-950/40 border-amber-500/70 shadow-amber-500/10 shadow-md'
                        : 'bg-dark-card/90 border-gold-900/60 hover:border-gold-700/80'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-xl border ${
                        isPrize
                          ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 shadow-amber-500/20 shadow-sm'
                          : isDeposit 
                          ? 'bg-green-950/60 border-green-500/50 text-green-400' 
                          : 'bg-rose-950/60 border-rose-500/50 text-rose-400'
                      }`}>
                        {isPrize ? (
                          <Trophy className="w-4 h-4 text-amber-400 animate-pulse" />
                        ) : isDeposit ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className={`font-bold text-xs uppercase tracking-wider flex items-center space-x-1 ${
                            isPrize ? 'text-amber-300 font-extrabold' : 'text-white'
                          }`}>
                            {isPrize && <Sparkles className="w-3.5 h-3.5 text-amber-400 inline mr-1" />}
                            <span>{isPrize ? t('winPayoutAction') : isDeposit ? t('cashInAction') : t('cashOutAction')}</span>
                          </span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                            isPrize
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                              : 'bg-dark-bg text-gold-300 border-gold-800'
                          }`}>
                            {tx.gateway?.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                          {t('txIdLabelOnly')}: <strong className={`${isPrize ? 'text-amber-200' : 'text-gray-300'}`}>{formatDigits(tx.transaction_id)}</strong>
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {formatDateTime(tx.created_at || tx.tx_timestamp_mmt)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className={`font-mono font-black text-sm ${
                        isPrize ? 'text-amber-300 text-base drop-shadow-sm' : isDeposit ? 'text-green-400' : 'text-rose-400'
                      }`}>
                        {(isDeposit || isPrize) ? '+' : '-'}{formatMoney(tx.amount)}
                      </p>
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded mt-1 border ${
                        isPrize
                          ? 'bg-amber-950/80 text-amber-300 border-amber-500/60 font-black'
                          : isApproved
                          ? 'bg-green-950/80 text-green-300 border-green-600'
                          : isPending
                          ? 'bg-amber-950/80 text-amber-300 border-amber-600'
                          : 'bg-rose-950/80 text-rose-300 border-rose-700'
                      }`}>
                        {isPrize 
                          ? (lang === 'mm' ? 'ဆုကြေးထုတ်ပြီး' : 'PAID OUT')
                          : tx.status === 'AUTO_APPROVED' 
                          ? t('approved') 
                          : tx.status === 'MANUAL_REVIEW' 
                          ? t('underReview') 
                          : tx.status === 'COMPLETED' 
                          ? t('completed') 
                          : tx.status === 'REJECTED' 
                          ? t('rejected') 
                          : tx.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: Change Password */}
      {activeSection === 'password' && (
        <div className="glass-panel-gold rounded-2xl p-6 border border-gold-700/60 shadow-gold max-w-lg mx-auto">
          <h3 className="text-base font-bold text-white flex items-center space-x-2 mb-4">
            <Lock className="w-4 h-4 text-gold-400" />
            <span>{t('changePassword')}</span>
          </h3>

          {pwError && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/70 border border-red-600 text-red-200 text-xs text-center font-medium">
              {pwError}
            </div>
          )}

          {pwSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-green-950/70 border border-green-600 text-green-200 text-xs text-center font-medium">
              {pwSuccess}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">{t('oldPassword')}</label>
              <div className="relative">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-dark-bg border border-gold-900 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-gold-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
                >
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">{t('newPassword')}</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={lang === 'mm' ? '•••••••• (အနည်းဆုံး ၆ လုံး)' : '•••••••• (Min 6 characters)'}
                  className="w-full bg-dark-bg border border-gold-900 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-gold-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
                >
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">{t('confirmPassword')}</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-dark-bg border border-gold-900 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-gold-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={pwLoading}
              className="w-full py-3 rounded-xl gold-gradient-btn text-dark-bg font-extrabold text-xs shadow-gold transition-all cursor-pointer"
            >
              {pwLoading ? (lang === 'mm' ? 'စကားဝှက် ပြောင်းလဲနေပါသည်...' : 'Updating...') : t('updatePasswordBtn')}
            </button>
          </form>
        </div>
      )}

      {/* SECTION 3: Contact Us */}
      {activeSection === 'contact' && (
        <div className="glass-panel-gold rounded-2xl p-6 border border-gold-700/60 shadow-gold max-w-lg mx-auto space-y-4">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <Headphones className="w-5 h-5 text-gold-400" />
            <span>{t('contactUsTitle')}</span>
          </h3>

          <p className="text-xs text-gray-400">
            {lang === 'mm' 
              ? 'ပြဿနာတစ်ခုခု ကြုံတွေ့ပါက သို့မဟုတ် အကူအညီ လိုအပ်ပါက အောက်ပါ တရားဝင် လိုင်းများမှ ၂၄ နာရီ ဆက်သွယ်မေးမြန်းနိုင်ပါသည် ခင်ဗျာ။' 
              : 'Need assistance or have questions? Contact our official customer service team anytime.'}
          </p>

          <div className="space-y-3 pt-2">
            
            {/* Telegram Bot */}
            <a
              href="https://t.me/SG4DMyanmarOfficial_bot"
              target="_blank"
              rel="noreferrer"
              className="p-3.5 rounded-xl bg-dark-card border border-sky-600/40 hover:border-sky-400 transition-all flex items-center justify-between text-xs text-white group cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-sky-950 text-sky-400 border border-sky-700">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-sky-300">{t('contactBot')}</p>
                  <p className="text-[11px] text-gray-400 font-mono">@SG4DMyanmarOfficial_bot</p>
                </div>
              </div>
              <span className="text-[11px] text-sky-400 group-hover:underline font-bold">
                {t('openTelegram')}
              </span>
            </a>

            {/* Telegram Channel */}
            <a
              href="https://t.me/SG4DMyanmarOfficial"
              target="_blank"
              rel="noreferrer"
              className="p-3.5 rounded-xl bg-dark-card border border-gold-600/40 hover:border-gold-400 transition-all flex items-center justify-between text-xs text-white group cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-gold-950 text-gold-400 border border-gold-700">
                  <Headphones className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-gold-300">{t('contactChannel')}</p>
                  <p className="text-[11px] text-gray-400 font-mono">@SG4DMyanmarOfficial</p>
                </div>
              </div>
              <span className="text-[11px] text-gold-400 group-hover:underline font-bold">
                {t('joinChannel')}
              </span>
            </a>

            {/* Support Phone / Agent */}
            <div className="p-3.5 rounded-xl bg-dark-card border border-dark-border flex items-center justify-between text-xs text-white">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-dark-bg text-gold-400 border border-gold-900">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-gray-200">{t('contactPhone')}</p>
                  <p className="text-[11px] text-gold-400 font-mono font-bold">
                    {lang === 'mm' ? '၀၉၇၇၇၇၇၇၇၇၇, ၀၉၈၈၈၈၈၈၈၈၈' : '09777777777, 09888888888'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-green-400 font-mono font-bold bg-green-950 px-2 py-0.5 rounded border border-green-800">
                {lang === 'mm' ? 'နံနက် ၀၈:၀၀ - ည ၀၈:၀၀ နာရီ' : '08:00 AM - 08:00 PM'}
              </span>
            </div>

          </div>
        </div>
      )}

      {/* 4. Log Out Action (Cleanly situated in Profile) */}
      <div className="pt-4 border-t border-gold-900/40 text-center">
        <button
          type="button"
          onClick={() => {
            if (window.confirm(t('signOutConfirm'))) {
              logout();
            }
          }}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-rose-600/15 border border-rose-500/40 hover:bg-rose-600 hover:text-white text-rose-400 text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>{t('signOutBtn')}</span>
        </button>
      </div>

    </div>
  );
}
