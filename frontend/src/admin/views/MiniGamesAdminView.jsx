import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Sliders,
  DollarSign,
  TrendingUp,
  Percent,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Save,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Coins,
  Dice5
} from 'lucide-react';
import { apiClient } from '../../api/client';

export default function MiniGamesAdminView({ onNotify }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // RTP & Game Controls State
  const [isEnabled, setIsEnabled] = useState(true);
  const [rtpRate, setRtpRate] = useState(95.0);
  const [minBet, setMinBet] = useState(50);
  const [maxBet, setMaxBet] = useState(50000);

  // Bets Table State
  const [bets, setBets] = useState([]);
  const [betsLoading, setBetsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBetsCount, setTotalBetsCount] = useState(0);

  // Filters
  const [selectedGame, setSelectedGame] = useState('');
  const [selectedOutcome, setSelectedOutcome] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    loadOverview();
    loadBets(1);
    const timer = setInterval(() => {
      loadOverview(true);
    }, 12000);
    return () => clearInterval(timer);
  }, []);

  const loadOverview = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiClient.getAdminMiniGamesOverview();
      if (res && res.status === 'success') {
        setOverview(res);
        if (!silent) {
          setIsEnabled(res.settings?.is_enabled ?? true);
          setRtpRate(res.settings?.configured_rtp ?? 95.0);
          setMinBet(res.settings?.min_stake ?? 50);
          setMaxBet(res.settings?.max_stake ?? 50000);
        }
      }
    } catch (err) {
      console.error('Failed to load minigames overview:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadBets = async (targetPage = 1) => {
    setBetsLoading(true);
    try {
      const params = {
        page: targetPage,
        limit: pageSize,
        game_type: selectedGame || undefined,
        is_win: selectedOutcome !== '' ? selectedOutcome : undefined,
        search: searchQuery.trim() || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined
      };
      const res = await apiClient.getAdminMiniGamesBets(params);
      if (res && res.items) {
        setBets(res.items);
        setPage(res.page || targetPage);
        setTotalPages(res.total_pages || 1);
        setTotalBetsCount(res.total || 0);
      }
    } catch (err) {
      console.error('Failed to load minigames bets:', err);
    } finally {
      setBetsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    const rate = parseFloat(rtpRate);
    if (isNaN(rate) || rate < 50 || rate > 99) {
      if (onNotify) onNotify('RTP % must be between 50.0% and 99.0%', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.updateAdminMiniGamesSettings({
        is_mini_games_enabled: isEnabled,
        minigames_rtp_rate: rate,
        minigames_min_bet: parseFloat(minBet) || 50,
        minigames_max_bet: parseFloat(maxBet) || 50000
      });
      if (res && res.status === 'success') {
        if (onNotify) {
          onNotify(`Mini-Games RTP set to ${rate}% (House Edge ${round(100 - rate, 1)}%)!`, 'success');
        }
        loadOverview(true);
      } else {
        if (onNotify) onNotify(res?.detail || 'Failed to save settings', 'error');
      }
    } catch (err) {
      if (onNotify) onNotify('Error updating mini-game settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadBets(1);
  };

  const handleResetFilters = () => {
    setSelectedGame('');
    setSelectedOutcome('');
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setPage(1);
    setTimeout(() => {
      loadBets(1);
    }, 50);
  };

  const houseEdge = round(100 - (parseFloat(rtpRate) || 95), 1);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 border border-gold-500/30 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl gold-border-glow">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-gold-400/20 border border-gold-500/40 flex items-center justify-center text-gold-400 shadow-inner">
            <Gamepad2 className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white tracking-wide">
                Mini-Games Control & Real-Time Monitoring
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                isEnabled
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                {isEnabled ? '● Active' : '○ Disabled'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-sans">
              Dynamic RTP (House Edge) configuration, live player history & profit reconciliation.
            </p>
          </div>
        </div>

        <button
          onClick={() => { loadOverview(); loadBets(page); }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-navy-800 hover:bg-navy-700 text-gold-400 border border-gold-500/30 text-xs font-bold transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading || betsLoading ? 'animate-spin' : ''}`} />
          Refresh Live
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-navy-900/90 border border-gold-500/20 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today's Stake</span>
            <DollarSign className="w-4 h-4 text-cyan-400" />
          </div>
          <h3 className="text-xl font-mono font-black text-cyan-400">
            Ks {(overview?.today?.stake_amount || 0).toLocaleString()}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 font-sans">
            {overview?.today?.bets_count || 0} bets played today
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-navy-900/90 border border-gold-500/20 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today's Payouts</span>
            <Coins className="w-4 h-4 text-rose-400" />
          </div>
          <h3 className="text-xl font-mono font-black text-rose-400">
            -Ks {(overview?.today?.payout_amount || 0).toLocaleString()}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 font-sans">
            Paid out to winning players
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-navy-900/90 border border-gold-500/20 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today Company Profit</span>
            <TrendingUp className="w-4 h-4 text-gold-400" />
          </div>
          <h3 className={`text-xl font-mono font-black ${(overview?.today?.net_profit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {(overview?.today?.net_profit || 0) >= 0 ? '+' : ''}Ks {(overview?.today?.net_profit || 0).toLocaleString()}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 font-sans">
            House Profit = Stakes - Payouts
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-navy-900/90 border border-gold-500/20 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today Realized RTP</span>
            <Percent className="w-4 h-4 text-purple-400" />
          </div>
          <h3 className="text-xl font-mono font-black text-purple-300">
            {(overview?.today?.actual_rtp || 0).toFixed(1)}%
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 font-sans">
            Target: {overview?.settings?.configured_rtp || 95}% (Edge: {overview?.settings?.house_edge || 5}%)
          </p>
        </div>
      </div>

      {/* RTP & House Edge Control Panel */}
      <div className="bg-navy-900/90 border border-gold-500/30 p-6 rounded-2xl shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                RTP (Return to Player) & Margin Configuration
              </h3>
              <p className="text-xs text-slate-400">
                Control the long-term mathematical House Edge. Payout probabilities calibrate automatically in real-time.
              </p>
            </div>
          </div>

          {/* Master Enable/Disable Switch */}
          <div className="flex items-center gap-3 bg-navy-950 px-4 py-2 rounded-xl border border-slate-800">
            <span className="text-xs font-bold text-slate-300">Mini-Games Master Switch:</span>
            <button
              type="button"
              onClick={() => setIsEnabled(!isEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                isEnabled ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-xs font-mono font-bold ${isEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>
              {isEnabled ? 'ENABLED' : 'PAUSED'}
            </span>
          </div>
        </div>

        {/* RTP Presets & Slider */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4 md:col-span-2 bg-navy-950/70 p-5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gold-400 uppercase tracking-wider">
                Configured RTP Rate
              </label>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-mono font-black text-white">{rtpRate}%</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  House Edge: {houseEdge}%
                </span>
              </div>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="80"
              max="98"
              step="0.5"
              value={rtpRate}
              onChange={(e) => setRtpRate(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-gold-400"
            />

            {/* Recommended Preset Buttons */}
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="text-xs text-slate-400 self-center mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => setRtpRate(92.0)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  rtpRate === 92.0
                    ? 'bg-amber-500 text-navy-950 font-black shadow-md'
                    : 'bg-navy-900 hover:bg-navy-800 text-slate-300 border border-slate-700'
                }`}
              >
                92% (8.0% House Edge - High Profit)
              </button>
              <button
                type="button"
                onClick={() => setRtpRate(95.0)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  rtpRate === 95.0
                    ? 'bg-gold-500 text-navy-950 font-black shadow-md'
                    : 'bg-navy-900 hover:bg-navy-800 text-slate-300 border border-slate-700'
                }`}
              >
                ⭐ 95% (5.0% House Edge - Balanced / Standard)
              </button>
              <button
                type="button"
                onClick={() => setRtpRate(97.0)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  rtpRate === 97.0
                    ? 'bg-emerald-500 text-navy-950 font-black shadow-md'
                    : 'bg-navy-900 hover:bg-navy-800 text-slate-300 border border-slate-700'
                }`}
              >
                97% (3.0% House Edge - Player Retention)
              </button>
            </div>
          </div>

          {/* Min & Max Bet Limits */}
          <div className="space-y-4 bg-navy-950/70 p-5 rounded-xl border border-slate-800/80 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                Stake Limits (MMK)
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Minimum Stake per Play</label>
                  <input
                    type="number"
                    min="10"
                    step="50"
                    value={minBet}
                    onChange={(e) => setMinBet(e.target.value)}
                    className="w-full bg-navy-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-gold-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Maximum Stake per Play</label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    value={maxBet}
                    onChange={(e) => setMaxBet(e.target.value)}
                    className="w-full bg-navy-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-gold-400"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="w-full mt-3 py-2.5 px-4 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 hover:from-gold-400 hover:to-amber-400 text-navy-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
              {saving ? 'Updating Settings...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>

      {/* Game Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {overview?.breakdown?.map((item) => (
          <div key={item.game_type} className="p-4 rounded-2xl bg-navy-900/90 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{item.icon}</span>
                <div>
                  <h4 className="text-sm font-bold text-white">{item.title}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">{item.bets_count} Plays Total</span>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                item.net_profit >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {item.net_profit >= 0 ? 'Profitable' : 'Deficit'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">Total Stake:</span>
                <span className="font-bold text-cyan-400">Ks {item.stake_amount.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">Payouts:</span>
                <span className="font-bold text-rose-400">Ks {item.payout_amount.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">Net Margin:</span>
                <span className={`font-bold ${item.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {item.net_profit >= 0 ? '+' : ''}Ks {item.net_profit.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">Realized RTP:</span>
                <span className="font-bold text-purple-300">{item.actual_rtp}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Live Bets History Table & Search */}
      <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl shadow-xl overflow-hidden space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Dice5 className="w-4 h-4 text-gold-400" />
              Real-Time Mini-Games Plays & History ({totalBetsCount})
            </h3>
            <p className="text-[11px] text-slate-400">
              Audit log of all user rolls, spins, stakes, multipliers, and house win/loss.
            </p>
          </div>

          <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-center gap-2 text-xs">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search phone or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-navy-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold-400 w-44"
              />
            </div>

            {/* Game Selector */}
            <select
              value={selectedGame}
              onChange={(e) => setSelectedGame(e.target.value)}
              className="bg-navy-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-gold-400"
            >
              <option value="">All Mini-Games</option>
              <option value="WHEEL">🎡 Lucky Wheel</option>
              <option value="COIN_FLIP">🪙 Head or Tail</option>
              <option value="DICE">🎲 Dice Roll</option>
            </select>

            {/* Outcome Filter */}
            <select
              value={selectedOutcome}
              onChange={(e) => setSelectedOutcome(e.target.value)}
              className="bg-navy-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-gold-400"
            >
              <option value="">All Outcomes</option>
              <option value="true">Won</option>
              <option value="false">Lost</option>
            </select>

            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold transition-colors cursor-pointer"
            >
              Filter
            </button>

            <button
              type="button"
              onClick={handleResetFilters}
              className="px-2.5 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-300 font-medium transition-colors cursor-pointer"
            >
              Reset
            </button>
          </form>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-navy-950 text-slate-400 uppercase font-bold tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Player</th>
                <th className="py-2.5 px-3">Game</th>
                <th className="py-2.5 px-3">Choice</th>
                <th className="py-2.5 px-3 text-right">Stake</th>
                <th className="py-2.5 px-3 text-center">Multiplier</th>
                <th className="py-2.5 px-3 text-right">Payout</th>
                <th className="py-2.5 px-3">Result Details</th>
                <th className="py-2.5 px-3 text-right">House Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-slate-300 font-mono text-[11px]">
              {betsLoading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500 font-sans">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-gold-400 mb-2" />
                    Loading mini-game bets...
                  </td>
                </tr>
              ) : bets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500 font-sans">
                    No mini-game plays found matching criteria.
                  </td>
                </tr>
              ) : (
                bets.map((bet) => {
                  const houseProfit = bet.stake_amount - bet.payout_amount;
                  return (
                    <tr key={bet.id} className="hover:bg-navy-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-sans text-slate-400 text-[10px]">
                        {bet.created_at}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="font-bold text-white block">{bet.username || 'Player'}</span>
                        <span className="text-[10px] text-slate-400">{bet.phone}</span>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-200">
                          {bet.game_type === 'WHEEL' && '🎡 Wheel'}
                          {bet.game_type === 'COIN_FLIP' && '🪙 Coin'}
                          {bet.game_type === 'DICE' && '🎲 Dice'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px]">
                          {bet.player_choice}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-cyan-400">
                        Ks {bet.stake_amount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          bet.payout_multiplier > 0
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {bet.payout_multiplier}x
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-400">
                        {bet.payout_amount > 0 ? `Ks ${bet.payout_amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-[10px] text-slate-400">
                        {bet.game_type === 'WHEEL' && (
                          <span>{bet.result_data?.label || `${bet.payout_multiplier}x`}</span>
                        )}
                        {bet.game_type === 'COIN_FLIP' && (
                          <span>Fell on {bet.result_data?.outcome || bet.player_choice}</span>
                        )}
                        {bet.game_type === 'DICE' && (
                          <span>
                            Dice: [{bet.result_data?.dice?.join(', ')}] = {bet.result_data?.sum}
                            {bet.result_data?.is_triple ? ' (Triple!)' : ''}
                          </span>
                        )}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${
                        houseProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {houseProfit >= 0 ? '+' : ''}Ks {houseProfit.toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-xs">
            <span className="text-slate-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => { const p = page - 1; setPage(p); loadBets(p); }}
                className="p-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => { const p = page + 1; setPage(p); loadBets(p); }}
                className="p-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function round(val, dec = 1) {
  const f = Math.pow(10, dec);
  return Math.round(val * f) / f;
}
