import React, { useState } from 'react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { sound } from '../../utils/soundEffects';
import { Sparkles, RotateCcw, Dices } from 'lucide-react';

const PRESET_STAKES = [100, 200, 500, 1000, 2000, 5000, 10000];

// Dice face dot positions
const DICE_DOTS = {
  1: [{ top: '50%', left: '50%' }],
  2: [{ top: '25%', left: '25%' }, { top: '75%', left: '75%' }],
  3: [{ top: '25%', left: '25%' }, { top: '50%', left: '50%' }, { top: '75%', left: '75%' }],
  4: [{ top: '25%', left: '25%' }, { top: '25%', left: '75%' }, { top: '75%', left: '25%' }, { top: '75%', left: '75%' }],
  5: [{ top: '25%', left: '25%' }, { top: '25%', left: '75%' }, { top: '50%', left: '50%' }, { top: '75%', left: '25%' }, { top: '75%', left: '75%' }],
  6: [{ top: '25%', left: '25%' }, { top: '25%', left: '75%' }, { top: '50%', left: '25%' }, { top: '50%', left: '75%' }, { top: '75%', left: '25%' }, { top: '75%', left: '75%' }],
};

function DieFace({ value, rolling }) {
  const dots = DICE_DOTS[value] || DICE_DOTS[1];
  const isRed = value === 1 || value === 4;

  return (
    <div
      className={`w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl shadow-xl border-2 border-slate-300 relative flex items-center justify-center transition-all ${
        rolling ? 'animate-bounce scale-110 rotate-12' : 'scale-100 rotate-0'
      }`}
      style={{
        boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.8), 0 8px 16px rgba(0,0,0,0.5)',
      }}
    >
      {dots.map((dot, idx) => (
        <span
          key={idx}
          className={`absolute w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-inner ${
            isRed ? 'bg-rose-600' : 'bg-slate-900'
          }`}
          style={{ top: dot.top, left: dot.left }}
        />
      ))}
    </div>
  );
}

export default function DiceRollGame({ onOpenDeposit, onBalanceChange }) {
  const { user, refreshProfile } = useAuth();
  const [stake, setStake] = useState(500);
  const [choice, setChoice] = useState('BIG'); // 'SMALL' | 'BIG' | 'TRIPLE'
  const [rolling, setRolling] = useState(false);
  const [diceValues, setDiceValues] = useState([3, 4, 5]);
  const [lastResult, setLastResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRoll = async () => {
    if (rolling) return;
    if ((user?.balance || 0) < stake) {
      setErrorMsg('လက်ကျန်ငွေ မလုံလောက်ပါခင်ဗျာ။ ငွေဖြည့်သွင်းပေးပါရန်');
      return;
    }

    try {
      sound.playClick();
      setErrorMsg('');
      setLastResult(null);
      setRolling(true);

      const res = await apiClient.rollDice(choice, stake);

      // Play dice tumbling clatter sound
      sound.playDice();

      // Jitter animation interval
      const jitterInterval = setInterval(() => {
        setDiceValues([
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
        ]);
      }, 100);

      setTimeout(() => {
        clearInterval(jitterInterval);
        setDiceValues(res.dice);
        setRolling(false);
        setLastResult(res);

        if (res.is_win) {
          sound.playWin();
        } else {
          sound.playLoss();
        }

        refreshProfile();
        if (onBalanceChange) onBalanceChange(res.new_balance);
      }, 1500);

    } catch (err) {
      setRolling(false);
      setErrorMsg(err.message || 'ခလောက်၍ မရပါခင်ဗျာ');
    }
  };

  const totalSum = diceValues.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Dice Arena Felt Stage Area */}
      <div className="bg-gradient-to-b from-emerald-950 via-dark-card to-dark-bg border border-emerald-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col items-center">
        {/* Felt Bowl Container */}
        <div className="w-full max-w-md bg-emerald-900/40 border-2 border-emerald-500/40 rounded-3xl p-6 py-8 shadow-inner flex flex-col items-center justify-center my-2 relative">
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <DieFace value={diceValues[0]} rolling={rolling} />
            <DieFace value={diceValues[1]} rolling={rolling} />
            <DieFace value={diceValues[2]} rolling={rolling} />
          </div>

          {/* Sum badge */}
          <div className="mt-5 px-4 py-1.5 rounded-full bg-slate-950/80 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold flex items-center gap-2 shadow-lg">
            <span>ပေါင်းလဒ် (Sum):</span>
            <span className="text-white text-sm font-black">{rolling ? '??' : totalSum}</span>
            {!rolling && (
              <span className={`text-[10px] px-2 py-0.5 rounded font-black ${
                diceValues[0] === diceValues[1] && diceValues[1] === diceValues[2]
                  ? 'bg-amber-400 text-slate-950'
                  : totalSum <= 10
                  ? 'bg-blue-500 text-white'
                  : 'bg-rose-500 text-white'
              }`}>
                {diceValues[0] === diceValues[1] && diceValues[1] === diceValues[2]
                  ? '⭐ အပူး (TRIPLE)'
                  : totalSum <= 10
                  ? '🔵 အသေး (SMALL)'
                  : '🔴 အကြီး (BIG)'}
              </span>
            )}
          </div>
        </div>

        {/* Choice Selection Tabs */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-md mt-3">
          <button
            onClick={() => {
              sound.playClick();
              setChoice('SMALL');
            }}
            disabled={rolling}
            className={`py-3 px-2 rounded-2xl flex flex-col items-center justify-center gap-1 font-black transition-all cursor-pointer ${
              choice === 'SMALL'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-950 scale-105 border-2 border-blue-300'
                : 'bg-dark-bg/80 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <span className="text-xs sm:text-sm">🔵 အသေး (Small)</span>
            <span className="text-[10px] text-blue-200/80 font-mono">4 - 10 | 2.0x</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setChoice('BIG');
            }}
            disabled={rolling}
            className={`py-3 px-2 rounded-2xl flex flex-col items-center justify-center gap-1 font-black transition-all cursor-pointer ${
              choice === 'BIG'
                ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-950 scale-105 border-2 border-rose-300'
                : 'bg-dark-bg/80 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <span className="text-xs sm:text-sm">🔴 အကြီး (Big)</span>
            <span className="text-[10px] text-rose-200/80 font-mono">11 - 17 | 2.0x</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setChoice('TRIPLE');
            }}
            disabled={rolling}
            className={`py-3 px-2 rounded-2xl flex flex-col items-center justify-center gap-1 font-black transition-all cursor-pointer ${
              choice === 'TRIPLE'
                ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-950 scale-105 border-2 border-amber-200'
                : 'bg-dark-bg/80 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <span className="text-xs sm:text-sm">⭐ အပူး (Triple)</span>
            <span className="text-[10px] text-amber-950 font-mono font-black">၃ လုံးတူ | 30.0x</span>
          </button>
        </div>

        {/* Win/Loss Result Display Banner */}
        {lastResult && (
          <div className={`mt-4 w-full max-w-md p-4 rounded-2xl text-center font-bold animate-fade-in border ${
            lastResult.is_win
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-500/20 border-rose-500/50 text-rose-300'
          }`}>
            <div className="text-xl font-black">
              {lastResult.is_win ? '🎉 ဂုဏ်ယူပါသည်! အနိုင်ရရှိပါသည်' : '😢 မှန်းဆချက် လွဲသွားပါသည်'}
            </div>
            <div className="text-xs text-slate-300 mt-1">
              ကျရောက်ဂဏန်း: <strong className="text-white text-sm font-mono font-bold">{lastResult.dice.join(' + ')} = {lastResult.sum}</strong>
              {lastResult.is_win && (
                <> | ရရှိငွေ: <strong className="text-emerald-400 font-mono font-bold">+{lastResult.payout.toLocaleString()} ကျပ်</strong> ({lastResult.multiplier}x)</>
              )}
            </div>
          </div>
        )}

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

        {/* Action Button */}
        {(user?.balance || 0) < stake ? (
          <button
            onClick={onOpenDeposit}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-950 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>ငွေဖြည့်သွင်းမည် (Top Up to Play)</span>
          </button>
        ) : (
          <button
            onClick={handleRoll}
            disabled={rolling}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-black text-base uppercase tracking-wider shadow-xl shadow-amber-950 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {rolling ? (
              <>
                <RotateCcw className="w-5 h-5 animate-spin" />
                <span>အန်စာတုံး ခလောက်နေပါသည်...</span>
              </>
            ) : (
              <>
                <Dices className="w-5 h-5" />
                <span>ခလောက်မည် (ROLL - {stake.toLocaleString()} MMK)</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
