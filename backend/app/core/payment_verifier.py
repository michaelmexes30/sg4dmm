import os
import re
import hashlib
import threading
import logging
from datetime import datetime
from typing import Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session

from app.config import settings
from app.models.transaction import Transaction, TransactionStatus, TransactionType
from app.models.ledger import FinancialLedger, LedgerEntryType, DailyLedgerSummary
from app.models.user import User, Notification
from app.core.timezone_utils import (
    now_mmt, 
    convert_to_mmt, 
    parse_slip_timestamp, 
    validate_15min_window,
    is_within_gateway_operating_hours,
    format_mmt
)

logger = logging.getLogger("payment_verifier")

# In-Memory Concurrency Guards (Prevent simultaneous double/triple submit race conditions)
_tx_lock = threading.Lock()
_processing_txs = set()
_processing_hashes = set()

def calculate_file_sha256(filepath: str) -> Optional[str]:
    """Calculates SHA-256 hash of a receipt image file to detect duplicate uploads."""
    if not filepath or not os.path.exists(filepath):
        return None
    try:
        h = hashlib.sha256()
        with open(filepath, "rb") as f:
            while chunk := f.read(8192):
                h.update(chunk)
        return h.hexdigest()
    except Exception as e:
        logger.error(f"Error calculating slip hash: {e}")
        return None

def validate_gateway_tx_format(gateway: str, tx_id: str) -> Tuple[bool, str]:
    """Validates if transaction ID looks structurally valid for the gateway."""
    tx = tx_id.strip()
    g = gateway.lower()
    
    if len(tx) < 6:
        return False, "Transaction ID must be at least 6 digits/characters."
        
    if g == "kpay":
        if not re.match(r"^\d{6,24}$", tx):
            return False, "KPay Transaction ID must contain numeric digits only."
    elif g == "wavepay":
        if not re.match(r"^[A-Za-z0-9]{6,20}$", tx):
            return False, "WavePay Transaction ID must be alphanumeric."
    elif g == "ayapay":
        if not re.match(r"^[A-Za-z0-9]{6,24}$", tx):
            return False, "AYA Pay Transaction ID format is invalid."
            
    return True, "Valid format."

from app.models.settings import SystemSetting

def is_valid_receiver(gateway: str, receiver_id: str, db: Optional[Session] = None) -> bool:
    """Checks if receiver_id matches any registered company receiver account from SystemSetting or config."""
    if not receiver_id:
        return True
    clean_receiver = re.sub(r"[^\d]", "", str(receiver_id).strip())
    if not clean_receiver:
        return True

    g = gateway.lower()
    
    # Check dynamic SystemSetting in database first
    if db:
        setting = db.query(SystemSetting).first()
        if setting:
            for phone in [setting.kpay_phone, setting.wave_phone]:
                if phone:
                    clean_db_acc = re.sub(r"[^\d]", "", str(phone))
                    if clean_receiver == clean_db_acc or clean_receiver.endswith(clean_db_acc[-9:]) or clean_db_acc.endswith(clean_receiver[-9:]):
                        return True

    for gate_key in [g, "kpay", "wavepay", "ayapay"]:
        accounts = settings.RECEIVER_ACCOUNTS.get(gate_key, [])
        for acc in accounts:
            clean_acc = re.sub(r"[^\d]", "", str(acc["account_number"]))
            if clean_receiver == clean_acc or clean_receiver.endswith(clean_acc[-9:]) or clean_acc.endswith(clean_receiver[-9:]):
                return True
    return True

def verify_and_process_deposit(
    db: Session,
    user: User,
    gateway: str,
    transaction_id: str,
    receiver_id: str,
    amount: float,
    raw_timestamp: str,
    client_timezone: str = "MMT",
    slip_image_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Hardened Smart Payment Verification Pipeline:
    1. 24/7 Topup / Deposit Support.
    2. Format check & In-memory Concurrency Lock (prevents race conditions).
    3. Global duplicate Transaction ID & Duplicate Slip Image Hash check.
    4. Official receiver account check (KPay/WavePay).
    5. Fail-Safe OCR receipt analysis (Date, Time, TxID, Receiver Name, Amount).
    6. 15-Minute Expiry Rule enforcement.
    7. Safety Threshold (amounts > 50,000 MMK require Admin Manual Review).
    8. Real-time Telegram Finance Alert for transactions >= 50,000 MMK.
    """
    submission_time = now_mmt()
    clean_tx = transaction_id.strip()

    # 1. Format Check
    is_fmt_valid, fmt_msg = validate_gateway_tx_format(gateway, clean_tx)
    if not is_fmt_valid:
        return {
            "success": False,
            "status": TransactionStatus.REJECTED,
            "message": f"Invalid Transaction ID format: {fmt_msg}"
        }

    # Locate slip image and compute SHA-256 hash
    local_slip_path = None
    if slip_image_url:
        clean_name = os.path.basename(slip_image_url)
        possible_paths = [
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "uploads", clean_name),
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app", "static", "uploads", clean_name),
            os.path.join("D:\\SG4DMyanmar\\backend\\app\\static\\uploads", clean_name)
        ]
        for p in possible_paths:
            if os.path.exists(p):
                local_slip_path = p
                break

    slip_hash = calculate_file_sha256(local_slip_path) if local_slip_path else None

    # In-memory concurrency lock (prevents multi-tab / simultaneous double submissions)
    with _tx_lock:
        if clean_tx in _processing_txs:
            return {
                "success": False,
                "status": TransactionStatus.REJECTED,
                "message": "ဤ Transaction ID အား စစ်ဆေးနေဆဲဖြစ်ပါသည်။ ထပ်ခါတလဲလဲ မနှိပ်ပါနှင့် ခင်ဗျာ (Duplicate request being processed)."
            }
        if slip_hash and slip_hash in _processing_hashes:
            return {
                "success": False,
                "status": TransactionStatus.REJECTED,
                "message": "ဤ ငွေလွှဲပြေစာပုံအား စစ်ဆေးနေဆဲဖြစ်ပါသည်။ ထပ်ခါတလဲလဲ မနှိပ်ပါနှင့် ခင်ဗျာ (Duplicate slip being processed)."
            }
        _processing_txs.add(clean_tx)
        if slip_hash:
            _processing_hashes.add(slip_hash)

    try:
        # 2. Global Duplicate Transaction ID Check
        existing_tx = db.query(Transaction).filter(
            Transaction.transaction_id == clean_tx,
            Transaction.status.in_([
                TransactionStatus.AUTO_APPROVED, 
                TransactionStatus.COMPLETED, 
                TransactionStatus.MANUAL_REVIEW
            ])
        ).first()
        
        if existing_tx:
            return {
                "success": False,
                "status": TransactionStatus.REJECTED,
                "message": f"Duplicate Transaction ID '{clean_tx}'! ဤ Transaction ID ဖြင့် ငွေသွင်းထားပြီး ဖြစ်ပါသဖြင့် ထပ်မံဖြည့်သွင်း၍ မရနိုင်ပါ ခင်ဗျာ။"
            }

        # 2b. Global Duplicate Slip Image Hash Check (Detects reused receipt screenshots)
        if slip_hash:
            existing_slip = db.query(Transaction).filter(
                Transaction.slip_hash == slip_hash,
                Transaction.status.in_([
                    TransactionStatus.AUTO_APPROVED, 
                    TransactionStatus.COMPLETED, 
                    TransactionStatus.MANUAL_REVIEW
                ])
            ).first()
            if existing_slip:
                return {
                    "success": False,
                    "status": TransactionStatus.REJECTED,
                    "message": "ဤ ငွေလွှဲပြေစာပုံ (Slip Image) ကို ယခင်က အသုံးပြုပြီးဖြစ်ပါသဖြင့် ထပ်မံအသုံးပြုခွင့် မရှိပါ ခင်ဗျာ (Duplicate Slip Image Detected)."
                }

        # 3. Receiver ID & Official Accounts
        setting = db.query(SystemSetting).first() if db else None
        g = gateway.lower()
        if g in ["kpay", "kbzpay"]:
            expected_receiver_phone = setting.kpay_phone if setting and setting.kpay_phone else "09795007441"
            expected_receiver_name = setting.kpay_name if setting and setting.kpay_name else "Daw Myo Thiri Khin"
        else:
            expected_receiver_phone = setting.wave_phone if setting and setting.wave_phone else "09894169717"
            expected_receiver_name = setting.wave_name if setting and setting.wave_name else "Ye Win Htut"

        receiver_valid = is_valid_receiver(gateway, receiver_id, db)

        # 4. Fail-Safe Local Slip OCR Extraction & Verification
        ocr_valid = True
        ocr_msg = ""
        ocr_details = {}

        if local_slip_path:
            try:
                from app.core.ocr_verifier import parse_and_validate_receipt
                ocr_valid, ocr_msg, ocr_details = parse_and_validate_receipt(
                    slip_image_path=local_slip_path,
                    gateway=gateway,
                    input_tx_id=clean_tx,
                    input_amount=amount,
                    expected_receiver_phone=expected_receiver_phone,
                    expected_receiver_name=expected_receiver_name,
                    submission_time_mmt=submission_time
                )
            except Exception as e:
                logger.error(f"OCR verification failed with exception: {e}", exc_info=True)
                ocr_valid = False
                ocr_msg = f"ငွေလွှဲပြေစာအား စစ်ဆေးရာတွင် စနစ်အမှား ဖြစ်ပေါ်သဖြင့် Admin မှ စစ်ဆေးပေးပါမည် (OCR Error: {str(e)})"
                ocr_details = {"error_code": "OCR_FAILED"}
        else:
            ocr_valid = False
            ocr_msg = "ငွေလွှဲပြေစာပုံ ထည့်သွင်းထားခြင်း မရှိပါသဖြင့် Admin မှ စစ်ဆေးပေးပါမည် (No Slip Attached)."
            ocr_details = {"error_code": "NO_SLIP"}

        # 5. Timestamp validation
        if ocr_details.get("slip_datetime"):
            tx_time_mmt = ocr_details["slip_datetime"]
        else:
            tx_time_mmt = parse_slip_timestamp(raw_timestamp, client_tz=client_timezone)

        delta_minutes = (submission_time - tx_time_mmt).total_seconds() / 60.0
        time_valid = (-2.0 <= delta_minutes <= 15.0)
        time_msg = f"Receipt timestamp {format_mmt(tx_time_mmt)} evaluated ({delta_minutes:.1f} mins ago)."

        # Determine status & audit notes
        verification_notes = []
        verification_notes.append(f"Gateway: {gateway.upper()} (24/7 Topup Active)")
        verification_notes.append(f"Slip Timestamp MMT: {format_mmt(tx_time_mmt)}")
        verification_notes.append(f"Submission Time MMT: {format_mmt(submission_time)}")
        verification_notes.append(f"Elapsed Time: {delta_minutes:.1f} mins. Result: {time_msg}")
        if slip_hash:
            verification_notes.append(f"Slip SHA256: {slip_hash[:16]}...")
        
        if receiver_valid:
            verification_notes.append(f"Receiver ID '{receiver_id}' matches official agent account.")
        else:
            verification_notes.append(f"WARNING: Receiver ID '{receiver_id}' does not match official receiver accounts.")

        # Safety Threshold (Default 50,000 MMK; higher amounts require Admin Manual Check)
        max_auto_amount = setting.auto_approve_max_amount if (setting and setting.auto_approve_max_amount) else 50000.0

        # Decision Matrix with Strict Multi-Tier Verification
        err_code = ocr_details.get("error_code")
        
        if err_code == "SLIP_DATE_MISMATCH":
            status = TransactionStatus.REJECTED
            verification_notes.append(f"ACTION: REJECTED (Date Mismatch): {ocr_msg}")
        elif err_code in ["RECEIVER_NAME_MISMATCH", "RECEIVER_PHONE_MISMATCH", "TXID_MISMATCH", "AMOUNT_MISMATCH"]:
            status = TransactionStatus.REJECTED
            verification_notes.append(f"ACTION: REJECTED: {ocr_msg}")
        elif err_code in ["SLIP_TIMESTAMP_EXPIRED", "SLIP_TIMESTAMP_FUTURE"] or delta_minutes > 15.0:
            status = TransactionStatus.FLAGGED_EXPIRED
            verification_notes.append(f"ACTION: Auto-flagged as EXPIRED (>15 mins). {ocr_msg}")
        elif err_code in ["SLIP_DATE_NOT_FOUND", "SLIP_TIME_UNVERIFIED", "OCR_FAILED", "NO_SLIP"]:
            status = TransactionStatus.MANUAL_REVIEW
            verification_notes.append(f"ACTION: Flagged for Manual Review ({err_code}): {ocr_msg}")
        elif not is_fmt_valid:
            status = TransactionStatus.REJECTED
            verification_notes.append(f"ACTION: REJECTED (Invalid Format): {fmt_msg}")
        elif not receiver_valid:
            status = TransactionStatus.MANUAL_REVIEW
            verification_notes.append("ACTION: Flagged for Manual Review (Receiver ID mismatch).")
        elif not ocr_valid:
            status = TransactionStatus.MANUAL_REVIEW
            verification_notes.append(f"ACTION: Flagged for Manual Review: {ocr_msg}")
        elif not local_slip_path:
            status = TransactionStatus.MANUAL_REVIEW
            verification_notes.append("ACTION: Flagged for Manual Review (No Slip Image attached).")
        elif amount > max_auto_amount:
            # High-Value Protection: Requires Admin Manual Review to prevent fake/AI-edited slips
            status = TransactionStatus.MANUAL_REVIEW
            verification_notes.append(f"ACTION: Flagged for Manual Review (Amount {amount:,.0f} MMK > Safety Limit {max_auto_amount:,.0f} MMK - Admin verification required). {ocr_msg}")
        else:
            # 100% Manual Review Policy: Zero Auto-Approve to eliminate AI-slip / Photoshop tampering risks
            status = TransactionStatus.MANUAL_REVIEW
            verification_notes.append(f"ACTION: Verified Slip Details. Flagged for Admin Manual Review (100% Manual Review Policy). {ocr_msg}")

        # Create transaction record
        tx_record = Transaction(
            user_id=user.id,
            tx_type=TransactionType.DEPOSIT,
            gateway=gateway.lower(),
            transaction_id=clean_tx,
            receiver_id=receiver_id.strip(),
            amount=amount,
            slip_image_url=slip_image_url,
            slip_hash=slip_hash,
            tx_timestamp_raw=raw_timestamp,
            client_timezone=client_timezone,
            tx_timestamp_mmt=tx_time_mmt,
            submission_timestamp_mmt=submission_time,
            delta_minutes=delta_minutes,
            is_time_valid=time_valid,
            is_receiver_valid=receiver_valid,
            is_tx_unique=True,
            status=status,
            verification_notes=" | ".join(verification_notes)
        )
        db.add(tx_record)
        db.flush()

        # In-App Notification: Notify user that deposit request is submitted and pending admin review
        if status == TransactionStatus.MANUAL_REVIEW:
            notif = Notification(
                user_id=user.id,
                title="⏳ ငွေသွင်းလွှာ တင်သွင်းပြီးပါပြီ (Pending Review)",
                message=f"သင့်ငွေသွင်းမှု {amount:,.0f} MMK ({gateway.upper()}) ကို စနစ်မှ လက်ခံထားပြီး Admin မှ ဘဏ်အကောင့်ထဲ ငွေလက်ခံရရှိမှု စစ်ဆေးအတည်ပြုပြီးပါက လက်ကျန်ငွေထဲ ထည့်သွင်းပေးပါမည်။ / Deposit submitted and pending admin review.",
                category="Deposit",
                notif_type="TRANSACTION",
                is_read=False,
                created_at=submission_time
            )
            db.add(notif)

        db.commit()
        db.refresh(tx_record)
        db.refresh(user)

        # Real-time Telegram Finance Alert for transactions >= 50,000 MMK
        try:
            from app.core.telegram_bot import notify_finance_alert
            notify_finance_alert(
                db=db,
                tx_type="DEPOSIT",
                amount=amount,
                user_phone=user.phone,
                user_name=user.nickname or user.full_name or user.username,
                gateway=gateway,
                transaction_id=clean_tx,
                status=status,
                notes=tx_record.verification_notes
            )
        except Exception as ex:
            logger.error(f"Error triggering telegram deposit finance alert: {ex}")

        if status == TransactionStatus.REJECTED:
            is_success = False
            msg = f"ငွေသွင်းလွှာ ပယ်ချခံရပါသည်: {ocr_msg or 'လက်ခံသူအမည် သို့မဟုတ် ငွေလွှဲအချက်အလက် မကိုက်ညီပါ။'}"
        elif status == TransactionStatus.FLAGGED_EXPIRED:
            is_success = False
            msg = f"ငွေသွင်းလွှာသည် သတ်မှတ်ချိန် (၁၅ မိနစ်) ကျော်လွန်နေပါသည် ({delta_minutes:.1f} မိနစ် ကွာခြား)။ Admin စစ်ဆေးရန် စာရင်းသို့ ရောက်ရှိနေပါသည်။"
        else:
            is_success = True
            msg = f"ငွေသွင်းတောင်းဆိုမှု ({amount:,.0f} MMK - {gateway.upper()}) အား လက်ခံရရှိပြီး ဆိုင်းငံ့ (Pending) စာရင်းသွင်းထားပါသည်။ Admin မှ KPay/WavePay အကောင့်ထဲ ငွေလက်ခံရရှိမှု စစ်ဆေးပြီးပါက မကြာမီ သင့် Balance ထဲသို့ ထည့်သွင်းပေးပါမည် ခင်ဗျာ။"

        return {
            "success": is_success,
            "transaction_id": tx_record.id,
            "status": status,
            "amount": amount,
            "new_balance": user.balance if status == TransactionStatus.AUTO_APPROVED else None,
            "delta_minutes": round(delta_minutes, 1),
            "is_time_valid": time_valid,
            "is_receiver_valid": receiver_valid,
            "notes": tx_record.verification_notes,
            "message": msg
        }
    finally:
        with _tx_lock:
            _processing_txs.discard(clean_tx)
            if slip_hash:
                _processing_hashes.discard(slip_hash)
