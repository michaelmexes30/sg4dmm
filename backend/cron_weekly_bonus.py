#!/usr/bin/env python3
"""
SG4DMyanmar - Monday 11:00 AM (MMT) Weekly Bonus Batch Cron Script

Automated weekly distribution job:
- Runs every Monday at 11:00 AM Myanmar Standard Time (UTC+6:30)
- Identifies active users with >= 10,000 MMK total bet on at least ONE draw day (Wed, Sat, Sun)
- Calculates 10% bonus on total qualifying bets of the previous calendar week
- Automatically credits bonuses directly to user balances
- Records entries in Financial Ledger & dispatches push notifications
"""

import sys
import os
from datetime import datetime

# Add project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.bonus_engine import calculate_and_distribute_weekly_bonus
from app.core.timezone_utils import now_mmt, format_mmt

def main():
    start_time = now_mmt()
    print("=" * 60)
    print(" SG4DMyanmar Automated Weekly Bonus Batch Job ")
    print(f" Execution Time: {format_mmt(start_time)}")
    print("=" * 60)

    res = calculate_and_distribute_weekly_bonus()
    
    print("\nResult:")
    for k, v in res.items():
        print(f" - {k}: {v}")
        
    print("\nBatch job completed successfully.")

if __name__ == "__main__":
    main()
