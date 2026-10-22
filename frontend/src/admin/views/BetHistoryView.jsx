import React, { useState, useEffect } from 'react';
import { 
  Search, 
  RotateCcw, 
  Receipt, 
  FileText, 
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
  Printer,
  Sparkles,
  Ticket,
  TrendingUp,
  Award,
  Calendar,
  Phone,
  User,
  Hash,
  Edit,
  Lock,
  AlertTriangle,
  History,
  X
} from 'lucide-react';
import { apiClient } from '../../api/client';

export default function BetHistoryView({ onNotify }) {
  const [bets, setBets] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [loading, setLoading] = useState(true);

  // Filters
  const [gameDate, setGameDate] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [number, setNumber] = useState('');
  const [status, setStatus] = useState('');
  const [voucher, setVoucher] = useState('');
  const [isEditedFilter, setIsEditedFilter] = useState('');

  // Slip detail modal
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [copiedVoucher, setCopiedVoucher] = useState(null);

  // Edit Bet Number Modal State
  const [editingBet, setEditingBet] = useState(null);
  const [newNumber, setNewNumber] = useState('');
  const [editNote, setEditNote] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Audit Logs Modal State
  const [viewingAuditLogs, setViewingAuditLogs] = useState(null);

  useEffect(() => {
    loadBets();
  }, [page, pageSize, isEditedFilter]);

  const loadBets = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        page_size: pageSize,
        limit: pageSize
      };
      if (gameDate.trim()) params.game_date = gameDate.trim();
      if (nickname.trim()) params.nickname = nickname.trim();
      if (phone.trim()) params.phone = phone.trim();
      if (number.trim()) params.number = number.trim();
      if (status.trim()) params.status = status.trim();
      if (voucher.trim()) params.voucher = voucher.trim();
      if (isEditedFilter) params.is_edited = isEditedFilter;

      const res = await apiClient.getAdmin4DBets(params);
      
      const records = res.bets || res.results || (Array.isArray(res) ? res : []);
      setBets(records);
      setTotal(res.total || records.length || 0);
    } catch (err) {
      console.error('Error fetching bets:', err);
      if (onNotify) onNotify(err.message || 'Failed to fetch bet history', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadBets();
  };

  const handleReset = () => {
    setGameDate('');
    setNickname('');
    setPhone('');
    setNumber('');
    setStatus('');
    setVoucher('');
    setIsEditedFilter('');
    setPage(1);
    setTimeout(() => {
      loadBets();
    }, 50);
  };

  const handleCopyVoucher = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedVoucher(code);
    if (onNotify) onNotify(`Voucher ${code} copied to clipboard`, 'success');
    setTimeout(() => setCopiedVoucher(null), 2000);
  };

  const handleOpenEdit = (bet) => {
    setEditingBet(bet);
    setNewNumber(bet.number || '');
    setEditNote('');
    setEditError('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    const clean = newNumber.trim();
    if (!clean || clean.length !== 4 || !/^\d{4}$/.test(clean)) {
      setEditError('ထိုးဂဏန်းသည် ဂဏန်း ၄ လုံး (0000 မှ 9999) ဖြစ်ရပါမည်');
      return;
    }

    try {
      setIsSubmittingEdit(true);
      const res = await apiClient.editAdminBetNumber(editingBet.item_id, {
        new_number: clean,
        combo_index: editingBet.combo_index || 0,
        note: editNote.trim()
      });

      if (onNotify) {
        onNotify(res.message || `ဂဏန်းအား ${clean} သို့ အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ`, 'success');
      }
      setEditingBet(null);
      loadBets();
    } catch (err) {
      console.error('Failed to edit bet number:', err);
      setEditError(err.message || 'ထိုးဂဏန်း ပြောင်းလဲခြင်း မအောင်မြင်ပါ');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const getStatusBadge = (st) => {
    switch (st?.toUpperCase()) {
      case 'WIN':
      case 'WON':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3" /> WON
          </span>
        );
      case 'LOSE':
      case 'LOST':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/25">
            <XCircle className="w-3 h-3" /> LOST
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-gold-300 border border-gold-500/25">
            <Clock className="w-3 h-3" /> PENDING
          </span>
        );
    }
  };

  // Quick Stats
  const pageStakes = bets.reduce((acc, b) => acc + (Number(b.stake_amount || b.amount) || 0), 0);
  const winCount = bets.filter(b => b.status === 'Won' || b.status === 'WIN').length;

  return (
    <div className="space-y-6">
      {/* 1. Header & KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-wider uppercase text-slate-400">Total Bets In System</p>
            <p className="text-2xl font-black font-mono text-gold-400 mt-1">{total.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Live + historical 4D tickets</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-gold-400">
            <Ticket className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-wider uppercase text-slate-400">Page Stake Subtotal</p>
            <p className="text-2xl font-black font-mono text-emerald-400 mt-1">
              {pageStakes.toLocaleString()} Ks
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Showing {bets.length} tickets on page</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-wider uppercase text-slate-400">Active Draw Focus</p>
            <p className="text-lg font-bold text-white mt-1">Draw #3 (17 Oct)</p>
            <p className="text-[10px] text-gold-400 mt-0.5">10,000 combinations loaded</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-wider uppercase text-slate-400">Top Bettor Profile</p>
            <p className="text-lg font-bold text-white font-mono mt-1">0943105959</p>
            <p className="text-[10px] text-slate-400 mt-0.5">VIP Player (10,001 slips)</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. Advanced Multi-Field Audit Filter Bar */}
      <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gold-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-serif">
              Filter & Search Bet Slips
            </h3>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setIsEditedFilter(''); setPage(1); }}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                !isEditedFilter 
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950 font-black' 
                  : 'bg-navy-950/80 text-slate-400 hover:text-white border border-gold-500/10'
              }`}
            >
              All Bets ({total.toLocaleString()})
            </button>
            <button
              type="button"
              onClick={() => { setIsEditedFilter('true'); setPage(1); }}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isEditedFilter === 'true' 
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950 font-black' 
                  : 'bg-navy-950/80 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30'
              }`}
            >
              <Edit className="w-3.5 h-3.5" />
              <span>✏️ Edited Only (ပြင်ဆင်ထားသော ဂဏန်းများသာ)</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* Game Date */}
          <div>
            <label className="block text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-gold-400" />
              <span>Game Date</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 2026-10-17"
              value={gameDate}
              onChange={(e) => setGameDate(e.target.value)}
              className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-gold-400 font-mono"
            />
          </div>

          {/* 4D Number */}
          <div>
            <label className="block text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
              <Hash className="w-3 h-3 text-gold-400" />
              <span>4D Number</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 9792, 1234"
              maxLength={4}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-gold-400 font-mono font-bold"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
              <Phone className="w-3 h-3 text-gold-400" />
              <span>Phone</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 0943105959"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-gold-400 font-mono"
            />
          </div>

          {/* Nickname */}
          <div>
            <label className="block text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
              <User className="w-3 h-3 text-gold-400" />
              <span>Nickname</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Player name"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-gold-400"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] text-slate-400 font-semibold mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-gold-400"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending (မထွက်သေး)</option>
              <option value="WON">Won (ပေါက်မဲ)</option>
              <option value="LOST">Lost (မပေါက်မဲ)</option>
              <option value="EDITED">✏️ Edited (ပြင်ဆင်ထားသော)</option>
            </select>
          </div>

          {/* Edited Status Filter */}
          <div>
            <label className="block text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
              <Edit className="w-3 h-3 text-cyan-400" />
              <span>Edited Status</span>
            </label>
            <select
              value={isEditedFilter}
              onChange={(e) => { setIsEditedFilter(e.target.value); setPage(1); }}
              className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
            >
              <option value="">All Slips (အားလုံး)</option>
              <option value="true">✏️ Edited Only (ပြင်ဆင်ထားသော)</option>
              <option value="false">Original Only (မူရင်းများသာ)</option>
            </select>
          </div>

          {/* Voucher */}
          <div>
            <label className="block text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
              <Receipt className="w-3 h-3 text-gold-400" />
              <span>Voucher Code</span>
            </label>
            <input
              type="text"
              placeholder="e.g. SLIP-"
              value={voucher}
              onChange={(e) => setVoucher(e.target.value)}
              className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-gold-400 font-mono"
            />
          </div>

          {/* Search / Reset Buttons */}
          <div className="sm:col-span-2 md:col-span-3 lg:col-span-7 flex items-center justify-end gap-2 pt-2 border-t border-gold-500/10">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navy-800 hover:bg-navy-750 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-950 transition-all cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search Bets</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. Bets 10-Column Data Table */}
      <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-gold-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-gold-400" />
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide font-serif">
                Bet Slips Audit Ledger ({total.toLocaleString()} Total)
              </h3>
              <p className="text-[11px] text-slate-400">
                Showing {bets.length > 0 ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, total)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-navy-950 border border-gold-500/20 rounded-lg px-2.5 py-1 text-white focus:outline-none focus:border-gold-400 font-mono"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100 (Default)</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950/80 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20">
              <tr>
                <th className="py-3 px-4">No</th>
                <th className="py-3 px-4">Game Date</th>
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4 text-center">4D Number</th>
                <th className="py-3 px-4 text-center">Type</th>
                <th className="py-3 px-4 text-right">Stake (MMK)</th>
                <th className="py-3 px-4">Voucher Slip</th>
                <th className="py-3 px-4 text-center">Prize</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-6 h-6 border-2 border-gold-500/20 border-t-gold-400 rounded-full animate-spin" />
                      <span className="font-mono text-xs">Loading bet slips from database...</span>
                    </div>
                  </td>
                </tr>
              ) : bets.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Receipt className="w-8 h-8 text-slate-600" />
                      <p className="font-semibold text-xs">No bet tickets found matching current filters.</p>
                      <button
                        onClick={handleReset}
                        className="text-xs text-gold-400 hover:underline"
                      >
                        Reset search criteria
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                bets.map((bet, idx) => {
                  const numberDisplay = bet.number || '----';
                  const voucherCode = bet.voucher_code || bet.voucher || bet.slip_code || `SLIP-${bet.id}`;
                  const phoneDisplay = bet.phone || bet.user || '-';
                  const nameDisplay = bet.nickname || bet.nick_name || bet.username || 'Player';
                  const drawDateDisplay = bet.draw_date || bet.game || '17 Oct 2026';
                  const stakeDisplay = Number(bet.stake_amount || bet.amount || 0);

                  return (
                    <tr key={bet.id || idx} className="hover:bg-navy-800/40 transition-colors">
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {(page - 1) * pageSize + idx + 1}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-200">
                        {drawDateDisplay}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {nameDisplay}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {phoneDisplay}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-navy-950 border border-gold-500/30 font-mono font-black text-gold-300 text-sm tracking-widest shadow-sm">
                            {numberDisplay}
                          </span>
                          {bet.is_edited && (
                            <button
                              type="button"
                              onClick={() => setViewingAuditLogs(bet)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition-all cursor-pointer shadow-sm"
                              title="Click to view modification audit log"
                            >
                              <Clock className="w-2.5 h-2.5" />
                              <span>EDITED</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {String(bet.bet_type || bet.input || '').toUpperCase() === 'R' || String(bet.bet_type || '').toLowerCase() === 'box' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black bg-amber-500/20 text-gold-300 border border-gold-500/40 shadow-sm">
                            R
                          </span>
                        ) : String(bet.bet_type || bet.input || '').toUpperCase() === 'S' || String(bet.bet_type || '').toLowerCase() === 'roll' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm">
                            S
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            Ordinary
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        <span className="text-white text-xs">{stakeDisplay.toLocaleString()}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gold-400 font-bold">{voucherCode}</span>
                          <button
                            onClick={() => handleCopyVoucher(voucherCode)}
                            className="p-1 rounded text-slate-500 hover:text-gold-300 transition-colors cursor-pointer"
                            title="Copy Voucher Code"
                          >
                            {copiedVoucher === voucherCode ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {bet.prize && bet.prize !== '-' ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-black bg-amber-500/20 text-gold-300 border border-gold-500/40 shadow-sm">
                              <Award className="w-3.5 h-3.5 text-amber-400" />
                              <span>{bet.prize}</span>
                            </span>
                            {Number(bet.payout || 0) > 0 && (
                              <span className="text-[10px] font-mono font-bold text-emerald-400 mt-0.5">
                                +{Number(bet.payout).toLocaleString()} MMK
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 font-mono text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {getStatusBadge(bet.status)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedSlip(bet)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-navy-800 hover:bg-gold-500/20 text-gold-300 text-[11px] font-bold border border-gold-500/30 transition-all cursor-pointer"
                            title="View Ticket Slip"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Slip</span>
                          </button>

                          {bet.is_editable ? (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(bet)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-[11px] font-bold border border-blue-500/40 transition-all cursor-pointer shadow-sm"
                              title="Edit 4D Number (Editable until 5:45 PM MMT / 6:00 PM 1st Wed)"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/60 text-slate-500 text-[10px] font-semibold border border-slate-700/60 cursor-not-allowed"
                              title={bet.editable_reason || "Locked (Settlement cutoff passed)"}
                            >
                              <Lock className="w-3 h-3" />
                              <span>Locked</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Full Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gold-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <span>
              Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong> ({total.toLocaleString()} total tickets)
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="p-1.5 rounded-lg bg-navy-950 border border-gold-500/20 text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
                title="First Page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg bg-navy-950 border border-gold-500/20 text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page Number Pills */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pNum;
                if (totalPages <= 5) {
                  pNum = i + 1;
                } else if (page <= 3) {
                  pNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pNum = totalPages - 4 + i;
                } else {
                  pNum = page - 2 + i;
                }
                return (
                  <button
                    key={pNum}
                    onClick={() => setPage(pNum)}
                    className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all ${
                      page === pNum
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950'
                        : 'bg-navy-950 border border-gold-500/20 text-slate-300 hover:text-white hover:border-gold-500/40'
                    }`}
                  >
                    {pNum}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg bg-navy-950 border border-gold-500/20 text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg bg-navy-950 border border-gold-500/20 text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
                title="Last Page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Luxury Casino Bet Voucher Modal */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-navy-900 border border-gold-500/40 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setSelectedSlip(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-navy-800"
            >
              ×
            </button>

            {/* Ticket Header */}
            <div className="text-center pb-3 border-b border-dashed border-gold-500/30 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-widest text-gold-400 font-mono">
                SINGAPORE 4D OFFICIAL TICKET
              </span>
              <h3 className="text-lg font-black text-white tracking-wider font-serif">
                BET VOUCHER SLIP
              </h3>
              <p className="text-xs font-mono text-gold-300 font-bold">
                #{selectedSlip.voucher_code || selectedSlip.voucher || selectedSlip.slip_code}
              </p>
            </div>

            {/* Ticket 4D Hero Number */}
            <div className="p-4 rounded-xl bg-navy-950 border border-gold-500/30 text-center space-y-1 shadow-inner">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">SELECTED 4D NUMBER</p>
              <p className="text-3xl font-black font-mono tracking-widest text-gold-400">
                {selectedSlip.number || '----'}
              </p>
              <div className="flex items-center justify-center gap-3 pt-1 text-xs">
                <span className="text-slate-400">Type: <strong className="text-gold-300 uppercase">{String(selectedSlip.bet_type || '').toLowerCase() === 'box' ? 'R' : (selectedSlip.bet_type || 'Ordinary')}</strong></span>
                <span className="text-slate-400">Stake: <strong className="text-emerald-400 font-mono">{Number(selectedSlip.stake_amount || selectedSlip.amount || 0).toLocaleString()} Ks</strong></span>
              </div>
              {selectedSlip.combination_count > 1 && (
                <div className="text-[11px] text-amber-400 font-mono text-center pt-1 font-bold">
                  ({(selectedSlip.per_unit_stake || selectedSlip.big_amount || 0).toLocaleString()} Ks × {selectedSlip.combination_count} တွဲ = {Number(selectedSlip.stake_amount || selectedSlip.amount || 0).toLocaleString()} Ks)
                </div>
              )}
            </div>

            {/* Breakdown rows */}
            <div className="space-y-2 text-xs divide-y divide-slate-800/80">
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Player Profile:</span>
                <span className="font-semibold text-white">
                  {selectedSlip.nickname || selectedSlip.nick_name || 'VIP Player'} ({selectedSlip.phone || selectedSlip.user})
                </span>
              </div>

              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Game Draw Date:</span>
                <span className="font-medium text-slate-200">
                  {selectedSlip.draw_date || selectedSlip.game}
                </span>
              </div>

              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Ticket Status:</span>
                <span>{getStatusBadge(selectedSlip.status)}</span>
              </div>

              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Placed Timestamp:</span>
                <span className="font-mono text-slate-300">
                  {selectedSlip.created_at || '2026-10-15 00:00:00'}
                </span>
              </div>
            </div>

            {/* Stylized Barcode Aesthetic */}
            <div className="pt-2 text-center">
              <div className="h-8 bg-repeat-x opacity-70 mx-auto max-w-[240px] flex items-center justify-center">
                <div className="w-full flex justify-between h-7 items-center px-2 bg-navy-950 border border-slate-800 rounded">
                  {Array.from({ length: 32 }, (_, i) => (
                    <div 
                      key={i} 
                      className={`h-5 bg-gold-400/80 ${i % 3 === 0 ? 'w-1' : (i % 2 === 0 ? 'w-0.5' : 'w-1.5')}`} 
                    />
                  ))}
                </div>
              </div>
              <p className="text-[9px] font-mono text-slate-500 mt-1">
                SECURE AUTH DIGEST: {selectedSlip.voucher_code || selectedSlip.voucher || selectedSlip.slip_code}
              </p>
            </div>

            {/* Modification Audit Trail on Slip */}
            {selectedSlip.edit_history && selectedSlip.edit_history.length > 0 && (
              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-cyan-300 text-[11px]">
                  <History className="w-3.5 h-3.5 text-cyan-400" />
                  <span>MODIFICATION AUDIT TRAIL (ပြင်ဆင်မှု မှတ်တမ်း)</span>
                </div>
                {selectedSlip.edit_history.map((log, lIdx) => (
                  <div key={lIdx} className="text-[11px] text-slate-300 font-mono flex items-center justify-between border-t border-cyan-900/40 pt-1">
                    <span>Admin <strong>{log.admin_name}</strong>: {log.old_number} → <strong className="text-emerald-400">{log.new_number}</strong></span>
                    <span className="text-slate-400 text-[10px]">{log.changed_at}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-gold-500/20">
              <button
                onClick={() => handleCopyVoucher(selectedSlip.voucher_code || selectedSlip.voucher || selectedSlip.slip_code)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-navy-800 hover:bg-navy-750 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </button>

              <button
                onClick={() => setSelectedSlip(null)}
                className="px-5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md shadow-amber-950 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 6. Edit 4D Number Modal */}
      {editingBet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0d1322] border border-blue-500/50 w-full max-w-md rounded-2xl p-6 shadow-2xl shadow-black/90 space-y-5 relative">
            <button
              onClick={() => { setEditingBet(null); setEditError(''); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <Edit className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-sans">
                  ထိုးဂဏန်း ပြင်ဆင်ခြင်း (Edit 4D Number)
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  Ticket #{editingBet.voucher_code || editingBet.voucher || editingBet.slip_code}
                </p>
              </div>
            </div>

            {/* Bet Summary Info */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">ကစားသမား (Player):</span>
                <span className="font-semibold text-white">
                  {editingBet.nickname || editingBet.nick_name || 'Player'} ({editingBet.phone || editingBet.user})
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">ပွဲစဉ်ရက်စွဲ (Game Date):</span>
                <span className="font-mono text-slate-200">{editingBet.draw_date || editingBet.game}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">လတ်တလော ထိုးဂဏန်း (Current 4D):</span>
                <span className="font-mono text-base font-black text-amber-400 bg-slate-950 px-2.5 py-0.5 rounded border border-amber-500/30">
                  {editingBet.number || '----'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">ထိုးကြေးပမာဏ (Stake):</span>
                <span className="font-mono font-bold text-emerald-400">{Number(editingBet.stake_amount || editingBet.amount || 0).toLocaleString()} MMK</span>
              </div>
            </div>

            {/* Time rule notice */}
            <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 text-[11px] text-blue-300 flex items-start gap-2">
              <Clock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>သတိပြုရန်:</strong> ထိုးဂဏန်းအား ညနေ ၅:၄၅ နာရီ (လ၏ ပထမ ဗုဒ္ဓဟူးနေ့ဖြစ်ပါက ၆:၀၀ နာရီ) ထီပေါက်စဉ် မထွက်မီအထိသာ ပြင်ဆင်ခွင့်ရှိပါသည်။ ပြင်ဆင်မှု မှတ်တမ်းအား စနစ်မှ တိကျစွာ မှတ်တမ်းတင်ထားပါမည်။
              </p>
            </div>

            {/* Error Message */}
            {editError && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>ပြောင်းလဲမည့် 4D နံပါတ်အသစ် (New 4D Number)</span>
                  <span className="text-[10px] text-blue-400 font-mono">4 DIGITS</span>
                </label>
                <input
                  type="text"
                  maxLength={4}
                  required
                  autoFocus
                  inputMode="numeric"
                  value={newNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setNewNumber(val);
                  }}
                  placeholder="e.g. 9425"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xl font-mono font-bold text-center text-white tracking-widest focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  ပြင်ဆင်ရသည့် အကြောင်းပြချက် (Reason / Note - Optional)
                </label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="e.g. Player requested correction before draw"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => { setEditingBet(null); setEditError(''); }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  မလုပ်တော့ပါ (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit || newNumber.length !== 4}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingEdit ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>သိမ်းဆည်းနေပါသည်...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>ဂဏန်း အတည်ပြု ပြောင်းလဲမည်</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Audit Trail Logs Modal */}
      {viewingAuditLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0d1322] border border-cyan-500/40 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setViewingAuditLogs(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-sans">
                  ပြင်ဆင်မှု မှတ်တမ်း (Bet Modification Audit Log)
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  Ticket #{viewingAuditLogs.voucher_code || viewingAuditLogs.voucher || viewingAuditLogs.slip_code}
                </p>
              </div>
            </div>

            {/* List of modifications */}
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {(!viewingAuditLogs.edit_history || viewingAuditLogs.edit_history.length === 0) ? (
                <p className="text-xs text-slate-400 py-6 text-center">ပြင်ဆင်ထားသော မှတ်တမ်း မရှိသေးပါခင်ဗျာ။</p>
              ) : (
                viewingAuditLogs.edit_history.map((log, lIdx) => (
                  <div key={lIdx} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-400" />
                        Admin: <strong className="text-blue-300">{log.admin_name}</strong>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {log.changed_at}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-slate-400">ဂဏန်းပြောင်းလဲမှု:</span>
                      <span className="font-mono font-bold text-rose-400 line-through bg-slate-950 px-2 py-0.5 rounded border border-rose-500/20">
                        {log.old_number}
                      </span>
                      <span className="text-slate-500 font-bold">→</span>
                      <span className="font-mono font-black text-emerald-400 bg-slate-950 px-2 py-0.5 rounded border border-emerald-500/30">
                        {log.new_number}
                      </span>
                    </div>

                    {log.note && (
                      <p className="text-[11px] text-slate-400 italic pt-0.5">
                        အကြောင်းပြချက်: "{log.note}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setViewingAuditLogs(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
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
