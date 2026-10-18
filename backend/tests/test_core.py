import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
import pytz
from app.config import settings
from app.core.timezone_utils import (
    now_mmt,
    convert_to_mmt,
    parse_slip_timestamp,
    validate_15min_window,
    is_within_gateway_operating_hours,
    is_past_betting_cutoff,
    get_previous_calendar_week_dates,
    SUPPORTED_TIMEZONES
)
from app.core.bet_calculator import (
    generate_combinations,
    calculate_stake,
    evaluate_bet_winnings,
    validate_4d_number,
    validate_bet_amount
)
from app.database import SessionLocal, Base, engine
from app.seeds.seed_data import seed_database
from app.models.user import User, UserRole
from app.models.bet import BetSlip, BetSlipStatus
from app.models.lottery import LotteryDraw, DrawStatus
from app.core.bonus_engine import calculate_and_distribute_weekly_bonus

def test_timezone_and_15min_expiry():
    mmt_now = now_mmt()

    # 1. Transfer within 5 minutes (Valid)
    valid_tx = mmt_now - timedelta(minutes=5)
    is_valid, delta, msg = validate_15min_window(valid_tx, mmt_now)
    assert is_valid is True
    assert 4.9 <= delta <= 5.1
    print("Test 1 Passed: 5-minute transaction validated successfully.")

    # 2. Transfer older than 15 minutes (Expired)
    expired_tx = mmt_now - timedelta(minutes=16)
    is_valid, delta, msg = validate_15min_window(expired_tx, mmt_now)
    assert is_valid is False
    assert delta >= 15.0
    print("Test 2 Passed: 16-minute transaction correctly expired.")

    # 3. Singapore (SGT UTC+8:00) to MMT (UTC+6:30) conversion
    sg_time_str = "2026-10-13 18:30:00"
    converted_mmt = parse_slip_timestamp(sg_time_str, client_tz="SGT")
    assert converted_mmt.hour == 17
    assert converted_mmt.minute == 0
    print("Test 3 Passed: Singapore UTC+8 to Myanmar MMT UTC+6:30 correctly converted.")

    # 4. Thailand (ICT UTC+7:00) to MMT (UTC+6:30) conversion
    bkk_time_str = "2026-10-13 12:00:00"
    converted_bkk_mmt = parse_slip_timestamp(bkk_time_str, client_tz="ICT")
    assert converted_bkk_mmt.hour == 11
    assert converted_bkk_mmt.minute == 30
    print("Test 4 Passed: Thailand ICT UTC+7 to Myanmar MMT UTC+6:30 correctly converted.")

def test_operating_hours_and_cutoff():
    # Operating Hours: 8:00 AM to 8:00 PM MMT
    morning_ok = datetime(2026, 10, 14, 9, 30, tzinfo=pytz.timezone("Asia/Yangon"))
    is_open, msg = is_within_gateway_operating_hours(morning_ok)
    assert is_open is True

    night_closed = datetime(2026, 10, 14, 21, 30, tzinfo=pytz.timezone("Asia/Yangon"))
    is_open_night, msg = is_within_gateway_operating_hours(night_closed)
    assert is_open_night is False
    print("Test 5 Passed: 8:00 AM to 8:00 PM MMT Gateway operating hours enforced.")

    # Draw Cut-off Time: 4:30 PM (16:30 MMT) on Draw Day
    before_cutoff = datetime(2026, 10, 14, 16, 20, tzinfo=pytz.timezone("Asia/Yangon"))
    is_cutoff_pre, _ = is_past_betting_cutoff("2026-10-14", before_cutoff)
    assert is_cutoff_pre is False

    after_cutoff = datetime(2026, 10, 14, 16, 31, tzinfo=pytz.timezone("Asia/Yangon"))
    is_cutoff_post, cutoff_msg = is_past_betting_cutoff("2026-10-14", after_cutoff)
    assert is_cutoff_post is True
    print("Test 6 Passed: 4:30 PM MMT Draw Day Cut-off strictly enforced.")

def test_betting_limits_and_multipliers():
    # Limit: Min 50 MMK, Max 10,000 MMK
    ok_min, _ = validate_bet_amount(50)
    assert ok_min is True
    bad_min, msg = validate_bet_amount(40)
    assert bad_min is False

    ok_max, _ = validate_bet_amount(10000)
    assert ok_max is True
    bad_max, msg = validate_bet_amount(15000)
    assert bad_max is False
    print("Test 7 Passed: Betting limits (50 MMK min to 10,000 MMK max) enforced.")

    # Multipliers: 1st 2000x, 2nd 1000x, 3rd 500x, Starter 150x, Consolation 60x, Box 10x
    draw_results = {
        "first_prize": "7194",
        "second_prize": "4820",
        "third_prize": "1538",
        "starter_prizes": ["0492", "3810"],
        "consolidation_prizes": ["4410", "9102"]
    }
    
    # 1st prize (2000x): 100 MMK -> 200,000 MMK
    win1 = evaluate_bet_winnings("7194", big_stake=100, small_stake=0, draw_results=draw_results)
    assert win1["total_payout"] == 200000

    # 2nd prize (1000x): 100 MMK -> 100,000 MMK
    win2 = evaluate_bet_winnings("4820", big_stake=100, small_stake=0, draw_results=draw_results)
    assert win2["total_payout"] == 100000

    # 3rd prize (500x): 100 MMK -> 50,000 MMK
    win3 = evaluate_bet_winnings("1538", big_stake=100, small_stake=0, draw_results=draw_results)
    assert win3["total_payout"] == 50000

    # Starter (100x): 100 MMK -> 10,000 MMK
    win_start = evaluate_bet_winnings("0492", big_stake=100, small_stake=0, draw_results=draw_results)
    assert win_start["total_payout"] == 10000

    # Consolation (30x): 100 MMK -> 3,000 MMK
    win_con = evaluate_bet_winnings("4410", big_stake=100, small_stake=0, draw_results=draw_results)
    assert win_con["total_payout"] == 3000

    # Permutation / Box Roll (10x): e.g. 9471 is permutation of 1st prize 7194
    win_box = evaluate_bet_winnings("9471", big_stake=100, small_stake=0, draw_results=draw_results, bet_type="box")
    assert win_box["total_payout"] == 1000
    print("Test 8 Passed: Official Singapore 4D Multipliers accurate (2000x, 1000x, 500x, 100x, 30x, 10x).")

def test_roll_series_validation_and_combos():
    # 1. Unexpanded roll number (e.g. 957S or S957)
    assert validate_4d_number("957S", "roll") is True
    assert validate_4d_number("S957", "roll") is True
    combos_last = generate_combinations("957S", "roll")
    assert len(combos_last) == 10
    assert combos_last == [f"957{d}" for d in range(10)]

    combos_first = generate_combinations("S957", "roll")
    assert len(combos_first) == 10
    assert combos_first == [f"{d}957" for d in range(10)]

    # 2. Expanded 4-digit concrete numbers in slip queue (e.g. 9570 with bet_type roll)
    assert validate_4d_number("9570", "roll") is True
    assert validate_4d_number("9571", "s") is True
    assert validate_4d_number("9579", "series") is True

    combos_single = generate_combinations("9570", "roll")
    assert len(combos_single) == 1
    assert combos_single == ["9570"]

    # 3. Stake calculation for single expanded roll item
    stake_res = calculate_stake("9570", "roll", big_amount=500, small_amount=0)
    assert stake_res["combination_count"] == 1
    assert stake_res["total_stake"] == 500
    assert stake_res["combinations"] == ["9570"]
    print("Test 8b Passed: Roll / Series (Roll-S) 10 combos & expanded combo validation verified.")

def test_agent_commission_and_weekly_bonus():
    Base.metadata.create_all(bind=engine)
    seed_database()
    db = SessionLocal()

    # 1. 30% Agent Commission calculation
    stake = 10000.0
    commission = stake * settings.AGENT_COMMISSION_RATE
    assert commission == 3000.0
    print("Test 9 Passed: 30% Agent Commission calculated accurately.")

    # 2. Run Weekly Bonus calculation test
    res = calculate_and_distribute_weekly_bonus(db=db)
    assert res["status"] in ["success", "already_processed"]
    print(f"Test 10 Passed: Weekly Bonus engine executed successfully: {res['status']}.")
    db.close()

if __name__ == "__main__":
    test_timezone_and_15min_expiry()
    test_operating_hours_and_cutoff()
    test_betting_limits_and_multipliers()
    test_roll_series_validation_and_combos()
    test_agent_commission_and_weekly_bonus()
    print("\nALL 11 UNIT TEST SUITES PASSED CLEANLY!")
