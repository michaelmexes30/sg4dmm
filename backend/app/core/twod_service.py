import re
import json
import logging
import requests
from datetime import datetime, timedelta
from typing import Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.lottery import TwoDDraw
from app.models.bet import BetSlip, BetSlipStatus
from app.models.user import User, Notification
from app.models.settings import SystemSetting
from app.models.transaction import Transaction, TransactionType, TransactionStatus
from app.models.ledger import FinancialLedger, LedgerEntryType, DailyLedgerSummary
from app.core.timezone_utils import now_mmt

logger = logging.getLogger("twod_service")
logger.setLevel(logging.INFO)

THAISTOCK2D_API_URL = "https://api.thaistock2d.com/live"
SET_OFFICIAL_URL = "https://www.set.or.th/en/home"

def fetch_live_twod_from_set_official() -> Optional[Dict[str, str]]:
    """
    Scrapes official Thai Stock Exchange directly from https://set.or.th/en/home.
    Extracts the SET Index and Market Value, then calculates the Myanmar 2D winning number:
      - 1st digit (Tens): Last digit of SET Index decimal (e.g. 1,553.99 -> 9)
      - 2nd digit (Units): Last digit of Market Value integer part (e.g. 41,021.10 -> 1)
      - Result: "91"
    """
    try:
        from bs4 import BeautifulSoup
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }
        resp = requests.get(SET_OFFICIAL_URL, headers=headers, timeout=8)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "html.parser")
            for row in soup.find_all("tr"):
                parts = row.get_text(" ", strip=True).split()
                if len(parts) >= 5 and parts[0] == "SET":
                    set_idx = parts[1]  # e.g. "1,553.99"
                    val = parts[-1]     # e.g. "41,021.10"
                    if "." in set_idx and "." in val:
                        d1 = set_idx.split(".")[-1][-1]
                        val_int = val.split(".")[0].replace(",", "")
                        d2 = val_int[-1]
                        twod = f"{d1}{d2}"
                        logger.info(f"Fetched official 2D from set.or.th: SET={set_idx}, Value={val} -> 2D={twod}")
                        return {
                            "twod": twod,
                            "set_index": set_idx,
                            "set_value": val,
                            "source": "set.or.th (Official)"
                        }
    except Exception as e:
        logger.warning(f"Error fetching from set.or.th: {e}")
    return None

def fetch_live_twod_from_api(session_type: str = "evening", is_settlement: bool = False) -> Optional[Dict[str, str]]:
    """
    Attempts to fetch official Thai Stock 2D results from the primary ThaiStock2D live API.
    Handles official closing results array (12:01:00 / 12:00:00 / 16:30:00).
    When is_settlement=True, strictly waits for the official closing tick from the result array.
    Does NOT fallback to fluctuating live ticks during settlement!
    Note: '00' is a valid 2D winning number and is explicitly accepted.
    """
    try:
        proxies = {"http": None, "https": None}
        resp = requests.get(THAISTOCK2D_API_URL, proxies=proxies, timeout=8)
        if resp.status_code == 200:
            data = resp.json()
            holiday = data.get("holiday")
            if holiday and str(holiday.get("status", "0")) == "1":
                logger.info(f"Thai Stock Exchange is closed today for holiday: {holiday.get('name')}")
                return {
                    "holiday": True,
                    "holiday_name": str(holiday.get("name") or "Thai Market Holiday"),
                    "source": "ThaiStock2D API (Holiday)"
                }

            results = data.get("result", [])
            target_times = ["12:01:00", "12:00:00"] if session_type == "morning" else ["16:30:00"]
            for r in results:
                if r.get("open_time") in target_times:
                    twod = str(r.get("twod", "")).strip().zfill(2)
                    set_idx = str(r.get("set", "")).strip()
                    val = str(r.get("value", "")).strip()
                    # '00' is completely valid! Only reject missing/blank/placeholder symbols ('--', '')
                    if twod and twod not in ["--", ""] and twod.isdigit() and len(twod) == 2 and set_idx not in ["0.00", "--", ""]:
                        return {
                            "twod": twod,
                            "set_index": set_idx,
                            "set_value": val,
                            "source": "ThaiStock2D API (Result)"
                        }

            # If settling and API is reachable (non-holiday) but closing tick is not finalized yet,
            # return an explicit unfinalized marker so caller does NOT prematurely settle using set.or.th!
            if is_settlement:
                return {"unfinalized": True, "source": "ThaiStock2D API (Unfinalized)"}

            # For real-time UI monitoring during active trading hours, live field is used
            live = data.get("live", {})
            if live:
                live_twod = str(live.get("twod", "")).strip().zfill(2)
                live_set = str(live.get("set", "")).strip()
                live_val = str(live.get("value", "")).strip()
                if live_twod and live_twod not in ["--", ""] and live_twod.isdigit() and len(live_twod) == 2 and live_set not in ["0.00", "--", ""]:
                    return {
                        "twod": live_twod,
                        "set_index": live_set,
                        "set_value": live_val,
                        "source": "ThaiStock2D API (Live)"
                    }
    except Exception as e:
        logger.warning(f"Error fetching from ThaiStock2D API: {e}")
    return None

def get_live_twod_result(session_type: str = "morning", is_settlement: bool = False) -> Optional[Dict[str, str]]:
    """
    Multi-source resolver for Myanmar 2D result:
    1. Checks ThaiStock2D result array for locked settlement tick (12:01 / 16:30).
    2. Never falls back to set.or.th on Thai market holidays or while closing tick is unfinalized.
    3. Only falls back to set.or.th if ThaiStock2D API itself is unreachable AND (not settling OR well after market close).
    """
    api_res = fetch_live_twod_from_api(session_type, is_settlement=is_settlement)
    if api_res:
        if api_res.get("holiday"):
            logger.info(f"Skipping 2D result fetch due to Thai holiday: {api_res.get('holiday_name')}")
            return None
        if api_res.get("unfinalized"):
            logger.info(f"2D {session_type} closing tick not finalized yet on ThaiStock2D API; waiting.")
            return None
        if api_res.get("twod") and len(api_res["twod"]) == 2:
            return api_res

    # ThaiStock2D API was unreachable (returned None):
    # For settlement, only fall back to set.or.th after market has definitely closed for that session
    if is_settlement:
        curr = now_mmt()
        if curr.weekday() >= 5:
            return None
        if session_type == "morning" and not (curr.hour > 12 or (curr.hour == 12 and curr.minute >= 5)):
            return None
        if session_type == "evening" and not (curr.hour > 16 or (curr.hour == 16 and curr.minute >= 35)):
            return None

    set_res = fetch_live_twod_from_set_official()
    if set_res and set_res.get("twod") and len(set_res["twod"]) == 2:
        return set_res

    return None


def settle_twod_draw_internal(
    db: Session,
    draw: TwoDDraw,
    winning_number: str,
    set_index: Optional[str] = None,
    set_value: Optional[str] = None
) -> Dict[str, Any]:
    """
    Idempotent, row-locked 2D draw settlement engine:
    - Acquires FOR UPDATE lock on TwoDDraw; skips immediately if already SETTLED.
    - Evaluates strictly PENDING 2D slips only (prevents double payouts).
    - Row-locks each winning player wallet before crediting.
    - Records negative PAYOUT_EXPENSE in FinancialLedger & updates DailyLedgerSummary.
    """
    clean_win = str(winning_number).strip().zfill(2)
    if not clean_win.isdigit() or len(clean_win) != 2:
        raise ValueError(f"Invalid 2D winning number: {winning_number}")

    # Lock draw row to guarantee strict idempotency across concurrent jobs/requests
    locked_draw = db.query(TwoDDraw).filter(TwoDDraw.id == draw.id).with_for_update().first()
    if not locked_draw or locked_draw.status == "SETTLED":
        logger.info(f"2D Draw #{draw.id} is already settled; skipping duplicate settlement.")
        return {
            "status": "already_settled",
            "draw_id": draw.id,
            "winning_number": locked_draw.winning_number if locked_draw else clean_win,
            "total_slips": 0,
            "winners_count": 0,
            "total_payout": 0.0
        }
    draw = locked_draw

    setting = db.query(SystemSetting).first()
    payout_multiplier = float(setting.twod_payout_multiplier) if getattr(setting, "twod_payout_multiplier", None) is not None else 80.0

    settle_time = now_mmt()
    draw.winning_number = clean_win
    if set_index:
        draw.set_index = set_index
    if set_value:
        draw.set_value = set_value
    draw.status = "SETTLED"
    draw.settled_at = settle_time

    # Strictly filter PENDING 2D slips only!
    slips = db.query(BetSlip).filter(
        BetSlip.game_type == "2D",
        BetSlip.draw_id == draw.id,
        BetSlip.status == BetSlipStatus.PENDING
    ).all()

    total_payout = 0.0
    total_staked_pending = 0.0
    winners_count = 0
    today_str = settle_time.strftime("%Y-%m-%d")

    for slip in slips:
        slip_payout = 0.0
        has_win = False
        total_staked_pending += float(slip.total_stake or 0.0)

        for item in slip.items:
            clean_item_num = str(item.number).strip().zfill(2)
            if clean_item_num == clean_win:
                item_win = float(item.item_stake or 0.0) * payout_multiplier
                item.is_won = 1
                item.item_payout = item_win
                item.win_details_json = json.dumps([{"winning_number": clean_win, "payout": item_win}])
                slip_payout += item_win
                has_win = True
            else:
                item.is_won = 0
                item.item_payout = 0.0

        if has_win:
            slip.status = BetSlipStatus.WON
            slip.total_payout = slip_payout
            total_payout += slip_payout
            winners_count += 1
            slip.settled_at = settle_time

            player = db.query(User).filter(User.id == slip.user_id).with_for_update().first()
            if player:
                player.balance = float(player.balance or 0.0) + slip_payout

                win_tx = Transaction(
                    user_id=player.id,
                    tx_type=TransactionType.WIN_PAYOUT,
                    gateway="SG4D 2D",
                    transaction_id=slip.slip_code,
                    receiver_id=f"Player #{player.id} ({player.phone})",
                    amount=slip_payout,
                    slip_image_url=None,
                    client_timezone="MMT",
                    tx_timestamp_mmt=settle_time,
                    submission_timestamp_mmt=settle_time,
                    delta_minutes=0.0,
                    is_time_valid=True,
                    is_receiver_valid=True,
                    is_tx_unique=True,
                    status=TransactionStatus.COMPLETED,
                    verification_notes=f"2D Prize payout for ticket {slip.slip_code} ({clean_win}) - {draw.session.capitalize()} {draw.draw_date}",
                    created_at=settle_time
                )
                db.add(win_tx)

                # Unified negative sign for PAYOUT_EXPENSE across all games
                win_ledger = FinancialLedger(
                    entry_type=LedgerEntryType.PAYOUT_EXPENSE,
                    amount=-slip_payout,
                    running_balance=player.balance,
                    reference_id=slip.slip_code,
                    reference_type="BET_SLIP_2D_WIN",
                    description=f"2D အနိုင်ရငွေ ({clean_win}) - {draw.session.capitalize()} {draw.draw_date}",
                    logged_at_mmt=settle_time,
                    date_str=today_str
                )
                db.add(win_ledger)

                session_name = "မနက်ပိုင်း" if draw.session == "morning" else "ညနေပိုင်း"
                notif = Notification(
                    user_id=player.id,
                    title="🎉 ဂုဏ်ယူပါသည်! 2D ထီပေါက်ပါသည်",
                    message=f"သင်ထိုးထားသော 2D ဂဏန်း '{clean_win}' သည် {draw.draw_date} ({session_name}) တွင် ပေါက်ပြီး အနိုင်ရငွေ +{slip_payout:,.0f} ကျပ် အား သင့်အကောင့်ထဲ ထည့်သွင်းပေးပြီးပါပြီ။",
                    notif_type="LOTTERY_WIN",
                    is_read=False
                )
                db.add(notif)
        else:
            slip.status = BetSlipStatus.LOST
            slip.total_payout = 0.0
            slip.settled_at = settle_time

    # Recompute exact draw totals without double-counting stakes already tracked at placement
    from sqlalchemy import func
    exact_staked = db.query(func.coalesce(func.sum(BetSlip.total_stake), 0.0)).filter(
        BetSlip.game_type == "2D",
        BetSlip.draw_id == draw.id,
        BetSlip.status.notin_([BetSlipStatus.CANCELLED, BetSlipStatus.VOID])
    ).scalar() or 0.0
    draw.total_staked = max(float(exact_staked), total_staked_pending)
    draw.total_payout = float(total_payout)

    if total_payout > 0:
        daily_summary = db.query(DailyLedgerSummary).filter(DailyLedgerSummary.date_str == today_str).first()
        if daily_summary:
            daily_summary.total_payouts += total_payout
            daily_summary.net_profit -= total_payout
            daily_summary.updated_at_mmt = settle_time
        else:
            db.add(DailyLedgerSummary(
                date_str=today_str,
                total_payouts=total_payout,
                net_profit=-total_payout,
                updated_at_mmt=settle_time
            ))

    db.commit()

    logger.info(f"Settled 2D Draw #{draw.id} ({draw.draw_date} {draw.session}) -> Winning #{clean_win}. Slips: {len(slips)}, Winners: {winners_count}, Payout: {total_payout:,.0f} MMK")
    return {
        "status": "success",
        "draw_id": draw.id,
        "winning_number": clean_win,
        "total_slips": len(slips),
        "winners_count": winners_count,
        "total_payout": total_payout
    }


def poll_and_settle_2d_job():
    """
    Automated background polling and settlement job executed by APScheduler.
    - Runs around 12:01 PM MMT (morning) and 04:30 PM MMT (evening) on weekdays.
    - Also settles any overdue OPEN or CLOSED past draws using official historical API.
    """
    curr = now_mmt()
    today_str = curr.strftime("%Y-%m-%d")
    is_weekend = curr.weekday() >= 5
    is_past_morning = curr.hour > 12 or (curr.hour == 12 and curr.minute >= 1)
    is_past_evening = curr.hour > 16 or (curr.hour == 16 and curr.minute >= 30)

    db = SessionLocal()
    try:
        from app.api.admin import ensure_twod_draws_exist
        ensure_twod_draws_exist(db)

        if not is_weekend:
            # 1. Check Morning Draw
            if is_past_morning:
                morning = db.query(TwoDDraw).filter(
                    TwoDDraw.draw_date == today_str,
                    TwoDDraw.session == "morning"
                ).first()
                if morning and morning.status in ["OPEN", "CLOSED"]:
                    api_res = get_live_twod_result("morning", is_settlement=True)
                    if api_res and api_res.get("twod"):
                        settle_twod_draw_internal(db, morning, api_res["twod"], api_res.get("set_index"), api_res.get("set_value"))

            # 2. Check Evening Draw
            if is_past_evening:
                evening = db.query(TwoDDraw).filter(
                    TwoDDraw.draw_date == today_str,
                    TwoDDraw.session == "evening"
                ).first()
                if evening and evening.status in ["OPEN", "CLOSED"]:
                    api_res = get_live_twod_result("evening", is_settlement=True)
                    if api_res and api_res.get("twod"):
                        settle_twod_draw_internal(db, evening, api_res["twod"], api_res.get("set_index"), api_res.get("set_value"))

        # 3. Check any overdue past unclosed draws (BOTH OPEN and CLOSED!) from yesterday or earlier
        overdue_draws = db.query(TwoDDraw).filter(
            TwoDDraw.draw_date < today_str,
            TwoDDraw.status.in_(["OPEN", "CLOSED"])
        ).all()
        if overdue_draws:
            try:
                resp = requests.get("https://api.thaistock2d.com/2d_result", timeout=8)
                if resp.status_code == 200:
                    hist_data = resp.json()
                    for od in overdue_draws:
                        for d_item in hist_data:
                            if d_item.get("date") == od.draw_date:
                                target_t = "12:01:00" if od.session == "morning" else "16:30:00"
                                for c in d_item.get("child", []):
                                    tw = str(c.get("twod", "")).strip()
                                    if c.get("time") == target_t and tw not in ["--", ""] and tw.isdigit():
                                        settle_twod_draw_internal(db, od, tw, c.get("set"), c.get("value"))
                                        break
            except Exception as e:
                logger.warning(f"Failed to auto-settle overdue 2D draws: {e}")

    except Exception as e:
        logger.error(f"Error in poll_and_settle_2d_job: {e}", exc_info=True)
    finally:
        db.close()
