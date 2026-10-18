import React, { useState, useEffect } from 'react';
import { 
  LineChart, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Archive, 
  AlertTriangle, 
  Check, 
  X, 
  RefreshCw,
  Clock,
  Layers,
  Database,
  Gift,
  Users
} from 'lucide-react';
import { apiClient } from '../api/client';

export default function AdminLedger() {
  const [overview, setOverview] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [flaggedTxs, setFlaggedTxs] = useState([]);
  const [weeklyBonuses, setWeeklyBonuses] = useState([]);
  const [archiveStats, setArchiveStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bonusStatus, setBonusStatus] = useState(null);
  const [archivingStatus, setArchivingStatus] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [ov, entries, flagged, bonuses, stats] = await Promise.all([
        apiClient.getFinancialOverview(),
        apiClient.getLedgerEntries(),
        apiClient.getFlaggedTransactions(),
        apiClient.getWeeklyBonuses(),
        apiClient.getArchiveStats()
      ]);
      setOverview(ov);
      setLedgerEntries(entries);
      setFlaggedTxs(flagged);
      setWeeklyBonuses(bonuses);
      setArchiveStats(stats);
    } catch (err) {
      console.error('Failed to load admin ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveTx = async (txId, action) => {
    try {
      setActionLoading(txId);
      await apiClient.resolveTransaction(txId, action, `Admin manual action: ${action}`);
      await loadAllData();
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTriggerWeeklyBonus = async () => {
    try {
      setBonusStatus('Executing Tuesday 11:00 AM Weekly Bonus Settlement...');
      const res = await apiClient.triggerWeeklyBonus();
      setBonusStatus(`Completed: ${res.message || `Distributed ${res.total_bonus_distributed?.toLocaleString() || 0} MMK across ${res.qualified_players_count || 0} players.`}`);
      await loadAllData();
    } catch (err) {
      setBonusStatus(`Error: ${err.message}`);
    }
  };

  const handleTriggerArchiving = async () => {
    try {
      setArchivingStatus('Archiving old records (>90 days)...');
      const res = await apiClient.triggerArchiving(90);
      setArchivingStatus(`Archive Completed: ${res.archived_bets_count} bets and ${res.archived_transactions_count} transactions archived.`);
      await loadAllData();
    } catch (err) {
      setArchivingStatus(`Archiving failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Top Header */}
      <div className="glass-panel-gold rounded-2xl p-6 border border-gold-600/50 shadow-gold">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center space-x-2">
              <LineChart className="w-6 h-6 text-gold-400" />
              <span className="gold-gradient-text">Financial Ledger & Agent Commission Dashboard</span>
            </h2>
            <p className="text-xs text-gold-400/90 mt-1">
              Admin control center: 30% Agent Commission tracking, 10% Weekly Bonus settlement, and real-time cashflow audits
            </p>
          </div>
          <button
            onClick={loadAllData}
            className="flex items-center space-x-1.5 px-4 py-2 bg-dark-card hover:bg-gold-950 border border-gold-700 rounded-xl text-xs font-bold text-gold-300 transition-colors shadow-gold-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Ledger</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (Royal Gold) */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Total Bet Volume */}
          <div className="glass-panel-gold rounded-2xl p-4 border border-gold-800/60 shadow-gold-sm">
            <span className="text-[11px] font-bold text-gold-400 uppercase">Total Bet Volume</span>
            <p className="text-xl font-mono font-black text-white mt-1.5">
              {overview.total_bets_all_time.toLocaleString()} <span className="text-xs text-gray-400 font-normal">MMK</span>
            </p>
            <p className="text-[10px] text-gold-400/80 mt-1">Gross Player Wagers</p>
          </div>

          {/* Total Payouts */}
          <div className="glass-panel-gold rounded-2xl p-4 border border-red-800/60 shadow-gold-sm">
            <span className="text-[11px] font-bold text-red-400 uppercase">Total Prize Payouts</span>
            <p className="text-xl font-mono font-black text-red-300 mt-1.5">
              {overview.total_payouts_all_time.toLocaleString()} <span className="text-xs text-gray-400 font-normal">MMK</span>
            </p>
            <p className="text-[10px] text-red-400 mt-1">Winnings Credited</p>
          </div>

          {/* 30% Agent Commission */}
          <div className="glass-panel-gold rounded-2xl p-4 border border-gold-500/80 shadow-gold-sm">
            <span className="text-[11px] font-bold text-gold-300 uppercase">30% Agent Commission</span>
            <p className="text-xl font-mono font-black text-gold-200 mt-1.5">
              {overview.total_commissions_all_time.toLocaleString()} <span className="text-xs text-gray-400 font-normal">MMK</span>
            </p>
            <p className="text-[10px] text-gold-400 mt-1">Agent Cashback Paid</p>
          </div>

          {/* 10% Weekly Bonuses */}
          <div className="glass-panel-gold rounded-2xl p-4 border border-gold-600/60 shadow-gold-sm">
            <span className="text-[11px] font-bold text-gold-400 uppercase">10% Weekly Bonuses</span>
            <p className="text-xl font-mono font-black text-gold-300 mt-1.5">
              {overview.total_bonuses_all_time.toLocaleString()} <span className="text-xs text-gray-400 font-normal">MMK</span>
            </p>
            <p className="text-[10px] text-gold-400/80 mt-1">Player Bonuses Paid</p>
          </div>

          {/* Net Profit / Loss */}
          <div className="glass-panel-gold rounded-2xl p-4 border border-gold-500/70 bg-gradient-to-br from-gold-950/40 to-dark-card shadow-gold">
            <span className="text-[11px] font-bold text-gold-300 uppercase">Net Profit / Loss</span>
            <p className={`text-xl font-mono font-black mt-1.5 ${overview.total_net_profit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {overview.total_net_profit.toLocaleString()} <span className="text-xs font-normal">MMK</span>
            </p>
            <p className="text-[10px] text-gold-400 mt-1">After Payouts, Comm & Bonus</p>
          </div>

        </div>
      )}

      {/* 10% Weekly Bonus Management Panel */}
      <div className="glass-panel-gold rounded-2xl p-6 border border-gold-600/60 shadow-gold-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gold-900/50">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Gift className="w-5 h-5 text-gold-400" />
              <span className="gold-gradient-text">Active Player 10% Weekly Bonus Engine (Every Tuesday 11:00 AM MMT)</span>
            </h3>
            <p className="text-xs text-gold-400/80 mt-1">
              Awards 10% cashback bonus to regular players who wagered $\ge$ 10,000 MMK on at least one draw day (Wed, Sat, Sun) in the calendar week
            </p>
          </div>

          <button
            onClick={handleTriggerWeeklyBonus}
            className="flex items-center space-x-2 px-4 py-2 gold-gradient-btn text-dark-bg font-extrabold text-xs rounded-xl shadow-gold transition-all"
          >
            <Gift className="w-4 h-4 text-dark-bg" />
            <span>Trigger Tuesday 11:00 AM Batch Now</span>
          </button>
        </div>

        {bonusStatus && (
          <div className="mt-3 p-3 rounded-xl bg-gold-950/70 border border-gold-700 text-gold-200 text-xs font-mono">
            {bonusStatus}
          </div>
        )}

        {/* Weekly Bonuses Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gold-900/60 text-gold-400 font-semibold uppercase">
                <th className="pb-2">Player</th>
                <th className="pb-2">Phone</th>
                <th className="pb-2">Week Span</th>
                <th className="pb-2 text-right">Qualifying Bets</th>
                <th className="pb-2 text-center">Active Draw Days</th>
                <th className="pb-2 text-right">10% Bonus Paid</th>
                <th className="pb-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {weeklyBonuses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-gray-500">
                    No weekly bonus distribution records yet.
                  </td>
                </tr>
              ) : (
                weeklyBonuses.map((b) => (
                  <tr key={b.id} className="hover:bg-dark-card/50">
                    <td className="py-2.5 font-bold text-white">{b.player_name}</td>
                    <td className="py-2.5 font-mono text-gray-300">{b.player_phone}</td>
                    <td className="py-2.5 text-gray-400 font-mono text-[11px]">{b.week_span}</td>
                    <td className="py-2.5 text-right font-mono text-white">{b.qualifying_bets?.toLocaleString()} MMK</td>
                    <td className="py-2.5 text-center font-bold text-gold-300">{b.qualifying_days} Days</td>
                    <td className="py-2.5 text-right font-mono font-bold text-green-400">+{b.bonus_amount?.toLocaleString()} MMK</td>
                    <td className="py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-950 text-green-300 border border-green-800">
                        CREDITED
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Flagged / Expired Transactions for Manual Review */}
      <div className="glass-panel-gold rounded-2xl p-6 border border-amber-600/50 shadow-gold-sm">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-gold-900/50">
          <h3 className="text-base font-bold text-amber-300 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span>Transactions Flagged for Review (Overdue / Receiver Mismatch)</span>
          </h3>
          <span className="text-xs bg-amber-950 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-700 font-bold">
            {flaggedTxs.length} Pending
          </span>
        </div>

        {flaggedTxs.length === 0 ? (
          <p className="text-xs text-gray-500 py-3 text-center">
            No transactions currently pending review. All recent transactions were auto-verified.
          </p>
        ) : (
          <div className="space-y-3">
            {flaggedTxs.map((tx) => (
              <div
                key={tx.id}
                className="p-4 rounded-xl bg-dark-card border border-dark-border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-black text-sm text-white">{tx.transaction_id}</span>
                    <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-700">
                      {tx.gateway} • {tx.status}
                    </span>
                  </div>
                  <p className="text-gray-400 mt-1">
                    Amount: <strong className="text-white font-mono">{tx.amount.toLocaleString()} MMK</strong> | Receiver: <strong className="text-white font-mono">{tx.receiver_id}</strong>
                  </p>
                  <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                    {tx.verification_notes}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    disabled={actionLoading === tx.id}
                    onClick={() => handleResolveTx(tx.id, 'approve')}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                  <button
                    disabled={actionLoading === tx.id}
                    onClick={() => handleResolveTx(tx.id, 'reject')}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Automated Data Archiving Panel */}
      <div className="glass-panel-gold rounded-2xl p-6 border border-gold-700/60 shadow-gold-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gold-900/50">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Archive className="w-5 h-5 text-gold-400" />
              <span className="gold-gradient-text">Automated 3-Month Data Archiving & Retention Engine</span>
            </h3>
            <p className="text-xs text-gold-400/80 mt-1">
              Keeps database lightweight by moving bets and transaction logs older than 90 days into cold storage
            </p>
          </div>

          <button
            onClick={handleTriggerArchiving}
            className="flex items-center space-x-2 px-4 py-2 gold-gradient-btn text-dark-bg font-extrabold text-xs rounded-xl shadow-gold transition-all"
          >
            <Database className="w-4 h-4 text-dark-bg" />
            <span>Run Archiving Job Now</span>
          </button>
        </div>

        {archivingStatus && (
          <div className="mt-3 p-3 rounded-xl bg-gold-950/70 border border-gold-700 text-gold-200 text-xs font-mono">
            {archivingStatus}
          </div>
        )}

        {archiveStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
            <div className="p-3 rounded-xl bg-dark-card border border-dark-border text-center">
              <p className="text-gray-400">Active Bets</p>
              <p className="text-lg font-mono font-bold text-white mt-1">{archiveStats.active_bets_count}</p>
            </div>
            <div className="p-3 rounded-xl bg-dark-card border border-dark-border text-center">
              <p className="text-gray-400">Archived Bets</p>
              <p className="text-lg font-mono font-bold text-gold-400 mt-1">{archiveStats.archived_bets_count}</p>
            </div>
            <div className="p-3 rounded-xl bg-dark-card border border-dark-border text-center">
              <p className="text-gray-400">Active Transactions</p>
              <p className="text-lg font-mono font-bold text-white mt-1">{archiveStats.active_transactions_count}</p>
            </div>
            <div className="p-3 rounded-xl bg-dark-card border border-dark-border text-center">
              <p className="text-gray-400">Archived Transactions</p>
              <p className="text-lg font-mono font-bold text-gold-400 mt-1">{archiveStats.archived_transactions_count}</p>
            </div>
          </div>
        )}
      </div>

      {/* Financial Ledger Log Table */}
      <div className="glass-panel-gold rounded-2xl p-6 border border-gold-800/60 shadow-gold-sm">
        <h3 className="text-base font-bold text-white mb-4 gold-gradient-text">Financial Ledger Audit Trail</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gold-900/60 text-gold-400 font-semibold uppercase tracking-wider">
                <th className="pb-3">Type</th>
                <th className="pb-3">Reference</th>
                <th className="pb-3">Description</th>
                <th className="pb-3 text-right">Amount (MMK)</th>
                <th className="pb-3 text-right">Running Balance</th>
                <th className="pb-3 text-right">Timestamp (MMT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {ledgerEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-dark-card/50 transition-colors">
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                      entry.entry_type === 'DEPOSIT'
                        ? 'bg-green-950 text-green-300 border border-green-800'
                        : entry.entry_type === 'PAYOUT_EXPENSE'
                        ? 'bg-red-950 text-red-300 border border-red-800'
                        : entry.entry_type === 'AGENT_COMMISSION'
                        ? 'bg-gold-950 text-gold-300 border border-gold-600'
                        : entry.entry_type === 'WEEKLY_BONUS'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-dark-card text-gray-300 border border-dark-border'
                    }`}>
                      {entry.entry_type}
                    </span>
                  </td>
                  <td className="py-3 font-mono text-gray-300">{entry.reference_id || '-'}</td>
                  <td className="py-3 text-gray-200">{entry.description}</td>
                  <td className={`py-3 text-right font-mono font-bold ${
                    entry.amount > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {entry.amount > 0 ? `+${entry.amount.toLocaleString()}` : entry.amount.toLocaleString()}
                  </td>
                  <td className="py-3 text-right font-mono text-gray-300">
                    {entry.running_balance.toLocaleString()}
                  </td>
                  <td className="py-3 text-right font-mono text-gray-400">
                    {new Date(entry.logged_at_mmt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
