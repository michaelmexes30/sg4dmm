import json
from collections import defaultdict
from typing import List, Dict, Tuple, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.bet import BetSlip, BetItem, BetSlipStatus
from app.models.lottery import LotteryDraw
from app.models.settings import SystemSetting

def get_current_risk_cap(db: Session) -> float:
    """
    Retrieves the active Max Risk per 4D Number from SystemSetting.
    Defaults to 11,000 MMK if not configured.
    """
    setting = db.query(SystemSetting).first()
    if setting and setting.max_amount_per_number is not None:
        return float(setting.max_amount_per_number)
    return 11000.0

def validate_draw_numbers_risk_cap(
    draw_id: int,
    draw_date: str,
    combinations_with_stakes: List[Tuple[str, float]],
    db: Session,
    max_risk_cap: float = 11000.0
) -> None:
    """
    Enforces 'Max Risk per 4D Number (MMK)' across all bets on a specific lottery draw.
    
    Rules:
    1. Single combination stake cannot exceed max_risk_cap.
    2. Sum of stakes on the same 4D number within the incoming bet slip cannot exceed max_risk_cap.
    3. (Existing total stake on this 4D number in this draw) + (New incoming stake) cannot exceed max_risk_cap.
    
    If exceeded, raises HTTPException(400) with a precise Myanmar message showing
    the current sold amount and remaining allowable stake.
    """
    if max_risk_cap <= 0:
        return

    # 1. Aggregate incoming stakes per 4-digit number
    incoming_by_number: Dict[str, float] = defaultdict(float)
    for num, stake in combinations_with_stakes:
        clean_num = str(num).strip()
        incoming_by_number[clean_num] += float(stake)

    # 2. Query existing active bets for this draw
    # We retrieve all BetItems for this draw whose slips are active (PENDING, WON, LOST)
    existing_items = db.query(BetItem.number, BetItem.big_amount, BetItem.combinations_json).join(
        BetSlip, BetItem.slip_id == BetSlip.id
    ).filter(
        BetSlip.draw_id == draw_id,
        BetSlip.status.in_([BetSlipStatus.PENDING, BetSlipStatus.WON, BetSlipStatus.LOST])
    ).all()

    # Tally existing stakes for the numbers being bet on
    existing_stakes: Dict[str, float] = defaultdict(float)
    target_numbers = set(incoming_by_number.keys())

    for item_num, big_amt, combs_json in existing_items:
        amt = float(big_amt or 0.0)
        if amt <= 0:
            continue
        try:
            combs = json.loads(combs_json) if combs_json else [item_num]
        except Exception:
            combs = [item_num]

        for c in combs:
            c_str = str(c).strip()
            if c_str in target_numbers:
                existing_stakes[c_str] += amt

    # 3. Check cumulative risk cap without exposing internal risk cap or total sold
    for clean_num, new_stake in incoming_by_number.items():
        current_sold = existing_stakes.get(clean_num, 0.0)
        available = max(0.0, max_risk_cap - current_sold)

        if available <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"ဂဏန်း '{clean_num}' သည် {draw_date} ပွဲစဉ်အတွက် ထိုးကြေးကန့်သတ်ချက် ပြည့်သွားပါသဖြင့် ထပ်မံထိုး၍ မရနိုင်တော့ပါ ခင်ဗျာ။"
            )

        if new_stake > available:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"ဂဏန်း '{clean_num}' အတွက် {new_stake:,.0f} ကျပ် ထိုး၍ မရနိုင်ပါ။ "
                    f"ထပ်မံထိုးနိုင်သော လက်ကျန် {available:,.0f} ကျပ် သာ ရှိတော့ပါသဖြင့် ပမာဏကို ပြင်ဆင်၍ ပြန်လည်ထိုးပေးပါရန် ခင်ဗျာ။"
                )
            )
