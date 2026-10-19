import json
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole, AgentCommissionLog, Notification
from app.models.bet import BetSlip, BetItem, BetSlipStatus
from app.models.lottery import LotteryDraw, DrawStatus
from app.models.ledger import FinancialLedger, LedgerEntryType, DailyLedgerSummary
from app.schemas.bet import (
    CalculateStakeRequest, 
    CalculateStakeResponse, 
    PlaceBetRequest, 
    BetSlipResponse
)
from app.core.security import get_current_user
from app.core.bet_calculator import validate_4d_number, validate_bet_amount, calculate_stake
from app.models.settings import SystemSetting
from app.core.risk_calculator import validate_draw_numbers_risk_cap, get_current_risk_cap
from app.core.timezone_utils import now_mmt, is_past_betting_cutoff, format_mmt, get_upcoming_week_draws

router = APIRouter(prefix="/bets", tags=["4D Betting & Commission Engine"])

@router.post("/calculate", response_model=CalculateStakeResponse)
def calculate_bets_preview(req: CalculateStakeRequest):
    """
    Live calculation of 4D stakes and generated permutations (Box/Roll/Ordinary)
    with 50 MMK min and 10,000 MMK max validation.
    """
    calculated_items = []
    total_stake = 0
    total_combos = 0

    for item in req.items:
        is_valid = validate_4d_number(item.number, item.bet_type)
        if not is_valid:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid 4D number '{item.number}' for bet type '{item.bet_type}'."
            )
        
        # Validate min 50 MMK, max 10,000 MMK limits for both big & small if specified
        if item.big_amount > 0:
            ok_big, msg_big = validate_bet_amount(item.big_amount)
            if not ok_big:
                raise HTTPException(status_code=400, detail=f"Big Bet: {msg_big}")
        if item.small_amount > 0:
            ok_sml, msg_sml = validate_bet_amount(item.small_amount)
            if not ok_sml:
                raise HTTPException(status_code=400, detail=f"Small Bet: {msg_sml}")

        calc = calculate_stake(
            number=item.number,
            bet_type=item.bet_type,
            big_amount=item.big_amount,
            small_amount=item.small_amount
        )
        if item.custom_combinations and len(item.custom_combinations) > 0:
            valid_set = set(calc["combinations"])
            filtered = [c for c in item.custom_combinations if c in valid_set]
            if len(filtered) > 0:
                calc["combinations"] = filtered
                calc["combination_count"] = len(filtered)
                stake_per_unit = item.big_amount if item.big_amount > 0 else item.small_amount
                calc["total_stake"] = len(filtered) * stake_per_unit

        calculated_items.append(calc)
        total_stake += calc["total_stake"]
        total_combos += calc["combination_count"]

    return {
        "items": calculated_items,
        "total_combinations": total_combos,
        "total_stake": total_stake
    }

@router.get("/available-draws")
def get_available_draws(db: Session = Depends(get_db)):
    """
    Returns the draw days for the CURRENT calendar week (Wed, Sat, Sun).
    Rules:
    - User can only place bets for the current week.
    - If Wednesday has ended or past cutoff time, Wednesday disappears and only Saturday & Sunday are returned!
    - User can choose a single day (e.g. Sunday) or all remaining days of the week.
    """
    current_time = now_mmt()
    setting = db.query(SystemSetting).first()
    cutoff_str = setting.bet_end_time if setting and setting.bet_end_time else None
    result_str = setting.result_confirm_time if setting and setting.result_confirm_time else None

    upcoming_schedule = get_upcoming_week_draws(current_time, cutoff_time_str=cutoff_str, result_time_str=result_str)
    
    # Ensure LotteryDraw rows exist in database for each upcoming draw date
    results = []
    for item in upcoming_schedule:
        draw = db.query(LotteryDraw).filter(LotteryDraw.draw_date == item["draw_date"]).first()
        if not draw:
            # Generate draw number based on date
            draw_num_seq = f"54{item['draw_date'].replace('-', '')[-4:]}/26"
            draw = LotteryDraw(
                draw_number=draw_num_seq,
                draw_date=item["draw_date"],
                draw_time_mmt=item["draw_time_mmt"],
                status=DrawStatus.OPEN,
                total_pool_stake=0.0,
                total_payout=0.0
            )
            db.add(draw)
            db.commit()
            db.refresh(draw)
        
        results.append({
            "id": draw.id,
            "draw_number": draw.draw_number,
            "draw_date": draw.draw_date,
            "day_name": item["day_name"],
            "day_short": item["day_short"],
            "draw_time_mmt": item["draw_time_mmt"],
            "cutoff_time": item.get("cutoff_time", "04:30 PM MMT"),
            "is_today": item["is_today"],
            "status": draw.status
        })
        
    return results

@router.get("/active-draw")
def get_active_draw(db: Session = Depends(get_db)):
    """Returns the earliest available draw of the current week."""
    current_time = now_mmt()
    setting = db.query(SystemSetting).first()
    cutoff_str = setting.bet_end_time if setting and setting.bet_end_time else None
    result_str = setting.result_confirm_time if setting and setting.result_confirm_time else None
    min_bet_val = float(setting.min_amount_per_bet) if setting and setting.min_amount_per_bet is not None else float(settings.MIN_BET_AMOUNT)
    max_bet_val = float(setting.max_amount_per_bet) if setting and setting.max_amount_per_bet is not None else float(settings.MAX_BET_AMOUNT)

    upcoming_schedule = get_upcoming_week_draws(current_time, cutoff_time_str=cutoff_str, result_time_str=result_str)
    if not upcoming_schedule:
        # Fallback to the latest open draw in db
        draw = db.query(LotteryDraw).filter(LotteryDraw.status == DrawStatus.OPEN).first()
        if not draw:
            draw = db.query(LotteryDraw).order_by(LotteryDraw.id.desc()).first()
        if not draw:
            raise HTTPException(status_code=404, detail="No active draw found.")
        return {
            "id": draw.id,
            "draw_number": draw.draw_number,
            "draw_date": draw.draw_date,
            "draw_time_mmt": draw.draw_time_mmt,
            "status": draw.status,
            "is_past_cutoff": False,
            "cutoff_time": "04:30 PM MMT",
            "cutoff_message": "Betting is open.",
            "min_bet": min_bet_val,
            "max_bet": max_bet_val
        }
    
    first_item = upcoming_schedule[0]
    draw = db.query(LotteryDraw).filter(LotteryDraw.draw_date == first_item["draw_date"]).first()
    if not draw:
        draw_num_seq = f"54{first_item['draw_date'].replace('-', '')[-4:]}/26"
        draw = LotteryDraw(
            draw_number=draw_num_seq,
            draw_date=first_item["draw_date"],
            draw_time_mmt=first_item["draw_time_mmt"],
            status=DrawStatus.OPEN,
            total_pool_stake=0.0,
            total_payout=0.0
        )
        db.add(draw)
        db.commit()
        db.refresh(draw)
        
    is_closed_cutoff, cutoff_msg = is_past_betting_cutoff(draw.draw_date, current_time, cutoff_time_str=cutoff_str)

    return {
        "id": draw.id,
        "draw_number": draw.draw_number,
        "draw_date": draw.draw_date,
        "draw_time_mmt": draw.draw_time_mmt,
        "status": DrawStatus.CLOSED if is_closed_cutoff else draw.status,
        "is_past_cutoff": is_closed_cutoff,
        "cutoff_time": first_item.get("cutoff_time", "04:30 PM MMT"),
        "cutoff_message": cutoff_msg,
        "min_bet": min_bet_val,
        "max_bet": max_bet_val
    }

@router.post("/place", response_model=BetSlipResponse)
def place_bet_slip(
    req: PlaceBetRequest, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Places 4D lottery bet slips:
    - Checks betting lock status (e.g. agents with overdue weekly settlement debt).
    - Supports single draw (draw_id) or multiple selected draws (draw_ids) e.g. Wed, Sat, Sun.
    - Each selected draw day creates a dedicated BetSlip voucher.
    - 30% Agent Commission is calculated and accrued as PENDING (settled on Tuesdays 11:00 AM).
    - If agent bets directly, their 30% commission is also tracked.
    """
    # 0. Check if user betting is locked (unsettled debt)
    if getattr(current_user, 'is_betting_locked', False):
        raise HTTPException(
            status_code=403,
            detail="သင့်အကောင့်သည် အပတ်စဉ် စာရင်းမရှင်းရသေးသောကြောင့် ထိုးခွင့်ယာယီပိတ်ထားပါသည် (Betting is locked due to unsettled weekly balance). ကျေးဇူးပြု၍ Admin ထံ စာရင်းရှင်းလင်းပေးပါခင်ဗျာ။"
        )

    # 0. Load System Settings dynamically
    setting = db.query(SystemSetting).first()
    cutoff_str = setting.bet_end_time if setting and setting.bet_end_time else None
    max_risk_cap = float(setting.max_amount_per_number) if setting and setting.max_amount_per_number is not None else 11000.0
    min_bet_val = float(setting.min_amount_per_bet) if setting and setting.min_amount_per_bet is not None else float(settings.MIN_BET_AMOUNT)
    max_bet_val = float(setting.max_amount_per_bet) if setting and setting.max_amount_per_bet is not None else float(settings.MAX_BET_AMOUNT)
    comm_rate = float(setting.commission_rate / 100.0) if setting and getattr(setting, 'commission_rate', None) else settings.AGENT_COMMISSION_RATE

    target_draw_ids = []
    if req.draw_ids and len(req.draw_ids) > 0:
        target_draw_ids = req.draw_ids
    elif req.draw_id:
        target_draw_ids = [req.draw_id]
    else:
        raise HTTPException(status_code=400, detail="Please select at least one draw day.")

    draws = []
    current_time = now_mmt()

    for d_id in target_draw_ids:
        d = db.query(LotteryDraw).filter(LotteryDraw.id == d_id).first()
        if not d:
            raise HTTPException(status_code=404, detail=f"Draw ID {d_id} not found.")
        if d.status != DrawStatus.OPEN:
            raise HTTPException(status_code=400, detail=f"Draw on {d.draw_date} is currently closed.")

        is_cutoff, cutoff_reason = is_past_betting_cutoff(d.draw_date, current_time, cutoff_time_str=cutoff_str)
        if is_cutoff:
            raise HTTPException(
                status_code=400, 
                detail=f"Betting rejected for {d.draw_date}: {cutoff_reason}"
            )
        draws.append(d)

    if not req.items:
        raise HTTPException(status_code=400, detail="Bet slip cannot be empty.")

    # 2. Validate Numbers, Limits, and Calculate Stakes per draw
    total_single_draw_stake = 0
    processed_items_data = []

    for item in req.items:
        # Check closed numbers for all selected draws
        for d in draws:
            if item.number in d.closed_numbers:
                raise HTTPException(
                    status_code=400,
                    detail=f"ဂဏန်း '{item.number}' သည် {d.draw_date} ပွဲစဉ်အတွက် ထိုးကြေးပိတ်ထားသော Closed Number ဖြစ်သောကြောင့် ထိုး၍မရပါခင်ဗျာ။"
                )

        if not validate_4d_number(item.number, item.bet_type):
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid number '{item.number}' for bet type '{item.bet_type}'."
            )
        
        # Check min and max bet limits against dynamic SystemSetting
        stake_val = item.big_amount if item.big_amount > 0 else item.small_amount
        if stake_val < min_bet_val:
            raise HTTPException(
                status_code=400, 
                detail=f"ဂဏန်း '{item.number}' အတွက် အနည်းဆုံးထိုးကြေးမှာ {min_bet_val:,.0f} ကျပ် ဖြစ်ပါသည် (Minimum bet: {min_bet_val:,.0f} MMK)."
            )
        if stake_val > max_bet_val:
            raise HTTPException(
                status_code=400, 
                detail=f"ဂဏန်း '{item.number}' အတွက် အများဆုံးထိုးကြေးမှာ {max_bet_val:,.0f} ကျပ် ဖြစ်ပါသည် (Maximum bet: {max_bet_val:,.0f} MMK)."
            )

        norm_type = (item.bet_type or "ordinary").lower()
        if norm_type in ["box", "r", "permutation", "ibox"]:
            norm_type = "r"
        elif norm_type in ["roll", "s", "series", "roll_first", "roll_last"]:
            norm_type = "roll"

        calc = calculate_stake(
            number=item.number,
            bet_type=norm_type,
            big_amount=stake_val,
            small_amount=0
        )
        if item.custom_combinations and len(item.custom_combinations) > 0:
            valid_set = set(calc["combinations"])
            filtered = [c for c in item.custom_combinations if c in valid_set]
            if len(filtered) > 0:
                calc["combinations"] = filtered
                calc["combination_count"] = len(filtered)
                calc["total_stake"] = len(filtered) * stake_val

        if calc["total_stake"] <= 0:
            raise HTTPException(status_code=400, detail="Stake amount must be greater than 0.")

        total_single_draw_stake += calc["total_stake"]
        processed_items_data.append((item, calc))

    # ENFORCE MAX RISK PER 4D NUMBER (MMK) FOR EVERY SELECTED DRAW
    incoming_combs_with_stakes = []
    for item_input, calc in processed_items_data:
        unit_stake = calc["big_per_unit"]
        for comb in calc["combinations"]:
            incoming_combs_with_stakes.append((comb, unit_stake))

    for d in draws:
        validate_draw_numbers_risk_cap(
            draw_id=d.id,
            draw_date=d.draw_date,
            combinations_with_stakes=incoming_combs_with_stakes,
            db=db,
            max_risk_cap=max_risk_cap
        )

    # Total Stake = (single draw stake) * (number of selected draw days)
    draw_count = len(draws)
    grand_total_stake = total_single_draw_stake * draw_count

    # 3. Balance Check & Agent Credit Limit Support
    setting_row = db.query(SystemSetting).first()
    is_credit_enabled = bool(setting_row.is_agent_credit_enabled) if setting_row and hasattr(setting_row, "is_agent_credit_enabled") else False

    if current_user.role == UserRole.AGENT and is_credit_enabled:
        available_credit = max(0.0, (current_user.credit_limit or 0.0) - (current_user.used_credit or 0.0))
        if grand_total_stake > available_credit:
            raise HTTPException(
                status_code=400,
                detail=f"Credit မလုံလောက်ပါ! လိုအပ်သော ထိုးကြေး: {grand_total_stake:,.0f} ကျပ် (လက်ကျန် Credit: {available_credit:,.0f} ကျပ်)။ ကျေးဇူးပြု၍ Admin ထံ ခရက်ဒစ် တိုးမြှင့်ပေးရန် သို့မဟုတ် စာရင်းရှင်းလင်းပေးပါခင်ဗျာ။"
            )
        # For Agent with active credit, bet strictly deducts from Credit (adds to used_credit). Deposit is NOT touched.
        current_user.used_credit = (current_user.used_credit or 0.0) + grand_total_stake
    else:
        # Regular user OR Agent when credit feature is suspended
        if current_user.balance < grand_total_stake:
            if current_user.role == UserRole.AGENT:
                raise HTTPException(
                    status_code=400,
                    detail=f"လက်ကျန်ငွေ မလုံလောက်ပါ! လိုအပ်သော ထိုးကြေး: {grand_total_stake:,.0f} ကျပ် (လက်ရှိငွေ: {current_user.balance:,.0f} ကျပ်)။ Agent Credit စနစ်အား လုံခြုံရေးအရ ခေတ္တဆိုင်းငံ့ထားပါသဖြင့် လက်ကျန်ငွေ (Deposit/Balance) ဖြည့်သွင်းပြီးမှသာ ထိုးနိုင်ပါမည် ခင်ဗျာ။"
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient balance! Required: {grand_total_stake:,.0f} MMK ({total_single_draw_stake:,.0f} MMK x {draw_count} draws), Current Balance: {current_user.balance:,.0f} MMK. Please deposit via KPay/WavePay/AYAPay."
                )
        current_user.balance -= grand_total_stake

    # 4. Determine Associated Agent (Referral or Direct Agent Betting)
    agent = None
    if current_user.role == UserRole.AGENT:
        agent = current_user
    elif current_user.agent_id:
        agent = db.query(User).filter(User.id == current_user.agent_id).first()
    elif current_user.referred_by_code:
        agent = db.query(User).filter(User.agent_code == current_user.referred_by_code).first()

    if agent:
        from app.core.agent_level import get_agent_commission_rate
        comm_rate = get_agent_commission_rate(agent, db)

    created_slips = []

    # Create a BetSlip for EACH selected draw day
    for target_draw in draws:
        agent_commission_amount = 0.0
        if agent:
            agent_commission_amount = round(total_single_draw_stake * comm_rate, 2)

        slip_code = f"SLIP-{current_time.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        bet_slip = BetSlip(
            slip_code=slip_code,
            user_id=current_user.id,
            agent_id=agent.id if agent else None,
            agent_commission=agent_commission_amount,
            draw_id=target_draw.id,
            total_stake=total_single_draw_stake,
            total_payout=0.0,
            status=BetSlipStatus.PENDING,
            created_at=current_time
        )
        db.add(bet_slip)
        db.flush()

        for item_input, calc in processed_items_data:
            bet_item = BetItem(
                slip_id=bet_slip.id,
                number=calc["number"],
                bet_type=calc["bet_type"],
                big_amount=calc["big_per_unit"],
                small_amount=0,
                combination_count=calc["combination_count"],
                combinations_json=json.dumps(calc["combinations"]),
                item_stake=calc["total_stake"],
                item_payout=0.0,
                is_won=0,
                win_details_json="[]"
            )
            db.add(bet_item)

        created_slips.append(bet_slip)

    # 5. Accrue Agent Commission (Accrued as PENDING, settled Tuesday 11:00 AM)
    today_str = current_time.strftime("%Y-%m-%d")
    total_commission_all_slips = 0.0

    for slip in created_slips:
        if agent and slip.agent_commission > 0:
            total_commission_all_slips += slip.agent_commission

            comm_log = AgentCommissionLog(
                agent_id=agent.id,
                player_id=current_user.id,
                bet_slip_id=slip.id,
                bet_total_stake=slip.total_stake,
                commission_rate=comm_rate,
                commission_amount=slip.agent_commission,
                agent_balance_after=agent.balance,
                is_settled=False,
                settlement_status="PENDING",
                created_at=current_time
            )
            db.add(comm_log)

        # 6. Financial Ledger Entry for BET_REVENUE per slip
        bet_ledger = FinancialLedger(
            entry_type=LedgerEntryType.BET_REVENUE,
            amount=slip.total_stake,
            running_balance=current_user.balance,
            reference_id=slip.slip_code,
            reference_type="BET_SLIP",
            description=f"4D Bet Placed ({slip.slip_code}) - Draw on {slip.draw.draw_date if slip.draw else 'N/A'}",
            logged_at_mmt=current_time,
            date_str=today_str
        )
        db.add(bet_ledger)

    if agent and total_commission_all_slips > 0:
        comm_pct_display = int(round(comm_rate * 100))
        agent_notif = Notification(
            user_id=agent.id,
            title=f"💰 {comm_pct_display}% ကော်မရှင် စာရင်းဝင်ပါသည် (Pending)",
            message=f"ထိုးကြေးများအတွက် {comm_pct_display}% ကော်မရှင် +{total_commission_all_slips:,.0f} ကျပ် စာရင်းဝင်ထားပါသည်။ အပတ်စဉ် အင်္ဂါနေ့ နံနက် ၁၁:၀၀ နာရီတွင် အပြီးသတ်ရှင်းလင်းပြီး ထည့်သွင်းပေးပါမည်။",
            notif_type="COMMISSION_PENDING",
            is_read=False
        )
        db.add(agent_notif)

    # 7. Update Daily Ledger Summary
    daily_summary = db.query(DailyLedgerSummary).filter(DailyLedgerSummary.date_str == today_str).first()
    if daily_summary:
        daily_summary.total_bet_volume += grand_total_stake
        daily_summary.net_profit += grand_total_stake
        daily_summary.total_bets_count += len(created_slips)
        daily_summary.updated_at_mmt = current_time
    else:
        daily_summary = DailyLedgerSummary(
            date_str=today_str,
            total_bet_volume=grand_total_stake,
            net_profit=grand_total_stake,
            total_bets_count=len(created_slips),
            updated_at_mmt=current_time
        )
        db.add(daily_summary)

    # 8. Evaluate Agent Level Progression (Agent self-bets + Downline turnover)
    from app.core.agent_level import evaluate_and_update_agent_level
    if current_user.role == UserRole.AGENT:
        evaluate_and_update_agent_level(current_user, db, commit=False)
    elif agent:
        evaluate_and_update_agent_level(agent, db, commit=False)

    db.commit()
    for s in created_slips:
        db.refresh(s)
    return created_slips[0]

@router.get("/my-history", response_model=List[BetSlipResponse])
def get_user_bets(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(BetSlip).filter(BetSlip.user_id == current_user.id)
    if status_filter:
        query = query.filter(BetSlip.status == status_filter.upper())
    
    slips = query.order_by(BetSlip.id.desc()).limit(100).all()
    return slips
