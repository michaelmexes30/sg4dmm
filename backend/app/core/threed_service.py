import re
import json
import logging
import requests
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.lottery import ThreeDDraw
from app.models.bet import BetSlip, BetSlipStatus
from app.models.user import User, Notification
from app.models.settings import SystemSetting
from app.models.transaction import Transaction, TransactionType, TransactionStatus
from app.models.ledger import FinancialLedger, LedgerEntryType
from app.core.timezone_utils import now_mmt

logger = logging.getLogger("threed_service")
logger.setLevel(logging.INFO)

SANOOK_LOTTO_URL = "https://news.sanook.com/lotto/"
MTHAI_LOTTO_URL = "https://lotto.mthai.com"

THAI_MONTHS = {
    'มกราคม': '01', 'กุมภาพันธ์': '02', 'มีนาคม': '03', 'เมษายน': '04',
    'พฤษภาคม': '05', 'มิถุนายน': '06', 'กรกฎาคม': '07', 'สิงหาคม': '08',
    'กันยายน': '09', 'ตุลาคม': '10', 'พฤศจิกายน': '11', 'ธันวาคม': '12'
}

def get_next_threed_draw_date(current_date_str: str) -> str:
    """Calculates next 1st or 16th draw date."""
    dt = datetime.strptime(current_date_str, "%Y-%m-%d").date()
    if dt.day < 16:
        next_dt = dt.replace(day=16)
    else:
        year = dt.year + (1 if dt.month == 12 else 0)
        month = 1 if dt.month == 12 else dt.month + 1
        next_dt = dt.replace(year=year, month=month, day=1)
    return next_dt.strftime("%Y-%m-%d")

def fetch_live_threed_from_sanook() -> List[Dict[str, Any]]:
    """
    Scrapes official Thai Government Lottery results from Sanook Lotto.
    Extracts 6-digit First Prize (รางวัลที่ 1) and the last 3 digits for Myanmar 3D.
    """
    results = []
    try:
        from bs4 import BeautifulSoup
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'th,en-US;q=0.9,en;q=0.8'
        }
        resp = requests.get(SANOOK_LOTTO_URL, headers=headers, timeout=10)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, 'html.parser')
            articles = soup.find_all('article')
            for art in articles:
                text = art.get_text(' | ', strip=True)
                match = re.search(r'(\d{1,2})\s+([^\s\d]+)\s+(\d{4}).*?รางวัลที่\s*1\s*\|\s*(\d{6})', text)
                if match:
                    day, month_str, year_be, first_prize = match.groups()
                    month = THAI_MONTHS.get(month_str.strip())
                    if month:
                        year_ad = int(year_be) - 543
                        iso_date = f"{year_ad}-{month}-{int(day):02d}"
                        last3 = first_prize[-3:]
                        results.append({
                            "draw_date": iso_date,
                            "thai_first_prize": first_prize,
                            "winning_number": last3,
                            "source": "Sanook (Official GLO Feed)"
                        })
            logger.info(f"Fetched {len(results)} Thai 3D results from Sanook.")
    except Exception as e:
        logger.warning(f"Error fetching 3D from Sanook: {e}")
    return results

def fetch_live_threed_from_mthai() -> List[Dict[str, Any]]:
    """Fallback scraper from MThai lotto."""
    results = []
    try:
        from bs4 import BeautifulSoup
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        resp = requests.get(MTHAI_LOTTO_URL, headers=headers, timeout=10)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, 'html.parser')
            text = soup.get_text(' | ', strip=True)
            match = re.search(r'รางวัลที่\s*1.*?(\d{6})', text)
            if match:
                first_prize = match.group(1)
                last3 = first_prize[-3:]
                # Match date
                date_match = re.search(r'(\d{1,2})\s+([^\s\d]+)\s+(\d{4})', text)
                if date_match:
                    day, month_str, year_be = date_match.groups()
                    month = THAI_MONTHS.get(month_str.strip())
                    if month:
                        year_ad = int(year_be) - 543
                        iso_date = f"{year_ad}-{month}-{int(day):02d}"
                        results.append({
                            "draw_date": iso_date,
                            "thai_first_prize": first_prize,
                            "winning_number": last3,
                            "source": "MThai (Fallback Feed)"
                        })
    except Exception as e:
        logger.warning(f"Error fetching 3D from MThai: {e}")
    return results

def get_latest_threed_results() -> List[Dict[str, Any]]:
    """Tries Sanook first, then MThai fallback."""
    res = fetch_live_threed_from_sanook()
    if res:
        return res
    return fetch_live_threed_from_mthai()

def settle_threed_draw_internal(
    db: Session,
    draw: ThreeDDraw,
    winning_number: str,
    thai_first_prize: Optional[str] = None
) -> Dict[str, Any]:
    """
    Core engine that settles a 3D draw:
    1. Sets winning number, Thai 1st Prize, and marks draw as SETTLED.
    2. Evaluates all pending 3D slips for this draw.
    3. Calculates payouts (stake * straight_payout).
    4. Automatically credits winners' balances, generates WIN_PAYOUT transactions,
       creates FinancialLedger payout records, and delivers in-app victory notifications.
    5. Marks losing slips as LOST.
    6. Automatically schedules/ensures the next upcoming 3D draw is created.
    7. Commits cleanly and returns a summary dict.
    """
    clean_win = str(winning_number).strip().zfill(3)
    if not clean_win.isdigit() or len(clean_win) != 3:
        raise ValueError(f"Invalid 3D winning number: {winning_number}")

    setting = db.query(SystemSetting).first()
    straight_payout = float(getattr(setting, "threed_straight_payout", 700.0) or 700.0)

    draw.winning_number = clean_win
    if thai_first_prize:
        draw.thai_first_prize = str(thai_first_prize).strip()
    draw.status = "SETTLED"
    draw.settled_at = now_mmt()

    slips = db.query(BetSlip).filter(
        BetSlip.game_type == "3D",
        BetSlip.draw_id == draw.id,
        BetSlip.status == BetSlipStatus.PENDING
    ).all()

    total_payout = 0.0
    total_staked = 0.0
    winners_count = 0
    today_str = now_mmt().strftime("%Y-%m-%d")

    for slip in slips:
        slip_payout = 0.0
        has_win = False
        total_staked += float(slip.total_stake or 0.0)

        for item in slip.items:
            clean_item_num = str(item.number).strip().zfill(3)
            combos = []
            try:
                combos = json.loads(item.combinations_json) if item.combinations_json else [clean_item_num]
            except Exception:
                combos = [clean_item_num]

            if clean_win in combos:
                item_win = float(item.big_amount or item.item_stake or 0.0) * straight_payout
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
            slip.settled_at = now_mmt()

            player = db.query(User).filter(User.id == slip.user_id).first()
            if player:
                player.balance = float(player.balance or 0.0) + slip_payout

                win_tx = Transaction(
                    user_id=player.id,
                    tx_type=TransactionType.WIN_PAYOUT,
                    gateway="SG4D 3D",
                    transaction_id=slip.slip_code,
                    receiver_id=f"Player #{player.id} ({player.phone})",
                    amount=slip_payout,
                    slip_image_url=None,
                    client_timezone="MMT",
                    tx_timestamp_mmt=now_mmt(),
                    submission_timestamp_mmt=now_mmt(),
                    delta_minutes=0.0,
                    is_time_valid=True,
                    is_receiver_valid=True,
                    is_tx_unique=True,
                    status=TransactionStatus.COMPLETED,
                    verification_notes=f"3D Prize payout for ticket {slip.slip_code} ({clean_win}) - Draw {draw.draw_date}",
                    created_at=now_mmt()
                )
                db.add(win_tx)

                win_ledger = FinancialLedger(
                    entry_type=LedgerEntryType.PAYOUT_EXPENSE,
                    amount=slip_payout,
                    running_balance=player.balance,
                    reference_id=slip.slip_code,
                    reference_type="BET_SLIP_3D_WIN",
                    description=f"3D အနိုင်ရငွေ ({clean_win}) - Draw {draw.draw_date}",
                    logged_at_mmt=now_mmt(),
                    date_str=today_str
                )
                db.add(win_ledger)

                notif = Notification(
                    user_id=player.id,
                    title="🎉 ဂုဏ်ယူပါသည်! 3D ထီပေါက်ပါသည်",
                    message=f"သင်ထိုးထားသော 3D ဂဏန်း '{clean_win}' သည် {draw.draw_date} ပွဲစဉ်တွင် ပေါက်ပြီး အနိုင်ရငွေ +{slip_payout:,.0f} ကျပ် အား လက်ကျန်ငွေထဲ ထည့်သွင်းပေးပြီးပါပြီ။",
                    notif_type="LOTTERY_WIN",
                    is_read=False
                )
                db.add(notif)
        else:
            slip.status = BetSlipStatus.LOST
            slip.total_payout = 0.0
            slip.settled_at = now_mmt()

    draw.total_staked = float(draw.total_staked or 0.0) + total_staked
    draw.total_payout = float(draw.total_payout or 0.0) + total_payout

    # Auto create next upcoming draw if no other OPEN draw exists
    next_open = db.query(ThreeDDraw).filter(ThreeDDraw.status == "OPEN").first()
    if not next_open:
        next_date = get_next_threed_draw_date(draw.draw_date)
        next_draw = ThreeDDraw(
            draw_date=next_date,
            draw_time_mmt="03:30 PM MMT",
            cutoff_time_mmt="02:30 PM MMT",
            status="OPEN"
        )
        db.add(next_draw)
        logger.info(f"Auto-generated next upcoming 3D draw: {next_date}")

    db.commit()

    logger.info(f"Settled 3D Draw #{draw.id} ({draw.draw_date}) -> Winning #{clean_win}. Slips: {len(slips)}, Winners: {winners_count}, Payout: {total_payout:,.0f} MMK")
    return {
        "status": "success",
        "draw_id": draw.id,
        "draw_date": draw.draw_date,
        "winning_number": clean_win,
        "thai_first_prize": draw.thai_first_prize,
        "total_slips": len(slips),
        "winners_count": winners_count,
        "total_payout": total_payout
    }

def poll_and_settle_3d_job():
    """
    Automated background polling and settlement job executed by APScheduler.
    - Runs around 03:30 PM MMT - 05:00 PM MMT on 1st & 16th of each month.
    - Checks for any OPEN 3D draws whose draw date has arrived/passed.
    - Fetches the result from Sanook / MThai live Thai Lottery scraper.
    - Completely settles win/loss, balances, transactions, and notifications.
    """
    logger.info("Executing automated 3D background polling job...")
    db = SessionLocal()
    try:
        open_draws = db.query(ThreeDDraw).filter(ThreeDDraw.status == "OPEN").order_by(ThreeDDraw.draw_date.asc()).all()
        if not open_draws:
            logger.info("No OPEN 3D draws found for settlement.")
            return {"status": "skipped", "message": "No OPEN 3D draws"}

        current_time = now_mmt()
        today_date_str = current_time.strftime("%Y-%m-%d")

        # Fetch live lottery results
        scraped_results = get_latest_threed_results()
        if not scraped_results:
            logger.warning("No 3D results fetched from online sources.")
            return {"status": "warning", "message": "No live results available"}

        results_by_date = {r["draw_date"]: r for r in scraped_results}

        settled_count = 0
        details = []

        for draw in open_draws:
            # Check if this draw date is in scraped results
            res = results_by_date.get(draw.draw_date)
            if res and res.get("winning_number") and len(res["winning_number"]) == 3:
                # Settle draw
                settle_res = settle_threed_draw_internal(
                    db=db,
                    draw=draw,
                    winning_number=res["winning_number"],
                    thai_first_prize=res.get("thai_first_prize")
                )
                settled_count += 1
                details.append(settle_res)
                logger.info(f"Auto-settled 3D draw {draw.draw_date} with winning number {res['winning_number']} (1st Prize: {res.get('thai_first_prize')})")

        return {
            "status": "success",
            "settled_count": settled_count,
            "details": details
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error in poll_and_settle_3d_job: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}
    finally:
        db.close()
