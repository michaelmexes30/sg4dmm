import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from apscheduler.schedulers.background import BackgroundScheduler
import pytz

from app.config import settings
from app.database import Base, engine
from app.seeds.seed_data import seed_database
from app.core.archiver import archive_old_records
from app.core.bonus_engine import calculate_and_distribute_weekly_bonus
from app.core.notifications import send_cutoff_reminder_job
from app.core.singapore_pools_scraper import poll_singapore_pools_job
from app.core.timezone_utils import now_mmt, format_mmt
from app.core.telegram_bot import start_telegram_bot_background

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
    Base.metadata.create_all(bind=engine)
    seed_database()
    
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

    scheduler.start()
    print("APScheduler started: Active schedules:")
    print("  - Nightly 02:00 AM MMT 3-month Data Archiving")
    print("  - Every Monday 11:00 AM MMT 10% Weekly Bonus Settlement")
    print("  - Wed/Sat/Sun 03:30 PM MMT 4:30 PM Cutoff Reminders")
    print("  - Wed/Sat/Sun 06:00 PM MMT Singapore Pools Results Polling (Query until result out)")
    
    # 6. Start Telegram Bot Background Listener for Sign Up / Forgot Password OTP
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

from fastapi.responses import FileResponse, RedirectResponse

app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/download/apk")
@app.get("/app.apk")
def download_app_apk():
    apk_path = os.path.join(releases_dir, "SG4D_Myanmar.apk")
    if os.path.exists(apk_path):
        return FileResponse(apk_path, media_type="application/vnd.android.package-archive", filename="SG4D_Myanmar.apk")
    return {"status": "error", "message": "APK is being compiled or not found"}


# Serve React frontend dist assets directly on FastAPI
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
frontend_assets = os.path.join(frontend_dist, "assets")
frontend_index = os.path.join(frontend_dist, "index.html")

if os.path.exists(frontend_assets):
    app.mount("/assets", StaticFiles(directory=frontend_assets), name="frontend_assets")

# Legacy view route (Access to original dashboard HTML)
@app.get("/backend/legacy")
def serve_legacy_admin():
    legacy_file = os.path.join(static_dir, "admin_dashboard_backup.html")
    if os.path.exists(legacy_file):
        return FileResponse(legacy_file)
    return FileResponse(os.path.join(static_dir, "admin_dashboard.html"))

# Backend Admin Web UI Routes (Directly serves the Admin Backend Portal)
@app.get("/backend")
@app.get("/backend/dashboard")
@app.get("/backend/login")
@app.get("/backend/{full_path:path}")
def serve_backend_admin(full_path: str = ""):
    if os.path.exists(frontend_index):
        return FileResponse(frontend_index)
    return FileResponse(os.path.join(static_dir, "admin_dashboard.html"))

@app.get("/admin")
@app.get("/admin/{full_path:path}")
def serve_admin(full_path: str = ""):
    if os.path.exists(frontend_index):
        return FileResponse(frontend_index)
    return FileResponse(os.path.join(static_dir, "admin_dashboard.html"))



# Include API Routers
app.include_router(auth_router, prefix="/api")
app.include_router(bets_router, prefix="/api")
app.include_router(payments_router, prefix="/api")
app.include_router(lottery_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")

@app.get("/api/health")
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
