import React, { useState, useEffect } from 'react';
import { Sparkles, Plus, Info, Dices, Clock, Gift, Award, Calendar, CheckSquare, Square } from 'lucide-react';
import { useLanguage, toMyanmarDigits, toEnglishDigits } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import ReviewBetModal from './ReviewBetModal';

export default function BettingForm({
  onAddToSlip,
  activeDraw,
  availableDraws = [],
  selectedDrawIds = [],
  setSelectedDrawIds = () => {}
}) {
  const { t, lang, num, formatMoney, formatDigits } = useLanguage();
  const [number, setNumber] = useState('');
  const [betType, setBetType] = useState('ordinary');
  const [stakeAmount, setStakeAmount] = useState(1000);
  const [preview, setPreview] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [excludedCombos, setExcludedCombos] = useState([]);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Toggle single draw day
  const handleToggleDraw = (drawId) => {
    if (selectedDrawIds.includes(drawId)) {
      // Don't allow unselecting all draws
      if (selectedDrawIds.length > 1) {
        setSelectedDrawIds(selectedDrawIds.filter(id => id !== drawId));
      }
    } else {
      setSelectedDrawIds([...selectedDrawIds, drawId]);
    }
  };

  // Select all remaining draws of the week
  const handleSelectAllDraws = () => {
    const allIds = availableDraws.map(d => d.id);
    setSelectedDrawIds(allIds);
  };

  // Auto calculate when inputs change
  useEffect(() => {
    setExcludedCombos([]);
    if (number.length === 4) {
      calculatePreview();
    } else {
      setPreview(null);
      setErrorMsg('');
    }
  }, [number, betType, stakeAmount]);

  const calculatePreview = async () => {
    try {
      setErrorMsg('');
      const res = await apiClient.calculateStake([
        {
          number: number.trim(),
          bet_type: betType,
          big_amount: Number(stakeAmount) || 0,
          small_amount: 0
        }
      ]);
      if (res.items && res.items.length > 0) {
        setPreview(res.items[0]);
      }
    } catch (err) {
      setErrorMsg(lang === 'mm' ? '၄လုံး ဂဏန်း သို့မဟုတ် ထိုးကြေး သတ်မှတ်ချက် မမှန်ကန်ပါ' : (err.message || 'Invalid 4D number or betting limit'));
      setPreview(null);
    }
  };

  // Toggle excluding/restoring a specific permutation combination
  const toggleExcludeCombo = (combo) => {
    if (excludedCombos.includes(combo)) {
      setExcludedCombos(excludedCombos.filter(c => c !== combo));
    } else {
      setExcludedCombos([...excludedCombos, combo]);
    }
  };

  const handleRestoreAll = () => {
    setExcludedCombos([]);
  };

  const allCombos = preview?.combinations || [];
  const activeCombos = allCombos.filter(c => !excludedCombos.includes(c));
  const activeCount = activeCombos.length;
  const activeTotalStake = activeCount * (Number(stakeAmount) || 0);

  const handleRandomPick = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000).toString();
    setNumber(randomNum);
  };

  const handleRollFirst = () => {
    if (number.length >= 3) {
      const suffix = number.replace(/\D/g, '').slice(-3);
      setNumber(`S${suffix}`);
      setBetType('roll');
    } else {
      setNumber('S789');
      setBetType('roll');
    }
  };

  const handleRollLast = () => {
    if (number.length >= 3) {
      const prefix = number.replace(/\D/g, '').slice(0, 3);
      setNumber(`${prefix}S`);
      setBetType('roll');
    } else {
      setNumber('123S');
      setBetType('roll');
    }
  };

  const handleNumberInput = (val) => {
    const mmDigits = ['၀','၁','၂','၃','၄','၅','၆','၇','၈','၉'];
    const converted = val.replace(/[၀-၉]/g, (d) => mmDigits.indexOf(d));
    const cleaned = converted.toUpperCase().replace(/[^0-9SR]/g, '').slice(0, 4);
    setNumber(cleaned);
    if (cleaned.includes('S') || cleaned.includes('R')) {
      setBetType('roll');
    }
  };

  const handleAdd = async () => {
    if (!preview) {
      if (number.length === 4) {
        try {
          await calculatePreview();
          setIsReviewModalOpen(true);
          return;
        } catch (e) {
          setErrorMsg(lang === 'mm' ? 'ဂဏန်း တွက်ချက်မှု မအောင်မြင်ပါ' : 'Failed to calculate combinations');
          return;
        }
      }
      setErrorMsg(lang === 'mm' ? 'ကျေးဇူးပြု၍ ၄ လုံးဂဏန်း ထည့်သွင်းပေးပါ' : 'Please enter a valid 4D number.');
      return;
    }

    if (activeCount <= 0) {
      setErrorMsg(lang === 'mm' ? 'ကျေးဇူးပြု၍ အနည်းဆုံး ၁ တွဲ ရွေးချယ်ပေးပါ' : 'Please select at least one combination.');
      return;
    }
    if (activeTotalStake <= 0) {
      setErrorMsg(lang === 'mm' ? 'စုစုပေါင်း ထိုးကြေးသည် ၀ ကျပ်ထက် ကြီးရပါမည်' : 'Total stake must be greater than 0.');
      return;
    }

    setErrorMsg('');
    setIsReviewModalOpen(true);
  };

  const handleConfirmReview = (customizedItems) => {
    if (!customizedItems || customizedItems.length === 0) return;

    // Preserve chosen bet type: if R (or box) was selected, keep it as 'r' (R) throughout!
    const effectiveBetType = (betType === 'box' || betType === 'r' || betType === 'R')
      ? 'r'
      : (betType === 'roll' || betType === 's' || betType === 'S')
      ? 'roll'
      : 'ordinary';

    // Convert customized combinations into slip items
    const slipPayload = customizedItems.map((it) => ({
      number: it.number,
      bet_type: effectiveBetType,
      stake_amount: Number(it.stake) || 0,
      big_amount: Number(it.stake) || 0,
      small_amount: 0,
      combination_count: 1,
      combinations: [it.number],
      custom_combinations: [it.number],
      total_stake: Number(it.stake) || 0
    }));

    onAddToSlip(slipPayload);

    // Reset input states
    setNumber('');
    setPreview(null);
    setExcludedCombos([]);
    setIsReviewModalOpen(false);
  };

  const quickStakes = [50, 100, 500, 1000, 2000, 5000, 10000];

  return (
    <div className="glass-panel-gold rounded-2xl p-6 border border-gold-600/40 relative overflow-hidden shadow-gold">
      {/* Background golden ambient highlight */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* 4:30 PM Cut-off Warning & 10% Weekly Bonus Alert Banner */}
      <div className="mb-5 space-y-2.5">
        {/* Cut-off Notice */}
        <div className="p-3 rounded-xl bg-dark-card border border-gold-600/60 text-gold-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gold-400 shrink-0" />
            <span>
              <strong>{t('drawCutoffTitle')}.</strong> {t('drawCutoffSub')}
            </span>
          </div>
          <span className="font-mono font-bold text-gold-400 shrink-0 hidden sm:inline">
            {t('singaporePoolsBrand')}
          </span>
        </div>

        {/* 10% Weekly Bonus Tracker Banner */}
        <div className="p-3 rounded-xl bg-gold-950/70 border border-gold-500/50 text-gold-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Gift className="w-4 h-4 text-gold-400 shrink-0" />
            <span>
              <strong>{t('weeklyBonusTitle')}:</strong> {t('weeklyBonusSub')}
            </span>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="pb-4 mb-4 border-b border-gold-900/50">
        <div>
          <h2 className="text-xl font-black text-white flex items-center space-x-2">
            <span className="gold-gradient-text">{t('minMaxTitle')}</span>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-lg bg-gold-950 text-gold-300 border border-gold-600/60 shadow-gold-sm">
              {t('minMaxLimits')}
            </span>
          </h2>
          <p className="text-xs text-gold-400/80 mt-1 font-medium">
            {t('officialDrawsSchedule')}
          </p>
        </div>
      </div>

      {/* DRAW DAYS SELECTOR (တစ်ပတ်စာ / သက်ဆိုင်ရာနေ့ ရွေးချယ်မှု) */}
      <div className="p-4 rounded-2xl bg-dark-card/90 border border-gold-600/50 shadow-gold-sm mb-5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gold-400" />
            <label className="text-xs font-bold text-gold-200 uppercase tracking-wider">
              {t('selectDrawDays')}
            </label>
          </div>
          {availableDraws.length > 1 && (
            <button
              type="button"
              onClick={handleSelectAllDraws}
              className="text-[11px] font-bold text-gold-400 hover:text-gold-200 underline cursor-pointer"
            >
              {t('allWeek')} ({num(availableDraws.length)} {t('daysUnit')})
            </button>
          )}
        </div>

        <p className="text-[11px] text-gray-400 mb-3">
          {t('selectDrawNotice')}
        </p>

        {/* Draw Day Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {availableDraws.map((draw) => {
            const isSelected = selectedDrawIds.includes(draw.id);
            const getLocalizedDay = () => {
              if (lang === 'mm') {
                if (draw.day_short === 'Wed') return { short: 'ဗုဒ္ဓဟူး', name: 'ဗုဒ္ဓဟူးနေ့' };
                if (draw.day_short === 'Sat') return { short: 'စနေ', name: 'စနေနေ့' };
                if (draw.day_short === 'Sun') return { short: 'တနင်္ဂနွေ', name: 'တနင်္ဂနွေနေ့' };
                return { short: draw.day_short, name: draw.day_name };
              }
              return { short: draw.day_short, name: draw.day_name };
            };
            const dayInfo = getLocalizedDay();

            return (
              <button
                key={draw.id}
                type="button"
                onClick={() => handleToggleDraw(draw.id)}
                className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-gold-500/15 border-gold-500 text-gold-200 shadow-gold-sm'
                    : 'bg-dark-bg/80 border-gold-900/60 text-gray-400 hover:border-gold-700 hover:text-gray-200'
                }`}
              >
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-extrabold text-sm text-white">
                      {dayInfo.short} ({dayInfo.name})
                    </span>
                    {draw.is_today && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-red-950 text-red-300 font-bold border border-red-700">
                        {t('todayBadge')}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-gold-400/90 mt-0.5">
                    {formatDigits(draw.draw_date)}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {lang === 'mm' ? `အကြိမ် #${num(draw.draw_number)}` : `Draw #${draw.draw_number}`}
                  </div>
                </div>

                <div className="ml-2">
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-gold-400 shrink-0" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-600 shrink-0" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 pt-2 border-t border-gold-900/50 flex items-center justify-between text-xs">
          <span className="text-gray-400">
            {t('drawsCount')}:
          </span>
          <span className="font-mono font-bold text-gold-300">
            {num(selectedDrawIds.length)} {t('daysUnit')} ({selectedDrawIds.length > 1 ? t('multiDraw') : t('singleDraw')})
          </span>
        </div>
      </div>

      <div className="space-y-5">
        
        {/* Bet Type Selector (Ordinary, Box, Roll) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-gold-300 uppercase tracking-wider">
              {t('betType')}
            </label>
            <button
              type="button"
              onClick={handleRandomPick}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gold-950/80 hover:bg-gold-900 border border-gold-600/70 text-gold-300 hover:text-white text-xs font-bold transition-all shadow-gold-sm cursor-pointer"
            >
              <Dices className="w-3.5 h-3.5 text-yellow-400" />
              <span>{t('luckyPick')}</span>
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => { setBetType('ordinary'); if(number.includes('R') || number.includes('S')) setNumber(''); }}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                betType === 'ordinary'
                  ? 'gold-gradient-btn text-dark-bg font-extrabold shadow-gold-sm'
                  : 'bg-dark-card text-gray-300 hover:text-gold-200 border border-dark-border hover:border-gold-700'
              }`}
            >
              <span className="text-sm font-bold">{t('ordinary')}</span>
              <span className="text-[10px] opacity-80">{t('ordinarySub')}</span>
            </button>

            <button
              type="button"
              onClick={() => { setBetType('r'); if(number.includes('R') || number.includes('S')) setNumber(''); }}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                betType === 'box' || betType === 'r' || betType === 'R'
                  ? 'gold-gradient-btn text-dark-bg font-extrabold shadow-gold-sm'
                  : 'bg-dark-card text-gray-300 hover:text-gold-200 border border-dark-border hover:border-gold-700'
              }`}
            >
              <span className="text-sm font-bold">R</span>
              <span className="text-[10px] opacity-80">{t('boxSub')}</span>
            </button>

            <button
              type="button"
              onClick={() => { setBetType('roll'); }}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                betType === 'roll'
                  ? 'gold-gradient-btn text-dark-bg font-extrabold shadow-gold-sm'
                  : 'bg-dark-card text-gray-300 hover:text-gold-200 border border-dark-border hover:border-gold-700'
              }`}
            >
              <span className="text-sm font-bold">{t('roll')}</span>
              <span className="text-[10px] opacity-80">{t('rollSub')}</span>
            </button>
          </div>
        </div>

        {/* 4D Number Entry */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-gold-300 uppercase tracking-wider">
              {t('numberEntry')} {betType === 'roll' && <span className="text-gold-400">{t('useSForSeries')}</span>}
            </label>
            {betType === 'roll' && (
              <div className="flex items-center space-x-2 text-[11px]">
                <button onClick={handleRollFirst} className="text-gold-400 hover:underline font-bold cursor-pointer">{t('series1st')}</button>
                <span className="text-gold-700">•</span>
                <button onClick={handleRollLast} className="text-gold-400 hover:underline font-bold cursor-pointer">{t('seriesLast')}</button>
              </div>
            )}
          </div>
          <div className="relative">
            <input
              type="text"
              value={number}
              onChange={(e) => handleNumberInput(e.target.value)}
              placeholder={betType === 'roll' ? (lang === 'mm' ? 'S489 သို့ 123S' : 'e.g. S489 or 123S') : (lang === 'mm' ? '7 1 9 4 (ဥပမာ)' : 'e.g. 7 1 9 4')}
              maxLength={4}
              className={`w-full box-gold-led rounded-2xl px-4 py-4 text-center font-cyber font-black text-gold-led focus:outline-none transition-all ${
                number 
                  ? 'text-4xl sm:text-5xl tracking-[0.35em] pl-[0.35em]' 
                  : 'text-2xl sm:text-3xl placeholder:text-gold-700/60 placeholder:tracking-normal placeholder:font-sans placeholder:font-bold'
              }`}
            />
            {/* Casino Digital LED Status Bar */}
            <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-gold-400/80 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                <span className="font-sans font-bold">{lang === 'mm' ? '၄ လုံးဂဏန်း ရိုက်ထည့်ပါ' : 'Enter 4D Number'}</span>
              </span>
              <span className="font-cyber tracking-widest text-gold-300 font-bold">
                {number ? `${number.length}/4` : '0/4'} DIGITS
              </span>
            </div>
          </div>
          {errorMsg && (
            <p className="text-red-400 text-xs mt-1.5 flex items-center space-x-1">
              <Info className="w-3.5 h-3.5" />
              <span>{errorMsg}</span>
            </p>
          )}
        </div>

        {/* Single Stake Amount (Big/Small မရှိပါ - တစ်မျိုးတည်းသာ) */}
        <div className="bg-dark-card rounded-2xl p-5 border border-gold-700/60 shadow-gold-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-gold-200 flex items-center space-x-1.5">
              <span>{t('stakePerNumber')}</span>
            </span>
            <span className="text-xs text-gold-400 font-mono font-bold">
              {t('minMaxHint')}
            </span>
          </div>

          <div className="relative mb-3">
            <input
              type="text"
              value={lang === 'mm' ? toMyanmarDigits((stakeAmount || 0).toLocaleString()) : (stakeAmount || 0).toLocaleString()}
              onChange={(e) => {
                const eng = toEnglishDigits(e.target.value).replace(/[^0-9]/g, '');
                setStakeAmount(Math.max(0, parseInt(eng, 10) || 0));
              }}
              className="w-full bg-dark-bg border-2 border-gold-800 rounded-xl px-4 py-3 text-right font-mono font-bold text-white text-xl focus:border-gold-400 focus:outline-none pr-16"
            />
            <span className="absolute right-4 top-3.5 text-sm text-gold-400 font-bold">
              {t('currencySymbol')}
            </span>
          </div>

          {/* Quick Amount Selectors */}
          <div className="flex flex-wrap gap-2">
            {quickStakes.map((amt) => (
              <button
                key={`stake-${amt}`}
                type="button"
                onClick={() => setStakeAmount(amt)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
                  stakeAmount === amt
                    ? 'bg-gold-500 text-dark-bg border-gold-400 shadow-gold-sm'
                    : 'bg-dark-bg hover:bg-gold-950 border-gold-800/80 text-gold-200 hover:text-white'
                }`}
              >
                {num(amt.toLocaleString())} {t('currencySymbol')}
              </button>
            ))}
          </div>

          {/* Prize Multiplier Quick Reference */}
          <div className="mt-4 pt-3 border-t border-gold-900/60 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-[11px]">
            <div className="p-1.5 rounded bg-dark-bg border border-gold-900/60">
              <div className="text-gray-400 font-medium">{t('firstPrize')}</div>
              <div className="text-gold-300 font-bold font-mono">{t('firstPrizeRatio')}</div>
            </div>
            <div className="p-1.5 rounded bg-dark-bg border border-gold-900/60">
              <div className="text-gray-400 font-medium">{t('secondPrize')}</div>
              <div className="text-gold-300 font-bold font-mono">{t('secondPrizeRatio')}</div>
            </div>
            <div className="p-1.5 rounded bg-dark-bg border border-gold-900/60">
              <div className="text-gray-400 font-medium">{t('thirdPrize')}</div>
              <div className="text-gold-300 font-bold font-mono">{t('thirdPrizeRatio')}</div>
            </div>
            <div className="p-1.5 rounded bg-dark-bg border border-gold-900/60">
              <div className="text-gray-400 font-medium">{t('starterPrizes')}</div>
              <div className="text-emerald-400 font-bold font-mono">{t('starterPrizeRatio')}</div>
            </div>
            <div className="p-1.5 rounded bg-dark-bg border border-gold-900/60 col-span-2 sm:col-span-1">
              <div className="text-gray-400 font-medium">{t('consolationPrizes')}</div>
              <div className="text-emerald-400 font-bold font-mono">{t('consolationPrizeRatio')}</div>
            </div>
          </div>
        </div>

        {/* Live Stake & Combinations Preview with Interactive Exclude */}
        {preview && (
          <div className="p-3.5 rounded-xl bg-gold-950/70 border border-gold-600/60 shadow-gold-sm">
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <span className="text-xs font-bold text-gold-200">
                  {t('generatedCombos')}: <strong className="text-white">({num(activeCount)} {t('combos')})</strong>
                </span>
                {excludedCombos.length > 0 && (
                  <span className="text-[11px] text-rose-400 ml-2 font-bold">
                    ({num(excludedCombos.length)} {lang === 'mm' ? 'တွဲ ဖယ်ထားသည်' : 'excluded'})
                  </span>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs font-black font-mono text-gold-300">
                  {selectedDrawIds.length > 1
                    ? `${num(activeTotalStake.toLocaleString())} ${t('currencySymbol')} × ${num(selectedDrawIds.length)} ${t('daysUnit')} = ${formatMoney(activeTotalStake * selectedDrawIds.length)}`
                    : `${t('totalStake')}: ${formatMoney(activeTotalStake)}`}
                </div>
                {selectedDrawIds.length > 1 && (
                  <div className="text-[10px] text-gold-400">
                    ({num(selectedDrawIds.length)} {t('daysUnit')} {t('drawsSelected')})
                  </div>
                )}
              </div>
            </div>

            {/* Instruction Tip & Restore Button */}
            <div className="flex items-center justify-between text-[11px] mb-2 px-1">
              <span className="text-gold-400/90 flex items-center space-x-1">
                <span>💡</span>
                <span>{lang === 'mm' ? 'မကြိုက်သော ဂဏန်းကို နှိပ်၍ ဖယ်ထုတ်နိုင်ပါသည် (ပြန်နှိပ်ပါက ပြန်ပါလာပါမည်)' : 'Click any number to exclude or restore it'}</span>
              </span>
              {excludedCombos.length > 0 && (
                <button
                  type="button"
                  onClick={handleRestoreAll}
                  className="text-gold-300 hover:text-white font-bold underline cursor-pointer shrink-0 ml-2"
                >
                  {lang === 'mm' ? 'မူလအားလုံး ပြန်ယူမည်' : 'Restore All'}
                </button>
              )}
            </div>

            {/* Combination Pills with Click to Exclude / Restore */}
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-dark-bg/90 rounded-xl border border-gold-900/60">
              {allCombos.map((c, idx) => {
                const isExcluded = excludedCombos.includes(c);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleExcludeCombo(c)}
                    title={isExcluded ? (lang === 'mm' ? `"${formatDigits(c)}" အား ပြန်ထည့်မည်` : `Restore ${c}`) : (lang === 'mm' ? `"${formatDigits(c)}" အား ဖယ်ထုတ်မည်` : `Exclude ${c}`)}
                    className={`px-2.5 py-1 font-mono text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-1 shadow-sm select-none ${
                      isExcluded
                        ? 'bg-rose-950/40 border border-rose-800 text-rose-400/60 line-through opacity-60 hover:opacity-100 hover:border-gold-500'
                        : 'bg-dark-card hover:bg-rose-950/70 border border-gold-700 hover:border-rose-500 text-gold-300 hover:text-rose-200 group'
                    }`}
                  >
                    <span>{formatDigits(c)}</span>
                    <span className={`text-[10px] ml-1 font-black ${isExcluded ? 'text-rose-400 no-underline' : 'text-gray-500 group-hover:text-rose-400'}`}>
                      {isExcluded ? '✕' : '×'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Error message near action button */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-950/70 border border-red-700/80 text-red-200 text-xs flex items-center space-x-2 animate-fade-in">
            <Info className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Add to slip action */}
        <button
          type="button"
          onClick={handleAdd}
          disabled={!preview || activeTotalStake <= 0}
          className={`w-full py-4 rounded-xl font-extrabold text-sm tracking-wider transition-all flex items-center justify-center space-x-2 ${
            preview && activeTotalStake > 0
              ? 'gold-gradient-btn text-dark-bg shadow-gold cursor-pointer'
              : 'bg-dark-card border border-dark-border text-gray-500 cursor-not-allowed'
          }`}
        >
          <Plus className="w-5 h-5 text-dark-bg" />
          <span>
            {t('addToSlip')} {preview && activeTotalStake > 0 ? `(${formatMoney(activeTotalStake)} / ${lang === 'mm' ? 'ရက်' : 'draw'})` : ''}
          </span>
        </button>

      </div>

      {/* Review & Customize Bet Pop-up Modal */}
      <ReviewBetModal
        key={isReviewModalOpen ? `review-${number}-${stakeAmount}` : 'review-closed'}
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        initialCombos={activeCombos}
        initialStake={Number(stakeAmount) || 1000}
        betType={preview?.bet_type || betType}
        originalNumber={preview?.number || number}
        selectedDrawObjects={availableDraws.filter((d) => selectedDrawIds.includes(d.id))}
        onConfirm={handleConfirmReview}
      />
    </div>
  );
}
