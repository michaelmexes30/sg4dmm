import React, { useRef } from 'react';
import {
  Sparkles,
  TrendingUp,
  Dices,
  Gamepad2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const GAMES = [
  {
    id: '4D',
    short: '4D',
    titleEn: 'Singapore 4D',
    titleMm: 'စင်ကာပူ ၄လုံး',
    odds: '2,000x',
    Icon: Sparkles
  },
  {
    id: '2D',
    short: '2D',
    titleEn: 'Thai 2D (SET)',
    titleMm: 'ထိုင်း ၂လုံး',
    odds: '80x',
    Icon: TrendingUp
  },
  {
    id: '3D',
    short: '3D',
    titleEn: 'Thai 3D (Gov)',
    titleMm: 'ထိုင်း ၃လုံး',
    odds: '700x',
    Icon: Dices
  },
  {
    id: 'GAMES',
    short: 'Mini',
    titleEn: 'Mini-Games',
    titleMm: 'မီနီဂိမ်း',
    odds: 'LIVE',
    Icon: Gamepad2
  }
];

export default function GameCapsuleCarousel({ activeGame, setActiveGame }) {
  const { lang } = useLanguage();
  const dragStartX = useRef(null);

  const activeIdx = Math.max(0, GAMES.findIndex((g) => g.id === activeGame));
  const activeItem = GAMES[activeIdx];
  const prevItem = GAMES[(activeIdx - 1 + GAMES.length) % GAMES.length];
  const nextItem = GAMES[(activeIdx + 1) % GAMES.length];

  const shiftGame = (delta) => {
    const nextIdx = (activeIdx + delta + GAMES.length) % GAMES.length;
    setActiveGame(GAMES[nextIdx].id);
  };

  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length > 0) {
      dragStartX.current = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = (e) => {
    if (dragStartX.current === null) return;
    const endX = e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0].clientX : null;
    if (endX !== null) {
      const dx = endX - dragStartX.current;
      if (Math.abs(dx) > 30) {
        shiftGame(dx < 0 ? 1 : -1);
      }
    }
    dragStartX.current = null;
  };

  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse') {
      dragStartX.current = e.clientX;
    }
  };

  const handlePointerUp = (e) => {
    if (e.pointerType === 'mouse' && dragStartX.current !== null) {
      const dx = e.clientX - dragStartX.current;
      dragStartX.current = null;
      if (Math.abs(dx) > 30) {
        shiftGame(dx < 0 ? 1 : -1);
      }
    }
  };

  const ActiveIcon = activeItem.Icon;

  return (
    <div className="w-full">
      {/* Mobile: 44px Floating Capsule Carousel with real swipe & peeking sides */}
      <div
        className="md:hidden select-none touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <div className="flex items-center gap-2">
          {/* Left Peeking Capsule */}
          <button
            type="button"
            onClick={() => shiftGame(-1)}
            aria-label={`Switch to ${prevItem.titleEn}`}
            className="h-9 px-2.5 shrink-0 rounded-full bg-dark-card/90 border border-gold-700/40 hover:border-gold-400/70 text-xs font-bold text-slate-400 hover:text-gold-300 flex items-center gap-1 opacity-80 active:scale-95 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>{prevItem.short}</span>
          </button>

          {/* Center Active Floating Capsule (44px / h-11) */}
          <div className="flex-1 h-11 min-w-0 rounded-full bg-gradient-to-r from-[#f5d061] via-[#e4b83f] to-[#c7931a] text-[#090806] px-3.5 flex items-center justify-between gap-2 shadow-[0_4px_18px_rgba(245,208,97,0.32)] ring-1 ring-amber-200/70 transition-all duration-300">
            <div className="flex items-center gap-2 min-w-0">
              <ActiveIcon className="w-4 h-4 shrink-0 text-[#090806]" />
              <span className="text-xs sm:text-sm font-black truncate tracking-wide">
                {lang === 'mm' ? activeItem.titleMm : activeItem.titleEn}
              </span>
            </div>
            <span className="text-[11px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-black/15 text-[#140e02] shrink-0">
              {activeItem.odds}
            </span>
          </div>

          {/* Right Peeking Capsule */}
          <button
            type="button"
            onClick={() => shiftGame(1)}
            aria-label={`Switch to ${nextItem.titleEn}`}
            className="h-9 px-2.5 shrink-0 rounded-full bg-dark-card/90 border border-gold-700/40 hover:border-gold-400/70 text-xs font-bold text-slate-400 hover:text-gold-300 flex items-center gap-1 opacity-80 active:scale-95 transition-all cursor-pointer"
          >
            <span>{nextItem.short}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dot Indicator Strip */}
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {GAMES.map((g) => {
            const isAct = g.id === activeGame;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveGame(g.id)}
                aria-label={g.titleEn}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  isAct ? 'w-5 bg-gold-400 shadow-[0_0_8px_rgba(245,208,97,0.6)]' : 'w-1.5 bg-gold-900/80 hover:bg-gold-600'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Desktop: Matching 44px Single-Row Floating Capsule Rail */}
      <div className="hidden md:flex items-center justify-center gap-2.5">
        {GAMES.map((g) => {
          const isAct = g.id === activeGame;
          const ItemIcon = g.Icon;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setActiveGame(g.id)}
              className={`h-11 px-4 rounded-full flex items-center gap-2 transition-all duration-200 cursor-pointer ${
                isAct
                  ? 'bg-gradient-to-r from-[#f5d061] via-[#e4b83f] to-[#c7931a] text-[#090806] font-black shadow-[0_4px_18px_rgba(245,208,97,0.28)] ring-1 ring-amber-200/70 scale-[1.02]'
                  : 'bg-dark-card/85 border border-gold-700/35 hover:border-gold-400/70 text-slate-300 hover:text-gold-200 font-bold'
              }`}
            >
              <ItemIcon className={`w-4 h-4 shrink-0 ${isAct ? 'text-[#090806]' : 'text-gold-400'}`} />
              <span className="text-xs lg:text-sm whitespace-nowrap">
                {lang === 'mm' ? g.titleMm : g.titleEn}
              </span>
              <span
                className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                  isAct ? 'bg-black/15 text-[#140e02]' : 'bg-gold-950/80 text-gold-400 border border-gold-700/40'
                }`}
              >
                {g.odds}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
