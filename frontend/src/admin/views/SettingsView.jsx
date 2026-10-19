import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Smartphone, 
  Bell, 
  Send, 
  Plus, 
  Save, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Shield,
  ShieldCheck, 
  QrCode,
  Download,
  Trash2,
  Award,
  Layers,
  Sparkles,
  TrendingUp,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { apiClient } from '../../api/client';

export default function SettingsView({ onNotify }) {
  const [activeTab, setActiveTab] = useState('system'); // 'system' | 'applications' | 'notifications'
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingQr, setUploadingQr] = useState({ wave: false, kpay: false });

  // System Settings state (Screenshot 14)
  const [systemSettings, setSystemSettings] = useState({
    wave_phone: '09894169717',
    wave_name: 'Ye Win Htut',
    wave_qr_url: '/assets/wave_qr_sample.png',
    kpay_phone: '09894169717',
    kpay_name: 'Ye Win Htut',
    kpay_qr_url: '/assets/kpay_qr_sample.png',
    cutoff_time: '16:30',
    result_time: '18:00',
    risk_cap: 11000,
    reward_percentage: 20,
    commission_rate: 30,
    agent_credit_multiplier: 1.6,
    is_agent_credit_enabled: false,
    agent_lvl1_deposit: 100000,
    agent_lvl2_deposit: 300000,
    agent_lvl3_deposit: 500000,
    agent_lvl4_deposit: 800000,
    agent_lvl5_deposit: 1000000,
    agent_lvl2_target_turnover: 2000000,
    agent_lvl3_target_turnover: 5000000,
    agent_lvl4_target_turnover: 10000000,
    agent_lvl5_target_turnover: 20000000,
    telegram_finance_group_id: '',
    auto_approve_max_amount: 50000
  });

  // Application Releases state (Screenshot 13)
  const [releases, setReleases] = useState([]);
  const [isAppModalOpen, setIsAppModalOpen] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [newApkUrl, setNewApkUrl] = useState('');
  const [newForceUpdate, setNewForceUpdate] = useState(false);
  const [newNotes, setNewNotes] = useState('');

  // Notifications state (Screenshots 15 & 16)
  const [notifications, setNotifications] = useState([]);
  const [notifCategory, setNotifCategory] = useState('ALL');
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastCategory, setBroadcastCategory] = useState('ANNOUNCEMENT');

  useEffect(() => {
    loadSettingsData();
  }, [activeTab]);

  const loadSettingsData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'system') {
        const res = await apiClient.getAdminSystemSettings();
        if (res) {
          setSystemSettings((prev) => ({
            ...prev,
            ...res,
            risk_cap: res.risk_cap ?? res.max_amount_per_number ?? 11000,
            cutoff_time: res.cutoff_time ?? res.bet_end_time ?? '16:30',
            result_time: res.result_time ?? res.result_confirm_time ?? '18:00',
            reward_percentage: res.reward_percentage ?? res.consecutive_reward_percent ?? 20,
          }));
        }
      } else if (activeTab === 'applications') {
        const res = await apiClient.getAdminApplications();
        const list = Array.isArray(res) ? res : (res?.results || []);
        setReleases(list);
      } else if (activeTab === 'notifications') {
        const res = await apiClient.getAdminNotifications();
        const list = Array.isArray(res) ? res : (res?.results || []);
        setNotifications(list);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSystemSettings = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        ...systemSettings,
        max_amount_per_number: Number(systemSettings.risk_cap),
        risk_cap: Number(systemSettings.risk_cap),
        bet_end_time: systemSettings.cutoff_time,
        cutoff_time: systemSettings.cutoff_time,
        result_confirm_time: systemSettings.result_time,
        result_time: systemSettings.result_time,
        reward_percentage: Number(systemSettings.reward_percentage),
        consecutive_reward_percent: Number(systemSettings.reward_percentage),
        weekly_bonus_rate: Number(systemSettings.reward_percentage),
        commission_rate: Number(systemSettings.commission_rate || 30),
        telegram_finance_group_id: (systemSettings.telegram_finance_group_id || '').trim(),
        auto_approve_max_amount: Number(systemSettings.auto_approve_max_amount ?? 50000)
      };
      await apiClient.updateAdminSystemSettings(payload);
      if (onNotify) onNotify('System settings & Telegram Finance Alerts updated successfully!', 'success');
      await loadSettingsData();
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Failed to save settings', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQrUpload = async (gateway, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingQr(prev => ({ ...prev, [gateway]: true }));
      const res = await apiClient.uploadAdminPaymentQr(file);
      if (res && res.qr_url) {
        if (gateway === 'wave') {
          setSystemSettings(prev => ({ ...prev, wave_qr_url: res.qr_url }));
        } else if (gateway === 'kpay') {
          setSystemSettings(prev => ({ ...prev, kpay_qr_url: res.qr_url }));
        }
        if (onNotify) onNotify(`${gateway === 'wave' ? 'WavePay' : 'KBZPay'} QR Code uploaded successfully! Click "Save Changes" to apply.`, 'success');
      }
    } catch (err) {
      console.error('QR upload failed:', err);
      if (onNotify) onNotify(err.message || 'QR upload failed', 'error');
    } finally {
      setUploadingQr(prev => ({ ...prev, [gateway]: false }));
    }
  };

  const handleToggleAgentCredit = async () => {
    try {
      const nextStatus = !systemSettings.is_agent_credit_enabled;
      setSystemSettings(prev => ({ ...prev, is_agent_credit_enabled: nextStatus }));
      const res = await apiClient.toggleAdminAgentCredit(nextStatus);
      if (onNotify) onNotify(res.message || `Agent Credit is now ${nextStatus ? 'Active' : 'Suspended'}`, 'success');
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Failed to toggle Agent Credit', 'error');
      await loadSettingsData();
    }
  };

  const handleAddApplication = async (e) => {
    e.preventDefault();
    if (!newVersion || !newApkUrl) return;
    try {
      setSubmitting(true);
      await apiClient.createAdminApplication({
        version_name: newVersion,
        apk_url: newApkUrl,
        is_force_update: newForceUpdate,
        release_notes: newNotes
      });
      if (onNotify) onNotify(`Added release ${newVersion}`, 'success');
      setIsAppModalOpen(false);
      setNewVersion('');
      setNewApkUrl('');
      setNewNotes('');
      loadSettingsData();
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Failed to add application', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastTitle || !broadcastMessage) return;
    try {
      setSubmitting(true);
      await apiClient.createAdminNotification({
        title: broadcastTitle,
        message: broadcastMessage,
        category: broadcastCategory
      });
      if (onNotify) onNotify('Broadcast announcement sent to all players!', 'success');
      setIsNotifModalOpen(false);
      setBroadcastTitle('');
      setBroadcastMessage('');
      loadSettingsData();
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Failed to send broadcast', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const notifList = Array.isArray(notifications) ? notifications : (notifications?.results || []);
  const filteredNotifs = notifList.filter(n => {
    if (notifCategory === 'ALL') return true;
    return n.category === notifCategory;
  });

  return (
    <div className="space-y-6">
      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 bg-navy-900/90 border border-gold-500/20 p-2 rounded-2xl overflow-x-auto">
        <button
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'system'
              ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>System Setting</span>
        </button>

        <button
          onClick={() => setActiveTab('applications')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'applications'
              ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Applications</span>
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'notifications'
              ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notifications</span>
        </button>
      </div>

      {/* TAB 1: System Settings (Screenshot 14) */}
      {activeTab === 'system' && (
        <form onSubmit={handleSaveSystemSettings} className="space-y-6">
          {/* Payment Account Configuration */}
          <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <QrCode className="w-4 h-4 text-gold-400" />
              <span>Official Deposit Accounts (ငွေသွင်းအကောင့် သတ်မှတ်ချက်များ)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* WavePay Receiver */}
              <div className="bg-navy-950 p-4 rounded-xl border border-gold-500/20 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-navy-800">
                  <span className="text-xs font-bold text-gold-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    WavePay Official Receiver
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono">WaveMoney</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Phone Number (ဖုန်းနံပါတ်)</label>
                    <input
                      type="text"
                      value={systemSettings.wave_phone}
                      onChange={(e) => setSystemSettings({ ...systemSettings, wave_phone: e.target.value })}
                      placeholder="09894169717"
                      className="w-full bg-navy-900 border border-gold-500/30 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-gold-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Account Name (အမည်)</label>
                    <input
                      type="text"
                      value={systemSettings.wave_name}
                      onChange={(e) => setSystemSettings({ ...systemSettings, wave_name: e.target.value })}
                      placeholder="Ye Win Htut"
                      className="w-full bg-navy-900 border border-gold-500/30 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-gold-400"
                    />
                  </div>
                </div>

                {/* WavePay QR Code Upload & Preview */}
                <div className="pt-2 border-t border-navy-800/80">
                  <label className="block text-[11px] text-slate-300 font-semibold mb-2 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-amber-400" />
                    <span>Official WavePay QR Code (ငွေလက်ခံ QR Code)</span>
                  </label>

                  <div className="flex items-center gap-4 bg-navy-900/80 p-3 rounded-xl border border-navy-800">
                    <div className="w-20 h-20 rounded-xl bg-black/60 border border-amber-500/40 p-1 flex items-center justify-center shrink-0 shadow-lg overflow-hidden relative group">
                      {systemSettings.wave_qr_url ? (
                        <img 
                          src={systemSettings.wave_qr_url} 
                          alt="WavePay QR" 
                          className="w-full h-full object-contain"
                          onError={(e) => { e.target.src = 'https://api.iconify.design/solar:qr-code-bold-duotone.svg?color=%23f59e0b'; }}
                        />
                      ) : (
                        <QrCode className="w-8 h-8 text-amber-400/60" />
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-md hover:bg-amber-400 transition-all">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{uploadingQr.wave ? 'Uploading QR...' : 'Upload Wave QR'}</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => handleQrUpload('wave', e)} 
                            className="hidden" 
                            disabled={uploadingQr.wave} 
                          />
                        </label>
                        {systemSettings.wave_qr_url && (
                          <button
                            type="button"
                            onClick={() => setSystemSettings({ ...systemSettings, wave_qr_url: '' })}
                            className="text-[11px] text-rose-400 hover:text-rose-300 underline font-medium"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={systemSettings.wave_qr_url || ''}
                        onChange={(e) => setSystemSettings({ ...systemSettings, wave_qr_url: e.target.value })}
                        placeholder="/static/uploads/wave_qr.png"
                        className="w-full bg-navy-950 border border-slate-700/60 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 font-mono focus:outline-none focus:border-amber-400"
                      />
                      <p className="text-[10px] text-slate-500">
                        Supports PNG, JPG, WEBP. App ကစားသူများ ငွေသွင်းရာတွင် ဤ QR Code ကို တိုက်ရိုက် စကင်ဖတ်နိုင်ပါမည်။
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* KBZPay Receiver */}
              <div className="bg-navy-950 p-4 rounded-xl border border-gold-500/20 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-navy-800">
                  <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    KBZPay Official Receiver
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-mono">KBZPay</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Phone Number (ဖုန်းနံပါတ်)</label>
                    <input
                      type="text"
                      value={systemSettings.kpay_phone}
                      onChange={(e) => setSystemSettings({ ...systemSettings, kpay_phone: e.target.value })}
                      placeholder="09798888888"
                      className="w-full bg-navy-900 border border-gold-500/30 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-gold-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Account Name (အမည်)</label>
                    <input
                      type="text"
                      value={systemSettings.kpay_name}
                      onChange={(e) => setSystemSettings({ ...systemSettings, kpay_name: e.target.value })}
                      placeholder="Daw Hla Hla"
                      className="w-full bg-navy-900 border border-gold-500/30 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-gold-400"
                    />
                  </div>
                </div>

                {/* KBZPay QR Code Upload & Preview */}
                <div className="pt-2 border-t border-navy-800/80">
                  <label className="block text-[11px] text-slate-300 font-semibold mb-2 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-blue-400" />
                    <span>Official KBZPay QR Code (ငွေလက်ခံ QR Code)</span>
                  </label>

                  <div className="flex items-center gap-4 bg-navy-900/80 p-3 rounded-xl border border-navy-800">
                    <div className="w-20 h-20 rounded-xl bg-black/60 border border-blue-500/40 p-1 flex items-center justify-center shrink-0 shadow-lg overflow-hidden relative group">
                      {systemSettings.kpay_qr_url ? (
                        <img 
                          src={systemSettings.kpay_qr_url} 
                          alt="KBZPay QR" 
                          className="w-full h-full object-contain"
                          onError={(e) => { e.target.src = 'https://api.iconify.design/solar:qr-code-bold-duotone.svg?color=%233b82f6'; }}
                        />
                      ) : (
                        <QrCode className="w-8 h-8 text-blue-400/60" />
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500 text-white font-bold text-xs shadow-md hover:bg-blue-400 transition-all">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{uploadingQr.kpay ? 'Uploading QR...' : 'Upload KPay QR'}</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => handleQrUpload('kpay', e)} 
                            className="hidden" 
                            disabled={uploadingQr.kpay} 
                          />
                        </label>
                        {systemSettings.kpay_qr_url && (
                          <button
                            type="button"
                            onClick={() => setSystemSettings({ ...systemSettings, kpay_qr_url: '' })}
                            className="text-[11px] text-rose-400 hover:text-rose-300 underline font-medium"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={systemSettings.kpay_qr_url || ''}
                        onChange={(e) => setSystemSettings({ ...systemSettings, kpay_qr_url: e.target.value })}
                        placeholder="/static/uploads/kpay_qr.png"
                        className="w-full bg-navy-950 border border-slate-700/60 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 font-mono focus:outline-none focus:border-blue-400"
                      />
                      <p className="text-[10px] text-slate-500">
                        Supports PNG, JPG, WEBP. App ကစားသူများ ငွေသွင်းရာတွင် ဤ QR Code ကို တိုက်ရိုက် စကင်ဖတ်နိုင်ပါမည်။
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4D Game Operational Rules */}
          <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-gold-400" />
              <span>4D Game Schedule & Limits</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Bet Cutoff Time (MMT)</label>
                <input
                  type="time"
                  value={systemSettings.cutoff_time}
                  onChange={(e) => setSystemSettings({ ...systemSettings, cutoff_time: e.target.value })}
                  className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-gold-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Result Draw Time (MMT)</label>
                <input
                  type="time"
                  value={systemSettings.result_time}
                  onChange={(e) => setSystemSettings({ ...systemSettings, result_time: e.target.value })}
                  className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-gold-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Max Risk per 4D Number (MMK)</label>
                <input
                  type="number"
                  value={systemSettings.risk_cap}
                  onChange={(e) => setSystemSettings({ ...systemSettings, risk_cap: Number(e.target.value) })}
                  className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-1.5 text-xs text-amber-300 font-bold focus:outline-none focus:border-gold-400 font-mono"
                />
                <span className="text-[10px] text-amber-400/90 block mt-1 font-mono">
                  ဂဏန်းတစ်လုံးစီ၏ အမြင့်ဆုံးလက်ခံငွေ (Live Enforced)
                </span>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Weekly Reward / Bonus (%)</label>
                <input
                  type="number"
                  value={systemSettings.reward_percentage}
                  onChange={(e) => setSystemSettings({ ...systemSettings, reward_percentage: Number(e.target.value) })}
                  className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-gold-400 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Agent Level & Credit Multiplier Tier Settings */}
          <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-5 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gold-500/20 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <span>Agent Level & Credit Settings (အေးဂျင့် Level နှင့် Credit ဆ သတ်မှတ်ချက်များ)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  အေးဂျင့်များ၏ စပေါ်ငွေအဆင့်များ၊ Credit ပေးမည့် အဆ (Multiplier) နှင့် Level တက်ရန် လိုအပ်သော ထိုးကြေး သတ်မှတ်ချက်များ
                </p>
              </div>

              {/* Credit Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Credit System Status Toggle */}
                <div className="flex items-center gap-2 bg-navy-950 p-2 px-3 rounded-xl border border-slate-700">
                  <span className="text-[11px] font-bold text-slate-300">Credit စနစ်:</span>
                  <button
                    type="button"
                    onClick={handleToggleAgentCredit}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      systemSettings.is_agent_credit_enabled
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${systemSettings.is_agent_credit_enabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                    <span>{systemSettings.is_agent_credit_enabled ? 'ဖွင့်ထားသည် (Active)' : 'ခေတ္တဆိုင်းငံ့ထားသည် (Suspended)'}</span>
                  </button>
                </div>

                {/* Credit Multiplier Setting */}
                <div className="flex items-center gap-3 bg-navy-950 p-2.5 px-4 rounded-xl border border-amber-500/30">
                  <div>
                    <span className="text-[11px] font-bold text-amber-300 block">Credit Multiplier (အဆ)</span>
                    <span className="text-[10px] text-slate-400">Deposit × Multiplier</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="10"
                      value={systemSettings.agent_credit_multiplier ?? 1.6}
                      onChange={(e) => setSystemSettings({ ...systemSettings, agent_credit_multiplier: parseFloat(e.target.value) || 1.6 })}
                      className="w-16 bg-navy-900 border border-amber-500/50 rounded-lg px-2 py-1 text-sm font-black text-amber-300 text-center font-mono focus:outline-none focus:border-amber-400"
                    />
                    <span className="text-xs font-black text-amber-400">ဆ</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Informational Status Banner */}
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
              systemSettings.is_agent_credit_enabled
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
            }`}>
              <Shield className="w-4 h-4 shrink-0" />
              <span>
                {systemSettings.is_agent_credit_enabled
                  ? `Agent Credit စနစ် ဖွင့်လှစ်ထားပါသည် (Deposit ၏ ${systemSettings.agent_credit_multiplier || 1.6} ဆ Credit ထိုးခွင့်ရရှိပါမည် - e.g. 100,000 Ks လျှင် ${((systemSettings.agent_lvl1_deposit || 100000) * (systemSettings.agent_credit_multiplier || 1.6)).toLocaleString()} Ks)`
                  : `⚠️ Agent Credit စနစ်အား လောလောဆယ် ခေတ္တဆိုင်းငံ့ထားပါသည် (လုံခြုံရေးအရ Agent များ Cash Balance ဖြင့်သာ လောင်းနိုင်ပါသည်) • ပြန်ဖွင့်ပါက စပေါ်ငွေ၏ ${systemSettings.agent_credit_multiplier || 1.6} ဆ (၁၀၀,၀၀၀ ကျပ်လျှင် ၁၆၀,၀၀၀ ကျပ်) Credit အလိုအလျောက် သတ်မှတ်ပေးပါမည်။`}
              </span>
            </div>

            {/* 4-Tier Commission & Turnover Settings Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Tier (အဆင့်)</th>
                    <th className="py-2.5 px-3">Security Deposit (စပေါ်ငွေ - MMK)</th>
                    <th className="py-2.5 px-3">Credit Limit (Deposit × {systemSettings.agent_credit_multiplier || 1.6} ဆ)</th>
                    <th className="py-2.5 px-3">Turnover Target (စုစုပေါင်းထိုးကြေး ပစ်မှတ်)</th>
                    <th className="py-2.5 px-3 text-amber-300">Commission % (ကော်မရှင် ရာခိုင်နှုန်း)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  
                  {/* Tier 1 */}
                  <tr className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-950/40 text-amber-400 font-bold border border-amber-600/30">
                        Tier 1 (Bronze)
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="10000"
                          value={systemSettings.agent_lvl1_deposit ?? 100000}
                          onChange={(e) => setSystemSettings({ ...systemSettings, agent_lvl1_deposit: Number(e.target.value) })}
                          className="w-28 bg-navy-950 border border-gold-500/20 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-slate-400 text-[11px]">Ks</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-purple-300 font-bold text-xs">
                      Ks {((systemSettings.agent_lvl1_deposit || 100000) * (systemSettings.agent_credit_multiplier || 1.6)).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="100000"
                          value={systemSettings.agent_tier1_turnover ?? 3000000}
                          onChange={(e) => setSystemSettings({ ...systemSettings, agent_tier1_turnover: Number(e.target.value) })}
                          className="w-32 bg-navy-950 border border-gold-500/20 rounded-lg px-2.5 py-1 text-xs text-emerald-400 font-bold focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-slate-400 text-[11px]">Ks</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={systemSettings.agent_tier1_commission ?? 15}
                          onChange={(e) => setSystemSettings({ ...systemSettings, agent_tier1_commission: Number(e.target.value) })}
                          className="w-20 bg-navy-950 border border-amber-500/40 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-black text-center focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-amber-400 font-bold text-xs">%</span>
                      </div>
                    </td>
                  </tr>

                  {/* Tier 2 */}
                  <tr className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-1 rounded-lg bg-sky-950/60 text-sky-400 font-bold border border-sky-500/30">
                        Tier 2 (Silver)
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="10000"
                          value={systemSettings.agent_lvl2_deposit ?? 300000}
                          onChange={(e) => setSystemSettings({ ...systemSettings, agent_lvl2_deposit: Number(e.target.value) })}
                          className="w-28 bg-navy-950 border border-gold-500/20 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-slate-400 text-[11px]">Ks</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-purple-300 font-bold text-xs">
                      Ks {((systemSettings.agent_lvl2_deposit || 300000) * (systemSettings.agent_credit_multiplier || 1.6)).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="100000"
                          value={systemSettings.agent_tier2_turnover ?? 6000000}
                          onChange={(e) => setSystemSettings({ ...systemSettings, agent_tier2_turnover: Number(e.target.value), agent_lvl2_target_turnover: Number(e.target.value) })}
                          className="w-32 bg-navy-950 border border-gold-500/20 rounded-lg px-2.5 py-1 text-xs text-emerald-400 font-bold focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-slate-400 text-[11px]">Ks</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={systemSettings.agent_tier2_commission ?? 20}
                          onChange={(e) => setSystemSettings({ ...systemSettings, agent_tier2_commission: Number(e.target.value) })}
                          className="w-20 bg-navy-950 border border-amber-500/40 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-black text-center focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-amber-400 font-bold text-xs">%</span>
                      </div>
                    </td>
                  </tr>

                  {/* Tier 3 */}
                  <tr className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-950/60 text-amber-400 font-bold border border-amber-500/30">
                        Tier 3 (Gold)
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="10000"
                          value={systemSettings.agent_lvl3_deposit ?? 500000}
                          onChange={(e) => setSystemSettings({ ...systemSettings, agent_lvl3_deposit: Number(e.target.value) })}
                          className="w-28 bg-navy-950 border border-gold-500/20 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-slate-400 text-[11px]">Ks</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-purple-300 font-bold text-xs">
                      Ks {((systemSettings.agent_lvl3_deposit || 500000) * (systemSettings.agent_credit_multiplier || 1.6)).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="100000"
                          value={systemSettings.agent_tier3_turnover ?? 10000000}
                          onChange={(e) => setSystemSettings({ ...systemSettings, agent_tier3_turnover: Number(e.target.value), agent_lvl3_target_turnover: Number(e.target.value) })}
                          className="w-32 bg-navy-950 border border-gold-500/20 rounded-lg px-2.5 py-1 text-xs text-emerald-400 font-bold focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-slate-400 text-[11px]">Ks</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={systemSettings.agent_tier3_commission ?? 25}
                          onChange={(e) => setSystemSettings({ ...systemSettings, agent_tier3_commission: Number(e.target.value) })}
                          className="w-20 bg-navy-950 border border-amber-500/40 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-black text-center focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-amber-400 font-bold text-xs">%</span>
                      </div>
                    </td>
                  </tr>

                  {/* Tier 4 */}
                  <tr className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-400 font-bold border border-emerald-500/30">
                        Tier 4 (Platinum / Master)
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="10000"
                          value={systemSettings.agent_lvl4_deposit ?? 1000000}
                          onChange={(e) => setSystemSettings({ ...systemSettings, agent_lvl4_deposit: Number(e.target.value) })}
                          className="w-28 bg-navy-950 border border-gold-500/20 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-slate-400 text-[11px]">Ks</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-purple-300 font-bold text-xs">
                      Ks {((systemSettings.agent_lvl4_deposit || 1000000) * (systemSettings.agent_credit_multiplier || 1.6)).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="100000"
                          value={systemSettings.agent_tier4_turnover ?? 15000000}
                          onChange={(e) => setSystemSettings({ ...systemSettings, agent_tier4_turnover: Number(e.target.value), agent_lvl4_target_turnover: Number(e.target.value) })}
                          className="w-32 bg-navy-950 border border-gold-500/20 rounded-lg px-2.5 py-1 text-xs text-emerald-400 font-bold focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-slate-400 text-[11px]">Ks</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={systemSettings.agent_tier4_commission ?? 30}
                          onChange={(e) => setSystemSettings({ ...systemSettings, agent_tier4_commission: Number(e.target.value) })}
                          className="w-20 bg-navy-950 border border-amber-500/40 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-black text-center focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-amber-400 font-bold text-xs">%</span>
                      </div>
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>

            {/* Informative Rule Box */}
            <div className="p-3.5 rounded-xl bg-navy-950 border border-amber-500/20 flex items-start gap-2.5 text-xs text-slate-300">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-amber-300 block">Tier အဆင့်ဆင့် ကော်မရှင် သတ်မှတ်ချက် စည်းမျဉ်း-</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Agent ကိုယ်တိုင် ထိုးသော ထိုးကြေး (Self-Bets) နှင့် Agent လက်အောက်ရှိ Downline ကစားသူများ ထိုးသော ထိုးကြေး (Downline Bets) ပေါင်းလဒ် (Combined Turnover) ပြည့်မီပါက စနစ်မှ Tier အလိုအလျောက် တိုးမြှင့်ပေးပြီး သက်ဆိုင်ရာ ကော်မရှင်ရာခိုင်နှုန်း (Tier 1: 15%, Tier 2: 20%, Tier 3: 25%, Tier 4: 30%) အား အလိုအလျောက် တွက်ချက်စာရင်းသွင်းပေးမည်ဖြစ်ပါသည်။
                </p>
              </div>
            </div>
          </div>

          {/* Telegram Finance Alert & Topup Security Settings Card */}
          <div className="bg-navy-900/90 border border-sky-500/30 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-500/20 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Send className="w-5 h-5 text-sky-400" />
                  <span>Telegram Finance Alerts & Auto-Approve Security (ငွေကြေး အသိပေးချက်နှင့် လုံခြုံရေး စနစ်)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Topup & Withdraw ငွေပမာဏ ၅၀,၀၀၀ ကျပ်နှင့်အထက် ရှိပါက Telegram Group သို့ အချိန်နှင့်တပြေးညီ အလိုအလျောက် သတိပေးစာ ပေးပို့ခြင်း
                </p>
              </div>

              <span className="px-3 py-1 rounded-xl bg-sky-500/10 text-sky-300 border border-sky-500/30 text-xs font-bold font-mono">
                Real-Time Telegram Sync
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Telegram Finance Group Chat ID */}
              <div className="bg-navy-950 p-3.5 rounded-xl border border-sky-500/20 space-y-2">
                <label className="block text-xs font-bold text-sky-300 flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-sky-400" />
                  <span>Telegram Finance Group Chat ID (သတိပေးစာပို့မည့် Group ID)</span>
                </label>
                <input
                  type="text"
                  value={systemSettings.telegram_finance_group_id || ''}
                  onChange={(e) => setSystemSettings({ ...systemSettings, telegram_finance_group_id: e.target.value })}
                  placeholder="e.g. -1002345678901 (Auto-detected)"
                  className="w-full bg-navy-900 border border-sky-500/30 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-400"
                />
                <div className="p-2.5 rounded-lg bg-navy-900/80 border border-sky-500/10 text-[11px] text-slate-400 space-y-1">
                  <p className="text-sky-200 font-semibold">💡 ချိတ်ဆက်ရန် လွယ်ကူသော နည်းလမ်း-</p>
                  <p>
                    Telegram Group (<a href="https://t.me/+vWUCA2JnQxw2MTNl" target="_blank" rel="noreferrer" className="text-sky-400 underline font-mono">https://t.me/+vWUCA2JnQxw2MTNl</a>) ထဲသို့ <b>@SG4DMyanmarBot</b> အား Add ထည့်ထားပါက Bot မှ Group ID ကို အလိုအလျောက် ရယူချိတ်ဆက်ပေးပါမည်။
                  </p>
                </div>
              </div>

              {/* Auto-Approve Safety Threshold */}
              <div className="bg-navy-950 p-3.5 rounded-xl border border-amber-500/20 space-y-2">
                <label className="block text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Auto-Approve Safety Limit (အလိုအလျောက်အတည်ပြု ကန့်သတ်ချက်)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="5000"
                    min="1000"
                    value={systemSettings.auto_approve_max_amount ?? 50000}
                    onChange={(e) => setSystemSettings({ ...systemSettings, auto_approve_max_amount: Number(e.target.value) })}
                    className="w-full bg-navy-900 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold font-mono focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-xs text-slate-400 font-bold">Ks</span>
                </div>
                <div className="p-2.5 rounded-lg bg-navy-900/80 border border-amber-500/10 text-[11px] text-slate-400 space-y-1">
                  <p className="text-amber-200 font-semibold">🛡️ Fake/AI-Slip ကာကွယ်မှု စည်းမျဉ်း-</p>
                  <p>
                    ငွေပမာဏ <b>{Number(systemSettings.auto_approve_max_amount ?? 50000).toLocaleString()} ကျပ်</b> ထက် များသော ငွေသွင်းမှုများကို AI ပြေစာအတု လိမ်လည်မှုများမှ ကာကွယ်ရန် Auto-Approve မလုပ်ဘဲ Admin ဘက်မှ KPay/WavePay အကောင့်ထဲ စစ်ဆေးပြီးမှ အတည်ပြုပေးရန် Manual Review သို့ ပို့ဆောင်ပါမည်။
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-950 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'Saving Settings...' : 'Save System Settings'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Applications (Screenshot 13) */}
      {activeTab === 'applications' && (
        <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Mobile App Releases (APK)</h3>
            <button
              onClick={() => setIsAppModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add New Application</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-950/80 text-slate-400 uppercase font-bold tracking-wider border-b border-gold-500/20">
                <tr>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Release Date</th>
                  <th className="py-3 px-4 text-center">Force Update</th>
                  <th className="py-3 px-4">Download Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {(Array.isArray(releases) ? releases : (releases?.results || [])).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      No application builds uploaded yet.
                    </td>
                  </tr>
                ) : (
                  (Array.isArray(releases) ? releases : (releases?.results || [])).map((rel, i) => (
                    <tr key={i} className="hover:bg-navy-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-gold-300">
                        {rel.version_name || `Salone4D_V1.0.${15 - i}`}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {rel.created_at?.slice(0, 10) || '2026-10-14'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          rel.is_force_update ? 'bg-rose-500/20 text-rose-300' : 'bg-navy-800 text-slate-400'
                        }`}>
                          {rel.is_force_update ? 'REQUIRED' : 'OPTIONAL'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <a
                          href={rel.apk_url || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="text-gold-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download APK</span>
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Notifications Center (Screenshots 15 & 16) */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-navy-900/90 border border-gold-500/20 p-4 rounded-2xl">
            <div className="flex items-center gap-2">
              {['ALL', 'WITHDRAW', 'ANNOUNCEMENT', 'WIN'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setNotifCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    notifCategory === cat
                      ? 'bg-amber-500 text-slate-950 font-extrabold'
                      : 'bg-navy-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsNotifModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-950 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>+ Send Broadcast Announcement</span>
            </button>
          </div>

          {/* Notifications List */}
          <div className="space-y-3">
            {filteredNotifs.length === 0 ? (
              <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-8 text-center text-slate-500 text-xs">
                No notifications in this category.
              </div>
            ) : (
              filteredNotifs.map((n) => (
                <div
                  key={n.id}
                  className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-4 flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-gold-300 text-[10px] font-bold">
                        {n.category || 'ANNOUNCEMENT'}
                      </span>
                      <h4 className="text-xs font-bold text-white">{n.title}</h4>
                    </div>
                    <p className="text-xs text-slate-300">{n.message}</p>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {n.created_at || 'Just now'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Broadcast Announcement Modal */}
      {isNotifModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-navy-900 border border-gold-500/30 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gold-500/20 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-gold-400" />
                <span>Create Broadcast Notification</span>
              </h3>
              <button
                onClick={() => setIsNotifModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Category</label>
                <select
                  value={broadcastCategory}
                  onChange={(e) => setBroadcastCategory(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-gold-400"
                >
                  <option value="ANNOUNCEMENT">Announcement (အသိပေးကြေညာချက်)</option>
                  <option value="PROMOTION">Special Promotion</option>
                  <option value="MAINTENANCE">System Maintenance</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 📢 စနေနေ့ အထူးမဲဖွင့်ပွဲ အသိပေးချက်"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-gold-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Message Body</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Enter message visible to all players in real-time..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-gold-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNotifModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-navy-800 text-slate-300 font-semibold hover:bg-navy-750"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-950 cursor-pointer"
                >
                  {submitting ? 'Sending...' : 'Send Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Application Modal */}
      {isAppModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-navy-900 border border-gold-500/30 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gold-500/20 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-gold-400" />
                <span>Add Application Release</span>
              </h3>
              <button
                onClick={() => setIsAppModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddApplication} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Version Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Salone4D_V1.0.16"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-gold-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Direct APK Download URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://sg4d.com/downloads/Salone4D_V1.0.16.apk"
                  value={newApkUrl}
                  onChange={(e) => setNewApkUrl(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-gold-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Release Notes</label>
                <textarea
                  rows={3}
                  placeholder="Bug fixes and performance improvements..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/30 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-gold-400"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="forceCheck"
                  checked={newForceUpdate}
                  onChange={(e) => setNewForceUpdate(e.target.checked)}
                  className="w-4 h-4 rounded border-gold-500/30 bg-navy-950 text-amber-500 focus:ring-0"
                />
                <label htmlFor="forceCheck" className="text-slate-300 cursor-pointer">
                  Require Force Update (Block outdated app versions)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAppModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-navy-800 text-slate-300 font-semibold hover:bg-navy-750"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-950 cursor-pointer"
                >
                  {submitting ? 'Adding...' : 'Add Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
