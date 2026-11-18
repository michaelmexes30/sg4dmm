import React, { useState, useRef, useEffect, useMemo } from 'react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { 
  ChevronLeft, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Flame, 
  Trophy, 
  Sparkles, 
  Crown, 
  Info, 
  X,
  HelpCircle
} from 'lucide-react';

// =========================================================================
// 24 SLOTS FOR ROYAL CROWN (CARD ROULETTE)
// Strictly 2 Full Sets Clockwise:
// Set 1: 0 (Red), 2, 3, 4, 5, 6, 7, 8, 9, J, Q, K (Green)
// Set 2: 0 (Red), 2, 3, 4, 5, 6, 7, 8, 9, J, Q, K (Green)
// =========================================================================
export const ROYAL_CROWN_SECTORS = [
  // Set 1 (0 to 11)
  { index: 0, rank: '0', label: '0', color: 'red', bg: '#dc2626', is_cush: true },
  { index: 1, rank: '2', label: '2', color: 'green', bg: '#15803d', is_cush: false },
  { index: 2, rank: '3', label: '3', color: 'green', bg: '#15803d', is_cush: false },
  { index: 3, rank: '4', label: '4', color: 'green', bg: '#15803d', is_cush: false },
  { index: 4, rank: '5', label: '5', color: 'green', bg: '#15803d', is_cush: false },
  { index: 5, rank: '6', label: '6', color: 'green', bg: '#15803d', is_cush: false },
  { index: 6, rank: '7', label: '7', color: 'green', bg: '#15803d', is_cush: false },
  { index: 7, rank: '8', label: '8', color: 'green', bg: '#15803d', is_cush: false },
  { index: 8, rank: '9', label: '9', color: 'green', bg: '#15803d', is_cush: false },
  { index: 9, rank: 'J', label: 'J', color: 'green', bg: '#15803d', is_cush: false },
  { index: 10, rank: 'Q', label: 'Q', color: 'green', bg: '#15803d', is_cush: false },
  { index: 11, rank: 'K', label: 'K', color: 'green', bg: '#15803d', is_cush: false },
  // Set 2 (12 to 23)
  { index: 12, rank: '0', label: '0', color: 'red', bg: '#dc2626', is_cush: true },
  { index: 13, rank: '2', label: '2', color: 'green', bg: '#15803d', is_cush: false },
  { index: 14, rank: '3', label: '3', color: 'green', bg: '#15803d', is_cush: false },
  { index: 15, rank: '4', label: '4', color: 'green', bg: '#15803d', is_cush: false },
  { index: 16, rank: '5', label: '5', color: 'green', bg: '#15803d', is_cush: false },
  { index: 17, rank: '6', label: '6', color: 'green', bg: '#15803d', is_cush: false },
  { index: 18, rank: '7', label: '7', color: 'green', bg: '#15803d', is_cush: false },
  { index: 19, rank: '8', label: '8', color: 'green', bg: '#15803d', is_cush: false },
  { index: 20, rank: '9', label: '9', color: 'green', bg: '#15803d', is_cush: false },
  { index: 21, rank: 'J', label: 'J', color: 'green', bg: '#15803d', is_cush: false },
  { index: 22, rank: 'Q', label: 'Q', color: 'green', bg: '#15803d', is_cush: false },
  { index: 23, rank: 'K', label: 'K', color: 'green', bg: '#15803d', is_cush: false },
];

const CHIP_DENOMINATIONS = [
  { value: 100, label: '100', color: '#1e293b', border: '#e2e8f0', text: '#ffffff' },
  { value: 500, label: '500', color: '#7e22ce', border: '#f3e8ff', text: '#ffffff' },
  { value: 1000, label: '1K', color: '#047857', border: '#a7f3d0', text: '#ffffff' },
  { value: 5000, label: '5K', color: '#b91c1c', border: '#fef08a', text: '#ffffff' },
];

// Web Audio API Synthesizer
class ArcadeAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playChip() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {}
  }

  playTick(frequency = 800) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(frequency * 0.5, this.ctx.currentTime + 0.03);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.03);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.03);
    } catch (e) {}
  }

  playFretClick(pitch = 500) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      // Realistic wood/metal fret impact clack
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch (e) {}
  }

  playBallSnap() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(250, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch (e) {}
  }

  playWin(isStreak = false) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const notes = isStreak ? [523, 659, 784, 1046, 1318, 1568] : [523, 659, 784, 1046];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = isStreak ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + idx * 0.08 + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + idx * 0.08);
        osc.stop(this.ctx.currentTime + idx * 0.08 + 0.3);
      });
    } catch (e) {}
  }

  playClear() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {}
  }
}

const audio = new ArcadeAudioEngine();

export default function CardWheelGame({ onOpenDeposit, onBack }) {
  const { user, refreshProfile } = useAuth();

  // Selected chip amount for placing bets
  const [selectedChip, setSelectedChip] = useState(100);

  // Bets map: { "9": 1000, "K": 500, "CUSH": 100 }
  const [bets, setBets] = useState({});
  const [previousBets, setPreviousBets] = useState(null);

  // Spin & Animation state
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [ballAngle, setBallAngle] = useState(0); // Ball angle in degrees
  const [ballRadius, setBallRadius] = useState(115); // Distance from wheel center in px

  // Results & History
  const [history, setHistory] = useState(['9', 'K', '0', '4', '9']);
  const [lastWinResult, setLastWinResult] = useState(null);
  const [soundOn, setSoundOn] = useState(true);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Side Arcade Bulbs blinking stage
  const [bulbPhase, setBulbPhase] = useState(0);

  // Wheel animation refs
  const animFrameRef = useRef(null);
  const spinStartRef = useRef(0);

  // Load history from backend
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await apiClient.getCardWheelHistory(8);
        if (res?.history && res.history.length > 0) {
          setHistory(res.history);
        }
      } catch (e) {
        // Fallback default history
      }
    };
    loadHistory();
  }, []);

  // Bulb cycling animation timer during spin
  useEffect(() => {
    const interval = setInterval(() => {
      setBulbPhase((p) => (p + 1) % 4);
    }, spinning ? 120 : 700);
    return () => clearInterval(interval);
  }, [spinning]);

  // Total current staked MMK
  const totalStake = useMemo(() => {
    return Object.values(bets).reduce((sum, amt) => sum + (Number(amt) || 0), 0);
  }, [bets]);

  // Toggle Sound
  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    audio.enabled = next;
    if (next) audio.playChip();
  };

  // Add chip to cell
  const handleCellClick = (choice) => {
    if (spinning) return;
    audio.playChip();
    setErrorMessage('');
    setBets((prev) => {
      const current = prev[choice] || 0;
      return {
        ...prev,
        [choice]: current + selectedChip,
      };
    });
  };

  // Clear all bets
  const handleClearBets = () => {
    if (spinning) return;
    audio.playClear();
    if (totalStake > 0) {
      setPreviousBets({ ...bets });
    }
    setBets({});
    setErrorMessage('');
  };

  // Double current bets or Re-bet
  const handleDoubleOrRebet = () => {
    if (spinning) return;
    audio.playChip();
    if (totalStake > 0) {
      // Double existing bets
      setBets((prev) => {
        const next = {};
        Object.keys(prev).forEach((k) => {
          next[k] = prev[k] * 2;
        });
        return next;
      });
    } else if (previousBets && Object.keys(previousBets).length > 0) {
      // Re-bet previous layout
      setBets({ ...previousBets });
    }
  };

  // Trigger Wheel Spin
  const handleSpin = async () => {
    if (spinning) return;
    if (totalStake <= 0) {
      setErrorMessage('ကျေးဇူးပြု၍ လောင်းကြေး အရင်ရွေးချယ်ပါ (Place a bet first)');
      return;
    }

    const currentBal = Number(user?.balance || 0);
    if (currentBal < totalStake) {
      setErrorMessage('လက်ကျန်ငွေ မလုံလောက်ပါ (Insufficient balance)');
      if (onOpenDeposit) onOpenDeposit();
      return;
    }

    setErrorMessage('');
    setSpinning(true);
    setLastWinResult(null);
    setPreviousBets({ ...bets });

    // Format bets for API
    const betsPayload = Object.entries(bets).map(([choice, stake]) => ({
      choice,
      stake,
    }));

    try {
      const res = await apiClient.spinCardWheel({ bets: betsPayload });

      if (res && res.status === 'success') {
        const winningSector = res.sector || {};
        const winIndex = winningSector.index ?? 0;
        const winRank = res.hit_rank || '0';

        // Animate the wheel & ball
        runRouletteAnimation(winIndex, () => {
          // Animation finished callback
          setSpinning(false);
          setLastWinResult(res);

          // Update history strip
          setHistory((prev) => [String(winRank), ...prev.slice(0, 7)]);

          // Sound celebration
          if (res.is_win) {
            audio.playWin(res.is_streak);
          }

          if (refreshProfile) refreshProfile();
        });
      } else {
        setSpinning(false);
        setErrorMessage(res.message || 'Spin failed. Please try again.');
      }
    } catch (err) {
      setSpinning(false);
      setErrorMessage(err.message || 'Spin failed. Network error.');
    }
  };

  // High-performance authentic physics animation for Wheel & Ball (15-second suspense)
  const runRouletteAnimation = (targetPocketIndex, onComplete) => {
    const anglePerPocket = 360 / 24; // 15 degrees per pocket
    const pocketOffsetAngle = targetPocketIndex * anglePerPocket;

    const DURATION = 15000; // Strictly 15 seconds
    const startTime = performance.now();
    spinStartRef.current = startTime;

    // Wheel initial state:
    // Heavy brass flywheel rotating clockwise (+) with gentle bearing friction
    const initialWheelRot = wheelRotation % 360;
    const totalWheelRevs = 6;
    const wheelTravel = 360 * totalWheelRevs;
    const finalWheelRot = initialWheelRot + wheelTravel;

    // Ball initial state:
    // Ball launched Counter-Clockwise (-) opposite to the wheel rotation
    // Total relative travel against the oncoming wheel pocket: 18 revolutions
    const totalBallRevs = 18;
    const totalRelativeTravel = 360 * totalBallRevs;

    let lastTickAngle = null;
    let lastTickTime = startTime;
    let hasPlayedSnap = false;

    const animate = (now) => {
      const elapsed = Math.max(0, now - startTime);
      const u = Math.min(1, elapsed / DURATION);

      // ---------------------------------------------------------------------
      // 1. WHEEL PHYSICS (Clockwise, high inertia flywheel with smooth friction)
      // ---------------------------------------------------------------------
      const wheelProgress = (u - 0.15 * u * u) / 0.85;
      const curWheelRot = initialWheelRot + wheelTravel * wheelProgress;
      setWheelRotation(curWheelRot);

      // Exact world angle of the target pocket on the wheel
      const targetPocketWorldAngle = curWheelRot + pocketOffsetAngle;

      // ---------------------------------------------------------------------
      // 2. BALL ORBITAL ANGLE (Counter-Clockwise with C^2 Hermite Deceleration)
      // ---------------------------------------------------------------------
      // Smooth continuous Hermite curve: f(0)=0, f(1)=1, f'(1)=0, f''(1)=0 (zero jerks!)
      const f_u = 1 - Math.pow(1 - u, 3) * (1 + 2 * u);
      const relAngle = -totalRelativeTravel * (1 - f_u);

      // Pocket Fret Bouncing (13.0s to 14.7s / u in [0.86, 0.98])
      // When ball strikes oncoming brass frets, it deflects and rattles
      let bounceAngle = 0;
      let bounceRadius = 0;
      if (u >= 0.86 && u < 0.98) {
        const tau = (u - 0.86) / 0.12; // 0 to 1
        const decay = Math.pow(1 - tau, 2);
        // Angular hop back and forth across frets
        bounceAngle = 10 * decay * Math.sin(tau * Math.PI * 3);
        // Micro vertical hop over fret divider
        bounceRadius = 3.5 * decay * Math.abs(Math.sin(tau * Math.PI * 3));
      }

      // Ball World Angle = Target Pocket World Angle + Relative Travel + Fret Bounce
      const curBallAngle = targetPocketWorldAngle + relAngle + bounceAngle;
      setBallAngle(curBallAngle);

      // ---------------------------------------------------------------------
      // 3. BALL RADIUS (Track Descent from Outer Rim to Pocket Center)
      // ---------------------------------------------------------------------
      // u < 0.70 (0 - 10.5s): Centrifugal force holds ball on outer rim track (121px)
      // 0.70 <= u <= 0.88 (10.5s - 13.2s): Smooth descent from 121px down to 95px
      // u > 0.88 (13.2s - 15.0s): Ball is inside pocket ring (95px + fret micro-hops)
      let curRadius = 121;
      if (u >= 0.70 && u < 0.88) {
        const s = (u - 0.70) / 0.18;
        const h_s = 3 * s * s - 2 * s * s * s; // Smoothstep
        curRadius = 121 - (121 - 95) * h_s;
      } else if (u >= 0.88) {
        curRadius = 95 + bounceRadius;
      }
      setBallRadius(curRadius);

      // ---------------------------------------------------------------------
      // 4. REALISTIC ARCADE AUDIO SYNC
      // ---------------------------------------------------------------------
      if (lastTickAngle === null) lastTickAngle = curBallAngle;
      const angleMoved = Math.abs(curBallAngle - lastTickAngle);
      const timeSinceTick = now - lastTickTime;

      if (u < 0.86) {
        // Upper Track Ticks (interval widens as ball decelerates: 40ms -> 300ms)
        const minInterval = 40 + Math.pow(u / 0.86, 2.5) * 320;
        if (angleMoved >= 12 && timeSinceTick >= minInterval) {
          const tickPitch = 750 - (u / 0.86) * 250 + Math.random() * 80;
          audio.playTick(tickPitch);
          lastTickAngle = curBallAngle;
          lastTickTime = now;
        }
      } else if (u < 0.98) {
        // Pocket Fret Clatter / Rattling as ball hits dividers
        if (timeSinceTick >= 85) {
          const fretPitch = 480 + Math.random() * 140;
          audio.playFretClick(fretPitch);
          lastTickAngle = curBallAngle;
          lastTickTime = now;
        }
      } else if (u >= 0.98 && !hasPlayedSnap) {
        // Final solid pocket snap
        hasPlayedSnap = true;
        audio.playBallSnap();
      }

      // ---------------------------------------------------------------------
      // 5. ANIMATION COMPLETION
      // ---------------------------------------------------------------------
      if (u < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Snap locked directly to pocket
        setWheelRotation(finalWheelRot % 360);
        setBallAngle((finalWheelRot + pocketOffsetAngle) % 360);
        setBallRadius(95);
        if (onComplete) onComplete();
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="w-full max-w-[420px] mx-auto select-none font-sans text-slate-100">
      {/* =========================================================================
          ARCADE CABINET OUTER SHELL (Dark Walnut Wood + Brass Metallic Bevel)
          ========================================================================= */}
      <div className="relative rounded-3xl p-3 sm:p-4 shadow-2xl overflow-hidden border-4 border-[#8e6827] bg-gradient-to-b from-[#1b110a] via-[#2a180e] to-[#120b06] shadow-[0_15px_40px_rgba(0,0,0,0.9)]">
        
        {/* Vintage Brass Corner Rivets */}
        <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-amber-200 to-amber-700 shadow-sm border border-amber-900/60" />
        <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-amber-200 to-amber-700 shadow-sm border border-amber-900/60" />
        <div className="absolute bottom-2 left-2 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-amber-200 to-amber-700 shadow-sm border border-amber-900/60" />
        <div className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-amber-200 to-amber-700 shadow-sm border border-amber-900/60" />

        {/* 1. TOP HEADER BAR */}
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          {/* Back Button */}
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-gradient-to-b from-[#3a2213] to-[#1f120a] border border-[#d4af37]/60 flex items-center justify-center text-amber-300 hover:text-white shadow-md active:scale-95 transition-transform cursor-pointer"
            title="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Ornate Gold Banner Title: "ROYAL CROWN" */}
          <div className="flex-1 flex justify-center">
            <div className="relative px-4 py-1 rounded-xl bg-gradient-to-b from-[#2a170b] via-[#3a2213] to-[#1a0e07] border-2 border-[#d4af37] shadow-[0_2px_10px_rgba(212,175,55,0.3)]">
              {/* Filigree corner accents */}
              <span className="absolute -top-1 -left-1 text-[10px] text-amber-400">❖</span>
              <span className="absolute -top-1 -right-1 text-[10px] text-amber-400">❖</span>
              <h1 className="text-sm sm:text-base font-serif font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-[#fff2a8] via-[#e5b338] to-[#916b18] drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)] uppercase">
                ROYAL CROWN
              </h1>
            </div>
          </div>

          {/* Digital LED Balance Display */}
          <div className="bg-[#0a0604] border border-[#d4af37]/80 rounded-lg px-2.5 py-0.5 text-right shadow-inner min-w-[90px]">
            <span className="text-[9px] text-amber-400/90 font-bold tracking-wider block leading-none">
              BALANCE:
            </span>
            <span className="text-xs sm:text-sm font-mono font-black text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]">
              {Number(user?.balance || 50000).toLocaleString()}
            </span>
          </div>
        </div>

        {/* 2. HISTORY SUB-BAR */}
        <div className="flex items-center justify-between bg-[#150d08] border border-amber-900/60 rounded-xl px-2 py-1 mb-2.5 shadow-inner">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowRuleModal(true)}
              className="text-amber-400/80 hover:text-amber-300 p-1 cursor-pointer transition-colors"
              title="Game Rules & Multipliers"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-black text-amber-300/80 tracking-wider">
              HISTORY:
            </span>
          </div>

          {/* Mini Playing Cards History Strip */}
          <div className="flex items-center gap-1.5 overflow-hidden">
            {history.slice(0, 5).map((card, idx) => {
              const isZero = card === '0' || card === 'CUSH';
              const isRed = ['K', 'Q', 'J'].includes(card) && idx % 2 === 1;
              return (
                <div
                  key={idx}
                  className={`w-6 h-7 rounded sm:rounded-md flex items-center justify-center font-mono font-black text-xs shadow-md transition-all ${
                    idx === 0 ? 'scale-105 ring-1 ring-amber-400' : 'opacity-85'
                  } ${
                    isZero
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-500'
                      : isRed
                      ? 'bg-white text-rose-600 border border-slate-300'
                      : 'bg-white text-slate-900 border border-slate-300'
                  }`}
                >
                  {isZero ? '0' : card}
                </div>
              );
            })}
          </div>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="text-amber-400/80 hover:text-amber-300 p-1 cursor-pointer transition-colors"
            title={soundOn ? 'Sound Mute' : 'Sound On'}
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

        {/* 3. CENTRAL ROULETTE WHEEL CONTAINER */}
        <div className="relative flex justify-center items-center my-1">
          {/* Wheel SVG Component */}
          <div className="relative w-[280px] h-[280px] sm:w-[300px] sm:h-[300px] flex items-center justify-center">
            
            {/* Outer Walnut Wood Bezel + Brass Rivet Ring */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]"
              viewBox="0 0 300 300"
            >
              <defs>
                <radialGradient id="walnutWood" cx="50%" cy="50%" r="50%">
                  <stop offset="60%" stopColor="#25140b" />
                  <stop offset="85%" stopColor="#442614" />
                  <stop offset="100%" stopColor="#150a04" />
                </radialGradient>
                <linearGradient id="brassMetallic" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fff3b0" />
                  <stop offset="40%" stopColor="#d4af37" />
                  <stop offset="70%" stopColor="#8c6d1d" />
                  <stop offset="100%" stopColor="#5c450c" />
                </linearGradient>
                <radialGradient id="feltGreenGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#0a3317" />
                  <stop offset="70%" stopColor="#0f4821" />
                  <stop offset="100%" stopColor="#082b13" />
                </radialGradient>
              </defs>

              {/* Outer Wood Ring */}
              <circle cx="150" cy="150" r="148" fill="url(#walnutWood)" stroke="#8e6827" strokeWidth="3" />
              {/* Outer Brass Lip */}
              <circle cx="150" cy="150" r="140" fill="none" stroke="url(#brassMetallic)" strokeWidth="2.5" />
              <circle cx="150" cy="150" r="136" fill="none" stroke="#25140b" strokeWidth="1" />

              {/* 24 Brass Rivet Studs around the wood ring */}
              {Array.from({ length: 24 }).map((_, i) => {
                const angle = (i * 15 * Math.PI) / 180;
                const rx = 150 + Math.cos(angle) * 144;
                const ry = 150 + Math.sin(angle) * 144;
                return (
                  <circle
                    key={i}
                    cx={rx}
                    cy={ry}
                    r="2.2"
                    fill="url(#brassMetallic)"
                    stroke="#422e06"
                    strokeWidth="0.5"
                  />
                );
              })}

              {/* Inner Ball Track (Felt Green) */}
              <circle cx="150" cy="150" r="132" fill="url(#feltGreenGrad)" stroke="#1a532d" strokeWidth="2" />
            </svg>

            {/* Rotating Wheel Dish (Carries the 24 Pockets & Central Spindle) */}
            <div
              className="absolute w-[240px] h-[240px] rounded-full"
              style={{
                transform: `rotate(${wheelRotation}deg)`,
                willChange: 'transform',
              }}
            >
              <svg className="w-full h-full" viewBox="0 0 240 240">
                <defs>
                  <linearGradient id="goldSpoke" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fff1a8" />
                    <stop offset="50%" stopColor="#d4af37" />
                    <stop offset="100%" stopColor="#7a5a12" />
                  </linearGradient>
                  <radialGradient id="centerDome" cx="40%" cy="35%" r="60%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="30%" stopColor="#fff3b0" />
                    <stop offset="70%" stopColor="#d4af37" />
                    <stop offset="100%" stopColor="#5c440d" />
                  </radialGradient>
                </defs>

                {/* 24 Radial Pockets */}
                {ROYAL_CROWN_SECTORS.map((sec, idx) => {
                  const angle = idx * 15; // 15 degrees per pocket
                  const radStart = ((angle - 7.5 - 90) * Math.PI) / 180;
                  const radEnd = ((angle + 7.5 - 90) * Math.PI) / 180;
                  const R_OUT = 118;
                  const R_IN = 72;

                  const x1 = 120 + R_OUT * Math.cos(radStart);
                  const y1 = 120 + R_OUT * Math.sin(radStart);
                  const x2 = 120 + R_OUT * Math.cos(radEnd);
                  const y2 = 120 + R_OUT * Math.sin(radEnd);
                  const x3 = 120 + R_IN * Math.cos(radEnd);
                  const y3 = 120 + R_IN * Math.sin(radEnd);
                  const x4 = 120 + R_IN * Math.cos(radStart);
                  const y4 = 120 + R_IN * Math.sin(radStart);

                  const pathD = `M ${x1} ${y1} A ${R_OUT} ${R_OUT} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${R_IN} ${R_IN} 0 0 0 ${x4} ${y4} Z`;

                  // Center position for label text
                  const midRad = ((angle - 90) * Math.PI) / 180;
                  const textR = 95;
                  const tx = 120 + textR * Math.cos(midRad);
                  const ty = 120 + textR * Math.sin(midRad);

                  const isWinningPocket = !spinning && lastWinResult?.sector?.index === sec.index;

                  return (
                    <g key={sec.index}>
                      {/* Pocket Background */}
                      <path
                        d={pathD}
                        fill={isWinningPocket ? '#ca8a04' : sec.is_cush ? '#b91c1c' : '#14532d'}
                        stroke={isWinningPocket ? '#fde047' : 'url(#goldSpoke)'}
                        strokeWidth={isWinningPocket ? '2.5' : '1.2'}
                      />
                      {/* Card Rank Label */}
                      <text
                        x={tx}
                        y={ty}
                        fill={sec.is_cush ? '#ffffff' : '#fef08a'}
                        fontSize="11.5"
                        fontWeight="900"
                        fontFamily="Outfit, Padauk, sans-serif"
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(${angle}, ${tx}, ${ty})`}
                        style={{
                          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))',
                        }}
                      >
                        {sec.label}
                      </text>
                    </g>
                  );
                })}

                {/* Inner Brass Rim */}
                <circle cx="120" cy="120" r="72" fill="none" stroke="url(#goldSpoke)" strokeWidth="2.5" />
                <circle cx="120" cy="120" r="68" fill="#0f4821" stroke="#082912" strokeWidth="2" />

                {/* 4-Spoke Central Brass Crossbar / Turret Spinner */}
                <g transform="translate(120, 120)">
                  {/* Crossbar 4 arms */}
                  {[0, 90, 180, 270].map((armAngle) => (
                    <g key={armAngle} transform={`rotate(${armAngle})`}>
                      <rect
                        x="-3.5"
                        y="-48"
                        width="7"
                        height="48"
                        rx="3.5"
                        fill="url(#goldSpoke)"
                        stroke="#4a3608"
                        strokeWidth="0.8"
                      />
                      {/* Turned brass knob */}
                      <circle cx="0" cy="-48" r="5" fill="url(#centerDome)" stroke="#5c440d" strokeWidth="1" />
                    </g>
                  ))}
                  {/* Center Polished Brass Dome */}
                  <circle cx="0" cy="0" r="16" fill="url(#centerDome)" stroke="#4a3608" strokeWidth="1.5" />
                  <circle cx="-3" cy="-3" r="4" fill="#ffffff" opacity="0.6" />
                </g>
              </svg>
            </div>

            {/* Realistically Shaded 3D Ivory White Ball in SVG Coordinates (Zero CSS Scale Error) */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-20"
              viewBox="0 0 300 300"
            >
              <defs>
                <radialGradient id="ballIvory3D" cx="35%" cy="30%" r="65%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="35%" stopColor="#f8fafc" />
                  <stop offset="70%" stopColor="#cbd5e1" />
                  <stop offset="100%" stopColor="#64748b" />
                </radialGradient>
                <radialGradient id="ballShadow3D" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(0,0,0,0.85)" />
                  <stop offset="60%" stopColor="rgba(0,0,0,0.4)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                </radialGradient>
              </defs>

              {/* Realistic Contact Shadow on Track */}
              <ellipse
                cx={150 + (ballRadius - 1.5) * Math.sin((ballAngle * Math.PI) / 180) + 1.8}
                cy={150 - (ballRadius - 1.5) * Math.cos((ballAngle * Math.PI) / 180) + 2.5}
                rx="6.5"
                ry="4.5"
                fill="url(#ballShadow3D)"
              />

              {/* 3D Ivory Ball Body */}
              <circle
                cx={150 + ballRadius * Math.sin((ballAngle * Math.PI) / 180)}
                cy={150 - ballRadius * Math.cos((ballAngle * Math.PI) / 180)}
                r="6.5"
                fill="url(#ballIvory3D)"
                stroke="#ffffff"
                strokeWidth="0.8"
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.7))',
                }}
              />

              {/* Specular Glint Highlight */}
              <circle
                cx={150 + ballRadius * Math.sin((ballAngle * Math.PI) / 180) - 1.8}
                cy={150 - ballRadius * Math.cos((ballAngle * Math.PI) / 180) - 1.8}
                r="1.8"
                fill="#ffffff"
                opacity="0.9"
              />
            </svg>
          </div>
        </div>

        {/* 4. RETRO NEON-GREEN LED BETTING GRID SECTION */}
        <div className="relative my-2 flex items-stretch gap-1.5 sm:gap-2">
          
          {/* Left Arcade Bulbs Column */}
          <div className="flex flex-col justify-between py-1 px-0.5 bg-[#170e08] border border-amber-900/60 rounded-lg shadow-inner">
            {['#eab308', '#f97316', '#22c55e', '#3b82f6', '#f8fafc', '#ef4444'].map((color, i) => {
              const active = (bulbPhase + i) % 2 === 0;
              return (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full transition-all duration-150"
                  style={{
                    backgroundColor: active ? color : '#3a2717',
                    boxShadow: active ? `0 0 6px ${color}` : 'none',
                  }}
                />
              );
            })}
          </div>

          {/* Center Neon-Green Grid Panel */}
          <div className="flex-1 relative rounded-2xl p-2 bg-[#05130b] border-2 border-[#00ff66] shadow-[0_0_15px_rgba(0,255,102,0.4),inset_0_0_12px_rgba(0,255,102,0.2)]">
            
            {/* Main Grid Structure */}
            <div className="grid grid-cols-5 gap-1.5 h-full">
              
              {/* Left 4 Columns: Rows 1, 2, 3 */}
              <div className="col-span-4 flex flex-col gap-1.5">
                
                {/* ROW 1: [2, 3, 4, 5] */}
                <div className="grid grid-cols-4 gap-1.5">
                  {['2', '3', '4', '5'].map((card) => {
                    const betAmt = bets[card] || 0;
                    const isWinningCell = lastWinResult?.hit_rank === card;
                    return (
                      <button
                        key={card}
                        onClick={() => handleCellClick(card)}
                        disabled={spinning}
                        className={`relative h-11 sm:h-12 rounded-lg flex flex-col items-center justify-center font-mono transition-all cursor-pointer border ${
                          isWinningCell
                            ? 'bg-amber-400/40 border-amber-300 shadow-[0_0_15px_#f59e0b] scale-105'
                            : betAmt > 0
                            ? 'bg-[#0f381e] border-[#00ff66] shadow-[0_0_8px_rgba(0,255,102,0.6)]'
                            : 'bg-[#062012]/80 hover:bg-[#0b331c] border-[#00ff66]/60 active:scale-95'
                        }`}
                      >
                        {/* Card Digit */}
                        <span className="text-base sm:text-lg font-black text-[#fef08a] drop-shadow-[0_0_5px_rgba(254,240,138,0.8)]">
                          {card}
                        </span>

                        {/* Placed Chip Badge */}
                        {betAmt > 0 && (
                          <div className="absolute -bottom-1 text-[9px] font-mono font-black px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 shadow-md">
                            {betAmt >= 1000 ? `${betAmt / 1000}K` : betAmt}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* ROW 2: [6, 7, 8, 9] */}
                <div className="grid grid-cols-4 gap-1.5">
                  {['6', '7', '8', '9'].map((card) => {
                    const betAmt = bets[card] || 0;
                    const isWinningCell = lastWinResult?.hit_rank === card;
                    return (
                      <button
                        key={card}
                        onClick={() => handleCellClick(card)}
                        disabled={spinning}
                        className={`relative h-11 sm:h-12 rounded-lg flex flex-col items-center justify-center font-mono transition-all cursor-pointer border ${
                          isWinningCell
                            ? 'bg-amber-400/40 border-amber-300 shadow-[0_0_15px_#f59e0b] scale-105'
                            : betAmt > 0
                            ? 'bg-[#0f381e] border-[#00ff66] shadow-[0_0_8px_rgba(0,255,102,0.6)]'
                            : 'bg-[#062012]/80 hover:bg-[#0b331c] border-[#00ff66]/60 active:scale-95'
                        }`}
                      >
                        <span className="text-base sm:text-lg font-black text-[#fef08a] drop-shadow-[0_0_5px_rgba(254,240,138,0.8)]">
                          {card}
                        </span>

                        {betAmt > 0 && (
                          <div className="absolute -bottom-1 text-[9px] font-mono font-black px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 shadow-md">
                            {betAmt >= 1000 ? `${betAmt / 1000}K` : betAmt}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* ROW 3: [J, Q, K] (3 Equal Wide Cells) */}
                <div className="grid grid-cols-3 gap-1.5">
                  {['J', 'Q', 'K'].map((card) => {
                    const betAmt = bets[card] || 0;
                    const isWinningCell = lastWinResult?.hit_rank === card;
                    return (
                      <button
                        key={card}
                        onClick={() => handleCellClick(card)}
                        disabled={spinning}
                        className={`relative h-11 sm:h-12 rounded-lg flex flex-col items-center justify-center font-mono transition-all cursor-pointer border ${
                          isWinningCell
                            ? 'bg-amber-400/40 border-amber-300 shadow-[0_0_15px_#f59e0b] scale-105'
                            : betAmt > 0
                            ? 'bg-[#0f381e] border-[#00ff66] shadow-[0_0_8px_rgba(0,255,102,0.6)]'
                            : 'bg-[#062012]/80 hover:bg-[#0b331c] border-[#00ff66]/60 active:scale-95'
                        }`}
                      >
                        <span className="text-base sm:text-lg font-black text-[#fef08a] drop-shadow-[0_0_5px_rgba(254,240,138,0.8)]">
                          {card}
                        </span>

                        {betAmt > 0 && (
                          <div className="absolute -bottom-1 text-[9px] font-mono font-black px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 shadow-md">
                            {betAmt >= 1000 ? `${betAmt / 1000}K` : betAmt}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Vertical Box: CUSH (0 / House) */}
              <button
                onClick={() => handleCellClick('CUSH')}
                disabled={spinning}
                className={`col-span-1 rounded-lg flex flex-col items-center justify-center font-mono transition-all cursor-pointer border ${
                  lastWinResult?.hit_rank === '0'
                    ? 'bg-rose-500/40 border-rose-400 shadow-[0_0_15px_#ef4444] scale-105'
                    : bets['CUSH'] > 0
                    ? 'bg-[#220d0d] border-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                    : 'bg-[#180909]/80 hover:bg-[#250d0d] border-[#00ff66]/60 active:scale-95'
                }`}
              >
                <div className="flex flex-col items-center leading-tight">
                  <span className="text-xs sm:text-sm font-black text-[#fef08a]">C</span>
                  <span className="text-xs sm:text-sm font-black text-[#fef08a]">U</span>
                  <span className="text-xs sm:text-sm font-black text-[#fef08a]">S</span>
                  <span className="text-xs sm:text-sm font-black text-[#fef08a]">H</span>
                </div>
                <span className="text-[9px] text-amber-400/80 font-bold mt-1">(0)</span>
                {bets['CUSH'] > 0 && (
                  <div className="mt-1 text-[8px] font-mono font-black px-1 rounded-full bg-amber-500 text-slate-950 shadow">
                    {bets['CUSH'] >= 1000 ? `${bets['CUSH'] / 1000}K` : bets['CUSH']}
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Right Arcade Bulbs Column */}
          <div className="flex flex-col justify-between py-1 px-0.5 bg-[#170e08] border border-amber-900/60 rounded-lg shadow-inner">
            {['#22c55e', '#ef4444', '#f8fafc', '#3b82f6', '#f97316', '#eab308'].map((color, i) => {
              const active = (bulbPhase + i + 1) % 2 === 0;
              return (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full transition-all duration-150"
                  style={{
                    backgroundColor: active ? color : '#3a2717',
                    boxShadow: active ? `0 0 6px ${color}` : 'none',
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Floating Win Notification Banner */}
        {lastWinResult && (
          <div
            className={`my-1.5 p-2 rounded-xl text-center border shadow-lg animate-fade-in ${
              lastWinResult.is_win
                ? lastWinResult.is_streak
                  ? 'bg-gradient-to-r from-amber-500 via-rose-600 to-amber-500 text-white border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.8)]'
                  : 'bg-emerald-950 text-emerald-200 border-emerald-500/60'
                : 'bg-rose-950/70 text-rose-300 border-rose-800/40 text-xs'
            }`}
          >
            {lastWinResult.is_win ? (
              <div>
                <div className="text-xs font-black tracking-wider uppercase">
                  {lastWinResult.is_streak ? '🔥 49x MEGA STREAK HIT! 🔥' : '🎉 CONGRATULATIONS! WINNER! 🎉'}
                </div>
                <div className="text-base sm:text-lg font-mono font-black text-amber-200">
                  +{Number(lastWinResult.payout).toLocaleString()} MMK ({lastWinResult.multiplier}x)
                </div>
              </div>
            ) : (
              <div>
                Ball landed on <span className="font-bold text-white">{lastWinResult.hit_rank === '0' ? 'CUSH (0)' : lastWinResult.hit_rank}</span>. Better luck next spin!
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="my-1 py-1 px-3 bg-rose-950/90 border border-rose-700/60 rounded-lg text-rose-200 text-xs text-center font-bold">
            {errorMessage}
          </div>
        )}

        {/* 5. BOTTOM CONTROLS & CHIPS */}
        <div className="mt-2.5 pt-2 border-t border-[#8e6827]/40 space-y-2.5">
          
          {/* 4 Casino Chips Selector */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 px-2">
            {CHIP_DENOMINATIONS.map((chip) => {
              const isSelected = selectedChip === chip.value;
              return (
                <button
                  key={chip.value}
                  onClick={() => {
                    audio.playChip();
                    setSelectedChip(chip.value);
                  }}
                  disabled={spinning}
                  className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? 'scale-110 -translate-y-1 shadow-[0_0_15px_#f59e0b] ring-2 ring-amber-300'
                      : 'opacity-85 hover:opacity-100 hover:scale-105'
                  }`}
                  style={{
                    backgroundColor: chip.color,
                    border: `3px dashed ${chip.border}`,
                    boxShadow: isSelected
                      ? '0 6px 15px rgba(0,0,0,0.8), 0 0 12px #f59e0b'
                      : '0 4px 10px rgba(0,0,0,0.7)',
                  }}
                >
                  {/* Inner chip ring */}
                  <div
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border"
                    style={{
                      borderColor: chip.border,
                      backgroundColor: 'rgba(0,0,0,0.3)',
                    }}
                  >
                    <span
                      className="font-mono font-black text-xs sm:text-sm drop-shadow"
                      style={{ color: chip.text }}
                    >
                      {chip.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 3 Arcade Pushbuttons: [BET/CLEAR] [SPIN] [DOUBLE/REBET] */}
          <div className="grid grid-cols-3 gap-2 px-1">
            
            {/* CLEAR BETS */}
            <button
              onClick={handleClearBets}
              disabled={spinning || totalStake <= 0}
              className="py-2.5 rounded-xl bg-gradient-to-b from-[#3a2213] to-[#1c1008] border-2 border-amber-800/80 hover:border-amber-600 text-amber-300 font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 disabled:opacity-40 cursor-pointer transition-all"
            >
              CLEAR
            </button>

            {/* GOLD ILLUMINATED SPIN BUTTON */}
            <button
              onClick={handleSpin}
              disabled={spinning}
              className={`py-2.5 rounded-xl font-black text-sm uppercase tracking-widest shadow-xl transition-all cursor-pointer border-2 ${
                spinning
                  ? 'bg-amber-600/50 text-slate-400 border-amber-800 animate-pulse cursor-not-allowed'
                  : 'bg-gradient-to-b from-[#ffe58f] via-[#d4af37] to-[#8c6d1d] text-slate-950 border-amber-200 hover:brightness-110 active:scale-95 shadow-[0_4px_15px_rgba(212,175,55,0.6)]'
              }`}
            >
              {spinning ? 'SPINNING...' : totalStake > 0 ? `SPIN (${totalStake.toLocaleString()})` : 'SPIN'}
            </button>

            {/* DOUBLE OR REBET */}
            <button
              onClick={handleDoubleOrRebet}
              disabled={spinning || (totalStake <= 0 && (!previousBets || Object.keys(previousBets).length === 0))}
              className="py-2.5 rounded-xl bg-gradient-to-b from-[#3a2213] to-[#1c1008] border-2 border-amber-800/80 hover:border-amber-600 text-amber-300 font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 disabled:opacity-40 cursor-pointer transition-all"
            >
              {totalStake > 0 ? 'DOUBLE' : 'REBET'}
            </button>
          </div>
        </div>

      </div>

      {/* =========================================================================
          GAME RULES MODAL
          ========================================================================= */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#24150b] to-[#120a05] border-2 border-amber-500/80 p-5 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-amber-900/60">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif font-black text-base text-amber-300 tracking-wider">
                  ROYAL CROWN RULES
                </h3>
              </div>
              <button
                onClick={() => setShowRuleModal(false)}
                className="p-1 rounded-lg bg-amber-950/60 text-amber-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs leading-relaxed text-slate-300">
              <div className="p-2.5 rounded-xl bg-black/40 border border-amber-900/40 space-y-1">
                <span className="font-bold text-amber-300 block">🎰 ၂၄ ကွက် Roulette ဘီး:</span>
                <p>
                  ဘီးပေါ်တွင် [0] အနီရောင် ၂ ကွက်နှင့် [2, 3, 4, 5, 6, 7, 8, 9, J, Q, K] အစိမ်းရောင် ၂ စုံ စုစုပေါင်း ၂၄ ကွက် တိတိ ပါဝင်ပါသည်။
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-amber-900/40 space-y-1">
                <span className="font-bold text-emerald-400 block">⭐ ရိုးရိုးပေါက်ဆု (Standard 5x):</span>
                <p>
                  မိမိထိုးထားသော ကတ်ဂဏန်း ပေါက်ပါက ထိုးကြေး၏ <strong>၅ ဆ (5x)</strong> ရရှိပါမည်။
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-amber-900/40 space-y-1">
                <span className="font-bold text-amber-400 block">🔥 ဆက်တိုက်ပေါက်ဆု (HOT Streak 49x):</span>
                <p>
                  ယခင်အကြိမ် ပေါက်ထားသော ကတ်ဂဏန်းအတိုင်း နောက်တစ်ကြိမ် ထပ်မံပေါက်ပါက အလျော်ငွေသည် <strong>၄၉ ဆ (49x)</strong> အထိ ခုန်တက်သွားပါမည်!
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-amber-900/40 space-y-1">
                <span className="font-bold text-rose-400 block">🛡️ CUSH (0) စည်းမျဉ်း:</span>
                <p>
                  ဘီးသည် 0 ပေါ် ကျရောက်ပါက CUSH အကွက်ထိုးထားသူများသည် <strong>၁၁ ဆ (11x)</strong> ရရှိပြီး အခြားကတ်ဂဏန်းများ အိမ်တော်သို့ ရှုံးနိမ့်ပါမည်။
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowRuleModal(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition-all"
            >
              နားလည်ပါပြီ (GOT IT)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
