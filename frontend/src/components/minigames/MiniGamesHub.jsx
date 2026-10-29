import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/client';
import { sound } from '../../utils/soundEffects';
import LuckyWheelGame from './LuckyWheelGame';
import CoinFlipGame from './CoinFlipGame';
import DiceRollGame from './DiceRollGame';
import { Sparkles, Wallet, PlusCircle, Volume2, VolumeX, History, Trophy, Clock, CheckCircle2, XCircle } from 'lucide-react';

export default function MiniGamesHub({ onOpenDeposit }) {
  const { user, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('wheel'); // 'wheel' | 'coin' | 'dice' | 'history'
  const [soundEnabled, setSoundEnabled] = useState(sound.enabled);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const handleToggleSound = () => {
    const newState = sound.toggleSound();
    setSoundEnabled(newState);
    if (newState) sound.playClick();
  };

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await apiClient.getMiniGamesHistory(25);
      setHistory(res || []);
    } catch (err) {
      console.error('Failed to load minigames history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner & Wallet Status */}
      <div className="bg-gradient-to-r from-dark-card via-slate-900 to-dark-card border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎮</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                မီနီဂိမ်းများ (Mini-Games)
              </h2>
              <span className="text-[10px] bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Phase 1 Live
              </span>
            </div>
            <p className="text-xs text-slate-400">
              အချိန်မရွေး ချက်ချင်းကစားနိုင်ပြီး ချက်ချင်းအနိုင်ရရှိမည့် ပေါ့ပါးသွက်လက်သော ဂိမ်းများ
            </p>
          </div>

          {/* Wallet pill & sound toggle */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="bg-dark-bg/90 border border-amber-500/30 rounded-2xl px-4 py-2 flex items-center gap-2 shadow-inner">
              <Wallet className="w-4 h-4 text-amber-400" />
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-sans">လက်ကျန်ငွေ</span>
                <span className="text-sm font-mono font-black text-amber-300">
                  {user ? Number(user.balance || 0).toLocaleString() : '0'} ကျပ်
                </span>
              </div>
              <button
                onClick={onOpenDeposit}
                title="ငွေဖြည့်မည်"
                className="ml-1 p-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer shadow-md"
              >
                <PlusCircle className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleToggleSound}
              title={soundEnabled ? 'အသံပိတ်မည်' : 'အသံဖွင့်မည်'}
              className="p-3 rounded-2xl bg-dark-bg/80 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mini-Game Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Lucky Wheel */}
        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('wheel');
          }}
          className={`py-3.5 px-3 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer border ${
            activeTab === 'wheel'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-lg shadow-amber-950/40 border-amber-300 scale-[1.02]'
              : 'bg-dark-card text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-lg">🎡</span>
          <div className="text-left leading-tight">
            <span className="block text-xs font-black">ကံစမ်းမဲဘီး</span>
            <span className={`text-[10px] block font-mono ${activeTab === 'wheel' ? 'text-black/80 font-bold' : 'text-amber-400'}`}>10x Max</span>
          </div>
        </button>

        {/* Head or Tail */}
        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('coin');
          }}
          className={`py-3.5 px-3 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer border ${
            activeTab === 'coin'
              ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-950/40 border-amber-200 scale-[1.02]'
              : 'bg-dark-card text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-lg">🪙</span>
          <div className="text-left leading-tight">
            <span className="block text-xs font-black">ခေါင်း/ပန်း</span>
            <span className={`text-[10px] block font-mono ${activeTab === 'coin' ? 'text-black/80 font-bold' : 'text-emerald-400'}`}>1.96x</span>
          </div>
        </button>

        {/* Dice Roll */}
        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('dice');
          }}
          className={`py-3.5 px-3 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer border ${
            activeTab === 'dice'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black shadow-lg shadow-emerald-950/40 border-emerald-300 scale-[1.02]'
              : 'bg-dark-card text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-lg">🎲</span>
          <div className="text-left leading-tight">
            <span className="block text-xs font-black">အန်စာတုံး</span>
            <span className={`text-[10px] block font-mono ${activeTab === 'dice' ? 'text-black/80 font-bold' : 'text-amber-400'}`}>30x Triple</span>
          </div>
        </button>

        {/* History Tab */}
        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('history');
          }}
          className={`py-3.5 px-3 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer border ${
            activeTab === 'history'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black shadow-lg shadow-purple-950/40 border-purple-300 scale-[1.02]'
              : 'bg-dark-card text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
          }`}
        >
          <History className="w-4 h-4" />
          <div className="text-left leading-tight">
            <span className="block text-xs font-black">မှတ်တမ်း</span>
            <span className={`text-[10px] block font-sans ${activeTab === 'history' ? 'text-purple-200' : 'text-slate-400'}`}>ကစားမှတ်တမ်း</span>
          </div>
        </button>
      </div>

      {/* Main Game Stage */}
      {activeTab === 'wheel' && (
        <LuckyWheelGame onOpenDeposit={onOpenDeposit} onBalanceChange={() => refreshProfile()} />
      )}

      {activeTab === 'coin' && (
        <CoinFlipGame onOpenDeposit={onOpenDeposit} onBalanceChange={() => refreshProfile()} />
      )}

      {activeTab === 'dice' && (
        <DiceRollGame onOpenDeposit={onOpenDeposit} onBalanceChange={() => refreshProfile()} />
      )}

      {/* History Tab Content */}
      {activeTab === 'history' && (
        <div className="bg-dark-card border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-purple-400" />
              <span>မီနီဂိမ်း ကစားမှတ်တမ်း (Recent Mini-Game Plays)</span>
            </h3>
            <button
              onClick={loadHistory}
              className="text-xs text-amber-400 hover:underline cursor-pointer font-bold"
            >
              🔄 ပြန်လည်ရယူမည်
            </button>
          </div>

          {historyLoading ? (
            <div className="py-12 text-center text-slate-400 text-xs animate-pulse">
              မှတ်တမ်းများ ရယူနေပါသည်...
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              မီနီဂိမ်း ကစားထားသော မှတ်တမ်း မရှိသေးပါခင်ဗျာ။
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 max-h-96 overflow-y-auto">
              {history.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">
                      {item.game_type === 'WHEEL' ? '🎡' : item.game_type === 'COIN_FLIP' ? '🪙' : '🎲'}
                    </span>
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>
                          {item.game_type === 'WHEEL' ? 'ကံစမ်းမဲဘီး' : item.game_type === 'COIN_FLIP' ? 'ခေါင်း/ပန်း' : 'အန်စာတုံး'}
                        </span>
                        {item.player_choice && item.player_choice !== 'SPIN' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            {item.player_choice}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                        {item.created_at}
                      </div>
                    </div>
                  </div>

                  <div className="text-right space-y-0.5">
                    <div className="text-slate-400 font-mono text-[11px]">
                      ထိုးကြေး: {item.stake_amount.toLocaleString()} ကျပ်
                    </div>
                    {item.is_win ? (
                      <div className="font-mono font-bold text-emerald-400 text-xs">
                        +{item.payout_amount.toLocaleString()} ကျပ် ({item.payout_multiplier}x)
                      </div>
                    ) : (
                      <div className="text-rose-400 font-mono text-[11px] font-bold">
                        ရှုံး (-{item.stake_amount.toLocaleString()} ကျပ်)
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Coming Soon Teasers (Phase 2 & 3 Games) */}
      <div className="bg-dark-card/40 border border-slate-800/60 rounded-3xl p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400">မကြာမီ လာမည့် မီနီဂိမ်းများ (Coming Soon in Phase 2 & 3):</span>
          <span className="text-[10px] text-amber-400 font-mono font-bold">7 MORE GAMES</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="bg-dark-bg/60 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2 opacity-60">
            <span>🃏</span>
            <div>
              <span className="block font-bold text-slate-300 text-[11px]">Hi-Lo Card Draw</span>
              <span className="text-[9px] text-slate-500 block">ကတ်ကြီး/ကတ်သေး</span>
            </div>
          </div>

          <div className="bg-dark-bg/60 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2 opacity-60">
            <span>✂️</span>
            <div>
              <span className="block font-bold text-slate-300 text-[11px]">Rock, Paper, Scissors</span>
              <span className="text-[9px] text-slate-500 block">ကျောက် စက္ကူ ကတ်ကြေး</span>
            </div>
          </div>

          <div className="bg-dark-bg/60 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2 opacity-60">
            <span>💣</span>
            <div>
              <span className="block font-bold text-slate-300 text-[11px]">Mine Sweeper</span>
              <span className="text-[9px] text-slate-500 block">ဗုံးရှောင်ဂိမ်း</span>
            </div>
          </div>

          <div className="bg-dark-bg/60 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2 opacity-60">
            <span>⚽</span>
            <div>
              <span className="block font-bold text-slate-300 text-[11px]">Penalty Shootout</span>
              <span className="text-[9px] text-slate-500 block">ဘောလုံး ပင်နယ်တီ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
