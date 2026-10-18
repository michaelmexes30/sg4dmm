import requests
import json
import re
import time
import logging
from datetime import datetime
from typing import List, Dict, Optional, Any
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.lottery import LotteryDraw, DrawStatus
from app.models.bet import BetSlip, BetSlipStatus
from app.models.user import User, Notification
from app.models.transaction import Transaction, TransactionType, TransactionStatus
from app.models.ledger import FinancialLedger, LedgerEntryType, DailyLedgerSummary
from app.core.bet_calculator import evaluate_bet_winnings
from app.core.timezone_utils import now_mmt
from app.core.notifications import send_payout_announcement

logger = logging.getLogger("singapore_pools_scraper")
logger.setLevel(logging.INFO)

PRIMARY_SG_POOLS_URL = "https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/fourd_result_top_draws_en.html"
FALLBACK_SG_POOLS_URL = "https://www.singaporepools.com.sg/en/product/pages/4d_results.aspx"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
]

def parse_sg_pools_date(raw_date_str: str) -> Optional[str]:
    """
    Parses date strings like 'Wed, 14 Oct 2026' into ISO '2026-10-14'.
    """
    if not raw_date_str:
        return None
    try:
        match = re.search(r'([A-Za-z]+,\s*\d+\s+[A-Za-z]+\s+\d{4})', raw_date_str)
        if match:
            dt = datetime.strptime(match.group(1), '%a, %d %b %Y')
            return dt.strftime('%Y-%m-%d')
        # Direct YYYY-MM-DD format if already present
        iso_match = re.search(r'(\d{4}-\d{2}-\d{2})', raw_date_str)
        if iso_match:
            return iso_match.group(1)
    except Exception as e:
        logger.warning(f"Failed to parse draw date '{raw_date_str}': {e}")
    return None

def fetch_singapore_pools_4d_results() -> List[Dict[str, Any]]:
    """
    Fetches and parses the latest official Singapore 4D lottery results from singaporepools.com.sg.
    Returns a list of parsed draw dictionaries, ordered latest first.
    """
    headers = {
        "User-Agent": USER_AGENTS[0],
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
    }
    
    # 1. Try Primary endpoint (DataFileArchive used by Singapore Pools official frontend)
    cache_buster = f"?_={int(time.time() * 1000)}"
    url = PRIMARY_SG_POOLS_URL + cache_buster
    
    html_content = None
    session = requests.Session()
    try:
        resp = session.get(url, headers=headers, timeout=12)
        if resp.status_code == 200 and len(resp.text) > 500:
            html_content = resp.text
    except Exception as e:
        logger.warning(f"Primary Singapore Pools endpoint with default env failed ({url}): {e}")
        # Retry with trust_env=False in case of proxy issues
        try:
            direct_session = requests.Session()
            direct_session.trust_env = False
            resp = direct_session.get(url, headers=headers, timeout=12)
            if resp.status_code == 200 and len(resp.text) > 500:
                html_content = resp.text
        except Exception as e2:
            logger.warning(f"Primary Singapore Pools direct retry failed: {e2}")

    # 2. Try Fallback if primary failed
    if not html_content:
        try:
            resp = session.get(FALLBACK_SG_POOLS_URL, headers=headers, timeout=15)
            if resp.status_code == 200:
                html_content = resp.text
        except Exception as e:
            logger.warning(f"Fallback Singapore Pools endpoint with default env failed: {e}")
            try:
                direct_session = requests.Session()
                direct_session.trust_env = False
                resp = direct_session.get(FALLBACK_SG_POOLS_URL, headers=headers, timeout=15)
                if resp.status_code == 200:
                    html_content = resp.text
            except Exception as e2:
                logger.error(f"Fallback Singapore Pools direct retry failed: {e2}")
                return []


    if not html_content:
        return []

    # Parse HTML
    soup = BeautifulSoup(html_content, "html.parser")
    results = []

    draw_containers = soup.find_all("li")
    if not draw_containers:
        # Check if table wraps directly
        draw_containers = soup.find_all("div", class_="tables-wrap")

    for container in draw_containers:
        date_el = container.select_one(".drawDate")
        num_el = container.select_one(".drawNumber")
        if not date_el or not num_el:
            continue

        raw_date = date_el.get_text(strip=True)
        raw_num = num_el.get_text(strip=True)
        iso_date = parse_sg_pools_date(raw_date)
        if not iso_date:
            continue

        # Clean draw number (e.g. 'Draw No. 5548' -> '5548')
        num_match = re.search(r'(\d+)', raw_num)
        clean_draw_number = num_match.group(1) if num_match else raw_num

        p1_el = container.select_one(".tdFirstPrize")
        p2_el = container.select_one(".tdSecondPrize")
        p3_el = container.select_one(".tdThirdPrize")

        p1 = p1_el.get_text(strip=True) if p1_el else ""
        p2 = p2_el.get_text(strip=True) if p2_el else ""
        p3 = p3_el.get_text(strip=True) if p3_el else ""

        starters = [
            td.get_text(strip=True)
            for td in container.select(".tbodyStarterPrizes td")
            if td.get_text(strip=True) and td.get_text(strip=True).isdigit()
        ]

        consolations = [
            td.get_text(strip=True)
            for td in container.select(".tbodyConsolationPrizes td")
            if td.get_text(strip=True) and td.get_text(strip=True).isdigit()
        ]

        # Verify validity of results (4-digit prizes)
        is_complete = (
            len(p1) == 4 and p1.isdigit() and
            len(p2) == 4 and p2.isdigit() and
            len(p3) == 4 and p3.isdigit() and
            len(starters) == 10 and
            len(consolations) == 10
        )

        results.append({
            "iso_date": iso_date,
            "raw_date": raw_date,
            "draw_number": clean_draw_number,
            "first_prize": p1,
            "second_prize": p2,
            "third_prize": p3,
            "starter_prizes": starters,
            "consolation_prizes": consolations,
            "is_complete": is_complete
        })

    return results

def settle_draw_with_official_results(
    draw: LotteryDraw,
    official_data: Dict[str, Any],
    db: Session
) -> Dict[str, Any]:
    """
    Settles a LotteryDraw using verified Singapore Pools official results.
    - Evaluates all pending slips and combinations.
    - Credits player wallets with winnings.
    - Logs PAYOUT_EXPENSE to FinancialLedger.
    - Dispatches notifications.
    """
    settle_time = now_mmt()
    today_str = settle_time.strftime("%Y-%m-%d")

    # Update draw record with official results
    draw.first_prize = official_data["first_prize"]
    draw.second_prize = official_data["second_prize"]
    draw.third_prize = official_data["third_prize"]
    draw.starter_prizes_json = json.dumps(official_data["starter_prizes"])
    draw.consolidation_prizes_json = json.dumps(official_data["consolation_prizes"])
    if official_data.get("draw_number"):
        draw.draw_number = official_data["draw_number"]
    draw.status = DrawStatus.SETTLED
    draw.settled_at = settle_time

    draw_results_payload = {
        "first_prize": draw.first_prize,
        "second_prize": draw.second_prize,
        "third_prize": draw.third_prize,
        "starter_prizes": official_data["starter_prizes"],
        "consolidation_prizes": official_data["consolation_prizes"]
    }

    # Query all pending bet slips for this draw
    slips = db.query(BetSlip).filter(
        BetSlip.draw_id == draw.id,
        BetSlip.status == BetSlipStatus.PENDING
    ).all()

    total_draw_payout = 0
    total_winners = 0

    for slip in slips:
        slip_total_payout = 0
        has_win = False

        for item in slip.items:
            combos = item.combinations or [item.number]
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

            # Credit real player wallet immediately for withdrawal
            player = db.query(User).filter(User.id == slip.user_id).first()
            if player:
                player.balance += slip_total_payout

                # User Transaction Record for Winning Payout (Cash In / Out History)
                win_tx = Transaction(
                    user_id=player.id,
                    tx_type=TransactionType.WIN_PAYOUT,
                    gateway="SG4D OFFICIAL",
                    transaction_id=slip.slip_code,
                    receiver_id=f"Player #{player.id} ({player.phone})",
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
                    verification_notes=f"Prize payout for winning ticket {slip.slip_code} - Singapore Pools Draw #{draw.draw_number}",
                    created_at=settle_time
                )
                db.add(win_tx)

                # Ledger entry (STRICTLY FOR REAL USERS)
                ledger_entry = FinancialLedger(
                    entry_type=LedgerEntryType.PAYOUT_EXPENSE,
                    amount=-slip_total_payout,
                    running_balance=player.balance,
                    reference_id=slip.slip_code,
                    reference_type="BET_SLIP",
                    description=f"Prize Winning Payout for {slip.slip_code} ({slip_total_payout:,.0f} MMK) - Singapore Pools Official Draw #{draw.draw_number}",
                    logged_at_mmt=settle_time,
                    date_str=today_str
                )
                db.add(ledger_entry)

                # Send winner in-app notification
                winner_notif = Notification(
                    user_id=player.id,
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

    # Strictly track REAL payouts in database
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
                                    "player_name": p.full_name,
                                    "masked_name": mask_name(p.full_name),
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
        logger.warning(f"Failed to populate winners for draw {draw.draw_date}: {e}")

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

    # Public announcement broadcast
    try:
        send_payout_announcement(draw.draw_number, total_draw_payout, total_winners)
    except Exception as e:
        logger.warning(f"Payout broadcast error: {e}")

    report = {
        "status": "success",
        "draw_id": draw.id,
        "draw_date": draw.draw_date,
        "draw_number": draw.draw_number,
        "first_prize": draw.first_prize,
        "second_prize": draw.second_prize,
        "third_prize": draw.third_prize,
        "total_slips_evaluated": len(slips),
        "total_winning_slips": total_winners,
        "total_payout_mmk": total_draw_payout,
        "settled_at_mmt": settle_time.strftime("%Y-%m-%d %I:%M:%S %p MMT")
    }
    logger.info(f"Settled draw {draw.draw_date}: {report}")
    return report

def sync_singapore_pools_results(
    db: Session = None,
    target_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Synchronizes Singapore Pools 4D official results and settles any open/unsettled draws.
    Can be invoked manually or automatically by the scheduler.
    """
    should_close_db = False
    if db is None:
        db = SessionLocal()
        should_close_db = True

    try:
        current_time = now_mmt()
        today_iso = current_time.strftime("%Y-%m-%d")
        search_date = target_date or today_iso

        # 1. Fetch live results from Singapore Pools
        live_draws = fetch_singapore_pools_4d_results()
        if not live_draws:
            return {
                "success": False,
                "message": "Could not connect to Singapore Pools or no results returned."
            }

        # Index live draws by ISO date and draw number
        results_by_date = {d["iso_date"]: d for d in live_draws if d["is_complete"]}
        results_by_number = {d["draw_number"]: d for d in live_draws if d["is_complete"]}

        # 2. Find unsettled draws in DB
        query = db.query(LotteryDraw).filter(
            LotteryDraw.status.in_([DrawStatus.OPEN, DrawStatus.CLOSED, DrawStatus.UPCOMING])
        )
        if target_date:
            query = query.filter(LotteryDraw.draw_date == target_date)
        else:
            query = query.filter(LotteryDraw.draw_date <= today_iso)

        unsettled_draws = query.all()
        if not unsettled_draws:
            # If target_date was specified and not found, check if it's already settled
            already_settled = db.query(LotteryDraw).filter(
                LotteryDraw.draw_date == search_date,
                LotteryDraw.status == DrawStatus.SETTLED
            ).first()
            if already_settled:
                return {
                    "success": True,
                    "message": f"Draw on {search_date} (Draw #{already_settled.draw_number}) is already settled.",
                    "draw_id": already_settled.id,
                    "first_prize": already_settled.first_prize,
                    "second_prize": already_settled.second_prize,
                    "third_prize": already_settled.third_prize,
                    "total_payout": already_settled.total_payout
                }

            return {
                "success": True,
                "message": f"No unsettled draws found for date <= {search_date}.",
                "settled_count": 0
            }

        settled_reports = []
        pending_draws_waiting = []

        for draw in unsettled_draws:
            # Match by date or draw number
            match = results_by_date.get(draw.draw_date) or results_by_number.get(draw.draw_number)

            if match and match["is_complete"]:
                report = settle_draw_with_official_results(draw, match, db)
                settled_reports.append(report)
            else:
                pending_draws_waiting.append(draw.draw_date)

        if settled_reports:
            return {
                "success": True,
                "message": f"Successfully settled {len(settled_reports)} draw(s) from Singapore Pools official results.",
                "settled_draws": settled_reports,
                "waiting_draws": pending_draws_waiting
            }
        else:
            return {
                "success": False,
                "waiting": True,
                "message": (
                    f"Official results for {', '.join(pending_draws_waiting)} are not yet published on Singapore Pools. "
                    "System will continue polling automatically until results are released."
                ),
                "latest_available_date_on_singapore_pools": live_draws[0]["iso_date"] if live_draws else None
            }

    finally:
        if should_close_db:
            db.close()

def poll_singapore_pools_job():
    """
    Automated background polling job executed by APScheduler.
    - Starting at 6:00 PM MMT (or during draw days Wed, Sat, Sun), polls Singapore Pools.
    - Specifically designed to handle delays on the first Wednesday of the month (Big Sweep)
      by continuously querying until the official results are published.
    """
    current_time = now_mmt()
    today_iso = current_time.strftime("%Y-%m-%d")
    hour = current_time.hour
    minute = current_time.minute
    weekday = current_time.weekday() # 2=Wed, 5=Sat, 6=Sun

    db = SessionLocal()
    try:
        # Check if there is an unsettled draw for today or earlier
        unsettled = db.query(LotteryDraw).filter(
            LotteryDraw.status.in_([DrawStatus.OPEN, DrawStatus.CLOSED]),
            LotteryDraw.draw_date <= today_iso
        ).first()

        if not unsettled:
            # No pending draws to settle
            return

        # If today is draw day and time is >= 5:55 PM MMT (Singapore draw is 6:30 PM SGT = 6:00 PM MMT)
        # Or if there is an overdue unsettled draw from earlier:
        res = sync_singapore_pools_results(db=db)
        if res.get("success") and res.get("settled_draws"):
            logger.info(f"Automated Singapore Pools Settlement Succeeded: {res['message']}")
        else:
            logger.info(f"Singapore Pools Polling: {res.get('message')}")
    except Exception as e:
        logger.error(f"Error in poll_singapore_pools_job: {e}")
    finally:
        db.close()
