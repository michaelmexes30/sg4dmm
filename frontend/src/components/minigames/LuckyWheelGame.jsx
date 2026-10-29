import React, { useState, useRef, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { sound } from '../../utils/soundEffects';
import { Sparkles, Trophy, RotateCcw, Zap } from 'lucide-react';

const SEGMENTS = [
  { index: 0, multiplier: 0.0, label: '0x', desc: 'ကံမကောင်းပါ', color: '#dc2626', textColor: '#ffffff' },
  { index: 1, multiplier: 0.5, label: '0.5x', desc: 'တစ်ဝက်', color: '#ea580c', textColor: '#ffffff' },
  { index: 2, multiplier: 1.2, label: '1.2x', desc: '၁.၂ ဆ', color: '#2563eb', textColor: '#ffffff' },
  { index: 3, multiplier: 1.5, label: '1.5x', desc: '၁.၅ ဆ', color: '#059669', textColor: '#ffffff' },
  { index: 4, multiplier: 2.0, label: '2.0x', desc: '၂ ဆ', color: '#7c3aed', textColor: '#ffffff' },
  { index: 5, multiplier: 3.0, label: '3.0x', desc: '၃ ဆ', color: '#db2777', textColor: '#ffffff' },
  { index: 6, multiplier: 5.0, label: '5.0x', desc: '၅ ဆ', color: '#0891b2', textColor: '#ffffff' },
  { index: 7, multiplier: 10.0, label: '10x', desc: 'JACKPOT!', color: '#eab308', textColor: '#000000' },
];

const PRESET_STAKES = [100, 200, 500, 1000, 2000, 5000, 10000];

export default function LuckyWheelGame({ onOpenDeposit, onBalanceChange }) {
  const { user, refreshProfile } = useAuth();
  const [stake, setStake] = useState(500);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const tickIntervalRef = useRef(null);

  const currentRotationRef = useRef(0);

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

      const res = await apiClient.spinWheel(stake);

      // Total rotations: 5 full turns (1800 deg) + target angle
      const extraSpins = 360 * 5;
      const targetAngle = res.target_angle;
      const newRotation = currentRotationRef.current + extraSpins + (360 - (currentRotationRef.current % 360)) + targetAngle;
      currentRotationRef.current = newRotation;
      setRotation(newRotation);

      // Play tick sounds during spin
      let ticks = 0;
      tickIntervalRef.current = setInterval(() => {
        sound.playSpinTick();
        ticks++;
        if (ticks > 25) clearInterval(tickIntervalRef.current);
      }, 140);

      // Wait for 4.5s spin animation to finish
      setTimeout(() => {
        clearInterval(tickIntervalRef.current);
        setSpinning(false);
        setLastResult(res);

        if (res.is_win && res.multiplier >= 1.0) {
          sound.playWin();
        } else {
          sound.playLoss();
        }

        refreshProfile();
        if (onBalanceChange) onBalanceChange(res.new_balance);
      }, 4500);

    } catch (err) {
      clearInterval(tickIntervalRef.current);
      setSpinning(false);
      setErrorMsg(err.message || 'လှည့်၍ မရပါခင်ဗျာ');
    }
  };

  useEffect(() => {
    return () => clearInterval(tickIntervalRef.current);
  }, []);

  return (
    <div className="space-y-6">
      {/* Game Stage Area */}
      <div className="bg-gradient-to-b from-dark-card to-dark-bg border border-amber-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col items-center">
        {/* Glow ambient background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Pointer indicator */}
        <div className="relative z-20 -mb-4 flex flex-col items-center filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
          <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[28px] border-t-amber-400 animate-bounce" />
          <div className="w-4 h-4 rounded-full bg-amber-300 -mt-7 shadow-md" />
        </div>

        {/* Wheel SVG Container */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 my-2">
          {/* Wheel Frame Ring */}
          <div className="absolute inset-0 rounded-full border-4 border-amber-500/60 shadow-[0_0_30px_rgba(245,158,11,0.3)] pointer-events-none z-10" />

          {/* Rotating Wheel */}
          <div
            className="w-full h-full rounded-full overflow-hidden shadow-2xl"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 4.5s cubic-bezier(0.12, 0.8, 0.2, 1)' : 'none',
            }}
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {SEGMENTS.map((seg, i) => {
                const angle = 360 / SEGMENTS.length; // 45 deg
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
                const textX = 50 + 32 * Math.cos(textRad);
                const textY = 50 + 32 * Math.sin(textRad);

                return (
                  <g key={seg.index}>
                    <path
                      d={`M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`}
                      fill={seg.color}
                      stroke="#1e293b"
                      strokeWidth="0.8"
                    />
                    <text
                      x={textX}
                      y={textY}
                      fill={seg.textColor}
                      fontSize="5.5"
                      fontWeight="900"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${textAngle}, ${textX}, ${textY})`}
                    >
                      {seg.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Center Hub */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 shadow-xl border-2 border-amber-200 flex items-center justify-center z-10">
            <span className="text-slate-950 font-black text-xs">SG4D</span>
          </div>
        </div>

        {/* Win/Loss Result Display Banner */}
        {lastResult && (
          <div className={`mt-4 w-full max-w-sm p-4 rounded-2xl text-center font-bold animate-fade-in border ${
            lastResult.is_win && lastResult.multiplier >= 1.0
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-500/20 border-rose-500/50 text-rose-300'
          }`}>
            <div className="text-xl font-black">
              {lastResult.multiplier >= 1.0 ? `🎉 ${lastResult.label} ပေါက်ပါသည်!` : '😢 နောက်တစ်ကြိမ် ထပ်မံကံစမ်းပါ'}
            </div>
            <div className="text-xs text-slate-300 mt-1">
              ရရှိငွေ: <strong className="text-white text-sm font-mono font-bold">+{lastResult.payout.toLocaleString()} ကျပ်</strong> (မြှောက်ဖော်ကိန်း: {lastResult.multiplier}x)
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="mt-3 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-2 text-center">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Stake Selection & Controls Area */}
      <div className="bg-dark-card border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
          <span>ထိုးကြေးငွေ ရွေးချယ်ပါ (Bet Amount):</span>
          <span className="text-amber-400 font-mono text-sm font-black">{stake.toLocaleString()} MMK</span>
        </div>

        {/* Preset Chips */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {PRESET_STAKES.map((amt) => (
            <button
              key={amt}
              onClick={() => {
                sound.playClick();
                setStake(amt);
              }}
              className={`py-2 px-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                stake === amt
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-900/40 scale-105'
                  : 'bg-dark-bg/80 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              {amt >= 1000 ? `${amt / 1000}K` : amt}
            </button>
          ))}
        </div>

        {/* Spin Action Button */}
        {(user?.balance || 0) < stake ? (
          <button
            onClick={onOpenDeposit}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-950 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>ငွေဖြည့်သွင်းမည် (Top Up to Play)</span>
          </button>
        ) : (
          <button
            onClick={handleSpin}
            disabled={spinning}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-black text-base uppercase tracking-wider shadow-xl shadow-amber-950 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {spinning ? (
              <>
                <RotateCcw className="w-5 h-5 animate-spin" />
                <span>ဘီးလည်နေပါသည်...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 fill-slate-950" />
                <span>ဘီးလှည့်မည် (SPIN - {stake.toLocaleString()} MMK)</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
