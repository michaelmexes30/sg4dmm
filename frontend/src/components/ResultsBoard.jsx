import React, { useState, useEffect } from 'react';
import { 
  Award, Calendar, Trophy, Sparkles, RefreshCw, Layers, 
  Globe, CheckCircle2, Users, Coins, Flame, AlertCircle, ChevronRight, Crown,
  Medal, Star, Gift
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { apiClient } from '../api/client';

export default function ResultsBoard() {
  const { t, lang, num, formatDigits, formatMoney } = useLanguage();
  const [draws, setDraws] = useState([]);
  const [recentWinners, setRecentWinners] = useState([]);
  const [selectedDrawIndex, setSelectedDrawIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [winnerTierFilter, setWinnerTierFilter] = useState('ALL');
  const [activeGameResult, setActiveGameResult] = useState('4D'); // '4D' | '2D' | '3D'
  const [results2D, setResults2D] = useState([]);
  const [results3D, setResults3D] = useState([]);
  const [loading2D, setLoading2D] = useState(false);
  const [loading3D, setLoading3D] = useState(false);

  useEffect(() => {
    if (activeGameResult === '2D' && results2D.length === 0) {
      load2DResults();
    } else if (activeGameResult === '3D' && results3D.length === 0) {
      load3DResults();
    }
  }, [activeGameResult]);

  const load2DResults = async () => {
    try {
      setLoading2D(true);
      const res = await apiClient.get2DResults(25);
      setResults2D(res || []);
    } catch (err) {
      console.error('Failed to load 2D results:', err);
    } finally {
      setLoading2D(false);
    }
  };

  const load3DResults = async () => {
    try {
      setLoading3D(true);
      const res = await apiClient.get3DResults(20);
      setResults3D(res || []);
    } catch (err) {
      console.error('Failed to load 3D results:', err);
    } finally {
      setLoading3D(false);
    }
  };

  useEffect(() => {
    loadDraws();
    loadRecentWinners();
  }, []);

  const loadDraws = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getDraws();
      const completedDraws = (res || []).filter(d => Boolean(d.first_prize));
      setDraws(completedDraws);
      setSelectedDrawIndex(0);
    } catch (err) {
      console.error('Failed to load draws:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentWinners = async () => {
    try {
      const rw = await apiClient.getRecentWinners(20);
      setRecentWinners(rw || []);
    } catch (err) {
      console.error('Failed to load recent winners:', err);
    }
  };

  const handleSyncWithSingaporePools = async () => {
    try {
      setSyncing(true);
      setSyncMessage(null);
      const res = await apiClient.syncSingaporePools();
      if (res && res.message) {
        setSyncMessage(res.message);
      }
      await loadDraws();
      await loadRecentWinners();
    } catch (err) {
      setSyncMessage(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const currentDraw = draws[selectedDrawIndex] || null;
  const drawWinners = currentDraw?.winners || [];
  const totalWinnersCount = drawWinners.length;
  const totalDrawPayout = drawWinners.reduce((sum, w) => sum + (w.payout_amount || 0), 0);

  // Filter winners by tier
  const filteredWinners = drawWinners.filter((w) => {
    if (winnerTierFilter === 'ALL') return true;
    if (winnerTierFilter === '1ST') return w.prize_tier === '1st Prize';
    if (winnerTierFilter === '2ND') return w.prize_tier === '2nd Prize';
    if (winnerTierFilter === '3RD') return w.prize_tier === '3rd Prize';
    if (winnerTierFilter === 'STARTER') return w.prize_tier === 'Starter Prize';
    if (winnerTierFilter === 'CONSOLATION') return w.prize_tier === 'Consolation Prize';
    return true;
  });

  const getWinnerTierRank = (tier) => {
    if (!tier) return 99;
    const lower = tier.toLowerCase();
    if (lower.includes('1st') || lower.includes('ပထမ')) return 1;
    if (lower.includes('2nd') || lower.includes('ဒုတိယ')) return 2;
    if (lower.includes('3rd') || lower.includes('တတိယ')) return 3;
    if (lower.includes('starter') || lower.includes('အထူး')) return 4;
    if (lower.includes('consolation') || lower.includes('consolidation') || lower.includes('နှစ်သိမ့်')) return 5;
    return 6;
  };

  // Sort winners strictly by prize tier rank (1st -> 2nd -> 3rd -> Starter -> Consolation),
  // then payout amount descending, then winning number
  const sortedWinners = [...filteredWinners].sort((a, b) => {
    const rankA = getWinnerTierRank(a.prize_tier || a.prize_tier_mm);
    const rankB = getWinnerTierRank(b.prize_tier || b.prize_tier_mm);
    if (rankA !== rankB) return rankA - rankB;
    if ((b.payout_amount || 0) !== (a.payout_amount || 0)) {
      return (b.payout_amount || 0) - (a.payout_amount || 0);
    }
    return String(a.winning_number || '').localeCompare(String(b.winning_number || ''));
  });

  // Check if a specific tier has NIL winner
  const has1stWinner = drawWinners.some(w => w.prize_tier === '1st Prize');
  const has2ndWinner = drawWinners.some(w => w.prize_tier === '2nd Prize');
  const has3rdWinner = drawWinners.some(w => w.prize_tier === '3rd Prize');

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Game Results Selector Bar: 4D (Gold), 2D (Emerald), 3D (Purple) */}
      <div className="bg-dark-card/90 backdrop-blur-xl border border-dark-border p-1.5 sm:p-2 rounded-3xl shadow-xl flex items-center justify-between gap-1.5 sm:gap-2">
        <button
          onClick={() => setActiveGameResult('4D')}
          className={`flex-1 py-3 px-3 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer relative overflow-hidden ${
            activeGameResult === '4D'
              ? 'bg-gradient-to-r from-amber-500 via-gold-400 to-amber-600 text-dark-bg font-black shadow-lg shadow-amber-500/30 scale-[1.01] border border-amber-300'
              : 'bg-dark-bg/60 text-slate-400 hover:text-amber-300 hover:bg-dark-card border border-slate-800'
          }`}
        >
          <span className="text-base sm:text-lg">🦚</span>
          <div className="text-left leading-tight">
            <span className="block text-xs sm:text-sm font-black tracking-wide">Singapore 4D</span>
            <span className={`text-[9px] sm:text-[10px] font-bold block ${activeGameResult === '4D' ? 'text-black/80' : 'text-amber-400/80'}`}>၄လုံးထီ ပေါက်စဉ်</span>
          </div>
        </button>

        <button
          onClick={() => setActiveGameResult('2D')}
          className={`flex-1 py-3 px-3 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer relative overflow-hidden ${
            activeGameResult === '2D'
              ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 text-dark-bg font-black shadow-lg shadow-emerald-500/30 scale-[1.01] border border-emerald-300'
              : 'bg-dark-bg/60 text-slate-400 hover:text-emerald-300 hover:bg-dark-card border border-slate-800'
          }`}
        >
          <span className="text-base sm:text-lg">📈</span>
          <div className="text-left leading-tight">
            <span className="block text-xs sm:text-sm font-black tracking-wide">Thai 2D (SET)</span>
            <span className={`text-[9px] sm:text-[10px] font-bold block ${activeGameResult === '2D' ? 'text-black/80' : 'text-emerald-400/80'}`}>ထိုင်း ၂ လုံးထီ ပေါက်စဉ်</span>
          </div>
        </button>

        <button
          onClick={() => setActiveGameResult('3D')}
          className={`flex-1 py-3 px-3 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer relative overflow-hidden ${
            activeGameResult === '3D'
              ? 'bg-gradient-to-r from-purple-600 via-fuchsia-500 to-purple-700 text-white font-black shadow-lg shadow-purple-600/30 scale-[1.01] border border-purple-300'
              : 'bg-dark-bg/60 text-slate-400 hover:text-purple-300 hover:bg-dark-card border border-slate-800'
          }`}
        >
          <span className="text-base sm:text-lg">🎲</span>
          <div className="text-left leading-tight">
            <span className="block text-xs sm:text-sm font-black tracking-wide">Thai 3D (Gov)</span>
            <span className={`text-[9px] sm:text-[10px] font-bold block ${activeGameResult === '3D' ? 'text-purple-200' : 'text-purple-400/80'}`}>ထိုင်း ၃ လုံးထီ ပေါက်စဉ်</span>
          </div>
        </button>
      </div>

      {/* 2D Results View (Emerald Green Theme) */}
      {activeGameResult === '2D' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-gradient-to-br from-emerald-950 via-[#062419] to-dark-bg border border-emerald-500/40 p-5 sm:p-6 shadow-xl shadow-emerald-950/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 flex items-center justify-center font-black text-xl font-mono">
                2D
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Thai 2D Official Results (ထိုင်း ၂ လုံးထီ ပေါက်စဉ်များ)</h3>
                <p className="text-xs text-emerald-400/80 mt-0.5">
                  Thai Stock Exchange (SET) Morning 12:01 PM & Evening 04:30 PM Results
                </p>
              </div>
            </div>
            <button
              onClick={load2DResults}
              className="p-2.5 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-300 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading2D ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loading2D ? (
              <div className="col-span-full py-12 text-center text-emerald-400 font-mono">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                2D Results Loading...
              </div>
            ) : results2D.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 text-xs">
                ထွက်ရှိထားသော 2D ပေါက်စဉ်များ မရှိသေးပါ
              </div>
            ) : (
              results2D.map((res) => (
                <div
                  key={res.id}
                  className="rounded-2xl bg-dark-card border border-emerald-500/30 p-4 space-y-3 shadow-lg shadow-emerald-950/20"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-900/40">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{res.draw_date}</span>
                      <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                        res.session === 'morning' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                      }`}>
                        {res.session_label}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold">{res.draw_time_mmt}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="space-y-1 font-mono text-xs">
                      <div className="text-slate-400">
                        SET Index: <strong className="text-slate-200">{res.set_index || '-'}</strong>
                      </div>
                      <div className="text-slate-400">
                        SET Value: <strong className="text-slate-200">{res.set_value || '-'}</strong>
                      </div>
                    </div>

                    <div className="text-center">
                      <span className="text-[10px] text-slate-400 font-sans block mb-0.5">ထွက်ဂဏန်း</span>
                      <div className="w-16 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-slate-950 font-black text-2xl flex items-center justify-center font-mono shadow-lg shadow-emerald-950 tracking-wider">
                        {res.winning_number || '--'}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3D Results View (Purple Theme) */}
      {activeGameResult === '3D' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-gradient-to-br from-purple-950 via-[#1c082e] to-dark-bg border border-purple-500/40 p-5 sm:p-6 shadow-xl shadow-purple-950/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-400/50 flex items-center justify-center font-black text-xl font-mono">
                3D
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Thai 3D Official Results (ထိုင်း ၃ လုံးထီ ပေါက်စဉ်များ)</h3>
                <p className="text-xs text-purple-400/80 mt-0.5">
                  Thai Government Official Lottery Results (လစဉ် ၁ ရက် နှင့် ၁၆ ရက်နေ့ ၀၃:၃၀ PM)
                </p>
              </div>
            </div>
            <button
              onClick={load3DResults}
              className="p-2.5 rounded-xl bg-purple-950 border border-purple-500/40 text-purple-300 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading3D ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loading3D ? (
              <div className="col-span-full py-12 text-center text-purple-400 font-mono">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                3D Results Loading...
              </div>
            ) : results3D.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 text-xs">
                ထွက်ရှိထားသော 3D ပေါက်စဉ်များ မရှိသေးပါ
              </div>
            ) : (
              results3D.map((res) => (
                <div
                  key={res.id}
                  className="rounded-2xl bg-dark-card border border-purple-500/30 p-5 space-y-4 shadow-lg shadow-purple-950/20"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-purple-900/40">
                    <span className="font-bold text-white text-sm">{res.draw_date}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      {res.draw_time_mmt}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] text-slate-400 block">ထိုင်း ပထမဆုကြီး (၆ လုံး):</span>
                    <div className="text-xl font-mono font-black text-slate-200 tracking-widest bg-slate-950 p-2 rounded-xl text-center border border-slate-800">
                      {res.thai_first_prize || '------'}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-purple-900/40 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-purple-300 font-bold block">3D အမြီး ၃ လုံး ထွက်ဂဏန်း:</span>
                      <span className="text-[11px] text-slate-400">တည့် ၇၀၀ ဆ • အာ ၁၀ ဆ</span>
                    </div>
                    <div className="px-4 py-2 rounded-2xl bg-gradient-to-tr from-purple-600 to-fuchsia-600 text-white font-black text-2xl font-mono shadow-lg shadow-purple-950 tracking-widest">
                      {res.winning_number || '---'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4D Results Board Content (Gold Theme) */}
      {activeGameResult === '4D' && (
        <div className="space-y-6">
      
      {/* 1. Live Winners Ticker Banner (Marquee) */}
      {recentWinners.length > 0 && (
        <div className="bg-gradient-to-r from-gold-950 via-dark-card to-gold-950 border border-gold-600/60 rounded-xl p-2 overflow-hidden flex items-center space-x-3 text-xs shadow-gold-sm relative group">
          <span className="shrink-0 z-10 flex items-center space-x-1 font-extrabold text-gold-300 uppercase tracking-wider text-[11px] bg-gradient-to-r from-gold-900 to-amber-950 px-2.5 py-1 rounded-lg border border-gold-500/80 shadow-md">
            <Flame className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
            <span>{t('recentWinnersTicker')}</span>
          </span>
          <div className="overflow-hidden w-full relative flex-1">
            <div className="animate-marquee-slow flex items-center space-x-4 text-gray-200 font-mono text-[11px]">
              {[...recentWinners, ...recentWinners].map((rw, idx) => (
                <span 
                  key={idx} 
                  className={`flex items-center space-x-2 shrink-0 px-3 py-1 rounded-lg border transition-all ${
                    rw.prize_tier === '1st Prize'
                      ? 'bg-gradient-to-r from-amber-950/90 to-yellow-950/90 border-yellow-400/90 shadow-[0_0_12px_rgba(255,215,0,0.4)]'
                      : 'bg-dark-bg/90 border-gold-900/50'
                  }`}
                >
                  {rw.prize_tier === '1st Prize' && <Crown className="w-3.5 h-3.5 text-yellow-400 inline" />}
                  <span className={`font-semibold ${rw.prize_tier === '1st Prize' ? 'text-yellow-200 font-black' : 'text-white'}`}>
                    {rw.masked_name}
                  </span>
                  <span className="text-gold-400 font-bold">
                    ({lang === 'mm' ? rw.prize_tier_mm : rw.prize_tier})
                  </span>
                  <span className="text-green-400 font-black">
                    +{formatMoney(rw.payout_amount)}
                  </span>
                  <span className="text-gray-400 font-bold">
                    ({formatDigits(rw.winning_number)})
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Main Draw Header Banner */}
      <div className="glass-panel-gold rounded-2xl p-6 border border-gold-600/50 relative overflow-hidden shadow-gold">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gold-900/50">
          <div>
            <div className="flex items-center space-x-2">
              <Trophy className="w-6 h-6 text-gold-400" />
              <h2 className="text-2xl font-black text-white tracking-wide gold-gradient-text">
                {t('resultsTitle')}
              </h2>
            </div>
            <p className="text-xs text-gold-400/90 mt-1 font-medium">
              {t('resultsSub')}
            </p>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {draws.length > 0 && (
              <select
                value={selectedDrawIndex}
                onChange={(e) => {
                  setSelectedDrawIndex(Number(e.target.value));
                  setWinnerTierFilter('ALL');
                }}
                className="bg-dark-card border border-gold-700 text-gold-200 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-gold-400"
              >
                {draws.map((d, idx) => (
                  <option key={d.id} value={idx}>
                    {lang === 'mm' ? `အကြိမ် #${num(d.draw_number)} (${formatDigits(d.draw_date)})` : `Draw #${d.draw_number} (${d.draw_date})`}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handleSyncWithSingaporePools}
              disabled={syncing}
              title={t('syncSgPoolsBtn')}
              className="flex items-center space-x-1.5 px-3 py-2 bg-gold-950/80 hover:bg-gold-900 border border-gold-600 text-gold-300 font-bold text-xs rounded-xl transition-all shadow-gold-sm cursor-pointer disabled:opacity-50"
            >
              <Globe className={`w-3.5 h-3.5 text-gold-400 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? t('syncingLabel') : t('syncSgPoolsBtn')}</span>
            </button>

            <button
              onClick={() => { loadDraws(); loadRecentWinners(); }}
              className="p-2 bg-dark-card hover:bg-gold-950 border border-gold-700 text-gold-300 rounded-xl transition-colors shadow-gold-sm cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sync Feedback Message */}
        {syncMessage && (
          <div className="mt-3 p-2.5 rounded-lg bg-gold-950/60 border border-gold-600/60 text-gold-200 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-gold-400 shrink-0" />
            <span>{syncMessage}</span>
          </div>
        )}

        {currentDraw && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 gap-2 text-xs text-gray-400">
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <Calendar className="w-4 h-4 text-gold-400" />
                <span>
                  {t('drawDateLabel')}: <strong className="text-white">{formatDigits(currentDraw.draw_date)}</strong>
                </span>
              </span>
              <span className="text-gray-600">•</span>
              <span className="text-gold-300/80 font-mono text-[11px]">
                {t('sgPoolsSourceLabel')}
              </span>
            </div>
            <div>
              {t('drawStatusLabel')}: <span className="font-bold text-gold-400 uppercase">
                {currentDraw.status === 'COMPLETED' || currentDraw.status === 'SETTLED' ? t('drawCompleted') : t('drawPending')}
              </span>
            </div>
          </div>
        )}
      </div>

      {currentDraw && (
        <div className="space-y-6">
          
          {/* Top 3 Prizes Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* 1st Prize */}
            <div className="first-prize-radiant-card rounded-2xl p-6 text-center relative overflow-hidden shadow-gold-lg transform hover:scale-[1.01] transition-all">
              <div className="inline-flex items-center space-x-1.5 px-3.5 py-1 rounded-full first-prize-shimmer-badge text-xs font-black tracking-wider uppercase mb-3 shadow-lg">
                <Crown className="w-4 h-4 text-amber-950 inline" />
                <span>{t('firstPrize')}</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-950 inline" />
              </div>
              <div className="text-5xl md:text-6xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-100 tracking-[0.22em] my-3 drop-shadow-[0_0_25px_rgba(255,215,0,0.85)]">
                {currentDraw.first_prize ? formatDigits(currentDraw.first_prize) : '----'}
              </div>
              <p className="text-base font-black text-yellow-300 drop-shadow">
                {t('firstPrizePayout')}
              </p>
              <p className="text-[11px] text-amber-200/90 mt-1 font-mono font-bold">
                {t('firstPrizeDesc')}
              </p>
            </div>

            {/* 2nd Prize */}
            <div className="glass-panel-gold rounded-2xl p-6 border border-gold-600/70 bg-gradient-to-b from-dark-card to-dark-bg text-center relative overflow-hidden shadow-gold-sm">
              <div className="inline-block px-3 py-1 rounded-full bg-gold-600/20 border border-gold-600/60 text-gold-200 text-xs font-black tracking-wider uppercase mb-3">
                {t('secondPrize')}
              </div>
              <div className="text-5xl font-mono font-black text-gold-200 tracking-[0.2em] my-3 drop-shadow-md">
                {currentDraw.second_prize ? formatDigits(currentDraw.second_prize) : '----'}
              </div>
              <p className="text-sm font-black text-gold-400">
                {t('secondPrizePayout')}
              </p>
              <p className="text-[10px] text-gray-400 mt-1 font-mono">
                {t('secondPrizeDesc')}
              </p>
            </div>

            {/* 3rd Prize */}
            <div className="glass-panel-gold rounded-2xl p-6 border border-gold-700/70 bg-gradient-to-b from-dark-card to-dark-bg text-center relative overflow-hidden shadow-gold-sm">
              <div className="inline-block px-3 py-1 rounded-full bg-gold-700/20 border border-gold-700/60 text-gold-300 text-xs font-black tracking-wider uppercase mb-3">
                {t('thirdPrize')}
              </div>
              <div className="text-5xl font-mono font-black text-gold-300 tracking-[0.2em] my-3 drop-shadow-md">
                {currentDraw.third_prize ? formatDigits(currentDraw.third_prize) : '----'}
              </div>
              <p className="text-sm font-black text-gold-500">
                {t('thirdPrizePayout')}
              </p>
              <p className="text-[10px] text-gray-400 mt-1 font-mono">
                {t('thirdPrizeDesc')}
              </p>
            </div>

          </div>

          {/* Permutation Box Roll Multiplier Banner */}
          <div className="p-4 rounded-xl bg-gold-950/70 border border-gold-600/60 flex items-center justify-between text-xs text-gold-200 shadow-gold-sm">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-gold-400 shrink-0" />
              <span>
                {t('boxRollBonusBanner')}
              </span>
            </div>
            <span className="font-mono font-bold text-gold-400">{t('boxMultiplierBadge')}</span>
          </div>

          {/* Starter Prizes */}
          <div className="glass-panel-gold rounded-2xl p-6 border border-gold-800/60 shadow-gold-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gold-900/50">
              <h3 className="font-bold text-white text-base flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-gold-400" />
                <span>{t('starterPrizes')}</span>
              </h3>
              <span className="text-xs text-emerald-400 font-mono font-bold bg-dark-bg px-2.5 py-1 rounded-lg border border-gold-700/60">
                {t('starterPrizePayout')}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {(currentDraw.starter_prizes || []).map((prizeNum, i) => (
                <div
                  key={i}
                  className="bg-dark-card border border-gold-900/80 hover:border-gold-600 py-3 rounded-xl text-center font-mono font-extrabold text-xl text-gold-200 tracking-widest transition-all"
                >
                  {formatDigits(prizeNum)}
                </div>
              ))}
            </div>
          </div>

          {/* Consolidation Prizes */}
          <div className="glass-panel-gold rounded-2xl p-6 border border-gold-800/60 shadow-gold-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gold-900/50">
              <h3 className="font-bold text-white text-base flex items-center space-x-2">
                <Award className="w-4 h-4 text-gold-400" />
                <span>{t('consolationPrizes')}</span>
              </h3>
              <span className="text-xs text-emerald-400 font-mono font-bold bg-dark-bg px-2.5 py-1 rounded-lg border border-gold-700/60">
                {t('consolationPrizePayout')}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {(currentDraw.consolidation_prizes || []).map((prizeNum, i) => (
                <div
                  key={i}
                  className="bg-dark-card border border-gold-900/80 hover:border-gold-600 py-3 rounded-xl text-center font-mono font-bold text-xl text-gray-300 tracking-widest transition-all"
                >
                  {formatDigits(prizeNum)}
                </div>
              ))}
            </div>
          </div>

          {/* 3. Official Winners Section (ဆုရရှိသူများ စာရင်း) */}
          <div className="glass-panel-gold rounded-2xl p-6 border-2 border-gold-600/70 shadow-gold">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gold-900/50">
              <div>
                <h3 className="text-lg font-black text-white flex items-center space-x-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  <span className="gold-gradient-text">{t('winnersSectionTitle')}</span>
                </h3>
                <p className="text-xs text-gold-400/80 mt-0.5">
                  {t('winnersSubtitle')} • Draw #{currentDraw.draw_number} ({formatDigits(currentDraw.draw_date)})
                </p>
              </div>

              {/* Summary Stats Badges */}
              <div className="flex items-center space-x-3">
                <div className="px-3 py-1.5 rounded-xl bg-dark-card border border-gold-700/70 text-right">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">{t('totalWinnersLabel')}</span>
                  <span className="font-mono font-black text-gold-300 text-sm">
                    {num(totalWinnersCount)} {lang === 'mm' ? 'ဦး' : 'Winners'}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-dark-card border border-gold-700/70 text-right">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">{t('totalPaidOutLabel')}</span>
                  <span className="font-mono font-black text-green-400 text-sm">
                    {formatMoney(totalDrawPayout)}
                  </span>
                </div>
              </div>
            </div>

            {/* Filter Category Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 pt-4 pb-2">
              {[
                { id: 'ALL', label: t('all') },
                { id: '1ST', label: t('firstPrize') },
                { id: '2ND', label: t('secondPrize') },
                { id: '3RD', label: t('thirdPrize') },
                { id: 'STARTER', label: t('starterPrizes') },
                { id: 'CONSOLATION', label: t('consolationPrizes') },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setWinnerTierFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    winnerTierFilter === tab.id
                      ? 'gold-gradient-btn text-dark-bg font-extrabold shadow-gold-sm'
                      : 'bg-dark-card text-gray-400 hover:text-white border border-dark-border'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* NIL Prize Alert if filtered tier has no winners */}
            {winnerTierFilter === '3RD' && !has3rdWinner && (
              <div className="mt-3 p-4 rounded-xl bg-dark-card border border-gold-900/60 text-center">
                <AlertCircle className="w-8 h-8 text-gold-400/60 mx-auto mb-2" />
                <h4 className="font-bold text-gold-300 text-sm">{t('nilWinner')}</h4>
                <p className="text-xs text-gray-400 mt-1">{t('nilWinnerSub')}</p>
              </div>
            )}
            {winnerTierFilter === '1ST' && !has1stWinner && (
              <div className="mt-3 p-4 rounded-xl bg-dark-card border border-gold-900/60 text-center">
                <AlertCircle className="w-8 h-8 text-gold-400/60 mx-auto mb-2" />
                <h4 className="font-bold text-gold-300 text-sm">{t('nilWinner')}</h4>
                <p className="text-xs text-gray-400 mt-1">{t('nilWinnerSub')}</p>
              </div>
            )}
            {winnerTierFilter === '2ND' && !has2ndWinner && (
              <div className="mt-3 p-4 rounded-xl bg-dark-card border border-gold-900/60 text-center">
                <AlertCircle className="w-8 h-8 text-gold-400/60 mx-auto mb-2" />
                <h4 className="font-bold text-gold-300 text-sm">{t('nilWinner')}</h4>
                <p className="text-xs text-gray-400 mt-1">{t('nilWinnerSub')}</p>
              </div>
            )}

            {/* Winners Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-3">
              {sortedWinners.map((w, idx) => {
                const tierStr = (w.prize_tier || w.prize_tier_mm || '').toLowerCase();
                const is1st = tierStr.includes('1st') || tierStr.includes('ပထမ');
                const is2nd = tierStr.includes('2nd') || tierStr.includes('ဒုတိယ');
                const is3rd = tierStr.includes('3rd') || tierStr.includes('တတိယ');
                const isStarter = tierStr.includes('starter') || tierStr.includes('အထူး');
                const isConsolation = tierStr.includes('consolation') || tierStr.includes('consolidation') || tierStr.includes('နှစ်သိမ့်');
                const isReal = w.is_simulated === false;

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                      is1st
                        ? 'first-prize-radiant-card shadow-gold-lg border-2 border-yellow-400 transform hover:scale-[1.02]'
                        : is2nd
                        ? 'bg-gradient-to-br from-sky-950/40 via-dark-card to-cyan-950/30 border-2 border-sky-400/80 shadow-lg shadow-sky-500/10 hover:border-sky-300'
                        : is3rd
                        ? 'bg-gradient-to-br from-purple-950/40 via-dark-card to-violet-950/30 border-2 border-purple-400/80 shadow-lg shadow-purple-500/10 hover:border-purple-300'
                        : isStarter
                        ? 'bg-gradient-to-br from-emerald-950/30 via-dark-card to-teal-950/20 border border-emerald-500/60 shadow-md shadow-emerald-500/10 hover:border-emerald-400'
                        : isConsolation
                        ? 'bg-gradient-to-br from-rose-950/30 via-dark-card to-orange-950/20 border border-rose-500/60 shadow-md shadow-rose-500/10 hover:border-rose-400'
                        : 'bg-dark-card/80 border-dark-border'
                    }`}
                  >
                    <div>
                      {/* Top row: Tier Badge & Real Verification Badge */}
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border flex items-center space-x-1 ${
                          is1st
                            ? 'first-prize-shimmer-badge text-amber-950 shadow-md border-amber-300'
                            : is2nd
                            ? 'bg-gradient-to-r from-sky-500 to-cyan-400 text-dark-bg font-black shadow-sm border border-sky-300'
                            : is3rd
                            ? 'bg-gradient-to-r from-purple-500 to-violet-400 text-dark-bg font-black shadow-sm border border-purple-300'
                            : isStarter
                            ? 'bg-emerald-500/25 border border-emerald-400 text-emerald-300 font-bold'
                            : isConsolation
                            ? 'bg-rose-500/25 border border-rose-400 text-rose-300 font-bold'
                            : 'bg-dark-bg text-emerald-400 border-emerald-800'
                        }`}>
                          {is1st && <Crown className="w-3 h-3 text-amber-950 inline mr-0.5" />}
                          {is2nd && <Medal className="w-3 h-3 text-dark-bg inline mr-0.5" />}
                          {is3rd && <Medal className="w-3 h-3 text-dark-bg inline mr-0.5" />}
                          {isStarter && <Star className="w-3 h-3 text-emerald-400 inline mr-0.5" />}
                          {isConsolation && <Gift className="w-3 h-3 text-rose-400 inline mr-0.5" />}
                          <span>{lang === 'mm' ? w.prize_tier_mm : w.prize_tier}</span>
                        </span>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          <span className={`text-[10px] font-mono ${
                            is1st 
                              ? 'text-amber-200 font-bold' 
                              : is2nd 
                              ? 'text-sky-300/80 font-bold'
                              : is3rd
                              ? 'text-purple-300/80 font-bold'
                              : isStarter
                              ? 'text-emerald-300/80 font-medium'
                              : isConsolation
                              ? 'text-rose-300/80 font-medium'
                              : 'text-gray-400'
                          }`}>
                            {w.masked_phone}
                          </span>
                        </div>
                      </div>

                      {/* Player Name */}
                      <div className={`font-black text-sm truncate flex items-center space-x-1.5 ${
                        is1st 
                          ? 'text-yellow-200 text-base drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]' 
                          : is2nd
                          ? 'text-sky-200'
                          : is3rd
                          ? 'text-purple-200'
                          : isStarter
                          ? 'text-emerald-200'
                          : isConsolation
                          ? 'text-rose-200'
                          : 'text-white'
                      }`}>
                        {is1st && <Sparkles className="w-4 h-4 text-yellow-300 inline shrink-0" />}
                        <span>{w.masked_name}</span>
                      </div>

                      {/* Winning Number */}
                      <div className="text-xs text-gray-400 mt-2 flex items-center justify-between">
                        <span className={is1st ? 'text-amber-200/90 font-bold' : ''}>{t('winnerTicketNumber')}:</span>
                        <span className={`font-mono font-black tracking-widest ${
                          is1st 
                            ? 'text-yellow-300 text-base drop-shadow-[0_0_12px_rgba(255,215,0,0.8)]' 
                            : is2nd
                            ? 'text-sky-300 text-base drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]'
                            : is3rd
                            ? 'text-purple-300 text-base drop-shadow-[0_0_8px_rgba(192,132,252,0.6)]'
                            : isStarter
                            ? 'text-emerald-300 text-sm'
                            : isConsolation
                            ? 'text-rose-300 text-sm'
                            : 'text-gold-300 text-sm'
                        }`}>
                          {formatDigits(w.winning_number)}
                        </span>
                      </div>
                    </div>

                    {/* Payout Amount */}
                    <div className={`mt-3 pt-2.5 border-t flex items-center justify-between ${
                      is1st 
                        ? 'border-amber-400/40 bg-amber-950/30 -mx-4 -mb-4 p-3 rounded-b-xl' 
                        : is2nd
                        ? 'border-sky-500/30 bg-sky-950/20 -mx-4 -mb-4 p-3 rounded-b-xl'
                        : is3rd
                        ? 'border-purple-500/30 bg-purple-950/20 -mx-4 -mb-4 p-3 rounded-b-xl'
                        : isStarter
                        ? 'border-emerald-500/20 bg-emerald-950/10 -mx-4 -mb-4 p-3 rounded-b-xl'
                        : isConsolation
                        ? 'border-rose-500/20 bg-rose-950/10 -mx-4 -mb-4 p-3 rounded-b-xl'
                        : 'border-dark-border'
                    }`}>
                      <span className={`text-[11px] ${
                        is1st 
                          ? 'text-amber-200 font-bold' 
                          : is2nd
                          ? 'text-sky-200/80 font-medium'
                          : is3rd
                          ? 'text-purple-200/80 font-medium'
                          : 'text-gray-400'
                      }`}>
                        {t('winnerWonAmount')}
                      </span>
                      <span className={`font-mono font-black ${
                        is1st 
                          ? 'text-green-300 text-base font-extrabold drop-shadow-[0_0_8px_rgba(74,222,128,0.6)]' 
                          : is2nd
                          ? 'text-sky-300 text-sm'
                          : is3rd
                          ? 'text-purple-300 text-sm'
                          : isStarter
                          ? 'text-emerald-400 text-sm'
                          : isConsolation
                          ? 'text-rose-400 text-sm'
                          : 'text-green-400 text-sm'
                      }`}>
                        +{formatMoney(w.payout_amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredWinners.length === 0 && winnerTierFilter !== '3RD' && winnerTierFilter !== '1ST' && winnerTierFilter !== '2ND' && (
              <div className="text-center py-8 text-gray-400 text-xs">
                {t('nilWinner')}
              </div>
            )}
          </div>

        </div>
      )}

        </div>
      )}

    </div>
  );
}
