import os
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from apscheduler.schedulers.background import BackgroundScheduler
import pytz

from app.config import settings
from app.database import Base, engine
from app.models.user import User
from app.models.lottery import LotteryDraw, TwoDDraw, ThreeDDraw
from app.models.bet import BetSlip, BetItem, BetEditLog
from app.models.settings import SystemSetting
from app.seeds.seed_data import seed_database
from app.seeds.seed_admin_data import seed_admin_and_system_data
from app.core.archiver import archive_old_records
from app.core.bonus_engine import calculate_and_distribute_weekly_bonus
from app.core.notifications import send_cutoff_reminder_job
from app.core.singapore_pools_scraper import poll_singapore_pools_job
from app.core.timezone_utils import now_mmt, format_mmt
from app.core.telegram_bot import start_telegram_bot_background, check_and_notify_pending_withdrawals_job

# Import API Routers
from app.api.auth import router as auth_router
from app.api.bets import router as bets_router
from app.api.payments import router as payments_router
from app.api.lottery import router as lottery_router
from app.api.admin import router as admin_router
from app.api.notifications import router as notifications_router

scheduler = BackgroundScheduler(timezone=pytz.timezone(settings.TIMEZONE_MMT))

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure DB schema and seeds
    from sqlalchemy import text
    try:
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS bet_edit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    slip_id INTEGER NOT NULL,
                    bet_item_id INTEGER NOT NULL,
                    old_number VARCHAR(10) NOT NULL,
                    new_number VARCHAR(10) NOT NULL,
                    admin_id INTEGER NOT NULL,
                    admin_name VARCHAR(100) NOT NULL,
                    note VARCHAR(255),
                    created_at DATETIME
                )
            """))
            try:
                conn.execute(text("ALTER TABLE bet_items ADD COLUMN edit_logs_json TEXT DEFAULT '[]'"))
            except Exception:
                pass

            try:
                # Fix any previous duplicate-expanded bet item 11137
                conn.execute(text("""UPDATE bet_items SET combination_count = 1, combinations_json = '["4440"]', item_stake = 1000.0 WHERE id = 11137 AND number = "4440" AND combination_count > 1"""))
                conn.execute(text("UPDATE bet_slips SET total_stake = (SELECT SUM(item_stake) FROM bet_items WHERE slip_id = bet_slips.id) WHERE slip_code = 'SLIP-20261022-46DB76'"))
            except Exception:
                pass

            try:
                conn.execute(text("ALTER TABLE bet_slips ADD COLUMN game_type VARCHAR(10) DEFAULT '4D'"))
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE bet_items ADD COLUMN game_type VARCHAR(10) DEFAULT '4D'"))
            except Exception:
                pass

            # System Settings Columns Auto-migration
            settings_cols = [
                ("agent_tier1_turnover", "FLOAT DEFAULT 0.0"),
                ("agent_tier1_commission", "FLOAT DEFAULT 20.0"),
                ("agent_tier2_turnover", "FLOAT DEFAULT 1000000.0"),
                ("agent_tier2_commission", "FLOAT DEFAULT 23.0"),
                ("agent_tier3_turnover", "FLOAT DEFAULT 5000000.0"),
                ("agent_tier3_commission", "FLOAT DEFAULT 26.0"),
                ("agent_tier4_turnover", "FLOAT DEFAULT 10000000.0"),
                ("agent_tier4_commission", "FLOAT DEFAULT 30.0"),
                ("telegram_finance_group_id", "VARCHAR(100) DEFAULT ''"),
                ("auto_approve_max_amount", "FLOAT DEFAULT 50000.0"),
                ("is_withdraw_hours_enabled", "BOOLEAN DEFAULT 0"),
                ("is_2d_enabled", "BOOLEAN DEFAULT 1"),
                ("twod_payout_multiplier", "FLOAT DEFAULT 85.0"),
                ("twod_commission_rate", "FLOAT DEFAULT 15.0"),
                ("twod_min_bet", "FLOAT DEFAULT 100.0"),
                ("twod_max_bet", "FLOAT DEFAULT 50000.0"),
                ("twod_max_risk_per_number", "FLOAT DEFAULT 100000.0"),
                ("twod_morning_cutoff", "VARCHAR(20) DEFAULT '11:30 AM'"),
                ("twod_evening_cutoff", "VARCHAR(20) DEFAULT '04:00 PM'"),
                ("is_3d_enabled", "BOOLEAN DEFAULT 1"),
                ("threed_straight_payout", "FLOAT DEFAULT 700.0"),
                ("threed_tote_payout", "FLOAT DEFAULT 10.0"),
                ("threed_commission_rate", "FLOAT DEFAULT 15.0"),
                ("threed_min_bet", "FLOAT DEFAULT 100.0"),
                ("threed_max_bet", "FLOAT DEFAULT 50000.0"),
                ("threed_max_risk_per_number", "FLOAT DEFAULT 200000.0"),
                ("threed_draw_cutoff", "VARCHAR(20) DEFAULT '02:30 PM'"),
            ]
            for col_name, col_type in settings_cols:
                try:
                    conn.execute(text(f"ALTER TABLE system_settings ADD COLUMN {col_name} {col_type}"))
                except Exception:
                    pass
    except Exception as ddl_ex:
        print(f"Lifespan schema update notice: {ddl_ex}")

    Base.metadata.create_all(bind=engine)
    seed_database()
    try:
        seed_admin_and_system_data()
    except Exception as e:
        print(f"seed_admin_and_system_data warning: {e}")
    
    # 1. Schedule automated archiving job every night at 02:00 AM MMT
    scheduler.add_job(
        archive_old_records,
        "cron",
        hour=2,
        minute=0,
        id="nightly_archiving_job",
        replace_existing=True
    )

    # 2. Schedule Weekly Bonus Distribution EVERY MONDAY AT 11:00 AM MMT
    scheduler.add_job(
        calculate_and_distribute_weekly_bonus,
        "cron",
        day_of_week="mon",
        hour=11,
        minute=0,
        id="monday_weekly_bonus_distribution",
        replace_existing=True
    )

    # 3. Schedule Draw Cutoff Reminder at 03:30 PM MMT on Draw Days (Wed, Sat, Sun)
    scheduler.add_job(
        send_cutoff_reminder_job,
        "cron",
        day_of_week="wed,sat,sun",
        hour=15,
        minute=30,
        id="draw_cutoff_reminder_job",
        replace_existing=True
    )

    # 4. Schedule Singapore Pools Official Results Polling:
    # Runs every 60 seconds on Wed, Sat, Sun between 5:55 PM MMT and 8:30 PM MMT
    # (Covers normal 6:00 PM MMT draws and delayed 1st Wednesday / Big Sweep draws until result out)
    scheduler.add_job(
        poll_singapore_pools_job,
        "cron",
        day_of_week="wed,sat,sun",
        hour="17,18,19,20",
        minute="*",
        id="singapore_pools_draw_polling_job",
        replace_existing=True
    )

    # 5. Heartbeat check every 10 minutes for any delayed or unclosed draws
    scheduler.add_job(
        poll_singapore_pools_job,
        "interval",
        minutes=10,
        id="singapore_pools_background_heartbeat",
        replace_existing=True
    )

    # 6. Check and notify pending withdrawal reviews immediately on startup, then every 3 minutes
    scheduler.add_job(
        check_and_notify_pending_withdrawals_job,
        "interval",
        minutes=3,
        next_run_time=datetime.now(pytz.timezone(settings.TIMEZONE_MMT)),
        id="pending_withdrawals_telegram_reminder_job",
        replace_existing=True
    )

    # 7. Thai 2D Live Results Polling & Settlement:
    # Runs during draw settlement windows (12:01 PM & 04:30 PM MMT) and heartbeat every 5 mins
    from app.core.twod_service import poll_and_settle_2d_job
    try:
        poll_and_settle_2d_job()
    except Exception as e:
        print(f"Startup 2D settlement notice: {e}")

    scheduler.add_job(
        poll_and_settle_2d_job,
        "cron",
        hour="12,16",
        minute="1,2,3,4,5,6,7,8,9,10,30,31,32,33,34,35,36,37,38,39,40,45",
        id="thai_2d_settlement_cron",
        replace_existing=True
    )

    scheduler.add_job(
        poll_and_settle_2d_job,
        "interval",
        minutes=5,
        id="thai_2d_background_heartbeat",
        replace_existing=True
    )

    scheduler.start()
    print("APScheduler started: Active schedules:")
    print("  - Nightly 02:00 AM MMT 3-month Data Archiving")
    print("  - Every Monday 11:00 AM MMT 10% Weekly Bonus Settlement")
    print("  - Wed/Sat/Sun 03:30 PM MMT 4:30 PM Cutoff Reminders")
    print("  - Wed/Sat/Sun 06:00 PM MMT Singapore Pools Results Polling (Query until result out)")
    print("  - Recurring 3-min Telegram Pending Withdrawal Reminders")
    
    # 7. Start Telegram Bot Background Listener for Sign Up / Forgot Password OTP
    start_telegram_bot_background()
    print(f"Telegram Bot poller initialized for @{settings.TELEGRAM_BOT_USERNAME}")
    
    yield
    
    # Shutdown
    scheduler.shutdown()
    print("APScheduler cleanly shut down.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Singapore 4D Lottery Agent Platform in Myanmar (MMT UTC+6:30) with 30% Agent Commission & 10% Weekly Bonus",
    lifespan=lifespan
)

# CORS Middleware (Frontend & Mobile App support)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static directory setup
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
uploads_dir = os.path.join(static_dir, "uploads")
qr_dir = os.path.join(static_dir, "qr")
releases_dir = os.path.join(static_dir, "releases")
os.makedirs(uploads_dir, exist_ok=True)
os.makedirs(qr_dir, exist_ok=True)
os.makedirs(releases_dir, exist_ok=True)

from fastapi.responses import FileResponse, RedirectResponse, Response

app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/download/apk")
@app.get("/app.apk")
def download_app_apk():
    for apk_path in [
        os.path.join(static_dir, "SG4DMyanmar.apk"),
        os.path.join(releases_dir, "SG4D_Myanmar.apk"),
        os.path.join(releases_dir, "SG4D_Myanmar_V1.0.1.apk"),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "SG4DMyanmar.apk"))
    ]:
        if os.path.exists(apk_path):
            return FileResponse(apk_path, media_type="application/vnd.android.package-archive", filename="SG4D_Myanmar.apk")
    return {"status": "error", "message": "APK is being compiled or not found"}


# Serve React frontend dist assets directly on FastAPI
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
frontend_assets = os.path.join(frontend_dist, "assets")
frontend_index = os.path.join(frontend_dist, "index.html")

if os.path.exists(frontend_assets):
    app.mount("/assets", StaticFiles(directory=frontend_assets), name="frontend_assets")

@app.get("/logo.png")
def serve_logo():
    for p in [
        os.path.join(frontend_dist, "logo.png"),
        os.path.join(static_dir, "logo.png")
    ]:
        if os.path.exists(p):
            return FileResponse(p, media_type="image/png")
    return {"status": "error", "message": "logo not found"}

@app.get("/favicon.ico")
def serve_favicon():
    for p in [
        os.path.join(frontend_dist, "favicon.ico"),
        os.path.join(frontend_dist, "logo.png"),
        os.path.join(static_dir, "logo.png")
    ]:
        if os.path.exists(p):
            return FileResponse(p, media_type="image/png")
    return {"status": "error", "message": "favicon not found"}

# Legacy view route (Access to original dashboard HTML)
@app.get("/backend/legacy")
def serve_legacy_admin():
    legacy_file = os.path.join(static_dir, "admin_dashboard_backup.html")
    if os.path.exists(legacy_file):
        return FileResponse(legacy_file)
    return FileResponse(os.path.join(static_dir, "admin_dashboard.html"))

# Head route handlers for uptime monitors (UptimeRobot, BetterUptime, Render health check)
@app.head("/")
@app.head("/api/health")
@app.head("/backend")
def uptime_head_check():
    return Response(
        status_code=200,
        headers={"Content-Type": "application/json", "X-Health-Status": "healthy"}
    )

# Backend Admin Web UI Routes (Directly serves the Admin Backend Portal)
@app.api_route("/", methods=["GET", "HEAD"])
@app.api_route("/backend", methods=["GET", "HEAD"])
@app.api_route("/backend/dashboard", methods=["GET", "HEAD"])
@app.api_route("/backend/login", methods=["GET", "HEAD"])
@app.api_route("/backend/{full_path:path}", methods=["GET", "HEAD"])
def serve_backend_admin(full_path: str = ""):
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    if os.path.exists(frontend_index):
        return FileResponse(frontend_index, headers=headers)
    return FileResponse(os.path.join(static_dir, "admin_dashboard.html"), headers=headers)

@app.api_route("/admin", methods=["GET", "HEAD"])
@app.api_route("/admin/{full_path:path}", methods=["GET", "HEAD"])
def serve_admin(full_path: str = ""):
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    if os.path.exists(frontend_index):
        return FileResponse(frontend_index, headers=headers)
    return FileResponse(os.path.join(static_dir, "admin_dashboard.html"), headers=headers)



# Include API Routers
app.include_router(auth_router, prefix="/api")
app.include_router(bets_router, prefix="/api")
app.include_router(payments_router, prefix="/api")
app.include_router(lottery_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")

@app.api_route("/api/health", methods=["GET", "HEAD"])
def health_check():
    current_time = now_mmt()
    return {
        "status": "online",
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "server_time_mmt": format_mmt(current_time),
        "timezone": settings.TIMEZONE_MMT,
        "utc_offset": "+06:30",
        "agent_commission_rate": "30%",
        "weekly_bonus_rate": "10% (Settled every Monday 11:00 AM MMT)",
        "draw_cutoff": "04:30 PM MMT (Wed, Sat, Sun)",
        "betting_limits": f"{settings.MIN_BET_AMOUNT} - {settings.MAX_BET_AMOUNT:,} MMK",
        "gateway_hours": "08:00 AM - 08:00 PM MMT"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
