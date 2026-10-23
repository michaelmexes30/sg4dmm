import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Dices, 
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
  Wallet,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiClient } from '../api/client';

export default function Betting3DForm({ onOpenDeposit, onBetPlaced }) {
  const { user, refreshProfile } = useAuth();
  const { t, lang, num, formatMoney } = useLanguage();

  const [activeDrawData, setActiveDrawData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form inputs
  const [numberInput, setNumberInput] = useState('');
  const [betType, setBetType] = useState('straight'); // 'straight' | 'tote' | 'r'
  const [stakeAmount, setStakeAmount] = useState(1000);
  const [selectedItems, setSelectedItems] = useState([]); // Array of { number: '782', betType: 'straight', amount: 1000, combos: ['782'], totalStake: 1000 }

  // Submitting state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successSlip, setSuccessSlip] = useState(null);

  useEffect(() => {
    load3DData();
  }, []);

  const load3DData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get3DActiveDraw();
      setActiveDrawData(res);
    } catch (err) {
      console.error('Failed to load 3D active draw:', err);
      setErrorMsg(err.message || '3D အချက်အလက်များ ရယူ၍ မရနိုင်ပါ');
    } finally {
      setLoading(false);
    }
  };

  const currentDraw = activeDrawData?.draw;
  const closedSet = new Set(currentDraw?.closed_numbers || []);
  const straightPayout = activeDrawData?.straight_payout || 700.0;
  const totePayout = activeDrawData?.tote_payout || 10.0;
  const minBet = activeDrawData?.min_bet || 100.0;
  const maxBet = activeDrawData?.max_bet || 50000.0;
  const isEnabled = activeDrawData?.is_enabled ?? true;

  // Calculate combinations for permutation (R)
  const getPermutations = (str) => {
    if (str.length !== 3) return [str];
    const results = new Set();
    const chars = str.split('');
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 3; k++) {
          if (i !== j && i !== k && j !== k) {
            results.add(chars[i] + chars[j] + chars[k]);
          }
        }
      }
    }
    return Array.from(results).sort();
  };

  // Wallet and credit calculations
  const totalStake = selectedItems.reduce((sum, item) => sum + item.totalStake, 0);
  const isAgent = user?.role === 'AGENT';
  const isCreditEnabled = !!user?.is_agent_credit_enabled;
  const availableCredit = (isAgent && isCreditEnabled) ? Math.max(0, (user?.credit_limit || 0) - (user?.used_credit || 0)) : 0;
  const hasSufficientFunds = user && ((isAgent && isCreditEnabled) ? (availableCredit >= totalStake && !user?.is_betting_locked) : (user.balance >= totalStake));

  const handleRandomPick = () => {
    const r = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setNumberInput(r);
  };

  const handleAddItem = (e) => {
    e?.preventDefault();
    setErrorMsg('');
    const clean = numberInput.trim().padStart(3, '0');
    if (!clean || clean.length !== 3 || isNaN(clean)) {
      setErrorMsg('ကျေးဇူးပြု၍ 000 မှ 999 အတွင်း ဂဏန်း ၃ လုံး ရိုက်ထည့်ပါ');
      return;
    }

    if (closedSet.has(clean)) {
      setErrorMsg(`ဂဏန်း '${clean}' သည် ယခုပွဲစဉ်အတွက် ထိုးကြေးပိတ်ထားသော Closed Number ဖြစ်ပါသည်`);
      return;
    }

    const amt = Number(stakeAmount) || 1000;
    if (amt < minBet || amt > maxBet) {
      setErrorMsg(`ထိုးကြေးမှာ အနည်းဆုံး ${minBet} ကျပ် မှ အများဆုံး ${maxBet} ကျပ် အထိ ဖြစ်ရပါမည်`);
      return;
    }

    let combos = [clean];
    let totalAmt = amt;

    if (betType === 'r') {
      combos = getPermutations(clean);
      totalAmt = amt * combos.length;
    }

    setSelectedItems(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        number: clean,
        betType: betType,
        amount: amt,
        combos: combos,
        combinationCount: combos.length,
        totalStake: totalAmt
      }
    ]);

    setNumberInput('');
  };

  const removeItem = (id) => {
    setSelectedItems(prev => prev.filter(i => i.id !== id));
  };

  const clearAll = () => {
    setSelectedItems([]);
  };

  const handlePlaceBet = async () => {
    if (!currentDraw?.id) return;
    if (selectedItems.length === 0) {
      setErrorMsg('ထိုးမည့် 3D ဂဏန်း ရွေးချယ်ပေးပါခင်ဗျာ');
      return;
    }
    if (!hasSufficientFunds) {
      setErrorMsg('လက်ကျန်ငွေ မလုံလောက်ပါခင်ဗျာ။ ငွေဖြည့်သွင်းပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      const payloadItems = selectedItems.map(i => ({
        number: i.number,
        bet_type: i.betType,
        amount: i.amount
      }));

      const res = await apiClient.place3DBet(currentDraw.id, payloadItems);
      setSuccessSlip(res);
      setSelectedItems([]);
      await refreshProfile();
      if (onBetPlaced) onBetPlaced(res);
    } catch (err) {
      console.error('Error placing 3D bet:', err);
      setErrorMsg(err.message || '3D ထိုးခြင်း မအောင်မြင်ပါ');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !activeDrawData) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center text-purple-400 gap-3">
        <RotateCcw className="w-8 h-8 animate-spin" />
        <span className="text-xs font-bold font-mono">Thai 3D Loading...</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* Left Column: 3D Entry Pad & Selection */}
      <div className="lg:col-span-7 space-y-5">
        
        {/* Royal Purple 3D Draw Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-950 via-[#1c082e] to-dark-bg border border-purple-500/40 p-5 sm:p-6 shadow-xl shadow-purple-950/40">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Title & Multipliers */}
          <div className="flex flex-wrap items-center justify-between gap-3 relative z-10 pb-4 border-b border-purple-500/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/50 flex items-center justify-center text-purple-300 font-black text-xl shadow-lg shadow-purple-950/60 font-mono">
                3D
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-white tracking-wide">
                    Thai 3D (ထိုင်း ၃ လုံးထီ)
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-400/40 animate-pulse">
                    OFFICIAL
                  </span>
                </div>
                <p className="text-xs text-purple-400/80 font-sans mt-0.5">
                  Thai Government Official Lottery (လစဉ် ၁ ရက် နှင့် ၁၆ ရက်နေ့ ၀၃:၃၀ PM ပေါက်စဉ်)
                </p>
              </div>
            </div>

            {/* Payout Badges */}
            <div className="flex items-center gap-2 font-mono">
              <div className="bg-purple-950/80 border border-purple-500/40 px-4 py-2 rounded-xl text-center shadow-inner">
                <span className="text-[9px] text-purple-300/80 uppercase font-bold block">တည့် / R ပေါက်ဆ</span>
                <span className="text-base font-black text-purple-200">{straightPayout} ဆ</span>
              </div>
            </div>
          </div>

          {/* Draw Date & Cutoff Info */}
          <div className="pt-4 relative z-10 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 text-slate-300">
              <Calendar className="w-4 h-4 text-purple-400" />
              <span>ထွက်မည့်ရက်စွဲ: <strong className="text-white">{currentDraw?.draw_date || 'Upcoming'}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Clock className="w-4 h-4 text-purple-400" />
              <span>ထိုးကြေးပိတ်ချိန်: <strong className="text-amber-300">{currentDraw?.cutoff_time_mmt || '02:30 PM'}</strong></span>
            </div>
          </div>
        </div>

        {/* 3D Bet Input Console */}
        <div className="bg-dark-card border border-purple-500/30 rounded-2xl p-5 shadow-xl space-y-5">
          
          {/* Bet Type Tabs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-purple-300">
                ထိုးလိုသည့် ပုံစံ ရွေးချယ်ပါ (Bet Type):
              </label>
              <button
                type="button"
                onClick={handleRandomPick}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-950/90 hover:bg-purple-900 border border-purple-500/60 text-purple-200 hover:text-white text-xs font-bold transition-all shadow-md shadow-purple-950 cursor-pointer active:scale-95"
                title="Generate Random 3D Number"
              >
                <Dices className="w-3.5 h-3.5 text-purple-300" />
                <Sparkles className="w-3.5 h-3.5 text-fuchsia-300" />
                <span>Lucky Number Pick (ကံစမ်းဂဏန်း)</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs font-bold font-sans">
              <button
                type="button"
                onClick={() => setBetType('straight')}
                className={`py-3 px-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  betType === 'straight'
                    ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black border-purple-300 shadow-lg shadow-purple-950/80'
                    : 'bg-slate-950/80 border-purple-950 text-slate-400 hover:text-white'
                }`}
              >
                <span className="block text-sm">🎯 တည့် (Straight)</span>
                <span className="text-[10px] opacity-80 block font-mono mt-0.5">{straightPayout} ဆ အပြည့်</span>
              </button>

              <button
                type="button"
                onClick={() => setBetType('r')}
                className={`py-3 px-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  betType === 'r'
                    ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black border-purple-300 shadow-lg shadow-purple-950/80'
                    : 'bg-slate-950/80 border-purple-950 text-slate-400 hover:text-white'
                }`}
              >
                <span className="block text-sm">🔀 ပတ်လည် (R / 6 အာ)</span>
                <span className="text-[10px] opacity-80 block font-mono mt-0.5">ဂဏန်း ၆ လုံးစလုံး တည့်ပေါက် ({straightPayout} ဆ)</span>
              </button>
            </div>
          </div>

          {/* Number & Stake Input Form */}
          <form onSubmit={handleAddItem} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-purple-300">
                    3D ဂဏန်း ရိုက်ထည့်ပါ (000 – 999)
                  </label>
                  <button
                    type="button"
                    onClick={handleRandomPick}
                    className="text-[11px] text-fuchsia-400 hover:text-fuchsia-200 flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Lucky Pick</span>
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="e.g. 782"
                  maxLength={3}
                  value={numberInput}
                  onChange={(e) => setNumberInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-purple-500/40 text-purple-200 font-mono font-black text-2xl text-center tracking-widest placeholder-slate-700 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-purple-300 block mb-1">
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
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-purple-500/40 text-purple-200 font-mono font-black text-lg focus:outline-none focus:border-purple-400 pr-12"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-sans">
                    ကျပ်
                  </span>
                </div>

                {/* Quick stake pills */}
                <div className="flex gap-1.5 mt-2">
                  {[500, 1000, 2000, 5000, 10000].map(amt => (
                    <button
                      type="button"
                      key={amt}
                      onClick={() => setStakeAmount(amt)}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        stakeAmount === amt
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-slate-900 border border-purple-950 text-slate-300 hover:text-white'
                      }`}
                    >
                      {amt >= 1000 ? `${amt / 1000}k` : amt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Permutation Preview Banner if BetType === 'r' */}
            {betType === 'r' && numberInput.length === 3 && (
              <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-500/30 text-xs text-purple-200 space-y-1 font-mono animate-fade-in">
                <span className="font-bold font-sans text-purple-300 block">
                  ပတ်လည် ဂဏန်းများ ({getPermutations(numberInput).length} လုံး စုစုပေါင်း Ks {(stakeAmount * getPermutations(numberInput).length).toLocaleString()}):
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {getPermutations(numberInput).map(c => (
                    <span key={c} className="px-2 py-0.5 rounded bg-purple-900/60 border border-purple-500/40 text-purple-200 font-bold">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-purple-600 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-purple-950 hover:brightness-110 cursor-pointer"
            >
              + 3D ဂဏန်း ထည့်သွင်းမည် (Add to Slip)
            </button>
          </form>

        </div>

      </div>

      {/* Right Column: Live 3D Bet Slip */}
      <div className="lg:col-span-5 space-y-4">
        
        <div className="rounded-3xl bg-gradient-to-b from-[#1c082e] to-dark-bg border border-purple-500/40 p-5 sm:p-6 shadow-2xl relative">
          
          <div className="flex items-center justify-between pb-4 border-b border-purple-900/60">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-black text-sm border border-purple-400/40">
                3D
              </div>
              <h3 className="font-extrabold text-white text-base">3D Live Bet Slip (ထိုးမည့်ဘောက်ချာ)</h3>
            </div>
            {selectedItems.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer font-bold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>အားလုံးဖျက်မည်</span>
              </button>
            )}
          </div>

          {/* Draw Info */}
          <div className="mt-3 bg-slate-950/80 border border-purple-500/20 p-3 rounded-2xl flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px] font-sans">ထွက်မည့်ရက်:</span>
              <span className="font-bold text-purple-300">{currentDraw?.draw_date || 'Upcoming'}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px] font-sans">ပိတ်ချိန်:</span>
              <span className="text-white font-bold">{currentDraw?.cutoff_time_mmt || '02:30 PM'}</span>
            </div>
          </div>

          {/* Items list */}
          <div className="my-4 max-h-64 overflow-y-auto space-y-2 pr-1">
            {selectedItems.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2 text-xs">
                <Coins className="w-8 h-8 mx-auto text-purple-600/40" />
                <p>3D ထိုးမည့်ဂဏန်းများ မရွေးချယ်ရသေးပါ</p>
                <p className="text-[11px] text-slate-600">ဘယ်ဘက်မှ ဂဏန်းနှင့် ပုံစံရွေးချယ်၍ ထည့်သွင်းပါ</p>
              </div>
            ) : (
              selectedItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="bg-slate-950/80 border border-purple-500/20 rounded-xl p-3 space-y-2 text-xs font-mono hover:border-purple-500/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-4 text-slate-500 text-[10px]">#{idx + 1}</span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 font-black text-sm tracking-widest border border-purple-500/30">
                        {item.number}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold font-sans bg-slate-900 border border-slate-700 text-purple-300">
                        {item.betType.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-black text-white">
                        Ks {item.totalStake.toLocaleString()}
                      </span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {item.combinationCount > 1 && (
                    <div className="text-[10px] text-slate-400 font-sans flex flex-wrap gap-1">
                      <span>ပတ်လည် {item.combinationCount} လုံး:</span>
                      {item.combos.map(c => (
                        <span key={c} className="text-purple-300 font-mono font-bold">{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Totals & Potential Win */}
          <div className="border-t border-purple-900/60 pt-4 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>စုစုပေါင်း ထိုးကွက်အရေအတွက်:</span>
              <span className="font-mono font-bold text-white">
                {selectedItems.reduce((acc, i) => acc + i.combinationCount, 0)} ကွက်
              </span>
            </div>
            <div className="flex justify-between text-sm font-black">
              <span className="text-slate-200">စုစုပေါင်း ထိုးကြေးငွေ:</span>
              <span className="text-purple-400 font-mono text-base">
                Ks {totalStake.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>တည့်ပေါက်ပါက အနိုင်ရငွေ (၇၀၀ ဆ):</span>
              <span className="font-mono font-bold text-emerald-400">
                Ks {((selectedItems[0]?.amount || 1000) * straightPayout).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Wallet check */}
          <div className="mt-4 pt-3 border-t border-purple-900/60 text-xs">
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
            {!hasSufficientFunds && totalStake > 0 ? (
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
                disabled={submitting || selectedItems.length === 0}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-purple-950 hover:brightness-110 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span>ထိုးကြေး ပေးပို့နေပါသည်...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>3D ထိုးမည် (Place 3D Bet)</span>
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
          <div className="bg-dark-bg border border-purple-500/40 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto border border-purple-400/50 shadow-lg">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h3 className="font-black text-white text-lg">3D ထိုးခြင်း အောင်မြင်ပါသည်!</h3>
              <p className="text-xs text-slate-400 mt-1">
                ဘောက်ချာကုဒ်: <strong className="text-purple-300 font-mono">{successSlip.slip_code}</strong>
              </p>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-purple-900/60 font-mono text-xs space-y-1.5 text-left">
              <div className="flex justify-between">
                <span className="text-slate-400">ပွဲစဉ်ရက်စွဲ:</span>
                <span className="text-white font-bold">{successSlip.draw_date || 'Upcoming'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">စုစုပေါင်း ထိုးကြေး:</span>
                <span className="text-purple-400 font-black">Ks {successSlip.total_stake?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ထိုးကွက်အရေအတွက်:</span>
                <span className="text-white font-bold">{successSlip.items?.length || 0} ကွက်</span>
              </div>
            </div>

            <button
              onClick={() => setSuccessSlip(null)}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              ကောင်းပြီ (Close)
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
