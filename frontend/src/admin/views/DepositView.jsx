import React, { useState, useEffect } from 'react';
import { 
  ArrowDownLeft, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  ShieldCheck, 
  FileText, 
  Eye, 
  Coins, 
  Sparkles,
  ExternalLink,
  ChevronRight,
  Filter,
  Undo2,
  AlertOctagon,
  RotateCcw
} from 'lucide-react';
import { apiClient } from '../../api/client';

export default function DepositView({ onNotify }) {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal for slip & audit details
  const [selectedTx, setSelectedTx] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewNote, setReviewNote] = useState('');

  // Modal for reverting auto-approved / completed deposit
  const [revertTx, setRevertTx] = useState(null);
  const [revertReason, setRevertReason] = useState('');
  const [reverting, setReverting] = useState(false);

  // Modal for restoring/un-reverting a reverted deposit
  const [restoreTx, setRestoreTx] = useState(null);
  const [restoreReason, setRestoreReason] = useState('');
  const [restoring, setRestoring] = useState(false);

  const handleConfirmRevert = async (e) => {
    e.preventDefault();
    if (!revertTx || !revertReason.trim()) return;
    try {
      setReverting(true);
      await apiClient.revertAdminDeposit(revertTx.id, revertReason.trim());
      if (onNotify) {
        onNotify(`Deposit #${revertTx.transaction_id || revertTx.id} reverted successfully! Ks ${(revertTx.amount || 0).toLocaleString()} deducted from player wallet.`, 'success');
      }
      setRevertTx(null);
      setRevertReason('');
      setSelectedTx(null);
      loadDeposits();
    } catch (err) {
      console.error('Failed to revert deposit:', err);
      if (onNotify) onNotify(err.message || 'Failed to revert deposit', 'error');
    } finally {
      setReverting(false);
    }
  };

  const handleConfirmRestore = async (e) => {
    e.preventDefault();
    if (!restoreTx || !restoreReason.trim()) return;
    try {
      setRestoring(true);
      await apiClient.restoreAdminDeposit(restoreTx.id, restoreReason.trim());
      if (onNotify) {
        onNotify(`Deposit #${restoreTx.transaction_id || restoreTx.id} restored successfully! +Ks ${(restoreTx.amount || 0).toLocaleString()} credited back to player wallet.`, 'success');
      }
      setRestoreTx(null);
      setRestoreReason('');
      setSelectedTx(null);
      loadDeposits();
    } catch (err) {
      console.error('Failed to restore deposit:', err);
      if (onNotify) onNotify(err.message || 'Failed to restore deposit', 'error');
    } finally {
      setRestoring(false);
    }
  };

  useEffect(() => {
    loadDeposits();
  }, [statusFilter]);

  const loadDeposits = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }
      const res = await apiClient.getAdminTopUps(params);
      setDeposits(res || []);
    } catch (err) {
      console.error('Error loading deposits:', err);
      if (onNotify) onNotify(err.message || 'Failed to load deposits', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadDeposits();
  };

  const handleResolve = async (txId, action) => {
    try {
      setActionLoading(true);
      await apiClient.resolveAdminTransaction(txId, action, reviewNote || `Resolved by Admin (${action})`);
      if (onNotify) {
        onNotify(`Deposit #${txId} successfully ${action === 'approve' ? 'Approved & Credited' : 'Rejected'}!`, 'success');
      }
      setSelectedTx(null);
      setReviewNote('');
      loadDeposits();
    } catch (err) {
      console.error('Failed to resolve transaction:', err);
      if (onNotify) onNotify(err.message || 'Action failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Metrics
  const totalAmount = deposits.reduce((sum, d) => sum + (d.amount || 0), 0);
  const autoApprovedCount = deposits.filter(d => d.status === 'AUTO_APPROVED').length;
  const manualCount = deposits.filter(d => ['MANUAL_REVIEW', 'FLAGGED_EXPIRED'].includes(d.status)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 font-serif">
            <span className="text-emerald-400">📥</span>
            <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-amber-300 bg-clip-text text-transparent">
              Deposit & Top-Up Requests (KPay, WavePay, AYA Pay)
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            🛡️ 100% Manual Review Enforcement: All deposit requests require Admin bank app verification to eliminate AI-edited/fake slip risks.
          </p>
        </div>

        <button
          onClick={loadDeposits}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy-900 border border-gold-500/30 hover:border-gold-400 text-gold-300 text-xs font-bold transition-all cursor-pointer shadow-md"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-gold-400' : ''}`} />
          <span>Refresh Deposits</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-navy-900 via-navy-900 to-navy-950 border border-gold-500/25 shadow-xl">
          <p className="text-[11px] uppercase font-bold tracking-wider text-slate-400">Total Deposits Volume</p>
          <h3 className="text-2xl font-black text-emerald-400 font-mono mt-1">
            Ks {totalAmount.toLocaleString()}
          </h3>
          <span className="text-[11px] text-slate-400 mt-2 block font-medium">
            {deposits.length} total deposit requests logged
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-navy-900 via-navy-900 to-navy-950 border border-emerald-500/30 shadow-xl gold-border-glow">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase font-bold tracking-wider text-emerald-300">Approved & Credited</p>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
              Verified
            </span>
          </div>
          <h3 className="text-2xl font-black text-white font-mono mt-1">
            {deposits.filter(d => ['COMPLETED', 'AUTO_APPROVED'].includes(d.status)).length} <span className="text-sm font-sans text-emerald-400 font-semibold">Transactions</span>
          </h3>
          <span className="text-[11px] text-slate-400 mt-2 block">
            Approved by Admin & credited to wallet
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-navy-900 via-navy-900 to-navy-950 border border-gold-500/25 shadow-xl">
          <p className="text-[11px] uppercase font-bold tracking-wider text-amber-300">Pending Review / Expired</p>
          <h3 className="text-2xl font-black text-amber-400 font-mono mt-1">
            {manualCount} <span className="text-sm font-sans text-slate-400 font-semibold">Requests</span>
          </h3>
          <span className="text-[11px] text-slate-400 mt-2 block">
            Requires admin slip verification or resolution
          </span>
        </div>
      </div>

      {/* Filter Tabs and Search Form */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-navy-900/90 border border-gold-500/20 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {[
            { id: 'MANUAL_REVIEW', label: '⏳ Pending Review' },
            { id: 'ALL', label: 'All Deposits' },
            { id: 'COMPLETED', label: '✅ Completed (Approved)' },
            { id: 'FLAGGED_EXPIRED', label: '⚠️ Flagged Expired' },
            { id: 'REJECTED', label: '❌ Rejected' },
            { id: 'REVERTED', label: '↩️ Reverted (ပြန်ဖျက်ထား)' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-gradient-to-r from-gold-500 to-amber-500 text-navy-950 font-black shadow-md'
                  : 'bg-navy-800/80 text-slate-300 hover:bg-navy-750 border border-gold-500/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search phone, name, Tx ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-navy-950 border border-gold-500/20 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold-400"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-xl bg-navy-800 hover:bg-navy-750 text-gold-300 text-xs font-bold border border-gold-500/20"
          >
            Search
          </button>
        </form>
      </div>

      {/* Deposits Table */}
      <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-gold-500/20">
              <tr>
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-4">Gateway</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Receiver Account</th>
                <th className="py-3 px-4 text-right">Time (MMT)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800 text-slate-300 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin text-gold-400 inline-block mr-2" />
                    Loading deposits...
                  </td>
                </tr>
              ) : deposits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                    No deposit requests found.
                  </td>
                </tr>
              ) : (
                deposits.map((tx) => (
                  <tr key={tx.id} className="hover:bg-navy-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-gold-400 tracking-wider">
                      {tx.transaction_id || `TXN-${tx.id}`}
                    </td>

                    <td className="py-3 px-4 font-sans">
                      <span className="font-bold text-white block">{tx.user_phone}</span>
                      <span className="text-[11px] text-slate-400">{tx.user_name}</span>
                    </td>

                    <td className="py-3 px-4 font-sans font-bold">
                      <span className={`px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1 ${
                        tx.gateway === 'KPAY' 
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : tx.gateway === 'WAVEPAY'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}>
                        {tx.gateway}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-black text-emerald-400">
                      +Ks {(tx.amount || 0).toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-slate-300 font-sans text-xs">
                      {tx.receiver_id || 'SG4D Official KPay'}
                    </td>

                    <td className="py-3 px-4 text-right text-slate-400 text-[11px] font-sans">
                      {tx.transferred_at_mmt || tx.created_at || '-'}
                    </td>

                    <td className="py-3 px-4 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${
                        tx.status === 'AUTO_APPROVED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : tx.status === 'COMPLETED'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : tx.status === 'MANUAL_REVIEW'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : tx.status === 'FLAGGED_EXPIRED'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : tx.status === 'REVERTED'
                          ? 'bg-rose-950/80 text-rose-300 border border-rose-500/40 font-bold'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {tx.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedTx(tx)}
                          className="px-2.5 py-1 rounded-lg bg-navy-800 hover:bg-navy-750 text-gold-300 hover:text-white border border-gold-500/20 text-[11px] font-semibold transition-all inline-flex items-center gap-1 cursor-pointer"
                          title="View Slip & Verification Details"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>

                        {(tx.status === 'AUTO_APPROVED' || tx.status === 'COMPLETED') && (
                          <button
                            onClick={() => {
                              setRevertTx(tx);
                              setRevertReason('');
                            }}
                            className="px-2 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-[11px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                            title="Revert deposit & deduct credited balance"
                          >
                            <Undo2 className="w-3 h-3" />
                            <span>Revert</span>
                          </button>
                        )}

                        {tx.status === 'REVERTED' && (
                          <button
                            onClick={() => {
                              setRestoreTx(tx);
                              setRestoreReason('');
                            }}
                            className="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-[11px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                            title="Undo Revert / Re-credit player balance"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Undo Revert</span>
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
      </div>

      {/* Slip & Verification Audit Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-navy-900 border border-gold-500/30 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-navy-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-gold-400" />
                <h3 className="text-base font-bold text-white font-serif">
                  Deposit Transaction Audit #{selectedTx.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="text-slate-400 hover:text-white text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-navy-950 p-3 rounded-xl border border-gold-500/15">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Player</span>
                  <span className="font-bold text-white text-sm">{selectedTx.user_phone}</span>
                  <span className="text-slate-400 block text-[11px]">{selectedTx.user_name}</span>
                </div>

                <div className="bg-navy-950 p-3 rounded-xl border border-gold-500/15">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Deposit Amount</span>
                  <span className="font-black text-emerald-400 text-base font-mono">
                    Ks {(selectedTx.amount || 0).toLocaleString()}
                  </span>
                  <span className="text-slate-400 block text-[11px] uppercase font-bold">{selectedTx.gateway}</span>
                </div>
              </div>

              <div className="bg-navy-950 p-3.5 rounded-xl border border-gold-500/15 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Transaction ID:</span>
                  <span className="font-bold text-gold-300 font-mono">{selectedTx.transaction_id || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Receiver Account:</span>
                  <span className="text-white font-medium">{selectedTx.receiver_id || 'Official Agent'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Transferred At (MMT):</span>
                  <span className="text-slate-200">{selectedTx.transferred_at_mmt || selectedTx.created_at || '-'}</span>
                </div>
                {selectedTx.delta_minutes !== undefined && selectedTx.delta_minutes !== null && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Elapsed Time:</span>
                    <span className={`font-bold font-mono ${selectedTx.delta_minutes <= 15 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {Number(selectedTx.delta_minutes).toFixed(1)} mins (Window: 15 mins)
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Current Status:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-navy-800 text-gold-400 border border-gold-500/30">
                    {selectedTx.status}
                  </span>
                </div>
              </div>

              {/* Audit Verification Log */}
              {selectedTx.verification_notes && (
                <div className="p-3 rounded-xl bg-navy-950 border border-gold-500/15 text-[11px] text-slate-300">
                  <span className="text-gold-400 font-bold block mb-1">System Verification Notes:</span>
                  <p className="leading-relaxed text-slate-400">{selectedTx.verification_notes}</p>
                </div>
              )}

              {/* Slip Preview if present */}
              {selectedTx.slip_image_url && (
                <div className="p-3 rounded-xl bg-navy-950 border border-gold-500/15 text-center">
                  <span className="text-slate-400 text-[11px] block mb-2 font-semibold">Payment Slip Receipt</span>
                  <img 
                    src={selectedTx.slip_image_url} 
                    alt="Deposit Slip" 
                    className="max-h-48 mx-auto rounded-lg border border-gold-500/20 object-contain shadow-md"
                  />
                </div>
              )}

              {/* Actions for manual review or flagged */}
              {['MANUAL_REVIEW', 'FLAGGED_EXPIRED'].includes(selectedTx.status) && (
                <div className="pt-2 space-y-3">
                  <input
                    type="text"
                    placeholder="Admin review note (optional)..."
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold-400"
                  />

                  <div className="flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleResolve(selectedTx.id, 'reject')}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading ? 'Processing...' : 'Reject Deposit'}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleResolve(selectedTx.id, 'approve')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading ? 'Processing...' : 'Approve & Credit Wallet'}
                    </button>
                  </div>
                </div>
              )}
              {/* Revert option inside Inspect Modal for AUTO_APPROVED or COMPLETED */}
              {['AUTO_APPROVED', 'COMPLETED'].includes(selectedTx.status) && (
                <div className="pt-2 border-t border-navy-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400">
                    အမှားပါခဲ့ပါက Auto-Approved deposit အား ပြန်လည်ဖျက်သိမ်းနိုင်သည်-
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRevertTx(selectedTx);
                      setRevertReason('');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Revert Deposit & Deduct</span>
                  </button>
                </div>
              )}
              {/* Restore / Undo Revert option inside Inspect Modal for REVERTED */}
              {selectedTx.status === 'REVERTED' && (
                <div className="pt-2 border-t border-navy-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <span className="text-[11px] text-amber-300/90">
                    Revert လုပ်ခဲ့မှု မှားယွင်းပါက မူလအတိုင်း ငွေပြန်ထည့်ပေးနိုင်သည်-
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRestoreTx(selectedTx);
                      setRestoreReason('');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Undo Revert & Restore Balance</span>
                  </button>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end border-t border-navy-800">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-4 py-1.5 rounded-xl bg-navy-800 hover:bg-navy-750 text-slate-300 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revert Deposit Confirmation Modal */}
      {revertTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-navy-900 border-2 border-rose-500/50 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 relative">
            <button
              onClick={() => {
                if (!reverting) {
                  setRevertTx(null);
                  setRevertReason('');
                }
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-navy-800 text-xl font-bold cursor-pointer"
            >
              &times;
            </button>

            {/* Header */}
            <div className="flex items-start gap-3 border-b border-rose-500/20 pb-3">
              <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400 flex-shrink-0">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-serif">
                  Revert Deposit Transaction #{revertTx.id}
                </h3>
                <p className="text-xs text-rose-300 font-semibold mt-0.5">
                  Deposit ကို ပြန်လည်ဖျက်သိမ်းပြီး Player Balance ထဲမှ ပြန်နှုတ်မည်
                </p>
              </div>
            </div>

            {/* Warning Callout Box */}
            <div className="bg-rose-950/40 border border-rose-500/30 p-3.5 rounded-xl space-y-2 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Player:</span>
                <span className="font-bold text-white">{revertTx.user_name} ({revertTx.user_phone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Reverting Amount:</span>
                <span className="font-mono font-black text-rose-400 text-sm">
                  -Ks {(revertTx.amount || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Transaction ID:</span>
                <span className="font-mono text-gold-400 font-bold">{revertTx.transaction_id || '-'}</span>
              </div>
              <div className="pt-1.5 border-t border-rose-500/20 text-[11px] text-rose-200/90 leading-relaxed">
                ⚠️ <strong>သတိပြုရန်:</strong> Confirm နှိပ်လိုက်ပါက ဤ Deposit Status သည် <span className="underline font-bold text-white">REVERTED</span> သို့ ချက်ချင်းပြောင်းလဲသွားမည်ဖြစ်ပြီး ကစားသမား၏ လက်ကျန်ငွေထဲမှ <strong className="text-rose-400">Ks {(revertTx.amount || 0).toLocaleString()}</strong> အား တိုက်ရိုက်ပြန်နှုတ် (Deduct) ပေးပါမည်။ Financial Ledger စာရင်းတွင်လည်း Audit မှတ်တမ်းအဖြစ် သိမ်းဆည်းပေးမည် ဖြစ်ပါသည်။
              </div>
            </div>

            {/* Form for reason */}
            <form onSubmit={handleConfirmRevert} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  Revert လုပ်ရသည့် အကြောင်းရင်း / Remark <span className="text-rose-400">*</span>:
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="ဥပမာ- မှားယွင်းသော ငွေလွှဲပြေစာ / Slip အတုဖြစ်နေခြင်း / ငွေသွင်း Transaction ထပ်နေခြင်း..."
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400"
                />

                {/* Quick suggestion pills */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-400">အကြံပြုချက်:</span>
                  {[
                    'မှားယွင်းသော ငွေလွှဲပြေစာ',
                    'ငွေသွင်း Transaction ID ထပ်နေခြင်း',
                    'Invalid Bank Slip ID',
                    'Customer Request Cancellation'
                  ].map((sug) => (
                    <button
                      type="button"
                      key={sug}
                      onClick={() => setRevertReason(sug)}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-navy-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-gold-500/10 transition-colors cursor-pointer"
                    >
                      +{sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gold-500/20">
                <button
                  type="button"
                  disabled={reverting}
                  onClick={() => {
                    setRevertTx(null);
                    setRevertReason('');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-navy-800 transition-colors cursor-pointer"
                >
                  Cancel / မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  disabled={reverting || !revertReason.trim()}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-950 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <Undo2 className={`w-4 h-4 ${reverting ? 'animate-spin' : ''}`} />
                  <span>{reverting ? 'Reverting & Deducting...' : 'Confirm Revert & Deduct Balance'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Undo Revert / Restore Deposit Confirmation Modal */}
      {restoreTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-navy-900 border-2 border-emerald-500/50 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 relative">
            <button
              onClick={() => {
                if (!restoring) {
                  setRestoreTx(null);
                  setRestoreReason('');
                }
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-navy-800 text-xl font-bold cursor-pointer"
            >
              &times;
            </button>

            {/* Header */}
            <div className="flex items-start gap-3 border-b border-emerald-500/20 pb-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-serif">
                  Undo Revert / Restore Deposit #{restoreTx.id}
                </h3>
                <p className="text-xs text-emerald-300 font-semibold mt-0.5">
                  Revert ပြုလုပ်ထားမှုကို ပယ်ဖျက်ပြီး Player Balance ထဲသို့ ငွေပြန်ထည့်မည်
                </p>
              </div>
            </div>

            {/* Warning / Details Callout Box */}
            <div className="bg-emerald-950/40 border border-emerald-500/30 p-3.5 rounded-xl space-y-2 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Player:</span>
                <span className="font-bold text-white">{restoreTx.user_name} ({restoreTx.user_phone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Crediting Back Amount:</span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  +Ks {(restoreTx.amount || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Transaction ID:</span>
                <span className="font-mono text-gold-400 font-bold">{restoreTx.transaction_id || '-'}</span>
              </div>
              <div className="pt-1.5 border-t border-emerald-500/20 text-[11px] text-emerald-200/90 leading-relaxed">
                ℹ️ <strong>စနစ်လုပ်ဆောင်ချက်:</strong> Confirm နှိပ်လိုက်ပါက ဤ Deposit Status သည် <span className="underline font-bold text-white">COMPLETED</span> သို့ ပြန်ပြောင်းသွားမည်ဖြစ်ပြီး ကစားသမား၏ လက်ကျန်ငွေထဲသို့ <strong className="text-emerald-400">+Ks {(restoreTx.amount || 0).toLocaleString()}</strong> အား ပြန်လည်ပေါင်းထည့် (Re-credit) ပေးပါမည်။ Financial Ledger တွင်လည်း <span className="text-gold-300 font-mono">DEPOSIT_RESTORE</span> Audit မှတ်တမ်းအဖြစ် ထည့်သွင်းပေးမည် ဖြစ်ပါသည်။
              </div>
            </div>

            {/* Form for reason */}
            <form onSubmit={handleConfirmRestore} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  ပြန်လည်အတည်ပြုရသည့် အကြောင်းရင်း (Reason / Remark) <span className="text-emerald-400">*</span>:
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="ဥပမာ- Revert မှားယွင်းစွာ နှိပ်မိခြင်း / ငွေလွှဲပြေစာ အမှန်တကယ် မှန်ကန်နေခြင်း..."
                  value={restoreReason}
                  onChange={(e) => setRestoreReason(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                />

                {/* Quick suggestion pills */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-400">အကြံပြုချက်:</span>
                  {[
                    'Revert မှားယွင်းစွာ နှိပ်မိခြင်း',
                    'ငွေလွှဲပြေစာ အမှန်တကယ် မှန်ကန်နေခြင်း',
                    'ဘဏ်စစ်ဆေးပြီး အတည်ပြုပြီး',
                    'Player Request Resolved'
                  ].map((sug) => (
                    <button
                      type="button"
                      key={sug}
                      onClick={() => setRestoreReason(sug)}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-navy-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-gold-500/10 transition-colors cursor-pointer"
                    >
                      +{sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gold-500/20">
                <button
                  type="button"
                  disabled={restoring}
                  onClick={() => {
                    setRestoreTx(null);
                    setRestoreReason('');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-navy-800 transition-colors cursor-pointer"
                >
                  Cancel / မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  disabled={restoring || !restoreReason.trim()}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-950 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <RotateCcw className={`w-4 h-4 ${restoring ? 'animate-spin' : ''}`} />
                  <span>{restoring ? 'Restoring & Re-crediting...' : 'Confirm Restore & Credit Balance'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
