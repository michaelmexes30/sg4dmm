import React, { useState, useEffect } from 'react';
import { 
  Award, 
  Coins, 
  Search, 
  RefreshCw, 
  ShieldCheck, 
  UserCheck, 
  Receipt, 
  TrendingUp, 
  Sparkles,
  ArrowUpRight,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Zap,
  UserPlus,
  Edit,
  X,
  Users,
  Eye,
  ChevronRight,
  Filter
} from 'lucide-react';
import { apiClient } from '../../api/client';

const getLevelBadge = (level) => {
  const lvl = String(level || 'Level 1');
  if (lvl.includes('5')) return 'bg-purple-950/80 text-purple-300 border-purple-500/50 shadow-sm';
  if (lvl.includes('4')) return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-sm';
  if (lvl.includes('3')) return 'bg-amber-950/80 text-amber-300 border-amber-500/50 shadow-sm';
  if (lvl.includes('2')) return 'bg-sky-950/80 text-sky-300 border-sky-500/50 shadow-sm';
  return 'bg-slate-800/80 text-slate-300 border-slate-700 shadow-sm';
};

export default function AgentCommissionView({ onNotify }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState('ALL');

  // Add Agent Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPhone, setNewAgentPhone] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [newAgentCode, setNewAgentCode] = useState('');
  const [newSecurityDeposit, setNewSecurityDeposit] = useState('1000000');
  const [newCreditLimit, setNewCreditLimit] = useState('3000000');
  const [creatingAgent, setCreatingAgent] = useState(false);

  // Agent Details Modal State
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedAgentDetails, setSelectedAgentDetails] = useState(null);
  const [detailTab, setDetailTab] = useState('downline'); // 'downline' | 'commissions'
  const [playerSearch, setPlayerSearch] = useState('');

  useEffect(() => {
    loadCommissions();
  }, []);

  const loadCommissions = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getAdminAgentCommissions();
      setData(res);
    } catch (err) {
      console.error('Error loading commissions:', err);
      if (onNotify) onNotify(err.message || 'Failed to load agent commissions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAgentDetails = async (agentId) => {
    try {
      setIsDetailModalOpen(true);
      setDetailLoading(true);
      setDetailTab('downline');
      setPlayerSearch('');
      const res = await apiClient.getAdminAgentDetails(agentId);
      setSelectedAgentDetails(res);
    } catch (err) {
      console.error('Failed to load agent details:', err);
      if (onNotify) onNotify(err.message || 'Failed to load agent details', 'error');
      setIsDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    if (!newAgentName.trim() || !newAgentPhone.trim() || !newAgentPassword.trim()) {
      alert('အမည်၊ ဖုန်းနံပါတ် နှင့် စကားဝှက် ဖြည့်စွက်ပေးပါရန်');
      return;
    }

    try {
      setCreatingAgent(true);
      const payload = {
        full_name: newAgentName.trim(),
        phone: newAgentPhone.trim(),
        password: newAgentPassword.trim(),
        agent_code: newAgentCode.trim() ? newAgentCode.trim().toUpperCase() : undefined,
        security_deposit: parseFloat(newSecurityDeposit) || 1000000,
        credit_limit: parseFloat(newCreditLimit) || 3000000,
      };

      const res = await apiClient.createAdminAgent(payload);
      if (onNotify) onNotify(`Agent "${res.agent.full_name}" (${res.agent.agent_code}) အား အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ!`, 'success');
      
      // Reset form
      setNewAgentName('');
      setNewAgentPhone('');
      setNewAgentPassword('');
      setNewAgentCode('');
      setNewSecurityDeposit('1000000');
      setNewCreditLimit('3000000');
      setIsAddModalOpen(false);

      await loadCommissions();
    } catch (err) {
      console.error('Create agent error:', err);
      if (onNotify) onNotify(err.message || 'Failed to create agent', 'error');
    } finally {
      setCreatingAgent(false);
    }
  };

  const handleTriggerTuesdaySettlement = async () => {
    if (!window.confirm('အင်္ဂါနေ့ နံနက် ၁၁:၀၀ နာရီ အပတ်စဉ် စာရင်းရှင်းလင်းမှု Batch ကို ယခုချက်ချင်း run မည်လား?\n\n- ပုံမှန်ကစားသူများ၏ 10% Weekly Bonus စာရင်းရှင်းမည်\n- Agent များ၏ 30% ကော်မရှင်နှင့် အကြွေးကျန်ငွေ စစ်ဆေးရှင်းလင်းမည်')) {
      return;
    }
    try {
      setActionLoading('settlement');
      const res = await apiClient.triggerAdminWeeklySettlement();
      if (onNotify) onNotify('Tuesday 11:00 AM Settlement batch completed successfully!', 'success');
      await loadCommissions();
      if (selectedAgentDetails?.agent?.id) {
        handleOpenAgentDetails(selectedAgentDetails.agent.id);
      }
    } catch (err) {
      console.error('Settlement trigger error:', err);
      if (onNotify) onNotify(err.message || 'Failed to execute settlement', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearSettlement = async (agentId, agentName) => {
    const note = window.prompt(`Agent "${agentName}" ၏ အပတ်စဉ် အကြွေးကျန်ငွေအား ရှင်းလင်းပေးပြီး ထိုးခွင့်ပြန်ဖွင့်ကာ ဆိုင်းငံ့ကော်မရှင် ထုတ်ပေးမည်ဖြစ်ပါသည်။\n\nရှင်းလင်းရသည့် မှတ်ချက် (Admin Note) ရိုက်ထည့်ပါ:`, 'Full weekly balance paid in cash/bank');
    if (!note) return;

    try {
      setActionLoading(`clear-${agentId}`);
      const res = await apiClient.clearAdminAgentSettlement(agentId, note);
      if (onNotify) onNotify(`Agent "${agentName}" စာရင်းရှင်းလင်းပြီး ထိုးခွင့်ပြန်ဖွင့်ပေးလိုက်ပါပြီ! (ကော်မရှင် +${res.released_commission?.toLocaleString() || 0} Ks ထည့်သွင်းပြီး)`, 'success');
      await loadCommissions();
      if (selectedAgentDetails?.agent?.id === agentId) {
        handleOpenAgentDetails(agentId);
      }
    } catch (err) {
      console.error('Clear settlement error:', err);
      if (onNotify) onNotify(err.message || 'Failed to clear settlement', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleLock = async (agentId, agentName, isLocked) => {
    const actionText = isLocked ? 'ထိုးခွင့် ပြန်လည်ဖွင့်ပေးမည်' : 'ထိုးခွင့် ပိတ်ထားမည် (Lock)';
    if (!window.confirm(`Agent "${agentName}" ၏ အကောင့်အား ${actionText} လား?`)) {
      return;
    }

    try {
      setActionLoading(`lock-${agentId}`);
      const res = await apiClient.toggleAdminAgentLock(agentId);
      if (onNotify) onNotify(`Agent "${agentName}" အကောင့် အခြေအနေ ပြောင်းလဲပြီးပါပြီ!`, 'success');
      await loadCommissions();
      if (selectedAgentDetails?.agent?.id === agentId) {
        handleOpenAgentDetails(agentId);
      }
    } catch (err) {
      console.error('Toggle lock error:', err);
      if (onNotify) onNotify(err.message || 'Failed to toggle lock status', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditCreditLimit = async (agentId, currentLimit, currentDeposit) => {
    const newLimitStr = window.prompt(`Agent Credit Limit အသစ် သတ်မှတ်ပါ (ကျပ်):`, currentLimit);
    if (!newLimitStr) return;
    const newLimit = parseFloat(newLimitStr);
    if (isNaN(newLimit) || newLimit < 0) {
      alert('မှန်ကန်သော ပမာဏ ရိုက်ထည့်ပါ');
      return;
    }

    try {
      setActionLoading(`edit-${agentId}`);
      await apiClient.updateAdminAgentCredit(agentId, { credit_limit: newLimit });
      if (onNotify) onNotify('Credit Limit updated successfully!', 'success');
      await loadCommissions();
      if (selectedAgentDetails?.agent?.id === agentId) {
        handleOpenAgentDetails(agentId);
      }
    } catch (err) {
      console.error(err);
      if (onNotify) onNotify(err.message || 'Failed to update credit limit', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const master = data?.master_agent;
  const agents = data?.agents || [];
  const records = data?.records || [];

  // Filter Agents
  const filteredAgents = agents.filter(ag => {
    if (!agentSearch) return true;
    const s = agentSearch.toLowerCase();
    return ag.name?.toLowerCase().includes(s) ||
           ag.phone?.includes(s) ||
           ag.agent_code?.toLowerCase().includes(s);
  });

  // Calculate System Total Metrics
  const totalDownlinePlayers = agents.reduce((acc, curr) => acc + (curr.downline_players_count || 0), 0);
  const totalPendingComm = data?.total_commission_pending || 0;
  const totalSettledComm = data?.total_commission_paid || 0;

  // Filter Commission Logs
  const filteredRecords = records.filter(r => {
    const matchSearch = !search || 
      r.player_phone?.includes(search) || 
      r.player_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.voucher?.toLowerCase().includes(search.toLowerCase()) ||
      r.agent_code?.toLowerCase().includes(search.toLowerCase()) ||
      r.agent_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchStatus = statusFilter === 'ALL' || r.settlement_status === statusFilter;
    const matchAgent = selectedAgentFilter === 'ALL' || String(r.agent_id) === String(selectedAgentFilter);

    return matchSearch && matchStatus && matchAgent;
  });

  // Filter modal downline players
  const modalPlayers = (selectedAgentDetails?.downline_players || []).filter(p => {
    if (!playerSearch) return true;
    const s = playerSearch.toLowerCase();
    return p.full_name?.toLowerCase().includes(s) || p.phone?.includes(s);
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span className="text-gold-400">🦚</span>
            <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent">
              Multi-Agent Management & 30% Weekly Commission Panel
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Agent များအားလုံး၏ စပေါ်ငွေ၊ ခရက်ဒစ်ထိုးခွင့်၊ အကြွေးစာရင်း၊ Downline ကစားသမားများနှင့် အင်္ဂါနေ့ ၁၁:၀၀ နာရီ စာရင်းရှင်းလင်းမှု စနစ်
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Add Agent Button */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold-gradient-btn text-slate-950 text-xs font-black transition-all cursor-pointer shadow-lg hover:brightness-110"
          >
            <UserPlus className="w-4 h-4 text-slate-950" />
            <span>➕ Add New Agent (အေးဂျင့်အသစ်ထည့်မည်)</span>
          </button>

          {/* Trigger Settlement Button */}
          <button
            onClick={handleTriggerTuesdaySettlement}
            disabled={actionLoading === 'settlement'}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-lg disabled:opacity-50"
          >
            <Zap className={`w-4 h-4 ${actionLoading === 'settlement' ? 'animate-spin' : ''}`} />
            <span>Trigger Tuesday Settlement</span>
          </button>

          <button
            onClick={loadCommissions}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy-900 border border-amber-500/30 hover:border-amber-400 text-gold-300 text-xs font-bold transition-all cursor-pointer shadow-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-gold-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 4 Multi-Metric Summary Cards across all agents */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-navy-950 via-navy-900 to-slate-900 border border-gold-500/30 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] uppercase font-bold tracking-wider">အေးဂျင့် စုစုပေါင်း</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-xl sm:text-2xl font-black text-amber-300 font-mono">
            {agents.length} <span className="text-xs text-slate-400 font-sans">ဦး</span>
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block">Active Agents in System</span>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-navy-950 via-navy-900 to-slate-900 border border-gold-500/30 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] uppercase font-bold tracking-wider">Downline Players စုစုပေါင်း</span>
            <UserCheck className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-xl sm:text-2xl font-black text-purple-300 font-mono">
            {totalDownlinePlayers.toLocaleString()} <span className="text-xs text-slate-400 font-sans">ယောက်</span>
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block">အေးဂျင့်များလက်အောက် ကစားသမား</span>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-navy-950 via-navy-900 to-slate-900 border border-gold-500/30 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] uppercase font-bold tracking-wider">ဆိုင်းငံ့ 30% ကော်မရှင် (Pending)</span>
            <Clock className="w-4 h-4 text-gold-400" />
          </div>
          <span className="text-xl sm:text-2xl font-black text-gold-400 font-mono">
            Ks {totalPendingComm.toLocaleString()}
          </span>
          <span className="text-[10px] text-amber-400/80 mt-1 block">အင်္ဂါနေ့ ၁၁:၀၀ နာရီ ထုတ်ပေးမည်</span>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-navy-950 via-navy-900 to-slate-900 border border-gold-500/30 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] uppercase font-bold tracking-wider">ရှင်းပြီး 30% ကော်မရှင် (Settled)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            Ks {totalSettledComm.toLocaleString()}
          </span>
          <span className="text-[10px] text-emerald-400/80 mt-1 block">အေးဂျင့်များထံ ထည့်သွင်းပြီးငွေ</span>
        </div>
      </div>

      {/* Tuesday Settlement Rule Enforcement Box */}
      <div className="p-4 rounded-xl bg-navy-950/90 border border-amber-500/30 text-xs text-slate-300 space-y-2">
        <div className="font-bold text-gold-400 flex items-center gap-1.5 text-xs sm:text-sm">
          <Clock className="w-4 h-4 text-gold-400 shrink-0" />
          <span>အပတ်စဉ် အင်္ဂါနေ့ နံနက် ၁၁:၀၀ နာရီ စာရင်းရှင်းလင်းမှု စည်းမျဉ်း (Tuesday 11:00 AM Settlement System):</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-300 pt-1">
          <div className="p-2.5 rounded-lg bg-navy-900/60 border border-slate-800">
            <strong className="text-amber-300 block mb-1">၁။ 30% ကော်မရှင် ဆိုင်းငံ့မှတ်တမ်း</strong>
            အေးဂျင့်များ၏ 30% Commission (ကိုယ်တိုင်ထိုး + Downline ကစားသူများထိုးကြေး) များကို PENDING အဖြစ် ဆိုင်းငံ့ထားပြီး အင်္ဂါနေ့ ၁၁:၀၀ နာရီတွင် Settle လုပ်ပေးပါသည်။
          </div>
          <div className="p-2.5 rounded-lg bg-navy-900/60 border border-slate-800">
            <strong className="text-emerald-300 block mb-1">၂။ အကြွေးရှင်းပြီးပါက ကော်မရှင်ထုတ်ပေး</strong>
            Agent ထိုးထားသော အကြွေးကျန်ငွေ (Credit Debt) အားလုံး ပြေလည်ပါက 30% ကော်မရှင်ကို အင်္ဂါနေ့ ၁၁:၀၀ နာရီတွင် Agent Wallet ထဲသို့ အပြည့်အဝ ထည့်သွင်းပေးပါသည်။
          </div>
          <div className="p-2.5 rounded-lg bg-navy-900/60 border border-slate-800">
            <strong className="text-rose-300 block mb-1">၃။ အကြွေးမရှင်းပါက ထိုးခွင့်ပိတ်</strong>
            အကယ်၍ အင်္ဂါနေ့ ၁၁:၀၀ နာရီထိ အကြွေးမရှင်းပါက ကော်မရှင်ကို ဆိုင်းငံ့ (WITHHELD) ထားမည်ဖြစ်ပြီး အကောင့်အား ထိုးခွင့်ယာယီပိတ် (Betting Locked) ထားမည်ဖြစ်ပါသည်။
          </div>
        </div>
      </div>

      {/* ALL REGISTERED AGENTS SUMMARY & STATUS MANAGEMENT GRID */}
      <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl shadow-xl overflow-hidden p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gold-500/20">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gold-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Registered Agents Status & Summarized List ({filteredAgents.length} Agents)
            </h3>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search agent by name, phone, code..."
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
              className="w-full bg-navy-950 border border-gold-500/20 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold-400 font-mono"
            />
          </div>
        </div>

        {filteredAgents.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            ရှာဖွေမှုနှင့် ကိုက်ညီသော အေးဂျင့် မရှိပါ (No agents found)
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((ag) => (
              <div 
                key={ag.id} 
                className={`p-4 rounded-xl border transition-all space-y-3 ${
                  ag.is_betting_locked 
                    ? 'bg-rose-950/20 border-rose-500/40 shadow-rose-950/30' 
                    : 'bg-navy-950 border-gold-500/20 hover:border-gold-500/40'
                }`}
              >
                {/* Agent Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-300 p-[1.5px] flex items-center justify-center shrink-0">
                      <div className="w-full h-full bg-navy-950 rounded-xl flex items-center justify-center text-lg">
                        🦚
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white flex items-center gap-1.5 flex-wrap">
                        <span>{ag.name}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${getLevelBadge(ag.level)}`}>
                          ⭐ {ag.level || 'Level 1'}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400 font-mono">{ag.phone}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-gold-300 font-mono font-bold text-xs border border-amber-500/30">
                      {ag.agent_code}
                    </span>
                    {ag.is_betting_locked ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> ထိုးခွင့်ပိတ်ထား (Locked)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Active
                      </span>
                    )}
                  </div>
                </div>

                {/* Financial Pillars Grid */}
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-800/80">
                  <div className="p-2 rounded-lg bg-navy-900/60 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">စပေါ်ငွေ (Deposit):</span>
                    <span className="font-mono font-bold text-amber-300 text-xs">Ks {ag.security_deposit?.toLocaleString()}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-navy-900/60 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">သတ်မှတ် Credit Limit:</span>
                    <span className="font-mono font-bold text-purple-300 text-xs">Ks {ag.credit_limit?.toLocaleString()}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-navy-900/60 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">မရှင်းရသေးသောအကြွေး:</span>
                    <span className={`font-mono font-bold text-xs ${ag.used_credit > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                      Ks {ag.used_credit?.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-navy-900/60 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">ကျန်ရှိခရက်ဒစ် (Available):</span>
                    <span className="font-mono font-bold text-emerald-300 text-xs">Ks {ag.available_credit?.toLocaleString()}</span>
                  </div>
                </div>

                {/* Turnover Breakdown Bar */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-navy-900/50 border border-slate-800 text-[10px] text-slate-400 font-mono">
                  <span>စုစုပေါင်း ထိုးကြေး (Turnover):</span>
                  <div className="text-right">
                    <span className="font-bold text-amber-300">
                      Ks {(ag.total_turnover ?? ((ag.self_turnover || 0) + (ag.downline_turnover || 0)) ?? (ag.total_volume_staked || 0)).toLocaleString()}
                    </span>
                    {(ag.self_turnover > 0 || ag.downline_turnover > 0) && (
                      <span className="block text-[9px] text-slate-500 font-sans">
                        (Self: Ks {(ag.self_turnover || 0).toLocaleString()} | Downline: Ks {(ag.downline_turnover || 0).toLocaleString()})
                      </span>
                    )}
                  </div>
                </div>

                {/* Network & Commission Highlights */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-navy-900/80 border border-amber-500/20 text-[11px]">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Downline Players:</span>
                    <span className="font-bold text-white flex items-center gap-1">
                      <Users className="w-3 h-3 text-gold-400" />
                      <span>{ag.downline_players_count || 0} ယောက်</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] block">ဆိုင်းငံ့ 30% ကော်မရှင်:</span>
                    <span className="font-mono font-bold text-gold-400">
                      +Ks {ag.pending_commission?.toLocaleString() || 0}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => handleOpenAgentDetails(ag.id)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-gold-300 text-[11px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5 text-gold-400" />
                    <span>Downline စာရင်း / အသေးစိတ်</span>
                  </button>

                  <button
                    onClick={() => handleClearSettlement(ag.id, ag.name)}
                    disabled={actionLoading === `clear-${ag.id}`}
                    title="အကြွေးရှင်းလင်းပြီး ထိုးခွင့်ပြန်ဖွင့်ပေးမည်"
                    className="py-1.5 px-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold cursor-pointer transition-all disabled:opacity-50"
                  >
                    Clear Debt
                  </button>

                  <button
                    onClick={() => handleToggleLock(ag.id, ag.name, ag.is_betting_locked)}
                    disabled={actionLoading === `lock-${ag.id}`}
                    title={ag.is_betting_locked ? "ထိုးခွင့် ပြန်ဖွင့်မည်" : "ထိုးခွင့် ယာယီပိတ်မည်"}
                    className={`p-1.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
                      ag.is_betting_locked 
                        ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30' 
                        : 'bg-rose-600/20 border-rose-500/40 text-rose-300 hover:bg-rose-600/30'
                    }`}
                  >
                    {ag.is_betting_locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => handleEditCreditLimit(ag.id, ag.credit_limit, ag.security_deposit)}
                    title="Credit Limit ပြင်ဆင်မည်"
                    className="p-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 border border-gold-500/30 text-gold-300 text-[11px] font-bold cursor-pointer transition-all"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Global Commission Audit Records Table */}
      <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-gold-500/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-gold-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              30% Commission Audit Logs ({filteredRecords.length} Records)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter by Agent Dropdown */}
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5 text-gold-400" />
              <span>Agent:</span>
              <select
                value={selectedAgentFilter}
                onChange={(e) => setSelectedAgentFilter(e.target.value)}
                className="bg-navy-950 border border-gold-500/20 rounded-xl px-2.5 py-1 text-xs text-gold-300 focus:outline-none focus:border-gold-400 font-bold"
              >
                <option value="ALL">All Agents (အားလုံး)</option>
                {agents.map(ag => (
                  <option key={ag.id} value={String(ag.id)}>
                    {ag.agent_code} - {ag.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-navy-950 p-1 rounded-xl border border-gold-500/20 text-[11px]">
              {['ALL', 'PENDING', 'SETTLED', 'WITHHELD'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    statusFilter === st 
                      ? 'bg-amber-500 text-slate-950 shadow' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search phone or voucher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-navy-950 border border-gold-500/20 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold-400 font-mono"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950/80 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20">
              <tr>
                <th className="py-3 px-4">No</th>
                <th className="py-3 px-4">Agent Code</th>
                <th className="py-3 px-4">Player / Source</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Voucher Code</th>
                <th className="py-3 px-4 text-right">Player Stake (MMK)</th>
                <th className="py-3 px-4 text-center">Rate</th>
                <th className="py-3 px-4 text-right">Commission (MMK)</th>
                <th className="py-3 px-4 text-center">Settlement Status</th>
                <th className="py-3 px-4">Batch / Settled At</th>
                <th className="py-3 px-4">Date Time (MMT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    Loading agent commission records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    No commission logs found matching your filter.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-navy-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-gold-300 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                        {r.agent_code}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {r.player_name === 'Direct Self-Bet' ? (
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <span>🦚 Agent Self-Bet</span>
                        </span>
                      ) : (
                        r.player_name
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {r.player_phone}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {r.voucher}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      {r.bet_total_stake?.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        30%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      +{r.commission_amount?.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {r.settlement_status === 'SETTLED' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          SETTLED
                        </span>
                      ) : r.settlement_status === 'WITHHELD' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          WITHHELD
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          PENDING
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px] font-mono whitespace-nowrap">
                      {r.settlement_batch !== '-' ? r.settlement_batch : r.settled_at !== '-' ? r.settled_at : '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px] font-mono whitespace-nowrap">
                      {r.created_at}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL: SPECIFIC AGENT DOWNLINE PLAYERS & COMMISSIONS */}
      {isDetailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-navy-900 border border-gold-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-gold-500/20 flex items-start justify-between gap-4 bg-navy-950/80">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-400 to-amber-200 p-[1.5px] shadow-lg flex items-center justify-center shrink-0">
                  <div className="w-full h-full bg-navy-950 rounded-2xl flex items-center justify-center text-2xl">
                    🦚
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black text-white">
                      {selectedAgentDetails?.agent?.full_name || 'Agent Details'}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black border ${getLevelBadge(selectedAgentDetails?.agent?.level)}`}>
                      ⭐ {selectedAgentDetails?.agent?.level || 'Level 1'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-gold-300 font-mono font-black text-xs border border-amber-500/40">
                      {selectedAgentDetails?.agent?.agent_code}
                    </span>
                    {selectedAgentDetails?.agent?.is_betting_locked ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> ထိုးခွင့်ပိတ်ထား (Locked)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-3 font-mono">
                    <span>Phone: <strong className="text-slate-200">{selectedAgentDetails?.agent?.phone}</strong></span>
                    <span>•</span>
                    <span>Joined: {selectedAgentDetails?.agent?.created_at}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions inside Modal Header */}
              <div className="flex items-center gap-2">
                {selectedAgentDetails?.agent?.id && (
                  <>
                    <button
                      onClick={() => handleClearSettlement(selectedAgentDetails.agent.id, selectedAgentDetails.agent.full_name)}
                      disabled={actionLoading === `clear-${selectedAgentDetails.agent.id}`}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                      Clear Debt
                    </button>
                    <button
                      onClick={() => handleToggleLock(selectedAgentDetails.agent.id, selectedAgentDetails.agent.full_name, selectedAgentDetails.agent.is_betting_locked)}
                      disabled={actionLoading === `lock-${selectedAgentDetails.agent.id}`}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        selectedAgentDetails.agent.is_betting_locked
                          ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-600/20 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      {selectedAgentDetails.agent.is_betting_locked ? 'Unlock Betting' : 'Lock Betting'}
                    </button>
                  </>
                )}
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              
              {/* Agent Financial Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-navy-950 border border-gold-500/20">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">စပေါ်ငွေ (Deposit)</span>
                  <span className="text-sm sm:text-base font-black text-amber-300 font-mono mt-0.5 block">
                    Ks {(selectedAgentDetails?.agent?.security_deposit || 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-navy-950 border border-gold-500/20">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Credit Limit & အကြွေး</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-sm sm:text-base font-black text-purple-300 font-mono">
                      Ks {(selectedAgentDetails?.agent?.credit_limit || 0).toLocaleString()}
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono block ${selectedAgentDetails?.agent?.used_credit > 0 ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                    အကြွေး: Ks {(selectedAgentDetails?.agent?.used_credit || 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-navy-950 border border-gold-500/20">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">ကျန်ရှိ Credit (Available)</span>
                  <span className="text-sm sm:text-base font-black text-emerald-400 font-mono mt-0.5 block">
                    Ks {(selectedAgentDetails?.agent?.available_credit || 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-navy-950 border border-gold-500/20">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">30% ကော်မရှင် (Pending / Settled)</span>
                  <div className="flex items-baseline gap-1 mt-0.5 font-mono text-xs">
                    <span className="text-amber-400 font-bold">
                      +Ks {(selectedAgentDetails?.agent?.pending_commission || 0).toLocaleString()}
                    </span>
                    <span className="text-slate-500">/</span>
                    <span className="text-slate-300">
                      Ks {(selectedAgentDetails?.agent?.settled_commission || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Agent Level & Turnover Progress Banner */}
              {selectedAgentDetails?.agent?.level_info && (
                <div className="p-4 rounded-xl bg-navy-950 border border-amber-500/30 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-400" />
                      <span className="text-xs font-bold text-white">Agent Level အဆင့် သတ်မှတ်ချက်:</span>
                      <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black border ${getLevelBadge(selectedAgentDetails.agent.level_info.level)}`}>
                        ⭐ {selectedAgentDetails.agent.level_info.level}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 font-mono">
                      <span>Credit Benefit: </span>
                      <strong className="text-amber-400 font-bold">{selectedAgentDetails.agent.level_info.credit_multiplier || 3} ဆ</strong>
                      <span className="text-slate-500"> (Deposit × {selectedAgentDetails.agent.level_info.credit_multiplier || 3} ဆ)</span>
                    </div>
                  </div>

                  {/* Turnover Breakdown Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-navy-900 border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">မိမိကိုယ်တိုင်ထိုးကြေး (Self-Turnover):</span>
                      <span className="text-sm font-bold text-slate-200">
                        Ks {(selectedAgentDetails.agent.level_info.self_turnover || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-navy-900 border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">လက်အောက် ထိုးကြေး (Downline):</span>
                      <span className="text-sm font-bold text-slate-200">
                        Ks {(selectedAgentDetails.agent.level_info.downline_turnover || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-navy-900 border border-amber-500/30">
                      <span className="text-amber-300 text-[10px] block font-bold">စုစုပေါင်း ထိုးကြေး (Combined):</span>
                      <span className="text-sm font-black text-amber-400">
                        Ks {(selectedAgentDetails.agent.level_info.total_turnover || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Level Up Progress Bar */}
                  {selectedAgentDetails.agent.level_info.next_level ? (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300">
                          တက်ရောက်မည့်အဆင့်: <strong className="text-gold-300">{selectedAgentDetails.agent.level_info.next_level}</strong>
                          <span className="text-slate-400 ml-1.5">
                            (လိုသော ထိုးကြေး: Ks {selectedAgentDetails.agent.level_info.turnover_remaining?.toLocaleString()})
                          </span>
                        </span>
                        <span className="font-mono font-bold text-amber-400">
                          {selectedAgentDetails.agent.level_info.progress_percent}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-300 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, selectedAgentDetails.agent.level_info.progress_percent))}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-500/30 text-center text-xs text-purple-300 font-bold">
                      🏆 အမြင့်ဆုံး Level 5 (Diamond / Master Agent) သို့ ရောက်ရှိပြီးဖြစ်ပါသည်!
                    </div>
                  )}
                </div>
              )}

              {/* Modal Tabs Header */}
              <div className="flex items-center justify-between border-b border-gold-500/20 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDetailTab('downline')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      detailTab === 'downline'
                        ? 'bg-amber-500 text-slate-950 shadow-md'
                        : 'bg-navy-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>👥 Downline Players စာရင်း ({selectedAgentDetails?.downline_players?.length || 0})</span>
                  </button>

                  <button
                    onClick={() => setDetailTab('commissions')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      detailTab === 'commissions'
                        ? 'bg-amber-500 text-slate-950 shadow-md'
                        : 'bg-navy-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>💸 30% ကော်မရှင်မှတ်တမ်း ({selectedAgentDetails?.commissions?.length || 0})</span>
                  </button>
                </div>

                {detailTab === 'downline' && (
                  <div className="relative w-48 sm:w-60">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="Search player name/phone..."
                      value={playerSearch}
                      onChange={(e) => setPlayerSearch(e.target.value)}
                      className="w-full bg-navy-950 border border-gold-500/20 rounded-xl pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold-400"
                    />
                  </div>
                )}
              </div>

              {/* Tab 1: Downline Players Table */}
              {detailTab === 'downline' && (
                <div className="bg-navy-950/80 rounded-xl border border-gold-500/20 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-navy-950 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20 text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3">No</th>
                          <th className="py-2.5 px-3">Player Name</th>
                          <th className="py-2.5 px-3">Phone</th>
                          <th className="py-2.5 px-3">Joined Date</th>
                          <th className="py-2.5 px-3 text-right">Balance (MMK)</th>
                          <th className="py-2.5 px-3 text-center">Total Bets</th>
                          <th className="py-2.5 px-3 text-right">Total Staked (MMK)</th>
                          <th className="py-2.5 px-3 text-right">Total Won (MMK)</th>
                          <th className="py-2.5 px-3">Last Bet</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {detailLoading ? (
                          <tr>
                            <td colSpan={10} className="py-8 text-center text-slate-500">
                              Loading downline players...
                            </td>
                          </tr>
                        ) : modalPlayers.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-8 text-center text-slate-500">
                              ဤ Agent လက်အောက်တွင် ကစားသမား မရှိသေးပါ (No downline players registered)
                            </td>
                          </tr>
                        ) : (
                          modalPlayers.map((p, idx) => (
                            <tr key={p.id} className="hover:bg-navy-800/40 transition-colors">
                              <td className="py-2.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-semibold text-white">
                                {p.full_name}
                                {p.is_simulated && (
                                  <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400">Bot</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-300">{p.phone}</td>
                              <td className="py-2.5 px-3 text-[11px] text-slate-400">{p.joined_at}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-bold">
                                {p.balance?.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono">
                                {p.total_bets_count || 0}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                                {p.total_staked?.toLocaleString() || 0}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-amber-300">
                                {p.total_payout?.toLocaleString() || 0}
                              </td>
                              <td className="py-2.5 px-3 text-[11px] font-mono text-slate-400 whitespace-nowrap">
                                {p.last_bet_time}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {p.is_suspended ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400">
                                    Suspended
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
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

              {/* Tab 2: Individual Agent Commission Logs */}
              {detailTab === 'commissions' && (
                <div className="bg-navy-950/80 rounded-xl border border-gold-500/20 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-navy-950 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20 text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3">No</th>
                          <th className="py-2.5 px-3">Source / Player</th>
                          <th className="py-2.5 px-3">Phone</th>
                          <th className="py-2.5 px-3">Voucher</th>
                          <th className="py-2.5 px-3 text-right">Stake (MMK)</th>
                          <th className="py-2.5 px-3 text-center">Rate</th>
                          <th className="py-2.5 px-3 text-right">Commission (MMK)</th>
                          <th className="py-2.5 px-3 text-center">Settlement Status</th>
                          <th className="py-2.5 px-3">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {detailLoading ? (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-slate-500">
                              Loading commission logs...
                            </td>
                          </tr>
                        ) : (selectedAgentDetails?.commissions || []).length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-slate-500">
                              ဤ Agent အတွက် ကော်မရှင်မှတ်တမ်း မရှိသေးပါ (No commission logs recorded)
                            </td>
                          </tr>
                        ) : (
                          (selectedAgentDetails?.commissions || []).map((c, idx) => (
                            <tr key={c.id || idx} className="hover:bg-navy-800/40 transition-colors">
                              <td className="py-2.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-semibold text-white">
                                {c.is_self_bet ? (
                                  <span className="text-amber-400 font-bold">🦚 Agent Direct Bet</span>
                                ) : (
                                  c.player_name
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-300">{c.player_phone}</td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">{c.voucher}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                                {c.bet_total_stake?.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-gold-400">30%</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                                +{c.commission_amount?.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {c.settlement_status === 'SETTLED' ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                                    SETTLED
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                                    PENDING
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-[11px] font-mono text-slate-400 whitespace-nowrap">
                                {c.created_at}
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

            {/* Modal Footer */}
            <div className="p-4 border-t border-gold-500/20 bg-navy-950/80 flex items-center justify-end">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
              >
                ပိတ်မည် (Close)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: ADD NEW AGENT */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-navy-900 border border-gold-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gold-500/20">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-gold-400" />
                <span>➕ Add New Agent (အေးဂျင့်အသစ်ထည့်မည်)</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAgent} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">အေးဂျင့် အမည် (Full Name) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ko Kyaw"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-gold-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">ဖုန်းနံပါတ် (Phone Number for Login) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 09799999999"
                  value={newAgentPhone}
                  onChange={(e) => setNewAgentPhone(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-2 text-white placeholder-slate-500 font-mono focus:outline-none focus:border-gold-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">စကားဝှက် (Password for Login) *</label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={newAgentPassword}
                  onChange={(e) => setNewAgentPassword(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-gold-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Agent Code (ချန်ထားပါက စနစ်မှ Auto Generate ထုတ်ပေးမည်)</label>
                <input
                  type="text"
                  placeholder="e.g. AGT002, AGT7777"
                  value={newAgentCode}
                  onChange={(e) => setNewAgentCode(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-2 text-white placeholder-slate-500 font-mono uppercase focus:outline-none focus:border-gold-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">စပေါ်ငွေ (Deposit MMK)</label>
                  <input
                    type="number"
                    value={newSecurityDeposit}
                    onChange={(e) => setNewSecurityDeposit(e.target.value)}
                    className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-gold-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Credit ထိုးခွင့် (Limit MMK)</label>
                  <input
                    type="number"
                    value={newCreditLimit}
                    onChange={(e) => setNewCreditLimit(e.target.value)}
                    className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-gold-400"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer transition-colors"
                >
                  မလုပ်တော့ပါ (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={creatingAgent}
                  className="px-5 py-2 rounded-xl gold-gradient-btn text-dark-bg font-black shadow-gold cursor-pointer transition-all disabled:opacity-50"
                >
                  {creatingAgent ? 'ထည့်သွင်းနေပါသည်...' : 'အတည်ပြု ထည့်သွင်းမည်'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
