import uuid
import secrets
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, Notification
from app.models.transaction import Transaction, TransactionType, TransactionStatus
from app.models.ledger import FinancialLedger, LedgerEntryType
from app.models.mini_game import MiniGameBet
from app.models.settings import SystemSetting
from app.core.security import get_current_user
from app.core.timezone_utils import now_mmt

router = APIRouter(prefix="/minigames", tags=["Mini-Games (Phase 1)"])

DEFAULT_MIN_STAKE = 50.0
DEFAULT_MAX_STAKE = 50000.0
DEFAULT_RTP_RATE = 95.0

# Base Wheel segments: total multiplier contribution of non-zero segments is 107.0 with weight sum 75.0
WHEEL_SEGMENTS = [
    {"index": 0, "multiplier": 0.0, "label": "ကံမကောင်းပါ (0x)", "color": "#ef4444", "weight": 37.6},
    {"index": 1, "multiplier": 0.5, "label": "0.5x", "color": "#f97316", "weight": 25.0},
    {"index": 2, "multiplier": 1.2, "label": "1.2x", "color": "#3b82f6", "weight": 20.0},
    {"index": 3, "multiplier": 1.5, "label": "1.5x", "color": "#10b981", "weight": 12.0},
    {"index": 4, "multiplier": 2.0, "label": "2.0x", "color": "#8b5cf6", "weight": 10.0},
    {"index": 5, "multiplier": 3.0, "label": "3.0x", "color": "#ec4899", "weight": 5.0},
    {"index": 6, "multiplier": 5.0, "label": "5.0x", "color": "#06b6d4", "weight": 2.5},
    {"index": 7, "multiplier": 10.0, "label": "10x JACKPOT", "color": "#eab308", "weight": 0.5},
]

# 24 Slots for Royal Crown (Card Roulette) Arcade Machine
# Strictly 2 Full Sets Clockwise: [0 (Red), 2, 3, 4, 5, 6, 7, 8, 9, J, Q, K (All Green)] x 2
CARD_WHEEL_SECTORS = [
    # Set 1 (pockets 0 to 11)
    {"index": 0, "rank": "0", "label": "0", "color": "red", "bg": "#dc2626", "textColor": "#ffffff", "is_cush": True},
    {"index": 1, "rank": "2", "label": "2", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 2, "rank": "3", "label": "3", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 3, "rank": "4", "label": "4", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 4, "rank": "5", "label": "5", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 5, "rank": "6", "label": "6", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 6, "rank": "7", "label": "7", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 7, "rank": "8", "label": "8", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 8, "rank": "9", "label": "9", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 9, "rank": "J", "label": "J", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 10, "rank": "Q", "label": "Q", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 11, "rank": "K", "label": "K", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    # Set 2 (pockets 12 to 23)
    {"index": 12, "rank": "0", "label": "0", "color": "red", "bg": "#dc2626", "textColor": "#ffffff", "is_cush": True},
    {"index": 13, "rank": "2", "label": "2", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 14, "rank": "3", "label": "3", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 15, "rank": "4", "label": "4", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 16, "rank": "5", "label": "5", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 17, "rank": "6", "label": "6", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 18, "rank": "7", "label": "7", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 19, "rank": "8", "label": "8", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 20, "rank": "9", "label": "9", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 21, "rank": "J", "label": "J", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 22, "rank": "Q", "label": "Q", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
    {"index": 23, "rank": "K", "label": "K", "color": "green", "bg": "#15803d", "textColor": "#ffffff", "is_cush": False},
]
ROYAL_CROWN_SECTORS = CARD_WHEEL_SECTORS


def get_minigame_controls(db: Session):
    """Retrieves live RTP rate, master toggle, and stake limits from SystemSetting."""
    try:
        setting = db.query(SystemSetting).first()
        is_enabled = bool(getattr(setting, "is_mini_games_enabled", True) if setting else True)
        rtp_rate = float(getattr(setting, "minigames_rtp_rate", DEFAULT_RTP_RATE) or DEFAULT_RTP_RATE) if setting else DEFAULT_RTP_RATE
        min_stake = float(getattr(setting, "minigames_min_bet", DEFAULT_MIN_STAKE) or DEFAULT_MIN_STAKE) if setting else DEFAULT_MIN_STAKE
        max_stake = float(getattr(setting, "minigames_max_bet", DEFAULT_MAX_STAKE) or DEFAULT_MAX_STAKE) if setting else DEFAULT_MAX_STAKE
    except Exception:
        db.rollback()
        is_enabled = True
        rtp_rate = DEFAULT_RTP_RATE
        min_stake = DEFAULT_MIN_STAKE
        max_stake = DEFAULT_MAX_STAKE

    # Clamp RTP safely between 70.0% and 98.0%
    rtp_rate = max(70.0, min(98.0, rtp_rate))
    return is_enabled, rtp_rate, min_stake, max_stake

def generate_dice_for_outcome(player_choice: str, is_win: bool):
    """Generates authentic dice outcomes [d1, d2, d3] matching the win/loss state."""
    for _ in range(200):
        d1 = secrets.choice(range(1, 7))
        d2 = secrets.choice(range(1, 7))
        d3 = secrets.choice(range(1, 7))
        s = d1 + d2 + d3
        is_trip = (d1 == d2 == d3)

        if player_choice == "SMALL":
            round_wins = (4 <= s <= 10 and not is_trip)
        elif player_choice == "BIG":
            round_wins = (11 <= s <= 17 and not is_trip)
        else:  # TRIPLE
            round_wins = is_trip

        if round_wins == is_win:
            return [d1, d2, d3], s, is_trip

    # Fallback safe combinations
    if is_win:
        if player_choice == "SMALL": return [1, 2, 3], 6, False
        if player_choice == "BIG": return [4, 5, 6], 15, False
        return [3, 3, 3], 9, True
    else:
        if player_choice == "SMALL": return [5, 5, 5], 15, True
        if player_choice == "BIG": return [1, 1, 1], 3, True
        return [2, 3, 4], 9, False


class WheelSpinRequest(BaseModel):
    stake: float = Field(..., ge=1.0, example=100.0)

class CoinFlipRequest(BaseModel):
    choice: str = Field(..., pattern="^(HEAD|TAIL)$", example="HEAD")
    stake: float = Field(..., ge=1.0, example=100.0)

class DiceRollRequest(BaseModel):
    choice: str = Field(..., pattern="^(SMALL|BIG|TRIPLE)$", example="BIG")
    stake: float = Field(..., ge=1.0, example=100.0)

class RoyalCrownBetItem(BaseModel):
    choice: str = Field(..., example="9") # "2".."9", "J", "Q", "K", "CUSH" / "0"
    stake: float = Field(..., ge=1.0, example=100.0)

class CardWheelSpinRequest(BaseModel):
    # Multiple simultaneous bets on board
    bets: Optional[List[RoyalCrownBetItem]] = None
    # Single-bet fallback
    bet_type: Optional[str] = "CARD_RANK"
    choice: Optional[str] = None
    stake: Optional[float] = None


@router.get("/config")
def get_minigames_config(db: Session = Depends(get_db)):
    """Returns active mini-games, dynamic stake limits, and wheel segments configuration."""
    is_enabled, rtp_rate, min_stake, max_stake = get_minigame_controls(db)

    return {
        "status": "active" if is_enabled else "disabled",
        "is_enabled": is_enabled,
        "min_stake": min_stake,
        "max_stake": max_stake,
        "games": [
            {
                "id": "wheel",
                "title": "Lucky Wheel",
                "title_mm": "ကံစမ်းမဲ ဘီးတိုက်ဂိမ်း",
                "icon": "🎡",
                "badge": "10x Max",
                "segments": WHEEL_SEGMENTS
            },
            {
                "id": "coin",
                "title": "Head or Tail",
                "title_mm": "ခေါင်း သို့မဟုတ် ပန်း",
                "icon": "🪙",
                "badge": "1.96x",
                "multiplier": 1.96
            },
            {
                "id": "dice",
                "title": "Dice Roll (Sic Bo)",
                "title_mm": "ရွှေရင်တုန် အန်စာတုံး (အကြီး/အသေး)",
                "icon": "🎲",
                "badge": "30x Triple",
                "multipliers": {
                    "SMALL": 2.0,
                    "BIG": 2.0,
                    "TRIPLE": 30.0
                }
            },
            {
                "id": "card_wheel",
                "title": "Royal Crown (Card Roulette)",
                "title_mm": "Royal Crown ဖဲချပ် ရူးလက်ဂိမ်း",
                "icon": "👑",
                "badge": "5x / 49x HOT",
                "sectors": ROYAL_CROWN_SECTORS,
                "payout_card": 5.0,
                "payout_streak": 49.0,
                "payout_cush": 11.0
            }
        ]
    }


@router.get("/history")
def get_minigames_history(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns player's recent mini-game bets and payouts."""
    try:
        bets = db.query(MiniGameBet).filter(
            MiniGameBet.user_id == current_user.id
        ).order_by(MiniGameBet.id.desc()).limit(limit).all()

        return [
            {
                "id": b.id,
                "game_type": b.game_type,
                "stake_amount": b.stake_amount,
                "payout_multiplier": b.payout_multiplier,
                "payout_amount": b.payout_amount,
                "is_win": b.is_win,
                "player_choice": b.player_choice,
                "result_data": b.result_data,
                "created_at": b.created_at.strftime("%Y-%m-%d %H:%M:%S") if b.created_at else None
            }
            for b in bets
        ]
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Mini-games history error: {str(e)}")


@router.post("/wheel/spin")
def spin_lucky_wheel(
    req: WheelSpinRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Executes a Lucky Wheel spin with dynamic RTP calibrated weights."""
    try:
        is_enabled, rtp_rate, min_stake, max_stake = get_minigame_controls(db)
        if not is_enabled:
            raise HTTPException(status_code=403, detail="မီနီဂိမ်းများကို စနစ်ထိန်းသိမ်းမှုအရ ခေတ္တပိတ်ထားပါသည် (Mini-games are temporarily disabled).")

        stake = float(req.stake)
        if stake < min_stake or stake > max_stake:
            raise HTTPException(
                status_code=400,
                detail=f"ထိုးကြေးမှာ အနည်းဆုံး {min_stake:,.0f} MMK မှ အများဆုံး {max_stake:,.0f} MMK အတွင်း ဖြစ်ရပါမည်။"
            )

        if float(current_user.balance or 0.0) < stake:
            raise HTTPException(status_code=400, detail="လက်ကျန်ငွေ မလုံလောက်ပါခင်ဗျာ။ ငွေဖြည့်သွင်းပေးပါရန် (Insufficient balance).")

        # Dynamic RTP weight adjustment for 0x segment:
        # Non-zero segments sum to 107.0 expected value with sum(weights) = 75.0.
        # Formula: w0 = (10700.0 / rtp_rate) - 75.0
        w0 = max(5.0, (10700.0 / rtp_rate) - 75.0)
        dynamic_segments = [dict(s) for s in WHEEL_SEGMENTS]
        dynamic_segments[0]["weight"] = round(w0, 2)

        # Weighted random selection
        weights = [s["weight"] for s in dynamic_segments]
        chosen = secrets.choice(
            [s for s, w in zip(dynamic_segments, weights) for _ in range(max(1, int(w * 10)))]
        )
        multiplier = float(chosen["multiplier"])
        payout = stake * multiplier
        is_win = multiplier > 0.0

        # Calculate target landing angle:
        # 8 segments = 45 deg each. Segment 0 is at top, index i is at angle = i * 45
        segment_angle = chosen["index"] * 45
        jitter = secrets.randbelow(30) - 15
        final_angle = (360 - segment_angle + jitter) % 360

        # Wallet & Financial updates
        curr_time = now_mmt()
        today_str = curr_time.strftime("%Y-%m-%d")

        current_user.balance = float(current_user.balance or 0.0) - stake + payout
        game_id_str = f"WHEEL-{curr_time.strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(3).upper()}"

        # Ledger entry for stake
        db.add(FinancialLedger(
            entry_type=LedgerEntryType.BET_REVENUE,
            amount=stake,
            running_balance=current_user.balance,
            reference_id=game_id_str,
            reference_type="MINI_GAME_STAKE",
            description=f"Lucky Wheel ထိုးကြေး ({stake:,.0f} MMK)",
            logged_at_mmt=curr_time,
            date_str=today_str
        ))

        # If win, create payout ledger and optional transaction
        if is_win and payout > 0:
            db.add(FinancialLedger(
                entry_type=LedgerEntryType.PAYOUT_EXPENSE,
                amount=payout,
                running_balance=current_user.balance,
                reference_id=game_id_str,
                reference_type="MINI_GAME_PAYOUT",
                description=f"Lucky Wheel အနိုင်ရငွေ ({multiplier}x - {payout:,.0f} MMK)",
                logged_at_mmt=curr_time,
                date_str=today_str
            ))
            try:
                db.add(Transaction(
                    user_id=current_user.id,
                    tx_type=TransactionType.WIN_PAYOUT,
                    gateway="Lucky Wheel",
                    transaction_id=game_id_str,
                    receiver_id=f"Player #{current_user.id} ({current_user.phone})",
                    amount=payout,
                    slip_image_url=None,
                    client_timezone="MMT",
                    tx_timestamp_mmt=curr_time,
                    submission_timestamp_mmt=curr_time,
                    delta_minutes=0.0,
                    is_time_valid=True,
                    is_receiver_valid=True,
                    is_tx_unique=True,
                    status=TransactionStatus.COMPLETED,
                    verification_notes=f"Lucky Wheel Win {multiplier}x ({payout:,.0f} MMK)",
                    created_at=curr_time
                ))
            except Exception as tx_err:
                print(f"Notice: skipped transaction record for win payout: {tx_err}")

        # Record MiniGameBet
        bet_rec = MiniGameBet(
            user_id=current_user.id,
            game_type="WHEEL",
            stake_amount=stake,
            payout_multiplier=multiplier,
            payout_amount=payout,
            is_win=is_win,
            player_choice="SPIN",
            result_data={
                "segment_index": chosen["index"],
                "label": chosen["label"],
                "multiplier": multiplier,
                "target_angle": final_angle,
                "game_id": game_id_str
            },
            created_at=curr_time,
            date_str=today_str
        )
        db.add(bet_rec)
        db.commit()

        return {
            "status": "success",
            "game_id": game_id_str,
            "segment_index": chosen["index"],
            "label": chosen["label"],
            "multiplier": multiplier,
            "target_angle": final_angle,
            "stake": stake,
            "payout": payout,
            "is_win": is_win,
            "new_balance": current_user.balance
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Lucky Wheel error: {str(e)}"
        )


@router.post("/coin/flip")
def flip_coin(
    req: CoinFlipRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Executes a Head or Tail coin flip with dynamic RTP calibrated odds (1.96x multiplier)."""
    try:
        is_enabled, rtp_rate, min_stake, max_stake = get_minigame_controls(db)
        if not is_enabled:
            raise HTTPException(status_code=403, detail="မီနီဂိမ်းများကို စနစ်ထိန်းသိမ်းမှုအရ ခေတ္တပိတ်ထားပါသည် (Mini-games are temporarily disabled).")

        stake = float(req.stake)
        player_choice = req.choice.upper()

        if stake < min_stake or stake > max_stake:
            raise HTTPException(
                status_code=400,
                detail=f"ထိုးကြေးမှာ အနည်းဆုံး {min_stake:,.0f} MMK မှ အများဆုံး {max_stake:,.0f} MMK အတွင်း ဖြစ်ရပါမည်။"
            )

        if float(current_user.balance or 0.0) < stake:
            raise HTTPException(status_code=400, detail="လက်ကျန်ငွေ မလုံလောက်ပါခင်ဗျာ။ ငွေဖြည့်သွင်းပေးပါရန် (Insufficient balance).")

        # Win probability strictly aligned with RTP: P(win) = (rtp_rate / 100) / 1.96
        win_probability = (rtp_rate / 100.0) / 1.96
        roll = secrets.randbelow(100000) / 100000.0
        is_win = (roll < win_probability)

        outcome = player_choice if is_win else ("TAIL" if player_choice == "HEAD" else "HEAD")
        multiplier = 1.96 if is_win else 0.0
        payout = stake * multiplier if is_win else 0.0

        curr_time = now_mmt()
        today_str = curr_time.strftime("%Y-%m-%d")

        current_user.balance = float(current_user.balance or 0.0) - stake + payout
        game_id_str = f"COIN-{curr_time.strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(3).upper()}"

        db.add(FinancialLedger(
            entry_type=LedgerEntryType.BET_REVENUE,
            amount=stake,
            running_balance=current_user.balance,
            reference_id=game_id_str,
            reference_type="MINI_GAME_STAKE",
            description=f"ခေါင်း/ပန်း ထိုးကြေး ({player_choice} - {stake:,.0f} MMK)",
            logged_at_mmt=curr_time,
            date_str=today_str
        ))

        if is_win and payout > 0:
            db.add(FinancialLedger(
                entry_type=LedgerEntryType.PAYOUT_EXPENSE,
                amount=payout,
                running_balance=current_user.balance,
                reference_id=game_id_str,
                reference_type="MINI_GAME_PAYOUT",
                description=f"ခေါင်း/ပန်း အနိုင်ရငွေ ({player_choice} - {payout:,.0f} MMK)",
                logged_at_mmt=curr_time,
                date_str=today_str
            ))
            try:
                db.add(Transaction(
                    user_id=current_user.id,
                    tx_type=TransactionType.WIN_PAYOUT,
                    gateway="Head or Tail",
                    transaction_id=game_id_str,
                    receiver_id=f"Player #{current_user.id} ({current_user.phone})",
                    amount=payout,
                    slip_image_url=None,
                    client_timezone="MMT",
                    tx_timestamp_mmt=curr_time,
                    submission_timestamp_mmt=curr_time,
                    delta_minutes=0.0,
                    is_time_valid=True,
                    is_receiver_valid=True,
                    is_tx_unique=True,
                    status=TransactionStatus.COMPLETED,
                    verification_notes=f"Coin Flip Win {outcome} ({payout:,.0f} MMK)",
                    created_at=curr_time
                ))
            except Exception as tx_err:
                print(f"Notice: skipped transaction record for win payout: {tx_err}")

        bet_rec = MiniGameBet(
            user_id=current_user.id,
            game_type="COIN_FLIP",
            stake_amount=stake,
            payout_multiplier=multiplier,
            payout_amount=payout,
            is_win=is_win,
            player_choice=player_choice,
            result_data={
                "outcome": outcome,
                "player_choice": player_choice,
                "is_win": is_win,
                "game_id": game_id_str
            },
            created_at=curr_time,
            date_str=today_str
        )
        db.add(bet_rec)
        db.commit()

        return {
            "status": "success",
            "game_id": game_id_str,
            "outcome": outcome,
            "player_choice": player_choice,
            "is_win": is_win,
            "multiplier": multiplier,
            "stake": stake,
            "payout": payout,
            "new_balance": current_user.balance
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Coin Flip error: {str(e)}"
        )


@router.post("/dice/roll")
def roll_dice(
    req: DiceRollRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Executes a 3-dice roll (Small: 2.0x, Big: 2.0x, Triple: 30x) with dynamic RTP odds."""
    try:
        is_enabled, rtp_rate, min_stake, max_stake = get_minigame_controls(db)
        if not is_enabled:
            raise HTTPException(status_code=403, detail="မီနီဂိမ်းများကို စနစ်ထိန်းသိမ်းမှုအရ ခေတ္တပိတ်ထားပါသည် (Mini-games are temporarily disabled).")

        stake = float(req.stake)
        player_choice = req.choice.upper()

        if stake < min_stake or stake > max_stake:
            raise HTTPException(
                status_code=400,
                detail=f"ထိုးကြေးမှာ အနည်းဆုံး {min_stake:,.0f} MMK မှ အများဆုံး {max_stake:,.0f} MMK အတွင်း ဖြစ်ရပါမည်။"
            )

        if float(current_user.balance or 0.0) < stake:
            raise HTTPException(status_code=400, detail="လက်ကျန်ငွေ မလုံလောက်ပါခင်ဗျာ။ ငွေဖြည့်သွင်းပေးပါရန် (Insufficient balance).")

        # Win multiplier and calibrated win probability
        if player_choice in ("SMALL", "BIG"):
            target_multiplier = 2.0
        else:  # TRIPLE
            target_multiplier = 30.0

        win_probability = (rtp_rate / 100.0) / target_multiplier
        roll = secrets.randbelow(100000) / 100000.0
        is_win = (roll < win_probability)

        multiplier = target_multiplier if is_win else 0.0
        payout = stake * multiplier if is_win else 0.0

        # Generate authentic dice outcome matching the calculated win/loss
        dice, total_sum, is_triple = generate_dice_for_outcome(player_choice, is_win)

        curr_time = now_mmt()
        today_str = curr_time.strftime("%Y-%m-%d")

        current_user.balance = float(current_user.balance or 0.0) - stake + payout
        game_id_str = f"DICE-{curr_time.strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(3).upper()}"

        db.add(FinancialLedger(
            entry_type=LedgerEntryType.BET_REVENUE,
            amount=stake,
            running_balance=current_user.balance,
            reference_id=game_id_str,
            reference_type="MINI_GAME_STAKE",
            description=f"အန်စာတုံး ထိုးကြေး ({player_choice} - {stake:,.0f} MMK)",
            logged_at_mmt=curr_time,
            date_str=today_str
        ))

        if is_win and payout > 0:
            db.add(FinancialLedger(
                entry_type=LedgerEntryType.PAYOUT_EXPENSE,
                amount=payout,
                running_balance=current_user.balance,
                reference_id=game_id_str,
                reference_type="MINI_GAME_PAYOUT",
                description=f"အန်စာတုံး အနိုင်ရငွေ ({player_choice} - {payout:,.0f} MMK)",
                logged_at_mmt=curr_time,
                date_str=today_str
            ))
            try:
                db.add(Transaction(
                    user_id=current_user.id,
                    tx_type=TransactionType.WIN_PAYOUT,
                    gateway="Dice Roll",
                    transaction_id=game_id_str,
                    receiver_id=f"Player #{current_user.id} ({current_user.phone})",
                    amount=payout,
                    slip_image_url=None,
                    client_timezone="MMT",
                    tx_timestamp_mmt=curr_time,
                    submission_timestamp_mmt=curr_time,
                    delta_minutes=0.0,
                    is_time_valid=True,
                    is_receiver_valid=True,
                    is_tx_unique=True,
                    status=TransactionStatus.COMPLETED,
                    verification_notes=f"Dice Roll Win {player_choice} ({payout:,.0f} MMK)",
                    created_at=curr_time
                ))
            except Exception as tx_err:
                print(f"Notice: skipped transaction record for win payout: {tx_err}")

        bet_rec = MiniGameBet(
            user_id=current_user.id,
            game_type="DICE",
            stake_amount=stake,
            payout_multiplier=multiplier,
            payout_amount=payout,
            is_win=is_win,
            player_choice=player_choice,
            result_data={
                "dice": dice,
                "sum": total_sum,
                "is_triple": is_triple,
                "player_choice": player_choice,
                "is_win": is_win,
                "game_id": game_id_str
            },
            created_at=curr_time,
            date_str=today_str
        )
        db.add(bet_rec)
        db.commit()

        return {
            "status": "success",
            "game_id": game_id_str,
            "dice": dice,
            "sum": total_sum,
            "is_triple": is_triple,
            "player_choice": player_choice,
            "is_win": is_win,
            "multiplier": multiplier,
            "stake": stake,
            "payout": payout,
            "new_balance": current_user.balance
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Dice Roll error: {str(e)}"
        )


@router.get("/card-wheel/history")
def get_card_wheel_history(
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Returns recent winning results (cards) for Royal Crown history display."""
    recent_bets = db.query(MiniGameBet).filter(
        MiniGameBet.game_type == "CARD_WHEEL"
    ).order_by(MiniGameBet.id.desc()).limit(limit * 3).all()

    results = []
    seen_ids = set()
    for b in recent_bets:
        if isinstance(b.result_data, dict):
            gid = b.result_data.get("game_id")
            if gid and gid in seen_ids:
                continue
            if gid:
                seen_ids.add(gid)
            sec = b.result_data.get("sector") or {}
            rank = sec.get("rank") or b.result_data.get("hit_rank")
            if rank:
                results.append(str(rank))
            if len(results) >= limit:
                break

    # Fallback seed if history is empty
    if len(results) < 5:
        defaults = ["9", "K", "0", "4", "9", "J", "7", "0"]
        results = (results + defaults)[:limit]

    return {"status": "success", "history": results}


@router.post("/card-wheel/spin")
def spin_card_wheel(
    req: CardWheelSpinRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Royal Crown (Card Roulette) Arcade Machine:
    - 24 Slots (Strictly 2 sets: 0 Red, 2..K Green).
    - Multi-bet support on betting grid (2-9, J, Q, K, CUSH).
    - Standard Card Hit: 5x Payout.
    - Consecutive Hit Multiplier (Same Card 2 in a row): 49x Payout!
    - CUSH (0) Hit: 11x Payout for CUSH bets, house wins otherwise.
    """
    try:
        is_enabled, rtp_rate, min_stake, max_stake = get_minigame_controls(db)
        if not is_enabled:
            raise HTTPException(status_code=403, detail="မီနီဂိမ်းများကို စနစ်ထိန်းသိမ်းမှုအရ ခေတ္တပိတ်ထားပါသည် (Mini-games are temporarily disabled).")

        # 1. Normalize and validate incoming bets
        incoming_bets = []
        if req.bets and len(req.bets) > 0:
            for b in req.bets:
                if b.stake and b.stake > 0:
                    c = b.choice.strip().upper()
                    if c == "0":
                        c = "CUSH"
                    incoming_bets.append({"choice": c, "stake": float(b.stake)})
        elif req.choice and req.stake and req.stake > 0:
            c = req.choice.strip().upper()
            if c == "0":
                c = "CUSH"
            incoming_bets.append({"choice": c, "stake": float(req.stake)})

        if not incoming_bets:
            raise HTTPException(status_code=400, detail="ကျေးဇူးပြု၍ လောင်းကြေး အနည်းဆုံး ၁ ခု ရွေးချယ်ပါ (Please place at least one bet).")

        total_stake = round(sum(b["stake"] for b in incoming_bets), 2)
        if total_stake < min_stake or total_stake > max_stake:
            raise HTTPException(
                status_code=400,
                detail=f"စုစုပေါင်း ထိုးကြေးမှာ အနည်းဆုံး {min_stake:,.0f} MMK မှ အများဆုံး {max_stake:,.0f} MMK အတွင်း ဖြစ်ရပါမည်။"
            )

        if float(current_user.balance or 0.0) < total_stake:
            raise HTTPException(status_code=400, detail="လက်ကျန်ငွေ မလုံလောက်ပါခင်ဗျာ။ ငွေဖြည့်သွင်းပေးပါရန် (Insufficient balance).")

        # 2. Retrieve last spin outcome for streak bonus check
        last_bet = db.query(MiniGameBet).filter(
            MiniGameBet.user_id == current_user.id,
            MiniGameBet.game_type == "CARD_WHEEL"
        ).order_by(MiniGameBet.id.desc()).first()

        last_rank = None
        if last_bet and isinstance(last_bet.result_data, dict):
            sec = last_bet.result_data.get("sector") or {}
            last_rank = sec.get("rank") or last_bet.result_data.get("hit_rank")

        # 3. Calibrate CUSH (0) weight against live RTP rate (default 95%)
        # 24 sectors = 2 CUSH + 22 Card slots
        cush_weight = max(0.4, (100.0 - rtp_rate) / 4.0)
        sector_weights = [cush_weight if s.get("is_cush") else 1.0 for s in ROYAL_CROWN_SECTORS]

        # Secure RNG pick
        chosen_sector = secrets.choice(
            [s for s, w in zip(ROYAL_CROWN_SECTORS, sector_weights) for _ in range(max(1, int(w * 10)))]
        )

        hit_rank = chosen_sector["rank"]
        is_cush = chosen_sector.get("is_cush", False)

        # 4. Determine Consecutive Streak (49x on same card 2 spins in a row)
        is_streak = False
        card_payout_mult = 5.0
        if not is_cush and last_rank and (last_rank == hit_rank) and last_rank not in ["0", "CUSH"]:
            is_streak = True
            card_payout_mult = 49.0
        else:
            is_streak = False
            card_payout_mult = 5.0

        # 5. Evaluate all placed bets
        total_payout = 0.0
        bet_results = []
        winning_choices = []

        for b in incoming_bets:
            b_choice = b["choice"]
            b_stake = b["stake"]
            b_won = False
            b_mult = 0.0
            b_payout = 0.0

            if is_cush:
                # Landed on 0 (CUSH)
                if b_choice in ["CUSH", "0"]:
                    b_won = True
                    b_mult = 11.0 # 11x for landing on 0
                    b_payout = round(b_stake * b_mult, 2)
                    winning_choices.append("CUSH")
            else:
                # Landed on Card (2-K)
                if b_choice == hit_rank:
                    b_won = True
                    b_mult = card_payout_mult # 5.0x or 49.0x
                    b_payout = round(b_stake * b_mult, 2)
                    winning_choices.append(hit_rank)

            total_payout += b_payout
            bet_results.append({
                "choice": b_choice,
                "stake": b_stake,
                "is_won": b_won,
                "multiplier": b_mult,
                "payout": b_payout
            })

        is_win = total_payout > 0
        total_payout = round(total_payout, 2)
        final_multiplier = round(total_payout / total_stake, 2) if (is_win and total_stake > 0) else 0.0

        # 6. Calculate wheel landing angle: 24 sectors -> 15 deg per sector
        angle_step = 360.0 / 24.0
        sector_angle = chosen_sector["index"] * angle_step
        jitter = float(secrets.randbelow(5) - 2)
        final_angle = round((360.0 - sector_angle + jitter) % 360.0, 2)

        curr_time = now_mmt()
        today_str = curr_time.strftime("%Y-%m-%d")

        # 7. Update User Balance
        current_user.balance = float(current_user.balance or 0.0) - total_stake + total_payout
        game_id_str = f"RC-{curr_time.strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(3).upper()}"

        # 8. Ledger Entry: Stake
        db.add(FinancialLedger(
            entry_type=LedgerEntryType.BET_REVENUE,
            amount=total_stake,
            running_balance=current_user.balance,
            reference_id=game_id_str,
            reference_type="MINI_GAME_STAKE",
            description=f"Royal Crown ထိုးကြေး ({len(incoming_bets)} bets - {total_stake:,.0f} MMK)",
            logged_at_mmt=curr_time,
            date_str=today_str
        ))

        # 9. Ledger Entry: Payout
        if is_win and total_payout > 0:
            db.add(FinancialLedger(
                entry_type=LedgerEntryType.PAYOUT_EXPENSE,
                amount=total_payout,
                running_balance=current_user.balance,
                reference_id=game_id_str,
                reference_type="MINI_GAME_PAYOUT",
                description=f"Royal Crown အနိုင်ရငွေ ({final_multiplier}x - {total_payout:,.0f} MMK)",
                logged_at_mmt=curr_time,
                date_str=today_str
            ))
            try:
                db.add(Transaction(
                    user_id=current_user.id,
                    tx_type=TransactionType.WIN_PAYOUT,
                    gateway="Royal Crown",
                    transaction_id=game_id_str,
                    receiver_id=f"Player #{current_user.id} ({current_user.phone})",
                    amount=total_payout,
                    slip_image_url=None,
                    client_timezone="MMT",
                    tx_timestamp_mmt=curr_time,
                    submission_timestamp_mmt=curr_time,
                    delta_minutes=0.0,
                    is_time_valid=True,
                    is_receiver_valid=True,
                    is_tx_unique=True,
                    status=TransactionStatus.COMPLETED,
                    verification_notes=f"Royal Crown Win {final_multiplier}x ({total_payout:,.0f} MMK)",
                    created_at=curr_time
                ))
            except Exception as tx_err:
                print(f"Notice: skipped transaction record for win payout: {tx_err}")

        # 10. Save MiniGameBet Record
        bet_rec = MiniGameBet(
            user_id=current_user.id,
            game_type="CARD_WHEEL",
            stake_amount=total_stake,
            payout_multiplier=final_multiplier,
            payout_amount=total_payout,
            is_win=is_win,
            player_choice=",".join([b["choice"] for b in incoming_bets]),
            result_data={
                "game_title": "Royal Crown",
                "sector": chosen_sector,
                "hit_rank": hit_rank,
                "is_cush": is_cush,
                "is_streak": is_streak,
                "card_payout_mult": card_payout_mult,
                "final_multiplier": final_multiplier,
                "total_stake": total_stake,
                "total_payout": total_payout,
                "target_angle": final_angle,
                "previous_rank": last_rank,
                "bets": bet_results,
                "game_id": game_id_str
            },
            created_at=curr_time,
            date_str=today_str
        )
        db.add(bet_rec)
        db.commit()

        return {
            "status": "success",
            "game_id": game_id_str,
            "sector": chosen_sector,
            "hit_rank": hit_rank,
            "is_cush": is_cush,
            "is_streak": is_streak,
            "multiplier": card_payout_mult if (not is_cush and is_win) else (11.0 if (is_cush and is_win) else 0.0),
            "final_multiplier": final_multiplier,
            "is_win": is_win,
            "total_stake": total_stake,
            "payout": total_payout,
            "target_angle": final_angle,
            "previous_rank": last_rank,
            "winning_choices": winning_choices,
            "bets": bet_results,
            "new_balance": current_user.balance
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Royal Crown error: {str(e)}"
        )
