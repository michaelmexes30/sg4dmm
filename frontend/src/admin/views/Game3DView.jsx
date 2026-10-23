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

export default function Game3DView({ onNotify, mode = 'live' }) {
  const [gameData, setGameData] = useState(null);
  const [selectedDrawId, setSelectedDrawId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchNumber, setSearchNumber] = useState('');

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
      const res = await apiClient.getAdmin3DGame(drawId, mode);
      setGameData(res);
      if (!selectedDrawId && res?.selected_draw?.id) {
        setSelectedDrawId(res.selected_draw.id);
      }
    } catch (err) {
      console.error('Error loading 3D game data:', err);
      if (onNotify) onNotify(err.message || 'Failed to load 3D game data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNumberAudit = async (num) => {
    const formatted = String(num).padStart(3, '0');
    setAuditNumber(formatted);
    setAuditData(null);
    setLoadingAudit(true);
    try {
      const res = await apiClient.getAdmin3DNumberAudit(formatted, selectedDrawId);
      setAuditData(res);
    } catch (err) {
      console.error('Failed to load 3D number audit:', err);
      if (onNotify) onNotify(err.message || 'Failed to fetch bets for this 3D number', 'error');
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

  const handleRemoveClosedNumber = async (number) => {
    try {
      await apiClient.deleteAdmin3DClosedNumber(number, selectedDrawId);
      if (onNotify) onNotify(`Re-opened 3D number ${number}`, 'success');
      loadGameData(selectedDrawId);
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Failed to re-open 3D number', 'error');
    }
  };

  const handleAddClosedNumberModal = async (e) => {
    e.preventDefault();
    const clean = newNumber.trim().padStart(3, '0');
    if (!clean || clean.length !== 3 || isNaN(clean)) {
      alert('ကျေးဇူးပြု၍ 000 မှ 999 အတွင်း ဂဏန်း ၃ လုံး ရိုက်ထည့်ပါ');
      return;
    }
    try {
      setSubmitting(true);
      await apiClient.addAdmin3DClosedNumber({
        draw_id: selectedDrawId,
        number: clean
      });
      if (onNotify) onNotify(`Closed 3D number ${clean} successfully`, 'success');
      setNewNumber('');
      setIsAddModalOpen(false);
      loadGameData(selectedDrawId);
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Failed to close 3D number', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !gameData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
        <span className="text-xs font-semibold">Thai 3D Data များ ရယူနေပါသည်...</span>
      </div>
    );
  }

  // Past Mode
  if (mode === 'past') {
    const pastDraws = gameData?.past_draws || [];
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-navy-900/90 border border-gold-500/30 p-4 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black border border-purple-500/40 text-lg">
              🎲
            </div>
            <div>
              <h2 className="font-extrabold text-white text-base">Thai 3D Past Games (ယခင် 3D ပေါက်စဉ်များ)</h2>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Thai Government Official Lottery Results (Every 1st & 16th of the month at 03:30 PM MMT)
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

        {/* Past Draws Table */}
        <div className="bg-navy-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Draw Date</th>
                  <th className="py-3.5 px-4">Draw Time</th>
                  <th className="py-3.5 px-4">Thai 1st Prize (6 Digits)</th>
                  <th className="py-3.5 px-4 text-center">Winning 3D (Last 3)</th>
                  <th className="py-3.5 px-4 text-right">Total Staked</th>
                  <th className="py-3.5 px-4 text-right">Total Payout</th>
                  <th className="py-3.5 px-4 text-right">Net Profit</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {pastDraws.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                      ယခင် 3D ထီပေါက်စဉ်မှတ်တမ်း မရှိသေးပါ
                    </td>
                  </tr>
                ) : (
                  pastDraws.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{d.draw_date}</td>
                      <td className="py-3 px-4 text-slate-400">{d.draw_time_mmt}</td>
                      <td className="py-3 px-4 text-slate-300 font-bold tracking-wider">{d.thai_first_prize || '------'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-3 py-1 rounded-xl bg-purple-500/20 text-purple-300 font-black text-sm tracking-widest border border-purple-500/40 shadow-inner">
                          {d.winning_number || '---'}
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

  // Live Mode
  const currentDraw = gameData?.selected_draw;
  const availableDraws = gameData?.available_draws || [];
  const topNumbers = gameData?.top_numbers || [];
  const closedList = currentDraw?.closed_numbers || [];
  const straightPayout = gameData?.straight_payout || 700.0;
  const totePayout = gameData?.tote_payout || 10.0;
  const maxRiskCap = gameData?.max_risk_cap || 200000.0;
  const totalStaked = gameData?.total_staked || 0.0;
  const peakLiability = gameData?.peak_liability || 0.0;

  const filteredTopNumbers = topNumbers.filter((n) => {
    if (!searchNumber.trim()) return true;
    return n.number.includes(searchNumber.trim());
  });

  return (
    <div className="space-y-6">
      {/* 3D Session Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-navy-900/90 border border-gold-500/20 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          <Calendar className="w-5 h-5 text-gold-400 shrink-0 mr-1" />
          {availableDraws.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDrawId(d.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                selectedDrawId === d.id
                  ? 'bg-purple-600 text-white font-extrabold shadow-md shadow-purple-900/50'
                  : 'bg-navy-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>{d.draw_date}</span>
              <span className="text-[10px] opacity-80">{d.draw_time_mmt}</span>
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
            <span>+ Lock / Close 3D Number</span>
          </button>
        </div>
      </div>

      {/* 4 Executive Risk KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Staked Pool */}
        <div className="bg-navy-900/90 border border-emerald-500/30 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-extrabold text-emerald-400 tracking-wider">
              Total 3D Pool Staked
            </span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white">
              Ks {totalStaked.toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 font-mono">
            Draw Date: {currentDraw?.draw_date}
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
            Straight: <span className="font-bold text-amber-300 font-mono">{straightPayout}x</span> | Tote: <span className="font-bold text-amber-300 font-mono">{totePayout}x</span>
          </p>
        </div>

        {/* Closed Numbers */}
        <div className="bg-navy-900/90 border border-amber-500/30 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-extrabold text-amber-400 tracking-wider">
              Closed 3D Numbers (ပိတ်ဂဏန်းများ)
            </span>
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-amber-400">
              {closedList.length}
            </span>
            <span className="text-xs text-slate-400">numbers blocked</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            One-click lock/unlock supported
          </p>
        </div>

        {/* Max Risk Cap */}
        <div className="bg-navy-900/90 border border-purple-500/30 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-extrabold text-purple-400 tracking-wider">
              Max Risk Limit
            </span>
            <ShieldAlert className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-purple-300">
              Ks {maxRiskCap.toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Cutoff: <span className="text-slate-200 font-mono">{currentDraw?.cutoff_time_mmt || '02:30 PM'}</span>
          </p>
        </div>
      </div>

      {/* Closed 3D Numbers Panel */}
      <div className="bg-navy-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-rose-400" />
            <h3 className="font-extrabold text-white text-sm">
              Currently Blocked / Closed 3D Numbers ({closedList.length})
            </h3>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-rose-400" />
            <span>Add Blocked Number</span>
          </button>
        </div>

        {closedList.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">လက်ရှိအချိန်တွင် ပိတ်ထားသော 3D ဂဏန်း မရှိသေးပါခင်ဗျာ။</p>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1 font-mono">
            {closedList.map((num) => (
              <span
                key={num}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-950/60 border border-rose-600/50 text-rose-300 font-black text-xs"
              >
                <span>{num}</span>
                <button
                  onClick={() => handleRemoveClosedNumber(num)}
                  className="hover:text-white p-0.5 rounded cursor-pointer"
                  title="Re-open number"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Top 20 High Stakes 3D Numbers Monitor */}
      <div className="bg-navy-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span>Top High-Stakes 3D Numbers (3D အရောင်းရဆုံး ဂဏန်းများ)</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              လောင်းကြေးအများဆုံး ရရှိထားသော 3D ဂဏန်းများအား စောင့်ကြည့်ခြင်းနှင့် အနိုင်ပေးလျော်ငွေ တွက်ချက်မှု
            </p>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search 3D (e.g. 782)"
              value={searchNumber}
              onChange={(e) => setSearchNumber(e.target.value)}
              maxLength={3}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 w-36 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {filteredTopNumbers.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs font-sans">
            လတ်တလော 3D ထိုးထားသော ဂဏန်းမှတ်တမ်း မရှိသေးပါ
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredTopNumbers.map((item, idx) => (
              <div
                key={item.number}
                className={`p-3 rounded-2xl border transition-all ${
                  item.is_closed
                    ? 'bg-rose-950/40 border-rose-600/50 text-rose-300'
                    : 'bg-slate-950/80 border-slate-800 hover:border-purple-500/50 text-white'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                  <span>Rank #{idx + 1}</span>
                  {item.is_closed && (
                    <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                      CLOSED
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between my-1">
                  <button
                    onClick={() => handleOpenNumberAudit(item.number)}
                    className="text-2xl font-black font-mono text-purple-300 hover:text-white transition-colors cursor-pointer tracking-wider"
                    title="Click to view player bets"
                  >
                    {item.number}
                  </button>
                  <div className="text-right font-mono">
                    <span className="text-xs font-bold text-emerald-400">
                      Ks {item.staked.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Max Liability:</span>
                  <span className="font-mono font-bold text-rose-400">
                    Ks {item.liability.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lock 3D Number Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-gold-500/30 rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-rose-400" />
                <h3 className="font-extrabold text-white text-base">Lock / Close 3D Number</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              ပိတ်လိုသော 3D ဂဏန်းအား ရိုက်ထည့်ပါ။ အသုံးပြုသူများ ဤဂဏန်းအား ထပ်မံထိုးခွင့် ရရှိတော့မည်မဟုတ်ပါ။
            </p>

            <form onSubmit={handleAddClosedNumberModal} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">3D ဂဏန်း (000 – 999)</label>
                <input
                  type="text"
                  placeholder="e.g. 782"
                  maxLength={3}
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-lg font-black font-mono text-center tracking-widest text-purple-300 focus:outline-none focus:border-purple-500"
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
                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center justify-center font-black text-2xl font-mono shadow-inner">
                  {auditNumber}
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">
                    3D Number <span className="text-purple-300 font-mono">{auditNumber}</span> Bet Audit
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
                  <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
                  <span className="text-xs">လောင်းကြေးစာရင်း ရယူနေပါသည်...</span>
                </div>
              ) : !auditData || auditData.bets.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  ဤ 3D ဂဏန်းအတွက် ထိုးထားသော လောင်းကြေးမှတ်တမ်း မရှိသေးပါခင်ဗျာ။
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
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-500/20 text-purple-300 font-mono font-bold">
                              {bet.bet_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                            <span>Voucher: {bet.voucher}</span>
                            <button
                              onClick={() => handleCopyVoucher(bet.voucher)}
                              className="text-slate-400 hover:text-purple-400 cursor-pointer"
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
