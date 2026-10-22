import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import BettingForm from './components/BettingForm';
import LiveSlip from './components/LiveSlip';
import DepositModal from './components/DepositModal';
import ResultsBoard from './components/ResultsBoard';
import BetHistory from './components/BetHistory';
import ProfileView from './components/ProfileView';
import AdminLedger from './components/AdminLedger';
import AdminPortal from './admin/AdminPortal';
import AdminLogin from './admin/AdminLogin';
import AuthModal from './components/AuthModal';
import { useAuth } from './context/AuthContext';
import { useLanguage } from './context/LanguageContext';
import { apiClient } from './api/client';
import { Award, ReceiptText, LineChart, Sparkles, PlusCircle, User, ShieldCheck } from 'lucide-react';

export default function App() {
  const { user, loading: authLoading, isAuthModalOpen, setIsAuthModalOpen } = useAuth();
  const { t } = useLanguage();
  const isAdminRoute = () => {
    if (typeof window === 'undefined') return false;
    const path = (window.location.pathname || '').toLowerCase();
    const hash = (window.location.hash || '').toLowerCase();
    return (
      path.includes('backend') ||
      path.includes('admin') ||
      hash.includes('backend') ||
      hash.includes('admin')
    );
  };
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined' && (
      window.location.pathname.toLowerCase().includes('backend') ||
      window.location.pathname.toLowerCase().includes('admin') || 
      window.location.hash.toLowerCase().includes('admin') ||
      window.location.hash.toLowerCase().includes('backend')
    )) {
      return 'admin';
    }
    return 'betting';
  });
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [slipItems, setSlipItems] = useState([]);
  const [activeDraw, setActiveDraw] = useState(null);
  const [availableDraws, setAvailableDraws] = useState([]);
  const [selectedDrawIds, setSelectedDrawIds] = useState([]);
  const [targetSlipCode, setTargetSlipCode] = useState(null);

  const handleNavigateToSlip = (slipCode) => {
    setTargetSlipCode(slipCode);
    setActiveTab('history');
  };

  useEffect(() => {
    loadDraws();
  }, []);

  useEffect(() => {
    const handleUrlChange = () => {
      if (isAdminRoute()) {
        setActiveTab('admin');
      }
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);


  const loadDraws = async () => {
    try {
      const draws = await apiClient.getAvailableDraws();
      setAvailableDraws(draws || []);
      if (draws && draws.length > 0) {
        // Default select the first upcoming draw
        setSelectedDrawIds([draws[0].id]);
        setActiveDraw(draws[0]);
      } else {
        const fallback = await apiClient.getActiveDraw();
        setActiveDraw(fallback);
        if (fallback?.id) setSelectedDrawIds([fallback.id]);
      }
    } catch (err) {
      console.error('Failed to load draws:', err);
    }
  };

  const handleAddToSlip = (itemOrItems) => {
    if (Array.isArray(itemOrItems)) {
      setSlipItems((prev) => [...prev, ...itemOrItems]);
    } else {
      setSlipItems((prev) => [...prev, itemOrItems]);
    }
  };

  const handleRemoveSlipItem = (index) => {
    const updated = [...slipItems];
    updated.splice(index, 1);
    setSlipItems(updated);
  };

  const handleClearSlip = () => {
    setSlipItems([]);
  };

  // If still checking authentication status
  if (authLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center text-gold-400">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-12 h-12 border-4 border-gold-500/20 border-t-gold-400 rounded-full animate-spin" />
          <p className="text-sm font-bold tracking-wider font-mono">SG4D Myanmar Loading...</p>
        </div>
      </div>
    );
  }

  // 1. STRICT ADMIN ROUTING: If URL or tab is for backend/admin
  if (activeTab === 'admin' || isAdminRoute()) {
    // If not logged in, or logged in as a normal player: ALWAYS show dedicated Admin Login Console
    if (!user || user.role !== 'ADMIN') {
      return (
        <AdminLogin
          onLoginSuccess={() => setActiveTab('admin')}
          onGoToPlayerApp={() => {
            setActiveTab('betting');
            if (window.history && window.history.pushState) {
              window.history.pushState({}, '', '/');
            }
          }}
        />
      );
    }

    // Authenticated as ADMIN: Render Executive Backoffice Portal
    return (
      <AdminPortal
        onBackToApp={() => {
          setActiveTab('betting');
          if (window.history && window.history.pushState) {
            window.history.pushState({}, '', '/');
          }
        }}
      />
    );
  }

  // 2. PLAYER ROUTING: Regular players who are not logged in see Player Login
  if (!user) {
    return (
      <div className="min-h-screen bg-dark-bg text-gray-100 flex flex-col font-['Outfit','Padauk',sans-serif]">
        <AuthModal
          isOpen={true}
          onClose={() => {}}
          allowClose={false}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg text-gray-100 flex flex-col font-['Outfit','Padauk',sans-serif]">
      
      {/* Top Navbar with Golden Peacock Branding */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenDeposit={() => setIsDepositOpen(true)}
        onNavigateToSlip={handleNavigateToSlip}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
        
        {/* TAB 1: 4D Betting */}
        {activeTab === 'betting' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Col: Interactive 4D Entry Form */}
            <div className="lg:col-span-7 space-y-6">
              <BettingForm
                onAddToSlip={handleAddToSlip}
                activeDraw={activeDraw}
                availableDraws={availableDraws}
                selectedDrawIds={selectedDrawIds}
                setSelectedDrawIds={setSelectedDrawIds}
              />
            </div>

            {/* Right Col: Live Bet Slip Queue */}
            <div className="lg:col-span-5">
              <LiveSlip
                items={slipItems}
                onRemoveItem={handleRemoveSlipItem}
                onClearSlip={handleClearSlip}
                activeDraw={activeDraw}
                availableDraws={availableDraws}
                selectedDrawIds={selectedDrawIds}
                setSelectedDrawIds={setSelectedDrawIds}
                onOpenDeposit={() => setIsDepositOpen(true)}
                onBetPlaced={() => {
                  loadDraws();
                }}
              />
            </div>

          </div>
        )}

        {/* TAB 2: Official Results */}
        {activeTab === 'results' && (
          <ResultsBoard />
        )}

        {/* TAB 3: Bet History */}
        {activeTab === 'history' && (
          <BetHistory 
            onBetNow={() => setActiveTab('betting')} 
            targetSlipCode={targetSlipCode}
          />
        )}

        {/* TAB 4: Profile View (Cash in/out history, Change password, Contact us, Sign out) */}
        {activeTab === 'profile' && (
          <ProfileView 
            onOpenWallet={() => setIsDepositOpen(true)} 
          />
        )}

        {/* TAB 5: Admin Financial Ledger */}
        {activeTab === 'admin' && (
          <AdminPortal />
        )}

      </main>

      {/* Mobile Bottom Navigation Bar: "4D Bet" "Results" "+" "Slips" "Profile" */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-dark-surface/95 backdrop-blur-xl border-t border-gold-700/60 px-3 py-2 flex items-center justify-around shadow-2xl">
        <button
          onClick={() => setActiveTab('betting')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'betting' ? 'text-gold-400' : 'text-gray-400'
          }`}
        >
          <Sparkles className="w-5 h-5 mb-0.5" />
          <span>{t('tabBetting')}</span>
        </button>

        <button
          onClick={() => setActiveTab('results')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'results' ? 'text-gold-400' : 'text-gray-400'
          }`}
        >
          <Award className="w-5 h-5 mb-0.5" />
          <span>{t('tabResults')}</span>
        </button>

        {/* Center Quick Action (+) Button: Unified Wallet (Top Up & Withdraw) */}
        <button
          onClick={() => setIsDepositOpen(true)}
          title="Top Up & Withdraw (+)"
          className="flex flex-col items-center justify-center w-12 h-12 -mt-5 rounded-full gold-gradient-btn text-dark-bg shadow-gold hover:shadow-gold-lg transition-transform active:scale-95 cursor-pointer"
        >
          <PlusCircle className="w-6 h-6 text-dark-bg" />
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'history' ? 'text-gold-400' : 'text-gray-400'
          }`}
        >
          <ReceiptText className="w-5 h-5 mb-0.5" />
          <span>{t('tabSlips')}</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'profile' ? 'text-gold-400' : 'text-gray-400'
          }`}
        >
          <User className="w-5 h-5 mb-0.5" />
          <span>{t('tabProfile')}</span>
        </button>
      </nav>

      {/* Global Modals */}
      <DepositModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

    </div>
  );
}
