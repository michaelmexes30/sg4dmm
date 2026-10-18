import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Upload, 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Copy, 
  Check, 
  Globe, 
  QrCode,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeft,
  Wallet
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiClient } from '../api/client';

export default function DepositModal({ isOpen, onClose }) {
  const { user, refreshProfile } = useAuth();
  const { t, lang, num, formatMoney, formatDigits } = useLanguage();
  
  // Tab: 'deposit' | 'withdraw'
  const [walletTab, setWalletTab] = useState('deposit');
  const [gateway, setGateway] = useState('kpay');
  const [receiversData, setReceiversData] = useState(null);
  const [selectedReceiver, setSelectedReceiver] = useState('');
  
  // Deposit form state
  const [txId, setTxId] = useState('');
  const [amount, setAmount] = useState('');
  const [rawTimestamp, setRawTimestamp] = useState('');
  const [clientTimezone, setClientTimezone] = useState('MMT');
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreviewUrl, setSlipPreviewUrl] = useState('');
  const fileInputRef = useRef(null);
  const modalScrollRef = useRef(null);
  const modalTopRef = useRef(null);
  
  // Withdrawal form state
  const [withdrawGateway, setWithdrawGateway] = useState('kpay');
  const [receiverName, setReceiverName] = useState('');
  const [receiverAccount, setReceiverAccount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawResult, setWithdrawResult] = useState(null);

  // General processing & result
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  const scrollToTop = () => {
    setTimeout(() => {
      if (modalScrollRef.current) {
        modalScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (modalTopRef.current) {
        modalTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const resetDepositForm = () => {
    setTxId('');
    setAmount('');
    setSlipFile(null);
    setSlipPreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetDepositForm();
    setVerificationResult(null);
    setWithdrawResult(null);
    setWithdrawAmount('');
    onClose();
  };

  useEffect(() => {
    if (verificationResult || withdrawResult) {
      scrollToTop();
    }
  }, [verificationResult, withdrawResult]);

  useEffect(() => {
    if (isOpen) {
      loadReceivers();
      setDefaultTimestamp();
      if (user?.phone && !receiverAccount) {
        setReceiverAccount(user.phone);
      }
      if (user?.full_name && !receiverName) {
        setReceiverName(user.full_name);
      }
    } else {
      resetDepositForm();
      setVerificationResult(null);
      setWithdrawResult(null);
    }
  }, [isOpen, gateway]);

  const setDefaultTimestamp = () => {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const formatted = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    setRawTimestamp(formatted);
  };

  const loadReceivers = async () => {
    try {
      const data = await apiClient.getReceivers();
      setReceiversData(data);
      const accounts = data.gateways[gateway] || [];
      if (accounts.length > 0) {
        setSelectedReceiver(accounts[0].account_number);
      }
    } catch (err) {
      console.error('Failed to load receiver accounts:', err);
    }
  };

  const handleCopyAccount = (accNum) => {
    navigator.clipboard.writeText(accNum);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSlipFile(file);
    setSlipPreviewUrl(URL.createObjectURL(file));

    // Upload immediately
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiClient.uploadSlip(formData);
      setSlipPreviewUrl(res.file_url);
    } catch (err) {
      console.error('Slip upload failed:', err);
    }
  };

  const handleSubmitDeposit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setVerificationResult(null);

    try {
      const payload = {
        gateway,
        transaction_id: txId.trim(),
        receiver_id: selectedReceiver,
        amount: Number(amount),
        raw_timestamp: rawTimestamp,
        client_timezone: clientTimezone,
        slip_image_url: slipPreviewUrl || null
      };

      const result = await apiClient.submitDeposit(payload);
      setVerificationResult(result);
      if (result.success) {
        await refreshProfile();
        resetDepositForm();
      } else {
        // Clear all form inputs (transaction ID, amount, slip) on failure/rejection
        resetDepositForm();
      }
      scrollToTop();
    } catch (err) {
      setVerificationResult({
        success: false,
        status: 'REJECTED',
        message: err.message || (lang === 'mm' ? 'ငွေသွင်း အတည်ပြုခြင်း မအောင်မြင်ပါ' : 'Deposit verification failed')
      });
      // Clear all form inputs on error
      resetDepositForm();
      scrollToTop();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitWithdrawal = async (e) => {
    e.preventDefault();
    setLoading(true);
    setWithdrawResult(null);

    const numAmount = Number(withdrawAmount);
    if (!numAmount || numAmount < 1000) {
      setWithdrawResult({
        success: false,
        message: t('minWithdrawError')
      });
      setLoading(false);
      scrollToTop();
      return;
    }

    if (numAmount > (user?.balance || 0)) {
      setWithdrawResult({
        success: false,
        message: t('insufficientBalanceError')
      });
      setLoading(false);
      scrollToTop();
      return;
    }

    try {
      const payload = {
        gateway: withdrawGateway,
        receiver_account: receiverAccount.trim(),
        receiver_name: receiverName.trim(),
        amount: numAmount
      };

      const result = await apiClient.submitWithdrawal(payload);
      setWithdrawResult(result);
      if (result.success) {
        await refreshProfile();
        setWithdrawAmount('');
      }
      scrollToTop();
    } catch (err) {
      setWithdrawResult({
        success: false,
        message: err.message || (lang === 'mm' ? 'ငွေထုတ် တောင်းဆိုခြင်း မအောင်မြင်ပါ' : 'Withdrawal request failed')
      });
      scrollToTop();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentAccounts = receiversData?.gateways?.[gateway] || [
    { account_name: 'Official SG4D Agent', account_number: '09987654321' }
  ];

  return (
    <div 
      ref={modalScrollRef}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md p-2 sm:p-4 md:p-6 flex items-start justify-center"
    >
      <div 
        ref={modalTopRef} 
        className="relative w-full max-w-2xl bg-dark-surface border border-gold-600/60 rounded-2xl sm:rounded-3xl shadow-gold-lg p-3 sm:p-6 my-2 sm:my-6 pb-10 sm:pb-6 text-gray-200"
      >
        
        {/* Modal Header with Back Arrow Button (replaces 'X') */}
        <div className="flex items-center justify-between pb-2.5 sm:pb-4 border-b border-gold-900/60 mb-2.5 sm:mb-4">
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Back Button with Arrow */}
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-300 hover:text-gold-300 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-dark-bg/90 border border-gold-900/80 hover:border-gold-500/80 hover:bg-dark-card transition-all cursor-pointer flex items-center space-x-1.5 group shadow-sm shrink-0"
              title={t('backBtn')}
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-gold-400 transition-transform group-hover:-translate-x-1" />
              <span className="text-xs font-bold text-gold-200">
                {t('backBtn')}
              </span>
            </button>

            <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-dark-bg border border-gold-500/70 p-1 flex items-center justify-center shadow-gold-sm shrink-0">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="text-sm sm:text-xl font-extrabold text-white gold-gradient-text leading-tight">
                {walletTab === 'deposit' ? t('depositTitle') : t('withdrawTitle')}
              </h3>
              <p className="text-[10px] sm:text-xs text-gold-400/90 leading-tight">
                {t('walletSubtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Current Balance Chip */}
        <div className="mb-2.5 sm:mb-4 p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-dark-card border border-gold-600/60 flex items-center justify-between">
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <Wallet className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-gold-400" />
            <span className="text-[11px] sm:text-xs text-gray-400">{t('currentBalance')}:</span>
          </div>
          <span className="font-mono font-black text-sm sm:text-lg text-gold-300">
            {formatMoney(user?.balance || 0)}
          </span>
        </div>

        {/* Top Up / Withdraw Switcher Tabs */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-3 sm:mb-5 p-1 bg-dark-bg rounded-xl sm:rounded-2xl border border-gold-900/60">
          <button
            type="button"
            onClick={() => setWalletTab('deposit')}
            className={`py-1.5 sm:py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center space-x-1 sm:space-x-2 cursor-pointer ${
              walletTab === 'deposit'
                ? 'gold-gradient-btn text-dark-bg shadow-gold-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{t('cashInTab')}</span>
          </button>

          <button
            type="button"
            onClick={() => setWalletTab('withdraw')}
            className={`py-1.5 sm:py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center space-x-1 sm:space-x-2 cursor-pointer ${
              walletTab === 'withdraw'
                ? 'gold-gradient-btn text-dark-bg shadow-gold-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{t('cashOutTab')}</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: TOP UP / DEPOSIT */}
        {/* ============================================================== */}
        {walletTab === 'deposit' && (
          <div>
            {/* Operating Hours Notice */}
            <div className="mb-3 sm:mb-4 p-2 sm:p-2.5 rounded-xl bg-dark-card border border-gold-600/40 flex items-center justify-between text-xs text-gold-300">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold-400" />
                <span className="text-[11px] sm:text-xs">{t('operatingHours')}</span>
              </div>
              <span className="font-mono text-[9px] sm:text-[10px] text-green-400 font-bold bg-green-950/60 px-1.5 sm:px-2 py-0.5 rounded border border-green-800">
                {t('autoVerifyBadge')}
              </span>
            </div>

            {/* Verification Result Notification */}
            {verificationResult && (
              <div className={`p-3 sm:p-4 rounded-xl mb-3 sm:mb-4 border ${
                verificationResult.status === 'AUTO_APPROVED'
                  ? 'bg-green-950/70 border-green-500/60 text-green-200'
                  : verificationResult.status === 'FLAGGED_EXPIRED'
                  ? 'bg-amber-950/70 border-amber-500/60 text-amber-200'
                  : 'bg-red-950/70 border-red-500/60 text-red-200'
              }`}>
                <div className="flex items-start space-x-2.5 sm:space-x-3">
                  {verificationResult.status === 'AUTO_APPROVED' ? (
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-sm">
                      {verificationResult.status === 'AUTO_APPROVED' ? t('autoApprovedTitle') : `${lang === 'mm' ? 'အခြေအနေ' : 'Status'}: ${verificationResult.status}`}
                    </p>
                    <p>{verificationResult.message}</p>
                    {verificationResult.status === 'AUTO_APPROVED' && verificationResult.new_balance != null && (
                      <p className="font-bold text-gold-300 mt-1">
                        {lang === 'mm' ? 'လက်ရှိ လက်ကျန်ငွေ:' : 'Updated Balance:'} {formatMoney(verificationResult.new_balance)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Gateway Selection Tabs */}
            <div className="mb-3 sm:mb-4">
              <label className="block text-[11px] sm:text-xs font-bold text-gold-300 uppercase tracking-wider mb-1.5 sm:mb-2">
                {t('selectGateway')}
              </label>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { id: 'kpay', name: 'KBZPay', logo: 'KPay' },
                  { id: 'wavepay', name: 'WavePay', logo: 'Wave' },
                  { id: 'ayapay', name: 'AYA Pay', logo: 'AYA' }
                ].map((gw) => (
                  <button
                    key={gw.id}
                    type="button"
                    onClick={() => { setGateway(gw.id); setVerificationResult(null); }}
                    className={`py-2 sm:py-3 px-1.5 sm:px-3 rounded-xl font-bold text-xs sm:text-sm transition-all border flex flex-col items-center justify-center space-y-0.5 sm:space-y-1 cursor-pointer ${
                      gateway === gw.id
                        ? 'bg-dark-card border-gold-500 shadow-gold-sm text-gold-300'
                        : 'bg-dark-bg/60 border-dark-border text-gray-400 hover:text-white hover:border-gold-800'
                    }`}
                  >
                    <span className="font-extrabold text-sm sm:text-base tracking-wider">{gw.logo}</span>
                    <span className="text-[10px] sm:text-[11px] font-normal opacity-80">{gw.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Official Receiver Account Banner */}
            <div className="bg-dark-card p-3 sm:p-4 rounded-xl border border-gold-700/60 mb-3 sm:mb-4 shadow-gold-sm">
              <p className="text-[10px] sm:text-[11px] text-gold-400 uppercase tracking-wider font-bold mb-1.5 sm:mb-2 flex items-center justify-between">
                <span>{t('officialReceiverTitle')} ({gateway.toUpperCase()})</span>
                <span className="text-[9px] sm:text-[10px] text-green-400 font-mono">{t('agentVerifiedBadge')}</span>
              </p>
              
              <div className="space-y-2">
                {currentAccounts.map((acc, idx) => (
                  <div key={idx} className="bg-dark-bg p-2.5 sm:p-3 rounded-lg border border-gold-900/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] sm:text-xs font-bold text-white">{acc.account_name}</p>
                        <p className="text-xs sm:text-base font-mono font-black text-gold-300 tracking-wider mt-0.5">
                          {formatDigits(acc.account_number)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {acc.qr_code && (
                          <button
                            type="button"
                            onClick={() => setShowQrCode(!showQrCode)}
                            className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/40 hover:bg-amber-500/20 text-amber-300 text-[10px] sm:text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                          >
                            <QrCode className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
                            <span>{showQrCode ? (lang === 'mm' ? 'QR ပိတ်' : 'Hide QR') : (lang === 'mm' ? 'QR စကင်ဖတ်ရန်' : 'Scan QR')}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopyAccount(acc.account_number)}
                          className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-gold-950 border border-gold-600/60 hover:bg-gold-900 text-gold-300 text-[11px] sm:text-xs font-bold flex items-center space-x-1 sm:space-x-1.5 transition-colors cursor-pointer"
                        >
                          {copiedAccount ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-400" /> : <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                          <span>{copiedAccount ? t('copiedBtn') : t('copyBtn')}</span>
                        </button>
                      </div>
                    </div>

                    {showQrCode && acc.qr_code && (
                      <div className="pt-2.5 border-t border-gold-900/40 flex flex-col items-center justify-center space-y-1.5">
                        <div className="w-40 h-40 bg-white p-2.5 rounded-2xl shadow-xl border-2 border-gold-400 flex items-center justify-center">
                          <img 
                            src={acc.qr_code} 
                            alt={`${acc.account_name} QR`} 
                            className="w-full h-full object-contain"
                            onError={(e) => { e.target.src = 'https://api.iconify.design/solar:qr-code-bold-duotone.svg?color=%23d4af37'; }}
                          />
                        </div>
                        <p className="text-[10px] sm:text-[11px] text-gold-300 font-semibold text-center mt-1">
                          {lang === 'mm' ? `${gateway.toUpperCase()} App ဖြင့် ဤ QR Code ကို တိုက်ရိုက် စကင်ဖတ်၍ ငွေလွှဲနိုင်ပါသည်` : `Scan with ${gateway.toUpperCase()} App to pay directly`}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Verification Form */}
            <form onSubmit={handleSubmitDeposit} className="space-y-2.5 sm:space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5">
                <div>
                  <label className="block text-[11px] sm:text-xs font-semibold text-gray-300 mb-1">
                    {t('txIdLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={txId}
                    onChange={(e) => setTxId(e.target.value)}
                    placeholder={t('txIdPlaceholder')}
                    className="w-full bg-dark-bg border border-gold-900 rounded-xl px-3 py-2 sm:py-2.5 text-xs text-white font-mono focus:border-gold-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] sm:text-xs font-semibold text-gray-300 mb-1">
                    {t('transferAmountLabel')} *
                  </label>
                  <input
                    type="number"
                    required
                    min="1000"
                    step="1000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={t('transferAmountPlaceholder')}
                    className="w-full bg-dark-bg border border-gold-900 rounded-xl px-3 py-2 sm:py-2.5 text-xs text-white font-mono font-bold focus:border-gold-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Upload Proof */}
              <div>
                <label className="block text-[11px] sm:text-xs font-semibold text-gray-300 mb-1">
                  {t('uploadProof')}
                </label>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <label className="flex-1 border-2 border-dashed border-gold-800 hover:border-gold-500 rounded-xl p-2 sm:p-3 flex items-center justify-center space-x-2 text-xs text-gold-300 cursor-pointer bg-dark-bg/60">
                    <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold-400" />
                    <span className="truncate max-w-[200px]">{slipFile ? slipFile.name : t('chooseFile')}</span>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                  {slipPreviewUrl && (
                    <a href={slipPreviewUrl} target="_blank" rel="noreferrer" className="text-xs text-sky-400 underline font-bold shrink-0">
                      {t('previewFile')}
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 sm:space-x-3 pt-2 sm:pt-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3.5 sm:px-5 py-2.5 sm:py-3.5 rounded-xl bg-dark-bg/80 border border-gold-900/80 hover:border-gold-500/80 text-gray-300 hover:text-white font-bold text-xs transition-all cursor-pointer flex items-center space-x-1.5 shrink-0"
                  title={t('backBtn')}
                >
                  <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold-400" />
                  <span>{t('backBtn')}</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 sm:py-3.5 rounded-xl gold-gradient-btn text-dark-bg font-extrabold text-xs sm:text-sm tracking-wider shadow-gold hover:shadow-gold-lg transition-all cursor-pointer"
                >
                  {loading ? t('submittingBtn') : t('submitCashIn')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: WITHDRAWAL / CASH OUT */}
        {/* ============================================================== */}
        {walletTab === 'withdraw' && (
          <div>
            <div className="mb-3 sm:mb-4 p-2 sm:p-2.5 rounded-xl bg-dark-card border border-gold-600/40 flex items-center justify-between text-xs text-gold-300">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold-400" />
                <span className="text-[11px] sm:text-xs">{t('operatingHours')}</span>
              </div>
              <span className="font-mono text-[9px] sm:text-[10px] text-green-400 font-bold bg-green-950/60 px-1.5 sm:px-2 py-0.5 rounded border border-green-800">
                {t('processedInMinsBadge')}
              </span>
            </div>

            {/* Withdrawal Result Notification */}
            {withdrawResult && (
              <div className={`p-3 sm:p-4 rounded-xl mb-3 sm:mb-4 border ${
                withdrawResult.success
                  ? 'bg-amber-950/80 border-amber-500/60 text-amber-200'
                  : 'bg-red-950/70 border-red-500/60 text-red-200'
              }`}>
                <div className="flex items-start space-x-2.5 sm:space-x-3">
                  {withdrawResult.success ? (
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                  ) : (
                    <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs space-y-1">
                    <div className="flex items-center space-x-2">
                      <p className="font-bold text-sm text-white">
                        {withdrawResult.success 
                          ? (lang === 'mm' ? 'ငွေထုတ်ယူခွင့် တောင်းဆိုမှု တင်သွင်းပြီးပါပြီ' : 'WITHDRAWAL REQUEST SUBMITTED') 
                          : (lang === 'mm' ? 'တောင်းဆိုမှု မအောင်မြင်ပါ' : 'Request Failed')}
                      </p>
                      {withdrawResult.success && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/30 text-amber-300 border border-amber-500/50 font-bold uppercase">
                          ⏳ {lang === 'mm' ? 'ဆိုင်းငံ့ (Pending)' : 'Pending'}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-200 leading-relaxed">{withdrawResult.message}</p>
                    {withdrawResult.new_balance !== undefined && (
                      <div className="pt-1 mt-1 border-t border-amber-500/30 flex items-center justify-between">
                        <span className="text-gray-300">
                          {lang === 'mm' ? 'အကောင့်ထဲမှ နုတ်ယူပြီး ကျန်ငွေ:' : 'Deducted Balance Left:'}
                        </span>
                        <span className="font-mono font-bold text-gold-300 text-sm">
                          {formatMoney(withdrawResult.new_balance)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Gateway Selection for Withdrawal */}
            <div className="mb-3 sm:mb-4">
              <label className="block text-[11px] sm:text-xs font-bold text-gold-300 uppercase tracking-wider mb-1.5 sm:mb-2">
                {t('selectGateway')}
              </label>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { id: 'kpay', name: 'KBZPay', logo: 'KPay' },
                  { id: 'wavepay', name: 'WavePay', logo: 'Wave' },
                  { id: 'ayapay', name: 'AYA Pay', logo: 'AYA' }
                ].map((gw) => (
                  <button
                    key={gw.id}
                    type="button"
                    onClick={() => { setWithdrawGateway(gw.id); setWithdrawResult(null); }}
                    className={`py-2 sm:py-3 px-1.5 sm:px-3 rounded-xl font-bold text-xs sm:text-sm transition-all border flex flex-col items-center justify-center space-y-0.5 sm:space-y-1 cursor-pointer ${
                      withdrawGateway === gw.id
                        ? 'bg-dark-card border-gold-500 shadow-gold-sm text-gold-300'
                        : 'bg-dark-bg/60 border-dark-border text-gray-400 hover:text-white hover:border-gold-800'
                    }`}
                  >
                    <span className="font-extrabold text-sm sm:text-base tracking-wider">{gw.logo}</span>
                    <span className="text-[10px] sm:text-[11px] font-normal opacity-80">{gw.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Withdrawal Form */}
            <form onSubmit={handleSubmitWithdrawal} className="space-y-2.5 sm:space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5">
                <div>
                  <label className="block text-[11px] sm:text-xs font-semibold text-gray-300 mb-1">
                    {t('receiverName')}
                  </label>
                  <input
                    type="text"
                    required
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder={lang === 'mm' ? 'ဥပမာ: ဦးကိုကို / ဒေါ်လှ' : 'e.g. U Ko Ko / Daw Hla'}
                    className="w-full bg-dark-bg border border-gold-900 rounded-xl px-3 py-2 sm:py-2.5 text-xs text-white focus:border-gold-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] sm:text-xs font-semibold text-gray-300 mb-1">
                    {t('receiverPhone')}
                  </label>
                  <input
                    type="tel"
                    required
                    value={receiverAccount}
                    onChange={(e) => setReceiverAccount(e.target.value)}
                    placeholder={lang === 'mm' ? 'ဥပမာ: ၀၉၈၈၈၈၈၈၈၈၈' : 'e.g. 09888888888'}
                    className="w-full bg-dark-bg border border-gold-900 rounded-xl px-3 py-2 sm:py-2.5 text-xs text-white font-mono focus:border-gold-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] sm:text-xs font-semibold text-gray-300">
                    {t('withdrawAmount')} *
                  </label>
                  <span className="text-[10px] sm:text-[11px] text-gray-400">
                    {t('minWithdrawLimit')}
                  </span>
                </div>
                <input
                  type="number"
                  required
                  min="1000"
                  step="1000"
                  max={user?.balance || 0}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder={t('withdrawAmountPlaceholder')}
                  className="w-full bg-dark-bg border border-gold-900 rounded-xl px-3 py-2 sm:py-2.5 text-xs text-white font-mono font-bold focus:border-gold-400 focus:outline-none"
                />

                {/* Quick Amount Chips */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2">
                  {[10000, 50000, 100000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setWithdrawAmount(amt.toString())}
                      className="px-2 sm:px-2.5 py-1 rounded-lg bg-dark-card border border-gold-900/60 hover:border-gold-500 text-[10px] sm:text-[11px] font-mono text-gold-300 cursor-pointer"
                    >
                      +{num(amt.toLocaleString())} {t('currencySymbol')}
                    </button>
                  ))}
                  {user?.balance > 0 && (
                    <button
                      type="button"
                      onClick={() => setWithdrawAmount(user.balance.toString())}
                      className="px-2 sm:px-2.5 py-1 rounded-lg bg-gold-950 border border-gold-600 hover:bg-gold-900 text-[10px] sm:text-[11px] font-bold text-gold-200 cursor-pointer"
                    >
                      {t('maxAll')}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 sm:space-x-3 pt-2 sm:pt-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3.5 sm:px-5 py-2.5 sm:py-3.5 rounded-xl bg-dark-bg/80 border border-gold-900/80 hover:border-gold-500/80 text-gray-300 hover:text-white font-bold text-xs transition-all cursor-pointer flex items-center space-x-1.5 shrink-0"
                  title={t('backBtn')}
                >
                  <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold-400" />
                  <span>{t('backBtn')}</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 sm:py-3.5 rounded-xl gold-gradient-btn text-dark-bg font-extrabold text-xs sm:text-sm tracking-wider shadow-gold hover:shadow-gold-lg transition-all cursor-pointer"
                >
                  {loading ? t('submittingBtn') : t('submitCashOut')}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
