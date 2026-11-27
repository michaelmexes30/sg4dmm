import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  LayoutDashboard, 
  Dice5, 
  Wallet, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut, 
  ChevronDown, 
  ChevronRight, 
  Sun, 
  Moon, 
  Globe, 
  ShieldCheck, 
  Sparkles,
  Bell,
  CheckCircle,
  AlertCircle,
  Menu,
  X,
  Lock,
  Gamepad2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import logoImg from '../assets/logo.png';
import { apiClient } from '../api/client';

// Views
import Game4DView from './views/Game4DView';
import BetHistoryView from './views/BetHistoryView';
import Game2DView from './views/Game2DView';
import BetHistory2DView from './views/BetHistory2DView';
import Game3DView from './views/Game3DView';
import BetHistory3DView from './views/BetHistory3DView';
import WithdrawView from './views/WithdrawView';
import SystemUsersView from './views/SystemUsersView';
import AppUsersView from './views/AppUsersView';
import FakeUsersView from './views/FakeUsersView';
import ReportsView from './views/ReportsView';
import SettingsView from './views/SettingsView';
import AgentCommissionView from './views/AgentCommissionView';
import WeeklyBonusView from './views/WeeklyBonusView';
import DashboardOverviewView from './views/DashboardOverviewView';
import DepositView from './views/DepositView';
import MiniGamesAdminView from './views/MiniGamesAdminView';

class ViewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Error rendered in Admin View:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl bg-navy-900 border border-rose-500/40 text-rose-300 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-white">စာမျက်နှာ ဖွင့်ရာတွင် အမှားတစ်ခု ဖြစ်ပေါ်ခဲ့ပါသည် (Render Error)</h4>
              <p className="text-xs text-rose-400/90 mt-0.5">{this.state.error?.message || 'Unknown view error'}</p>
            </div>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer"
          >
            ပြန်လည်စမ်းသပ်မည် (Try Again)
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AdminPortal({ onBackToApp }) {
  const { user, logout } = useAuth();
  const { t, lang, toggleLanguage } = useLanguage();

  // Active view: default to Executive Dashboard Overview
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [companyBalance, setCompanyBalance] = useState(0);
  const [balanceMonth, setBalanceMonth] = useState(() => new Date().toLocaleString('en-US', { month: 'short' }));
  const [pendingCounts, setPendingCounts] = useState({ deposits: 0, withdrawals: 0 });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  // Clean collapsible sidebar groups (Finance open by default for fast audit workflow)
  const [expandedGroups, setExpandedGroups] = useState({
    'balance': true,
    '4d': false,
    '2d': false,
    '3d': false,
    'members': false,
    'reports': false
  });

  useEffect(() => {
    loadCompanyBalance();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadCompanyBalance();
      }
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadCompanyBalance();
      }
    };

    const handleBalanceEvent = (e) => {
      if (e.detail && e.detail.company_balance !== undefined) {
        setCompanyBalance(e.detail.company_balance);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('companyBalanceUpdated', handleBalanceEvent);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('companyBalanceUpdated', handleBalanceEvent);
    };
  }, []);

  const loadCompanyBalance = async () => {
    try {
      const res = await apiClient.getAdminCompanyBalance();
      if (res && res.company_balance !== undefined) {
        setCompanyBalance(res.company_balance);
        if (res.month_label) {
          setBalanceMonth(res.month_label);
        }
        if (res.pending_deposits_count !== undefined || res.pending_withdrawals_count !== undefined) {
          setPendingCounts({
            deposits: Number(res.pending_deposits_count || 0),
            withdrawals: Number(res.pending_withdrawals_count || 0)
          });
        }
        return;
      }
    } catch (err) {
      console.error('Failed to load company balance from endpoint:', err);
    }

    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      const fin = await apiClient.getAdminFinancialReport({
        from_date: `${year}-${month}-01`,
        to_date: `${year}-${month}-${String(lastDay).padStart(2, '0')}`
      });
      const monthName = now.toLocaleString('en-US', { month: 'short' });
      setBalanceMonth(monthName);
      if (fin && fin.sub_total && fin.sub_total.company_balance !== undefined) {
        setCompanyBalance(fin.sub_total.company_balance);
      }
    } catch (e) {
      console.error('Failed to load company balance fallback:', e);
    }
  };

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const toggleGroup = (group) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  const MENU_PARENT_MAP = {
    '4d-game': '4d',
    '4d-past-games': '4d',
    '4d-bet-history': '4d',
    '2d-game': '2d',
    '2d-past-games': '2d',
    '2d-bet-history': '2d',
    '3d-game': '3d',
    '3d-past-games': '3d',
    '3d-bet-history': '3d',
    'top-up': 'balance',
    'withdraw': 'balance',
    'system-users': 'members',
    'app-users': 'members',
    'agent-commissions': 'members',
    'fake-users': 'members',
    'reports-financial': 'reports',
    'weekly-bonuses': 'reports'
  };

  const handleSelectMenu = (menuKey) => {
    const parentGroup = MENU_PARENT_MAP[menuKey];
    if (parentGroup) {
      setExpandedGroups((prev) => (prev[parentGroup] ? prev : { ...prev, [parentGroup]: true }));
    }
    setActiveMenu(menuKey);
    setMobileMenuOpen(false);
  };

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-navy-900 border border-gold-500/30 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Access Denied (ဝင်ရောက်ခွင့်မရှိပါ)</h2>
            <p className="text-xs text-gray-400 mt-2">
              ဤစာမျက်နှာသည် Chief Administrator သီးသန့်ဖြစ်ပါသည်။ သင့်အကောင့်တွင် စီမံခန့်ခွဲခွင့် မရှိပါခင်ဗျာ။
            </p>
          </div>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="w-full py-3 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-xs transition-all cursor-pointer"
          >
            ပင်မစာမျက်နှာသို့ ပြန်သွားမည်
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Header Bar (Legacy Luxury Navy & Gold) */}
      <header className="sticky top-0 z-40 bg-[#0b1120]/95 border-b border-slate-800 backdrop-blur-md px-4 sm:px-6 h-16 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-navy-800 text-slate-300"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Brand Logo & Title with Cinzel Serif and Gold Gradient */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-500/40 p-1.5 flex items-center justify-center shadow-lg">
              <img 
                src={logoImg} 
                alt="Logo" 
                className="w-full h-full object-contain" 
                onError={(e) => { e.target.src = 'https://api.iconify.design/solar:crown-line-duotone.svg?color=%23d4af37'; }} 
              />
            </div>
            <div>
              <h1 className="font-sans text-sm sm:text-base font-black text-white tracking-wide leading-none">
                SG4D MYANMAR
              </h1>
              <p className="text-[9px] uppercase tracking-widest text-blue-400 font-bold leading-none mt-1">
                Salone4D Agent Edition
              </p>
            </div>
          </div>
        </div>

        {/* Center: Live Company Balance (Net Profit Formula) */}
        <div className="hidden md:flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-1.5 rounded-xl shadow-inner">
          <span className="text-[11px] text-slate-400 font-semibold">Company Balance ({balanceMonth}) =</span>
          <span className={`text-xs sm:text-sm font-black font-mono ${companyBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {companyBalance < 0 
              ? `-Ks ${Math.abs(companyBalance).toLocaleString()}` 
              : `Ks ${companyBalance.toLocaleString()}`}
          </span>
        </div>

        {/* Right Tools (Admin User profile, Logout) */}
        <div className="flex items-center gap-2 sm:gap-3">

          <div className="hidden sm:flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-xl border border-slate-700 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-white">{user?.nickname || user?.username || 'Michael'}</span>
            <span className="text-[10px] bg-blue-500/20 text-blue-300 font-mono px-1.5 py-0.5 rounded border border-blue-500/30">
              {user?.role || 'ADMIN'}
            </span>
          </div>

          <button
            onClick={logout}
            title="Sign Out"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/15 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Navigation (De-duplicated & Audit-Friendly) */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 bg-[#0b1120] border-r border-slate-800 pt-16 lg:pt-0 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 text-xs font-semibold">
            
            {/* 1. Dashboard */}
            <button
              onClick={() => handleSelectMenu('dashboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeMenu === 'dashboard'
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            {/* 2. Finance (Deposit & Top Up, Withdraw Review) */}
            <div>
              <button
                onClick={() => toggleGroup('balance')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  <span>Finance</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {(pendingCounts.deposits + pendingCounts.withdrawals) > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      {pendingCounts.deposits + pendingCounts.withdrawals}
                    </span>
                  )}
                  {expandedGroups['balance'] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </div>
              </button>

              {expandedGroups['balance'] && (
                <div className="pl-9 pr-1 py-1 space-y-1">
                  <button
                    onClick={() => handleSelectMenu('top-up')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                      activeMenu === 'top-up' ? 'bg-blue-600/20 text-blue-300 font-bold border border-blue-500/30' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Deposit & Top Up</span>
                    {pendingCounts.deposits > 0 && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono font-bold px-1.5 py-0.5 rounded-full border border-amber-500/40">
                        {pendingCounts.deposits}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => handleSelectMenu('withdraw')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                      activeMenu === 'withdraw' ? 'bg-blue-600/20 text-blue-300 font-bold border border-blue-500/30' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Withdraw Review</span>
                    {pendingCounts.withdrawals > 0 && (
                      <span className="text-[10px] bg-rose-500/20 text-rose-300 font-mono font-bold px-1.5 py-0.5 rounded-full border border-rose-500/40">
                        {pendingCounts.withdrawals}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* 3. Singapore 4D */}
            <div>
              <button
                onClick={() => toggleGroup('4d')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Dice5 className="w-4 h-4 text-blue-400" />
                  <span>Singapore 4D</span>
                </div>
                {expandedGroups['4d'] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              {expandedGroups['4d'] && (
                <div className="pl-9 pr-1 py-1 space-y-1">
                  <button
                    onClick={() => handleSelectMenu('4d-game')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                      activeMenu === '4d-game' ? 'bg-blue-600/20 text-blue-300 font-bold border border-blue-500/30' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Live & Closed
                  </button>
                  <button
                    onClick={() => handleSelectMenu('4d-past-games')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                      activeMenu === '4d-past-games' ? 'bg-blue-600/20 text-blue-300 font-bold border border-blue-500/30' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Past Results
                  </button>
                  <button
                    onClick={() => handleSelectMenu('4d-bet-history')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                      activeMenu === '4d-bet-history' ? 'bg-blue-600/20 text-blue-300 font-bold border border-blue-500/30' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Bet History
                  </button>
                </div>
              )}
            </div>

            {/* 4. Thai 2D */}
            <div>
              <button
                onClick={() => toggleGroup('2d')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] font-black flex items-center justify-center border border-amber-500/40">
                    2D
                  </span>
                  <span>Thai 2D</span>
                </div>
                {expandedGroups['2d'] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              {expandedGroups['2d'] && (
                <div className="pl-9 pr-1 py-1 space-y-1">
                  <button
                    onClick={() => handleSelectMenu('2d-game')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                      activeMenu === '2d-game' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Live & Closed
                  </button>
                  <button
                    onClick={() => handleSelectMenu('2d-past-games')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                      activeMenu === '2d-past-games' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Past Results
                  </button>
                  <button
                    onClick={() => handleSelectMenu('2d-bet-history')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                      activeMenu === '2d-bet-history' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Bet History
                  </button>
                </div>
              )}
            </div>

            {/* 5. Thai 3D */}
            <div>
              <button
                onClick={() => toggleGroup('3d')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-lg bg-purple-500/20 text-purple-300 text-[10px] font-black flex items-center justify-center border border-purple-500/40">
                    3D
                  </span>
                  <span>Thai 3D</span>
                </div>
                {expandedGroups['3d'] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              {expandedGroups['3d'] && (
                <div className="pl-9 pr-1 py-1 space-y-1">
                  <button
                    onClick={() => handleSelectMenu('3d-game')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                      activeMenu === '3d-game' ? 'bg-purple-600/20 text-purple-300 font-bold border border-purple-500/30' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Live & Closed
                  </button>
                  <button
                    onClick={() => handleSelectMenu('3d-past-games')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                      activeMenu === '3d-past-games' ? 'bg-purple-600/20 text-purple-300 font-bold border border-purple-500/30' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Past Results
                  </button>
                  <button
                    onClick={() => handleSelectMenu('3d-bet-history')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                      activeMenu === '3d-bet-history' ? 'bg-purple-600/20 text-purple-300 font-bold border border-purple-500/30' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Bet History
                  </button>
                </div>
              )}
            </div>

            {/* 6. Mini-Games & RTP (Single direct item — tabs handled inside MiniGamesAdminView) */}
            <button
              onClick={() => handleSelectMenu('minigames')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeMenu === 'minigames'
                  ? 'bg-gold-500/20 text-gold-300 font-bold border border-gold-500/40'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Gamepad2 className="w-4 h-4 text-gold-400" />
                <span>Mini-Games & RTP</span>
              </div>
              <span className="text-[9px] bg-gold-500/20 text-gold-300 font-mono font-bold px-1.5 py-0.5 rounded border border-gold-500/30">
                LIVE
              </span>
            </button>

            {/* 7. Members */}
            <div>
              <button
                onClick={() => toggleGroup('members')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span>Members</span>
                </div>
                {expandedGroups['members'] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              {expandedGroups['members'] && (
                <div className="pl-9 pr-1 py-1 space-y-1">
                  <button
                    onClick={() => handleSelectMenu('app-users')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                      activeMenu === 'app-users' ? 'bg-blue-600/20 text-blue-300 font-bold border border-blue-500/30' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    App Players
                  </button>
                  <button
                    onClick={() => handleSelectMenu('agent-commissions')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                      activeMenu === 'agent-commissions' ? 'bg-blue-600/20 text-blue-300 font-bold border border-blue-500/30' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Agent Commission</span>
                    <span className="text-[10px] text-blue-400 font-mono font-bold">30%</span>
                  </button>
                  <button
                    onClick={() => handleSelectMenu('system-users')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                      activeMenu === 'system-users' ? 'bg-blue-600/20 text-blue-300 font-bold border border-blue-500/30' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    System Users
                  </button>
                  <button
                    onClick={() => handleSelectMenu('fake-users')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                      activeMenu === 'fake-users' ? 'bg-blue-600/20 text-blue-300 font-bold border border-blue-500/30' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Simulated Profiles
                  </button>
                </div>
              )}
            </div>

            {/* 8. Reports */}
            <div>
              <button
                onClick={() => toggleGroup('reports')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-4 h-4 text-rose-400" />
                  <span>Reports</span>
                </div>
                {expandedGroups['reports'] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              {expandedGroups['reports'] && (
                <div className="pl-9 pr-1 py-1 space-y-1">
                  <button
                    onClick={() => handleSelectMenu('reports-financial')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                      activeMenu === 'reports-financial' ? 'bg-blue-600/20 text-blue-300 font-bold border border-blue-500/30' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Financial Reports & Ledgers
                  </button>
                  <button
                    onClick={() => handleSelectMenu('weekly-bonuses')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                      activeMenu === 'weekly-bonuses' ? 'bg-blue-600/20 text-blue-300 font-bold border border-blue-500/30' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Weekly Bonuses</span>
                    <span className="text-[10px] text-purple-400 font-mono font-bold">10%</span>
                  </button>
                </div>
              )}
            </div>

            {/* 9. Settings (Single direct item) */}
            <button
              onClick={() => handleSelectMenu('settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeMenu === 'settings'
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>System & App Settings</span>
            </button>

          </div>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#070b14]">
          
          {/* Notification Toast */}
          {notification && (
            <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-xl border animate-fade-in ${
              notification.type === 'error'
                ? 'bg-rose-950/80 border-rose-700 text-rose-200'
                : notification.type === 'info'
                ? 'bg-blue-950/80 border-blue-700 text-blue-200'
                : 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
            }`}>
              {notification.type === 'error' ? (
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              ) : (
                <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
              )}
              <span>{notification.msg}</span>
            </div>
          )}

          {/* Route to Active View */}
          <ViewErrorBoundary key={activeMenu}>
            {activeMenu === 'dashboard' && (
              <DashboardOverviewView onNotify={showNotification} onNavigate={handleSelectMenu} />
            )}

            {activeMenu === '4d-game' && (
              <Game4DView onNotify={showNotification} mode="live" />
            )}

            {activeMenu === '4d-past-games' && (
              <Game4DView onNotify={showNotification} mode="past" />
            )}

            {activeMenu === '4d-bet-history' && (
              <BetHistoryView onNotify={showNotification} />
            )}

            {activeMenu === '2d-game' && (
              <Game2DView onNotify={showNotification} mode="live" />
            )}

            {activeMenu === '2d-past-games' && (
              <Game2DView onNotify={showNotification} mode="past" />
            )}

            {activeMenu === '2d-bet-history' && (
              <BetHistory2DView onNotify={showNotification} />
            )}

            {activeMenu === '3d-game' && (
              <Game3DView onNotify={showNotification} mode="live" />
            )}

            {activeMenu === '3d-past-games' && (
              <Game3DView onNotify={showNotification} mode="past" />
            )}

            {activeMenu === '3d-bet-history' && (
              <BetHistory3DView onNotify={showNotification} />
            )}

            {activeMenu === 'top-up' && (
              <DepositView onNotify={showNotification} />
            )}

            {activeMenu === 'withdraw' && (
              <WithdrawView onNotify={showNotification} />
            )}

            {activeMenu === 'system-users' && (
              <SystemUsersView onNotify={showNotification} />
            )}

            {activeMenu === 'app-users' && (
              <AppUsersView onNotify={showNotification} />
            )}

            {activeMenu === 'agent-commissions' && (
              <AgentCommissionView onNotify={showNotification} />
            )}

            {activeMenu === 'fake-users' && (
              <FakeUsersView onNotify={showNotification} />
            )}

            {activeMenu === 'reports-financial' && (
              <ReportsView gameFilter="ALL" initialTab="financial" onNotify={showNotification} />
            )}

            {activeMenu === 'weekly-bonuses' && (
              <WeeklyBonusView onNotify={showNotification} />
            )}

            {activeMenu === 'settings' && (
              <SettingsView onNotify={showNotification} />
            )}

            {activeMenu === 'minigames' && (
              <MiniGamesAdminView initialTab="game" onNotify={showNotification} />
            )}
          </ViewErrorBoundary>

        </main>
      </div>
    </div>
  );
}
