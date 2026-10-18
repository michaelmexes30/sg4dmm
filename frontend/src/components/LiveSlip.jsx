import React, { useState } from 'react';
import { Trash2, ShoppingCart, CheckCircle, AlertTriangle, ArrowRight, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiClient } from '../api/client';

export default function LiveSlip({
  items,
  onRemoveItem,
  onClearSlip,
  activeDraw,
  availableDraws = [],
  selectedDrawIds = [],
  setSelectedDrawIds = () => {},
  onOpenDeposit,
  onBetPlaced
}) {
  const { user, refreshProfile } = useAuth();
  const { t, lang, num, formatMoney, formatDigits } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successSlip, setSuccessSlip] = useState(null);

  const drawCount = Math.max(1, selectedDrawIds.length);
  const singleDrawStake = items.reduce((sum, item) => sum + item.total_stake, 0);
  const totalStake = selectedDrawIds.length > 0 ? singleDrawStake * selectedDrawIds.length : 0;
  const totalCombos = items.reduce((sum, item) => sum + item.combination_count, 0);
  
  const isAgent = user?.role === 'AGENT';
  const isCreditEnabled = !!user?.is_agent_credit_enabled;
  const availableCredit = (isAgent && isCreditEnabled) ? Math.max(0, (user?.credit_limit || 0) - (user?.used_credit || 0)) : 0;
  const hasSufficientFunds = user && ((isAgent && isCreditEnabled) ? (availableCredit >= totalStake && !user?.is_betting_locked) : (user.balance >= totalStake));

  // Selected draws info
  const selectedDrawObjects = availableDraws.filter(d => selectedDrawIds.includes(d.id));

  // Cancel / remove a specific draw day from the slip
  const handleRemoveDraw = (drawId) => {
    setSelectedDrawIds(selectedDrawIds.filter(id => id !== drawId));
  };

  // Add back a draw day
  const handleAddDraw = (drawId) => {
    if (!selectedDrawIds.includes(drawId)) {
      setSelectedDrawIds([...selectedDrawIds, drawId]);
    }
  };

  const handlePlaceBet = async () => {
    if (!user) return;
    if (items.length === 0) return;

    if (selectedDrawIds.length === 0) {
      setErrorMsg(t('selectAtLeastOneDraw'));
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');

      const payloadItems = items.map(i => ({
        number: i.number,
        bet_type: (i.bet_type === 'box' || i.bet_type === 'r' || i.bet_type === 'R') ? 'r' : (i.bet_type || 'ordinary'),
        big_amount: i.stake_amount || i.big_amount || 0,
        small_amount: 0,
        custom_combinations: i.custom_combinations || [i.number]
      }));

      // Pass selected draw IDs (multi-draw supported by backend)
      const res = await apiClient.placeBet(selectedDrawIds, payloadItems);
      setSuccessSlip(res);
      await refreshProfile();
      onClearSlip();
      if (onBetPlaced) onBetPlaced(res);
    } catch (err) {
      setErrorMsg(err.message || t('betPlacementFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-panel-gold rounded-2xl p-6 border border-gold-600/40 relative shadow-gold">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-gold-900/50">
        <div className="flex items-center space-x-2">
          <ShoppingCart className="w-5 h-5 text-gold-400" />
          <h3 className="font-extrabold text-white text-lg">{t('liveSlipTitle')}</h3>
          <span className="text-xs bg-gold-950 text-gold-300 px-2.5 py-0.5 rounded-full font-mono border border-gold-700/60 font-bold">
            {num(items.length)} {t('numbersCount')}
          </span>
        </div>
        {items.length > 0 && (
          <button
            onClick={onClearSlip}
            className="text-xs text-gray-400 hover:text-red-400 transition-colors flex items-center space-x-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('clearSlip')}</span>
          </button>
        )}
      </div>

      {/* Success Notification */}
      {successSlip && (
        <div className="mb-4 p-4 rounded-xl bg-green-950/70 border border-green-500/60 text-green-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
              <div>
                <p className="font-bold text-sm">{t('betSuccessTitle')}</p>
                <p className="text-xs text-green-300 font-mono">{t('slipCodeLabel')}: {formatDigits(successSlip.slip_code)}</p>
                <p className="text-xs mt-1 text-gray-300">
                  {t('totalStake')}: {formatMoney(successSlip.total_stake)} ({t('commissionCredited')})
                </p>
              </div>
            </div>
            <button
              onClick={() => setSuccessSlip(null)}
              className="text-xs text-green-400 hover:underline"
            >
              {t('dismiss')}
            </button>
          </div>
        </div>
      )}

      {/* Error notification */}
      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-red-950/70 border border-red-600/60 text-red-200 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Items List */}
      <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1 mb-5">
        {items.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <ShoppingCart className="w-10 h-10 mx-auto opacity-30 mb-2" />
            <p className="text-sm font-medium">{t('emptySlip')}</p>
            <p className="text-xs text-gray-600 mt-1">{t('emptySlipSub')}</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={index}
              className="p-3 bg-dark-card rounded-xl border border-gold-900/60 hover:border-gold-700 transition-all flex items-center justify-between"
            >
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-mono font-black text-gold-300 tracking-wider">
                    {formatDigits(item.number)}
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gold-950 text-gold-400 border border-gold-800">
                    {(item.bet_type === 'box' || item.bet_type === 'r' || item.bet_type === 'R') ? 'R' : (item.bet_type === 'roll' || item.bet_type === 's' || item.bet_type === 'S' ? 'S' : t('ordinary'))}
                  </span>
                  {item.combination_count > 1 && (
                    <span className="text-[10px] text-gray-400 font-mono">
                      ({num(item.combination_count)} {t('combos')})
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-3 text-[11px] text-gray-400 mt-1">
                  <span>{t('stakePerNumber')}: <strong className="text-gold-200 font-mono">{formatMoney(item.stake_amount || item.big_amount || 0)}</strong> / {t('combos')}</span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className="text-sm font-bold font-mono text-white">
                  {formatMoney(item.total_stake)}
                </span>
                <button
                  onClick={() => onRemoveItem(index)}
                  className="text-gray-500 hover:text-red-400 p-1 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Slip Summary & Actions */}
      {items.length > 0 && (
        <div className="pt-4 border-t border-gold-900/60 space-y-3">
          
          {/* Target Draws Badge with Cancel (X) functionality */}
          <div className="p-3 rounded-2xl bg-dark-bg border border-gold-800/80 shadow-sm">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-gray-300 font-bold flex items-center space-x-1.5">
                <Calendar className="w-4 h-4 text-gold-400" />
                <span>{t('targetDraws')}:</span>
              </span>
              <span className="font-bold text-gold-300 font-mono">
                {num(selectedDrawIds.length)} {t('daysUnit')}
              </span>
            </div>

            {selectedDrawIds.length === 0 ? (
              <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-600/60 text-amber-300 text-xs">
                <p className="font-bold mb-1.5">{lang === 'mm' ? '⚠️ ထိုးမည့်နေ့ မရွေးရသေးပါ (အောက်ပါနေ့များမှ ရွေးချယ်ပါ):' : '⚠️ No draw day selected (Pick below):'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableDraws.map(d => {
                    const dayLabel = lang === 'mm'
                      ? (d.day_short === 'Wed' ? 'ဗုဒ္ဓဟူး' : d.day_short === 'Sat' ? 'စနေ' : 'တနင်္ဂနွေ')
                      : d.day_short;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => handleAddDraw(d.id)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gold-500 hover:bg-gold-400 text-dark-bg transition-colors cursor-pointer"
                      >
                        + {dayLabel} ({formatDigits(d.draw_date)})
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {selectedDrawObjects.map(d => {
                    const dayLabel = lang === 'mm' 
                      ? (d.day_short === 'Wed' ? 'ဗုဒ္ဓဟူး' : d.day_short === 'Sat' ? 'စနေ' : 'တနင်္ဂနွေ')
                      : d.day_short;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => handleRemoveDraw(d.id)}
                        title={lang === 'mm' ? `"${dayLabel}" အား ထိုးမည့်ရက်မှ ပယ်ဖျက်မည် (Cancel)` : `Cancel ${dayLabel} draw`}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-gold-950 text-gold-300 border border-gold-600/70 hover:bg-rose-950 hover:border-rose-500 hover:text-rose-200 transition-all cursor-pointer group shadow-sm select-none"
                      >
                        <span>{dayLabel} ({formatDigits(d.draw_date)})</span>
                        <span className="w-3.5 h-3.5 rounded-full bg-gold-900 group-hover:bg-rose-900 group-hover:text-rose-300 flex items-center justify-center text-[10px] font-black">
                          ✕
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Show unselected days if user wants to add back another day */}
                {availableDraws.some(d => !selectedDrawIds.includes(d.id)) && (
                  <div className="flex items-center space-x-1.5 text-[11px] text-gray-400 pt-1">
                    <span>{lang === 'mm' ? 'ရက်ထပ်တိုးရန်:' : 'Add day:'}</span>
                    {availableDraws.filter(d => !selectedDrawIds.includes(d.id)).map(d => {
                      const dayLabel = lang === 'mm'
                        ? (d.day_short === 'Wed' ? 'ဗုဒ္ဓဟူး' : d.day_short === 'Sat' ? 'စနေ' : 'တနင်္ဂနွေ')
                        : d.day_short;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => handleAddDraw(d.id)}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-dark-card border border-gold-900 hover:border-gold-500 text-gold-400 hover:text-gold-200 transition-colors cursor-pointer"
                        >
                          + {dayLabel}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-between text-xs text-gray-400">
            <span>{t('totalCombinations')}:</span>
            <span className="font-mono font-bold text-gold-200">
              {num(totalCombos)} {t('combos')} × {num(selectedDrawIds.length)} {t('daysUnit')} = {num(totalCombos * selectedDrawIds.length)} {t('ticketsUnit')}
            </span>
          </div>

          <div className="flex justify-between text-xs text-gray-400">
            <span>{t('singleDrawStake')}:</span>
            <span className="font-mono font-bold text-gold-200">{formatMoney(singleDrawStake)}</span>
          </div>

          <div className="flex justify-between items-center text-sm pt-1 border-t border-gold-900/40">
            <span className="font-semibold text-gray-300">{t('grandTotalStake')}:</span>
            <div className="text-right">
              <span className="text-2xl font-black font-mono gold-gradient-text drop-shadow">
                {formatMoney(totalStake)}
              </span>
              {selectedDrawIds.length > 1 && (
                <div className="text-[10px] text-gold-400">
                  ({formatMoney(singleDrawStake)} × {num(selectedDrawIds.length)} {t('daysUnit')})
                </div>
              )}
            </div>
          </div>

          {user && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-gray-400 bg-dark-bg p-2.5 rounded-xl border border-dark-border">
                <span>{(isAgent && isCreditEnabled) ? (lang === 'mm' ? 'ရရှိနိုင်သော Credit:' : 'Available Credit:') : t('yourBalance')}:</span>
                <span className={`font-mono font-bold ${hasSufficientFunds ? 'text-green-400' : 'text-red-400'}`}>
                  {formatMoney((isAgent && isCreditEnabled) ? availableCredit : user.balance)}
                </span>
              </div>
              {isAgent && !isCreditEnabled && (
                <div className="text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>
                    {lang === 'mm'
                      ? 'Agent Credit စနစ်အား လောလောဆယ် ခေတ္တဆိုင်းငံ့ထားပါသည် (မိမိ Balance ဖြင့် ထိုးနိုင်ပါသည်)'
                      : 'Agent Credit is temporarily suspended (bets deduct from cash balance)'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Place Bet or Deposit */}
          {!user ? (
            <button
              onClick={() => onOpenDeposit()}
              className="w-full py-4 rounded-xl gold-gradient-btn text-dark-bg font-extrabold text-sm shadow-gold transition-all cursor-pointer"
            >
              {t('loginToPlaceBet')}
            </button>
          ) : !hasSufficientFunds ? (
            (isAgent && isCreditEnabled) ? (
              <button
                disabled
                className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 opacity-90 text-white font-extrabold text-sm shadow-gold flex items-center justify-center space-x-2 cursor-not-allowed"
              >
                <span>
                  {user.is_betting_locked 
                    ? (lang === 'mm' ? '⚠️ ထိုးခွင့်ယာယီပိတ်ထားပါသည် (Settlement Overdue)' : '⚠️ Betting Locked') 
                    : (lang === 'mm' ? '⚠️ Credit မလုံလောက်ပါ (Credit Limit Exceeded)' : '⚠️ Credit Limit Exceeded')}
                </span>
              </button>
            ) : (
              <button
                onClick={onOpenDeposit}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-gold-600 hover:opacity-95 text-white font-extrabold text-sm shadow-gold transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>{t('insufficientBalance')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )
          ) : (
            <button
              onClick={handlePlaceBet}
              disabled={submitting}
              className="w-full py-4 rounded-xl gold-gradient-btn text-dark-bg font-extrabold text-sm shadow-gold transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              {submitting ? (
                <span>{t('confirming')}</span>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 text-dark-bg" />
                  <span>{t('placeBet')}</span>
                </>
              )}
            </button>
          )}

        </div>
      )}

    </div>
  );
}
