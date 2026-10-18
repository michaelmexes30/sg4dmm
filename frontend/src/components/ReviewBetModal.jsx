import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, CheckCircle2, RotateCcw, AlertCircle, Calendar, Plus, Minus, Sparkles } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function ReviewBetModal({
  isOpen,
  onClose,
  initialCombos = [],
  initialStake = 1000,
  betType = 'ordinary',
  originalNumber = '',
  selectedDrawObjects = [],
  onConfirm
}) {
  const { lang, num, formatMoney } = useLanguage();

  // Helper to get fallback combinations
  const getPreparedCombos = () => {
    if (initialCombos && initialCombos.length > 0) return initialCombos;
    if (originalNumber) return [originalNumber];
    return [];
  };

  // Array of { number: string, stake: number }
  const [items, setItems] = useState(() => {
    const list = getPreparedCombos();
    return list.map((c) => ({
      number: c,
      stake: Number(initialStake) || 1000
    }));
  });
  const [removedItems, setRemovedItems] = useState([]);

  // Lock body scroll and synchronize items when modal opens
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const list = getPreparedCombos();
      setItems(
        list.map((combo) => ({
          number: combo,
          stake: Number(initialStake) || 1000
        }))
      );
      setRemovedItems([]);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialStake, originalNumber]);

  if (!isOpen) return null;

  // Individual item stake adjustment
  const handleStakeChange = (index, newStake) => {
    const val = Math.max(50, Math.min(100000, Number(newStake) || 0));
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], stake: val };
      return copy;
    });
  };

  const handleStepStake = (index, delta) => {
    setItems((prev) => {
      const copy = [...prev];
      const cur = copy[index].stake || 0;
      const next = Math.max(50, Math.min(100000, cur + delta));
      copy[index] = { ...copy[index], stake: next };
      return copy;
    });
  };

  // Remove single number
  const handleRemoveItem = (index) => {
    const itemToRemove = items[index];
    setItems((prev) => prev.filter((_, i) => i !== index));
    setRemovedItems((prev) => [...prev, itemToRemove]);
  };

  // Restore all removed numbers
  const handleRestoreAll = () => {
    setItems((prev) => [...prev, ...removedItems]);
    setRemovedItems([]);
  };

  // Batch actions
  const handleSetAllStake = (amount) => {
    setItems((prev) => prev.map((it) => ({ ...it, stake: amount })));
  };

  const handleAdjustAllStake = (delta) => {
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        stake: Math.max(50, Math.min(100000, (it.stake || 0) + delta))
      }))
    );
  };

  // Totals calculations
  const singleDayTotal = items.reduce((sum, it) => sum + (Number(it.stake) || 0), 0);
  const drawCount = Math.max(1, selectedDrawObjects.length);
  const grandTotal = singleDayTotal * drawCount;

  const handleFinalConfirm = () => {
    if (items.length === 0) {
      alert(lang === 'mm' ? 'အနည်းဆုံး ဂဏန်း ၁ လုံး ရှိရပါမည်။' : 'Please keep at least one combination.');
      return;
    }
    onConfirm(items);
    onClose();
  };

  const drawDatesText = (selectedDrawObjects && selectedDrawObjects.length > 0)
    ? selectedDrawObjects.map((d) => d.day_name || d.day_of_week || d.draw_date).join(', ')
    : (lang === 'mm' ? 'လက်ရှိပွဲစဉ်' : 'Current Draw');

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="max-w-xl w-full bg-dark-surface border border-gold-600/70 rounded-2xl sm:rounded-3xl shadow-gold-lg flex flex-col overflow-hidden my-auto relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Unified Header */}
        <div className="px-4 py-3 border-b border-gold-900/60 bg-dark-card flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gold-500/20 border border-gold-500/40 flex items-center justify-center text-gold-400 shrink-0">
              <Sparkles className="w-4 h-4 text-gold-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white leading-tight">
                  {lang === 'mm' ? 'လောင်းကြေး ပြန်လည်စိစစ်ခြင်း' : 'Review & Confirm Bets'}
                </h3>
                <span className="text-[10px] bg-gold-950 text-gold-300 px-2 py-0.5 rounded-full border border-gold-700/60 font-mono font-bold leading-none">
                  {num(items.length)} {lang === 'mm' ? 'တွဲ' : 'combos'} {(betType === 'r' || betType === 'box' || betType === 'R') ? '(R)' : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gold-400/90 font-medium mt-0.5">
                <Calendar className="w-3 h-3 text-gold-400 shrink-0" />
                <span>{lang === 'mm' ? 'ပွဲစဉ်ရက်' : 'Draws'}:</span>
                <span className="text-gold-200 font-bold font-mono">
                  {drawDatesText} ({num(drawCount)} {lang === 'mm' ? 'ရက်' : 'days'})
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-dark-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Compact Quick Stake Toolbar */}
        <div className="px-3.5 py-1.5 bg-dark-bg/95 border-b border-gold-900/40 flex flex-wrap items-center justify-between gap-1.5 shrink-0 text-xs">
          <div className="flex items-center space-x-1">
            <span className="text-gray-400 text-[11px] font-medium">
              {lang === 'mm' ? 'အားလုံးပြင်မည်' : 'Set All'}:
            </span>
            {[500, 1000, 2000, 5000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleSetAllStake(amt)}
                className="px-2 py-0.5 rounded-md bg-dark-card hover:bg-gold-950 border border-gold-700/50 hover:border-gold-400 text-gold-300 font-mono font-bold text-[11px] transition-all cursor-pointer"
              >
                {num(amt.toLocaleString())}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => handleAdjustAllStake(-100)}
              className="px-2 py-0.5 rounded-md bg-dark-card hover:bg-dark-hover border border-gold-700/50 text-slate-300 font-bold text-[11px] cursor-pointer"
              title="-100 to all"
            >
              -100
            </button>
            <button
              type="button"
              onClick={() => handleAdjustAllStake(100)}
              className="px-2 py-0.5 rounded-md bg-dark-card hover:bg-dark-hover border border-gold-700/50 text-slate-300 font-bold text-[11px] cursor-pointer"
              title="+100 to all"
            >
              +100
            </button>
            {removedItems.length > 0 && (
              <button
                type="button"
                onClick={handleRestoreAll}
                className="ml-1 text-[11px] text-amber-300 hover:underline font-bold flex items-center space-x-0.5 cursor-pointer"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>{num(removedItems.length)} {lang === 'mm' ? 'ပြန်ယူမည်' : 'Restore'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Content: Auto-sized scrollable grid */}
        <div className="overflow-y-auto p-3 sm:p-4 space-y-2 custom-scrollbar bg-dark-bg/40 max-h-[52vh]">
          {items.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <p className="text-xs sm:text-sm">{lang === 'mm' ? 'ဂဏန်းအားလုံး ဖယ်ထုတ်ထားပါသည်' : 'All numbers removed.'}</p>
              <button
                onClick={handleRestoreAll}
                className="mt-2.5 px-3 py-1 rounded-lg bg-gold-950 border border-gold-600 text-gold-300 text-xs font-bold"
              >
                {lang === 'mm' ? 'မူလအတိုင်း အားလုံး ပြန်ယူမည်' : 'Restore All'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {items.map((it, idx) => (
                <div
                  key={`${it.number}-${idx}`}
                  className="p-2 sm:p-2.5 rounded-xl bg-dark-card border border-gold-700/50 hover:border-gold-500/80 transition-all flex items-center justify-between shadow-sm"
                >
                  {/* Left: Index & 4D Number in Casino Gold LED */}
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-gray-500 font-mono w-4">
                      #{idx + 1}
                    </span>
                    <div className="box-gold-led px-2.5 py-0.5 rounded-lg text-center flex items-center gap-1.5">
                      <span className="font-cyber font-black text-lg sm:text-xl text-gold-led tracking-widest">
                        {it.number}
                      </span>
                      {(betType === 'r' || betType === 'box' || betType === 'R') && (
                        <span className="text-[10px] font-black text-gold-300 bg-gold-950/90 px-1 py-0.2 rounded border border-gold-600/70">
                          R
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Stepper & Remove */}
                  <div className="flex items-center space-x-1">
                    {/* Decrement */}
                    <button
                      type="button"
                      onClick={() => handleStepStake(idx, -100)}
                      disabled={it.stake <= 50}
                      className="w-6 h-6 rounded-md bg-dark-bg border border-gold-700/60 hover:border-gold-400 text-gold-300 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                      title="-100 Ks"
                    >
                      <Minus className="w-3 h-3" />
                    </button>

                    {/* Stake Input */}
                    <div className="relative w-16 sm:w-20">
                      <input
                        type="number"
                        step="50"
                        min="50"
                        max="100000"
                        value={it.stake}
                        onChange={(e) => handleStakeChange(idx, e.target.value)}
                        className="w-full bg-dark-bg border border-gold-600/70 focus:border-gold-400 rounded-md py-0.5 px-1 text-center font-mono font-bold text-xs text-gold-200 focus:outline-none"
                      />
                    </div>

                    {/* Increment */}
                    <button
                      type="button"
                      onClick={() => handleStepStake(idx, 100)}
                      className="w-6 h-6 rounded-md bg-dark-bg border border-gold-700/60 hover:border-gold-400 text-gold-300 flex items-center justify-center transition-all cursor-pointer"
                      title="+100 Ks"
                    >
                      <Plus className="w-3 h-3" />
                    </button>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="w-6 h-6 ml-0.5 rounded-md bg-rose-950/40 border border-rose-800/60 hover:bg-rose-900/60 text-rose-300 flex items-center justify-center transition-all cursor-pointer"
                      title={lang === 'mm' ? 'ဖယ်ထုတ်မည်' : 'Remove'}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Compact Footer */}
        <div className="p-3 sm:p-4 border-t border-gold-900/60 bg-dark-card shrink-0 space-y-2.5">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <div className="text-gray-300">
              <span className="font-bold text-white font-mono">{num(items.length)}</span> {lang === 'mm' ? 'တွဲ' : 'combos'}
              {drawCount > 1 && (
                <span className="text-gold-400/90 ml-1">
                  × <span className="font-bold font-mono">{num(drawCount)}</span> {lang === 'mm' ? 'ရက်' : 'days'}
                </span>
              )}
            </div>

            <div className="text-right">
              <span className="text-xs text-gray-400 mr-1.5">
                {lang === 'mm' ? 'စုစုပေါင်း' : 'Total'}:
              </span>
              <span className="text-base sm:text-xl font-black font-mono text-gold-300 gold-gradient-text">
                {formatMoney(grandTotal)}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 rounded-xl bg-dark-bg border border-gold-700/60 hover:border-gold-400 text-gray-300 hover:text-white font-bold text-xs transition-all cursor-pointer"
            >
              {lang === 'mm' ? 'ပြန်ပြင်မည်' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleFinalConfirm}
              disabled={items.length === 0 || grandTotal <= 0}
              className={`w-2/3 py-2.5 rounded-xl font-black text-xs sm:text-sm tracking-wider shadow-gold transition-all flex items-center justify-center space-x-1.5 ${
                items.length > 0 && grandTotal > 0
                  ? 'gold-gradient-btn text-dark-bg cursor-pointer hover:scale-[1.01]'
                  : 'bg-dark-card border border-dark-border text-gray-500 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-dark-bg" />
              <span>
                {lang === 'mm' ? 'အတည်ပြုမည်' : 'Confirm'} ({formatMoney(grandTotal)})
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
