import React, { useState, useEffect } from 'react';
import { 
  ArrowUpRight, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RotateCcw, 
  Search, 
  ShieldCheck, 
  CreditCard,
  RefreshCw,
  AlertTriangle,
  User,
  Wallet,
  Smartphone,
  Eye,
  Check,
  X
} from 'lucide-react';
import { apiClient } from '../../api/client';

export default function WithdrawView({ onNotify }) {
  const [activeTab, setActiveTab] = useState('PENDING'); // 'PENDING' | 'SUCCESS' | 'REJECTED' | 'ALL'
  const [withdrawals, setWithdrawals] = useState([]);
  const [stats, setStats] = useState({
    pending_count: 0,
    pending_amount: 0,
    success_count: 0,
    success_amount: 0,
    rejected_count: 0,
    rejected_amount: 0,
    total_count: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchPhone, setSearchPhone] = useState('');

  // Selected withdrawal for Detail / Action Modal
  const [selectedItem, setSelectedItem] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [txRef, setTxRef] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadWithdrawals();
  }, [activeTab]);

  const loadWithdrawals = async () => {
    try {
      setLoading(true);
      const params = {};
      if (activeTab !== 'ALL') {
        params.status = activeTab;
      }
      if (searchPhone.trim()) {
        params.phone = searchPhone.trim();
      }

      const res = await apiClient.getAdminWithdrawals(params);
      const list = res.results || res.withdrawals || (Array.isArray(res) ? res : []);
      setWithdrawals(list);
      if (res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error('Error loading withdrawals:', err);
      if (onNotify) onNotify(err.message || 'Failed to load withdrawals', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadWithdrawals();
  };

  const handleAccept = async () => {
    if (!selectedItem) return;
    try {
      setSubmitting(true);
      await apiClient.acceptAdminWithdrawal(selectedItem.id, {
        reference: txRef || `TXN-${Date.now().toString().slice(-6)}`,
        note: actionReason || 'Approved by Admin'
      });
      if (onNotify) onNotify(`Withdrawal #${selectedItem.id} for ${selectedItem.nick_name || selectedItem.user} marked as Accepted!`, 'success');
      setSelectedItem(null);
      loadWithdrawals();
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Accept failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedItem) return;
    if (!actionReason.trim()) {
      alert('Please enter a rejection reason (e.g. Invalid account name or phone number)');
      return;
    }
    try {
      setSubmitting(true);
      await apiClient.rejectAdminWithdrawal(selectedItem.id, actionReason);
      if (onNotify) onNotify(`Withdrawal #${selectedItem.id} rejected and funds auto-refunded to user wallet!`, 'success');
      setSelectedItem(null);
      loadWithdrawals();
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Reject failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevert = async () => {
    if (!selectedItem) return;
    if (!window.confirm(`Are you sure you want to REVERT withdrawal #${selectedItem.id} back to Pending?`)) return;
    try {
      setSubmitting(true);
      await apiClient.revertAdminWithdrawal(selectedItem.id);
      if (onNotify) onNotify(`Withdrawal #${selectedItem.id} reverted back to Pending!`, 'success');
      setSelectedItem(null);
      loadWithdrawals();
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Revert failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 3 KPI Summary Cards Matching Legacy Theme */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Pending Requests KPI */}
        <div className="bg-navy-900/90 border border-amber-500/30 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-extrabold text-amber-400 tracking-wider">
              Pending Requests
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white">
              {stats.pending_count}
            </span>
            <span className="text-xs text-slate-400">requests</span>
          </div>
          <div className="mt-1 text-xs font-mono font-bold text-amber-400/90">
            Ks {stats.pending_amount.toLocaleString()}
          </div>
        </div>

        {/* Settled / Completed KPI */}
        <div className="bg-navy-900/90 border border-emerald-500/30 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-extrabold text-emerald-400 tracking-wider">
              Settled (Success)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white">
              {stats.success_count}
            </span>
            <span className="text-xs text-slate-400">completed</span>
          </div>
          <div className="mt-1 text-xs font-mono font-bold text-emerald-400/90">
            Ks {stats.success_amount.toLocaleString()}
          </div>
        </div>

        {/* Rejected / Refunded KPI */}
        <div className="bg-navy-900/90 border border-rose-500/30 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-extrabold text-rose-400 tracking-wider">
              Rejected / Refunded
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <XCircle className="w-4 h-4 text-rose-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white">
              {stats.rejected_count}
            </span>
            <span className="text-xs text-slate-400">requests</span>
          </div>
          <div className="mt-1 text-xs font-mono font-bold text-rose-400/90">
            Ks {stats.rejected_amount.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-navy-900/90 border border-gold-500/20 p-4 rounded-2xl">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'PENDING'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'bg-navy-800 text-slate-400 hover:text-white'
            }`}
          >
            Pending ({stats.pending_count})
          </button>
          <button
            onClick={() => setActiveTab('SUCCESS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'SUCCESS'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                : 'bg-navy-800 text-slate-400 hover:text-white'
            }`}
          >
            Success ({stats.success_count})
          </button>
          <button
            onClick={() => setActiveTab('REJECTED')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'REJECTED'
                ? 'bg-rose-500 text-white font-black shadow-md'
                : 'bg-navy-800 text-slate-400 hover:text-white'
            }`}
          >
            Rejected ({stats.rejected_count})
          </button>
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-navy-700 text-gold-300 border border-gold-500/40 font-bold'
                : 'bg-navy-800 text-slate-400 hover:text-white'
            }`}
          >
            All History
          </button>
        </div>

        <div className="flex items-center gap-2">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search phone number..."
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                className="bg-navy-950 border border-gold-500/20 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-gold-400 font-mono w-44 sm:w-56"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-xl bg-navy-800 hover:bg-navy-750 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              Search
            </button>
          </form>

          <button
            onClick={loadWithdrawals}
            title="Refresh"
            className="p-2 rounded-xl bg-navy-800 hover:bg-navy-750 text-gold-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Withdrawals Table */}
      <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-gold-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="w-5 h-5 text-gold-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-serif">
              {activeTab === 'PENDING'
                ? 'Pending Withdrawals Audit'
                : activeTab === 'SUCCESS'
                ? 'Settled Cash-Out History'
                : activeTab === 'REJECTED'
                ? 'Rejected & Refunded Requests'
                : 'All Withdrawal Transactions'}
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {withdrawals.length} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950/80 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20">
              <tr>
                <th className="py-3 px-4">No / ID</th>
                <th className="py-3 px-4">Time (MMT)</th>
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4">Receiver Account</th>
                <th className="py-3 px-4 text-right">Balance</th>
                <th className="py-3 px-4 text-right">Withdraw Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gold-400 mb-2" />
                    Loading withdrawal records...
                  </td>
                </tr>
              ) : withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    No {activeTab !== 'ALL' ? activeTab.toLowerCase() : ''} withdrawals found.
                  </td>
                </tr>
              ) : (
                withdrawals.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-navy-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-gold-400">
                      #{item.id}
                    </td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                      {item.created_at || '-'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {item.nick_name || item.nickname || item.payment_info || 'Player'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {item.phone || item.user || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                        (item.payment_method || '').toUpperCase().includes('KPAY')
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          : (item.payment_method || '').toUpperCase().includes('WAVE')
                          ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {item.payment_method || 'KPAY'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-200">
                      {item.account_name || item.account_number || item.user}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">
                      Ks {(item.current_balance || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-400 text-sm">
                      -{(item.amount || 0).toLocaleString()} MMK
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.status === 'Success' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          SUCCESS
                        </span>
                      ) : item.status === 'Rejected' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          REJECTED
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-gold-300 border border-amber-500/30 animate-pulse">
                          PENDING
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedItem(item);
                          setActionReason('');
                          setTxRef('');
                        }}
                        className="px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-gold-400 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Withdrawal Inspection & Action Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-navy-900 border border-gold-500/40 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gold-500/20 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gold-400" />
                <h3 className="text-base font-bold text-white font-serif">
                  Withdrawal Review #{selectedItem.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Audit Details */}
            <div className="space-y-2.5 text-xs bg-navy-950 p-4 rounded-xl border border-gold-500/15">
              <div className="flex justify-between py-1 border-b border-navy-800">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-gold-400" /> Player:
                </span>
                <span className="font-semibold text-white">
                  {selectedItem.nick_name || selectedItem.nickname || selectedItem.payment_info} ({selectedItem.phone || selectedItem.user})
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-navy-800">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-gold-400" /> Current Player Balance:
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  Ks {(selectedItem.current_balance || 0).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-navy-800">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" /> Requested Cash-Out:
                </span>
                <span className="font-mono font-black text-rose-400 text-sm">
                  {(selectedItem.amount || 0).toLocaleString()} MMK
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-navy-800">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-gold-400" /> Payment Provider:
                </span>
                <span className="font-bold text-gold-300">
                  {selectedItem.payment_method || 'KPAY'}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-navy-800">
                <span className="text-slate-400">Transfer To Account / Phone:</span>
                <span className="font-mono font-bold text-white text-xs bg-navy-800 px-2 py-0.5 rounded">
                  {selectedItem.account_name || selectedItem.account_number || selectedItem.user}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-navy-800">
                <span className="text-slate-400">Submitted Time:</span>
                <span className="font-mono text-slate-300">{selectedItem.created_at || '-'}</span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-slate-400">Current Status:</span>
                <span className={`font-extrabold ${
                  selectedItem.status === 'Success' ? 'text-emerald-400' : selectedItem.status === 'Rejected' ? 'text-rose-400' : 'text-amber-400'
                }`}>
                  {selectedItem.status}
                </span>
              </div>

              {selectedItem.verification_notes && (
                <div className="pt-2 text-[11px] text-slate-400 border-t border-navy-800">
                  <span className="font-bold text-slate-300">Verification Notes: </span>
                  {selectedItem.verification_notes}
                </div>
              )}
            </div>

            {/* If pending: Show Action Form */}
            {selectedItem.status === 'Pending' && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Transfer Transaction Reference (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. KPAY20261014-998822"
                    value={txRef}
                    onChange={(e) => setTxRef(e.target.value)}
                    className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold-400 font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Operator Note / Rejection Reason (Required if rejecting)
                    </label>
                    <span className="text-[10px] text-rose-400 font-bold">* Required for refund</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Enter approval note or rejection reason..."
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold-400"
                  />
                  {/* Quick Preset Reason Chips */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      'အကောင့်အမည် သို့မဟုတ် ဖုန်းနံပါတ် မှားယွင်းနေပါသည်',
                      'ငွေလွှဲလက်ခံမည့် Gateway အကောင့် ရှာမတွေ့ပါ',
                      'လက်ခံမည့်အကောင့် ကန့်သတ်ချက်ပြည့်နေ၍ လွှဲမရပါ'
                    ].map((reasonText) => (
                      <button
                        key={reasonText}
                        type="button"
                        onClick={() => setActionReason(reasonText)}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-navy-800 hover:bg-navy-750 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                      >
                        + {reasonText}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleReject}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-rose-950 disabled:opacity-50"
                  >
                    {submitting ? 'Processing...' : 'Reject & Auto-Refund'}
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleAccept}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold transition-all cursor-pointer shadow-lg shadow-emerald-950 disabled:opacity-50"
                  >
                    {submitting ? 'Processing...' : 'Accept & Settle'}
                  </button>
                </div>
              </div>
            )}

            {/* If Completed / Success: Allow Revert */}
            {selectedItem.status === 'Success' && (
              <div className="space-y-3 pt-2 border-t border-gold-500/20">
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>Approved & settled by {selectedItem.action_by || 'Admin'}.</span>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="flex-1 py-2 rounded-xl bg-navy-800 text-slate-300 text-xs font-semibold hover:bg-navy-750 cursor-pointer"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleRevert}
                    className="flex-1 py-2 rounded-xl bg-navy-800 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Revert to Pending</span>
                  </button>
                </div>
              </div>
            )}

            {/* If Rejected: Allow Revert to re-examine */}
            {selectedItem.status === 'Rejected' && (
              <div className="space-y-3 pt-2 border-t border-gold-500/20">
                <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>Rejected and refunded. Reason: {selectedItem.verification_notes || 'Invalid details'}</span>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="flex-1 py-2 rounded-xl bg-navy-800 text-slate-300 text-xs font-semibold hover:bg-navy-750 cursor-pointer"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleRevert}
                    className="flex-1 py-2 rounded-xl bg-navy-800 hover:bg-amber-900/60 text-gold-300 border border-gold-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Re-open / Revert to Pending</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
