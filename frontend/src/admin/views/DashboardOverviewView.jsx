import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Trophy, 
  Coins, 
  Wallet, 
  Award, 
  RefreshCw, 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  FileSpreadsheet, 
  ArrowRight,
  ShieldCheck,
  ExternalLink,
  Dices,
  Users,
  UserCheck,
  Receipt,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '../../api/client';

export default function DashboardOverviewView({ onNotify, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [balanceData, setBalanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    loadDashboardData();
    // Auto-refresh every 12 seconds for real-time live pulse
    const timer = setInterval(() => {
      loadDashboardData(false);
    }, 12000);
    return () => clearInterval(timer);
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

  const companyBalance = balanceData?.company_balance ?? 0;
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

  return (
    <div className="space-y-6">
      {/* View Header with Live Pulse and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 font-serif">
              <span className="text-gold-400">✨</span>
              <span className="bg-gradient-to-r from-gold-200 via-gold-400 to-amber-500 bg-clip-text text-transparent">
                Financial Ledger & Revenue Overview
              </span>
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time business intelligence, daily turnover, 30% agent commissions, and reconciled company balance.
            {lastUpdated && <span className="ml-2 text-slate-500 font-mono">Last synced: {lastUpdated}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadDashboardData(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy-900 border border-gold-500/30 hover:border-gold-400 text-gold-300 text-xs font-bold transition-all cursor-pointer shadow-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-gold-400' : ''}`} />
            <span>Refresh Overview</span>
          </button>

          <a
            href="/"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black transition-all shadow-md cursor-pointer"
            title="Go to 4D Betting Page"
          >
            <Dices className="w-3.5 h-3.5" />
            <span>4D ထီထိုးစာမျက်နှာ</span>
          </a>
        </div>
      </div>

      {/* 4 Golden Financial KPI Overview Cards (100% Real Database Grounded) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Gross Sales / Total Bets */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-navy-900 via-navy-900 to-navy-950 border border-gold-500/30 shadow-xl relative overflow-hidden group hover:border-gold-400/60 transition-all">
          <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400">
            <Coins className="w-5 h-5" />
          </div>
          <p className="text-[11px] uppercase font-bold tracking-wider text-slate-400">Total Bets (Gross Volume)</p>
          <h3 className="text-2xl font-black text-white font-mono mt-1.5">
            Ks {totalBets.toLocaleString()}
          </h3>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-navy-800">
            <span className="flex items-center text-emerald-400 font-semibold gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              {(stats?.total_bets_count || 0).toLocaleString()} Slips Placed
            </span>
            <span className="text-slate-500 font-mono">
              Today: Ks {(stats?.today_bets || 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Card 2: Total Winning Payouts */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-navy-900 via-navy-900 to-navy-950 border border-rose-500/30 shadow-xl relative overflow-hidden group hover:border-rose-400/60 transition-all">
          <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <Trophy className="w-5 h-5" />
          </div>
          <p className="text-[11px] uppercase font-bold tracking-wider text-slate-400">Total Winning Payouts</p>
          <h3 className="text-2xl font-black text-rose-400 font-mono mt-1.5">
            Ks {totalPayouts.toLocaleString()}
          </h3>
          <div className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-navy-800 font-mono flex items-center justify-between">
            <span className="truncate">Last Draw: Ks {(lastDraw?.total_payout || 0).toLocaleString()}</span>
            <span className="text-slate-500 text-[10px]">100% Settled</span>
          </div>
        </div>

        {/* Card 3: 30% Master Agent Commission */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-navy-900 via-navy-900 to-navy-950 border border-gold-500/40 shadow-xl relative overflow-hidden group hover:border-gold-400 transition-all gold-border-glow">
          <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-gold-500/15 border border-gold-500/30 flex items-center justify-center text-gold-400">
            <span className="text-base">🦚</span>
          </div>
          <p className="text-[11px] uppercase font-bold tracking-wider text-gold-300">30% Agent Commission</p>
          <h3 className="text-2xl font-black text-gold-400 font-mono mt-1.5">
            Ks {totalCommissions.toLocaleString()}
          </h3>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-navy-800">
            <span className="text-gold-300 font-medium truncate">
              {masterAgent?.name ? `${masterAgent.name}` : 'Daw Hla Hla'}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-gold-500/20 text-gold-300 font-mono text-[10px] font-bold">
              Pending: Ks {pendingCommissions.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Card 4: Net Company Profit */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-navy-900 via-navy-900 to-navy-950 border border-emerald-500/30 shadow-xl relative overflow-hidden group hover:border-emerald-400/60 transition-all">
          <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Wallet className="w-5 h-5" />
          </div>
          <p className="text-[11px] uppercase font-bold tracking-wider text-slate-400">Net Profit / Loss</p>
          <h3 className={`text-2xl font-black font-mono mt-1.5 ${totalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            Ks {totalNetProfit.toLocaleString()}
          </h3>
          <div className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-navy-800 flex items-center justify-between">
            <span className="truncate">Turnover - (Payout + Exp)</span>
            <span className={`font-bold font-mono ${(stats?.today_net_profit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              Today: Ks {(stats?.today_net_profit || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Operational Pulse Bar (Real-time Platform Activity) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
          onClick={() => onNavigate && onNavigate('withdraw')}
          className="bg-navy-900/90 border border-gold-500/20 hover:border-gold-400/50 p-3.5 rounded-xl transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Withdraw Review</span>
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className={`text-lg font-black font-mono mt-1 ${(stats?.pending_withdrawals_count || 0) > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-300'}`}>
            {(stats?.pending_withdrawals_count || 0)} Pending
          </div>
          <span className="text-[10px] text-slate-400">Total: Ks {(stats?.total_withdrawals_all_time || 0).toLocaleString()}</span>
        </div>

        <div 
          onClick={() => onNavigate && onNavigate('top-up')}
          className="bg-navy-900/90 border border-gold-500/20 hover:border-gold-400/50 p-3.5 rounded-xl transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Deposit Review</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className={`text-lg font-black font-mono mt-1 ${(stats?.pending_deposits_count || 0) > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-300'}`}>
            {(stats?.pending_deposits_count || 0)} Pending
          </div>
          <span className="text-[10px] text-slate-400">Total: Ks {(stats?.total_deposits_all_time || 0).toLocaleString()}</span>
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
          <span className="text-[10px] text-slate-400">Platform Player Vault</span>
        </div>
      </div>

      {/* Reconciled Company Monthly Balance Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-navy-900 via-navy-900 to-navy-950 border border-gold-500/40 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 gold-border-glow">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-gold-500/20 text-gold-300 text-[11px] font-bold border border-gold-500/30">
              Salone4D Reconciled Vault
            </span>
            <span className="text-xs text-slate-400">October 2026 Audit</span>
          </div>
          <div className="text-sm font-semibold text-slate-300">Company Monthly Reserve Balance</div>
          <div className="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight flex items-baseline gap-2">
            <span className="text-gold-400">Ks</span>
            <span>{companyBalance.toLocaleString()}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-navy-950/80 px-4 py-2.5 rounded-xl border border-gold-500/15">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Active Draw Pool</span>
            <span className="text-sm font-bold text-white font-mono">
              Ks {(activeDraw?.total_staked || stats?.active_bets_pool || 0).toLocaleString()}
            </span>
          </div>
          <div className="bg-navy-950/80 px-4 py-2.5 rounded-xl border border-gold-500/15">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Today's Net Profit</span>
            <span className={`text-sm font-bold font-mono ${(stats?.today_net_profit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              Ks {(stats?.today_net_profit || 0).toLocaleString()}
            </span>
          </div>
          <div className="bg-navy-950/80 px-4 py-2.5 rounded-xl border border-gold-500/15 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Weekly Bonuses Distributed</span>
            <span className="text-sm font-bold text-purple-400 font-mono">
              Ks {(stats?.total_bonuses_all_time || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Middle Grid: Active Open Draw Spotlight + Last Draw Results Spotlight */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Current Active Open Draw */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-navy-900 via-navy-900 to-navy-950 border border-gold-500/30 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Open Game (Live & Closed)</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{activeDraw?.status || 'OPEN'}</span>
            </span>
          </div>

          <div>
            <div className="text-3xl font-black text-white font-serif mb-1 tracking-wider">
              #{activeDraw?.draw_number || '5550'}
            </div>
            <div className="text-xs text-gold-400 font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Draw Date: {activeDraw?.draw_date || '2026-10-18'} (Singapore 4D)</span>
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
              <span className="text-slate-400">Cut-off Time:</span>
              <span className="font-bold text-rose-400 font-mono">04:30 PM MMT (Strict)</span>
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
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Last Draw Official Results</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-gold-300 border border-gold-500/30">
              SETTLED
            </span>
          </div>

          <div>
            <div className="text-3xl font-black text-white font-serif mb-1 tracking-wider">
              #{lastDraw?.draw_number || '5549'}
            </div>
            <div className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gold-400" />
              <span>Draw Date: {lastDraw?.draw_date || '2026-10-17'} (Official Results)</span>
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
              <span>View Past Games & Winners Heatmap</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Fast Operational Jump Hub */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => onNavigate && onNavigate('reports-financial')}
          className="p-4 rounded-2xl bg-navy-900/90 border border-gold-500/20 hover:border-gold-400/50 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-8 h-8 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400 mb-2.5 group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white group-hover:text-gold-300 transition-colors">
              Daily Financial Statement
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Daily 4D stakes, top-ups, withdrawals, payouts, and net profit.
            </p>
          </div>
          <span className="text-[11px] text-gold-400 font-semibold flex items-center gap-1 mt-3">
            Open Statement <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>

        <div 
          onClick={() => onNavigate && onNavigate('agent-commissions')}
          className="p-4 rounded-2xl bg-navy-900/90 border border-gold-500/20 hover:border-gold-400/50 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-2.5 group-hover:scale-105 transition-transform">
              <span className="text-sm">🦚</span>
            </div>
            <h4 className="text-xs font-bold text-white group-hover:text-gold-300 transition-colors">
              Agent 30% Commission
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Weekly commission ledger, credit limits, and settlement status.
            </p>
          </div>
          <span className="text-[11px] text-gold-400 font-semibold flex items-center gap-1 mt-3">
            View Commissions <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>

        <div 
          onClick={() => onNavigate && onNavigate('4d-bet-history')}
          className="p-4 rounded-2xl bg-navy-900/90 border border-gold-500/20 hover:border-gold-400/50 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-2.5 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white group-hover:text-gold-300 transition-colors">
              4D Bet Slips & Tickets
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Inspect all player betting slips, combinations, and bet types.
            </p>
          </div>
          <span className="text-[11px] text-blue-400 font-semibold flex items-center gap-1 mt-3">
            Browse All Tickets <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>

        <div 
          onClick={() => onNavigate && onNavigate('weekly-bonuses')}
          className="p-4 rounded-2xl bg-navy-900/90 border border-gold-500/20 hover:border-gold-400/50 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-2.5 group-hover:scale-105 transition-transform">
              <Award className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white group-hover:text-gold-300 transition-colors">
              10% Weekly Player Bonus
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Active player bonus qualifying preview and Monday distributions.
            </p>
          </div>
          <span className="text-[11px] text-purple-400 font-semibold flex items-center gap-1 mt-3">
            Bonus Manager <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>
      </div>

      {/* Two Live Feeds: Real-time Bet Slips Stream & Real-time Ledger Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feed 1: Latest Placed 4D Bet Slips */}
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
                  <span>All Slips</span>
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
                        <td className="py-2 px-2.5 text-gold-300 font-bold">{slip.slip_code}</td>
                        <td className="py-2 px-2.5 font-sans text-white">{slip.user_phone}</td>
                        <td className="py-2 px-2.5 text-right text-emerald-400 font-bold">
                          Ks {slip.total_stake.toLocaleString()}
                        </td>
                        <td className="py-2 px-2.5 text-right">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            slip.status === 'WON' 
                              ? 'bg-amber-500/20 text-gold-300 border border-gold-500/40' 
                              : slip.status === 'LOST' 
                              ? 'bg-slate-800 text-slate-400' 
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
                      <th className="py-2 px-2.5 text-right">Vault Bal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-800 text-slate-300 font-mono text-[11px]">
                    {recentTransactions.slice(0, 7).map((tx) => {
                      const isPositive = ['BET_STAKE', 'DEPOSIT', 'OTHER_IN'].includes(tx.entry_type);
                      return (
                        <tr key={tx.id} className="hover:bg-navy-800/40 transition-colors">
                          <td className="py-2 px-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              tx.entry_type === 'AGENT_COMMISSION'
                                ? 'bg-amber-500/20 text-gold-300 border border-gold-500/30'
                                : tx.entry_type === 'BET_STAKE'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : tx.entry_type === 'WEEKLY_BONUS'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : tx.entry_type === 'PRIZE_PAYOUT'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-navy-800 text-slate-300'
                            }`}>
                              {tx.entry_type}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 font-sans text-slate-200 truncate max-w-[150px]">
                            {tx.description || '-'}
                          </td>
                          <td className={`py-2 px-2.5 text-right font-bold ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {isPositive ? '+' : '-'}Ks {(Math.abs(tx.amount || 0)).toLocaleString()}
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
