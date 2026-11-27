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
from app.models.ledger import FinancialLedger, LedgerEntryType, DailyLedgerSummary
from app.core.timezone_utils import now_mmt

logger = logging.getLogger("threed_service")
logger.setLevel(logging.INFO)

SANOOK_LOTTO_URL = "https://news.sanook.com/lotto/"
MTHAI_LOTTO_URL = "https://lotto.mthai.com"
GLO_OFFICIAL_URL = "https://www.glo.or.th/home-page"
GLO_REWARD_NEWS_URL = "https://www.glo.or.th/mission/reward-news"

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

def _extract_thai_date_and_prize_from_text(clean_text: str) -> Optional[Dict[str, str]]:
    """
    Safely pairs Thai draw date and 6-digit 1st Prize (รางวัลที่ 1) only when they appear
    within a tight 300-character proximity window on visible DOM text (prevents mismatched dates/prizes).
    """
    prize_match = re.search(r'รางวัลที่\s*1[^\d]{0,80}(\d{6})', clean_text)
    if not prize_match:
        return None
    first_prize = prize_match.group(1)
    start_idx = max(0, prize_match.start() - 300)
    end_idx = min(len(clean_text), prize_match.end() + 200)
    window = clean_text[start_idx:end_idx]

    date_match = re.search(r'(\d{1,2})\s+([^\s\d|]+)\s+(256\d|257\d|202\d|203\d)', window)
    if not date_match:
        return None
    day, month_str, year_val = date_match.groups()
    month = THAI_MONTHS.get(month_str.strip())
    if not month:
        return None
    year_ad = int(year_val) - 543 if int(year_val) > 2400 else int(year_val)
    return {
        "draw_date": f"{year_ad}-{month}-{int(day):02d}",
        "thai_first_prize": first_prize,
        "winning_number": first_prize[-3:],
    }


def fetch_live_threed_from_mthai() -> List[Dict[str, Any]]:
    """Fallback scraper from MThai lotto using stripped visible DOM text & proximity pairing."""
    results = []
    try:
        from bs4 import BeautifulSoup
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        resp = requests.get(MTHAI_LOTTO_URL, headers=headers, timeout=10)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, 'html.parser')
            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()
            text = soup.get_text(' | ', strip=True)
            parsed = _extract_thai_date_and_prize_from_text(text)
            if parsed:
                parsed["source"] = "MThai (Fallback Feed)"
                results.append(parsed)
    except Exception as e:
        logger.warning(f"Error fetching 3D from MThai: {e}")
    return results

def fetch_live_threed_from_glo() -> List[Dict[str, Any]]:
    """
    Attempts to scrape official results directly from The Government Lottery Office (GLO) of Thailand
    using BeautifulSoup visible DOM text & proximity pairing (never raw HTML re.DOTALL).
    """
    results = []
    try:
        from bs4 import BeautifulSoup
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': 'https://www.glo.or.th/'
        }
        for target_url in [GLO_OFFICIAL_URL, GLO_REWARD_NEWS_URL]:
            try:
                resp = requests.get(target_url, headers=headers, timeout=6)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, 'html.parser')
                    for tag in soup(["script", "style", "noscript"]):
                        tag.decompose()
                    text = soup.get_text(' | ', strip=True)
                    parsed = _extract_thai_date_and_prize_from_text(text)
                    if parsed:
                        parsed["source"] = "GLO (Official Government Portal)"
                        results.append(parsed)
                        break
            except Exception:
                continue
        if results:
            logger.info(f"Successfully fetched {len(results)} Thai 3D results directly from GLO.")
    except Exception as e:
        logger.warning(f"Notice fetching 3D from GLO official: {e}")
    return results

def get_latest_threed_results() -> List[Dict[str, Any]]:
    """
    Multi-source failover scraper:
    1. GLO Official Portal (https://www.glo.or.th)
    2. MThai High-Speed Flash Ticker (https://lotto.mthai.com)
    3. Sanook GLO Syndicated Media Feed (https://news.sanook.com/lotto/)
    Merges all feeds so if any server fails or is 503-overloaded, the system never stalls.
    """
    results_map: Dict[str, Dict[str, Any]] = {}

    # Source 1: GLO Official Portal
    try:
        glo_res = fetch_live_threed_from_glo()
        for r in glo_res:
            if r.get("draw_date"):
                results_map[r["draw_date"]] = r
    except Exception as e:
        logger.warning(f"Notice fetching from GLO: {e}")

    # Source 2: MThai Real-Time Ticker (fastest on draw moments)
    try:
        mthai_res = fetch_live_threed_from_mthai()
        for r in mthai_res:
            d_date = r.get("draw_date")
            if d_date:
                if d_date not in results_map or not results_map[d_date].get("winning_number"):
                    results_map[d_date] = r
                else:
                    results_map[d_date]["thai_first_prize"] = r.get("thai_first_prize") or results_map[d_date].get("thai_first_prize")
                    results_map[d_date]["winning_number"] = r.get("winning_number") or results_map[d_date].get("winning_number")
    except Exception as e:
        logger.warning(f"Error fetching from MThai: {e}")

    # Source 3: Sanook GLO Syndicated Archive
    try:
        sanook_res = fetch_live_threed_from_sanook()
        for r in sanook_res:
            d_date = r.get("draw_date")
            if d_date and (d_date not in results_map or not results_map[d_date].get("winning_number")):
                results_map[d_date] = r
    except Exception as e:
        logger.warning(f"Error fetching from Sanook: {e}")

    # Return all merged results sorted by date descending (newest first)
    merged = sorted(results_map.values(), key=lambda x: x.get("draw_date", ""), reverse=True)
    return merged

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

    # Lock draw row to guarantee strict idempotent settlement
    locked_draw = db.query(ThreeDDraw).filter(ThreeDDraw.id == draw.id).with_for_update().first()
    if not locked_draw or locked_draw.status == "SETTLED":
        logger.info(f"3D Draw #{draw.id} is already settled; skipping duplicate settlement.")
        return {
            "status": "already_settled",
            "draw_id": draw.id,
            "draw_date": draw.draw_date,
            "winning_number": locked_draw.winning_number if locked_draw else clean_win,
            "thai_first_prize": locked_draw.thai_first_prize if locked_draw else thai_first_prize,
            "total_slips": 0,
            "winners_count": 0,
            "total_payout": 0.0
        }
    draw = locked_draw

    setting = db.query(SystemSetting).first()
    straight_payout = float(getattr(setting, "threed_straight_payout", 700.0) or 700.0)

    settle_time = now_mmt()
    draw.winning_number = clean_win
    if thai_first_prize:
        draw.thai_first_prize = str(thai_first_prize).strip()
    draw.status = "SETTLED"
    draw.settled_at = settle_time

    slips = db.query(BetSlip).filter(
        BetSlip.game_type == "3D",
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
            clean_item_num = str(item.number).strip().zfill(3)
            combos = []
            try:
                combos = json.loads(item.combinations_json) if item.combinations_json else [clean_item_num]
            except Exception:
                combos = [clean_item_num]

            combo_count = max(1, len(combos))
            btype = (item.bet_type or "STRAIGHT").upper()
            if btype in ["R", "BOX"]:
                unit_stake = float(item.big_amount or 0.0)
                if unit_stake <= 0:
                    unit_stake = float(item.item_stake or 0.0) / combo_count
            else:
                unit_stake = float(item.big_amount or item.item_stake or 0.0)

            if clean_win in combos:
                item_win = unit_stake * straight_payout
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
                    gateway="SG4D 3D",
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
                    verification_notes=f"3D Prize payout for ticket {slip.slip_code} ({clean_win}) - Draw {draw.draw_date}",
                    created_at=settle_time
                )
                db.add(win_tx)

                # Unified negative sign for PAYOUT_EXPENSE across all games
                win_ledger = FinancialLedger(
                    entry_type=LedgerEntryType.PAYOUT_EXPENSE,
                    amount=-slip_payout,
                    running_balance=player.balance,
                    reference_id=slip.slip_code,
                    reference_type="BET_SLIP_3D_WIN",
                    description=f"3D အနိုင်ရငွေ ({clean_win}) - Draw {draw.draw_date}",
                    logged_at_mmt=settle_time,
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
            slip.settled_at = settle_time

    from sqlalchemy import func
    exact_staked = db.query(func.coalesce(func.sum(BetSlip.total_stake), 0.0)).filter(
        BetSlip.game_type == "3D",
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

    # Auto create next upcoming draw if no other OPEN draw exists (and not already in DB)
    next_open = db.query(ThreeDDraw).filter(ThreeDDraw.status == "OPEN").first()
    if not next_open:
        next_date = get_next_threed_draw_date(draw.draw_date)
        existing_next = db.query(ThreeDDraw).filter(ThreeDDraw.draw_date == next_date).first()
        if not existing_next:
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
    current_time = now_mmt()
    db = SessionLocal()
    try:
        # Fetch live lottery results first
        scraped_results = get_latest_threed_results()
        if not scraped_results:
            logger.warning("No 3D results fetched from online sources.")
            return {"status": "warning", "message": "No live results available"}

        results_by_date = {r["draw_date"]: r for r in scraped_results}

        # Pending draws include both OPEN and CLOSED (since cutoff at 2:30 PM marks them CLOSED before 3:30 PM draw)
        pending_draws = db.query(ThreeDDraw).filter(
            ThreeDDraw.status.in_(["OPEN", "CLOSED"])
        ).order_by(ThreeDDraw.draw_date.asc()).all()

        settled_count = 0
        details = []

        # 1. Settle any existing pending draws in DB
        for draw in pending_draws:
            res = results_by_date.get(draw.draw_date)
            if res and res.get("winning_number") and len(res["winning_number"]) == 3:
                settle_res = settle_threed_draw_internal(
                    db=db,
                    draw=draw,
                    winning_number=res["winning_number"],
                    thai_first_prize=res.get("thai_first_prize")
                )
                settled_count += 1
                details.append(settle_res)
                logger.info(f"Auto-settled 3D draw {draw.draw_date} with winning number {res['winning_number']} (1st Prize: {res.get('thai_first_prize')})")

        # Rush-window high frequency retry (03:28 PM - 03:35 PM MMT on 1st & 16th)
        if settled_count == 0 and pending_draws and current_time.hour == 15 and (28 <= current_time.minute <= 35):
            import time
            for attempt in range(2):
                time.sleep(10)
                retry_results = get_latest_threed_results()
                retry_map = {r["draw_date"]: r for r in retry_results}
                for draw in pending_draws:
                    r_res = retry_map.get(draw.draw_date)
                    if r_res and r_res.get("winning_number") and len(r_res["winning_number"]) == 3:
                        settle_res = settle_threed_draw_internal(
                            db=db,
                            draw=draw,
                            winning_number=r_res["winning_number"],
                            thai_first_prize=r_res.get("thai_first_prize")
                        )
                        settled_count += 1
                        details.append(settle_res)
                        logger.info(f"Rush-window auto-settled 3D draw {draw.draw_date}: {r_res['winning_number']}")
                        break
                if settled_count > 0:
                    break

        # 2. Check if recent scraped results exist that aren't yet in DB at all (e.g. past draws after database init)
        existing_dates = {d[0] for d in db.query(ThreeDDraw.draw_date).all()}
        for r in scraped_results:
            d_date = r.get("draw_date")
            if d_date and d_date not in existing_dates and r.get("winning_number"):
                new_draw = ThreeDDraw(
                    draw_date=d_date,
                    draw_time_mmt="03:30 PM MMT",
                    cutoff_time_mmt="02:30 PM MMT",
                    status="CLOSED"
                )
                db.add(new_draw)
                db.flush()
                settle_res = settle_threed_draw_internal(
                    db=db,
                    draw=new_draw,
                    winning_number=r["winning_number"],
                    thai_first_prize=r.get("thai_first_prize")
                )
                settled_count += 1
                details.append(settle_res)
                logger.info(f"Auto-created and settled past 3D draw {d_date} with winning number {r['winning_number']}")

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
