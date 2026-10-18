import os
import uuid
import aiofiles
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User, Notification
from app.models.settings import SystemSetting
from app.models.transaction import Transaction, TransactionType, TransactionStatus
from app.models.ledger import FinancialLedger, LedgerEntryType
from app.schemas.payment import (
    DepositSubmissionRequest, 
    DepositVerificationResponse, 
    TransactionResponse,
    WithdrawSubmissionRequest,
    WithdrawResponse
)
from app.core.security import get_current_user
from app.core.payment_verifier import verify_and_process_deposit
from app.core.timezone_utils import now_mmt, is_within_gateway_operating_hours

router = APIRouter(prefix="/payments", tags=["Financial & Payment Verification"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/receivers")
def get_official_receivers(db: Session = Depends(get_db)):
    """
    Returns official agent payment receiver accounts for KPay, WavePay, and AYA Pay,
    dynamically synchronized with SystemSetting.
    """
    setting = db.query(SystemSetting).first()
    
    kpay_phone = setting.kpay_phone if setting and setting.kpay_phone else "09795007441"
    kpay_name = setting.kpay_name if setting and setting.kpay_name else "Daw Myo Thiri Khin"
    kpay_qr = setting.kpay_qr_url if setting and setting.kpay_qr_url else "/assets/kpay_qr_sample.png"

    wave_phone = setting.wave_phone if setting and setting.wave_phone else "09894169717"
    wave_name = setting.wave_name if setting and setting.wave_name else "Ye Win Htut"
    wave_qr = setting.wave_qr_url if setting and setting.wave_qr_url else "/assets/wave_qr_sample.png"

    gateways = {
        "kpay": [
            {"account_name": kpay_name, "account_number": kpay_phone, "qr_code": kpay_qr}
        ],
        "wavepay": [
            {"account_name": wave_name, "account_number": wave_phone, "qr_code": wave_qr}
        ]
    }

    return {
        "gateways": gateways,
        "expiry_window_minutes": settings.PAYMENT_EXPIRY_MINUTES,
        "current_time_mmt": now_mmt().strftime("%Y-%m-%d %I:%M:%S %p MMT")
    }

@router.post("/upload-slip")
async def upload_payment_slip(file: UploadFile = File(...)):
    """
    Uploads user payment receipt screenshot.
    """
    allowed_exts = [".jpg", ".jpeg", ".png", ".webp"]
    _, ext = os.path.splitext(file.filename)
    if ext.lower() not in allowed_exts:
        raise HTTPException(status_code=400, detail="Allowed image formats: JPG, PNG, WEBP.")

    unique_filename = f"slip_{uuid.uuid4().hex}{ext.lower()}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    async with aiofiles.open(file_path, "wb") as out_file:
        content = await file.read()
        await out_file.write(content)

    return {
        "file_url": f"/static/uploads/{unique_filename}",
        "filename": unique_filename
    }

import logging
logger = logging.getLogger("payments")

@router.post("/deposit", response_model=DepositVerificationResponse)
def submit_deposit(
    req: DepositSubmissionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Smart Payment Verification Endpoint:
    - Normalizes payment time to MMT (UTC+6:30).
    - Checks 15-minute expiry threshold.
    - Matches TxID and designated Receiver ID.
    - If valid, AUTO-APPROVES credit instantly.
    """
    try:
        result = verify_and_process_deposit(
            db=db,
            user=current_user,
            gateway=req.gateway,
            transaction_id=req.transaction_id,
            receiver_id=req.receiver_id,
            amount=req.amount,
            raw_timestamp=req.raw_timestamp,
            client_timezone=req.client_timezone or "MMT",
            slip_image_url=req.slip_image_url
        )
        return result
    except Exception as e:
        logger.error(f"Error processing deposit: {e}", exc_info=True)
        return {
            "success": False,
            "status": TransactionStatus.REJECTED,
            "message": f"ငွေသွင်း စစ်ဆေးရာတွင် အမှားအယွင်းရှိပါသည်: {str(e)}"
        }

@router.get("/my-transactions", response_model=List[TransactionResponse])
def get_my_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns user's transaction history with verification notes."""
    txs = db.query(Transaction).filter(
        Transaction.user_id == current_user.id
    ).order_by(Transaction.id.desc()).limit(50).all()
    return txs

@router.post("/withdraw", response_model=WithdrawResponse)
def submit_withdrawal(
    req: WithdrawSubmissionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits a withdrawal cash-out request.
    Deducts balance immediately and creates a pending withdrawal record for review.
    """
    # Enforce Withdrawal Operating Hours (08:00 AM to 08:00 PM MMT)
    current_time = now_mmt()
    is_open, hours_msg = is_within_gateway_operating_hours(current_time)
    if not is_open:
        raise HTTPException(
            status_code=400,
            detail=f"ငွေထုတ်ယူခြင်း ဝန်ဆောင်မှုကို နံနက် ၀၈:၀၀ မှ ည ၀၈:၀၀ နာရီ (MMT) အတွင်းသာ ဆောင်ရွက်ပေးပါသည် ခင်ဗျာ။ (Withdrawals operate 08:00 AM - 08:00 PM MMT. {hours_msg})"
        )

    if req.amount < 1000.0:
        raise HTTPException(status_code=400, detail="Minimum withdrawal amount is 1,000 MMK.")
    
    if current_user.balance < req.amount:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient balance. Your current balance is {current_user.balance:,.0f} MMK."
        )

    tx_code = f"WD{current_time.strftime('%Y%m%d%H%M%S')}{current_user.id}"

    # Deduct balance immediately
    current_user.balance -= req.amount

    tx = Transaction(
        user_id=current_user.id,
        tx_type=TransactionType.WITHDRAWAL,
        gateway=req.gateway.lower(),
        transaction_id=tx_code,
        receiver_id=f"{req.receiver_account} ({req.receiver_name})",
        amount=req.amount,
        tx_timestamp_mmt=current_time,
        submission_timestamp_mmt=current_time,
        status=TransactionStatus.MANUAL_REVIEW,
        verification_notes=f"Withdrawal request via {req.gateway.upper()} to {req.receiver_account} ({req.receiver_name})"
    )
    db.add(tx)

    # Financial Ledger entry
    ledger = FinancialLedger(
        entry_type=LedgerEntryType.WITHDRAWAL,
        amount=-req.amount,
        running_balance=current_user.balance,
        reference_id=tx_code,
        reference_type="WITHDRAWAL",
        description=f"Withdrawal request by {current_user.phone} ({req.amount:,.0f} MMK via {req.gateway.upper()})",
        logged_at_mmt=current_time,
        date_str=current_time.strftime("%Y-%m-%d")
    )
    db.add(ledger)

    # Notification to user
    notif = Notification(
        user_id=current_user.id,
        title="⏳ ငွေထုတ်ယူခွင့် တောင်းဆိုလွှာ (Pending)",
        message=f"သင့်ငွေထုတ်ယူမှု {req.amount:,.0f} MMK ({req.gateway.upper()} - {req.receiver_account}) ကို တင်သွင်းပြီးဖြစ်၍ ဆိုင်းငံ့ (Pending) စာရင်းသွင်းထားပါသည်။ လက်ကျန်ငွေမှ နုတ်ယူထားပြီးဖြစ်ပြီး Admin မှ စိစစ်လွှဲပြောင်းပေးပါက ထပ်မံအကြောင်းကြားပေးပါမည်။ / Withdrawal of {req.amount:,.0f} MMK submitted and pending review. Funds have been deducted from your wallet balance.",
        category="Withdraw",
        notif_type="TRANSACTION",
        is_read=False,
        created_at=current_time
    )
    db.add(notif)

    db.commit()
    db.refresh(tx)

    return {
        "success": True,
        "transaction_id": tx.id,
        "amount": req.amount,
        "new_balance": current_user.balance,
        "status": "MANUAL_REVIEW",
        "message": f"ငွေထုတ်ယူခွင့် တောင်းဆိုမှု တင်သွင်းခြင်း အောင်မြင်ပါသည်။ လက်ရှိ အခြေအနေမှာ ဆိုင်းငံ့ (Pending) ဖြစ်ပြီး အကောင့်ထဲမှ ငွေ {req.amount:,.0f} MMK နုတ်ယူထားပြီးဖြစ်ပါသည်။ Admin ဘက်မှ လွှဲပြောင်းစိစစ်ပြီးပါက ငွေလွှဲပြီးစီးကြောင်း ထပ်မံအကြောင်းကြားပေးပါမည်။"
    }
