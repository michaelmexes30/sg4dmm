import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Check, 
  X, 
  Edit3, 
  Search, 
  Lock, 
  Eye, 
  EyeOff,
  UserCheck,
  UserX,
  Award,
  History,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Shield,
  FileText
} from 'lucide-react';
import { apiClient } from '../../api/client';

const LEVEL_DEFAULTS = {
  1: { deposit: 100000, credit: 160000, turnover: 'Initial' },
  2: { deposit: 300000, credit: 480000, turnover: '2,000,000' },
  3: { deposit: 500000, credit: 800000, turnover: '5,000,000' },
  4: { deposit: 800000, credit: 1280000, turnover: '10,000,000' },
  5: { deposit: 1000000, credit: 1600000, turnover: '20,000,000' },
};

export default function SystemUsersView({ onNotify }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Form fields for Member Create/Edit
  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [agentCode, setAgentCode] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('CUSTOMER_SERVICE');
  const [isSuspended, setIsSuspended] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Manual Agent Level Up Modal State
  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [targetLevel, setTargetLevel] = useState(1);
  const [customDeposit, setCustomDeposit] = useState(100000);
  const [customCredit, setCustomCredit] = useState(300000);
  const [levelReason, setLevelReason] = useState('');
  const [levelSubmitting, setLevelSubmitting] = useState(false);

  // Level Up Audit Logs Modal State
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [levelLogs, setLevelLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilterAgentId, setLogFilterAgentId] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getAdminSystemUsers();
      setUsers(res || []);
    } catch (err) {
      console.error('Error loading system users:', err);
      if (onNotify) onNotify(err.message || 'Failed to load system users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setUsername('');
    setNickname('');
    setPhone('');
    setAgentCode('');
    setPassword('');
    setRole('CUSTOMER_SERVICE');
    setIsSuspended(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setUsername(user.username);
    setNickname(user.nickname || user.username);
    setPhone(user.phone || '');
    setAgentCode(user.agent_code || '');
    setPassword('');
    setRole(user.role);
    setIsSuspended(!!user.is_suspended);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingUser) {
        const payload = {
          nickname,
          role,
          is_suspended: isSuspended
        };
        if (password) payload.password = password;
        await apiClient.updateAdminSystemUser(editingUser.id, payload);
        if (onNotify) onNotify(`Updated user ${username} successfully!`, 'success');
      } else {
        if (!password) {
          alert('Password is required for new user');
          return;
        }
        const createPayload = {
          username: username.trim(),
          nickname: (nickname || username).trim(),
          password,
          role,
          is_suspended: isSuspended
        };
        if (phone && phone.trim()) {
          createPayload.phone = phone.trim();
        }
        if (role === 'AGENT' && agentCode && agentCode.trim()) {
          createPayload.agent_code = agentCode.trim().toUpperCase();
        }
        await apiClient.createAdminSystemUser(createPayload);
        if (onNotify) onNotify(`Created system user ${username} (${role}) successfully!`, 'success');
      }
      setIsModalOpen(false);
      loadUsers();
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Action failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSuspend = async (user) => {
    try {
      const updatedStatus = !user.is_suspended;
      await apiClient.updateAdminSystemUser(user.id, {
        is_suspended: updatedStatus
      });
      if (onNotify) onNotify(`${user.username} is now ${updatedStatus ? 'Suspended' : 'Active'}`, 'success');
      loadUsers();
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Failed to toggle status', 'error');
    }
  };

  // --- Manual Level Up Handlers ---
  const handleOpenLevelModal = (agent) => {
    setSelectedAgent(agent);
    const currLvl = agent.level_number || 1;
    const nextLvl = currLvl < 5 ? currLvl + 1 : currLvl;
    setTargetLevel(nextLvl);
    const defaults = LEVEL_DEFAULTS[nextLvl] || LEVEL_DEFAULTS[1];
    setCustomDeposit(defaults.deposit);
    setCustomCredit(defaults.credit);
    setLevelReason('');
    setIsLevelModalOpen(true);
  };

  const handleTargetLevelChange = (lvl) => {
    setTargetLevel(lvl);
    const defaults = LEVEL_DEFAULTS[lvl] || LEVEL_DEFAULTS[1];
    setCustomDeposit(defaults.deposit);
    setCustomCredit(defaults.credit);
  };

  const handleDepositChange = (amount) => {
    setCustomDeposit(amount);
    // Auto calculate 1.6x credit limit by default (100,000 -> 160,000)
    setCustomCredit(Math.round(amount * 1.6));
  };

  const handleLevelUpSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAgent) return;
    try {
      setLevelSubmitting(true);
      const payload = {
        target_level: parseInt(targetLevel),
        security_deposit: parseFloat(customDeposit),
        credit_limit: parseFloat(customCredit),
        reason: levelReason || `Manual level up to Level ${targetLevel} by Admin`
      };
      const res = await apiClient.manualAgentLevelUp(selectedAgent.id, payload);
      if (onNotify) {
        onNotify(`Agent ${selectedAgent.nickname || selectedAgent.username} ကို Level ${targetLevel} သို့ အောင်မြင်စွာ အဆင့်မြှင့်တင်ပြီးပါပြီ!`, 'success');
      }
      setIsLevelModalOpen(false);
      loadUsers();
    } catch (err) {
      console.error('Error leveling up agent:', err);
      if (onNotify) onNotify(err.message || 'Agent အဆင့်မြှင့်တင်မှု မအောင်မြင်ပါ', 'error');
    } finally {
      setLevelSubmitting(false);
    }
  };

  // --- Level Up Audit Logs Handlers ---
  const handleOpenLogsModal = async (agentId = null) => {
    setLogFilterAgentId(agentId);
    setIsLogsModalOpen(true);
    try {
      setLogsLoading(true);
      const res = await apiClient.getAdminAgentLevelLogs(agentId);
      setLevelLogs(res || []);
    } catch (err) {
      console.error('Error loading level logs:', err);
      if (onNotify) onNotify(err.message || 'Failed to load level logs', 'error');
    } finally {
      setLogsLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => 
    !search || 
    u.username?.toLowerCase().includes(search.toLowerCase()) || 
    u.nickname?.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-navy-900/90 border border-gold-500/20 p-4 rounded-2xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gold-500/10 border border-gold-500/30 text-gold-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>System Users Management</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-gold-500/20 text-gold-300 font-mono">
                {users.length} Users
              </span>
            </h3>
            <p className="text-xs text-slate-400">Admins, Agents (ဒိုင်ခွဲများ), and Customer Service (CS) operators</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-48 sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search user, phone, role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-navy-950 border border-gold-500/20 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold-400"
            />
          </div>

          {/* Audit Logs Button */}
          <button
            onClick={() => handleOpenLogsModal(null)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-navy-800 hover:bg-navy-750 text-slate-200 border border-gold-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm"
            title="View manual level up & override history"
          >
            <History className="w-4 h-4 text-gold-400" />
            <span>Level Logs</span>
          </button>

          {/* Create Button */}
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-950 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Create Member</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950/80 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20">
              <tr>
                <th className="py-3 px-4">No</th>
                <th className="py-3 px-4">Username & Phone</th>
                <th className="py-3 px-4">Nick Name</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Agent Level & Limit</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Loading system users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No system users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, idx) => (
                  <tr key={u.id || idx} className="hover:bg-navy-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-gold-300">{u.username}</div>
                      {u.phone && <div className="text-[11px] text-slate-400 font-mono">{u.phone}</div>}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {u.nickname || u.username}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        u.role === 'ADMIN'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : u.role === 'AGENT'
                          ? 'bg-amber-500/20 text-gold-300 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.role === 'AGENT' ? (
                        <div className="space-y-1">
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/30 text-amber-300 font-bold text-[11px]">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>Level {u.level_number || 1}</span>
                          </div>
                          {u.is_agent_credit_enabled ? (
                            <div className="text-[10px] text-slate-400 font-mono">
                              <span>Deposit: <strong className="text-slate-200">{(u.security_deposit || 0).toLocaleString()}</strong> Ks</span>
                              <span className="mx-1.5 text-slate-600">|</span>
                              <span>Credit: <strong className="text-amber-400">{(u.credit_limit || 0).toLocaleString()}</strong> Ks</span>
                            </div>
                          ) : (
                            <div className="text-[10px] font-mono">
                              <span className="text-slate-400">Balance: </span>
                              <strong className="text-gold-300">{(u.balance || 0).toLocaleString()}</strong>
                              <span className="text-slate-400"> Ks </span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Cash Mode</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600 font-mono text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleSuspend(u)}
                        title="Click to toggle suspension"
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                          u.is_suspended
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                        }`}
                      >
                        {u.is_suspended ? (
                          <>
                            <UserX className="w-3 h-3" />
                            <span>Suspended</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3 h-3" />
                            <span>Active</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        {u.role === 'AGENT' && (
                          <button
                            onClick={() => handleOpenLevelModal(u)}
                            title="Agent Level ကို Manual တိုးမြှင့်/ပြင်ဆင်ရန်"
                            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer shadow-sm"
                          >
                            <Award className="w-3.5 h-3.5 text-amber-400" />
                            <span>⭐ Lvl Up</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="px-3 py-1 rounded-lg bg-navy-800 hover:bg-navy-750 text-slate-200 border border-gold-500/30 text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3 text-gold-400" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Agent Level Up Modal */}
      {isLevelModalOpen && selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-navy-900 border border-gold-500/40 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gold-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Manual Agent Level Up</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                      Current: Level {selectedAgent.level_number || 1}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Agent: <strong className="text-gold-300">{selectedAgent.nickname || selectedAgent.username}</strong> ({selectedAgent.phone || selectedAgent.username})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsLevelModalOpen(false)}
                className="text-slate-400 hover:text-white text-xl font-bold p-1 cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleLevelUpSubmit} className="space-y-4">
              {/* Credit Status Notice */}
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Agent Credit စနစ်အား လောလောဆယ် ခေတ္တဆိုင်းငံ့ထားပါသည် (Suspended)</span>
                  <span className="text-[11px] text-slate-400">
                    ပြန်ဖွင့်ပါက Agent စပေါ်ငွေ (Deposit) ၏ <strong>၁.၆ ဆ (1.6x)</strong> ဖြင့် ၁၀၀,၀၀၀ ကျပ် လျှင် ၁၆၀,၀၀၀ ကျပ် Credit အဖြစ် အလိုအလျောက် သတ်မှတ်ပေးမည်ဖြစ်ပါသည်။
                  </span>
                </div>
              </div>

              {/* Target Level Selection Cards */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-2">
                  Select Target Level (ရွေးချယ်မည့် အဆင့်)
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((lvl) => {
                    const isSelected = targetLevel === lvl;
                    const isCurrent = (selectedAgent.level_number || 1) === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => handleTargetLevelChange(lvl)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-amber-500/25 border-amber-400 text-amber-200 ring-2 ring-amber-400/30'
                            : 'bg-navy-950 border-gold-500/20 text-slate-400 hover:bg-navy-800 hover:text-slate-200'
                        }`}
                      >
                        {isCurrent && (
                          <span className="absolute -top-1.5 -right-1 text-[8px] bg-slate-700 text-slate-200 px-1 rounded font-bold">
                            Current
                          </span>
                        )}
                        <div className="font-extrabold text-sm text-gold-300">Lvl {lvl}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5 font-mono">
                          {(LEVEL_DEFAULTS[lvl].deposit / 1000).toFixed(0)}K Dep
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Level Details Card */}
              <div className="bg-navy-950/80 border border-gold-500/20 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-gold-400" />
                    <span>Target Security Deposit (စပေါ်ငွေ):</span>
                  </span>
                  <span className="font-mono font-bold text-white text-sm">
                    {customDeposit.toLocaleString()} MMK
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    <span>Credit Limit (၁.၆ ဆ / 1.6x Credit):</span>
                  </span>
                  <span className="font-mono font-bold text-amber-400 text-sm">
                    {customCredit.toLocaleString()} MMK
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800">
                  <span>Regular Target Turnover:</span>
                  <span className="font-mono text-slate-300">
                    {LEVEL_DEFAULTS[targetLevel]?.turnover} MMK
                  </span>
                </div>
              </div>

              {/* Editable Deposit & Credit Limit fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Security Deposit (Ks)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    required
                    value={customDeposit}
                    onChange={(e) => handleDepositChange(parseFloat(e.target.value) || 0)}
                    className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-gold-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Credit Limit (Ks)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    required
                    value={customCredit}
                    onChange={(e) => setCustomCredit(parseFloat(e.target.value) || 0)}
                    className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-xs font-mono text-amber-400 focus:outline-none focus:border-gold-400"
                  />
                </div>
              </div>

              {/* Reason / Remarks (Mandatory for audit trail) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reason / Remarks for Manual Level Up <span className="text-amber-400 font-bold">* (Log ထားရှိမည်)</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Admin အတည်ပြုချက်ဖြင့် တိုက်ရိုက် Level Up ပေးခြင်း / VIP ကစားသမားစပေါ်ငွေစစ်ဆေးပြီး"
                  value={levelReason}
                  onChange={(e) => setLevelReason(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gold-500/20">
                <button
                  type="button"
                  onClick={() => setIsLevelModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-navy-800 text-slate-300 text-xs font-semibold hover:bg-navy-750 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={levelSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-950 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {levelSubmitting ? (
                    <span>Processing...</span>
                  ) : (
                    <>
                      <Award className="w-4 h-4" />
                      <span>Confirm Level Up (အဆင့်မြှင့်မည်)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Level Up Audit Logs Modal */}
      {isLogsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-navy-900 border border-gold-500/40 w-full max-w-4xl rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gold-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gold-500/10 border border-gold-500/30 text-gold-400">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Agent Level Up & Override Audit Logs</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-gold-500/20 text-gold-300 font-mono">
                      {levelLogs.length} Records
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    System User ထဲမှ Agent များကို Level အပြောင်းအလဲနှင့် အဆင့်မြှင့်တင်မှု မှတ်တမ်းများ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsLogsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xl font-bold p-1 cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-y-auto rounded-xl border border-gold-500/20">
              <table className="w-full text-left text-xs">
                <thead className="bg-navy-950 text-slate-400 uppercase font-bold tracking-wider sticky top-0 border-b border-gold-500/20">
                  <tr>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Agent</th>
                    <th className="py-2.5 px-3">Level Change</th>
                    <th className="py-2.5 px-3">Deposit & Credit</th>
                    <th className="py-2.5 px-3">Changed By</th>
                    <th className="py-2.5 px-3">Reason / Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {logsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        Loading audit logs...
                      </td>
                    </tr>
                  ) : levelLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        No manual level up logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    levelLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-navy-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {log.created_at}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-white">{log.agent_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {log.agent_phone || log.agent_username}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                              {log.old_level || 'Level 1'}
                            </span>
                            <ArrowRight className="w-3 h-3 text-gold-400" />
                            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-bold font-mono border border-amber-500/30">
                              {log.new_level}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px]">
                          <div>Dep: {(log.new_deposit || 0).toLocaleString()} Ks</div>
                          <div className="text-amber-400">Cred: {(log.new_credit_limit || 0).toLocaleString()} Ks</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-gold-400 font-bold whitespace-nowrap">
                          @{log.admin_username}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate" title={log.reason}>
                          {log.reason || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-gold-500/20">
              <span className="text-xs text-slate-400">
                Action Type: <span className="text-amber-400 font-mono font-bold">MANUAL_OVERRIDE</span>
              </span>
              <button
                onClick={() => setIsLogsModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-navy-800 hover:bg-navy-750 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-navy-900 border border-gold-500/30 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gold-500/20 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-gold-400" />
                <span>{editingUser ? `Edit Member: ${editingUser.username}` : 'Create New Member'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingUser}
                  placeholder="e.g. CS3 or mglikko"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold-400 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nick Name
                </label>
                <input
                  type="text"
                  placeholder="Display name for logs"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Password {editingUser && '(Leave blank to keep unchanged)'}
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  System Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold-400"
                >
                  <option value="CUSTOMER_SERVICE">Customer Service (CS)</option>
                  <option value="AGENT">Agent (ဒိုင်ခွဲ)</option>
                  <option value="ADMIN">Full Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Phone Number {editingUser ? '(Read-only)' : '(Optional - Auto-generated if blank)'}
                </label>
                <input
                  type="text"
                  disabled={!!editingUser}
                  placeholder="e.g. 09123456789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold-400 disabled:opacity-50"
                />
              </div>

              {role === 'AGENT' && (
                <div className="p-3 bg-navy-950/60 border border-amber-500/30 rounded-xl space-y-2">
                  <label className="block text-xs font-semibold text-amber-300">
                    Agent Referral Code {!editingUser && '(Optional - Auto-generated if blank)'}
                  </label>
                  <input
                    type="text"
                    disabled={!!editingUser}
                    placeholder="e.g. AGT1001"
                    value={agentCode}
                    onChange={(e) => setAgentCode(e.target.value)}
                    className="w-full bg-navy-900 border border-amber-500/40 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400 disabled:opacity-50 uppercase"
                  />
                  {!editingUser && (
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      💡 Agent အသစ်သည် မူလသတ်မှတ်ချက် <strong className="text-amber-300">Level 1</strong> (စရန်ငွေ 100,000 Ks / Credit Limit 160,000 Ks - 1.6x) ဖြင့် စတင်ပါမည်။
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="suspendCheck"
                  checked={isSuspended}
                  onChange={(e) => setIsSuspended(e.target.checked)}
                  className="w-4 h-4 rounded border-gold-500/30 bg-navy-950 text-amber-500 focus:ring-0"
                />
                <label htmlFor="suspendCheck" className="text-xs text-slate-300 cursor-pointer">
                  Suspend this account (prevent login)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gold-500/20">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-navy-800 text-slate-300 text-xs font-semibold hover:bg-navy-750 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-950 transition-all cursor-pointer"
                >
                  {submitting ? 'Saving...' : editingUser ? 'Save Changes' : 'Create Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
