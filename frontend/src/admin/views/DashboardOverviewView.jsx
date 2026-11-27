import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Trophy,
  Coins,
  Wallet,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Clock,
  ArrowRight,
  Dices,
  Users,
  UserCheck,
  Receipt
} from 'lucide-react';
import { apiClient } from '../../api/client';

export default function DashboardOverviewView({ onNotify, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [balanceData, setBalanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    loadDashboardData();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadDashboardData(false);
      }
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadDashboardData(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const loadDashboardData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const [statsRes, balRes] = await Promise.allSettled([
        apiClient.getAdminDashboardStats(),
        apiClient.getAdminCompanyBalance()
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats(statsRes.value);
      }
      if (balRes.status === 'fulfilled' && balRes.value) {
        setBalanceData(balRes.value);
      }
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Error loading dashboard overview:', err);
      if (onNotify && showLoading) onNotify(err.message || 'Failed to load dashboard overview', 'error');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const formatSignedKs = (val) => {
    const num = Number(val || 0);
    return num < 0 ? `-Ks ${Math.abs(num).toLocaleString()}` : `Ks ${num.toLocaleString()}`;
  };

  const currentMonthLabel = balanceData?.month || new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });
  const companyBalance = balanceData?.company_balance ?? 0;
  const monthBets = balanceData?.total_bets ?? 0;
  const monthMiniNet = balanceData?.mini_game_net ?? 0;

  const totalBets = stats?.total_bets_all_time ?? 0;
  const totalPayouts = stats?.total_payouts_all_time ?? 0;
  const totalCommissions = stats?.total_commissions_all_time ?? 0;
  const pendingCommissions = stats?.pending_commissions_all_time ?? 0;
  const totalNetProfit = stats?.total_net_profit ?? 0;
  const recentTransactions = stats?.recent_transactions || [];
  const recentBets = stats?.recent_bets || [];
  const activeDraw = stats?.active_draw;
  const lastDraw = stats?.last_settled_draw;
  const masterAgent = stats?.master_agent;

  const gameBadgeClass = (gt) => {
    if (gt === '2D') return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    if (gt === '3D') return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  };

  const ledgerBadgeClass = (entryType) => {
    switch (entryType) {
      case 'BET_REVENUE':
      case 'BET_STAKE':
      case 'DEPOSIT':
        return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      case 'PAYOUT_EXPENSE':
      case 'PRIZE_PAYOUT':
      case 'WITHDRAWAL':
        return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
      case 'AGENT_COMMISSION':
        return 'bg-amber-500/20 text-gold-300 border border-gold-500/30';
      case 'WEEKLY_BONUS':
        return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
      default:
        return 'bg-navy-800 text-slate-300 border border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 font-serif">
              <span className="text-gold-400">🦚</span>
              <span className="bg-gradient-to-r from-gold-200 via-gold-400 to-amber-500 bg-clip-text text-transparent">
                Executive Audit & Revenue Overview
              </span>
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time platform health across 4D, 2D, 3D, Mini-Games, Deposits/Withdrawals & Agent Network.
            {lastUpdated && <span className="ml-2 text-slate-500 font-mono">Synced: {lastUpdated}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadDashboardData(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy-900 border border-gold-500/30 hover:border-gold-400 text-gold-300 text-xs font-bold transition-all cursor-pointer shadow-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-gold-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <a
            href="/"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black transition-all shadow-md cursor-pointer"
            title="Go to Player App"
          >
            <Dices className="w-3.5 h-3.5" />
            <span>Player App</span>
          </a>
        </div>
      </div>

      {/* 2. Action Queue & Platform Pulse (5 Quick Audit Tiles) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div
          onClick={() => onNavigate && onNavigate('top-up')}
          className={`bg-navy-900/90 border p-3.5 rounded-xl transition-all cursor-pointer group ${
            (stats?.pending_deposits_count || 0) > 0
              ? 'border-amber-400/60 hover:border-amber-300'
              : 'border-gold-500/20 hover:border-gold-400/50'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Deposit Review</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className={`text-lg font-black font-mono mt-1 ${(stats?.pending_deposits_count || 0) > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-300'}`}>
            {(stats?.pending_deposits_count || 0)} Pending
          </div>
          <span className="text-[10px] text-slate-400">Approved: Ks {(stats?.total_deposits_all_time || 0).toLocaleString()}</span>
        </div>

        <div
          onClick={() => onNavigate && onNavigate('withdraw')}
          className={`bg-navy-900/90 border p-3.5 rounded-xl transition-all cursor-pointer group ${
            (stats?.pending_withdrawals_count || 0) > 0
              ? 'border-rose-400/60 hover:border-rose-300'
              : 'border-gold-500/20 hover:border-gold-400/50'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Withdraw Review</span>
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className={`text-lg font-black font-mono mt-1 ${(stats?.pending_withdrawals_count || 0) > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-300'}`}>
            {(stats?.pending_withdrawals_count || 0)} Pending
          </div>
          <span className="text-[10px] text-slate-400">Paid: Ks {(stats?.total_withdrawals_all_time || 0).toLocaleString()}</span>
        </div>

        <div
          onClick={() => onNavigate && onNavigate('app-users')}
          className="bg-navy-900/90 border border-gold-500/20 hover:border-gold-400/50 p-3.5 rounded-xl transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Registered Players</span>
            <Users className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-lg font-black text-white font-mono mt-1">
            {(stats?.total_registered_users || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-blue-300 font-medium">Real Accounts</span>
        </div>

        <div
          onClick={() => onNavigate && onNavigate('agent-commissions')}
          className="bg-navy-900/90 border border-gold-500/20 hover:border-gold-400/50 p-3.5 rounded-xl transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Active Agents</span>
            <UserCheck className="w-3.5 h-3.5 text-gold-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-lg font-black text-gold-300 font-mono mt-1">
            {(stats?.total_agents_count || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-gold-400 font-medium">30% Tier Network</span>
        </div>

        <div
          onClick={() => onNavigate && onNavigate('reports-financial')}
          className="bg-navy-900/90 border border-gold-500/20 hover:border-gold-400/50 p-3.5 rounded-xl transition-all cursor-pointer group col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Customer Balances</span>
            <Wallet className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-lg font-black text-purple-300 font-mono mt-1">
            Ks {(stats?.total_customer_balance || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400">Player Wallets Vault</span>
        </div>
      </div>

      {/* 3. 4 Core Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Monthly Company Balance */}
        <div
          onClick={() => onNavigate && onNavigate('reports-financial')}
          className="p-5 rounded-2xl bg-gradient-to-br from-navy-900 via-navy-900 to-navy-950 border border-gold-500/40 shadow-xl relative overflow-hidden group hover:border-gold-400 transition-all gold-border-glow cursor-pointer"
        >
          <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-gold-500/15 border border-gold-500/30 flex items-center justify-center text-gold-400">
            <Wallet className="w-5 h-5" />
          </div>
          <p className="text-[11px] uppercase font-bold tracking-wider text-gold-300">
            Company Balance ({currentMonthLabel})
          </p>
          <h3 className={`text-2xl font-black font-mono mt-1.5 ${companyBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatSignedKs(companyBalance)}
          </h3>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-navy-800 font-mono">
            <span>Bets: Ks {monthBets.toLocaleString()}</span>
            <span className={monthMiniNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              Mini: {formatSignedKs(monthMiniNet)}
            </span>
          </div>
        </div>

        {/* Card 2: Total Bets (All-Time Gross Volume) */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-navy-900 via-navy-900 to-navy-950 border border-gold-500/30 shadow-xl relative overflow-hidden group hover:border-gold-400/60 transition-all">
          <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400">
            <Coins className="w-5 h-5" />
          </div>
          <p className="text-[11px] uppercase font-bold tracking-wider text-slate-400">Total Bets (All-Time)</p>
          <h3 className="text-2xl font-black text-white font-mono mt-1.5">
            Ks {totalBets.toLocaleString()}
          </h3>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-navy-800">
            <span className="flex items-center text-emerald-400 font-semibold gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              {(stats?.total_bets_count || 0).toLocaleString()} Slips
            </span>
            <span className="text-slate-400 font-mono">
              Today: Ks {(stats?.today_bets || 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Card 3: Total Payouts & Commissions */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-navy-900 via-navy-900 to-navy-950 border border-rose-500/30 shadow-xl relative overflow-hidden group hover:border-rose-400/60 transition-all">
          <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <Trophy className="w-5 h-5" />
          </div>
          <p className="text-[11px] uppercase font-bold tracking-wider text-slate-400">Total Payouts & Comm</p>
          <h3 className="text-2xl font-black text-rose-400 font-mono mt-1.5">
            Ks {totalPayouts.toLocaleString()}
          </h3>
          <div className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-navy-800 font-mono flex items-center justify-between gap-2">
            <span className="truncate text-amber-300">
              Comm: Ks {totalCommissions.toLocaleString()}
              {masterAgent?.name ? ` (${masterAgent.name})` : ''}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-gold-500/20 text-gold-300 text-[10px] font-bold shrink-0">
              Pend: {pendingCommissions.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Card 4: All-Time Net Profit */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-navy-900 via-navy-900 to-navy-950 border border-emerald-500/30 shadow-xl relative overflow-hidden group hover:border-emerald-400/60 transition-all">
          <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-[11px] uppercase font-bold tracking-wider text-slate-400">All-Time Net Profit</p>
          <h3 className={`text-2xl font-black font-mono mt-1.5 ${totalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatSignedKs(totalNetProfit)}
          </h3>
          <div className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-navy-800 flex items-center justify-between font-mono">
            <span className="truncate text-purple-300">
              Bonus: Ks {(stats?.total_bonuses_all_time || 0).toLocaleString()}
            </span>
            <span className={`font-bold ${(stats?.today_net_profit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              Today: {formatSignedKs(stats?.today_net_profit || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Middle Grid: Active Open Draw Spotlight + Last Settled Draw Results Spotlight */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Current Active Open Draw */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-navy-900 via-navy-900 to-navy-950 border border-gold-500/30 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Open 4D Draw</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{activeDraw?.status || 'NONE'}</span>
            </span>
          </div>

          <div>
            <div className="text-3xl font-black text-white font-serif mb-1 tracking-wider">
              {activeDraw?.draw_number ? `#${activeDraw.draw_number}` : 'No Active Draw'}
            </div>
            <div className="text-xs text-gold-400 font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Draw Date: {activeDraw?.draw_date || '-'} (Singapore 4D)</span>
            </div>
          </div>

          <div className="space-y-2.5 text-xs border-t border-navy-800 pt-3">
            <div className="flex justify-between py-1 border-b border-navy-800/60">
              <span className="text-slate-400">Total Live Staked:</span>
              <span className="font-bold text-emerald-400 font-mono">Ks {(activeDraw?.total_staked || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-navy-800/60">
              <span className="text-slate-400">Combinations Covered:</span>
              <span className="font-bold text-gold-300 font-mono">{activeDraw?.combinations_covered || 0} / 10,000 Numbers</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Pending Exposure Pool (All Games):</span>
              <span className="font-bold text-amber-300 font-mono">Ks {(stats?.active_bets_pool || 0).toLocaleString()}</span>
            </div>
          </div>

          {onNavigate && (
            <button
              onClick={() => onNavigate('4d-game')}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gold-500/20 hover:bg-gold-500/30 border border-gold-500/40 text-gold-300 text-xs font-bold transition-all cursor-pointer"
            >
              <span>Monitor Live 4D Stakes & Quota</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Card 2: Last Settled Draw Official Results Spotlight */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-navy-900 via-navy-900 to-navy-950 border border-gold-500/30 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Last Settled 4D Result</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-gold-300 border border-gold-500/30">
              SETTLED
            </span>
          </div>

          <div>
            <div className="text-3xl font-black text-white font-serif mb-1 tracking-wider">
              {lastDraw?.draw_number ? `#${lastDraw.draw_number}` : '-'}
            </div>
            <div className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gold-400" />
              <span>Draw Date: {lastDraw?.draw_date || '-'} (Official Results)</span>
            </div>
          </div>

          {/* 3 Winning Numbers Spotlight */}
          <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-navy-800">
            <div className="bg-navy-950 p-2.5 rounded-xl border border-gold-500/40">
              <span className="text-[10px] text-slate-400 block font-sans">1st Prize</span>
              <span className="text-gold-300 text-lg font-black font-mono tracking-widest">{lastDraw?.first_prize || '-'}</span>
            </div>
            <div className="bg-navy-950 p-2.5 rounded-xl border border-slate-700">
              <span className="text-[10px] text-slate-400 block font-sans">2nd Prize</span>
              <span className="text-slate-200 text-lg font-black font-mono tracking-widest">{lastDraw?.second_prize || '-'}</span>
            </div>
            <div className="bg-navy-950 p-2.5 rounded-xl border border-amber-800/60">
              <span className="text-[10px] text-slate-400 block font-sans">3rd Prize</span>
              <span className="text-amber-400 text-lg font-black font-mono tracking-widest">{lastDraw?.third_prize || '-'}</span>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs pt-1 font-mono">
            <span className="text-slate-400">Payout Disbursed:</span>
            <span className="font-bold text-rose-400">Ks {(lastDraw?.total_payout || 0).toLocaleString()}</span>
          </div>

          {onNavigate && (
            <button
              onClick={() => onNavigate('4d-past-games')}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-navy-800 hover:bg-navy-750 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
            >
              <span>View Past Results & Winners Heatmap</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 5. Two Live Feeds: Real-time Bet Slips Stream & Real-time Ledger Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feed 1: Latest Placed Bet Slips (4D/2D/3D) */}
        <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-serif">
                  Live Player Bets Feed
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                  {recentBets.length} Recent
                </span>
              </div>

              {onNavigate && (
                <button
                  onClick={() => onNavigate('4d-bet-history')}
                  className="text-xs text-gold-400 hover:text-gold-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>All 4D Slips</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {loading && recentBets.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin text-gold-400 mx-auto mb-2" />
                Loading live bets...
              </div>
            ) : recentBets.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-navy-800 rounded-xl text-slate-400 text-xs">
                No bets recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-navy-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-gold-500/20">
                    <tr>
                      <th className="py-2 px-2.5">Slip Code</th>
                      <th className="py-2 px-2.5">Player</th>
                      <th className="py-2 px-2.5 text-right">Stake</th>
                      <th className="py-2 px-2.5 text-right">Status</th>
                      <th className="py-2 px-2.5 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-800 text-slate-300 font-mono text-[11px]">
                    {recentBets.slice(0, 7).map((slip) => (
                      <tr key={slip.id} className="hover:bg-navy-800/40 transition-colors">
                        <td className="py-2 px-2.5 text-gold-300 font-bold">
                          <span className={`inline-block mr-1.5 px-1.5 py-0.5 rounded text-[9px] font-black border ${gameBadgeClass(slip.game_type || '4D')}`}>
                            {slip.game_type || '4D'}
                          </span>
                          {slip.slip_code}
                        </td>
                        <td className="py-2 px-2.5 font-sans text-white">{slip.user_phone}</td>
                        <td className="py-2 px-2.5 text-right text-emerald-400 font-bold">
                          Ks {(slip.total_stake || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-2.5 text-right">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            slip.status === 'WON'
                              ? 'bg-amber-500/20 text-gold-300 border border-gold-500/40'
                              : slip.status === 'LOST'
                              ? 'bg-slate-800 text-slate-400'
                              : slip.status === 'CANCELLED' || slip.status === 'VOID'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}>
                            {slip.status}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-right text-slate-400 text-[10px] font-sans">
                          {slip.created_at}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Feed 2: Live Financial Ledger Stream */}
        <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gold-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-serif">
                  Live Financial Ledger Stream
                </h3>
                <span className="bg-gold-500/20 text-gold-300 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                  {recentTransactions.length} Recent
                </span>
              </div>

              {onNavigate && (
                <button
                  onClick={() => onNavigate('reports-financial')}
                  className="text-xs text-gold-400 hover:text-gold-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Full Ledger</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {loading && recentTransactions.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin text-gold-400 mx-auto mb-2" />
                Loading ledger stream...
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-navy-800 rounded-xl text-slate-400 text-xs">
                No ledger transactions logged yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-navy-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-gold-500/20">
                    <tr>
                      <th className="py-2 px-2.5">Type</th>
                      <th className="py-2 px-2.5">Description</th>
                      <th className="py-2 px-2.5 text-right">Amount</th>
                      <th className="py-2 px-2.5 text-right">Ref / Bal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-800 text-slate-300 font-mono text-[11px]">
                    {recentTransactions.slice(0, 7).map((tx) => {
                      const amt = Number(tx.amount || 0);
                      const isPositive = amt >= 0;
                      return (
                        <tr key={tx.id} className="hover:bg-navy-800/40 transition-colors">
                          <td className="py-2 px-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ledgerBadgeClass(tx.entry_type)}`}>
                              {tx.entry_type}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 font-sans text-slate-200 truncate max-w-[160px]" title={tx.description || ''}>
                            {tx.description || '-'}
                          </td>
                          <td className={`py-2 px-2.5 text-right font-bold ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {isPositive ? '+' : '-'}Ks {Math.abs(amt).toLocaleString()}
                          </td>
                          <td className="py-2 px-2.5 text-right text-gold-400 font-bold">
                            Ks {(tx.running_balance || 0).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
