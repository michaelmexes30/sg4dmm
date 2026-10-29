import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  Clock, 
  ShieldAlert, 
  Calendar, 
  Check, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Coins, 
  RotateCcw,
  Zap,
  Lock,
  Layers,
  Award,
  Wallet
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiClient } from '../api/client';

export default function Betting2DForm({ onOpenDeposit, onBetPlaced }) {
  const { user, refreshProfile } = useAuth();
  const { t, lang, num, formatMoney } = useLanguage();

  const [activeDrawData, setActiveDrawData] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Betting mode: 'input' (Type numbers) or 'grid' (Tap 00-99 matrix)
  const [inputMode, setInputMode] = useState('input');
  const [numberInput, setNumberInput] = useState('');
  const [stakeAmount, setStakeAmount] = useState(1000);
  const [selectedNumbers, setSelectedNumbers] = useState([]); // Array of { number: '25', amount: 1000 }

  // Quick Action Shortcuts state
  const [activeQuickTab, setActiveQuickTab] = useState(null); // 'r' | 'pat' | 'double' | 'power' | 'natkhat' | 'brake'

  // Submitting state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successSlip, setSuccessSlip] = useState(null);

  useEffect(() => {
    load2DData();
  }, []);

  const load2DData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get2DActiveDraw();
      setActiveDrawData(res);
      if (res?.active_session?.id) {
        setSelectedSessionId(res.active_session.id);
      } else if (res?.sessions && res.sessions.length > 0) {
        setSelectedSessionId(res.sessions[0].id);
      }
    } catch (err) {
      console.error('Failed to load 2D active draw:', err);
      setErrorMsg(err.message || '2D အချက်အလက်များ ရယူ၍ မရနိုင်ပါ');
    } finally {
      setLoading(false);
    }
  };

  const currentSession = activeDrawData?.sessions?.find(s => s.id === selectedSessionId) || activeDrawData?.sessions?.[0];
  const closedSet = new Set(currentSession?.closed_numbers || []);
  const payoutMultiplier = activeDrawData?.payout_multiplier || 85.0;
  const minBet = activeDrawData?.min_bet || 100.0;
  const maxBet = activeDrawData?.max_bet || 50000.0;
  const isEnabled = activeDrawData?.is_enabled ?? true;

  // Wallet and credit calculations
  const totalStake = selectedNumbers.reduce((sum, item) => sum + item.amount, 0);
  const isAgent = user?.role === 'AGENT';
  const isCreditEnabled = !!user?.is_agent_credit_enabled;
  const availableCredit = (isAgent && isCreditEnabled) ? Math.max(0, (user?.credit_limit || 0) - (user?.used_credit || 0)) : 0;
  const hasSufficientFunds = user && ((isAgent && isCreditEnabled) ? (availableCredit >= totalStake && !user?.is_betting_locked) : (user.balance >= totalStake));

  // Add a single 2D number or multiple
  const addNumbersToSelection = (numsList, amt) => {
    setErrorMsg('');
    const validNums = [];
    numsList.forEach(raw => {
      const clean = String(raw).trim().padStart(2, '0');
      if (clean.length === 2 && !isNaN(clean)) {
        if (!closedSet.has(clean)) {
          validNums.push(clean);
        }
      }
    });

    if (validNums.length === 0) {
      setErrorMsg('ထည့်သွင်းထားသော ဂဏန်းများသည် ပိတ်ဂဏန်းများ သို့မဟုတ် မမှန်ကန်သော ဂဏန်းများ ဖြစ်နေပါသည်');
      return;
    }

    setSelectedNumbers(prev => {
      const existingMap = new Map(prev.map(i => [i.number, i.amount]));
      validNums.forEach(n => {
        existingMap.set(n, amt);
      });
      return Array.from(existingMap.entries()).map(([number, amount]) => ({ number, amount }));
    });
  };

  // Handle Number Input submit
  const handleAddManualInput = (e) => {
    e?.preventDefault();
    if (!numberInput.trim()) return;

    // Split by comma, space, or slash
    const parts = numberInput.split(/[\s,\/]+/).filter(Boolean);
    addNumbersToSelection(parts, Number(stakeAmount) || 1000);
    setNumberInput('');
  };

  // Quick Action Shortcuts:
  // 1. အာ (Reverse / R) for currently typed number
  const handleApplyReverse = () => {
    if (!numberInput.trim()) return;
    const parts = numberInput.split(/[\s,\/]+/).filter(Boolean);
    const toAdd = [];
    parts.forEach(p => {
      const clean = p.trim().padStart(2, '0');
      toAdd.push(clean);
      const rev = clean.split('').reverse().join('');
      toAdd.push(rev);
    });
    addNumbersToSelection(toAdd, Number(stakeAmount) || 1000);
    setNumberInput('');
  };

  // 2. ပတ်ဂဏန်း (Key 0-9)
  const handleApplyPat = (digit) => {
    const list = [];
    for (let i = 0; i <= 9; i++) {
      list.push(`${digit}${i}`);
      if (i !== Number(digit)) {
        list.push(`${i}${digit}`);
      }
    }
    addNumbersToSelection(list, Number(stakeAmount) || 1000);
  };

  // 3. အပူး (Double numbers 00, 11... 99)
  const handleApplyDoubles = () => {
    const list = ['00', '11', '22', '33', '44', '55', '66', '77', '88', '99'];
    addNumbersToSelection(list, Number(stakeAmount) || 1000);
  };

  // 4. ပါဝါ (Power pairs: 05, 16, 27, 38, 49)
  const handleApplyPower = () => {
    const list = ['05', '50', '16', '61', '27', '72', '38', '83', '49', '94'];
    addNumbersToSelection(list, Number(stakeAmount) || 1000);
  };

  // 5. နက္ခတ် (Natkhat pairs: 07, 18, 24, 35, 69)
  const handleApplyNatkhat = () => {
    const list = ['07', '70', '18', '81', '24', '42', '35', '53', '69', '96'];
    addNumbersToSelection(list, Number(stakeAmount) || 1000);
  };

  // 6. ဘရိတ် (Brake 0-9 sum of two digits modulo 10)
  const handleApplyBrake = (brakeDigit) => {
    const target = Number(brakeDigit);
    const list = [];
    for (let i = 0; i <= 99; i++) {
      const s = String(i).padStart(2, '0');
      const sum = (Number(s[0]) + Number(s[1])) % 10;
      if (sum === target) {
        list.push(s);
      }
    }
    addNumbersToSelection(list, Number(stakeAmount) || 1000);
  };

  // Grid cell toggle
  const toggleGridNumber = (numStr) => {
    if (closedSet.has(numStr)) return;
    const exists = selectedNumbers.some(i => i.number === numStr);
    if (exists) {
      setSelectedNumbers(prev => prev.filter(i => i.number !== numStr));
    } else {
      setSelectedNumbers(prev => [...prev, { number: numStr, amount: Number(stakeAmount) || 1000 }]);
    }
  };

  const removeSelectedItem = (numStr) => {
    setSelectedNumbers(prev => prev.filter(i => i.number !== numStr));
  };

  const clearAllSelected = () => {
    setSelectedNumbers([]);
  };

  // Place 2D Bet
  const handlePlaceBet = async () => {
    if (!currentSession) return;
    if (currentSession?.status === 'SETTLED') {
      setErrorMsg('ဤပွဲစဉ်သည် ထွက်ပြီးဖြစ်သောကြောင့် ထိုးခွင့်မရှိတော့ပါ။ ဖွင့်ထားသော ညနေပွဲစဉ်အား ရွေးချယ်ပါခင်ဗျာ။');
      return;
    }
    if (selectedNumbers.length === 0) {
      setErrorMsg('ထိုးမည့် 2D ဂဏန်း ရွေးချယ်ပေးပါခင်ဗျာ');
      return;
    }
    if (!hasSufficientFunds) {
      setErrorMsg('လက်ကျန်ငွေ မလုံလောက်ပါခင်ဗျာ။ ငွေဖြည့်သွင်းပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      const payloadItems = selectedNumbers.map(i => ({
        number: i.number,
        amount: i.amount
      }));

      const res = await apiClient.place2DBet(currentSession.id, payloadItems);
      setSuccessSlip(res);
      setSelectedNumbers([]);
      await refreshProfile();
      if (onBetPlaced) onBetPlaced(res);
    } catch (err) {
      console.error('Error placing 2D bet:', err);
      setErrorMsg(err.message || '2D ထိုးခြင်း မအောင်မြင်ပါ');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !activeDrawData) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center text-emerald-400 gap-3">
        <RotateCcw className="w-8 h-8 animate-spin" />
        <span className="text-xs font-bold font-mono">Thai 2D Loading...</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* Left Column: 2D Entry Pad & Selection */}
      <div className="lg:col-span-7 space-y-5">
        
        {/* Emerald Green 2D Session Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-[#062419] to-dark-bg border border-emerald-500/40 p-5 sm:p-6 shadow-xl shadow-emerald-950/40">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Title & Multiplier Badge */}
          <div className="flex flex-wrap items-center justify-between gap-3 relative z-10 pb-4 border-b border-emerald-500/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 font-black text-xl shadow-lg shadow-emerald-950/60 font-mono">
                2D
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-white tracking-wide">
                    Thai 2D (ထိုင်း ၂ လုံးထီ)
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 animate-pulse">
                    LIVE
                  </span>
                </div>
                <p className="text-xs text-emerald-400/80 font-sans mt-0.5">
                  Thai Stock Exchange (SET) မနက် ၁၂:၀၁ နှင့် ညနေ ၀၄:၃၀ ပေါက်စဉ်
                </p>
              </div>
            </div>

            {/* Payout Multiplier Badge */}
            <div className="bg-emerald-950/80 border border-emerald-500/40 px-3.5 py-2 rounded-2xl text-right font-mono shadow-inner">
              <span className="text-[10px] text-emerald-400/80 uppercase font-bold block">Payout (ပေါက်ဆ)</span>
              <span className="text-xl font-black text-emerald-300">
                1 ကျပ် = {payoutMultiplier} ဆ
              </span>
            </div>
          </div>

          {/* Session Switcher (Morning 12:01 PM vs Evening 04:30 PM) */}
          <div className="pt-4 relative z-10 space-y-3">
            <span className="text-xs font-bold text-emerald-200 block">
              ထိုးလိုသည့် ပွဲစဉ် ရွေးချယ်ပါ (Select Session):
            </span>

            <div className="grid grid-cols-2 gap-3">
              {(activeDrawData?.sessions || []).map(sess => {
                const isSelected = sess.id === currentSession?.id;
                const isMorning = sess.session === 'morning';
                const isSettled = sess.status === 'SETTLED';
                return (
                  <button
                    key={sess.id}
                    onClick={() => setSelectedSessionId(sess.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-slate-950 font-black border-emerald-300 shadow-lg shadow-emerald-900/60 scale-[1.02]'
                        : isSettled
                        ? 'bg-dark-card/60 text-slate-400 border-slate-800 hover:border-slate-700'
                        : 'bg-dark-card/90 text-slate-300 border-emerald-900/60 hover:border-emerald-600 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold flex items-center gap-1.5">
                        {isMorning ? '☀️ မနက်ပိုင်း' : '🌙 ညနေပိုင်း'}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isSelected
                          ? 'bg-black/30 text-emerald-100'
                          : isSettled
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {isSettled ? `ပေါက်ဂဏန်း: ${sess.winning_number || '-'}` : sess.draw_time_mmt}
                      </span>
                    </div>
                    <div className="text-[11px] opacity-90 font-mono flex items-center justify-between">
                      <span>{isSettled ? 'ပွဲစဉ်ပြီးဆုံး' : `ပိတ်ချိန်: ${sess.cutoff_time_mmt}`}</span>
                      {!isSettled && (
                        <span className="text-[10px] text-emerald-400 font-bold animate-pulse">● LIVE</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Market Closed / Notice Banner */}
            {activeDrawData?.market_status === 'CLOSED' && (
              <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 font-sans flex items-center gap-3">
                <span className="text-lg">🌙</span>
                <div className="space-y-0.5">
                  <div className="font-bold text-amber-200">{activeDrawData.market_message}</div>
                  <div className="text-[11px] text-slate-400">ဖွင့်ချိန်: နံနက် ၀၈:၀၀ နာရီ မှ ၁၁:၃၀ AM / ၁၂:၀၁ PM မှ ၀၄:၀၀ PM</div>
                </div>
              </div>
            )}

            {/* Live Thai SET Status Bar */}
            <div className="pt-3 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-300 font-bold">
                  {currentSession?.status === 'OPEN' ? `🟢 LIVE: ${currentSession?.session === 'morning' ? 'မနက် ၁၂:၀၁ ပွဲစဉ်' : 'ညနေ ၀၄:၃၀ ပွဲစဉ်'}` : '🏁 SETTLED - ထွက်ပြီး'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-slate-300 text-[11px]">
                <span>ထွက်မည့်ရက်: <strong className="text-white">{currentSession?.draw_date}</strong></span>
                <span>ထိုးကြေးပိတ်ချိန်: <strong className="text-amber-300">{currentSession?.cutoff_time_mmt || '04:00 PM'}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Input Mode Selector & Shortcuts Toolbar */}
        <div className="bg-dark-card border border-emerald-500/30 rounded-2xl p-4 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-900/40 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setInputMode('input')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  inputMode === 'input'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-900/40'
                    : 'bg-dark-bg text-slate-400 hover:text-white'
                }`}
              >
                ✏️ ဂဏန်းရိုက်ထိုးမည်
              </button>
              <button
                onClick={() => setInputMode('grid')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  inputMode === 'grid'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-900/40'
                    : 'bg-dark-bg text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>00-99 အကွက်ရွေးထိုးမည်</span>
              </button>
            </div>

            <span className="text-[11px] text-emerald-400 font-mono">
              ရွေးပြီး: <strong className="text-white">{selectedNumbers.length}</strong> လုံး
            </span>
          </div>

          {/* Quick Shortcuts Toolbar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-emerald-300 font-bold">
              <span>အမြန်ထိုးနည်းများ (Quick Shortcuts):</span>
              {activeQuickTab && (
                <button
                  onClick={() => setActiveQuickTab(null)}
                  className="text-[11px] text-slate-400 hover:text-rose-400 cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs font-bold">
              <button
                onClick={handleApplyReverse}
                className="py-2 px-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-200 transition-all cursor-pointer text-center"
                title="ရိုက်ထားသောဂဏန်းအား အာ ထိုးမည်"
              >
                🔄 အာ (R)
              </button>
              <button
                onClick={() => setActiveQuickTab(activeQuickTab === 'pat' ? null : 'pat')}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  activeQuickTab === 'pat' ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                }`}
              >
                🎯 ပတ်ဂဏန်း
              </button>
              <button
                onClick={handleApplyDoubles}
                className="py-2 px-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-200 transition-all cursor-pointer text-center"
              >
                👯 အပူး (10)
              </button>
              <button
                onClick={handleApplyPower}
                className="py-2 px-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-200 transition-all cursor-pointer text-center"
              >
                ⚡ ပါဝါ (10)
              </button>
              <button
                onClick={handleApplyNatkhat}
                className="py-2 px-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-200 transition-all cursor-pointer text-center"
              >
                🔮 နက္ခတ် (10)
              </button>
              <button
                onClick={() => setActiveQuickTab(activeQuickTab === 'brake' ? null : 'brake')}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  activeQuickTab === 'brake' ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                }`}
              >
                🛑 ဘရိတ်
              </button>
            </div>

            {/* Quick Tab Expand Panels */}
            {activeQuickTab === 'pat' && (
              <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-2 animate-fade-in">
                <span className="text-[11px] text-emerald-300 font-bold block">
                  ပတ်လိုသော ဂဏန်းတစ်ခုအား ရွေးပါ (ဥပမာ ၂ ပတ်လျှင် ၂၀ မှ ၂၉၊ ၀၂ မှ ၉၂ စုစုပေါင်း ၁၉ လုံး ရွေးပေးပါမည်):
                </span>
                <div className="grid grid-cols-10 gap-1 font-mono">
                  {[0,1,2,3,4,5,6,7,8,9].map(d => (
                    <button
                      key={d}
                      onClick={() => handleApplyPat(d)}
                      className="py-2 rounded-lg bg-emerald-950/80 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/30 text-emerald-300 font-black text-sm transition-colors cursor-pointer"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeQuickTab === 'brake' && (
              <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-2 animate-fade-in">
                <span className="text-[11px] text-emerald-300 font-bold block">
                  ဘရိတ် (ဂဏန်းနှစ်လုံး ပေါင်းခြင်း နောက်ဆုံးဂဏန်း) ရွေးချယ်ပါ:
                </span>
                <div className="grid grid-cols-10 gap-1 font-mono">
                  {[0,1,2,3,4,5,6,7,8,9].map(b => (
                    <button
                      key={b}
                      onClick={() => handleApplyBrake(b)}
                      className="py-2 rounded-lg bg-emerald-950/80 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/30 text-emerald-300 font-black text-sm transition-colors cursor-pointer"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mode 1: Manual Keypad / Input Box */}
          {inputMode === 'input' && (
            <form onSubmit={handleAddManualInput} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-emerald-300 block mb-1">
                    2D ဂဏန်း ရိုက်ထည့်ပါ (00 – 99)
                  </label>
                  <input
                    type="text"
                    placeholder="ဥပမာ 25 သို့ 14, 89"
                    value={numberInput}
                    onChange={(e) => setNumberInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-200 font-mono font-black text-lg placeholder-slate-600 focus:outline-none focus:border-emerald-400"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    ဂဏန်းအများအပြားအား space သို့မဟုတ် ကော်မာ ခြား၍ တစ်ပြိုင်နက် ရိုက်ထည့်နိုင်ပါသည်
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-emerald-300 block mb-1">
                    ထိုးကြေးငွေ (Stake Amount)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step={100}
                      min={minBet}
                      max={maxBet}
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-200 font-mono font-black text-lg focus:outline-none focus:border-emerald-400 pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-sans">
                      ကျပ်
                    </span>
                  </div>

                  {/* Quick stake buttons */}
                  <div className="flex gap-1.5 mt-2">
                    {[500, 1000, 2000, 5000, 10000].map(amt => (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => setStakeAmount(amt)}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                          stakeAmount === amt
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-900 border border-emerald-900/60 text-slate-300 hover:text-white'
                        }`}
                      >
                        {amt >= 1000 ? `${amt / 1000}k` : amt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-950 hover:brightness-110 cursor-pointer"
                >
                  + ဂဏန်း ထည့်သွင်းမည် (Add to Selection)
                </button>
                <button
                  type="button"
                  onClick={handleApplyReverse}
                  className="px-4 py-3 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-black text-xs hover:bg-emerald-900 cursor-pointer"
                  title="ရိုက်ထည့်ထားသော ဂဏန်းအား အာ (R) ဖြင့် နှစ်လုံးလုံး ထည့်မည်"
                >
                  🔄 အာထိုးမည်
                </button>
              </div>
            </form>
          )}

          {/* Mode 2: Interactive 00 - 99 Matrix Grid Picker */}
          {inputMode === 'grid' && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>ထိုးလိုသော ဂဏန်းများကို နှိပ်၍ ရွေးချယ်ပါ:</span>
                <span className="text-[11px] text-slate-400">
                  ထိုးကြေးတစ်ကွက်: <strong className="text-emerald-400 font-mono">{stakeAmount.toLocaleString()} Ks</strong>
                </span>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 font-mono max-h-80 overflow-y-auto p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
                {Array.from({ length: 100 }).map((_, i) => {
                  const numStr = String(i).padStart(2, '0');
                  const isClosed = closedSet.has(numStr);
                  const isSelected = selectedNumbers.some(item => item.number === numStr);

                  return (
                    <button
                      key={numStr}
                      type="button"
                      disabled={isClosed}
                      onClick={() => toggleGridNumber(numStr)}
                      className={`p-2 rounded-xl text-center font-black transition-all cursor-pointer relative ${
                        isClosed
                          ? 'bg-rose-950/40 border border-rose-800/40 text-rose-500 cursor-not-allowed opacity-50'
                          : isSelected
                          ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 font-black shadow-lg shadow-emerald-900/80 scale-105'
                          : 'bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 text-slate-200 hover:text-white'
                      }`}
                    >
                      <span className="text-sm block">{numStr}</span>
                      {isClosed ? (
                        <span className="text-[8px] text-rose-400 block font-sans">ပိတ်</span>
                      ) : (
                        <span className="text-[8px] opacity-70 block font-mono">85x</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Right Column: Live 2D Bet Slip */}
      <div className="lg:col-span-5 space-y-4">
        
        <div className="rounded-3xl bg-gradient-to-b from-[#062419] to-dark-bg border border-emerald-500/40 p-5 sm:p-6 shadow-2xl relative">
          
          <div className="flex items-center justify-between pb-4 border-b border-emerald-900/60">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-black text-sm border border-emerald-400/40">
                2D
              </div>
              <h3 className="font-extrabold text-white text-base">2D Live Bet Slip (ထိုးမည့်ဘောက်ချာ)</h3>
            </div>
            {selectedNumbers.length > 0 && (
              <button
                onClick={clearAllSelected}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer font-bold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>အားလုံးဖျက်မည်</span>
              </button>
            )}
          </div>

          {/* Session Banner in Slip */}
          <div className="mt-3 bg-slate-950/80 border border-emerald-500/20 p-3 rounded-2xl flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px] font-sans">ရွေးချယ်ထားသော ပွဲစဉ်:</span>
              <span className="font-bold text-emerald-300">
                {currentSession?.session_label} • {currentSession?.draw_date}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px] font-sans">ပိတ်ချိန်:</span>
              <span className="text-white font-bold">{currentSession?.cutoff_time_mmt}</span>
            </div>
          </div>

          {/* Selected Numbers List */}
          <div className="my-4 max-h-64 overflow-y-auto space-y-2 pr-1">
            {selectedNumbers.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2 text-xs">
                <Coins className="w-8 h-8 mx-auto text-emerald-600/40" />
                <p>2D ထိုးမည့်ဂဏန်းများ မရွေးချယ်ရသေးပါ</p>
                <p className="text-[11px] text-slate-600">ဘယ်ဘက်မှ ဂဏန်းရိုက်ထည့်ပါ သို့မဟုတ် အကွက်ရွေးချယ်ပါ</p>
              </div>
            ) : (
              selectedNumbers.map((item, idx) => (
                <div
                  key={item.number}
                  className="bg-slate-950/80 border border-emerald-500/20 rounded-xl p-2.5 flex items-center justify-between font-mono text-xs hover:border-emerald-500/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-slate-500 text-[10px]">#{idx + 1}</span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-black text-sm tracking-widest border border-emerald-500/30">
                      {item.number}
                    </span>
                    <span className="text-slate-400 text-[11px] font-sans">ပေါက်ဆ: 85ဆ</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white">
                      Ks {item.amount.toLocaleString()}
                    </span>
                    <button
                      onClick={() => removeSelectedItem(item.number)}
                      className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals & Potential Win */}
          <div className="border-t border-emerald-900/60 pt-4 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>စုစုပေါင်း ဂဏန်းအရေအတွက်:</span>
              <span className="font-mono font-bold text-white">{selectedNumbers.length} လုံး</span>
            </div>
            <div className="flex justify-between text-sm font-black">
              <span className="text-slate-200">စုစုပေါင်း ထိုးကြေးငွေ:</span>
              <span className="text-emerald-400 font-mono text-base">
                Ks {totalStake.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>၁ လုံးပေါက်ပါက အနိုင်ရငွေ:</span>
              <span className="font-mono font-bold text-amber-300">
                Ks {((selectedNumbers[0]?.amount || 1000) * payoutMultiplier).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Balance / Credit Warning or Info */}
          <div className="mt-4 pt-3 border-t border-emerald-900/60 text-xs">
            {isAgent && isCreditEnabled ? (
              <div className="flex items-center justify-between text-amber-300 font-mono">
                <span>အေးဂျင့် Credit လက်ကျန်:</span>
                <span className="font-bold">Ks {availableCredit.toLocaleString()}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-slate-300 font-mono">
                <span>အကောင့်လက်ကျန်ငွေ:</span>
                <span className={`font-bold ${user && user.balance >= totalStake ? 'text-emerald-400' : 'text-rose-400'}`}>
                  Ks {(user?.balance || 0).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mt-3 p-3 rounded-xl bg-rose-950/80 border border-rose-600/50 text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Action */}
          <div className="mt-4">
            {activeDrawData?.market_status === 'CLOSED' || (activeDrawData?.sessions && activeDrawData.sessions.every(s => s.status === 'SETTLED')) ? (
              <button
                disabled
                className="w-full py-3.5 rounded-2xl bg-slate-800 text-slate-400 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 cursor-not-allowed shadow-inner"
              >
                <span>🔒 ယနေ့ 2D ပွဲစဉ်များ ပြီးဆုံးပါပြီ (နံနက် ၀၈:၀၀ နာရီတွင် ပြန်ဖွင့်ပါမည်)</span>
              </button>
            ) : !hasSufficientFunds && totalStake > 0 ? (
              <button
                onClick={onOpenDeposit}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-950 cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                <span>ငွေဖြည့်သွင်းမည် (Top Up Wallet)</span>
              </button>
            ) : (
              <button
                onClick={handlePlaceBet}
                disabled={submitting || selectedNumbers.length === 0}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-950 hover:brightness-110 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span>ထိုးကြေး ပေးပို့နေပါသည်...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>2D ထိုးမည် (Place 2D Bet)</span>
                  </>
                )}
              </button>
            )}
          </div>

        </div>

      </div>

      {/* Success Modal */}
      {successSlip && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-bg border border-emerald-500/40 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-400/50 shadow-lg">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h3 className="font-black text-white text-lg">2D ထိုးခြင်း အောင်မြင်ပါသည်!</h3>
              <p className="text-xs text-slate-400 mt-1">
                ဘောက်ချာကုဒ်: <strong className="text-emerald-300 font-mono">{successSlip.slip_code}</strong>
              </p>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-emerald-900/60 font-mono text-xs space-y-1.5 text-left">
              <div className="flex justify-between">
                <span className="text-slate-400">ပွဲစဉ်:</span>
                <span className="text-white font-bold">{successSlip.draw_date || 'Today'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">စုစုပေါင်း ထိုးကြေး:</span>
                <span className="text-emerald-400 font-black">Ks {successSlip.total_stake?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ဂဏန်းအရေအတွက်:</span>
                <span className="text-white font-bold">{successSlip.items?.length || 0} လုံး</span>
              </div>
            </div>

            <button
              onClick={() => setSuccessSlip(null)}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              ကောင်းပြီ (Close)
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
