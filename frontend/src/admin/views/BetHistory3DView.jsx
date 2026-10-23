import React, { useState, useEffect } from 'react';
import { 
  Search, 
  RotateCcw, 
  Receipt, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft,
  ChevronsRight,
  Eye, 
  CheckCircle, 
  Clock, 
  XCircle,
  Filter,
  Copy,
  Check,
  Calendar,
  Phone,
  User,
  Hash,
  Edit,
  History,
  AlertTriangle,
  X,
  Lock,
  Sparkles
} from 'lucide-react';
import { apiClient } from '../../api/client';

export default function BetHistory3DView({ onNotify }) {
  const [bets, setBets] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);

  // Filters
  const [gameDate, setGameDate] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [number, setNumber] = useState('');
  const [status, setStatus] = useState('');
  const [voucher, setVoucher] = useState('');
  const [isEditedFilter, setIsEditedFilter] = useState('');

  // Modals
  const [copiedVoucher, setCopiedVoucher] = useState(null);
  const [editingBet, setEditingBet] = useState(null);
  const [newNumber, setNewNumber] = useState('');
  const [editNote, setEditNote] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [viewingAuditLogs, setViewingAuditLogs] = useState(null);

  useEffect(() => {
    loadBets();
  }, [page, pageSize, isEditedFilter]);

  const loadBets = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: pageSize
      };
      if (gameDate.trim()) params.game_date = gameDate.trim();
      if (nickname.trim()) params.nickname = nickname.trim();
      if (phone.trim()) params.phone = phone.trim();
      if (number.trim()) params.number = number.trim();
      if (status.trim()) params.status = status.trim();
      if (voucher.trim()) params.voucher = voucher.trim();
      if (isEditedFilter) params.is_edited = isEditedFilter;

      const res = await apiClient.getAdmin3DBets(params);
      const records = res.bets || res.results || [];
      setBets(records);
      setTotal(res.total || records.length || 0);
    } catch (err) {
      console.error('Error loading 3D bets:', err);
      if (onNotify) onNotify(err.message || 'Failed to load 3D bets', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setGameDate('');
    setNickname('');
    setPhone('');
    setNumber('');
    setStatus('');
    setVoucher('');
    setIsEditedFilter('');
    setPage(1);
    setTimeout(loadBets, 50);
  };

  const handleCopyVoucher = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedVoucher(code);
    if (onNotify) onNotify(`Copied voucher: ${code}`, 'success');
    setTimeout(() => setCopiedVoucher(null), 2000);
  };

  const openEditModal = (bet) => {
    setEditingBet(bet);
    setNewNumber(bet.number);
    setEditNote('');
    setEditError('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingBet) return;
    const cleanNum = newNumber.trim().padStart(3, '0');
    if (!cleanNum || cleanNum.length !== 3 || isNaN(cleanNum)) {
      setEditError('3D ဂဏန်းသည် 000 မှ 999 အထိ ဂဏန်း ၃ လုံး ဖြစ်ရပါမည်');
      return;
    }

    try {
      setIsSubmittingEdit(true);
      setEditError('');
      await apiClient.editAdmin3DBetNumber(editingBet.item_id, {
        new_number: cleanNum,
        note: editNote.trim() || 'Admin manual 3D correction'
      });

      if (onNotify) onNotify(`3D နံပါတ် ${editingBet.number} မှ ${cleanNum} သို့ ပြောင်းလဲပြင်ဆင်ပြီးပါပြီ`, 'success');
      setEditingBet(null);
      loadBets();
    } catch (err) {
      setEditError(err.message || 'နံပါတ် ပြင်ဆင်ရာတွင် အမှားဖြစ်ပေါ်ပါသည်');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* Title Banner */}
      <div className="bg-navy-900/90 border border-gold-500/20 p-5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-purple-400" />
            <span>Thai 3D Bet History (3D လောင်းကြေးမှတ်တမ်းများ)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            3D ထိုးထားသော ဘောက်ချာများနှင့် Straight / Tote ဂဏန်းများအား စစ်ဆေးခြင်း၊ နံပါတ် အမှားပြင်ဆင်ခြင်းနှင့် Audit Log များ
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadBets}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy-800 hover:bg-navy-750 text-gold-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-navy-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-purple-400" />
            <span>Search & Filter Criteria</span>
          </span>

          {/* Quick Filter: Edited Only Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
            <button
              onClick={() => { setIsEditedFilter(''); setPage(1); }}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                !isEditedFilter ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Bets
            </button>
            <button
              onClick={() => { setIsEditedFilter('edited'); setPage(1); }}
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                isEditedFilter === 'edited' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Edit className="w-3 h-3 text-amber-300" />
              <span>Edited Only (ပြင်ထားသောဂဏန်းများ)</span>
            </button>
            <button
              onClick={() => { setIsEditedFilter('original'); setPage(1); }}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                isEditedFilter === 'original' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Original Only
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Draw Date</label>
            <input
              type="text"
              placeholder="YYYY-MM-DD"
              value={gameDate}
              onChange={(e) => setGameDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Player Name</label>
            <input
              type="text"
              placeholder="e.g. Michael"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Phone Number</label>
            <input
              type="text"
              placeholder="09..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">3D Number</label>
            <input
              type="text"
              placeholder="e.g. 782"
              maxLength={3}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Voucher Code</label>
            <input
              type="text"
              placeholder="Voucher #"
              value={voucher}
              onChange={(e) => setVoucher(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => { setPage(1); loadBets(); }}
              className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
            </button>
            <button
              onClick={handleResetFilters}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Reset Filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bets Table */}
      <div className="bg-navy-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Total Results: <span className="font-mono font-bold text-white">{total.toLocaleString()}</span> items
          </span>
          <span className="text-xs text-slate-400">
            Page <span className="font-mono text-white font-bold">{page}</span> of <span className="font-mono text-white font-bold">{totalPages}</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Voucher</th>
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-4">Draw Date</th>
                <th className="py-3 px-4 text-center">3D Number</th>
                <th className="py-3 px-4 text-center">Bet Type</th>
                <th className="py-3 px-4 text-right">Stake (Ks)</th>
                <th className="py-3 px-4 text-center">Multiplier</th>
                <th className="py-3 px-4 text-right">Potential Win</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-sans">
                    <RotateCcw className="w-6 h-6 animate-spin mx-auto text-purple-500 mb-2" />
                    3D Bet Records ရယူနေပါသည်...
                  </td>
                </tr>
              ) : bets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 font-sans">
                    ကိုက်ညီသော 3D လောင်းကြေးမှတ်တမ်း မတွေ့ရှိပါ
                  </td>
                </tr>
              ) : (
                bets.map((b) => (
                  <tr key={b.id || b.item_id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Voucher */}
                    <td className="py-3 px-4 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-300">{b.voucher}</span>
                        <button
                          onClick={() => handleCopyVoucher(b.voucher)}
                          className="text-slate-500 hover:text-purple-400 cursor-pointer"
                          title="Copy"
                        >
                          {copiedVoucher === b.voucher ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-500 block font-sans">{b.created_at}</span>
                    </td>

                    {/* Player */}
                    <td className="py-3 px-4 font-sans">
                      <div className="font-bold text-white">{b.nickname}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{b.phone}</div>
                    </td>

                    {/* Draw Date */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-300">{b.draw_date}</div>
                    </td>

                    {/* 3D Number */}
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="px-3 py-1 rounded-xl bg-purple-500/20 text-purple-300 font-black text-sm tracking-widest border border-purple-500/40 shadow-inner">
                          {b.number}
                        </span>
                        {b.is_edited && (
                          <span className="mt-1 px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold font-sans">
                            EDITED
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Bet Type */}
                    <td className="py-3 px-4 text-center font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {b.bet_type || 'STRAIGHT'}
                      </span>
                    </td>

                    {/* Stake */}
                    <td className="py-3 px-4 text-right font-black text-white">
                      Ks {(b.amount || 0).toLocaleString()}
                    </td>

                    {/* Multiplier */}
                    <td className="py-3 px-4 text-center text-amber-400 font-bold">
                      {b.multiplier || 700}x
                    </td>

                    {/* Potential Win */}
                    <td className="py-3 px-4 text-right font-black text-emerald-400">
                      Ks {(b.potential_win || 0).toLocaleString()}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${
                        b.status === 'Won'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : b.status === 'Lost'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        {b.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Edit Button */}
                        <button
                          onClick={() => openEditModal(b)}
                          disabled={!b.is_editable}
                          className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                            b.is_editable
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500 hover:text-slate-950 cursor-pointer'
                              : 'bg-slate-800 text-slate-600 border border-slate-700/50 cursor-not-allowed opacity-50'
                          }`}
                          title={b.is_editable ? '3D ဂဏန်းအား ပြင်ဆင်မည်' : 'ထီပေါက်စဉ်ထွက်ပြီးဖြစ်၍ ပြင်ဆင်၍မရတော့ပါ'}
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>

                        {/* Audit Logs Button */}
                        {b.is_edited && (
                          <button
                            onClick={() => setViewingAuditLogs(b)}
                            className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500 hover:text-white transition-all cursor-pointer"
                            title="ပြင်ဆင်မှုမှတ်တမ်း ကြည့်မည်"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-mono text-white font-bold">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Bet Number Modal */}
      {editingBet && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-gold-500/30 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-white text-base">Edit 3D Bet Number</h3>
              </div>
              <button
                onClick={() => setEditingBet(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Voucher:</span>
                <span className="font-mono font-bold text-white">{editingBet.voucher}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Player:</span>
                <span className="font-bold text-white">{editingBet.nickname} ({editingBet.phone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current 3D Number:</span>
                <span className="font-mono font-black text-purple-300 text-sm">{editingBet.number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Stake:</span>
                <span className="font-mono font-bold text-emerald-400">Ks {editingBet.amount?.toLocaleString()}</span>
              </div>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-600/40 text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  ဂဏန်းအသစ် ပြောင်းလဲထည့်သွင်းရန် (000 – 999)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 782"
                  maxLength={3}
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-2xl font-black font-mono text-center tracking-widest text-purple-300 focus:outline-none focus:border-purple-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  ပြင်ဆင်ရသည့် အကြောင်းပြချက် (Reason / Note)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Customer requested number swap before cutoff"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBet(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold transition-all shadow-lg shadow-purple-950 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Confirm Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Logs Modal */}
      {viewingAuditLogs && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-gold-500/30 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" />
                <h3 className="font-extrabold text-white text-base">3D Number Edit History Log</h3>
              </div>
              <button
                onClick={() => setViewingAuditLogs(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {(viewingAuditLogs.edit_history || []).map((log, idx) => (
                <div key={idx} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-bold text-white">Admin: {log.admin_name}</span>
                    <span className="font-mono text-[10px]">{log.changed_at}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-rose-400 line-through font-bold">{log.old_number}</span>
                    <span className="text-slate-500">→</span>
                    <span className="text-emerald-400 font-bold text-sm">{log.new_number}</span>
                  </div>
                  {log.note && (
                    <p className="text-[11px] text-slate-400 italic">
                      Note: "{log.note}"
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setViewingAuditLogs(null)}
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
