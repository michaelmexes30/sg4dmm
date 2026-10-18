import os
import re
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
    g = gateway.lower()
    clean_receiver = re.sub(r"[^\d]", "", receiver_id.strip())
    
    # Check dynamic SystemSetting in database first
    if db:
        setting = db.query(SystemSetting).first()
        if setting:
            if g in ["kpay", "kbzpay"] and setting.kpay_phone:
                clean_db_acc = re.sub(r"[^\d]", "", setting.kpay_phone)
                if clean_receiver == clean_db_acc or clean_receiver.endswith(clean_db_acc[-9:]):
                    return True
            elif g in ["wavepay", "wave"] and setting.wave_phone:
                clean_db_acc = re.sub(r"[^\d]", "", setting.wave_phone)
                if clean_receiver == clean_db_acc or clean_receiver.endswith(clean_db_acc[-9:]):
                    return True

    accounts = settings.RECEIVER_ACCOUNTS.get(g, [])
    for acc in accounts:
        clean_acc = re.sub(r"[^\d]", "", acc["account_number"])
        if clean_receiver == clean_acc or clean_receiver.endswith(clean_acc[-9:]):
            return True
    return False

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
    Smart Payment Verification Pipeline:
    1. Checks Gateway Operating Hours (08:00 AM - 08:00 PM MMT).
    2. Format check & Duplicate TxID check.
    3. Receiver ID verification against official agent accounts.
    4. Timezone normalization to MMT (UTC+6:30).
    5. 15-Minute Expiry Rule enforcement.
    6. Instant Auto-Approval if all conditions match.
    """
    submission_time = now_mmt()
    
    # 1. Operating Hours Check (8:00 AM to 8:00 PM MMT)
    is_open, hours_msg = is_within_gateway_operating_hours(submission_time)
    if not is_open:
        return {
            "success": False,
            "status": TransactionStatus.REJECTED,
            "message": f"Payment channels are closed. {hours_msg}"
        }

    # 2. Format Check
    is_fmt_valid, fmt_msg = validate_gateway_tx_format(gateway, transaction_id)
    if not is_fmt_valid:
        return {
            "success": False,
            "status": TransactionStatus.REJECTED,
            "message": f"Invalid Transaction ID format: {fmt_msg}"
        }

    # 3. Duplicate Check
    existing_tx = db.query(Transaction).filter(
        Transaction.transaction_id == transaction_id.strip(),
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
            "message": f"Duplicate Transaction ID '{transaction_id}'! This transaction has already been submitted."
        }

    # 4. Receiver ID & Official Accounts
    setting = db.query(SystemSetting).first() if db else None
    g = gateway.lower()
    if g in ["kpay", "kbzpay"]:
        expected_receiver_phone = setting.kpay_phone if setting and setting.kpay_phone else "09795007441"
        expected_receiver_name = setting.kpay_name if setting and setting.kpay_name else "Daw Myo Thiri Khin"
    else:
        expected_receiver_phone = setting.wave_phone if setting and setting.wave_phone else "09894169717"
        expected_receiver_name = setting.wave_name if setting and setting.wave_name else "Ye Win Htut"

    receiver_valid = is_valid_receiver(gateway, receiver_id, db)

    # 4b. Local Slip OCR Extraction & Verification
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

    from app.core.ocr_verifier import parse_and_validate_receipt
    
    ocr_valid = True
    ocr_msg = ""
    ocr_details = {}

    if local_slip_path:
        ocr_valid, ocr_msg, ocr_details = parse_and_validate_receipt(
            slip_image_path=local_slip_path,
            gateway=gateway,
            input_tx_id=transaction_id,
            input_amount=amount,
            expected_receiver_phone=expected_receiver_phone,
            expected_receiver_name=expected_receiver_name,
            submission_time_mmt=submission_time
        )
    else:
        ocr_valid = False
        ocr_msg = "ငွေလွှဲပြေစာပုံ မပါရှိပါသဖြင့် အလိုအလျောက်အတည်ပြုခြင်း မပြုလုပ်နိုင်ပါ (No Slip Image)."
        ocr_details = {"error_code": "NO_SLIP"}

    # 5. Timestamp validation: Prioritize true slip datetime from OCR over client form raw_timestamp
    if ocr_details.get("slip_datetime"):
        tx_time_mmt = ocr_details["slip_datetime"]
        delta_minutes = (submission_time - tx_time_mmt).total_seconds() / 60.0
        time_valid = (0.0 <= delta_minutes <= 15.0)
        time_msg = f"Receipt timestamp {format_mmt(tx_time_mmt)} evaluated ({delta_minutes:.1f} mins ago)."
    else:
        tx_time_mmt = parse_slip_timestamp(raw_timestamp, client_tz=client_timezone)
        delta_minutes = (submission_time - tx_time_mmt).total_seconds() / 60.0
        time_valid = False
        time_msg = "Receipt timestamp could not be verified from slip image."

    # Determine status & audit notes
    verification_notes = []
    verification_notes.append(f"Gateway: {gateway.upper()} (Operating Hours 08:00-20:00 OK)")
    verification_notes.append(f"Slip Timestamp MMT: {format_mmt(tx_time_mmt)}")
    verification_notes.append(f"Submission Time MMT: {format_mmt(submission_time)}")
    verification_notes.append(f"Elapsed Time: {delta_minutes:.1f} mins. Result: {time_msg}")
    
    if receiver_valid:
        verification_notes.append(f"Receiver ID '{receiver_id}' matches official agent account.")
    else:
        verification_notes.append(f"WARNING: Receiver ID '{receiver_id}' does not match official receiver accounts.")

    # Decision Matrix with Strict Multi-Tier Verification
    err_code = ocr_details.get("error_code")
    
    if err_code == "SLIP_DATE_MISMATCH":
        status = TransactionStatus.REJECTED
        verification_notes.append(f"ACTION: REJECTED (Date Mismatch): {ocr_msg}")
    elif err_code in ["RECEIVER_NAME_MISMATCH", "RECEIVER_PHONE_MISMATCH", "TXID_MISMATCH", "AMOUNT_MISMATCH"]:
        status = TransactionStatus.REJECTED
        verification_notes.append(f"ACTION: REJECTED: {ocr_msg}")
    elif err_code in ["SLIP_TIMESTAMP_EXPIRED", "SLIP_TIMESTAMP_FUTURE"]:
        status = TransactionStatus.FLAGGED_EXPIRED
        verification_notes.append(f"ACTION: Auto-flagged as EXPIRED (>15 mins). {ocr_msg or time_msg}")
    elif not time_valid or err_code in ["SLIP_DATE_NOT_FOUND", "SLIP_TIME_UNVERIFIED", "NO_SLIP", "RECEIVER_NOT_FOUND"]:
        status = TransactionStatus.MANUAL_REVIEW
        verification_notes.append(f"ACTION: Flagged for Manual Review: {ocr_msg or time_msg}")
    elif not receiver_valid:
        status = TransactionStatus.MANUAL_REVIEW
        verification_notes.append("ACTION: Flagged for Manual Review (Receiver ID mismatch).")
    elif not ocr_valid:
        status = TransactionStatus.MANUAL_REVIEW
        verification_notes.append(f"ACTION: Flagged for Manual Review: {ocr_msg}")
    else:
        status = TransactionStatus.AUTO_APPROVED
        verification_notes.append(f"ACTION: Auto-Verified & Instant Credit Approved! {ocr_msg}")

    # Create transaction record
    tx_record = Transaction(
        user_id=user.id,
        tx_type=TransactionType.DEPOSIT,
        gateway=gateway.lower(),
        transaction_id=transaction_id.strip(),
        receiver_id=receiver_id.strip(),
        amount=amount,
        slip_image_url=slip_image_url,
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

    # If AUTO_APPROVED, credit wallet and record in Financial Ledger
    if status == TransactionStatus.AUTO_APPROVED:
        user.balance += amount
        
        today_str = submission_time.strftime("%Y-%m-%d")
        ledger_entry = FinancialLedger(
            entry_type=LedgerEntryType.DEPOSIT,
            amount=amount,
            running_balance=user.balance,
            reference_id=transaction_id.strip(),
            reference_type="TRANSACTION",
            description=f"Auto-verified Deposit via {gateway.upper()} ({amount:,.0f} MMK)",
            logged_at_mmt=submission_time,
            date_str=today_str
        )
        db.add(ledger_entry)

        # Send in-app notification
        notif = Notification(
            user_id=user.id,
            title="💳 Deposit Approved & Credited!",
            message=f"Your deposit of {amount:,.0f} MMK via {gateway.upper()} has been auto-verified and credited. New balance: {user.balance:,.0f} MMK.",
            notif_type="DEPOSIT_APPROVED",
            is_read=False
        )
        db.add(notif)

        # Update Daily Summary
        daily_summary = db.query(DailyLedgerSummary).filter(DailyLedgerSummary.date_str == today_str).first()
        if not daily_summary:
            daily_summary = DailyLedgerSummary(
                date_str=today_str,
                total_deposits=amount,
                net_profit=amount,
                total_transactions_count=1,
                updated_at_mmt=submission_time
            )
            db.add(daily_summary)
        else:
            daily_summary.total_deposits += amount
            daily_summary.net_profit += amount
            daily_summary.total_transactions_count += 1
            daily_summary.updated_at_mmt = submission_time

    db.commit()
    db.refresh(tx_record)
    db.refresh(user)

    if status == TransactionStatus.AUTO_APPROVED:
        is_success = True
        msg = "Deposit instantly verified and credited to your wallet!"
    elif status == TransactionStatus.REJECTED:
        is_success = False
        msg = f"ငွေသွင်းလွှာ ပယ်ချခံရပါသည်: {ocr_msg or 'လက်ခံသူအမည် သို့မဟုတ် ငွေလွှဲအချက်အလက် မကိုက်ညီပါ။'}"
    elif status == TransactionStatus.FLAGGED_EXPIRED:
        is_success = False
        msg = f"ငွေသွင်းလွှာသည် သတ်မှတ်ချိန် (၁၅ မိနစ်) ကျော်လွန်နေပါသည် ({delta_minutes:.1f} မိနစ် ကွာခြား)။ အလိုအလျောက်အတည်ပြုခြင်းကို ရပ်ဆိုင်းထားပြီး Admin စစ်ဆေးရန် စာရင်းသို့ ရောက်ရှိနေပါသည်။"
    else:
        is_success = False
        msg = f"ငွေသွင်းလွှာကို Admin စစ်ဆေးရန် စာရင်းသို့ ပို့ထားပါသည်: {ocr_msg or 'စစ်ဆေးဆဲ'}"

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
