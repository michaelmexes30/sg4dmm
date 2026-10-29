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
from app.core.security import get_current_user
from app.core.timezone_utils import now_mmt

router = APIRouter(prefix="/minigames", tags=["Mini-Games (Phase 1)"])

MIN_STAKE = 50.0
MAX_STAKE = 50000.0

WHEEL_SEGMENTS = [
    {"index": 0, "multiplier": 0.0, "label": "ကံမကောင်းပါ (0x)", "color": "#ef4444", "weight": 25.0},
    {"index": 1, "multiplier": 0.5, "label": "0.5x", "color": "#f97316", "weight": 25.0},
    {"index": 2, "multiplier": 1.2, "label": "1.2x", "color": "#3b82f6", "weight": 20.0},
    {"index": 3, "multiplier": 1.5, "label": "1.5x", "color": "#10b981", "weight": 12.0},
    {"index": 4, "multiplier": 2.0, "label": "2.0x", "color": "#8b5cf6", "weight": 10.0},
    {"index": 5, "multiplier": 3.0, "label": "3.0x", "color": "#ec4899", "weight": 5.0},
    {"index": 6, "multiplier": 5.0, "label": "5.0x", "color": "#06b6d4", "weight": 2.5},
    {"index": 7, "multiplier": 10.0, "label": "10x JACKPOT", "color": "#eab308", "weight": 0.5},
]

class WheelSpinRequest(BaseModel):
    stake: float = Field(..., ge=MIN_STAKE, le=MAX_STAKE, example=100.0)

class CoinFlipRequest(BaseModel):
    choice: str = Field(..., pattern="^(HEAD|TAIL)$", example="HEAD")
    stake: float = Field(..., ge=MIN_STAKE, le=MAX_STAKE, example=100.0)

class DiceRollRequest(BaseModel):
    choice: str = Field(..., pattern="^(SMALL|BIG|TRIPLE)$", example="BIG")
    stake: float = Field(..., ge=MIN_STAKE, le=MAX_STAKE, example=100.0)


@router.get("/config")
def get_minigames_config():
    """Returns active mini-games, stakes limits, and wheel segments configuration."""
    return {
        "status": "active",
        "min_stake": MIN_STAKE,
        "max_stake": MAX_STAKE,
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


@router.post("/wheel/spin")
def spin_lucky_wheel(
    req: WheelSpinRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Executes a Lucky Wheel spin with weighted RNG."""
    stake = float(req.stake)
    if float(current_user.balance or 0.0) < stake:
        raise HTTPException(status_code=400, detail="လက်ကျန်ငွေ မလုံလောက်ပါခင်ဗျာ။ ငွေဖြည့်သွင်းပေးပါရန် (Insufficient balance).")

    # Weighted random selection
    weights = [s["weight"] for s in WHEEL_SEGMENTS]
    chosen = secrets.choice(
        [s for s, w in zip(WHEEL_SEGMENTS, weights) for _ in range(int(w * 10))]
    )
    multiplier = float(chosen["multiplier"])
    payout = stake * multiplier
    is_win = multiplier > 0.0

    # Calculate target landing angle:
    # 8 segments = 45 deg each. Segment 0 is at top, index i is at angle = i * 45
    segment_angle = chosen["index"] * 45
    # Add random jitter within segment (-15 to +15 deg)
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

    # If win, create payout ledger and transaction
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


@router.post("/coin/flip")
def flip_coin(
    req: CoinFlipRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Executes a Head or Tail coin flip (50/50 fair RNG with 1.96x multiplier)."""
    stake = float(req.stake)
    player_choice = req.choice.upper()
    if float(current_user.balance or 0.0) < stake:
        raise HTTPException(status_code=400, detail="လက်ကျန်ငွေ မလုံလောက်ပါခင်ဗျာ။ ငွေဖြည့်သွင်းပေးပါရန် (Insufficient balance).")

    # True 50/50 coin flip
    outcome = "HEAD" if secrets.randbelow(2) == 0 else "TAIL"
    is_win = (player_choice == outcome)
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


@router.post("/dice/roll")
def roll_dice(
    req: DiceRollRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Executes a 3-dice roll (Small: 4-10, Big: 11-17, Triple: all 3 matching)."""
    stake = float(req.stake)
    player_choice = req.choice.upper()
    if float(current_user.balance or 0.0) < stake:
        raise HTTPException(status_code=400, detail="လက်ကျန်ငွေ မလုံလောက်ပါခင်ဗျာ။ ငွေဖြည့်သွင်းပေးပါရန် (Insufficient balance).")

    # Roll 3 independent dice
    d1 = secrets.choice(range(1, 7))
    d2 = secrets.choice(range(1, 7))
    d3 = secrets.choice(range(1, 7))
    dice = [d1, d2, d3]
    total_sum = d1 + d2 + d3
    is_triple = (d1 == d2 == d3)

    is_win = False
    multiplier = 0.0

    if player_choice == "TRIPLE":
        if is_triple:
            is_win = True
            multiplier = 30.0
    elif player_choice == "SMALL":
        if 4 <= total_sum <= 10 and not is_triple:
            is_win = True
            multiplier = 2.0
    elif player_choice == "BIG":
        if 11 <= total_sum <= 17 and not is_triple:
            is_win = True
            multiplier = 2.0

    payout = stake * multiplier if is_win else 0.0

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
