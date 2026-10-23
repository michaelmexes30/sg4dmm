import json
from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.lottery import LotteryDraw, DrawStatus, TwoDDraw, ThreeDDraw
from app.models.settings import SystemSetting
from app.models.bet import BetSlip, BetSlipStatus
from app.models.user import User, Notification
from app.models.transaction import Transaction, TransactionType, TransactionStatus
from app.models.ledger import FinancialLedger, LedgerEntryType, DailyLedgerSummary
from app.core.security import get_current_admin
from app.core.bet_calculator import evaluate_bet_winnings
from app.core.timezone_utils import now_mmt
from app.core.notifications import send_payout_announcement

router = APIRouter(prefix="/lottery", tags=["Lottery, Results & Automated Settlement"])

class SettleDrawRequest(BaseModel):
    draw_id: int
    first_prize: str = Field(..., min_length=4, max_length=4, example="4829")
    second_prize: str = Field(..., min_length=4, max_length=4, example="1904")
    third_prize: str = Field(..., min_length=4, max_length=4, example="8351")
    starter_prizes: List[str] = Field(..., min_items=10, max_items=10)
    consolidation_prizes: List[str] = Field(..., min_items=10, max_items=10)

@router.get("/draws")
def list_draws(limit: int = 10, db: Session = Depends(get_db)):
    """Returns official completed Singapore 4D draws with winning results, ordered by latest date first."""
    draws = (
        db.query(LotteryDraw)
        .filter(LotteryDraw.first_prize.isnot(None))
        .filter(LotteryDraw.status == DrawStatus.SETTLED)
        .order_by(LotteryDraw.draw_date.desc(), LotteryDraw.id.desc())
        .limit(limit)
        .all()
    )
    results = []
    for d in draws:
        winners = d.winners
        display_payout = sum(w.get("payout_amount", 0) for w in winners)
        results.append({
            "id": d.id,
            "draw_number": d.draw_number,
            "draw_date": d.draw_date,
            "draw_time_mmt": d.draw_time_mmt,
            "status": d.status,
            "first_prize": d.first_prize,
            "second_prize": d.second_prize,
            "third_prize": d.third_prize,
            "starter_prizes": d.starter_prizes,
            "consolidation_prizes": d.consolidation_prizes,
            "total_pool_stake": d.total_pool_stake,
            "total_payout": d.total_payout,
            "winners": winners,
            "total_winners_count": len(winners),
            "display_payout": display_payout
        })
    return results

@router.get("/recent-winners")
def get_recent_winners(limit: int = 25, db: Session = Depends(get_db)):
    """Returns recent winners for ticker feed across latest draws"""
    latest_draws = (
        db.query(LotteryDraw)
        .filter(LotteryDraw.status == DrawStatus.SETTLED)
        .order_by(LotteryDraw.draw_date.desc())
        .limit(3)
        .all()
    )
    all_winners = []
    for d in latest_draws:
        all_winners.extend(d.winners)
    return all_winners[:limit]

@router.post("/settle")
def settle_draw(
    req: SettleDrawRequest,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Automated Payout System (6:00 PM MMT):
    1. Records Singapore 4D Official Results (1st, 2nd, 3rd, 10 Starters, 10 Consolidation).
    2. Evaluates all valid pending tickets using Singapore 4D multipliers:
       - 1st Prize: 2000x
       - 2nd Prize: 1000x
       - 3rd Prize: 500x
       - Starter Prize: 100x
       - Consolation Prize: 30x
       - Permutation / Box Roll: 10x
    3. Credits winnings instantly to user wallets for immediate withdrawal.
    4. Logs PAYOUT_EXPENSE in the Financial Ledger.
    5. Dispatches payout notifications to winners and broad announcements.
    """
    draw = db.query(LotteryDraw).filter(LotteryDraw.id == req.draw_id).first()
    if not draw:
        raise HTTPException(status_code=404, detail="Draw not found.")

    draw_results_payload = {
        "first_prize": req.first_prize.strip(),
        "second_prize": req.second_prize.strip(),
        "third_prize": req.third_prize.strip(),
        "starter_prizes": [s.strip() for s in req.starter_prizes],
        "consolidation_prizes": [c.strip() for c in req.consolidation_prizes]
    }

    # Update draw details
    draw.first_prize = req.first_prize.strip()
    draw.second_prize = req.second_prize.strip()
    draw.third_prize = req.third_prize.strip()
    draw.starter_prizes_json = json.dumps([s.strip() for s in req.starter_prizes])
    draw.consolidation_prizes_json = json.dumps([c.strip() for c in req.consolidation_prizes])
    draw.status = DrawStatus.SETTLED
    draw.settled_at = now_mmt()

    # Query pending slips for this draw
    slips = db.query(BetSlip).filter(
        BetSlip.draw_id == draw.id,
        BetSlip.status == BetSlipStatus.PENDING
    ).all()

    total_draw_payout = 0
    total_winners = 0
    settle_time = now_mmt()
    today_str = settle_time.strftime("%Y-%m-%d")

    for slip in slips:
        slip_total_payout = 0
        has_win = False

        for item in slip.items:
            combos = item.combinations
            item_payout = 0
            win_matches = []

            for combo in combos:
                res = evaluate_bet_winnings(
                    bet_number=combo,
                    big_stake=int(item.big_amount),
                    small_stake=int(item.small_amount),
                    draw_results=draw_results_payload,
                    bet_type=item.bet_type
                )
                if res["is_won"]:
                    item_payout += res["total_payout"]
                    for m in res["matches"]:
                        m["winning_number"] = combo
                        win_matches.append(m)

            item.item_payout = item_payout
            item.is_won = 1 if item_payout > 0 else 0
            item.win_details_json = json.dumps(win_matches)

            if item_payout > 0:
                has_win = True
                slip_total_payout += item_payout

        slip.total_payout = slip_total_payout
        slip.settled_at = settle_time

        if has_win:
            slip.status = BetSlipStatus.WON
            total_winners += 1
            total_draw_payout += slip_total_payout

            # Credit user balance immediately for instant withdrawal
            user = db.query(User).filter(User.id == slip.user_id).first()
            if user:
                user.balance += slip_total_payout

                # User Transaction Record for Winning Payout (Cash In / Out History)
                win_tx = Transaction(
                    user_id=user.id,
                    tx_type=TransactionType.WIN_PAYOUT,
                    gateway="SG4D OFFICIAL",
                    transaction_id=slip.slip_code,
                    receiver_id=f"Player #{user.id} ({user.phone})",
                    amount=slip_total_payout,
                    slip_image_url=None,
                    client_timezone="MMT",
                    tx_timestamp_mmt=settle_time,
                    submission_timestamp_mmt=settle_time,
                    delta_minutes=0.0,
                    is_time_valid=True,
                    is_receiver_valid=True,
                    is_tx_unique=True,
                    status=TransactionStatus.COMPLETED,
                    verification_notes=f"Prize payout for winning ticket {slip.slip_code} - Draw #{draw.draw_number}",
                    created_at=settle_time
                )
                db.add(win_tx)

                # Ledger entry
                ledger_entry = FinancialLedger(
                    entry_type=LedgerEntryType.PAYOUT_EXPENSE,
                    amount=-slip_total_payout,
                    running_balance=user.balance,
                    reference_id=slip.slip_code,
                    reference_type="BET_SLIP",
                    description=f"Prize Winning Payout for {slip.slip_code} ({slip_total_payout:,.0f} MMK)",
                    logged_at_mmt=settle_time,
                    date_str=today_str
                )
                db.add(ledger_entry)

                # Winner In-app Notification
                winner_notif = Notification(
                    user_id=user.id,
                    title="🎉 CONGRATULATIONS! You Won!",
                    message=(
                        f"Your ticket {slip.slip_code} for Draw #{draw.draw_number} won a total of "
                        f"{slip_total_payout:,.0f} MMK! Funds have been credited to your wallet for immediate withdrawal."
                    ),
                    notif_type="PAYOUT_ANNOUNCEMENT",
                    is_read=False
                )
                db.add(winner_notif)
        else:
            slip.status = BetSlipStatus.LOST

    draw.total_payout = total_draw_payout

    # Generate & Merge winners for public display (Social Proof)
    try:
        from app.seeds.seed_fake_users import generate_winners_for_draw, merge_real_and_simulated_winners, mask_name, mask_phone
        real_winners_list = []
        for slip in slips:
            if slip.status == BetSlipStatus.WON:
                p = db.query(User).filter(User.id == slip.user_id).first()
                if p:
                    for item in slip.items:
                        if item.is_won and item.item_payout > 0:
                            for m in item.win_details:
                                real_winners_list.append({
                                    "user_id": p.id,
                                    "player_name": p.full_name or p.username,
                                    "masked_name": mask_name(p.full_name or p.username),
                                    "phone": p.phone,
                                    "masked_phone": mask_phone(p.phone),
                                    "prize_tier": m.get("prize_tier", "Winner"),
                                    "prize_tier_mm": m.get("prize_tier_mm", "ပေါက်ဆု"),
                                    "winning_number": m.get("winning_number", item.number),
                                    "stake_amount": int(item.big_amount if item.big_amount > 0 else item.small_amount),
                                    "multiplier": m.get("multiplier", 0),
                                    "payout_amount": m.get("payout", item.item_payout),
                                    "draw_date": draw.draw_date,
                                    "draw_number": draw.draw_number,
                                    "is_simulated": False
                                })

        cursor = (draw.id * 17) % 300
        simulated_winners = generate_winners_for_draw(draw, cursor)
        merged_winners = merge_real_and_simulated_winners(real_winners_list, simulated_winners)
        draw.winners_json = json.dumps(merged_winners)
    except Exception as e:
        pass

    # Update Daily Ledger Summary
    daily_summary = db.query(DailyLedgerSummary).filter(DailyLedgerSummary.date_str == today_str).first()
    if daily_summary:
        daily_summary.total_payouts += total_draw_payout
        daily_summary.net_profit -= total_draw_payout
        daily_summary.updated_at_mmt = settle_time
    else:
        daily_summary = DailyLedgerSummary(
            date_str=today_str,
            total_payouts=total_draw_payout,
            net_profit=-total_draw_payout,
            updated_at_mmt=settle_time
        )
        db.add(daily_summary)

    db.commit()

    # Broadcast public payout announcement
    send_payout_announcement(draw.draw_number, total_draw_payout, total_winners)

    return {
        "status": "success",
        "draw_number": draw.draw_number,
        "total_slips_settled": len(slips),
        "winning_slips": total_winners,
        "total_payout_amount": total_draw_payout,
        "timestamp_mmt": settle_time.strftime("%Y-%m-%d %I:%M:%S %p MMT")
    }

@router.post("/sync-sgpools")
def sync_with_singapore_pools(
    target_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Connects to Singapore Pools (singaporepools.com.sg) official results,
    fetches latest 4D numbers, and automatically settles win/loss for all tickets.
    """
    from app.core.singapore_pools_scraper import sync_singapore_pools_results
    result = sync_singapore_pools_results(db=db, target_date=target_date)
    return result

@router.get("/sgpools-live")
def get_sgpools_live_feed():
    """
    Returns the real-time live parsed feed directly from Singapore Pools official site.
    """
    from app.core.singapore_pools_scraper import fetch_singapore_pools_4d_results
    results = fetch_singapore_pools_4d_results()
    return {
        "source": "https://www.singaporepools.com.sg/en/product/pages/4d_results.aspx",
        "count": len(results),
        "draws": results
    }



# =========================================================================
# THAI 2D LOTTERY PUBLIC PLAYER ENDPOINTS
# =========================================================================

@router.get("/2d/active-draw")
def get_2d_active_draw(db: Session = Depends(get_db)):
    """Returns today's active 2D sessions (Morning 12:01 PM & Evening 04:30 PM)."""
    from app.api.admin import ensure_twod_draws_exist
    ensure_twod_draws_exist(db)

    setting = db.query(SystemSetting).first()
    is_enabled = bool(getattr(setting, "is_2d_enabled", True) if getattr(setting, "is_2d_enabled", True) is not None else True)
    payout_mult = float(getattr(setting, "twod_payout_multiplier", 85.0) or 85.0)
    min_bet = float(getattr(setting, "twod_min_bet", 100.0) or 100.0)
    max_bet = float(getattr(setting, "twod_max_bet", 50000.0) or 50000.0)

    open_draws = db.query(TwoDDraw).filter(TwoDDraw.status == "OPEN").order_by(TwoDDraw.id.asc()).all()
    draws_data = []
    for d in open_draws:
        draws_data.append({
            "id": d.id,
            "draw_date": d.draw_date,
            "session": d.session,
            "session_label": "Morning (12:01 PM)" if d.session == "morning" else "Evening (04:30 PM)",
            "draw_time_mmt": d.draw_time_mmt,
            "cutoff_time_mmt": d.cutoff_time_mmt,
            "status": d.status,
            "closed_numbers": d.closed_numbers
        })

    return {
        "is_enabled": is_enabled,
        "payout_multiplier": payout_mult,
        "min_bet": min_bet,
        "max_bet": max_bet,
        "sessions": draws_data,
        "active_session": draws_data[0] if draws_data else None
    }

@router.get("/2d/results")
def get_2d_results(limit: int = 20, db: Session = Depends(get_db)):
    """Returns settled Thai 2D results from Thai Stock Exchange (SET)."""
    from app.api.admin import ensure_twod_draws_exist
    ensure_twod_draws_exist(db)

    draws = db.query(TwoDDraw).filter(TwoDDraw.status == "SETTLED").order_by(TwoDDraw.id.desc()).limit(limit).all()
    return [
        {
            "id": d.id,
            "draw_date": d.draw_date,
            "session": d.session,
            "session_label": "Morning (12:01 PM)" if d.session == "morning" else "Evening (04:30 PM)",
            "draw_time_mmt": d.draw_time_mmt,
            "set_index": d.set_index,
            "set_value": d.set_value,
            "winning_number": d.winning_number,
            "status": d.status
        }
        for d in draws
    ]

# =========================================================================
# THAI 3D LOTTERY PUBLIC PLAYER ENDPOINTS
# =========================================================================

@router.get("/3d/active-draw")
def get_3d_active_draw(db: Session = Depends(get_db)):
    """Returns upcoming Thai Government 3D Draw (1st or 16th of month)."""
    from app.api.admin import ensure_threed_draws_exist
    ensure_threed_draws_exist(db)

    setting = db.query(SystemSetting).first()
    is_enabled = bool(getattr(setting, "is_3d_enabled", True) if getattr(setting, "is_3d_enabled", True) is not None else True)
    straight_payout = float(getattr(setting, "threed_straight_payout", 700.0) or 700.0)
    tote_payout = float(getattr(setting, "threed_tote_payout", 10.0) or 10.0)
    min_bet = float(getattr(setting, "threed_min_bet", 100.0) or 100.0)
    max_bet = float(getattr(setting, "threed_max_bet", 50000.0) or 50000.0)

    upcoming = db.query(ThreeDDraw).filter(ThreeDDraw.status == "OPEN").order_by(ThreeDDraw.id.asc()).first()
    return {
        "is_enabled": is_enabled,
        "straight_payout": straight_payout,
        "tote_payout": tote_payout,
        "min_bet": min_bet,
        "max_bet": max_bet,
        "draw": {
            "id": upcoming.id if upcoming else None,
            "draw_date": upcoming.draw_date if upcoming else None,
            "draw_time_mmt": upcoming.draw_time_mmt if upcoming else "03:30 PM MMT",
            "cutoff_time_mmt": upcoming.cutoff_time_mmt if upcoming else "02:30 PM MMT",
            "status": upcoming.status if upcoming else "OPEN",
            "closed_numbers": upcoming.closed_numbers if upcoming else []
        } if upcoming else None
    }

@router.get("/3d/results")
def get_3d_results(limit: int = 15, db: Session = Depends(get_db)):
    """Returns settled Thai 3D lottery results (Thai 1st prize & last 3 digits)."""
    from app.api.admin import ensure_threed_draws_exist
    ensure_threed_draws_exist(db)

    draws = db.query(ThreeDDraw).filter(ThreeDDraw.status == "SETTLED").order_by(ThreeDDraw.id.desc()).limit(limit).all()
    return [
        {
            "id": d.id,
            "draw_date": d.draw_date,
            "draw_time_mmt": d.draw_time_mmt,
            "thai_first_prize": d.thai_first_prize,
            "winning_number": d.winning_number,
            "status": d.status
        }
        for d in draws
    ]
