import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Search, 
  Plus, 
  Trash2, 
  AlertCircle, 
  RefreshCw, 
  ShieldAlert, 
  CheckCircle2, 
  Calendar,
  Lock,
  Unlock,
  Coins,
  Flame,
  Layers,
  Filter,
  TrendingUp,
  AlertTriangle,
  Eye,
  Check,
  X,
  Receipt,
  Copy,
  Clock,
  Award
} from 'lucide-react';
import { apiClient } from '../../api/client';

export default function Game2DView({ onNotify, mode = 'live' }) {
  const [gameData, setGameData] = useState(null);
  const [selectedDrawId, setSelectedDrawId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters for 2D matrix
  const [searchNumber, setSearchNumber] = useState('');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'HOT' | 'CLOSED'

  // Modal for adding closed number
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Number Bet History Audit Popup Modal
  const [auditNumber, setAuditNumber] = useState(null);
  const [auditData, setAuditData] = useState(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [copiedVoucher, setCopiedVoucher] = useState(null);

  useEffect(() => {
    loadGameData(selectedDrawId);
  }, [mode, selectedDrawId]);

  const loadGameData = async (drawId = null) => {
    try {
      setLoading(true);
      const res = await apiClient.getAdmin2DGame(drawId, mode);
      setGameData(res);
      if (!selectedDrawId && res?.selected_draw?.id) {
        setSelectedDrawId(res.selected_draw.id);
      }
    } catch (err) {
      console.error('Error loading 2D game data:', err);
      if (onNotify) onNotify(err.message || 'Failed to load 2D game data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNumberAudit = async (num) => {
    const formatted = String(num).padStart(2, '0');
    setAuditNumber(formatted);
    setAuditData(null);
    setLoadingAudit(true);
    try {
      const res = await apiClient.getAdmin2DNumberAudit(formatted, selectedDrawId);
      setAuditData(res);
    } catch (err) {
      console.error('Failed to load number audit:', err);
      if (onNotify) onNotify(err.message || 'Failed to fetch bets for this number', 'error');
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleCopyVoucher = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedVoucher(code);
    if (onNotify) onNotify(`Voucher ${code} copied`, 'success');
    setTimeout(() => setCopiedVoucher(null), 2000);
  };

  const handleToggleClosedNumber = async (number, isAlreadyClosed) => {
    try {
      if (isAlreadyClosed) {
        await apiClient.deleteAdmin2DClosedNumber(number, selectedDrawId);
        if (onNotify) onNotify(`Re-opened 2D number ${number}`, 'success');
      } else {
        await apiClient.addAdmin2DClosedNumber({
          draw_id: selectedDrawId,
          number: number
        });
        if (onNotify) onNotify(`Closed/Locked 2D number ${number}`, 'success');
      }
      loadGameData(selectedDrawId);
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Failed to update 2D closed number', 'error');
    }
  };

  const handleAddClosedNumberModal = async (e) => {
    e.preventDefault();
    const clean = newNumber.trim().padStart(2, '0');
    if (!clean || clean.length !== 2 || isNaN(clean)) {
      alert('ကျေးဇူးပြု၍ 00 မှ 99 အတွင်း ဂဏန်း ၂ လုံး ရိုက်ထည့်ပါ');
      return;
    }
    try {
      setSubmitting(true);
      await apiClient.addAdmin2DClosedNumber({
        draw_id: selectedDrawId,
        number: clean
      });
      if (onNotify) onNotify(`Closed 2D number ${clean} successfully`, 'success');
      setNewNumber('');
      setIsAddModalOpen(false);
      loadGameData(selectedDrawId);
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Failed to close number', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !gameData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="text-xs font-semibold">Thai 2D Data များ ရယူနေပါသည်...</span>
      </div>
    );
  }

  // If mode === 'past'
  if (mode === 'past') {
    const pastDraws = gameData?.past_draws || [];
    return (
      <div className="space-y-6">
        {/* Past Draw Results Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-navy-900/90 border border-gold-500/30 p-4 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold-500/20 text-gold-400 flex items-center justify-center font-black border border-gold-500/40 text-lg">
              🏆
            </div>
            <div>
              <h2 className="font-extrabold text-white text-base">Thai 2D Past Games (ယခင် 2D ပေါက်စဉ်များ)</h2>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Thai Stock Exchange (SET) Morning 12:01 PM & Evening 04:30 PM Results
              </p>
            </div>
          </div>
          <button
            onClick={() => loadGameData(null)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy-800 hover:bg-navy-750 text-gold-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Past Games Table */}
        <div className="bg-navy-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Draw Date</th>
                  <th className="py-3.5 px-4">Session</th>
                  <th className="py-3.5 px-4">SET Index</th>
                  <th className="py-3.5 px-4">SET Value</th>
                  <th className="py-3.5 px-4 text-center">Winning 2D</th>
                  <th className="py-3.5 px-4 text-right">Total Staked</th>
                  <th className="py-3.5 px-4 text-right">Total Payout</th>
                  <th className="py-3.5 px-4 text-right">Net Profit</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {pastDraws.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                      ယခင် 2D ထီပေါက်စဉ်မှတ်တမ်း မရှိသေးပါ
                    </td>
                  </tr>
                ) : (
                  pastDraws.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{d.draw_date}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          d.session === 'morning'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}>
                          {d.session_label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{d.set_index || '-'}</td>
                      <td className="py-3 px-4 text-slate-400">{d.set_value || '-'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-3 py-1 rounded-xl bg-gold-500/20 text-gold-300 font-black text-sm tracking-widest border border-gold-500/40 shadow-inner">
                          {d.winning_number || '--'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-200">
                        Ks {(d.total_staked || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-rose-400">
                        Ks {(d.total_payout || 0).toLocaleString()}
                      </td>
                      <td className={`py-3 px-4 text-right font-black ${
                        (d.profit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {(d.profit || 0) < 0 ? `-Ks ${Math.abs(d.profit).toLocaleString()}` : `+Ks ${(d.profit || 0).toLocaleString()}`}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Mode === 'live'
  const currentDraw = gameData?.selected_draw;
  const availableDraws = gameData?.available_draws || [];
  const numbersMatrix = gameData?.numbers_matrix || [];
  const topNumbers = gameData?.top_numbers || [];
  const closedSet = new Set(currentDraw?.closed_numbers || []);
  const payoutMultiplier = gameData?.payout_multiplier || 85.0;
  const maxRiskCap = gameData?.max_risk_cap || 100000.0;
  const totalStaked = gameData?.total_staked || 0.0;
  const peakLiability = gameData?.peak_liability || 0.0;

  // Filter 00-99 matrix
  const filteredMatrix = numbersMatrix.filter((item) => {
    if (searchNumber.trim() && !item.number.includes(searchNumber.trim())) {
      return false;
    }
    if (filterMode === 'HOT' && item.staked <= 0) {
      return false;
    }
    if (filterMode === 'CLOSED' && !closedSet.has(item.number)) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Session Switcher Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-navy-900/90 border border-gold-500/20 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          <Calendar className="w-5 h-5 text-gold-400 shrink-0 mr-1" />
          {availableDraws.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDrawId(d.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                selectedDrawId === d.id
                  ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
                  : 'bg-navy-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>{d.draw_date}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                selectedDrawId === d.id
                  ? 'bg-black/80 text-amber-300'
                  : 'bg-slate-700 text-slate-200'
              }`}>
                {d.session_label}
              </span>
              <span className="px-1.5 py-0.5 text-[9px] bg-emerald-500/20 text-emerald-300 rounded font-black border border-emerald-500/30">
                {d.status}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadGameData(selectedDrawId)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy-800 hover:bg-navy-750 text-gold-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950 transition-all cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>+ Lock / Close 2D Number</span>
          </button>
        </div>
      </div>

      {/* 4 Executive Risk KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Staked Pool */}
        <div className="bg-navy-900/90 border border-emerald-500/30 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-extrabold text-emerald-400 tracking-wider">
              Total 2D Pool Staked
            </span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white">
              Ks {totalStaked.toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 font-mono">
            Session: {currentDraw?.session_label || 'Morning 12:01 PM'}
          </p>
        </div>

        {/* Peak House Liability */}
        <div className="bg-navy-900/90 border border-rose-500/30 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-extrabold text-rose-400 tracking-wider">
              Peak House Liability
            </span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-rose-400">
              Ks {peakLiability.toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Payout Multiplier: <span className="font-bold text-amber-300 font-mono">{payoutMultiplier}x</span>
          </p>
        </div>

        {/* Closed / Locked Numbers */}
        <div className="bg-navy-900/90 border border-amber-500/30 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-extrabold text-amber-400 tracking-wider">
              Closed Numbers (ဘရိတ်/ထိပ်ပိတ်)
            </span>
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-amber-400">
              {closedSet.size}
            </span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            One-click lock/unlock enabled below
          </p>
        </div>

        {/* Max Risk Cap per Number */}
        <div className="bg-navy-900/90 border border-blue-500/30 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-extrabold text-blue-400 tracking-wider">
              Max Risk Limit
            </span>
            <ShieldAlert className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-blue-300">
              Ks {maxRiskCap.toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Cutoff: <span className="text-slate-200 font-mono">{currentDraw?.cutoff_time_mmt || '11:30 AM'}</span>
          </p>
        </div>
      </div>

      {/* Top 10 High-Stakes Hot Numbers */}
      {topNumbers.length > 0 && topNumbers[0].staked > 0 && (
        <div className="bg-navy-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <h3 className="font-extrabold text-white text-sm">Top 10 High-Stakes 2D Numbers (အရောင်းရဆုံး ထိပ်ဆုံး ၁၀ လုံး)</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">Live Session: {currentDraw?.draw_date}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2.5">
            {topNumbers.map((item, idx) => {
              const isClosed = closedSet.has(item.number);
              return (
                <div
                  key={item.number}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    isClosed
                      ? 'bg-rose-950/40 border-rose-600/50 text-rose-300'
                      : 'bg-slate-950/80 border-slate-800 hover:border-amber-500/50 text-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>#{idx + 1}</span>
                    {isClosed ? <Lock className="w-3 h-3 text-rose-400" /> : <Unlock className="w-3 h-3 text-slate-500" />}
                  </div>
                  <div 
                    onClick={() => handleOpenNumberAudit(item.number)}
                    className="text-xl font-black font-mono my-1 text-gold-300 cursor-pointer hover:underline"
                    title="Click to view player bets"
                  >
                    {item.number}
                  </div>
                  <div className="text-[10px] font-mono text-emerald-400 font-bold truncate">
                    Ks {item.staked.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 00 - 99 Interactive Matrix Heatmap */}
      <div className="bg-navy-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-gold-400" />
              <span>00 – 99 2D Live Number Grid (ဂဏန်း ၁၀၀ အရောင်းပြကွက်)</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ဂဏန်းတစ်ခုချင်းစီအား နှိပ်၍ ထိုးထားသော ဘောက်ချာမှတ်တမ်းများကို ကြည့်ရှုနိုင်ပြီး Lock/Unlock ပြုလုပ်နိုင်ပါသည်။
            </p>
          </div>

          {/* Filters & Search */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search (e.g. 25)"
                value={searchNumber}
                onChange={(e) => setSearchNumber(e.target.value)}
                maxLength={2}
                className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 w-32 focus:outline-none focus:border-gold-500"
              />
            </div>

            <div className="flex items-center bg-slate-950 rounded-xl p-1 border border-slate-800 text-[11px]">
              <button
                onClick={() => setFilterMode('ALL')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  filterMode === 'ALL' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                All (100)
              </button>
              <button
                onClick={() => setFilterMode('HOT')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  filterMode === 'HOT' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sold Only
              </button>
              <button
                onClick={() => setFilterMode('CLOSED')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  filterMode === 'CLOSED' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Closed ({closedSet.size})
              </button>
            </div>
          </div>
        </div>

        {/* 10x10 Grid */}
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 font-mono">
          {filteredMatrix.map((item) => {
            const isClosed = closedSet.has(item.number);
            const staked = item.staked || 0;
            const liability = staked * payoutMultiplier;
            const isExceeded = liability >= maxRiskCap && staked > 0;

            return (
              <div
                key={item.number}
                className={`group relative p-2.5 rounded-xl border transition-all text-center flex flex-col justify-between ${
                  isClosed
                    ? 'bg-rose-950/50 border-rose-700/60 text-rose-300 ring-1 ring-rose-500/40'
                    : isExceeded
                    ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                    : staked > 0
                    ? 'bg-slate-900 border-amber-500/40 hover:border-amber-400 text-white'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-600 text-slate-400'
                }`}
              >
                {/* Header: lock status & quick toggle */}
                <div className="flex items-center justify-between text-[9px] mb-1">
                  <span className="opacity-60">{item.number}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleClosedNumber(item.number, isClosed);
                    }}
                    title={isClosed ? 'Click to Re-open' : 'Click to Lock/Close'}
                    className={`p-1 rounded transition-colors cursor-pointer ${
                      isClosed ? 'text-rose-400 hover:text-rose-200' : 'text-slate-600 hover:text-amber-400 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {isClosed ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                </div>

                {/* Number Display - click to audit */}
                <button
                  onClick={() => handleOpenNumberAudit(item.number)}
                  className="font-black text-lg text-white hover:text-amber-400 transition-colors cursor-pointer my-0.5 tracking-wider"
                  title="View user bets"
                >
                  {item.number}
                </button>

                {/* Stake amount */}
                <div className={`text-[10px] font-bold truncate mt-1 ${
                  staked > 0 ? 'text-emerald-400' : 'text-slate-600'
                }`}>
                  {staked > 0 ? `${(staked / 1000).toFixed(staked % 1000 === 0 ? 0 : 1)}k` : '-'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lock / Close Number Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-gold-500/30 rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-rose-400" />
                <h3 className="font-extrabold text-white text-base">Lock / Close 2D Number</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              ပိတ်လိုသော 2D ဂဏန်းအား ရိုက်ထည့်ပါ။ အသုံးပြုသူများ ဤဂဏန်းအား ထပ်မံထိုးခွင့် ရရှိတော့မည်မဟုတ်ပါ။
            </p>

            <form onSubmit={handleAddClosedNumberModal} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">2D ဂဏန်း (00 – 99)</label>
                <input
                  type="text"
                  placeholder="e.g. 25"
                  maxLength={2}
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-lg font-black font-mono text-center tracking-widest text-amber-300 focus:outline-none focus:border-amber-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-950 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Locking...' : 'Lock Number'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Number Bet Audit Popup Modal */}
      {auditNumber && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-gold-500/30 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gold-500/20 text-gold-300 border border-gold-500/40 flex items-center justify-center font-black text-2xl font-mono shadow-inner">
                  {auditNumber}
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">
                    2D Number <span className="text-gold-300 font-mono">{auditNumber}</span> Bet Audit
                  </h3>
                  <p className="text-xs text-slate-400">
                    စုစုပေါင်းထိုးကြေး: <span className="font-mono text-emerald-400 font-bold">Ks {(auditData?.total_staked || 0).toLocaleString()}</span> | 
                    အနိုင်ပေးလျော်ငွေ: <span className="font-mono text-rose-400 font-bold">Ks {(auditData?.peak_liability || 0).toLocaleString()}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAuditNumber(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loadingAudit ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                  <span className="text-xs">လောင်းကြေးစာရင်း ရယူနေပါသည်...</span>
                </div>
              ) : !auditData || auditData.bets.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  ဤဂဏန်းအတွက် ထိုးထားသော လောင်းကြေးမှတ်တမ်း မရှိသေးပါခင်ဗျာ။
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-bold px-2">
                    <span>ထိုးထားသူ စုစုပေါင်း ({auditData.bet_count} ကြိမ်)</span>
                  </div>
                  <div className="space-y-2">
                    {auditData.bets.map((bet) => (
                      <div
                        key={bet.item_id}
                        className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{bet.nickname}</span>
                            <span className="text-slate-400 font-mono text-[11px]">{bet.phone}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                            <span>Voucher: {bet.voucher}</span>
                            <button
                              onClick={() => handleCopyVoucher(bet.voucher)}
                              className="text-slate-400 hover:text-amber-400 cursor-pointer"
                              title="Copy voucher"
                            >
                              {copiedVoucher === bet.voucher ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                            <span>• {bet.created_at}</span>
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <div className="text-sm font-black text-emerald-400">
                            Ks {bet.stake.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-rose-400">
                            Pay: Ks {bet.payout.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <button
                onClick={() => setAuditNumber(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
