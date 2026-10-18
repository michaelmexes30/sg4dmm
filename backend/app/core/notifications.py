from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User, Notification
from app.core.timezone_utils import now_mmt

def broadcast_notification(
    title: str,
    message: str,
    notif_type: str = "SYSTEM",
    role_filter: Optional[str] = None,
    db: Optional[Session] = None
) -> int:
    """Dispatches a notification to all active users or filtered by role."""
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        query = db.query(User).filter(User.is_active == True)
        if role_filter:
            query = query.filter(User.role == role_filter)
        users = query.all()

        current_time = now_mmt()
        created_count = 0

        for u in users:
            notif = Notification(
                user_id=u.id,
                title=title,
                message=message,
                notif_type=notif_type,
                is_read=False,
                created_at=current_time
            )
            db.add(notif)
            created_count += 1

        db.commit()
        return created_count
    finally:
        if close_db:
            db.close()

def send_cutoff_reminder_job():
    """Scheduled at 3:30 PM MMT (1 hour before 4:30 PM cutoff) on Wed, Sat, Sun."""
    broadcast_notification(
        title="⏰ Singapore 4D Cut-off Reminder (4:30 PM MMT)",
        message="Attention players! Betting for today's Singapore 4D draw strictly closes at 4:30 PM MMT. Place your 4D bets now before the cutoff!",
        notif_type="CUTOFF_REMINDER",
        role_filter="USER"
    )

def send_payout_announcement(draw_number: str, total_payout: float = 0.0, winners_count: int = 0):
    """Triggered upon draw settlement at 6:00 PM MMT."""
    broadcast_notification(
        title=f"🏆 Draw #{draw_number} Results & Payouts Announced!",
        message=(
            f"Singapore 4D Draw #{draw_number} has concluded! All winning tickets have been automatically "
            f"calculated and credited to player wallets. Check your slips now!"
        ),
        notif_type="PAYOUT_ANNOUNCEMENT"
    )
