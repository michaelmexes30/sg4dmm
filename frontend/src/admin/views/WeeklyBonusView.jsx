import React, { useState, useEffect } from 'react';
import { 
  Gift, 
  Play, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Search, 
  RefreshCw, 
  Sparkles, 
  Coins, 
  Award,
  AlertCircle,
  Settings,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sliders
} from 'lucide-react';
import { apiClient } from '../../api/client';

export default function WeeklyBonusView({ onNotify }) {
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'logs' | 'rules'
  
  // Data States
  const [previewData, setPreviewData] = useState(null);
  const [bonuses, setBonuses] = useState([]);
  const [rules, setRules] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [search, setSearch] = useState('');

  // Rules Form State
  const [formBonusRate, setFormBonusRate] = useState('10');
  const [formMinBet, setFormMinBet] = useState('10000');
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    loadTabData();
  }, [activeTab]);

  const loadTabData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'preview') {
        const res = await apiClient.getAdminWeeklyBonusesPreview();
        setPreviewData(res);
      } else if (activeTab === 'logs') {
        const res = await apiClient.getAdminWeeklyBonuses();
        setBonuses(res || []);
      } else if (activeTab === 'rules') {
        const res = await apiClient.getAdminWeeklyBonusRules();
        setRules(res);
        if (res) {
          setFormBonusRate(String(res.bonus_rate || 10));
          setFormMinBet(String(res.min_qualifying_bet || 10000));
        }
      }
    } catch (err) {
      console.error('Error loading weekly bonus data:', err);
      if (onNotify) onNotify(err.message || 'Failed to load weekly bonus data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteBonusRun = async () => {
    if (!window.confirm('Active Real Player များအတွက် အပတ်စဉ်ဘောနပ်စ် တွက်ချက်ပြီး Wallet ထဲသို့ ယခုချက်ချင်း ထည့်သွင်းပေးမည်လား?')) return;
    try {
      setExecuting(true);
      const res = await apiClient.triggerAdminWeeklyBonus();
      if (onNotify) {
        onNotify(
          res.message || `Distributed ${res.distributed_count || 0} bonuses totaling ${(res.total_amount || 0).toLocaleString()} MMK!`,
          'success'
        );
      }
      setActiveTab('logs');
      loadTabData();
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Bonus execution failed', 'error');
    } finally {
      setExecuting(false);
    }
  };

  const handleSaveRules = async (e) => {
    e.preventDefault();
    try {
      setSavingRules(true);
      const payload = {
        bonus_rate: parseFloat(formBonusRate) || 10.0,
        min_qualifying_bet: parseFloat(formMinBet) || 10000.0,
      };
      await apiClient.updateAdminWeeklyBonusRules(payload);
      if (onNotify) onNotify('Weekly bonus rules updated successfully!', 'success');
      loadTabData();
    } catch (err) {
      console.error('Save rules error:', err);
      if (onNotify) onNotify(err.message || 'Failed to update rules', 'error');
    } finally {
      setSavingRules(false);
    }
  };

  // Filtering for preview
  const filteredPreviewPlayers = (previewData?.players || []).filter(p =>
    !search ||
    p.player_phone?.includes(search) ||
    p.player_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Filtering for logs
  const filteredBonuses = bonuses.filter(b =>
    !search ||
    b.player_phone?.includes(search) ||
    b.player_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.week_span?.includes(search)
  );

  const totalDistributed = bonuses.reduce((sum, b) => sum + (b.bonus_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header and Manual Execution Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span className="text-purple-400">🎁</span>
            <span className="bg-gradient-to-r from-purple-200 via-purple-400 to-amber-400 bg-clip-text text-transparent">
              Weekly Bonus Management & Settlement Panel
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ပုံမှန်ကစားသူများအတွက် အပတ်စဉ် အင်္ဂါနေ့ နံနက် ၁၁:၀၀ နာရီ Cash Direct to Wallet စနစ်
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadTabData}
            className="p-2 rounded-xl bg-navy-900 border border-gold-500/20 hover:border-gold-500/30 text-slate-300 transition-colors cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          </button>

          <button
            onClick={handleExecuteBonusRun}
            disabled={executing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white text-xs font-black shadow-lg shadow-purple-950 transition-all cursor-pointer disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${executing ? 'animate-spin' : ''}`} />
            <span>{executing ? 'Executing Run...' : 'Execute Settlement Now'}</span>
          </button>
        </div>
      </div>

      {/* 3 Main Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-navy-900/90 border border-gold-500/20 p-3.5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setActiveTab('preview'); setSearch(''); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'preview'
                ? 'bg-purple-600 text-white font-black shadow-lg shadow-purple-900'
                : 'bg-navy-800 text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>🎁 Live Qualifying Preview ({previewData?.total_qualified_players || 0} ဦး)</span>
          </button>

          <button
            onClick={() => { setActiveTab('logs'); setSearch(''); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-purple-600 text-white font-black shadow-lg shadow-purple-900'
                : 'bg-navy-800 text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4 text-purple-300" />
            <span>📜 Distributed Bonus History ({bonuses.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('rules'); setSearch(''); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'rules'
                ? 'bg-purple-600 text-white font-black shadow-lg shadow-purple-900'
                : 'bg-navy-800 text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4 text-gold-400" />
            <span>⚙️ Bonus Rules & Settings</span>
          </button>
        </div>

        {activeTab !== 'rules' && (
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search phone or player..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-navy-950 border border-gold-500/20 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 font-mono"
            />
          </div>
        )}
      </div>

      {/* TAB 1: LIVE QUALIFYING PLAYERS PREVIEW */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          {/* Top Live Qualification Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-navy-900/90 border border-purple-500/30 shadow-xl space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase block">စစ်ဆေးနေသည့် ရက်သတ္တပတ်</span>
              <div className="text-sm font-black text-white font-mono">{previewData?.week_span || 'Loading...'}</div>
              <p className="text-[10px] text-purple-300">Mon 00:00 - Sun 23:59 MMT</p>
            </div>

            <div className="p-4 rounded-2xl bg-navy-900/90 border border-purple-500/30 shadow-xl space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase block">ဘောနပ်စ်ရရှိမည့် ကစားသမား</span>
              <div className="text-xl font-black text-amber-300 font-mono">
                {previewData?.total_qualified_players || 0} <span className="text-xs text-slate-400 font-sans">ဦး</span>
              </div>
              <p className="text-[10px] text-slate-400">Total with bets: {previewData?.total_players_with_bets || 0} ဦး</p>
            </div>

            <div className="p-4 rounded-2xl bg-navy-900/90 border border-purple-500/30 shadow-xl space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase block">ခန့်မှန်း ထုတ်ပေးမည့် ဘောနပ်စ်</span>
              <div className="text-xl font-black text-emerald-400 font-mono">
                Ks {(previewData?.total_estimated_bonus || 0).toLocaleString()}
              </div>
              <p className="text-[10px] text-emerald-400/80">Rate: {previewData?.bonus_rate_percent || '10%'}</p>
            </div>

            <div className="p-4 rounded-2xl bg-navy-900/90 border border-purple-500/30 shadow-xl space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase block">စာရင်းရှင်းမည့် အချိန်</span>
              <div className="text-sm font-black text-gold-300 font-mono">
                အင်္ဂါနေ့ ၁၁:၀၀ နာရီ
              </div>
              <p className="text-[10px] text-gold-400/80">{previewData?.settlement_date || 'Tuesday 11:00 AM'}</p>
            </div>
          </div>

          {/* Live Preview Table */}
          <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-gold-500/20 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-serif">
                Active Player Qualification Preview ({filteredPreviewPlayers.length} Players)
              </h3>
              <span className="text-xs text-slate-400">
                သတ်မှတ်ချက်: ဗုဒ္ဓဟူး၊ စနေ၊ တနင်္ဂနွေ (Wed, Sat, Sun) ၃ ရက်စလုံး တစ်ရက်မှမပျက်ဘဲ တစ်ရက်လျှင် &ge; {(previewData?.min_qualifying_bet || 10000).toLocaleString()} MMK ထိုးထားရမည်
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-navy-950/80 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20">
                  <tr>
                    <th className="py-3 px-4">No</th>
                    <th className="py-3 px-4">Player Name</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4 text-right">Total Week Bets</th>
                    <th className="py-3 px-4 text-center">Wed / Sat / Sun (&ge;10,000 MMK)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Estimated Bonus ({previewData?.bonus_rate_percent || '10%'})</th>
                    <th className="py-3 px-4 text-right">Current Wallet Bal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-400 mb-2" />
                        Calculating live player qualification...
                      </td>
                    </tr>
                  ) : filteredPreviewPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        ယခုအပတ်အတွင်း ထိုးထားသော ပုံမှန်ကစားသမား မရှိသေးပါ (No bets placed in current week)
                      </td>
                    </tr>
                  ) : (
                    filteredPreviewPlayers.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-navy-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-3 px-4 font-semibold text-white">{p.player_name}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">{p.player_phone}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          Ks {p.total_week_bets?.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${p.wed_ok ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-500'}`} title={`Wed: ${p.wed_stake?.toLocaleString() || 0} Ks`}>
                              Wed: {p.wed_ok ? '✓' : '✗'}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${p.sat_ok ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-500'}`} title={`Sat: ${p.sat_stake?.toLocaleString() || 0} Ks`}>
                              Sat: {p.sat_ok ? '✓' : '✗'}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${p.sun_ok ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-500'}`} title={`Sun: ${p.sun_stake?.toLocaleString() || 0} Ks`}>
                              Sun: {p.sun_ok ? '✓' : '✗'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">({p.qualifying_days_count || 0}/3 ရက်)</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {p.is_qualified ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> သတ်မှတ်ချက်ပြည့်မီ (Qualified)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" /> ၃ ရက်မပြည့်သေး (Pending 3 Days)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-amber-300 text-sm">
                          {p.estimated_bonus > 0 ? `+Ks ${p.estimated_bonus.toLocaleString()}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-400">
                          Ks {p.balance?.toLocaleString()}
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

      {/* TAB 2: DISTRIBUTED BONUS HISTORY LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-gold-500/20 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-gold-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-serif">
                  Historical Weekly Bonus Distribution Records ({filteredBonuses.length})
                </h3>
              </div>
              <div className="text-xs font-mono text-slate-300">
                စုစုပေါင်းထုတ်ပေးပြီး: <strong className="text-gold-400 font-bold">Ks {totalDistributed.toLocaleString()}</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-navy-950/80 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20">
                  <tr>
                    <th className="py-3 px-4">No / ID</th>
                    <th className="py-3 px-4">Player Name</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">Qualifying Week</th>
                    <th className="py-3 px-4 text-right">Qualifying Bets (MMK)</th>
                    <th className="py-3 px-4 text-center">Days</th>
                    <th className="py-3 px-4 text-right">Bonus Credited (MMK)</th>
                    <th className="py-3 px-4 text-center">Credited Status</th>
                    <th className="py-3 px-4">Credited At (MMT)</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-500">
                        Loading distributed bonus history...
                      </td>
                    </tr>
                  ) : filteredBonuses.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-500">
                        ထုတ်ပေးပြီးသော အပတ်စဉ်ဘောနပ်စ် မှတ်တမ်း မရှိသေးပါ (No bonus logs found)
                      </td>
                    </tr>
                  ) : (
                    filteredBonuses.map((b, idx) => (
                      <tr key={b.id || idx} className="hover:bg-navy-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-purple-400">#{b.id}</td>
                        <td className="py-3 px-4 font-semibold text-white">{b.player_name}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">{b.player_phone}</td>
                        <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{b.week_span}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          Ks {b.qualifying_bets?.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-300">
                          {b.qualifying_days} ရက်
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-400 text-sm">
                          +Ks {b.bonus_amount?.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {b.is_credited ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center gap-1">
                              <CheckCircle className="w-3 h-3" /> CREDITED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              PENDING
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] font-mono">
                          {b.credited_at}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] max-w-xs truncate">
                          {b.notes || 'Tuesday 11:00 AM Settlement'}
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

      {/* TAB 3: BONUS RULES & THRESHOLD SETTINGS */}
      {activeTab === 'rules' && (
        <div className="max-w-2xl bg-navy-900/90 border border-gold-500/20 rounded-2xl shadow-xl p-6 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-gold-500/20">
            <Sliders className="w-5 h-5 text-gold-400" />
            <div>
              <h3 className="text-base font-bold text-white">Active Player Weekly Bonus Rules & Configuration</h3>
              <p className="text-xs text-slate-400 mt-0.5">အပတ်စဉ်ဘောနပ်စ် ရာခိုင်နှုန်းနှင့် အနည်းဆုံးထိုးရမည့် သတ်မှတ်ငွေ ပြင်ဆင်ခြင်း</p>
            </div>
          </div>

          <form onSubmit={handleSaveRules} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                ဘောနပ်စ် ရာခိုင်နှုန်း (Cashback Bonus Rate %)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  required
                  value={formBonusRate}
                  onChange={(e) => setFormBonusRate(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-400"
                />
                <span className="absolute right-3 top-2 text-slate-500 font-bold">%</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Default: 10% (တစ်ပတ်အတွင်း ထိုးကြေး စုစုပေါင်း၏ ၁၀%)</span>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                အနည်းဆုံး ထိုးရမည့် သတ်မှတ်ငွေ (Minimum Qualifying Bet Threshold per Draw Day)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1000"
                  min="0"
                  required
                  value={formMinBet}
                  onChange={(e) => setFormMinBet(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-400"
                />
                <span className="absolute right-3 top-2 text-slate-500 font-bold">MMK</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                ကစားသမားသည် ဗုဒ္ဓဟူး၊ စနေ၊ တနင်္ဂနွေ ပွဲစဉ် (Wed, Sat, Sun) ၃ ရက်စလုံး တစ်ရက်မှမပျက်ဘဲ တစ်ရက်လျှင် အနည်းဆုံး ဤပမာဏ ပြည့်မီအောင် ထိုးရပါမည်။
              </span>
            </div>

            {/* Readonly Schedule Info */}
            <div className="p-4 rounded-xl bg-navy-950 border border-purple-500/20 space-y-2 text-slate-300 text-[11px]">
              <div className="font-bold text-purple-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-purple-400" />
                <span>သတ်မှတ်ထားသော စာရင်းရှင်းလင်းမှု စည်းမျဉ်းများ:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                <li>စာရင်းရှင်းသည့်နေ့: <strong>အပတ်စဉ် အင်္ဂါနေ့ နံနက် ၁၁:၀၀ နာရီ (Tuesday 11:00 AM MMT)</strong></li>
                <li>အကျုံးဝင်သူများ: <strong>ပုံမှန် Active ကစားသမား (UserRole.USER) များသာ</strong> (Agent နှင့် Bot Profile များ အကျုံးမဝင်ပါ)</li>
                <li>ငွေထည့်သွင်းမှု: ကစားသမား၏ <strong>Main Wallet Balance ထဲသို့ တိုက်ရိုက် ထည့်သွင်းပေးပါသည်</strong></li>
              </ul>
            </div>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="submit"
                disabled={savingRules}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-bold text-xs shadow-lg shadow-purple-950 cursor-pointer transition-all disabled:opacity-50"
              >
                {savingRules ? 'သိမ်းဆည်းနေပါသည်...' : 'ပြင်ဆင်မှု သိမ်းဆည်းမည် (Save Changes)'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
