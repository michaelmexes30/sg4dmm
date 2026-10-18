from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, Notification
from app.core.security import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])

class MarkReadRequest(BaseModel):
    notif_ids: Optional[List[int]] = None

@router.get("/my")
def get_user_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notifs = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.id.desc()).limit(30).all()

    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "notif_type": n.notif_type,
            "is_read": n.is_read,
            "created_at": n.created_at
        }
        for n in notifs
    ]

@router.post("/mark-read")
def mark_notifications_read(
    req: MarkReadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    )
    if req.notif_ids:
        query = query.filter(Notification.id.in_(req.notif_ids))
    
    query.update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"status": "success"}

@router.post("/read-all")
def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"status": "success"}
