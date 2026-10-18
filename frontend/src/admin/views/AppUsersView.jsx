import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Wallet, 
  Award, 
  Edit3, 
  ShieldCheck, 
  Coins, 
  UserCheck,
  UserX,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  DollarSign,
  AlertTriangle,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { apiClient } from '../../api/client';

export default function AppUsersView({ onNotify }) {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    total_real_players: 0,
    total_wallet_balance: 0,
    active_players_count: 0,
    suspended_players_count: 0
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Balance Adjustment Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustTargetUser, setAdjustTargetUser] = useState(null);
  const [adjustType, setAdjustType] = useState('TOPUP'); // 'TOPUP' | 'DEDUCT'
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('Manual Admin Customer Support Adjustment');
  const [submitting, setSubmitting] = useState(false);

  // Edit Player Profile Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTargetUser, setEditTargetUser] = useState(null);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    loadAppUsers();
  }, []);

  const loadAppUsers = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getAdminAppUsers();
      const list = res.results || res.users || (Array.isArray(res) ? res : []);
      setUsers(list);
      if (res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error('Error loading app users:', err);
      if (onNotify) onNotify(err.message || 'Failed to load app players', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSuspend = async (user) => {
    const actionName = user.is_suspended ? 'Unblock / Activate' : 'Block / Suspend';
    if (!window.confirm(`Are you sure you want to ${actionName} player ${user.nickname || user.phone}?`)) return;
    try {
      const res = await apiClient.toggleAdminAppUserStatus(user.id);
      if (onNotify) onNotify(`Player ${user.nickname || user.phone} is now ${res.is_suspended ? 'Blocked' : 'Active'}`, 'success');
      loadAppUsers();
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Failed to toggle player status', 'error');
    }
  };

  const handleOpenAdjustModal = (user) => {
    setAdjustTargetUser(user);
    setAdjustType('TOPUP');
    setAdjustAmount('');
    setAdjustReason('Manual Admin Support Adjustment');
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustTargetUser) return;
    const numAmount = parseFloat(adjustAmount);
    if (!numAmount || numAmount <= 0) {
      alert('Please enter a valid positive adjustment amount.');
      return;
    }

    const finalAmount = adjustType === 'TOPUP' ? numAmount : -numAmount;

    try {
      setSubmitting(true);
      await apiClient.adjustAdminAppUserBalance(adjustTargetUser.id, {
        amount: finalAmount,
        reason: adjustReason.trim() || 'Admin manual balance adjustment'
      });
      if (onNotify) onNotify(`Successfully adjusted balance for ${adjustTargetUser.nickname || adjustTargetUser.phone} by ${finalAmount > 0 ? '+' : ''}${finalAmount.toLocaleString()} MMK!`, 'success');
      setIsAdjustModalOpen(false);
      loadAppUsers();
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Failed to adjust balance', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditModal = (user) => {
    setEditTargetUser(user);
    setEditFullName(user.full_name || '');
    setEditUsername(user.username || '');
    setEditPhone(user.phone || user.phone_number || '');
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!editTargetUser) return;
    if (!editFullName.trim() && !editUsername.trim()) {
      alert('Please provide either Full Name or Username.');
      return;
    }

    try {
      setEditSaving(true);
      await apiClient.updateAdminAppUserProfile(editTargetUser.id, {
        full_name: editFullName.trim(),
        username: editUsername.trim(),
        phone: editPhone.trim()
      });
      if (onNotify) {
        onNotify(`Successfully updated profile for Player #${editTargetUser.id}!`, 'success');
      }
      setIsEditModalOpen(false);
      loadAppUsers();
    } catch (err) {
      if (onNotify) {
        onNotify(err.message || 'Failed to update player profile', 'error');
      }
    } finally {
      setEditSaving(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const s = search.trim().toLowerCase();
    return (
      (u.phone && u.phone.includes(s)) ||
      (u.nickname && u.nickname.toLowerCase().includes(s)) ||
      (u.username && u.username.toLowerCase().includes(s)) ||
      (u.full_name && u.full_name.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      {/* Real Players Notice Banner */}
      <div className="bg-navy-900/90 border border-gold-500/25 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-serif">
              Real App Players Directory (ကစားသမားစစ်စစ်များ)
            </h3>
            <p className="text-xs text-slate-400">
              Strictly filtered to genuine mobile registered users (Fake bot profiles are kept separated under Simulated Profiles).
            </p>
          </div>
        </div>

        <button
          onClick={loadAppUsers}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-navy-800 hover:bg-navy-750 text-gold-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 3 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Real Players */}
        <div className="bg-navy-900/90 border border-gold-500/30 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-extrabold text-gold-400 tracking-wider">
              Real Mobile Players
            </span>
            <Users className="w-4 h-4 text-gold-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white">
              {stats.total_real_players}
            </span>
            <span className="text-xs text-slate-400">active accounts</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-400 font-bold">
            {stats.active_players_count} Active / {stats.suspended_players_count} Blocked
          </div>
        </div>

        {/* Total Player Balances */}
        <div className="bg-navy-900/90 border border-emerald-500/30 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-extrabold text-emerald-400 tracking-wider">
              Total Player Wallet Balance
            </span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-400">
              Ks {stats.total_wallet_balance.toLocaleString()}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Player funds held in system wallets
          </div>
        </div>

        {/* Highest Bet VIP Player */}
        <div className="bg-navy-900/90 border border-purple-500/30 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-extrabold text-purple-400 tracking-wider">
              Top Player (10,000 Bets)
            </span>
            <Award className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black font-mono text-white">
              0943105959
            </span>
          </div>
          <div className="mt-1 text-[11px] text-gold-300 font-mono font-bold">
            Balance: Ks 1,542,200 (10,001 Bets placed)
          </div>
        </div>
      </div>

      {/* Players Table Section */}
      <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-gold-500/20 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-serif">
              Registered App Players List
            </h3>
            <span className="text-xs text-gold-400 font-mono font-bold bg-navy-950 px-2 py-0.5 rounded border border-gold-500/20">
              {filteredUsers.length} Players
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search phone number or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-navy-950 border border-gold-500/20 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-gold-400 font-mono"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-navy-950/80 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20">
              <tr>
                <th className="py-3 px-4">No / ID</th>
                <th className="py-3 px-4">Player Profile</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4 text-right">Wallet Balance</th>
                <th className="py-3 px-4 text-center">VIP Level</th>
                <th className="py-3 px-4 text-center">Commission Link</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Joined Date</th>
                <th className="py-3 px-4 text-center">Wallet Action</th>
                <th className="py-3 px-4 text-center">Edit Profile</th>
                <th className="py-3 px-4 text-center">Status Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gold-400 mb-2" />
                    Loading genuine mobile players...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500 font-mono">
                    No matching real players found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, idx) => (
                  <tr key={u.id} className="hover:bg-navy-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-gold-400">
                      #{u.id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-amber-300 flex items-center justify-center text-slate-950 font-black text-xs shadow">
                          {((u.full_name || u.nickname || u.username || 'P')[0] || 'P').toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-white text-xs">{u.full_name || u.nickname || u.username}</p>
                            <button
                              onClick={() => handleOpenEditModal(u)}
                              className="text-amber-400 hover:text-amber-300 p-0.5 rounded hover:bg-amber-400/20 cursor-pointer"
                              title="Click to edit name"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-gold-300">
                      {u.phone || u.phone_number}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-400 text-sm">
                      Ks {u.balance.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-navy-800 border border-gold-500/30 text-[10px] font-bold text-gold-300">
                        {u.level || 'Level 1'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-gold-300 border border-amber-500/30">
                        AGT8899 (30%)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        u.is_suspended
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {u.is_suspended ? 'BLOCKED' : 'ACTIVE'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {u.created_at || 'Registered'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleOpenAdjustModal(u)}
                        className="px-3 py-1 rounded-lg bg-navy-800 hover:bg-gold-500/20 text-gold-300 border border-gold-500/30 text-xs font-bold transition-all flex items-center gap-1 mx-auto cursor-pointer"
                        title="Top-Up or Deduct Wallet Balance"
                      >
                        <Wallet className="w-3.5 h-3.5 text-gold-400" />
                        <span>Adjust Ks</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleOpenEditModal(u)}
                        className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/50 text-xs font-black transition-all flex items-center gap-1.5 mx-auto cursor-pointer shadow-sm hover:scale-105"
                        title="Edit Player Full Name & Username"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                        <span>✏️ Edit Name</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleSuspend(u)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 mx-auto cursor-pointer ${
                          u.is_suspended
                            ? 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40'
                            : 'bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40'
                        }`}
                      >
                        {u.is_suspended ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Unblock</span>
                          </>
                        ) : (
                          <>
                            <UserX className="w-3.5 h-3.5" />
                            <span>Block</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Balance Adjustment Modal (Top-Up & Deduction Tool) */}
      {isAdjustModalOpen && adjustTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-navy-900 border border-gold-500/30 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gold-500/20 pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-gold-400" />
                <h3 className="text-base font-bold text-white font-serif">
                  Manual Wallet Adjustment
                </h3>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Target Player Summary */}
            <div className="bg-navy-950 p-3.5 rounded-xl border border-gold-500/20 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Target Player:</span>
                <span className="font-bold text-white">{adjustTargetUser.nickname || adjustTargetUser.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Phone Number:</span>
                <span className="font-mono text-gold-300 font-bold">{adjustTargetUser.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Balance:</span>
                <span className="font-mono font-black text-emerald-400">Ks {adjustTargetUser.balance.toLocaleString()}</span>
              </div>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4">
              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Adjustment Operation
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('TOPUP')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      adjustType === 'TOPUP'
                        ? 'bg-emerald-600 text-white font-extrabold shadow-md'
                        : 'bg-navy-950 text-slate-400 border border-gold-500/20 hover:text-white'
                    }`}
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>+ Deposit / Top-Up</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('DEDUCT')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      adjustType === 'DEDUCT'
                        ? 'bg-rose-600 text-white font-extrabold shadow-md'
                        : 'bg-navy-950 text-slate-400 border border-gold-500/20 hover:text-white'
                    }`}
                  >
                    <MinusCircle className="w-4 h-4" />
                    <span>- Deduct / Penalty</span>
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Adjustment Amount (MMK)
                </label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  required
                  placeholder="e.g. 50000"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-gold-400"
                />
              </div>

              {/* Preview New Balance */}
              {adjustAmount && !isNaN(parseFloat(adjustAmount)) && (
                <div className="p-2.5 rounded-xl bg-navy-950 border border-gold-500/15 text-xs flex justify-between items-center">
                  <span className="text-slate-400">Projected New Balance:</span>
                  <span className="font-mono font-bold text-white">
                    Ks {Math.max(0, adjustTargetUser.balance + (adjustType === 'TOPUP' ? parseFloat(adjustAmount) : -parseFloat(adjustAmount))).toLocaleString()}
                  </span>
                </div>
              )}

              {/* Audit Reason Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Audit Reason (Logged to Financial Ledger)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Customer support recharge or dispute correction"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gold-500/20">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-navy-800 text-slate-300 text-xs font-semibold hover:bg-navy-750 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !adjustAmount}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg disabled:opacity-50 ${
                    adjustType === 'TOPUP'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950'
                      : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950'
                  }`}
                >
                  {submitting ? 'Executing...' : `Confirm ${adjustType === 'TOPUP' ? 'Top-Up' : 'Deduction'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Player Profile Modal */}
      {isEditModalOpen && editTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-navy-900 border border-gold-500/40 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gold-500/20 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-gold-400" />
                <h3 className="text-base font-bold text-white font-serif">
                  Edit Player Profile (ကစားသမား အချက်အလက် ပြင်ရန်)
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Target Player Info Banner */}
            <div className="bg-navy-950 p-3.5 rounded-xl border border-gold-500/20 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Player ID:</span>
                <span className="font-mono text-gold-400 font-bold">#{editTargetUser.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Phone:</span>
                <span className="font-mono text-gold-300 font-bold">{editTargetUser.phone || editTargetUser.phone_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Wallet Balance:</span>
                <span className="font-mono font-black text-emerald-400">Ks {editTargetUser.balance.toLocaleString()}</span>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name (နာမည်အပြည့်အစုံ)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Michael / ဦးစမ်းသပ်"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold-400"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  * ထွက်ဂဏန်းရလဒ်ဘုတ်နှင့် ပေါက်ဆုရှင်များစာရင်းတွင် ပြသမည့် အမည် (e.g. U T***, Mich***)
                </p>
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Username (အသုံးပြုသူအမည်)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-500 font-mono">@</span>
                  <input
                    type="text"
                    placeholder="e.g. michael94 / user123"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value.replace(/@/g, ''))}
                    className="w-full bg-navy-950 border border-gold-500/30 rounded-xl pl-7 pr-3 py-2 text-xs text-white focus:outline-none focus:border-gold-400 font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  * App Players စာရင်းတွင် login / profile identifier အဖြစ် ပြသမည့် အမည်
                </p>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Phone Number (ဖုန်းနံပါတ်)
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-xs text-gold-300 font-mono focus:outline-none focus:border-gold-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gold-500/20">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-navy-800 text-slate-300 text-xs font-semibold hover:bg-navy-750 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg cursor-pointer disabled:opacity-50"
                >
                  {editSaving ? 'Saving...' : 'Save Profile (သိမ်းဆည်းမည်)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
