import React, { useState, useRef, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { sound } from '../../utils/soundEffects';
import { Sparkles, Trophy, RotateCcw, Zap, Flame, Crown, HelpCircle } from 'lucide-react';

export const CARD_WHEEL_SECTORS = [
  { index: 0, rank: 'BANKER', suit: '👑', label: 'BANKER', color: 'emerald', bg: '#059669', textColor: '#ffffff', is_even: false, is_odd: false, tier: 'BANKER' },
  { index: 1, rank: 'K', suit: '♠', label: 'K♠', color: 'black', bg: '#0f172a', textColor: '#f8fafc', is_even: false, is_odd: true, tier: 'HIGH' },
  { index: 2, rank: '2', suit: '♥', label: '2♥', color: 'red', bg: '#dc2626', textColor: '#ffffff', is_even: true, is_odd: false, tier: 'LOW' },
  { index: 3, rank: '7', suit: '♣', label: '7♣', color: 'black', bg: '#0f172a', textColor: '#f8fafc', is_even: false, is_odd: true, tier: 'MID' },
  { index: 4, rank: '4', suit: '♥', label: '4♥', color: 'red', bg: '#dc2626', textColor: '#ffffff', is_even: true, is_odd: false, tier: 'LOW' },
  { index: 5, rank: 'J', suit: '♠', label: 'J♠', color: 'black', bg: '#0f172a', textColor: '#f8fafc', is_even: false, is_odd: true, tier: 'HIGH' },
  { index: 6, rank: '3', suit: '♥', label: '3♥', color: 'red', bg: '#dc2626', textColor: '#ffffff', is_even: false, is_odd: true, tier: 'LOW' },
  { index: 7, rank: '8', suit: '♣', label: '8♣', color: 'black', bg: '#0f172a', textColor: '#f8fafc', is_even: true, is_odd: false, tier: 'MID' },
  { index: 8, rank: '5', suit: '♦', label: '5♦', color: 'red', bg: '#dc2626', textColor: '#ffffff', is_even: false, is_odd: true, tier: 'LOW' },
  { index: 9, rank: 'Q', suit: '♠', label: 'Q♠', color: 'black', bg: '#0f172a', textColor: '#f8fafc', is_even: true, is_odd: false, tier: 'HIGH' },
  { index: 10, rank: '2', suit: '♦', label: '2♦', color: 'red', bg: '#dc2626', textColor: '#ffffff', is_even: true, is_odd: false, tier: 'LOW' },
  { index: 11, rank: '6', suit: '♣', label: '6♣', color: 'black', bg: '#0f172a', textColor: '#f8fafc', is_even: true, is_odd: false, tier: 'MID' },
  { index: 12, rank: '4', suit: '♠', label: '4♠', color: 'black', bg: '#0f172a', textColor: '#f8fafc', is_even: true, is_odd: false, tier: 'LOW' },
  { index: 13, rank: '9', suit: '♦', label: '9♦', color: 'red', bg: '#dc2626', textColor: '#ffffff', is_even: false, is_odd: true, tier: 'MID' },
  { index: 14, rank: '3', suit: '♠', label: '3♠', color: 'black', bg: '#0f172a', textColor: '#f8fafc', is_even: false, is_odd: true, tier: 'LOW' },
  { index: 15, rank: 'K', suit: '♥', label: 'K♥', color: 'red', bg: '#dc2626', textColor: '#ffffff', is_even: false, is_odd: true, tier: 'HIGH' },
  { index: 16, rank: '5', suit: '♠', label: '5♠', color: 'black', bg: '#0f172a', textColor: '#f8fafc', is_even: false, is_odd: true, tier: 'LOW' },
  { index: 17, rank: '7', suit: '♦', label: '7♦', color: 'red', bg: '#dc2626', textColor: '#ffffff', is_even: false, is_odd: true, tier: 'MID' },
  { index: 18, rank: '2', suit: '♣', label: '2♣', color: 'black', bg: '#0f172a', textColor: '#f8fafc', is_even: true, is_odd: false, tier: 'LOW' },
  { index: 19, rank: 'J', suit: '♥', label: 'J♥', color: 'red', bg: '#dc2626', textColor: '#ffffff', is_even: false, is_odd: true, tier: 'HIGH' },
  { index: 20, rank: '4', suit: '♣', label: '4♣', color: 'black', bg: '#0f172a', textColor: '#f8fafc', is_even: true, is_odd: false, tier: 'LOW' },
  { index: 21, rank: '8', suit: '♦', label: '8♦', color: 'red', bg: '#dc2626', textColor: '#ffffff', is_even: true, is_odd: false, tier: 'MID' },
  { index: 22, rank: '3', suit: '♣', label: '3♣', color: 'black', bg: '#0f172a', textColor: '#f8fafc', is_even: false, is_odd: true, tier: 'LOW' },
  { index: 23, rank: 'Q', suit: '♥', label: 'Q♥', color: 'red', bg: '#dc2626', textColor: '#ffffff', is_even: true, is_odd: false, tier: 'HIGH' },
  { index: 24, rank: '5', suit: '♥', label: '5♥', color: 'red', bg: '#dc2626', textColor: '#ffffff', is_even: false, is_odd: true, tier: 'LOW' },
  { index: 25, rank: '6', suit: '♥', label: '6♥', color: 'red', bg: '#dc2626', textColor: '#ffffff', is_even: true, is_odd: false, tier: 'MID' },
  { index: 26, rank: '9', suit: '♠', label: '9♠', color: 'black', bg: '#0f172a', textColor: '#f8fafc', is_even: false, is_odd: true, tier: 'MID' },
];

const CARD_RANKS = [
  { rank: '2', tier: 'LOW', mult: '2.0x', desc: 'Low Rank' },
  { rank: '3', tier: 'LOW', mult: '2.0x', desc: 'Low Rank' },
  { rank: '4', tier: 'LOW', mult: '2.0x', desc: 'Low Rank' },
  { rank: '5', tier: 'LOW', mult: '2.0x', desc: 'Low Rank' },
  { rank: '6', tier: 'MID', mult: '3.5x', desc: 'Mid Rank' },
  { rank: '7', tier: 'MID', mult: '3.5x', desc: 'Mid Rank' },
  { rank: '8', tier: 'MID', mult: '3.5x', desc: 'Mid Rank' },
  { rank: '9', tier: 'MID', mult: '3.5x', desc: 'Mid Rank' },
  { rank: 'J', tier: 'HIGH', mult: '12.0x', desc: 'High Rank' },
  { rank: 'Q', tier: 'HIGH', mult: '12.0x', desc: 'High Rank' },
  { rank: 'K', tier: 'HIGH', mult: '12.0x', desc: 'High Rank' },
];

const PRESET_STAKES = [100, 500, 1000, 2000, 5000, 10000];

export default function CardWheelGame({ onOpenDeposit, onBalanceChange }) {
  const { user, refreshProfile } = useAuth();
  const [stake, setStake] = useState(500);
  const [betType, setBetType] = useState('CARD_RANK'); // 'CARD_RANK' | 'EVEN' | 'ODD' | 'RED' | 'BLACK' | 'STREAK_DOUBLE'
  const [selectedChoice, setSelectedChoice] = useState('9');
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [recentOutcomes, setRecentOutcomes] = useState([]);
  const [currentStreak, setCurrentStreak] = useState(1);
  const [lastHitCard, setLastHitCard] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showRules, setShowRules] = useState(false);

  const tickIntervalRef = useRef(null);
  const currentRotationRef = useRef(0);

  const handleSelectBet = (type, choice) => {
    if (spinning) return;
    sound.playClick();
    setBetType(type);
    setSelectedChoice(choice);
  };

  const handleSpin = async () => {
    if (spinning) return;
    if ((user?.balance || 0) < stake) {
      setErrorMsg('လက်ကျန်ငွေ မလုံလောက်ပါခင်ဗျာ။ ငွေဖြည့်သွင်းပေးပါရန်');
      return;
    }

    try {
      sound.playClick();
      setErrorMsg('');
      setLastResult(null);
      setSpinning(true);

      const payload = {
        bet_type: betType,
        choice: selectedChoice,
        stake: stake,
      };

      const res = await apiClient.spinCardWheel(payload);

      // Total rotations: 5 full turns (1800 deg) + target angle
      const extraSpins = 360 * 5;
      const targetAngle = res.target_angle || 0;
      const newRotation = currentRotationRef.current + extraSpins + (360 - (currentRotationRef.current % 360)) + targetAngle;
      currentRotationRef.current = newRotation;
      setRotation(newRotation);

      // Play tick sounds during spin
      let ticks = 0;
      tickIntervalRef.current = setInterval(() => {
        sound.playSpinTick();
        ticks++;
        if (ticks > 28) clearInterval(tickIntervalRef.current);
      }, 130);

      // Wait 4.5s for spin easing animation
      setTimeout(() => {
        clearInterval(tickIntervalRef.current);
        setSpinning(false);
        setLastResult(res);

        const hitSector = res.sector || {};
        setLastHitCard(hitSector);
        setRecentOutcomes((prev) => [hitSector, ...prev.slice(0, 9)]);

        if (res.is_win) {
          sound.playWin();
          if (res.streak_count && res.streak_count > 1) {
            setCurrentStreak(res.streak_count);
          } else {
            setCurrentStreak(1);
          }
        } else {
          sound.playLoss();
          setCurrentStreak(1);
        }

        refreshProfile();
        if (onBalanceChange) onBalanceChange(res.new_balance);
      }, 4500);

    } catch (err) {
      clearInterval(tickIntervalRef.current);
      setSpinning(false);
      setErrorMsg(err.message || 'ဘီးလှည့်၍ မရပါခင်ဗျာ');
    }
  };

  useEffect(() => {
    return () => clearInterval(tickIntervalRef.current);
  }, []);

  return (
    <div className="space-y-6">
      {/* Game Stage Area */}
      <div className="bg-gradient-to-b from-dark-card via-slate-950 to-dark-bg border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col items-center">
        {/* Glow ambient background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header & Streak Indicator */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800/80 mb-2 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-xl">🃏</span>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                Card Wheel / Roulette
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                  27 Sectors
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">ဖဲချပ် ဘီးလှည့် ရူးလက်ဂိမ်း</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentStreak > 1 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500/20 to-rose-500/20 border border-amber-500/40 animate-pulse">
                <Flame className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black text-amber-300 font-mono">
                  {currentStreak}x STREAK ACTIVE ({currentStreak === 2 ? '2x' : currentStreak === 3 ? '5x' : '10x'} Bonus)!
                </span>
              </div>
            )}
            <button
              onClick={() => setShowRules(!showRules)}
              title="ကစားနည်း ရှင်းလင်းချက်"
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-amber-400" />
            </button>
          </div>
        </div>

        {/* Rules Banner (Expandable) */}
        {showRules && (
          <div className="w-full bg-slate-900/90 border border-amber-500/20 rounded-2xl p-4 text-xs text-slate-300 space-y-2 mb-4 animate-in fade-in duration-200">
            <div className="font-bold text-amber-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Card Wheel ကစားနည်းနှင့် အဆများ
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400">
              <li><strong className="text-white">Low Ranks (2, 3, 4, 5):</strong> အကြိမ်ရေ အများဆုံးပါဝင်ပြီး <strong className="text-emerald-400">2.0x</strong> အလျော်ရရှိမည်။</li>
              <li><strong className="text-white">Mid Ranks (6, 7, 8, 9):</strong> အလယ်အလတ် ပါဝင်ပြီး <strong className="text-amber-400">3.5x</strong> အလျော်ရရှိမည်။</li>
              <li><strong className="text-white">High Ranks (J, Q, K):</strong> အကြိမ်ရေ အနည်းဆုံးပါဝင်ပြီး <strong className="text-purple-400">12.0x</strong> အလျော်ရရှိမည်။</li>
              <li><strong className="text-white">Side Bets (အနီ/အနက်၊ စုံ/မ):</strong> ၁.၉၅ ဆ အလျော်ရရှိမည်။</li>
              <li><strong className="text-white">Consecutive Streak Bonus:</strong> ကတ်နံပါတ်တစ်ခုတည်းကို ဆက်တိုက်ထိုး၍ ၂ ကြိမ်ဆက်ပေါက်ပါက (2x Bonus)၊ ၃ ကြိမ်ဆက်ပေါက်ပါက (5x Bonus)၊ ၄ ကြိမ်နှင့်အထက် (10x Mega Bonus) ပေးပါမည်။</li>
              <li><strong className="text-rose-400">Banker Slot (👑):</strong> Banker ပေါ်ကျပါက ကစားသမားထိုးကြေးများ အိမ်တော်မှ အနိုင်ရမည်။</li>
            </ul>
          </div>
        )}

        {/* Pointer Indicator (Top Flapper) */}
        <div className="relative z-30 -mb-4 flex flex-col items-center filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
          <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[30px] border-t-amber-400 animate-bounce" />
          <div className="w-4 h-4 rounded-full bg-amber-200 -mt-7 shadow-lg" />
        </div>

        {/* 27-Sector Wheel SVG Container */}
        <div className="relative w-72 h-72 sm:w-80 sm:h-80 my-3">
          {/* Wheel Frame Ring */}
          <div className="absolute inset-0 rounded-full border-4 border-amber-500/70 shadow-[0_0_35px_rgba(245,158,11,0.4)] pointer-events-none z-10" />

          {/* Rotating Wheel */}
          <div
            className="w-full h-full rounded-full overflow-hidden shadow-2xl"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 4.5s cubic-bezier(0.12, 0.8, 0.2, 1)' : 'none',
            }}
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {CARD_WHEEL_SECTORS.map((seg, i) => {
                const total = CARD_WHEEL_SECTORS.length; // 27
                const angle = 360 / total; // 13.3333 deg
                const startAngle = i * angle - 90 - angle / 2;
                const endAngle = startAngle + angle;
                const startRad = (startAngle * Math.PI) / 180;
                const endRad = (endAngle * Math.PI) / 180;
                const x1 = 50 + 50 * Math.cos(startRad);
                const y1 = 50 + 50 * Math.sin(startRad);
                const x2 = 50 + 50 * Math.cos(endRad);
                const y2 = 50 + 50 * Math.sin(endRad);

                const textAngle = i * angle;
                const textRad = ((textAngle - 90) * Math.PI) / 180;
                const textX = 50 + 36 * Math.cos(textRad);
                const textY = 50 + 36 * Math.sin(textRad);

                const isBanker = seg.rank === 'BANKER';

                return (
                  <g key={seg.index}>
                    <path
                      d={`M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`}
                      fill={seg.bg}
                      stroke="#020617"
                      strokeWidth="0.4"
                    />
                    <text
                      x={textX}
                      y={textY}
                      fill={seg.textColor}
                      fontSize={isBanker ? '2.8' : '3.6'}
                      fontWeight="900"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${textAngle}, ${textX}, ${textY})`}
                    >
                      {isBanker ? '👑' : `${seg.rank}${seg.suit}`}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Center Hub */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 shadow-2xl border-2 border-amber-200 flex flex-col items-center justify-center z-20">
            <span className="text-slate-950 font-black text-[10px] leading-tight font-serif tracking-wider">SG4D</span>
            <span className="text-xs">🃏</span>
          </div>
        </div>

        {/* Recent Outcomes Trail */}
        {recentOutcomes.length > 0 && (
          <div className="flex items-center gap-1.5 my-2 overflow-x-auto max-w-full pb-1">
            <span className="text-[10px] text-slate-500 font-sans uppercase font-bold shrink-0">Recent:</span>
            {recentOutcomes.map((card, idx) => (
              <span
                key={idx}
                className={`px-2 py-0.5 rounded-lg text-xs font-mono font-black border shadow-sm ${
                  card.rank === 'BANKER'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : card.color === 'red'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-800 text-slate-200 border-slate-700'
                }`}
              >
                {card.rank === 'BANKER' ? '👑 BANKER' : `${card.rank}${card.suit}`}
              </span>
            ))}
          </div>
        )}

        {/* Result Announcement Banner */}
        {lastResult && (
          <div
            className={`w-full max-w-md p-4 rounded-2xl border text-center transition-all animate-in zoom-in-95 duration-200 my-2 ${
              lastResult.is_win
                ? 'bg-gradient-to-r from-emerald-950/80 via-navy-900 to-emerald-950/80 border-emerald-500/40 text-emerald-300'
                : 'bg-gradient-to-r from-rose-950/80 via-navy-900 to-rose-950/80 border-rose-500/40 text-rose-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">{lastResult.is_win ? '🎉' : '💔'}</span>
              <span className="font-black text-base">
                {lastResult.is_win
                  ? `အနိုင်ရရှိပါသည်! +${Number(lastResult.payout).toLocaleString()} MMK`
                  : lastResult.sector?.rank === 'BANKER'
                  ? '👑 Banker ကျသဖြင့် ကံမကောင်းပါခင်ဗျာ'
                  : 'ကံမကောင်းပါခင်ဗျာ၊ နောက်တစ်ခေါက် ထပ်မံကြိုးစားပါ'}
              </span>
            </div>
            <div className="text-xs text-slate-300 mt-1 font-mono">
              Winning Sector:{' '}
              <span className="font-bold text-white">
                {lastResult.sector?.rank === 'BANKER' ? '👑 BANKER' : `${lastResult.sector?.rank}${lastResult.sector?.suit}`}
              </span>{' '}
              | Your Bet: <span className="font-bold text-amber-300">{lastResult.bet_type} ({lastResult.choice})</span>
              {lastResult.is_win && (
                <span className="text-emerald-400 font-bold ml-1">
                  ({lastResult.final_multiplier}x
                  {lastResult.streak_multiplier > 1 && ` [${lastResult.streak_multiplier}x Streak]`})
                </span>
              )}
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="w-full max-w-md p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center font-medium my-1">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Betting Control Board */}
      <div className="bg-dark-card border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5">
        {/* Betting Mode 1: Single Card Ranks */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>🃏</span> Single Card Ranks (ဖဲချပ်နံပါတ် တိုက်ရိုက်ရွေးချယ်ရန်)
            </span>
            <span className="text-[10px] text-amber-400 font-mono">Low 2x | Mid 3.5x | High 12x</span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-11 gap-2">
            {CARD_RANKS.map((c) => {
              const isSelected = betType === 'CARD_RANK' && selectedChoice === c.rank;
              const isHigh = c.tier === 'HIGH';
              const isMid = c.tier === 'MID';

              return (
                <button
                  key={c.rank}
                  disabled={spinning}
                  onClick={() => handleSelectBet('CARD_RANK', c.rank)}
                  className={`p-2.5 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border relative overflow-hidden ${
                    isSelected
                      ? 'bg-gradient-to-b from-amber-400 to-amber-600 text-slate-950 font-black border-amber-200 shadow-lg shadow-amber-950/40 scale-105'
                      : 'bg-slate-900/90 text-white border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="text-base font-black font-mono">{c.rank}</span>
                  <span
                    className={`text-[9px] font-mono font-bold mt-0.5 ${
                      isSelected
                        ? 'text-slate-950 font-black'
                        : isHigh
                        ? 'text-purple-400'
                        : isMid
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {c.mult}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Betting Mode 2: Side Bets */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>⚡</span> Side Bets (ဘေးလောင်းကြေးများ)
            </span>
            <span className="text-[10px] text-slate-400">Side Bets 1.95x | Streak 10x</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {/* RED */}
            <button
              disabled={spinning}
              onClick={() => handleSelectBet('RED', 'RED')}
              className={`py-3 px-3 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                betType === 'RED'
                  ? 'bg-rose-600 text-white font-black border-rose-300 shadow-lg shadow-rose-950/40 scale-[1.02]'
                  : 'bg-rose-950/30 text-rose-300 border-rose-900/50 hover:bg-rose-950/50'
              }`}
            >
              <div className="flex items-center gap-1 font-bold text-xs">
                <span>♥♦</span> အနီကတ် (RED)
              </div>
              <span className="text-[10px] font-mono font-bold mt-0.5">1.95x</span>
            </button>

            {/* BLACK */}
            <button
              disabled={spinning}
              onClick={() => handleSelectBet('BLACK', 'BLACK')}
              className={`py-3 px-3 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                betType === 'BLACK'
                  ? 'bg-slate-700 text-white font-black border-slate-300 shadow-lg shadow-slate-950/40 scale-[1.02]'
                  : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-1 font-bold text-xs">
                <span>♠♣</span> အနက်ကတ် (BLACK)
              </div>
              <span className="text-[10px] font-mono font-bold mt-0.5">1.95x</span>
            </button>

            {/* EVEN */}
            <button
              disabled={spinning}
              onClick={() => handleSelectBet('EVEN', 'EVEN')}
              className={`py-3 px-3 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                betType === 'EVEN'
                  ? 'bg-indigo-600 text-white font-black border-indigo-300 shadow-lg shadow-indigo-950/40 scale-[1.02]'
                  : 'bg-indigo-950/30 text-indigo-300 border-indigo-900/50 hover:bg-indigo-950/50'
              }`}
            >
              <div className="font-bold text-xs">စုံကတ် (EVEN)</div>
              <span className="text-[10px] font-mono font-bold mt-0.5">1.95x</span>
            </button>

            {/* ODD */}
            <button
              disabled={spinning}
              onClick={() => handleSelectBet('ODD', 'ODD')}
              className={`py-3 px-3 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                betType === 'ODD'
                  ? 'bg-cyan-600 text-white font-black border-cyan-300 shadow-lg shadow-cyan-950/40 scale-[1.02]'
                  : 'bg-cyan-950/30 text-cyan-300 border-cyan-900/50 hover:bg-cyan-950/50'
              }`}
            >
              <div className="font-bold text-xs">မကတ် (ODD)</div>
              <span className="text-[10px] font-mono font-bold mt-0.5">1.95x</span>
            </button>

            {/* STREAK DOUBLE HIT */}
            <button
              disabled={spinning}
              onClick={() => handleSelectBet('STREAK_DOUBLE', 'YES')}
              className={`col-span-2 sm:col-span-1 py-3 px-3 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                betType === 'STREAK_DOUBLE'
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-black border-amber-200 shadow-lg shadow-amber-950/40 scale-[1.02]'
                  : 'bg-gradient-to-r from-amber-950/30 to-rose-950/30 text-amber-300 border-amber-900/50 hover:bg-amber-950/50'
              }`}
            >
              <div className="flex items-center gap-1 font-black text-xs">
                <span>🔥</span> ၂ ခါဆက်တူ (SAME)
              </div>
              <span className="text-[10px] font-mono font-bold mt-0.5">10.0x Mega</span>
            </button>
          </div>
        </div>

        {/* Stake Preset Chips */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">ထိုးကြေး (Stake MMK):</span>
            <span className="text-sm font-mono font-black text-amber-300">{stake.toLocaleString()} ကျပ်</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {PRESET_STAKES.map((s) => (
              <button
                key={s}
                disabled={spinning}
                onClick={() => {
                  sound.playClick();
                  setStake(s);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                  stake === s
                    ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow-md shadow-amber-950/30'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                {s.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Big Spin Action Button */}
        <button
          disabled={spinning}
          onClick={handleSpin}
          className={`w-full py-4 rounded-2xl font-black text-base tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer border ${
            spinning
              ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
              : 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 border-amber-300 shadow-xl shadow-amber-950/40 hover:scale-[1.01] active:scale-95'
          }`}
        >
          {spinning ? (
            <>
              <div className="w-5 h-5 border-2 border-slate-400 border-t-amber-400 rounded-full animate-spin" />
              <span>ဘီးလှည့်နေပါသည် (Spinning)...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>ဘီးလှည့်မည် (SPIN NOW) - {stake.toLocaleString()} MMK</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
