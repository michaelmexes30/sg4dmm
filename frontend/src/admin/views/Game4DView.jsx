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
  Copy
} from 'lucide-react';
import { apiClient } from '../../api/client';

export default function Game4DView({ onNotify, mode = 'live' }) {
  const [availableDraws, setAvailableDraws] = useState([]);
  const [selectedDrawId, setSelectedDrawId] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchNumber, setSearchNumber] = useState('');
  const [selectedPrefix, setSelectedPrefix] = useState('ALL'); // 'ALL' | '0' | '1' ... | '9'
  const [filterMode, setFilterMode] = useState('TOP'); // Default to 'TOP' (Top 100 Highest Stake)
  
  // Modal for adding closed number
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [newReason, setNewReason] = useState('Admin Manual Lock');
  const [submitting, setSubmitting] = useState(false);

  // Number Bet History Audit Popup Modal
  const [auditNumber, setAuditNumber] = useState(null);
  const [auditData, setAuditData] = useState(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [copiedVoucher, setCopiedVoucher] = useState(null);

  const handleOpenNumberAudit = async (num) => {
    const formatted = String(num).padStart(4, '0');
    setAuditNumber(formatted);
    setAuditData(null);
    setLoadingAudit(true);
    try {
      const res = await apiClient.getAdmin4DNumberAudit(formatted, selectedDrawId);
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

  useEffect(() => {
    loadDrawsAndInitialData();
  }, [mode]);

  useEffect(() => {
    if (selectedDrawId) {
      loadHeatmap(selectedDrawId);
    }
  }, [selectedDrawId, selectedPrefix]);

  const loadDrawsAndInitialData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getAdmin4DGame(null, mode);
      const draws = res?.available_draws || [];
      setAvailableDraws(draws);

      // Default to the next open/upcoming draw from API
      let defaultDrawId = null;
      if (res?.selected_draw?.id) {
        defaultDrawId = res.selected_draw.id;
      } else if (draws.length > 0) {
        defaultDrawId = draws[0].id;
      }

      if (defaultDrawId) {
        setSelectedDrawId(defaultDrawId);
      }
    } catch (err) {
      console.error('Error loading 4D draws:', err);
      if (onNotify) onNotify(err.message || 'Failed to load draws', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadHeatmap = async (drawId) => {
    try {
      setLoading(true);
      const params = { limit: 10000 };
      if (selectedPrefix !== 'ALL') {
        params.range_prefix = selectedPrefix;
      }

      const res = await apiClient.getAdminHeatmap(drawId, params);
      setHeatmapData(res);
    } catch (err) {
      console.error('Error loading heatmap:', err);
      if (onNotify) onNotify(err.message || 'Failed to load heatmap grid', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleClosedNumber = async (number, isAlreadyClosed) => {
    try {
      if (isAlreadyClosed) {
        await apiClient.deleteAdminClosedNumber(number, selectedDrawId);
        if (onNotify) onNotify(`Re-opened number ${number}`, 'success');
      } else {
        await apiClient.addAdminClosedNumber({
          draw_id: selectedDrawId,
          number: number,
          reason: 'Heatmap One-Click Lock'
        });
        if (onNotify) onNotify(`Closed/Locked number ${number}`, 'success');
      }
      loadHeatmap(selectedDrawId);
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Failed to update number status', 'error');
    }
  };

  const handleAddClosedNumberModal = async (e) => {
    e.preventDefault();
    if (!newNumber.trim() || newNumber.length !== 4) {
      alert('Please enter a valid 4-digit number (e.g. 9792)');
      return;
    }
    try {
      setSubmitting(true);
      await apiClient.addAdminClosedNumber({
        draw_id: selectedDrawId,
        number: newNumber.trim(),
        reason: newReason
      });
      if (onNotify) onNotify(`Successfully closed number ${newNumber}`, 'success');
      setNewNumber('');
      setIsAddModalOpen(false);
      loadHeatmap(selectedDrawId);
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Failed to close number', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const riskStats = heatmapData?.risk_stats || {
    total_pool_staked: 0,
    total_combinations_covered: 0,
    coverage_percentage: 0,
    hot_numbers_count: 0,
    max_staked_number: '0000',
    max_staked_amount: 0,
    max_potential_payout: 0,
    risk_limit_per_number: 11000,
    total_closed_count: 0
  };

  const rawNumbers = heatmapData?.numbers || [];
  const closedSet = new Set(heatmapData?.closed_numbers || []);

  // Filter numbers based on UI controls
  const filteredNumbers = rawNumbers.filter((item) => {
    // Search filter
    if (searchNumber.trim() && !item.number.includes(searchNumber.trim())) {
      return false;
    }
    // Filter mode
    if (filterMode === 'HOT' && !item.is_hot) {
      return false;
    }
    if (filterMode === 'CLOSED' && !closedSet.has(item.number)) {
      return false;
    }
    return true;
  });

  const displayList = filterMode === 'TOP'
    ? [...filteredNumbers].sort((a, b) => (b.total_staked || 0) - (a.total_staked || 0)).slice(0, 100)
    : filteredNumbers;

  const currentDraw = availableDraws.find((d) => d.id === selectedDrawId) || availableDraws[0];

  return (
    <div className="space-y-6">
      {/* Draw Switcher Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-navy-900/90 border border-gold-500/20 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          <Calendar className="w-5 h-5 text-gold-400 shrink-0 mr-1" />
          {availableDraws.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDrawId(d.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                selectedDrawId === d.id
                  ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
                  : 'bg-navy-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>{d.draw_date}</span>
              <span className="text-[10px] opacity-80">#{d.draw_number}</span>
              {mode === 'past' && d.first_prize && d.first_prize !== '-' && (
                <span className={`px-1.5 py-0.2 text-[9px] rounded font-black border ${
                  selectedDrawId === d.id
                    ? 'bg-black/80 text-amber-300 border-amber-900/60'
                    : 'bg-gold-500/20 text-gold-300 border-gold-500/30'
                }`}>
                  1st: {d.first_prize}
                </span>
              )}
              {mode === 'live' && d.status === 'OPEN' && (
                <span className="px-1.5 py-0.5 text-[9px] bg-emerald-500/20 text-emerald-300 rounded font-black border border-emerald-500/30">
                  OPEN
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadHeatmap(selectedDrawId)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-navy-800 hover:bg-navy-750 text-gold-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {mode !== 'past' && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950 transition-all cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>+ Lock / Close Number</span>
            </button>
          )}
        </div>
      </div>

      {/* Official Past Draw Results Banner for Past Games */}
      {mode === 'past' && currentDraw && (
        <div className="bg-navy-900/90 border border-gold-500/30 p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold-500/20 text-gold-400 flex items-center justify-center font-black border border-gold-500/40 text-lg">
              🏆
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-sm">Past Game Results #{currentDraw.draw_number}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  SETTLED (ရလဒ်ထွက်ပြီး)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">Official Singapore 4D Draw Date: {currentDraw.draw_date}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 font-mono">
            <div className="bg-navy-950 px-3.5 py-1.5 rounded-xl border border-gold-500/40 text-center">
              <span className="text-[10px] text-slate-400 block font-sans">1st Prize</span>
              <span className="text-gold-300 text-base font-black tracking-widest">{currentDraw.first_prize || '-'}</span>
            </div>
            <div className="bg-navy-950 px-3.5 py-1.5 rounded-xl border border-slate-700 text-center">
              <span className="text-[10px] text-slate-400 block font-sans">2nd Prize</span>
              <span className="text-slate-200 text-base font-black tracking-widest">{currentDraw.second_prize || '-'}</span>
            </div>
            <div className="bg-navy-950 px-3.5 py-1.5 rounded-xl border border-amber-800/60 text-center">
              <span className="text-[10px] text-slate-400 block font-sans">3rd Prize</span>
              <span className="text-amber-400 text-base font-black tracking-widest">{currentDraw.third_prize || '-'}</span>
            </div>
            <div className="bg-navy-950 px-3.5 py-1.5 rounded-xl border border-rose-500/30 text-right">
              <span className="text-[10px] text-slate-400 block font-sans">Total Payout Disbursed</span>
              <span className="text-rose-400 text-base font-black">
                Ks {(currentDraw.total_payout || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4 Executive Risk KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Combinations Covered */}
        <div className="bg-navy-900/90 border border-gold-500/30 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-extrabold text-gold-400 tracking-wider">
              10K Coverage (စုံဂဏန်းလွှမ်းခြုံမှု)
            </span>
            <Layers className="w-4 h-4 text-gold-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white">
              {riskStats.total_combinations_covered.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">/ 10,000</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-slate-400">Market Coverage:</span>
            <span className="font-bold text-emerald-400 font-mono">
              {riskStats.coverage_percentage}% FULL
            </span>
          </div>
        </div>

        {/* Total Staked Pool */}
        <div className="bg-navy-900/90 border border-emerald-500/30 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-extrabold text-emerald-400 tracking-wider">
              Total Pool Staked
            </span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-400">
              Ks {riskStats.total_pool_staked.toLocaleString()}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-slate-400">Target Draw:</span>
            <span className="font-bold text-white font-mono">
              {heatmapData?.draw_date} (#{heatmapData?.draw_number})
            </span>
          </div>
        </div>

        {/* Peak Risk Number & Liability */}
        <div 
          onClick={() => handleOpenNumberAudit(riskStats.max_staked_number)}
          className="bg-navy-900/90 border border-rose-500/30 hover:border-rose-400 rounded-2xl p-4 shadow-xl relative overflow-hidden cursor-pointer transition-all hover:scale-[1.01] group"
          title="Click to view bets audit for this peak number"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-extrabold text-rose-400 tracking-wider flex items-center gap-1">
              <span>Peak Staked Number</span>
              <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded font-normal opacity-0 group-hover:opacity-100 transition-opacity">
                Audit 🔍
              </span>
            </span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-rose-300 tracking-wider underline decoration-rose-500/40 decoration-dashed">
              {riskStats.max_staked_number}
            </span>
            <span className="text-xs text-slate-400">
              (Ks {riskStats.max_staked_amount.toLocaleString()})
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-slate-400">Max 1st Prize Liability:</span>
            <span className="font-bold text-rose-400 font-mono">
              -Ks {riskStats.max_potential_payout.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Closed & Hot Numbers Count */}
        <div className="bg-navy-900/90 border border-purple-500/30 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-extrabold text-purple-400 tracking-wider">
              Locked & Hot Numbers
            </span>
            <ShieldAlert className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white">
              {riskStats.total_closed_count} Locked
            </span>
            <span className="text-xs text-amber-400">
              / {riskStats.hot_numbers_count} Hot
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-slate-400">Quota Cap per No:</span>
            <span className="font-bold text-gold-400 font-mono">
              Ks {riskStats.risk_limit_per_number.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Closed Numbers Chips Bar (Live mode only) */}
      {mode !== 'past' && closedSet.size > 0 && (
        <div className="bg-navy-900/90 border border-rose-500/30 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Currently Closed / Blocked Numbers ({closedSet.size})
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Click &times; to re-open number for betting</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {Array.from(closedSet).map((num) => (
              <span
                key={num}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono font-bold text-xs"
              >
                <span>{num}</span>
                <button
                  onClick={() => handleToggleClosedNumber(num, true)}
                  className="hover:text-white p-0.5 rounded cursor-pointer transition-colors"
                  title="Unlock Number"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 10,000 Combinations Quota Grid & Filter Hub */}
      <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-5 shadow-xl space-y-4">
        {/* Top Controls: Search, Prefix Filter Tabs, Quick Mode Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gold-500/15 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'ALL'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'bg-navy-800 text-slate-400 hover:text-white'
              }`}
            >
              All Numbers ({rawNumbers.length})
            </button>
            <button
              onClick={() => setFilterMode('HOT')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                filterMode === 'HOT'
                  ? 'bg-rose-500 text-white font-black shadow-md'
                  : 'bg-navy-800 text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>Hot Only ({riskStats.hot_numbers_count})</span>
            </button>
            <button
              onClick={() => setFilterMode('CLOSED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                filterMode === 'CLOSED'
                  ? 'bg-purple-600 text-white font-black shadow-md'
                  : 'bg-navy-800 text-slate-400 hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Closed ({closedSet.size})</span>
            </button>
            <button
              onClick={() => setFilterMode('TOP')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'TOP'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'bg-navy-800 text-slate-400 hover:text-white'
              }`}
            >
              Top 100 Highest Stake
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Instant search (e.g. 9792)..."
              value={searchNumber}
              onChange={(e) => setSearchNumber(e.target.value)}
              className="w-full bg-navy-950 border border-gold-500/20 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-gold-400 font-mono"
            />
          </div>
        </div>

        {/* 10 Prefix Jump Bars (0xxx to 9xxx) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 text-[11px] font-semibold shrink-0 mr-1">Prefix Jump:</span>
          {['ALL', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPrefix(p)}
              className={`px-2.5 py-1 rounded-lg font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedPrefix === p
                  ? 'bg-amber-500/20 text-gold-300 border border-gold-500/50'
                  : 'bg-navy-950 text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              {p === 'ALL' ? 'ALL 10K' : `${p}000-${p}999`}
            </button>
          ))}
        </div>

        {/* The Live Grid */}
        <div className="pt-2">
          {loading ? (
            <div className="py-20 text-center text-slate-500 font-mono">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gold-400 mb-3" />
              Loading 10,000 combination risk matrix...
            </div>
          ) : displayList.length === 0 ? (
            <div className="py-16 text-center text-slate-500 border border-dashed border-gold-500/20 rounded-2xl">
              No numbers found matching criteria.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2.5 max-h-[640px] overflow-y-auto pr-1">
              {displayList.map((item) => {
                const isClosed = closedSet.has(item.number);
                const isHot = item.is_hot || item.total_staked >= 5000;
                const quotaPct = Math.min(100, Math.round((item.total_staked / 11000) * 100));
                const isFirstPrize = mode === 'past' && currentDraw?.first_prize === item.number;
                const isSecondPrize = mode === 'past' && currentDraw?.second_prize === item.number;
                const isThirdPrize = mode === 'past' && currentDraw?.third_prize === item.number;
                const isWinningPrize = isFirstPrize || isSecondPrize || isThirdPrize;

                return (
                  <div
                    key={item.number}
                    onClick={() => handleOpenNumberAudit(item.number)}
                    className={`relative p-2.5 rounded-xl border transition-all group flex flex-col justify-between cursor-pointer hover:scale-[1.03] hover:shadow-lg ${
                      isWinningPrize
                        ? 'bg-amber-500/20 border-gold-400 ring-2 ring-gold-400/50 shadow-lg shadow-gold-500/20'
                        : isClosed
                        ? 'bg-slate-900/80 border-rose-900/60 opacity-60'
                        : isHot
                        ? 'bg-rose-950/40 border-rose-500/60 shadow-lg shadow-rose-950/30'
                        : item.total_staked >= 2000
                        ? 'bg-amber-950/30 border-amber-500/40'
                        : 'bg-navy-950 border-gold-500/15 hover:border-gold-500/40'
                    }`}
                    title={`Click #${item.number} to view player bet history`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-base font-black font-mono tracking-widest ${
                        isWinningPrize
                          ? 'text-gold-300 font-extrabold'
                          : isClosed
                          ? 'line-through text-slate-500'
                          : isHot
                          ? 'text-rose-300'
                          : 'text-gold-300'
                      }`}>
                        {item.number}
                      </span>

                      {isFirstPrize && (
                        <span className="px-1.5 py-0.2 text-[9px] bg-gold-500 text-slate-950 rounded font-black">
                          1ST
                        </span>
                      )}
                      {isSecondPrize && (
                        <span className="px-1.5 py-0.2 text-[9px] bg-slate-300 text-slate-950 rounded font-black">
                          2ND
                        </span>
                      )}
                      {isThirdPrize && (
                        <span className="px-1.5 py-0.2 text-[9px] bg-amber-600 text-white rounded font-black">
                          3RD
                        </span>
                      )}

                      {/* Lock / Unlock Toggle Button (Only in Live Game Mode) */}
                      {mode !== 'past' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleClosedNumber(item.number, isClosed);
                          }}
                          className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                            isClosed
                              ? 'hover:bg-emerald-500/20 text-emerald-400'
                              : 'hover:bg-rose-500/20 text-rose-400'
                          }`}
                          title={isClosed ? 'Click to Unlock' : 'Click to Lock/Close'}
                        >
                          {isClosed ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        </button>
                      )}
                    </div>

                    <div className="mt-1 space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-400 text-[10px]">Staked:</span>
                        <span className={`font-bold ${isHot ? 'text-rose-300' : 'text-white'}`}>
                          {item.total_staked.toLocaleString()} Ks
                        </span>
                      </div>

                      {/* Quota Progress Bar */}
                      <div className="w-full bg-navy-800 h-1 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            quotaPct > 80 ? 'bg-rose-500' : quotaPct > 40 ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.max(5, quotaPct)}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                        <span>{item.bet_count} bets</span>
                        <span>{quotaPct}% cap</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Close Number Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-navy-900 border border-gold-500/30 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gold-500/20 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white font-serif">
                  Close 4D Number (ဂဏန်းပိတ်ရန်)
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddClosedNumberModal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  4-Digit Number (e.g. 9792, 8899)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  required
                  placeholder="e.g. 9792"
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-gold-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reason for Closing
                </label>
                <select
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold-400"
                >
                  <option value="Admin Manual Lock">Admin Manual Lock (စီမံခန့်ခွဲသူမှ တိုက်ရိုက်ပိတ်ခြင်း)</option>
                  <option value="Risk Exceeded Limit">Risk Exceeded Limit (သတ်မှတ်ခွင့်ပြုငွေ ပြည့်သွားခြင်း)</option>
                  <option value="Singapore Pools Hot Number">Singapore Pools Hot Number (ရေပန်းစားဂဏန်း)</option>
                  <option value="Special Draw Block">Special Draw Block</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gold-500/20">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-navy-800 text-slate-300 text-xs font-semibold hover:bg-navy-750 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || newNumber.length !== 4}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Closing...' : 'Confirm Lock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4D Number Bet History & Players Audit Popup Modal */}
      {auditNumber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-navy-900 border border-gold-500/40 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-4 relative max-h-[90vh] flex flex-col">
            {/* Close Button */}
            <button
              onClick={() => {
                setAuditNumber(null);
                setAuditData(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-navy-800 text-xl font-bold cursor-pointer"
            >
              &times;
            </button>

            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-gold-500/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-navy-950 border-2 border-gold-400/60 flex items-center justify-center shadow-lg shadow-gold-500/10">
                  <span className="text-2xl font-black font-mono text-gold-400 tracking-widest">
                    {auditNumber}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white font-serif">
                      4D Number Bet Audit: #{auditNumber}
                    </h3>
                    {closedSet.has(auditNumber) ? (
                      <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                        LOCKED / CLOSED
                      </span>
                    ) : (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                        ACTIVE OPEN
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Target Draw: {auditData?.draw_date || heatmapData?.draw_date} (#{selectedDrawId})
                  </p>
                </div>
              </div>

              {/* Quick Lock / Unlock Action */}
              <button
                onClick={async () => {
                  const currentlyClosed = closedSet.has(auditNumber);
                  await handleToggleClosedNumber(auditNumber, currentlyClosed);
                  handleOpenNumberAudit(auditNumber);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all mr-6 cursor-pointer ${
                  closedSet.has(auditNumber)
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                }`}
              >
                {closedSet.has(auditNumber) ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span>{closedSet.has(auditNumber) ? 'Unlock Number' : 'Lock Number'}</span>
              </button>
            </div>

            {/* KPI Badges Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-navy-950 border border-gold-500/20 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Staked</span>
                <p className="text-lg font-black font-mono text-gold-300 mt-0.5">
                  {(auditData?.total_staked || 0).toLocaleString()} Ks
                </p>
              </div>

              <div className="p-3 rounded-xl bg-navy-950 border border-gold-500/20 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Bets Count</span>
                <p className="text-lg font-black font-mono text-white mt-0.5">
                  {auditData?.bet_count || 0} Tickets
                </p>
              </div>

              <div className="p-3 rounded-xl bg-navy-950 border border-rose-500/30 text-center">
                <span className="text-[10px] text-rose-400 uppercase font-semibold">Peak 1st Prize Risk</span>
                <p className="text-lg font-black font-mono text-rose-300 mt-0.5">
                  -{(auditData?.peak_liability || 0).toLocaleString()} Ks
                </p>
              </div>
            </div>

            {/* Bet Slips List / Table */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-serif">
                Players Who Bet On #{auditNumber} ({auditData?.bets?.length || 0} Records)
              </h4>

              {loadingAudit ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-gold-400" />
                  <p className="text-xs text-slate-400 font-mono">Loading player bets for #{auditNumber}...</p>
                </div>
              ) : !auditData?.bets || auditData.bets.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-gold-500/20 rounded-xl text-slate-400 text-xs">
                  No bets placed on #{auditNumber} for this draw yet. (Total Stake: 0 Ks)
                </div>
              ) : (
                <div className="space-y-2">
                  {auditData.bets.map((b, idx) => (
                    <div
                      key={b.id || idx}
                      className="p-3 rounded-xl bg-navy-950/80 border border-gold-500/15 hover:border-gold-500/30 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      {/* Player & Slip Info */}
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-navy-800 border border-gold-500/30 flex items-center justify-center text-xs font-bold text-gold-400 font-mono">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white font-mono">{b.player_phone}</span>
                            <span className="text-[10px] text-slate-400">({b.player_name})</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-slate-400">
                            <span>Voucher: <strong className="text-gold-400">{b.voucher}</strong></span>
                            <button
                              onClick={() => handleCopyVoucher(b.voucher)}
                              className="p-0.5 rounded text-slate-500 hover:text-gold-300 transition-colors cursor-pointer"
                              title="Copy Voucher"
                            >
                              {copiedVoucher === b.voucher ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                            <span>•</span>
                            <span>{b.created_at}</span>
                          </div>
                        </div>
                      </div>

                      {/* Bet Type & Amount */}
                      <div className="flex items-center gap-4 self-end sm:self-center">
                        <div className="text-right">
                          <span className="inline-block text-[10px] bg-navy-800 text-slate-300 font-semibold px-2 py-0.5 rounded uppercase">
                            {b.bet_type}
                          </span>
                          <p className="text-sm font-black font-mono text-emerald-400 mt-0.5">
                            {Number(b.stake_amount || 0).toLocaleString()} Ks
                          </p>
                        </div>

                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.status === 'Won'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : b.status === 'Lost'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {b.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-gold-500/20 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Click any number in the 10,000 grid to inspect player bet distribution.
              </span>
              <button
                onClick={() => {
                  setAuditNumber(null);
                  setAuditData(null);
                }}
                className="px-5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md shadow-amber-950 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
