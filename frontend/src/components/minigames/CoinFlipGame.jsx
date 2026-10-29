import React, { useState } from 'react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { sound } from '../../utils/soundEffects';
import { Sparkles, RotateCcw, Crown, Flower2 } from 'lucide-react';

const PRESET_STAKES = [100, 200, 500, 1000, 2000, 5000, 10000];

export default function CoinFlipGame({ onOpenDeposit, onBalanceChange }) {
  const { user, refreshProfile } = useAuth();
  const [stake, setStake] = useState(500);
  const [choice, setChoice] = useState('HEAD'); // 'HEAD' | 'TAIL'
  const [flipping, setFlipping] = useState(false);
  const [flipDegree, setFlipDegree] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFlip = async () => {
    if (flipping) return;
    if ((user?.balance || 0) < stake) {
      setErrorMsg('လက်ကျန်ငွေ မလုံလောက်ပါခင်ဗျာ။ ငွေဖြည့်သွင်းပေးပါရန်');
      return;
    }

    try {
      sound.playClick();
      setErrorMsg('');
      setLastResult(null);
      setFlipping(true);

      const res = await apiClient.flipCoin(choice, stake);

      // Play metallic coin sound
      sound.playCoin();

      // Determine rotation target: 6 full turns (2160 deg) + 0 for HEAD, 180 for TAIL
      const extraRotations = 360 * 6;
      const targetFaceAngle = res.outcome === 'HEAD' ? 0 : 180;
      const nextDegree = flipDegree + extraRotations + (360 - (flipDegree % 360)) + targetFaceAngle;
      setFlipDegree(nextDegree);

      setTimeout(() => {
        setFlipping(false);
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
      setFlipping(false);
      setErrorMsg(err.message || 'ပစ်၍ မရပါခင်ဗျာ');
    }
  };

  return (
    <div className="space-y-6">
      {/* 3D Coin Stage Area */}
      <div className="bg-gradient-to-b from-dark-card to-dark-bg border border-amber-500/30 rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col items-center">
        {/* Glow ambient background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* 3D Coin Object */}
        <div className="w-36 h-36 sm:w-44 sm:h-44 my-4 [perspective:1000px]">
          <div
            className="w-full h-full relative [transform-style:preserve-3d] transition-transform duration-1000 ease-out"
            style={{
              transform: `rotateY(${flipDegree}deg)`,
              transitionDuration: flipping ? '1.5s' : '0.3s',
            }}
          >
            {/* Front: HEAD (ခေါင်း) */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-amber-200 border-4 border-amber-300 shadow-2xl flex flex-col items-center justify-center p-3 text-slate-950 [backface-visibility:hidden]">
              <div className="w-full h-full rounded-full border-2 border-dashed border-amber-800/40 flex flex-col items-center justify-center">
                <Crown className="w-10 h-10 sm:w-12 sm:h-12 fill-amber-950 text-amber-950" />
                <span className="font-black text-sm sm:text-base mt-1 tracking-wider">ခေါင်း</span>
                <span className="text-[10px] font-bold text-amber-950/80 uppercase font-mono">HEAD</span>
              </div>
            </div>

            {/* Back: TAIL (ပန်း) */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-rose-500 via-pink-400 to-amber-200 border-4 border-pink-300 shadow-2xl flex flex-col items-center justify-center p-3 text-slate-950 [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <div className="w-full h-full rounded-full border-2 border-dashed border-pink-900/40 flex flex-col items-center justify-center">
                <Flower2 className="w-10 h-10 sm:w-12 sm:h-12 fill-rose-950 text-rose-950" />
                <span className="font-black text-sm sm:text-base mt-1 tracking-wider">ပန်း</span>
                <span className="text-[10px] font-bold text-rose-950/80 uppercase font-mono">TAIL</span>
              </div>
            </div>
          </div>
        </div>

        {/* Choice Selection Tabs */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm mt-2">
          <button
            onClick={() => {
              sound.playClick();
              setChoice('HEAD');
            }}
            disabled={flipping}
            className={`py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 font-black text-sm transition-all cursor-pointer ${
              choice === 'HEAD'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-950 scale-105 border-2 border-amber-200'
                : 'bg-dark-bg/80 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <Crown className="w-4 h-4" />
            <span>ခေါင်း (HEAD)</span>
            <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded font-mono">1.96x</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setChoice('TAIL');
            }}
            disabled={flipping}
            className={`py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 font-black text-sm transition-all cursor-pointer ${
              choice === 'TAIL'
                ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-slate-950 shadow-lg shadow-pink-950 scale-105 border-2 border-pink-200'
                : 'bg-dark-bg/80 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <Flower2 className="w-4 h-4" />
            <span>ပန်း (TAIL)</span>
            <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded font-mono">1.96x</span>
          </button>
        </div>

        {/* Win/Loss Result Display Banner */}
        {lastResult && (
          <div className={`mt-4 w-full max-w-sm p-4 rounded-2xl text-center font-bold animate-fade-in border ${
            lastResult.is_win
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-500/20 border-rose-500/50 text-rose-300'
          }`}>
            <div className="text-xl font-black">
              {lastResult.is_win ? '🎉 ဂုဏ်ယူပါသည်! နိုင်ပါသည်' : '😢 မှန်းဆမှု လွဲသွားပါသည်'}
            </div>
            <div className="text-xs text-slate-300 mt-1">
              ကျရောက်သည့်ဘက်: <strong className="text-white text-sm font-bold">{lastResult.outcome === 'HEAD' ? '👑 ခေါင်း' : '🌸 ပန်း'}</strong>
              {lastResult.is_win && (
                <> | ရရှိငွေ: <strong className="text-emerald-400 font-mono font-bold">+{lastResult.payout.toLocaleString()} ကျပ်</strong></>
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
            onClick={handleFlip}
            disabled={flipping}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-black text-base uppercase tracking-wider shadow-xl shadow-amber-950 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {flipping ? (
              <>
                <RotateCcw className="w-5 h-5 animate-spin" />
                <span>ဒင်္ဂါးပြား ပစ်နေပါသည်...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 fill-slate-950" />
                <span>ပစ်မည် (FLIP - {stake.toLocaleString()} MMK)</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
