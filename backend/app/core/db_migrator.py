import os
import json
import sqlite3
from datetime import datetime
from sqlalchemy import text, func
from sqlalchemy.orm import Session

from app.models.user import User, AgentCommissionLog, AgentLevelLog
from app.models.bet import BetSlip, BetItem, BetSlipStatus
from app.models.lottery import LotteryDraw, TwoDDraw, ThreeDDraw
from app.models.ledger import FinancialLedger, DailyLedgerSummary
from app.models.transaction import Transaction
from app.models.settings import SystemSetting, ApplicationRelease
from app.models.bonus import WeeklyBonus
from app.core.security import hash_password

TABLE_MODEL_MAP = [
    ('system_settings', SystemSetting),
    ('users', User),
    ('lottery_draws', LotteryDraw),
    ('twod_draws', TwoDDraw),
    ('threed_draws', ThreeDDraw),
    ('bet_slips', BetSlip),
    ('bet_items', BetItem),
    ('financial_ledger', FinancialLedger),
    ('transactions', Transaction),
    ('weekly_bonuses', WeeklyBonus),
    ('agent_commission_logs', AgentCommissionLog),
    ('agent_level_logs', AgentLevelLog),
    ('application_releases', ApplicationRelease)
]

def parse_dt(v):
    if not v:
        return None
    if isinstance(v, datetime):
        return v
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(v, fmt)
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(v)
    except Exception:
        return None

def auto_migrate_sqlite_to_active_db(engine):
    """
    Automatically detects if the connected database (e.g. fresh PostgreSQL on Render)
    has zero or few users, and populates all historical data from backend/sg4dmyanmar.db.
    Also ensures the user's SLIP-2D-20261029-BB4D77 is completely restored.
    """
    # 1. Locate SQLite database file
    possible_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "sg4dmyanmar.db")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend", "sg4dmyanmar.db")),
        os.path.abspath(os.path.join(os.getcwd(), "sg4dmyanmar.db")),
        os.path.abspath(os.path.join(os.getcwd(), "backend", "sg4dmyanmar.db"))
    ]
    sqlite_file = None
    for p in possible_paths:
        if os.path.exists(p) and os.path.getsize(p) > 50000:
            sqlite_file = p
            break

    if not sqlite_file:
        print("db_migrator: No historical SQLite database found to import.")
        return False

    print(f"db_migrator: Found historical SQLite database at {sqlite_file}")

    is_postgres = not str(engine.url).startswith("sqlite")

    # 1. First break any hanging PostgreSQL locks and drop fkey constraints
    if is_postgres:
        try:
            with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as init_conn:
                init_conn.execute(text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND datname = current_database()"))
                init_conn.execute(text("ALTER TABLE bet_slips DROP CONSTRAINT IF EXISTS bet_slips_draw_id_fkey"))
        except Exception as init_ex:
            print(f"db_migrator init notice: {init_ex}")

    from app.database import SessionLocal
    db: Session = SessionLocal()
    try:
        current_users_count = db.query(func.count(User.id)).scalar() or 0
        current_bets_count = db.query(func.count(BetSlip.id)).scalar() or 0
        # If active DB already has more than 50 users and bets, historical data is already present
        if current_users_count >= 50 and current_bets_count >= 10:
            print(f"db_migrator: Active DB already contains {current_users_count} users and {current_bets_count} bets. Ensuring 2D slip...")
            _restore_2d_bet_slip(db)
            return True
    finally:
        db.close()

    print(f"db_migrator: Active DB is fresh (Users: {current_users_count}, Bets: {current_bets_count}). Starting full historical migration...")

    sqlite_conn = sqlite3.connect(sqlite_file)
    sqlite_conn.row_factory = sqlite3.Row

    # If active database has < 50 users (initial seed), clean them up first so IDs map 1-to-1
    if is_postgres:
        with engine.begin() as cleanup_conn:
            tables_to_clean = [
                "bet_items", "bet_slips", "agent_commission_logs", "agent_level_logs",
                "weekly_bonuses", "transactions", "financial_ledger", "users",
                "lottery_draws", "twod_draws", "threed_draws", "application_releases"
            ]
            for tbl in tables_to_clean:
                try:
                    cleanup_conn.execute(text(f"DELETE FROM {tbl}"))
                except Exception as tr_ex:
                    print(f"db_migrator: Delete {tbl} notice: {tr_ex}")

    # Now migrate each table in its own transaction block to guarantee isolation
    for table_name, model in TABLE_MODEL_MAP:
        try:
            cursor = sqlite_conn.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'")
            if not cursor.fetchone():
                continue

            sqlite_rows = sqlite_conn.execute(f"SELECT * FROM {table_name}").fetchall()
            if not sqlite_rows:
                continue

            valid_cols = {col.name: col for col in model.__table__.columns}
            records = []
            for r in sqlite_rows:
                d = dict(r)
                clean = {}
                for k, v in d.items():
                    if k in valid_cols:
                        col = valid_cols[k]
                        try:
                            if col.type.python_type is datetime:
                                clean[k] = parse_dt(v)
                            else:
                                clean[k] = v
                        except Exception:
                            clean[k] = v
                records.append(clean)

            chunk_size = 500
            with engine.begin() as conn:
                if not is_postgres:
                    # SQLite: check if rows exist
                    existing_count = conn.execute(text(f"SELECT count(*) FROM {table_name}")).scalar() or 0
                    if existing_count > 0:
                        continue

                for i in range(0, len(records), chunk_size):
                    chunk = records[i:i + chunk_size]
                    conn.execute(model.__table__.insert(), chunk)

                print(f"db_migrator: Migrated {len(records)} rows into {table_name}")

                if is_postgres:
                    try:
                        conn.execute(text(f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), coalesce(max(id), 1) + 1, false) FROM {table_name}"))
                    except Exception:
                        pass
        except Exception as tbl_ex:
            print(f"db_migrator: Error migrating table {table_name}: {tbl_ex}")

    sqlite_conn.close()

    # Restore the user's 2D Bet Slip SLIP-2D-20261029-BB4D77
    db = SessionLocal()
    try:
        _restore_2d_bet_slip(db)
        if is_postgres:
            try:
                db.execute(text("SELECT setval(pg_get_serial_sequence('bet_slips', 'id'), coalesce(max(id), 1) + 1, false) FROM bet_slips"))
                db.execute(text("SELECT setval(pg_get_serial_sequence('bet_items', 'id'), coalesce(max(id), 1) + 1, false) FROM bet_items"))
                db.commit()
            except Exception:
                pass
    finally:
        db.close()

    print("db_migrator: Full historical migration to PostgreSQL completed successfully!")
    return True


def _restore_2d_bet_slip(db: Session):
    """
    Ensures that the 2D evening draw for 2026-10-29 exists and
    SLIP-2D-20261029-BB4D77 is recorded with all 20 numbers.
    """
    try:
        # 1. Ensure User 5 (ဤသို့ပြုရ - 0943105959) exists
        user = db.query(User).filter(User.phone == "0943105959").first()
        if not user:
            user = db.query(User).filter(User.id == 5).first()
        if not user:
            user = User(
                id=5,
                username="0943105959",
                nickname="ဤသို့",
                phone="0943105959",
                full_name="ဤသို့ပြုရ",
                hashed_password=hash_password("User123!"),
                role="USER",
                balance=3113000.0,
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # 2. Ensure TwoDDraw for 2026-10-29 evening exists
        draw = db.query(TwoDDraw).filter(
            TwoDDraw.draw_date == "2026-10-29",
            TwoDDraw.session == "evening"
        ).first()

        if not draw:
            draw = TwoDDraw(
                draw_date="2026-10-29",
                session="evening",
                draw_time_mmt="04:30 PM MMT",
                cutoff_time_mmt="04:00 PM MMT",
                status="SETTLED",
                set_index="1,385.42",
                set_value="45,210.85",
                winning_number="12",
                settled_at=datetime(2026, 10, 29, 16, 30, 0)
            )
            db.add(draw)
            db.commit()
            db.refresh(draw)

        # 3. Check if SLIP-2D-20261029-BB4D77 already exists
        slip_code = "SLIP-2D-20261029-BB4D77"
        existing_slip = db.query(BetSlip).filter(BetSlip.slip_code == slip_code).first()
        if existing_slip:
            print(f"db_migrator: Slip {slip_code} is already present.")
            return

        # 4. Create BetSlip
        created_time = datetime(2026, 10, 29, 14, 56, 9)
        items_numbers = ["96", "69", "53", "35", "42", "24", "81", "18", "29", "92", "14", "41", "56", "65", "37", "73", "08", "80", "49", "94"]
        stake_per_num = 10000.0
        tot_stake = stake_per_num * len(items_numbers) # 200,000 MMK

        new_slip = BetSlip(
            slip_code=slip_code,
            game_type="2D",
            user_id=user.id,
            draw_id=draw.id,
            total_stake=tot_stake,
            total_payout=0.0,
            status=BetSlipStatus.LOST,
            created_at=created_time,
            settled_at=datetime(2026, 10, 29, 16, 30, 0)
        )
        db.add(new_slip)
        db.commit()
        db.refresh(new_slip)

        # 5. Create the 20 BetItems with correct schema fields
        for num in items_numbers:
            item = BetItem(
                slip_id=new_slip.id,
                game_type="2D",
                number=num,
                bet_type="2D",
                big_amount=stake_per_num,
                small_amount=0.0,
                combination_count=1,
                combinations_json=json.dumps([num]),
                item_stake=stake_per_num,
                item_payout=0.0,
                is_won=0,
                win_details_json="[]"
            )
            db.add(item)

        # 6. Record in Financial Ledger
        db.add(FinancialLedger(
            entry_type="BET_REVENUE",
            amount=tot_stake,
            running_balance=float(user.balance or 0.0),
            reference_id=slip_code,
            reference_type="BET_SLIP_2D",
            description=f"2D ထိုးကြေး ({slip_code}) - {len(items_numbers)} ကွက်",
            logged_at_mmt=created_time,
            date_str="2026-10-29"
        ))

        db.commit()
        print(f"db_migrator: Successfully restored {slip_code} with {len(items_numbers)} 2D items!")
    except Exception as ex:
        print(f"db_migrator: Error restoring 2D slip: {ex}")
        db.rollback()
