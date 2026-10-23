import React, { useState, useEffect } from 'react';
import { ReceiptText, ChevronDown, ChevronUp, Clock, Calendar, Sparkles, Award, Trophy } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { apiClient } from '../api/client';

const getPrizeTierConfig = (prizeTierStr) => {
  if (!prizeTierStr) {
    return {
      tier: 'DEFAULT_PRIZE',
      icon: '🏆',
      nameMm: 'ပေါက်ဆု',
      nameEn: 'Prize',
      cardClass: 'border-2 border-amber-400 bg-amber-500/20 text-amber-200 shadow-md shadow-amber-500/20',
      badgeClass: 'bg-amber-400 text-dark-bg font-black',
      textClass: 'text-amber-300 font-black',
      payoutClass: 'text-amber-300 font-black'
    };
  }
  const lower = prizeTierStr.toLowerCase();
  
  // 1st Prize: Golden glow
  if (lower.includes('1st') || lower.includes('ပထမ')) {
    return {
      tier: '1ST_PRIZE',
      icon: '🏆',
      nameMm: '၁st ပထမဆု',
      nameEn: '1st Prize',
      cardClass: 'border-2 border-amber-400 bg-gradient-to-r from-amber-500/30 via-yellow-500/25 to-amber-600/30 text-amber-100 shadow-xl shadow-amber-500/30 ring-2 ring-amber-400/50',
      badgeClass: 'bg-gradient-to-r from-amber-400 to-yellow-300 text-dark-bg font-black shadow-sm',
      textClass: 'text-yellow-300 font-black',
      payoutClass: 'text-amber-300 font-black'
    };
  }
  // 2nd Prize: Sky Blue / Cyan
  if (lower.includes('2nd') || lower.includes('ဒုတိယ')) {
    return {
      tier: '2ND_PRIZE',
      icon: '🥈',
      nameMm: '၂nd ဒုတိယဆု',
      nameEn: '2nd Prize',
      cardClass: 'border-2 border-sky-400 bg-gradient-to-r from-sky-500/30 via-cyan-500/25 to-sky-600/30 text-sky-100 shadow-xl shadow-sky-500/30 ring-2 ring-sky-400/50',
      badgeClass: 'bg-gradient-to-r from-sky-400 to-cyan-300 text-dark-bg font-black shadow-sm',
      textClass: 'text-sky-300 font-black',
      payoutClass: 'text-sky-300 font-black'
    };
  }
  // 3rd Prize: Violet / Purple
  if (lower.includes('3rd') || lower.includes('တတိယ')) {
    return {
      tier: '3RD_PRIZE',
      icon: '🥉',
      nameMm: '၃rd တတိယဆု',
      nameEn: '3rd Prize',
      cardClass: 'border-2 border-purple-400 bg-gradient-to-r from-purple-500/30 via-violet-500/25 to-purple-600/30 text-purple-100 shadow-xl shadow-purple-500/30 ring-2 ring-purple-400/50',
      badgeClass: 'bg-gradient-to-r from-purple-400 to-violet-300 text-dark-bg font-black shadow-sm',
      textClass: 'text-purple-300 font-black',
      payoutClass: 'text-purple-300 font-black'
    };
  }
  // Starter Prize: Vibrant Emerald / Green
  if (lower.includes('starter') || lower.includes('အထူး')) {
    return {
      tier: 'STARTER_PRIZE',
      icon: '⭐',
      nameMm: 'အထူးဆု (Starter)',
      nameEn: 'Starter Prize',
      cardClass: 'border-2 border-emerald-400 bg-gradient-to-r from-emerald-500/25 via-teal-500/20 to-emerald-600/25 text-emerald-100 shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400/40',
      badgeClass: 'bg-emerald-500/40 border border-emerald-400 text-emerald-300 font-black',
      textClass: 'text-emerald-300 font-black',
      payoutClass: 'text-emerald-300 font-black'
    };
  }
  // Consolation Prize: Rose / Orange-Coral
  if (lower.includes('consolation') || lower.includes('consolidation') || lower.includes('နှစ်သိမ့်')) {
    return {
      tier: 'CONSOLATION_PRIZE',
      icon: '🎁',
      nameMm: 'နှစ်သိမ့်ဆု (Consolation)',
      nameEn: 'Consolation Prize',
      cardClass: 'border-2 border-rose-400 bg-gradient-to-r from-rose-500/25 via-orange-500/20 to-rose-600/25 text-rose-100 shadow-lg shadow-rose-500/25 ring-1 ring-rose-400/40',
      badgeClass: 'bg-rose-500/40 border border-rose-400 text-rose-300 font-black',
      textClass: 'text-rose-300 font-black',
      payoutClass: 'text-rose-300 font-black'
    };
  }
  // Box / Roll / Permutation Prize
  return {
    tier: 'BONUS_PRIZE',
    icon: '✨',
    nameMm: 'ပတ်လည်ဆု (Box)',
    nameEn: 'Box Prize',
    cardClass: 'border border-amber-400/80 bg-amber-500/20 text-amber-200 shadow-sm',
    badgeClass: 'bg-amber-500/30 border border-amber-400 text-amber-300 font-bold',
    textClass: 'text-amber-300 font-bold',
    payoutClass: 'text-amber-300 font-bold'
  };
};

const getPrizeTierRank = (prizeTierStr) => {
  if (!prizeTierStr) return 99;
  const lower = prizeTierStr.toLowerCase();
  if (lower.includes('1st') || lower.includes('ပထမ')) return 1;
  if (lower.includes('2nd') || lower.includes('ဒုတိယ')) return 2;
  if (lower.includes('3rd') || lower.includes('တတိယ')) return 3;
  if (lower.includes('starter') || lower.includes('အထူး')) return 4;
  if (lower.includes('consolation') || lower.includes('consolidation') || lower.includes('နှစ်သိမ့်')) return 5;
  return 6;
};

export default function BetHistory({ onBetNow, targetSlipCode }) {
  const { t, lang, formatMoney, formatDigits, formatDateTime } = useLanguage();
  const [slips, setSlips] = useState([]);
  const [filter, setFilter] = useState('');
  const [gameFilter, setGameFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadSlips();
  }, [filter, gameFilter]);

  const loadSlips = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getBetHistory(filter, gameFilter);
      setSlips(res || []);
    } catch (err) {
      console.error('Failed to load bet slips:', err);
    } finally {
      setLoading(false);
    }
  };

  // Deep link navigation from Notification Click
  useEffect(() => {
    if (targetSlipCode && slips.length > 0) {
      const matched = slips.find(s => s.slip_code === targetSlipCode || (s.slip_code && s.slip_code.includes(targetSlipCode)));
      if (matched) {
        setExpandedId(matched.id);
        setTimeout(() => {
          const el = document.getElementById(`slip-${matched.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 350);
      }
    }
  }, [targetSlipCode, slips]);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Format label for item, e.g. "3445(R)", "S852(S)", "1234"
  const getItemLabel = (item) => {
    const isR = item.bet_type === 'box' || item.bet_type === 'r' || item.bet_type === 'R';
    const isS = item.bet_type === 'roll' || item.bet_type === 's' || item.bet_type === 'S';
    const typeTag = isR ? '(R)' : (isS ? '(S)' : '');
    return `${formatDigits(item.number)}${typeTag}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header and filters */}
      <div className="glass-panel-gold rounded-2xl p-4 sm:p-5 border border-gold-600/50 shadow-gold">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center space-x-2">
              <ReceiptText className="w-5 h-5 text-gold-400" />
              <span className="gold-gradient-text">{t('slipsTitle')}</span>
            </h2>
            <p className="text-xs text-gold-400/80 mt-0.5">
              {t('slipsSubtitle')}
            </p>
          </div>

          {/* Filters: Game Type & Status */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 self-start sm:self-auto">
            {/* Game Type Filter (4D Gold, 2D Emerald, 3D Purple) */}
            <div className="flex items-center bg-dark-bg/80 p-1 rounded-xl border border-dark-border text-xs">
              <button
                onClick={() => setGameFilter('')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  gameFilter === '' ? 'bg-slate-700 text-white font-extrabold shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                All Games
              </button>
              <button
                onClick={() => setGameFilter('4D')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  gameFilter === '4D' ? 'bg-amber-500 text-dark-bg font-black shadow-md' : 'text-amber-400/80 hover:text-amber-300'
                }`}
              >
                <span>🦚</span>
                <span>4D</span>
              </button>
              <button
                onClick={() => setGameFilter('2D')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  gameFilter === '2D' ? 'bg-emerald-500 text-dark-bg font-black shadow-md' : 'text-emerald-400/80 hover:text-emerald-300'
                }`}
              >
                <span>📈</span>
                <span>2D</span>
              </button>
              <button
                onClick={() => setGameFilter('3D')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  gameFilter === '3D' ? 'bg-purple-600 text-white font-black shadow-md' : 'text-purple-400/80 hover:text-purple-300'
                }`}
              >
                <span>🎲</span>
                <span>3D</span>
              </button>
            </div>

            {/* Status Filters */}
            <div className="flex items-center space-x-1">
              {[
                { val: '', label: t('all') },
                { val: 'PENDING', label: t('pending') },
                { val: 'WON', label: t('won') },
                { val: 'LOST', label: t('lost') }
              ].map((st) => (
                <button
                  key={st.val}
                  onClick={() => setFilter(st.val)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filter === st.val
                      ? 'gold-gradient-btn text-dark-bg shadow-gold-sm font-extrabold'
                      : 'bg-dark-card text-gray-400 hover:text-white border border-dark-border'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Slips List */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="text-center py-12 text-gold-400 font-bold">{t('loadingSlips')}</div>
        ) : slips.length === 0 ? (
          <div className="glass-panel-gold rounded-2xl p-10 text-center text-gray-500 border border-gold-900/50">
            <ReceiptText className="w-12 h-12 mx-auto opacity-30 mb-2 text-gold-400" />
            <p className="text-base font-semibold text-gray-300">{t('noSlips')}</p>
            <p className="text-xs text-gray-400 mt-1 mb-5">{t('noSlipsSub')}</p>
            {onBetNow && (
              <button
                onClick={onBetNow}
                className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl gold-gradient-btn text-dark-bg font-extrabold text-xs tracking-wider shadow-gold hover:shadow-gold-lg transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-dark-bg" />
                <span>{t('betNow')}</span>
              </button>
            )}
          </div>
        ) : (
          slips.map((slip) => {
            const isExpanded = expandedId === slip.id;
            const items = slip.items || [];

            // Collect all winning matches for winning showcase
            const allWinningMatches = [];
            items.forEach(item => {
              if (item.win_details && item.win_details.length > 0) {
                item.win_details.forEach(w => {
                  allWinningMatches.push({
                    ...w,
                    bet_type: item.bet_type,
                    item_number: item.number
                  });
                });
              }
            });

            // Sort all winning matches strictly by Prize Tier:
            // 1st Prize -> 2nd Prize -> 3rd Prize -> Starter Prize -> Consolation Prize -> Other
            allWinningMatches.sort((a, b) => {
              const rankA = getPrizeTierRank(a.prize_tier);
              const rankB = getPrizeTierRank(b.prize_tier);
              if (rankA !== rankB) {
                return rankA - rankB;
              }
              // If same tier, sort by highest payout first
              if ((b.payout || 0) !== (a.payout || 0)) {
                return (b.payout || 0) - (a.payout || 0);
              }
              // Then by 4D number ascending
              const numA = (a.winning_number || a.number || '');
              const numB = (b.winning_number || b.number || '');
              return numA.localeCompare(numB);
            });

            // Helper to get best prize rank for an item
            const getItemBestPrizeRank = (item) => {
              if (!item.win_details || item.win_details.length === 0) return 999;
              let minRank = 999;
              item.win_details.forEach(w => {
                const rank = getPrizeTierRank(w.prize_tier);
                if (rank < minRank) minRank = rank;
              });
              return minRank;
            };

            // Sort items so highest prize winning items appear first in the combination list
            const sortedItems = [...items].sort((a, b) => {
              const rankA = getItemBestPrizeRank(a);
              const rankB = getItemBestPrizeRank(b);
              if (rankA !== rankB) return rankA - rankB;
              if ((b.item_payout || 0) !== (a.item_payout || 0)) return (b.item_payout || 0) - (a.item_payout || 0);
              return (a.number || '').localeCompare(b.number || '');
            });

            const is2D = (slip.game_type === '2D') || (slip.slip_code && slip.slip_code.includes('-2D-'));
            const is3D = (slip.game_type === '3D') || (slip.slip_code && slip.slip_code.includes('-3D-'));
            
            // Resolve accurate draw date (fallback for 2D if legacy slip had 4D draw date)
            let effectiveDrawDate = slip.draw_date;
            if (!effectiveDrawDate || (is2D && effectiveDrawDate === '2026-10-14')) {
              if (slip.slip_code && slip.slip_code.includes('-2D-20261023-')) {
                effectiveDrawDate = '2026-10-23';
              } else if (slip.created_at) {
                effectiveDrawDate = String(slip.created_at).slice(0, 10);
              }
            }

            // Resolve session name for 2D
            let sessionName = slip.draw_session;
            if (!sessionName && is2D) {
              if (slip.draw_time && slip.draw_time.includes('12:01')) {
                sessionName = 'morning';
              } else {
                sessionName = 'evening';
              }
            }

            return (
              <div
                key={slip.id}
                id={`slip-${slip.id}`}
                data-slip-code={slip.slip_code}
                className={`rounded-2xl border overflow-hidden shadow-lg transition-all ${
                  is2D
                    ? (slip.status === 'WON' 
                        ? 'bg-gradient-to-br from-emerald-950 via-[#07241a] to-dark-bg border-emerald-400 shadow-emerald-950/40' 
                        : 'bg-dark-card/90 border-emerald-500/30 hover:border-emerald-500/60')
                    : is3D
                    ? (slip.status === 'WON'
                        ? 'bg-gradient-to-br from-purple-950 via-[#1c082e] to-dark-bg border-purple-400 shadow-purple-950/40'
                        : 'bg-dark-card/90 border-purple-500/30 hover:border-purple-500/60')
                    : (slip.status === 'WON' 
                        ? 'glass-panel-gold border-amber-400/80 shadow-amber-500/20 shadow-md ring-1 ring-amber-400/40' 
                        : 'glass-panel-gold border-gold-700/50 hover:border-gold-500/70')
                }`}
              >
                {/* Main Clean Header Row (မနှိပ်ခင် ပေါင်းချုပ် - ရှင်းလင်းလှပစွာ) */}
                <div
                  onClick={() => toggleExpand(slip.id)}
                  className="p-3.5 sm:p-4 cursor-pointer hover:bg-white/5 transition-colors space-y-2.5"
                >
                  {/* Top Line: Game Badge, Session Pill, Combos count, Status */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {is2D ? (
                        <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 flex items-center gap-1 font-mono">
                          <span>📈</span>
                          <span>Thai 2D</span>
                        </span>
                      ) : is3D ? (
                        <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-400/50 flex items-center gap-1 font-mono">
                          <span>🎲</span>
                          <span>Thai 3D</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/50 flex items-center gap-1 font-mono">
                          <span>🦚</span>
                          <span>4D</span>
                        </span>
                      )}

                      {/* 2D Session Tag */}
                      {is2D && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                          sessionName === 'morning'
                            ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                        }`}>
                          {sessionName === 'morning' ? '☀️ မနက် (၁၂:၀၁)' : '🌙 ညနေ (၀၄:၃၀)'}
                        </span>
                      )}

                      <span className="text-[11px] text-slate-400 font-sans font-medium">
                        ({formatDigits(items.length)} ကွက်)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg border shrink-0 ${
                        slip.status === 'WON'
                          ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow-md'
                          : slip.status === 'PENDING'
                          ? 'bg-gold-950/80 text-gold-300 border-gold-600'
                          : 'bg-dark-bg text-gray-500 border-dark-border'
                      }`}>
                        {slip.status === 'WON' ? `🏆 ${t('won')}` : slip.status === 'PENDING' ? t('pending') : t('lost')}
                      </span>

                      <div className="text-slate-400 p-0.5">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Main Visual Row: ဘယ်နေ့အတွက်လဲ (Left) VS Total ငွေအမောင့် (Right) */}
                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
                    {/* Left: ဘယ်နေ့အတွက်လဲ (Draw Date & Time) */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-white font-black text-sm sm:text-base">
                        <Calendar className={`w-4 h-4 shrink-0 ${is2D ? 'text-emerald-400' : is3D ? 'text-purple-400' : 'text-gold-400'}`} />
                        <span>
                          ထွက်မည့်ရက်: <strong className={`font-mono ${is2D ? 'text-emerald-300' : is3D ? 'text-purple-300' : 'text-gold-300'}`}>{formatDigits(effectiveDrawDate)}</strong>
                        </span>
                        {is2D && (
                          <span className="text-xs text-slate-300 font-normal hidden sm:inline">
                            ({sessionName === 'morning' ? 'မနက်ပိုင်း ၁၂:၀၁' : 'ညနေပိုင်း ၀၄:၃၀'})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[10.5px] text-slate-400 font-mono mt-0.5 truncate">
                        <span>ထိုးချိန်: {formatDateTime(slip.created_at)}</span>
                        <span>•</span>
                        <span>{slip.slip_code}</span>
                      </div>
                    </div>

                    {/* Right: Total ငွေအမောင့် (Total Stake) */}
                    <div className="text-right shrink-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">
                        စုစုပေါင်း ထိုးငွေ
                      </span>
                      <span className={`font-mono font-black text-base sm:text-lg block ${is2D ? 'text-emerald-300' : is3D ? 'text-purple-300' : 'text-gold-300'}`}>
                        Ks {formatMoney(slip.total_stake)}
                      </span>
                      {slip.status === 'WON' && (
                        <span className="font-mono font-black text-amber-300 text-xs block text-right mt-0.5 animate-pulse">
                          🏆 +Ks {formatMoney(slip.total_payout)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Detailed Breakdown */}
                {isExpanded && (
                  <div className="px-3 sm:px-4 pb-4 pt-3 border-t border-white/10 bg-black/40 space-y-4">
                    
                    {/* Voucher Summary Card (ဘယ်နေ့အတွက်၊ မနက်/ညနေ၊ အကွက်အရေအတွက်နှင့် စုစုပေါင်းငွေ) */}
                    <div className={`p-3 sm:p-4 rounded-2xl border grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono shadow-inner ${
                      is2D
                        ? 'bg-emerald-950/40 border-emerald-500/30'
                        : is3D
                        ? 'bg-purple-950/40 border-purple-500/30'
                        : 'bg-slate-950/80 border-gold-500/30'
                    }`}>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">ထီဖွင့်မည့်ရက်:</span>
                        <span className="font-bold text-white text-sm">{formatDigits(effectiveDrawDate)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">ပွဲစဉ် / အချိန်:</span>
                        <span className={`font-bold text-sm ${is2D ? 'text-emerald-300' : is3D ? 'text-purple-300' : 'text-gold-300'}`}>
                          {is2D 
                            ? (sessionName === 'morning' ? '☀️ မနက်ပိုင်း (၁၂:၀၁)' : '🌙 ညနေပိုင်း (၀၄:၃၀)') 
                            : is3D 
                            ? '🎲 Thai 3D (၀၃:၃၀ PM)' 
                            : `🦚 4D (#${slip.draw_number || '-'})`}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">ထိုးကွက် စုစုပေါင်း:</span>
                        <span className="font-bold text-white text-sm">{formatDigits(items.length)} ကွက်</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">စုစုပေါင်း ထိုးငွေ:</span>
                        <span className={`font-bold text-sm ${is2D ? 'text-emerald-300' : is3D ? 'text-purple-300' : 'text-gold-300'}`}>
                          Ks {formatMoney(slip.total_stake)}
                        </span>
                      </div>
                    </div>
                    
                    {/* 1. If WON, Show Dedicated Winning Numbers Showcase */}
                    {slip.status === 'WON' && allWinningMatches.length > 0 && (
                      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/80 via-yellow-950/70 to-amber-950/80 border-2 border-amber-400 shadow-xl shadow-amber-500/20 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-amber-500/30">
                          <div className="flex items-center space-x-2">
                            <Trophy className="w-5 h-5 text-amber-400 animate-bounce" />
                            <div>
                              <span className="font-black text-sm text-yellow-300">
                                {lang === 'mm' ? '🎉 ပေါက်ဆုရရှိသော ဂဏန်းများနှင့် ဆုကြေးများ' : '🎉 Winning Numbers & Prizes'}
                              </span>
                              <p className="text-[10px] text-amber-200/80 font-medium">
                                {lang === 'mm' 
                                  ? `စုစုပေါင်း ပေါက်ဆု ${formatDigits(allWinningMatches.length)} ခု ရရှိပါသည်` 
                                  : `Total ${allWinningMatches.length} winning matches`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-amber-300/90 block font-semibold">
                              {lang === 'mm' ? 'စုစုပေါင်း ဆုငွေ' : 'Total Payout'}
                            </span>
                            <span className="font-mono font-black text-amber-300 text-sm sm:text-base">
                              +{formatMoney(slip.total_payout)}
                            </span>
                          </div>
                        </div>

                        {/* Grid of winning matches cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {allWinningMatches.map((win, wIdx) => {
                            const numVal = win.winning_number || win.number;
                            const tierCfg = getPrizeTierConfig(win.prize_tier);
                            return (
                              <div
                                key={wIdx}
                                className={`p-2.5 rounded-xl border flex items-center justify-between ${tierCfg.cardClass}`}
                              >
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono font-black text-base tracking-wider text-white">
                                      {formatDigits(numVal)}
                                    </span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-md ${tierCfg.badgeClass}`}>
                                      {lang === 'mm' ? tierCfg.nameMm : tierCfg.nameEn}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-gray-300 opacity-90 mt-0.5 block">
                                    {win.multiplier ? `(${formatDigits(win.multiplier)}x ဆုကြေး)` : ''}
                                  </span>
                                </div>
                                <div className="text-right font-mono font-black text-xs sm:text-sm">
                                  <span className={tierCfg.payoutClass}>
                                    +{formatMoney(win.payout)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Combinations count header */}
                    {items.length > 50 && (
                      <div className="text-xs text-gold-300 font-bold bg-dark-card/90 p-2.5 rounded-lg border border-gold-800/60 flex items-center justify-between">
                        <span>{lang === 'mm' ? `စုစုပေါင်း အကွက် ${formatDigits(items.length)} ကွက်` : `Total ${items.length} combinations`}</span>
                        <span className="text-gray-400 text-[11px]">
                          {lang === 'mm' ? 'ပေါက်ဂဏန်းများကို ထိပ်ဆုံးတွင် အရင်ဆုံး ဖော်ပြထားပါသည်' : 'Winning numbers are prioritized at top'}
                        </span>
                      </div>
                    )}

                    {/* Combinations listing */}
                    {sortedItems.slice(0, 50).map((item, itIdx) => {
                      const combos = item.combinations && item.combinations.length > 0 
                        ? item.combinations 
                        : [item.number];
                      const comboCount = combos.length;
                      const comboStake = item.big_amount > 0 
                        ? item.big_amount 
                        : Math.round(item.item_stake / (comboCount || 1));

                      return (
                        <div key={itIdx} className="space-y-2">
                          {/* If slip has multiple items, show subheader */}
                          {items.length > 1 && (
                            <div className="flex items-center justify-between text-xs font-bold text-gold-300 pb-1 border-b border-dark-border">
                              <span className="flex items-center space-x-2">
                                <span>{getItemLabel(item)}</span>
                                {item.is_won === 1 && (
                                  <span className="text-[10px] bg-amber-400 text-dark-bg px-2 py-0.2 rounded font-black">
                                    ★ ပေါက်ဂဏန်း
                                  </span>
                                )}
                              </span>
                              <span>{formatMoney(item.item_stake)}</span>
                            </div>
                          )}

                          {/* Combination grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
                            {combos.map((combo, cIdx) => {
                              const winMatch = item.win_details && item.win_details.find(w => (w.winning_number || w.number) === combo);
                              const isComboWon = Boolean(winMatch);
                              const tierCfg = isComboWon ? getPrizeTierConfig(winMatch.prize_tier) : null;

                              return (
                                <div
                                  key={cIdx}
                                  className={`rounded-xl border transition-all ${
                                    isComboWon
                                      ? `p-2 ${tierCfg.cardClass}`
                                      : 'px-2.5 py-1.5 bg-dark-card border-dark-border/80 text-gray-200'
                                  }`}
                                >
                                  {isComboWon ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className={`font-black tracking-wider text-sm ${tierCfg.textClass}`}>
                                          {formatDigits(combo)}
                                        </span>
                                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-black ${tierCfg.badgeClass}`}>
                                          {tierCfg.icon}
                                        </span>
                                      </div>
                                      <div className="text-[10px] font-bold truncate">
                                        {lang === 'mm' ? tierCfg.nameMm : tierCfg.nameEn}
                                      </div>
                                      <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10.5px]">
                                        <span className="opacity-75 text-gray-300 font-mono">-{formatDigits(comboStake)}</span>
                                        <span className={`font-black font-mono ${tierCfg.payoutClass}`}>
                                          +{formatMoney(winMatch.payout)}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between text-xs font-mono">
                                      <span className={`font-black text-sm tracking-wider ${
                                        is2D ? 'text-emerald-300' : is3D ? 'text-purple-300' : 'text-gold-300'
                                      }`}>
                                        {formatDigits(combo)}
                                      </span>
                                      <span className="text-gray-300 font-bold">
                                        {formatMoney(comboStake)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
