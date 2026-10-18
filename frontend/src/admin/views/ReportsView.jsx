import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  FileSpreadsheet, 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  DollarSign, 
  Calendar, 
  RefreshCw,
  Award,
  Users,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  ShieldCheck,
  Sparkles,
  PieChart,
  Receipt,
  UserCheck
} from 'lucide-react';
import { apiClient } from '../../api/client';

export default function ReportsView({ onNotify }) {
  const [reportType, setReportType] = useState('financial'); // 'financial' | 'statements' | 'draws' | 'user-bet' | 'agents'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-31');
  const [searchUser, setSearchUser] = useState('');
  const [drawSortCol, setDrawSortCol] = useState('date');
  const [drawSortAsc, setDrawSortAsc] = useState(false);

  const sortedDrawResults = useMemo(() => {
    if (!data?.results || !Array.isArray(data.results)) return [];
    return [...data.results].sort((a, b) => {
      let cmp = 0;
      if (drawSortCol === 'date') {
        cmp = (a.date || '').localeCompare(b.date || '');
      } else if (drawSortCol === 'draw_no') {
        const noA = parseInt(String(a.draw_no).replace(/\D/g, '') || '0', 10);
        const noB = parseInt(String(b.draw_no).replace(/\D/g, '') || '0', 10);
        cmp = noA - noB;
      } else if (drawSortCol === 'profit') {
        cmp = (a.profit || 0) - (b.profit || 0);
      }
      return drawSortAsc ? cmp : -cmp;
    });
  }, [data?.results, drawSortCol, drawSortAsc]);

  const handleToggleDrawSort = (col) => {
    if (drawSortCol === col) {
      setDrawSortAsc(!drawSortAsc);
    } else {
      setDrawSortCol(col);
      setDrawSortAsc(col === 'date' ? false : true);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportType]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const params = { from_date: fromDate, to_date: toDate };
      if (searchUser.trim()) {
        params.username = searchUser.trim();
        params.search = searchUser.trim();
      }

      let res;
      if (reportType === 'financial') {
        res = await apiClient.getAdminFinancialReport(params);
        if (res && res.sub_total && res.sub_total.company_balance !== undefined) {
          window.dispatchEvent(new CustomEvent('companyBalanceUpdated', {
            detail: { company_balance: res.sub_total.company_balance }
          }));
        }
      } else if (reportType === 'statements') {
        res = await apiClient.getAdminStatements(params);
      } else if (reportType === 'draws') {
        res = await apiClient.getAdminDrawStatements(50);
      } else if (reportType === 'user-bet') {
        res = await apiClient.getAdminUserBetsReport(params);
      } else if (reportType === 'agents') {
        res = await apiClient.getAdminAgentsReport();
      }
      setData(res);
    } catch (err) {
      console.error('Error loading report:', err);
      if (onNotify) onNotify(err.message || 'Failed to load report data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = (e) => {
    e.preventDefault();
    loadReport();
  };

  return (
    <div className="space-y-6">
      {/* 5 Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-navy-900/90 border border-gold-500/20 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setReportType('financial')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              reportType === 'financial'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'bg-navy-800 text-slate-400 hover:text-white'
            }`}
          >
            📊 Daily Financial Statement
          </button>

          <button
            onClick={() => setReportType('statements')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              reportType === 'statements'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'bg-navy-800 text-slate-400 hover:text-white'
            }`}
          >
            💳 Cash In/Out Ledger
          </button>

          <button
            onClick={() => setReportType('draws')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              reportType === 'draws'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'bg-navy-800 text-slate-400 hover:text-white'
            }`}
          >
            🎯 Draw-by-Draw Performance
          </button>

          <button
            onClick={() => setReportType('user-bet')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              reportType === 'user-bet'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'bg-navy-800 text-slate-400 hover:text-white'
            }`}
          >
            🏆 Player Turnover Ranking
          </button>

          <button
            onClick={() => setReportType('agents')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              reportType === 'agents'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'bg-navy-800 text-slate-400 hover:text-white'
            }`}
          >
            🦚 Agent Turnover Summary
          </button>
        </div>

        {/* Date Range & Refresh Filter */}
        <form onSubmit={handleFilter} className="flex items-center gap-2">
          {(reportType === 'statements' || reportType === 'user-bet') && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Search phone or name..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="bg-navy-950 border border-gold-500/20 rounded-xl pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold-400 font-mono w-32 sm:w-44"
              />
            </div>
          )}

          {reportType !== 'agents' && reportType !== 'draws' && (
            <div className="flex items-center gap-1.5 bg-navy-950 border border-gold-500/20 rounded-xl px-2.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-gold-400" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none font-mono"
              />
              <span className="text-slate-500 text-xs">-</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none font-mono"
              />
            </div>
          )}

          <button
            type="submit"
            className="p-2 rounded-xl bg-navy-800 hover:bg-navy-700 text-gold-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh Report"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </form>
      </div>

      {/* VIEW 1: Daily Financial Report (100% LIVE & RECONCILED) */}
      {reportType === 'financial' && (
        <div className="space-y-4">
          {/* Company Monthly Reconciled Balance Banner */}
          <div className="bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 border border-gold-500/30 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl gold-border-glow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Coins className="w-6 h-6 text-gold-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-gold-400 uppercase tracking-widest font-serif">
                  Company Net Balance (Live)
                </p>
                <h2 className={`text-2xl sm:text-3xl font-black font-mono mt-0.5 ${(data?.sub_total?.company_balance || 0) >= 0 ? 'text-white' : 'text-rose-400'}`}>
                  {(data?.sub_total?.company_balance || 0) < 0 
                    ? `-Ks ${Math.abs(data?.sub_total?.company_balance || 0).toLocaleString()}` 
                    : `Ks ${(data?.sub_total?.company_balance || 0).toLocaleString()}`}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-6 text-right">
              <div>
                <span className="text-[11px] text-slate-400 block">Total 4D Turnover</span>
                <span className="text-sm font-black font-mono text-emerald-400">
                  +Ks {(data?.sub_total?.four_d_bet || 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Total Net Profit</span>
                <span className={`text-sm font-black font-mono ${data?.sub_total?.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  Ks {(data?.sub_total?.profit || 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">30% Agent Commission</span>
                <span className="text-sm font-black font-mono text-gold-400">
                  -Ks {Math.abs(data?.sub_total?.agent_commission || 0).toLocaleString()}
                </span>
              </div>
              <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                Live Reconciled
              </span>
            </div>
          </div>

          {/* 11-Column Live Daily Ledger Table (Sweep Bet / Sweep Payout Removed!) */}
          <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-navy-950/90 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-2.5">No</th>
                    <th className="py-2.5 px-2.5">Date</th>
                    <th className="py-2.5 px-2.5 text-right">4D Bet Stake</th>
                    <th className="py-2.5 px-2.5 text-right">Top Up</th>
                    <th className="py-2.5 px-2.5 text-right">Withdraw</th>
                    <th className="py-2.5 px-2.5 text-right">4D Payout</th>
                    <th className="py-2.5 px-2.5 text-right">30% Agent Comm</th>
                    <th className="py-2.5 px-2.5 text-right">Weekly Bonus</th>
                    <th className="py-2.5 px-2.5 text-right">Customer Bal</th>
                    <th className="py-2.5 px-2.5 text-right">Net Profit / Loss</th>
                    <th className="py-2.5 px-2.5 text-right">Company Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300 font-mono text-[11px]">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-500 font-sans">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gold-400 mb-2" />
                        Calculating live financial statement from database...
                      </td>
                    </tr>
                  ) : !data?.reports || data.reports.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-500 font-sans">
                        No financial records found in date range.
                      </td>
                    </tr>
                  ) : (
                    data.reports.map((r, i) => (
                      <tr key={r.report_date || i} className="hover:bg-navy-800/40 transition-colors">
                        <td className="py-2 px-2.5 text-slate-500 font-mono">{i + 1}</td>
                        <td className="py-2 px-2.5 font-sans font-semibold text-white">{r.report_date}</td>
                        <td className="py-2 px-2.5 text-right text-emerald-400 font-bold">
                          {r.four_d_bet > 0 ? (r.four_d_bet).toLocaleString() : '-'}
                        </td>
                        <td className="py-2 px-2.5 text-right text-blue-400 font-bold">
                          {r.top_up > 0 ? (r.top_up).toLocaleString() : '-'}
                        </td>
                        <td className="py-2 px-2.5 text-right text-rose-400">
                          {r.withdraw < 0 ? (r.withdraw).toLocaleString() : r.withdraw > 0 ? `-${(r.withdraw).toLocaleString()}` : '-'}
                        </td>
                        <td className="py-2 px-2.5 text-right text-rose-400">
                          {r.four_d_payout < 0 ? (r.four_d_payout).toLocaleString() : r.four_d_payout > 0 ? `-${(r.four_d_payout).toLocaleString()}` : '-'}
                        </td>
                        <td className="py-2 px-2.5 text-right text-gold-300">
                          {r.agent_commission < 0 ? (r.agent_commission).toLocaleString() : r.agent_commission > 0 ? `-${(r.agent_commission).toLocaleString()}` : '-'}
                        </td>
                        <td className="py-2 px-2.5 text-right text-purple-300">
                          {r.weekly_bonus < 0 ? (r.weekly_bonus).toLocaleString() : r.weekly_bonus > 0 ? `-${(r.weekly_bonus).toLocaleString()}` : '-'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-bold text-slate-300">
                          {(r.customer_balance || 0).toLocaleString()}
                        </td>
                        <td className={`py-2 px-2.5 text-right font-extrabold ${r.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {(r.profit || 0).toLocaleString()}
                        </td>
                        <td className={`py-2 px-2.5 text-right font-bold ${(r.company_balance || 0) >= 0 ? 'text-gold-400' : 'text-rose-400'}`}>
                          {(r.company_balance || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {data?.sub_total && (
                  <tfoot className="bg-navy-950 font-mono font-black text-[11px] text-white border-t-2 border-gold-500/40">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-2.5 uppercase font-sans font-bold text-gold-400">
                        Sub Total
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-emerald-400 font-bold">
                        {(data.sub_total.four_d_bet || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-blue-400 font-bold">
                        {(data.sub_total.top_up || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-rose-400">
                        {(data.sub_total.withdraw || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-rose-400">
                        {(data.sub_total.four_d_payout || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-gold-300 font-bold">
                        {(data.sub_total.agent_commission || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-purple-300 font-bold">
                        {(data.sub_total.weekly_bonus || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-slate-300">
                        {(data.sub_total.customer_balance || 0).toLocaleString()}
                      </td>
                      <td className={`py-2.5 px-2.5 text-right text-xs font-black ${data.sub_total.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(data.sub_total.profit || 0).toLocaleString()}
                      </td>
                      <td className={`py-2.5 px-2.5 text-right font-black text-xs ${(data.sub_total.company_balance || 0) >= 0 ? 'text-gold-400' : 'text-rose-400'}`}>
                        {(data.sub_total.company_balance || 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: Cash Statements (Live Financial Ledger Entries) */}
      {reportType === 'statements' && (
        <div className="space-y-4">
          <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-gold-500/20 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-serif">
                Cash Flow & Betting Audit Ledger ({data?.total || data?.results?.length || 0} entries)
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-navy-950/80 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20">
                  <tr>
                    <th className="py-3 px-4">No / ID</th>
                    <th className="py-3 px-4">Date & Time (MMT)</th>
                    <th className="py-3 px-4">User Phone</th>
                    <th className="py-3 px-4">Slip / Ref Code</th>
                    <th className="py-3 px-4">Entry Type</th>
                    <th className="py-3 px-4 text-right">Amount (MMK)</th>
                    <th className="py-3 px-4 text-right">Opening Bal</th>
                    <th className="py-3 px-4 text-right">Closing Bal</th>
                    <th className="py-3 px-4">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        Loading statement records...
                      </td>
                    </tr>
                  ) : !data?.results || data.results.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        No statement entries found.
                      </td>
                    </tr>
                  ) : (
                    data.results.map((st, idx) => (
                      <tr key={st.id || idx} className="hover:bg-navy-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-gold-400">#{st.id}</td>
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{st.date}</td>
                        <td className="py-3 px-4 font-semibold text-white font-mono">{st.username}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">{st.slip_id}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            st.type?.includes('Withdraw')
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : st.type?.includes('Deposit') || st.type?.includes('Top')
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {st.type}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-right font-mono font-bold ${st.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {st.amount < 0 ? `-Ks ${Math.abs(st.amount).toLocaleString()}` : `+Ks ${st.amount.toLocaleString()}`}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-400">
                          Ks {st.opening_balance?.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          Ks {st.closing_balance?.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] max-w-xs truncate">
                          {st.description}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: Draw-by-Draw Financial Statement (100% Live) */}
      {reportType === 'draws' && (
        <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-gold-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-gold-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-serif">
                Draw-by-Draw Financial Breakdown & Prize Audit
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {data?.total || data?.results?.length || 0} draws
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-navy-950/80 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20">
                <tr>
                  <th 
                    onClick={() => handleToggleDrawSort('date')}
                    className="py-3 px-4 cursor-pointer hover:text-gold-300 transition-colors select-none group"
                    title="Click to sort by Draw Date"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>Draw Date</span>
                      <span className="text-gold-400 font-mono text-xs">{drawSortCol === 'date' ? (drawSortAsc ? '▲' : '▼') : '↕'}</span>
                    </span>
                  </th>
                  <th 
                    onClick={() => handleToggleDrawSort('draw_no')}
                    className="py-3 px-4 cursor-pointer hover:text-gold-300 transition-colors select-none group"
                    title="Click to sort by Draw No"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>Draw No</span>
                      <span className="text-gold-400 font-mono text-xs">{drawSortCol === 'draw_no' ? (drawSortAsc ? '▲' : '▼') : '↕'}</span>
                    </span>
                  </th>
                  <th className="py-3 px-4 text-right">Total Bet Stake</th>
                  <th className="py-3 px-4 text-right">Winning Payouts</th>
                  <th 
                    onClick={() => handleToggleDrawSort('profit')}
                    className="py-3 px-4 text-right cursor-pointer hover:text-gold-300 transition-colors select-none group"
                    title="Click to sort by Net Profit"
                  >
                    <span className="flex items-center justify-end gap-1.5">
                      <span>Company Net Profit</span>
                      <span className="text-gold-400 font-mono text-xs">{drawSortCol === 'profit' ? (drawSortAsc ? '▲' : '▼') : '↕'}</span>
                    </span>
                  </th>
                  <th className="py-3 px-4 text-center">Tickets Count</th>
                  <th className="py-3 px-4 text-center">1st / 2nd / 3rd Prizes</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">
                      Loading draw statements...
                    </td>
                  </tr>
                ) : sortedDrawResults.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">
                      No lottery draws registered.
                    </td>
                  </tr>
                ) : (
                  sortedDrawResults.map((d, i) => (
                    <tr key={d.id || i} className="hover:bg-navy-800/40 transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-white">{d.date}</td>
                      <td className="py-3 px-4 font-mono font-bold text-gold-400">#{d.draw_no}</td>
                      <td className="py-3 px-4 text-right font-bold text-white">
                        Ks {(d.total_bet_amount || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-rose-400">
                        -Ks {(d.total_payout_amount || 0).toLocaleString()}
                      </td>
                      <td className={`py-3 px-4 text-right font-black ${d.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        Ks {(d.profit || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-300">
                        {d.tickets_count || 0}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-200">
                        <span className="text-gold-400">{d.first_prize || '-'}</span> / <span>{d.second_prize || '-'}</span> / <span>{d.third_prize || '-'}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          d.status === 'CLOSED'
                            ? 'bg-slate-700 text-slate-300'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {d.status || 'CLOSED'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 4: Player Turnover Ranking (100% Live) */}
      {reportType === 'user-bet' && (
        <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-gold-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gold-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-serif">
                Player Turnover Ranking (Live Order by Stake Volume)
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {data?.total || data?.results?.length || 0} players
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-navy-950/80 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20">
                <tr>
                  <th className="py-3 px-4">Rank / Player</th>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-4 text-center">Total Bets</th>
                  <th className="py-3 px-4 text-right">Total Staked (Turnover)</th>
                  <th className="py-3 px-4 text-right">Total Payout (Won)</th>
                  <th className="py-3 px-4 text-right">Net Profit from Player</th>
                  <th className="py-3 px-4 text-right">Wallet Balance</th>
                  <th className="py-3 px-4">Last Bet Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      Loading player turnover rankings...
                    </td>
                  </tr>
                ) : !data?.results || data.results.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No player betting records found.
                    </td>
                  </tr>
                ) : (
                  data.results.map((u, idx) => (
                    <tr key={u.id} className="hover:bg-navy-800/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full font-black flex items-center justify-center text-[10px] ${
                          idx === 0 ? 'bg-amber-400 text-slate-950 shadow-gold' :
                          idx === 1 ? 'bg-slate-300 text-slate-950' :
                          idx === 2 ? 'bg-amber-700 text-white' : 'bg-navy-950 text-slate-400 border border-slate-700'
                        }`}>
                          {idx + 1}
                        </span>
                        <span>{u.name}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-gold-300">{u.phone}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-white">
                        {u.total_bet_count} bets
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        Ks {u.fourd_total_bet?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-300">
                        Ks {u.fourd_payout_amount?.toLocaleString()}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-black ${u.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        Ks {u.net_profit?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        Ks {u.balance?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px] font-mono">
                        {u.last_betted_game_date}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 5: Agent Turnover Summary (100% Live) */}
      {reportType === 'agents' && (
        <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-gold-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-gold-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-serif">
                Agent Performance, Network Turnover & 30% Commission Summary
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {data?.total || data?.results?.length || 0} agents
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-navy-950/80 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20">
                <tr>
                  <th className="py-3 px-4">Rank / Code</th>
                  <th className="py-3 px-4">Agent Name</th>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-4 text-center">Downline Players</th>
                  <th className="py-3 px-4 text-right">Total Bet Turnover</th>
                  <th className="py-3 px-4 text-right">30% Pending Comm</th>
                  <th className="py-3 px-4 text-right">30% Settled Comm</th>
                  <th className="py-3 px-4 text-right">Credit Limit</th>
                  <th className="py-3 px-4 text-right">Used Debt</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      Loading agent turnover report...
                    </td>
                  </tr>
                ) : !data?.results || data.results.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      No agents registered in system.
                    </td>
                  </tr>
                ) : (
                  data.results.map((ag, idx) => (
                    <tr key={ag.id} className="hover:bg-navy-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-gold-300 font-mono font-bold text-xs border border-amber-500/30">
                          {ag.agent_code}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">{ag.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">{ag.phone}</td>
                      <td className="py-3 px-4 text-center font-bold text-purple-300 font-mono">
                        {ag.downline_players_count} ယောက်
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        Ks {ag.total_turnover?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gold-400">
                        +Ks {ag.pending_commission?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        Ks {ag.settled_commission?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-purple-300">
                        Ks {ag.credit_limit?.toLocaleString()}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold ${ag.used_credit > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        Ks {ag.used_credit?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {ag.is_betting_locked ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            Locked
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
