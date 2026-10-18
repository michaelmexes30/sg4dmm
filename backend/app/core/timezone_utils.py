from datetime import datetime, timezone, timedelta
import pytz
from typing import Tuple, Optional, List, Dict, Any
from app.config import settings

MMT_TZ = pytz.timezone(settings.TIMEZONE_MMT)

# Common overseas user timezones
SUPPORTED_TIMEZONES = {
    "MMT": pytz.timezone("Asia/Yangon"),      # Myanmar UTC+6:30
    "ICT": pytz.timezone("Asia/Bangkok"),     # Thailand / Vietnam / Cambodia UTC+7:00
    "SGT": pytz.timezone("Asia/Singapore"),   # Singapore / Malaysia UTC+8:00
    "KST": pytz.timezone("Asia/Seoul"),       # South Korea UTC+9:00
    "JST": pytz.timezone("Asia/Tokyo"),       # Japan UTC+9:00
    "UTC": pytz.UTC
}

def now_mmt() -> datetime:
    """Returns current datetime in Myanmar Standard Time (UTC+6:30)."""
    return datetime.now(MMT_TZ)

def now_utc() -> datetime:
    """Returns current datetime in UTC."""
    return datetime.now(timezone.utc)

def convert_to_mmt(dt: datetime, source_tz_name: Optional[str] = None) -> datetime:
    """
    Converts any datetime to Myanmar Standard Time (UTC+6:30).
    If dt is naive and source_tz_name is given, localizes to source first.
    """
    if dt.tzinfo is None:
        if source_tz_name and source_tz_name.upper() in SUPPORTED_TIMEZONES:
            tz = SUPPORTED_TIMEZONES[source_tz_name.upper()]
            dt = tz.localize(dt)
        else:
            # Default naive assumption: already MMT
            dt = MMT_TZ.localize(dt)
    return dt.astimezone(MMT_TZ)

def parse_slip_timestamp(timestamp_str: str, client_tz: Optional[str] = "MMT") -> datetime:
    """
    Parses various timestamp formats from payment receipts (KPay, WavePay, AYA Pay)
    e.g., '2026-10-13 11:15:00', '13/10/2026 11:15', '2026-10-13T11:15:00Z'
    and normalizes into MMT.
    """
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%d-%m-%Y %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%SZ",
        "%I:%M %p %d/%m/%Y",
        "%d %b %Y %H:%M:%S"
    ]
    cleaned = timestamp_str.strip()
    dt = None
    for fmt in formats:
        try:
            dt = datetime.strptime(cleaned, fmt)
            break
        except ValueError:
            continue
            
    if dt is None:
        return now_mmt()
        
    return convert_to_mmt(dt, source_tz_name=client_tz)

def validate_15min_window(
    tx_time_mmt: datetime, 
    submission_time_mmt: Optional[datetime] = None
) -> Tuple[bool, float, str]:
    """
    Validates whether the transaction timestamp is within the 15-minute window.
    """
    if submission_time_mmt is None:
        submission_time_mmt = now_mmt()
        
    tx_mmt = convert_to_mmt(tx_time_mmt)
    sub_mmt = convert_to_mmt(submission_time_mmt)
    
    delta_seconds = (sub_mmt - tx_mmt).total_seconds()
    delta_minutes = delta_seconds / 60.0
    
    if delta_seconds < -120:
        return (
            False, 
            delta_minutes, 
            f"Future timestamp detected ({abs(delta_minutes):.1f} mins in future). Flagged for review."
        )
        
    max_seconds = settings.PAYMENT_EXPIRY_MINUTES * 60
    if delta_seconds > max_seconds:
        return (
            False,
            delta_minutes,
            f"Transaction is older than {settings.PAYMENT_EXPIRY_MINUTES} minutes ({delta_minutes:.1f} mins ago). Auto-rejected as expired."
        )
        
    return (
        True,
        delta_minutes,
        f"Timestamp verified within window ({delta_minutes:.1f} mins ago)."
    )

def is_within_gateway_operating_hours(dt: Optional[datetime] = None) -> Tuple[bool, str]:
    """
    Verifies if current time is within payment channel operating hours:
    8:00 AM to 8:00 PM MMT (08:00 - 20:00).
    """
    current = convert_to_mmt(dt or now_mmt())
    hour = current.hour
    
    if hour < settings.GATEWAY_OPERATING_START_HOUR or hour >= settings.GATEWAY_OPERATING_END_HOUR:
        return (
            False,
            f"Payment channels operate from 8:00 AM to 8:00 PM MMT. Current time: {current.strftime('%I:%M %p MMT')}."
        )
    return True, "Within operating hours."

def parse_time_string(time_str: Optional[str], default_hour: int = 16, default_minute: int = 30) -> Tuple[int, int]:
    """
    Parses time string like '16:30', '17:00', '04:30 PM', '4:30 PM' into (hour, minute).
    """
    if not time_str:
        return default_hour, default_minute
    cleaned = str(time_str).strip()
    try:
        parts = cleaned.split(":")
        if len(parts) >= 2:
            h = int(parts[0])
            m = int(parts[1].split()[0])
            if "PM" in cleaned.upper() and h < 12:
                h += 12
            elif "AM" in cleaned.upper() and h == 12:
                h = 0
            return h, m
    except Exception:
        pass
    for fmt in ["%H:%M", "%I:%M %p", "%I:%M%p"]:
        try:
            t = datetime.strptime(cleaned, fmt)
            return t.hour, t.minute
        except Exception:
            continue
    return default_hour, default_minute

def is_past_betting_cutoff(
    draw_date_str: str, 
    dt: Optional[datetime] = None, 
    cutoff_time_str: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Validates cutoff on Draw Days (Wed, Sat, Sun).
    If current time on the draw day is after cutoff time (default 16:30 MMT), bets are strictly rejected.
    """
    current = convert_to_mmt(dt or now_mmt())
    today_str = current.strftime("%Y-%m-%d")
    
    cut_h, cut_m = parse_time_string(cutoff_time_str, settings.DRAW_CUTOFF_HOUR, settings.DRAW_CUTOFF_MINUTE)

    # Check if the draw is for today
    if draw_date_str == today_str:
        cutoff_time = current.replace(
            hour=cut_h,
            minute=cut_m,
            second=0,
            microsecond=0
        )
        if current > cutoff_time:
            display_cutoff = cutoff_time.strftime("%I:%M %p MMT")
            return (
                True,
                f"Betting strictly closed at {display_cutoff} for today's draw. Current time: {current.strftime('%I:%M %p MMT')}."
            )
            
    # Also check if draw_date has already passed
    if draw_date_str < today_str:
        return (
            True,
            f"Selected draw date ({draw_date_str}) is in the past."
        )

    return False, "Betting is open."

def get_previous_calendar_week_dates(ref_dt: Optional[datetime] = None) -> Tuple[str, str, str]:
    """
    Returns (prev_monday_str, prev_sunday_str, settle_monday_str)
    e.g., if today is Monday Oct 12, returns Monday Oct 5 to Sunday Oct 11.
    """
    current = convert_to_mmt(ref_dt or now_mmt())
    # Days since this week's Monday (Monday is weekday 0)
    current_monday = current - timedelta(days=current.weekday())
    prev_monday = current_monday - timedelta(days=7)
    prev_sunday = current_monday - timedelta(days=1)
    
    return (
        prev_monday.strftime("%Y-%m-%d"),
        prev_sunday.strftime("%Y-%m-%d"),
        current_monday.strftime("%Y-%m-%d")
    )

def get_tuesday_settlement_dates(ref_dt: Optional[datetime] = None) -> Tuple[str, str, str]:
    """
    Returns (prev_monday_str, prev_sunday_str, settle_tuesday_str)
    For Tuesday 11:00 AM Settlement:
    Previous week: Monday to Sunday of previous calendar week.
    Settlement Tuesday: current week's Tuesday.
    """
    current = convert_to_mmt(ref_dt or now_mmt())
    current_monday = current - timedelta(days=current.weekday())
    prev_monday = current_monday - timedelta(days=7)
    prev_sunday = current_monday - timedelta(days=1)
    current_tuesday = current_monday + timedelta(days=1)
    
    return (
        prev_monday.strftime("%Y-%m-%d"),
        prev_sunday.strftime("%Y-%m-%d"),
        current_tuesday.strftime("%Y-%m-%d")
    )

def get_upcoming_week_draws(
    ref_dt: Optional[datetime] = None,
    cutoff_time_str: Optional[str] = None,
    result_time_str: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Returns the draw days for the CURRENT calendar week (Wed, Sat, Sun).
    Draws close strictly at cutoff time (default 4:30 PM MMT).
    Rule:
    - Only draws of the current week can be placed.
    - If a draw day has passed or is past cutoff time (e.g. Wednesday 4:30 PM+),
      that day disappears and only remaining upcoming draws (e.g. Sat, Sun) are returned!
    """
    current = convert_to_mmt(ref_dt or now_mmt())
    current_monday = current.date() - timedelta(days=current.weekday())
    
    # Draw day offsets from Monday: Wed=2, Sat=5, Sun=6
    draw_schedule = [
        {"day_name": "Wednesday", "day_short": "Wed", "offset": 2},
        {"day_name": "Saturday", "day_short": "Sat", "offset": 5},
        {"day_name": "Sunday", "day_short": "Sun", "offset": 6},
    ]

    cut_h, cut_m = parse_time_string(cutoff_time_str, settings.DRAW_CUTOFF_HOUR, settings.DRAW_CUTOFF_MINUTE)
    res_h, res_m = parse_time_string(result_time_str, settings.DRAW_RESULT_SETTLE_HOUR, 0)
    
    cutoff_display = f"{cut_h % 12 or 12:02d}:{cut_m:02d} {'PM' if cut_h >= 12 else 'AM'} MMT"
    result_display_prefix = f"{res_h % 12 or 12:02d}:{res_m:02d} {'PM' if res_h >= 12 else 'AM'} MMT"

    available_draws = []
    today_date = current.date()
    cutoff_time_today = current.replace(
        hour=cut_h,
        minute=cut_m,
        second=0,
        microsecond=0
    )

    for item in draw_schedule:
        draw_date = current_monday + timedelta(days=item["offset"])
        draw_date_str = draw_date.strftime("%Y-%m-%d")

        # 1. Past date -> skip (disappears)
        if draw_date < today_date:
            continue

        # 2. Today is the draw day, but past cutoff -> skip (disappears)
        if draw_date == today_date and current > cutoff_time_today:
            continue

        available_draws.append({
            "day_name": item["day_name"],
            "day_short": item["day_short"],
            "draw_date": draw_date_str,
            "cutoff_time": cutoff_display,
            "draw_time_mmt": f"{result_display_prefix} (Singapore 4D {item['day_short']})",
            "is_today": (draw_date == today_date)
        })

    # If all draws in the current week have passed (e.g. Sunday evening past cutoff),
    # automatically roll over to the next week's Wed, Sat, Sun draws!
    if not available_draws:
        next_monday = current_monday + timedelta(days=7)
        for item in draw_schedule:
            draw_date = next_monday + timedelta(days=item["offset"])
            draw_date_str = draw_date.strftime("%Y-%m-%d")
            available_draws.append({
                "day_name": item["day_name"],
                "day_short": item["day_short"],
                "draw_date": draw_date_str,
                "cutoff_time": cutoff_display,
                "draw_time_mmt": f"{result_display_prefix} (Singapore 4D {item['day_short']})",
                "is_today": False
            })

    return available_draws


def format_mmt(dt: datetime, include_tz: bool = True) -> str:
    """Formats datetime in human readable MMT string."""
    mmt = convert_to_mmt(dt)
    base = mmt.strftime("%Y-%m-%d %I:%M:%S %p")
    return f"{base} MMT (UTC+6:30)" if include_tz else base

