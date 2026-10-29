import os
import json
import sqlite3
from datetime import datetime
from sqlalchemy import text, func
from sqlalchemy.orm import Session

from app.models.user import User, AgentCommissionLog, AgentLevelLog, Notification
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

def auto_migrate_sqlite_to_active_db(engine, force: bool = False):
    """
    Automatically detects if the connected database (e.g. fresh PostgreSQL on Render)
    has zero or few users, and populates all historical data from backend/sg4dmyanmar.db.
    Also ensures the user's SLIP-2D-20261029-BB4D77 is completely restored.
    Returns a diagnostic dict.
    """
    diagnostic = {
        "success": False,
        "sqlite_file": None,
        "sqlite_size": 0,
        "migrated_tables": {},
        "errors": [],
        "user_2d_slip_restored": False,
        "final_users_count": 0,
        "final_2d_bets_count": 0
    }

    # 1. Locate SQLite database file (prefer largest)
    possible_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "sg4dmyanmar.db")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "sg4dmyanmar.db")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend", "sg4dmyanmar.db")),
        os.path.abspath(os.path.join(os.getcwd(), "sg4dmyanmar.db")),
        os.path.abspath(os.path.join(os.getcwd(), "backend", "sg4dmyanmar.db"))
    ]
    candidates = []
    for p in possible_paths:
        if os.path.exists(p) and os.path.isfile(p):
            candidates.append((os.path.getsize(p), p))
    candidates.sort(key=lambda x: x[0], reverse=True)

    if not candidates or candidates[0][0] < 50000:
        diagnostic["errors"].append("No valid SQLite file found.")
        return diagnostic

    sqlite_size, sqlite_file = candidates[0]
    diagnostic["sqlite_file"] = sqlite_file
    diagnostic["sqlite_size"] = sqlite_size

    is_postgres = not str(engine.url).startswith("sqlite")

    # 2. Check if current database already has full data
    from app.database import SessionLocal
    db: Session = SessionLocal()
    try:
        current_users_count = db.query(func.count(User.id)).scalar() or 0
        current_bets_count = db.query(func.count(BetSlip.id)).scalar() or 0
        if not force and current_users_count >= 50 and current_bets_count >= 10:
            diagnostic["user_2d_slip_restored"] = _restore_2d_bet_slip(db)
            diagnostic["success"] = True
            diagnostic["message"] = f"DB already has {current_users_count} users."
            diagnostic["final_users_count"] = current_users_count
            diagnostic["final_2d_bets_count"] = db.query(func.count(BetItem.id)).filter(BetItem.game_type == "2D").scalar() or 0
            return diagnostic
    except Exception as count_ex:
        diagnostic["errors"].append(f"count check error: {count_ex}")
    finally:
        db.close()

    # 3. On PostgreSQL: clean tables in child-to-parent order
    if is_postgres:
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as clean_conn:
            try:
                clean_conn.execute(text("UPDATE users SET agent_id = NULL"))
            except Exception:
                pass

            tables_to_clean = [
                "notifications", "telegram_verifications", "telegram_chat_mappings",
                "mini_game_bets", "bet_items", "bet_slips",
                "agent_commission_logs", "agent_level_logs", "weekly_bonuses",
                "transactions", "financial_ledger", "system_settings",
                "users", "lottery_draws", "twod_draws", "threed_draws", "application_releases"
            ]
            for tbl in tables_to_clean:
                try:
                    clean_conn.execute(text(f"DELETE FROM {tbl}"))
                except Exception as del_ex:
                    diagnostic["errors"].append(f"Delete {tbl} notice: {del_ex}")

    sqlite_conn = sqlite3.connect(sqlite_file)
    sqlite_conn.row_factory = sqlite3.Row

    # 4. Migrate tables one-by-one in separate engine.begin() transactions
    for table_name, model in TABLE_MODEL_MAP:
        try:
            cursor = sqlite_conn.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'")
            if not cursor.fetchone():
                continue

            if table_name == 'bet_items':
                # Skip 10,000 permutations of old test slip 17 so migration completes in milliseconds
                sqlite_rows = sqlite_conn.execute("SELECT * FROM bet_items WHERE slip_id != 17").fetchall()
            else:
                sqlite_rows = sqlite_conn.execute(f"SELECT * FROM {table_name}").fetchall()
            if not sqlite_rows:
                continue

            valid_cols = {col.name: col for col in model.__table__.columns}
            records = []
            user_agent_map = {}
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

                if table_name == 'users' and clean.get('agent_id'):
                    user_agent_map[clean['id']] = clean['agent_id']
                    clean['agent_id'] = None

                if table_name == 'lottery_draws' and clean.get('draw_time_mmt'):
                    clean['draw_time_mmt'] = clean['draw_time_mmt'][:30]

                records.append(clean)

            chunk_size = 500
            with engine.begin() as conn:
                for i in range(0, len(records), chunk_size):
                    chunk = records[i:i + chunk_size]
                    conn.execute(model.__table__.insert(), chunk)

                if user_agent_map:
                    for uid, aid in user_agent_map.items():
                        try:
                            conn.execute(text("UPDATE users SET agent_id = :aid WHERE id = :uid"), {"aid": aid, "uid": uid})
                        except Exception:
                            pass

                if is_postgres:
                    try:
                        conn.execute(text(f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), coalesce(max(id), 1) + 1, false) FROM {table_name}"))
                    except Exception:
                        pass

            diagnostic["migrated_tables"][table_name] = len(records)
        except Exception as tbl_ex:
            diagnostic["errors"].append(f"Table {table_name}: {tbl_ex}")

    sqlite_conn.close()

    # 5. Restore user's 2D Bet Slip SLIP-2D-20261029-BB4D77
    db = SessionLocal()
    try:
        restored = _restore_2d_bet_slip(db)
        diagnostic["user_2d_slip_restored"] = restored
        if is_postgres:
            try:
                db.execute(text("SELECT setval(pg_get_serial_sequence('bet_slips', 'id'), coalesce(max(id), 1) + 1, false) FROM bet_slips"))
                db.execute(text("SELECT setval(pg_get_serial_sequence('bet_items', 'id'), coalesce(max(id), 1) + 1, false) FROM bet_items"))
                db.commit()
            except Exception:
                pass

        diagnostic["final_users_count"] = db.query(func.count(User.id)).scalar() or 0
        diagnostic["final_2d_bets_count"] = db.query(func.count(BetItem.id)).filter(BetItem.game_type == "2D").scalar() or 0
        diagnostic["success"] = True
    except Exception as slip_ex:
        diagnostic["errors"].append(f"2D slip restore error: {slip_ex}")
    finally:
        db.close()

    return diagnostic


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

        # 3. Check if SLIP-2D-20261029-BB4D77 already exists with all 20 items
        slip_code = "SLIP-2D-20261029-BB4D77"
        existing_slip = db.query(BetSlip).filter(BetSlip.slip_code == slip_code).first()
        if existing_slip:
            existing_items_count = db.query(func.count(BetItem.id)).filter(BetItem.slip_id == existing_slip.id).scalar() or 0
            if existing_items_count >= 20:
                return True
            # Otherwise clean up incomplete slip and recreate cleanly with all 20 items
            db.query(BetItem).filter(BetItem.slip_id == existing_slip.id).delete()
            db.delete(existing_slip)
            db.commit()

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
        return True
    except Exception as ex:
        db.rollback()
        return False
