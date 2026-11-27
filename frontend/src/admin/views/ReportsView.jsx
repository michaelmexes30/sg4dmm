import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Coins, 
  Calendar, 
  RefreshCw,
  Award,
  Users,
  Search,
  UserCheck
} from 'lucide-react';
import { apiClient } from '../../api/client';

export default function ReportsView({ onNotify, gameFilter = 'ALL', initialTab = 'financial' }) {
  const [reportType, setReportType] = useState(initialTab); // 'financial' | 'statements' | 'draws' | 'user-bet' | 'agents'
  const [selectedGame, setSelectedGame] = useState(gameFilter || 'ALL'); // 'ALL' | '4D' | '2D' | '3D'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Dynamic Month Bounds helper (Defaults to Current Month, never hardcoded past months)
  const currentMonthBounds = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    return {
      from: `${year}-${month}-01`,
      to: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
      monthKey: `${year}-${month}`
    };
  }, []);

  const [fromDate, setFromDate] = useState(currentMonthBounds.from);
  const [toDate, setToDate] = useState(currentMonthBounds.to);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthBounds.monthKey);
  const [searchUser, setSearchUser] = useState('');
  const [drawSortCol, setDrawSortCol] = useState('date');
  const [drawSortAsc, setDrawSortAsc] = useState(false);

  // Generate 12 months for the month selector dropdown
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const monthKey = `${y}-${m}`;
      const monthName = d.toLocaleString('en-US', { month: 'short' });
      options.push({
        key: monthKey,
        label: i === 0 ? `${monthName} ${y} (Current)` : `${monthName} ${y}`
      });
    }
    return options;
  }, []);

  const handleMonthChange = (mKey) => {
    setSelectedMonth(mKey);
    if (mKey === 'custom') return;
    const [y, m] = mKey.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const newFrom = `${y}-${String(m).padStart(2, '0')}-01`;
    const newTo = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    setFromDate(newFrom);
    setToDate(newTo);
  };

  const handleCustomFromDate = (val) => {
    setFromDate(val);
    setSelectedMonth('custom');
  };

  const handleCustomToDate = (val) => {
    setToDate(val);
    setSelectedMonth('custom');
  };

  useEffect(() => {
    setReportType(initialTab);
    setSelectedGame(gameFilter || 'ALL');
  }, [initialTab, gameFilter]);

  const handleGameScopeChange = (nextGame) => {
    setSelectedGame(nextGame);
    if (nextGame !== 'ALL' && (reportType === 'statements' || reportType === 'agents')) {
      setReportType('financial');
    }
  };

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
  }, [reportType, selectedGame, fromDate, toDate]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const params = { from_date: fromDate, to_date: toDate, game_type: selectedGame };
      if (searchUser.trim()) {
        params.username = searchUser.trim();
        params.search = searchUser.trim();
      }

      let res;
      if (reportType === 'financial') {
        res = await apiClient.getAdminFinancialReport(params);
        if (
          selectedGame === 'ALL' &&
          selectedMonth === currentMonthBounds.monthKey &&
          res &&
          res.sub_total &&
          res.sub_total.company_balance !== undefined
        ) {
          window.dispatchEvent(new CustomEvent('companyBalanceUpdated', {
            detail: { company_balance: res.sub_total.company_balance }
          }));
        }
      } else if (reportType === 'statements') {
        res = await apiClient.getAdminStatements(params);
      } else if (reportType === 'draws') {
        res = await apiClient.getAdminDrawsPerformance({
          game_type: selectedGame,
          from_date: fromDate,
          to_date: toDate,
          limit: 100
        });
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

  const gameTitle = useMemo(() => {
    if (selectedGame === '4D') return '4D';
    if (selectedGame === '2D') return 'Thai 2D';
    if (selectedGame === '3D') return 'Thai 3D';
    return 'Total';
  }, [selectedGame]);

  return (
    <div className="space-y-6">
      {/* Sub-navigation Tabs & Game Scope Filter */}
      <div className="flex flex-col gap-3 bg-navy-900/90 border border-gold-500/20 p-4 rounded-2xl shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Game Scope Selector */}
          <div className="flex items-center gap-1.5 bg-navy-950 p-1 rounded-xl border border-gold-500/20">
            {[
              { id: 'ALL', label: 'All Games' },
              { id: '4D', label: '4D' },
              { id: '2D', label: 'Thai 2D' },
              { id: '3D', label: 'Thai 3D' }
            ].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => handleGameScopeChange(g.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedGame === g.id
                    ? 'bg-gold-500 text-navy-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setReportType('financial')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                reportType === 'financial'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'bg-navy-800 text-slate-400 hover:text-white'
              }`}
            >
              📊 {selectedGame === 'ALL' ? 'Daily Financial Statement' : `Daily ${gameTitle} Statement`}
            </button>

            {selectedGame === 'ALL' && (
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
            )}

            <button
              onClick={() => setReportType('draws')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                reportType === 'draws'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'bg-navy-800 text-slate-400 hover:text-white'
              }`}
            >
              🎯 {selectedGame === 'ALL' ? 'Draw-by-Draw Performance' : `${gameTitle} Draw Performance`}
            </button>

            <button
              onClick={() => setReportType('user-bet')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                reportType === 'user-bet'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'bg-navy-800 text-slate-400 hover:text-white'
              }`}
            >
              🏆 {selectedGame === 'ALL' ? 'Player Turnover Ranking' : `${gameTitle} Turnover Ranking`}
            </button>

            {selectedGame === 'ALL' && (
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
            )}
          </div>
        </div>

        {/* Date Range, Month Selector & Refresh Filter */}
        <form onSubmit={handleFilter} className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-navy-800/70">
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

          {reportType !== 'agents' && (
            <div className="flex items-center gap-2">
              {/* Month Selector Dropdown */}
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="bg-navy-950 border border-gold-500/20 rounded-xl px-2.5 py-1 text-xs text-amber-300 font-bold focus:outline-none cursor-pointer"
                title="Select Month"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.key} value={opt.key} className="bg-navy-900 text-white font-sans">
                    {opt.label}
                  </option>
                ))}
                <option value="custom" className="bg-navy-900 text-white font-sans">📅 Custom Range</option>
              </select>

              {/* Exact Date Range Inputs */}
              <div className="flex items-center gap-1.5 bg-navy-950 border border-gold-500/20 rounded-xl px-2.5 py-1">
                <Calendar className="w-3.5 h-3.5 text-gold-400" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => handleCustomFromDate(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none font-mono"
                  title="From Date"
                />
                <span className="text-slate-500 text-xs">-</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => handleCustomToDate(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none font-mono"
                  title="To Date"
                />
              </div>
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

      {/* VIEW 1: Daily Financial Report */}
      {reportType === 'financial' && (
        <div className="space-y-4">
          {/* Reconciled Balance Banner */}
          <div className="bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 border border-gold-500/30 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl gold-border-glow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Coins className="w-6 h-6 text-gold-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-gold-400 uppercase tracking-widest font-serif">
                  {selectedGame === 'ALL' ? 'Total Financial Ledger (Live Net Balance)' : `${gameTitle} Mini Ledger`}
                </p>
                <h2 className={`text-2xl sm:text-3xl font-black font-mono mt-0.5 ${(data?.sub_total?.company_balance || 0) >= 0 ? 'text-white' : 'text-rose-400'}`}>
                  {(data?.sub_total?.company_balance || 0) < 0 
                    ? `-Ks ${Math.abs(data?.sub_total?.company_balance || 0).toLocaleString()}` 
                    : `Ks ${(data?.sub_total?.company_balance || 0).toLocaleString()}`}
                </h2>
              </div>
            </div>

            {selectedGame === 'ALL' ? (
              <div className="flex items-center gap-6 text-right flex-wrap">
                <div>
                  <span className="text-[11px] text-slate-400 block">Total Turnover (4D/2D/3D)</span>
                  <span className="text-sm font-black font-mono text-emerald-400">
                    +Ks {(data?.sub_total?.four_d_bet || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Mini-Games Net P/L</span>
                  <span className={`text-sm font-black font-mono ${(data?.sub_total?.mini_game_net || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(data?.sub_total?.mini_game_net || 0) >= 0 ? '+' : ''}Ks {(data?.sub_total?.mini_game_net || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Total Net Profit</span>
                  <span className={`text-sm font-black font-mono ${(data?.sub_total?.profit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
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
            ) : (
              <div className="flex items-center gap-6 text-right">
                <div>
                  <span className="text-[11px] text-slate-400 block">Total {gameTitle} Turnover</span>
                  <span className="text-sm font-black font-mono text-emerald-400">
                    +Ks {(data?.sub_total?.four_d_bet || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Total {gameTitle} Payout</span>
                  <span className="text-sm font-black font-mono text-rose-400">
                    -Ks {Math.abs(data?.sub_total?.four_d_payout || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Net Profit</span>
                  <span className={`text-sm font-black font-mono ${(data?.sub_total?.profit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    Ks {(data?.sub_total?.profit || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Profit Margin</span>
                  <span className="text-sm font-black font-mono text-gold-400">
                    {data?.sub_total?.four_d_bet > 0 
                      ? `${Math.round(((data.sub_total.profit || 0) / data.sub_total.four_d_bet) * 1000) / 10}%` 
                      : '0%'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Table: Conditional rendering according to selectedGame */}
          <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              {selectedGame === 'ALL' && (
                /* 12-Column Total Ledger Table */
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-navy-950/90 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-2.5">No</th>
                      <th className="py-2.5 px-2.5">Date</th>
                      <th className="py-2.5 px-2.5 text-right">Total Bet Stake (4D/2D/3D)</th>
                      <th className="py-2.5 px-2.5 text-right">Total Payout (4D/2D/3D)</th>
                      <th className="py-2.5 px-2.5 text-right text-amber-300">Mini Net P/L</th>
                      <th className="py-2.5 px-2.5 text-right">Top Up</th>
                      <th className="py-2.5 px-2.5 text-right">Withdraw</th>
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
                        <td colSpan={12} className="py-12 text-center text-slate-500 font-sans">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gold-400 mb-2" />
                          Calculating live total financial statement from database...
                        </td>
                      </tr>
                    ) : !data?.reports || data.reports.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-12 text-center text-slate-500 font-sans">
                          No financial records found in date range.
                        </td>
                      </tr>
                    ) : (
                      data.reports.map((r, i) => (
                        <tr key={r.report_date || i} className="hover:bg-navy-800/40 transition-colors">
                          <td className="py-2 px-2.5 text-slate-500 font-mono">{i + 1}</td>
                          <td className="py-2 px-2.5 font-sans font-semibold text-white">{r.report_date}</td>
                          <td className="py-2 px-2.5 text-right text-emerald-400 font-bold">
                            {r.total_bet > 0 ? (r.total_bet).toLocaleString() : '-'}
                          </td>
                          <td className="py-2 px-2.5 text-right text-rose-400">
                            {r.total_payout < 0 ? (r.total_payout).toLocaleString() : r.total_payout > 0 ? `-${(r.total_payout).toLocaleString()}` : '-'}
                          </td>
                          <td className={`py-2 px-2.5 text-right font-extrabold ${(r.mini_game_net || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {r.mini_game_stake > 0 || r.mini_game_payout !== 0 ? (
                              <span>{(r.mini_game_net || 0) >= 0 ? '+' : ''}{(r.mini_game_net || 0).toLocaleString()}</span>
                            ) : '-'}
                          </td>
                          <td className="py-2 px-2.5 text-right text-blue-400 font-bold">
                            {r.top_up > 0 ? (r.top_up).toLocaleString() : '-'}
                          </td>
                          <td className="py-2 px-2.5 text-right text-rose-400">
                            {r.withdraw < 0 ? (r.withdraw).toLocaleString() : r.withdraw > 0 ? `-${(r.withdraw).toLocaleString()}` : '-'}
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
                          Total Summary
                        </td>
                        <td className="py-2.5 px-2.5 text-right text-emerald-400 font-bold">
                          {(data.sub_total.four_d_bet || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2.5 text-right text-rose-400">
                          {(data.sub_total.four_d_payout || 0).toLocaleString()}
                        </td>
                        <td className={`py-2.5 px-2.5 text-right font-black ${(data.sub_total.mini_game_net || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {(data.sub_total.mini_game_net || 0) >= 0 ? '+' : ''}{(data.sub_total.mini_game_net || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2.5 text-right text-blue-400 font-bold">
                          {(data.sub_total.top_up || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2.5 text-right text-rose-400">
                          {(data.sub_total.withdraw || 0).toLocaleString()}
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
              )}

              {gameFilter === '4D' && (
                /* 4D Dedicated Mini Ledger */
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-navy-950/90 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20 text-[11px]">
                    <tr>
                      <th className="py-3 px-4">No</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-right">4D Bet Stake</th>
                      <th className="py-3 px-4 text-right">4D Winning Payout</th>
                      <th className="py-3 px-4 text-right">Company Net Profit</th>
                      <th className="py-3 px-4 text-right">Margin %</th>
                      <th className="py-3 px-4 text-center">Tickets Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gold-400 mb-2" />
                          Calculating 4D daily statement...
                        </td>
                      </tr>
                    ) : !data?.reports || data.reports.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                          No 4D betting records found in date range.
                        </td>
                      </tr>
                    ) : (
                      data.reports.map((r, i) => (
                        <tr key={r.report_date || i} className="hover:bg-navy-800/40 transition-colors">
                          <td className="py-3 px-4 text-slate-500 font-mono">{i + 1}</td>
                          <td className="py-3 px-4 font-sans font-semibold text-white">{r.report_date}</td>
                          <td className="py-3 px-4 text-right text-emerald-400 font-bold">
                            Ks {(r.four_d_bet || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right text-rose-400">
                            -Ks {Math.abs(r.four_d_payout || 0).toLocaleString()}
                          </td>
                          <td className={`py-3 px-4 text-right font-black ${r.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            Ks {(r.profit || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-amber-300">
                            {r.margin_percent}%
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-300">
                            {r.tickets_count || 0}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {data?.sub_total && (
                    <tfoot className="bg-navy-950 font-mono font-black text-xs text-white border-t-2 border-gold-500/40">
                      <tr>
                        <td colSpan={2} className="py-3 px-4 uppercase font-sans font-bold text-gold-400">
                          Total Summary
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-400 font-bold">
                          Ks {(data.sub_total.four_d_bet || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-rose-400">
                          -Ks {Math.abs(data.sub_total.four_d_payout || 0).toLocaleString()}
                        </td>
                        <td className={`py-3 px-4 text-right font-black ${data.sub_total.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          Ks {(data.sub_total.profit || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-gold-400 font-bold">
                          {data.sub_total.four_d_bet > 0 
                            ? `${Math.round(((data.sub_total.profit || 0) / data.sub_total.four_d_bet) * 1000) / 10}%` 
                            : '0%'}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-300">
                          -
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}

              {gameFilter === '2D' && (
                /* Thai 2D Dedicated Mini Ledger (Morning, Evening, Total) */
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-navy-950/90 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20 text-[11px]">
                    <tr>
                      <th className="py-3 px-3">No</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3 text-right text-blue-300">Morning Stake (12:01 PM)</th>
                      <th className="py-3 px-3 text-right text-amber-300">Evening Stake (04:30 PM)</th>
                      <th className="py-3 px-3 text-right text-emerald-400">Total 2D Stake</th>
                      <th className="py-3 px-3 text-right text-rose-400">Total 2D Payout</th>
                      <th className="py-3 px-3 text-right">Company Net Profit</th>
                      <th className="py-3 px-3 text-right">Margin %</th>
                      <th className="py-3 px-3 text-center">Bets Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-500 font-sans">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gold-400 mb-2" />
                          Calculating Thai 2D daily statement...
                        </td>
                      </tr>
                    ) : !data?.reports || data.reports.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-500 font-sans">
                          No Thai 2D betting records found in date range.
                        </td>
                      </tr>
                    ) : (
                      data.reports.map((r, i) => (
                        <tr key={r.report_date || i} className="hover:bg-navy-800/40 transition-colors">
                          <td className="py-3 px-3 text-slate-500 font-mono">{i + 1}</td>
                          <td className="py-3 px-3 font-sans font-semibold text-white">{r.report_date}</td>
                          <td className="py-3 px-3 text-right text-blue-300 font-semibold">
                            {r.bet_2d_morning > 0 ? (r.bet_2d_morning).toLocaleString() : '-'}
                          </td>
                          <td className="py-3 px-3 text-right text-amber-300 font-semibold">
                            {r.bet_2d_evening > 0 ? (r.bet_2d_evening).toLocaleString() : '-'}
                          </td>
                          <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                            Ks {(r.total_bet || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right text-rose-400">
                            -Ks {Math.abs(r.total_payout || 0).toLocaleString()}
                          </td>
                          <td className={`py-3 px-3 text-right font-black ${r.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            Ks {(r.profit || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-amber-300">
                            {r.margin_percent}%
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-300">
                            {r.tickets_count || 0}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {data?.sub_total && (
                    <tfoot className="bg-navy-950 font-mono font-black text-xs text-white border-t-2 border-gold-500/40">
                      <tr>
                        <td colSpan={2} className="py-3 px-3 uppercase font-sans font-bold text-gold-400">
                          Total Summary
                        </td>
                        <td className="py-3 px-3 text-right text-blue-300 font-bold">-</td>
                        <td className="py-3 px-3 text-right text-amber-300 font-bold">-</td>
                        <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                          Ks {(data.sub_total.four_d_bet || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right text-rose-400">
                          -Ks {Math.abs(data.sub_total.four_d_payout || 0).toLocaleString()}
                        </td>
                        <td className={`py-3 px-3 text-right font-black ${data.sub_total.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          Ks {(data.sub_total.profit || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right text-gold-400 font-bold">
                          {data.sub_total.four_d_bet > 0 
                            ? `${Math.round(((data.sub_total.profit || 0) / data.sub_total.four_d_bet) * 1000) / 10}%` 
                            : '0%'}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-300">-</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}

              {gameFilter === '3D' && (
                /* Thai 3D Dedicated Mini Ledger */
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-navy-950/90 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20 text-[11px]">
                    <tr>
                      <th className="py-3 px-4">No</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-right">3D Bet Stake</th>
                      <th className="py-3 px-4 text-right">3D Winning Payout</th>
                      <th className="py-3 px-4 text-right">Company Net Profit</th>
                      <th className="py-3 px-4 text-right">Margin %</th>
                      <th className="py-3 px-4 text-center">Bets Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gold-400 mb-2" />
                          Calculating Thai 3D daily statement...
                        </td>
                      </tr>
                    ) : !data?.reports || data.reports.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                          No Thai 3D betting records found in date range.
                        </td>
                      </tr>
                    ) : (
                      data.reports.map((r, i) => (
                        <tr key={r.report_date || i} className="hover:bg-navy-800/40 transition-colors">
                          <td className="py-3 px-4 text-slate-500 font-mono">{i + 1}</td>
                          <td className="py-3 px-4 font-sans font-semibold text-white">{r.report_date}</td>
                          <td className="py-3 px-4 text-right text-emerald-400 font-bold">
                            Ks {(r.total_bet || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right text-rose-400">
                            -Ks {Math.abs(r.total_payout || 0).toLocaleString()}
                          </td>
                          <td className={`py-3 px-4 text-right font-black ${r.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            Ks {(r.profit || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-amber-300">
                            {r.margin_percent}%
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-300">
                            {r.tickets_count || 0}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {data?.sub_total && (
                    <tfoot className="bg-navy-950 font-mono font-black text-xs text-white border-t-2 border-gold-500/40">
                      <tr>
                        <td colSpan={2} className="py-3 px-4 uppercase font-sans font-bold text-gold-400">
                          Total Summary
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-400 font-bold">
                          Ks {(data.sub_total.four_d_bet || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-rose-400">
                          -Ks {Math.abs(data.sub_total.four_d_payout || 0).toLocaleString()}
                        </td>
                        <td className={`py-3 px-4 text-right font-black ${data.sub_total.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          Ks {(data.sub_total.profit || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-gold-400 font-bold">
                          {data.sub_total.four_d_bet > 0 
                            ? `${Math.round(((data.sub_total.profit || 0) / data.sub_total.four_d_bet) * 1000) / 10}%` 
                            : '0%'}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-300">-</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
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

      {/* VIEW 3: Draw-by-Draw Financial Statement */}
      {reportType === 'draws' && (
        <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-gold-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-gold-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-serif">
                {gameTitle} Draw-by-Draw Financial Breakdown & Audit
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {data?.total || data?.results?.length || 0} draws
            </span>
          </div>

          <div className="overflow-x-auto">
            {selectedGame === '2D' ? (
              /* Thai 2D Draw by Draw Table */
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-navy-950/80 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20">
                  <tr>
                    <th 
                      onClick={() => handleToggleDrawSort('date')}
                      className="py-3 px-4 cursor-pointer hover:text-gold-300 transition-colors select-none"
                    >
                      <span className="flex items-center gap-1.5">
                        <span>Draw Date</span>
                        <span className="text-gold-400 font-mono text-xs">{drawSortCol === 'date' ? (drawSortAsc ? '▲' : '▼') : '↕'}</span>
                      </span>
                    </th>
                    <th className="py-3 px-4">Session</th>
                    <th className="py-3 px-4">SET Index / Value</th>
                    <th className="py-3 px-4 text-center">2D Winning No</th>
                    <th className="py-3 px-4 text-right">Total Bet Stake</th>
                    <th className="py-3 px-4 text-right">Winning Payouts</th>
                    <th 
                      onClick={() => handleToggleDrawSort('profit')}
                      className="py-3 px-4 text-right cursor-pointer hover:text-gold-300 transition-colors select-none"
                    >
                      <span className="flex items-center justify-end gap-1.5">
                        <span>Net Profit</span>
                        <span className="text-gold-400 font-mono text-xs">{drawSortCol === 'profit' ? (drawSortAsc ? '▲' : '▼') : '↕'}</span>
                      </span>
                    </th>
                    <th className="py-3 px-4 text-right">Margin %</th>
                    <th className="py-3 px-4 text-center">Bets Count</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-500 font-sans">
                        Loading Thai 2D draw statements...
                      </td>
                    </tr>
                  ) : sortedDrawResults.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-500 font-sans">
                        No 2D draws found in range.
                      </td>
                    </tr>
                  ) : (
                    sortedDrawResults.map((d, i) => (
                      <tr key={d.id || i} className="hover:bg-navy-800/40 transition-colors">
                        <td className="py-3 px-4 font-sans font-bold text-white">{d.date}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            d.session === 'morning' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {d.session_label || d.session}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {d.set_index || '-'} / {d.set_value || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-black text-sm border border-amber-500/40">
                            {d.winning_number || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-400">
                          Ks {(d.total_bet_amount || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-rose-400">
                          -Ks {(d.total_payout_amount || 0).toLocaleString()}
                        </td>
                        <td className={`py-3 px-4 text-right font-black ${d.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          Ks {(d.profit || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-amber-300">
                          {d.margin_percent}%
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-300">
                          {d.tickets_count || 0}
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
            ) : selectedGame === '3D' ? (
              /* Thai 3D Draw by Draw Table */
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-navy-950/80 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20">
                  <tr>
                    <th 
                      onClick={() => handleToggleDrawSort('date')}
                      className="py-3 px-4 cursor-pointer hover:text-gold-300 transition-colors select-none"
                    >
                      <span className="flex items-center gap-1.5">
                        <span>Draw Date</span>
                        <span className="text-gold-400 font-mono text-xs">{drawSortCol === 'date' ? (drawSortAsc ? '▲' : '▼') : '↕'}</span>
                      </span>
                    </th>
                    <th className="py-3 px-4">Draw Time</th>
                    <th className="py-3 px-4 text-center">3D Winning No</th>
                    <th className="py-3 px-4 text-right">Total Bet Stake</th>
                    <th className="py-3 px-4 text-right">Winning Payouts</th>
                    <th 
                      onClick={() => handleToggleDrawSort('profit')}
                      className="py-3 px-4 text-right cursor-pointer hover:text-gold-300 transition-colors select-none"
                    >
                      <span className="flex items-center justify-end gap-1.5">
                        <span>Net Profit</span>
                        <span className="text-gold-400 font-mono text-xs">{drawSortCol === 'profit' ? (drawSortAsc ? '▲' : '▼') : '↕'}</span>
                      </span>
                    </th>
                    <th className="py-3 px-4 text-right">Margin %</th>
                    <th className="py-3 px-4 text-center">Bets Count</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 font-sans">
                        Loading Thai 3D draw statements...
                      </td>
                    </tr>
                  ) : sortedDrawResults.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 font-sans">
                        No 3D draws found in range.
                      </td>
                    </tr>
                  ) : (
                    sortedDrawResults.map((d, i) => (
                      <tr key={d.id || i} className="hover:bg-navy-800/40 transition-colors">
                        <td className="py-3 px-4 font-sans font-bold text-white">{d.date}</td>
                        <td className="py-3 px-4 text-slate-300 font-mono">{d.draw_time_mmt}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-3 py-1 rounded-lg bg-purple-500/20 text-purple-300 font-mono font-black text-sm border border-purple-500/40">
                            {d.winning_number || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-400">
                          Ks {(d.total_bet_amount || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-rose-400">
                          -Ks {(d.total_payout_amount || 0).toLocaleString()}
                        </td>
                        <td className={`py-3 px-4 text-right font-black ${d.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          Ks {(d.profit || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-amber-300">
                          {d.margin_percent}%
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-300">
                          {d.tickets_count || 0}
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
            ) : (
              /* 4D or ALL Draw by Draw Table */
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-navy-950/80 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20">
                  <tr>
                    <th 
                      onClick={() => handleToggleDrawSort('date')}
                      className="py-3 px-4 cursor-pointer hover:text-gold-300 transition-colors select-none group"
                    >
                      <span className="flex items-center gap-1.5">
                        <span>Draw Date</span>
                        <span className="text-gold-400 font-mono text-xs">{drawSortCol === 'date' ? (drawSortAsc ? '▲' : '▼') : '↕'}</span>
                      </span>
                    </th>
                    <th 
                      onClick={() => handleToggleDrawSort('draw_no')}
                      className="py-3 px-4 cursor-pointer hover:text-gold-300 transition-colors select-none group"
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
            )}
          </div>
        </div>
      )}

      {/* VIEW 4: Player Turnover Ranking */}
      {reportType === 'user-bet' && (
        <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-gold-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gold-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-serif">
                {selectedGame === 'ALL'
                  ? 'Player Turnover Ranking (Live Order by Stake Volume)'
                  : `${gameTitle} Player Turnover Ranking (Live Order by Stake Volume)`}
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
                  <th className="py-3 px-4 text-right">{selectedGame === 'ALL' ? 'Total Staked (Turnover)' : `${gameTitle} Turnover`}</th>
                  <th className="py-3 px-4 text-right">{selectedGame === 'ALL' ? 'Total Payout (Won)' : `${gameTitle} Payout`}</th>
                  <th className="py-3 px-4 text-right">Net Profit from Player</th>
                  <th className="py-3 px-4 text-right">Wallet Balance</th>
                  <th className="py-3 px-4">{selectedGame === 'ALL' ? 'Last Bet Placed' : `Last ${gameTitle} Bet`}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      Loading {selectedGame === 'ALL' ? 'player' : gameTitle} turnover rankings...
                    </td>
                  </tr>
                ) : !data?.results || data.results.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No {selectedGame === 'ALL' ? 'player' : gameTitle} betting records found.
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

      {/* VIEW 5: Agent Turnover Summary */}
      {reportType === 'agents' && (
        <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-gold-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-gold-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-serif">
                Agent Performance, Network Turnover & Commission Summary
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
                  <th className="py-3 px-4 text-right">Pending Comm</th>
                  <th className="py-3 px-4 text-right">Settled Comm</th>
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
