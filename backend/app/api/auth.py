from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserRole, Notification
from app.models.settings import SystemSetting
from app.schemas.user import UserRegister, UserLogin, UserResponse, TokenResponse
from app.core.security import hash_password, verify_password, create_access_token, get_current_user
from app.core.timezone_utils import now_mmt, MMT_TZ

router = APIRouter(prefix="/auth", tags=["Authentication & Agent Referral"])

import secrets
import time
import threading
from collections import defaultdict
from datetime import timedelta
from app.config import settings
from app.models.user import User, UserRole, Notification, TelegramVerification, TelegramChatMapping
from app.schemas.user import (
    UserRegister, 
    UserLogin, 
    UserResponse, 
    TokenResponse,
    TelegramOtpRequest,
    TelegramOtpVerifyRequest,
    ResetPasswordRequest,
    ChangePasswordRequest
)
from app.core.telegram_bot import normalize_phone, generate_and_save_otp, send_otp_to_telegram

# Thread-safe in-memory rate limiting & brute-force guards for OTP endpoints
_otp_guard_lock = threading.Lock()
_otp_request_timestamps = defaultdict(list)  # phone -> [epoch_ts, ...]
_otp_failed_attempts = defaultdict(list)     # phone -> [epoch_ts, ...]
OTP_REQ_COOLDOWN_SECONDS = 30
OTP_REQ_MAX_PER_15M = 5
OTP_MAX_FAILED_ATTEMPTS_15M = 5
OTP_WINDOW_SECONDS = 15 * 60


def _check_otp_request_rate_limit(phone: str):
    now_ts = time.time()
    cutoff = now_ts - OTP_WINDOW_SECONDS
    with _otp_guard_lock:
        recent = [t for t in _otp_request_timestamps[phone] if t > cutoff]
        if recent and (now_ts - recent[-1]) < OTP_REQ_COOLDOWN_SECONDS:
            wait_sec = int(OTP_REQ_COOLDOWN_SECONDS - (now_ts - recent[-1])) + 1
            raise HTTPException(
                status_code=429,
                detail=f"OTP ကုဒ် ထပ်မံတောင်းယူရန် {wait_sec} စက္ကန့် စောင့်ဆိုင်းပေးပါ (Please wait {wait_sec}s before requesting another OTP)."
            )
        if len(recent) >= OTP_REQ_MAX_PER_15M:
            raise HTTPException(
                status_code=429,
                detail="OTP တောင်းယူမှု အကြိမ်ရေ ပြည့်သွားပါပြီ။ ၁၅ မိနစ်ခန့်ကြာမှ ထပ်မံကြိုးစားပါ (Too many OTP requests)."
            )
        recent.append(now_ts)
        _otp_request_timestamps[phone] = recent


def _check_otp_not_locked(phone: str):
    now_ts = time.time()
    cutoff = now_ts - OTP_WINDOW_SECONDS
    with _otp_guard_lock:
        recent_fails = [t for t in _otp_failed_attempts[phone] if t > cutoff]
        _otp_failed_attempts[phone] = recent_fails
        if len(recent_fails) >= OTP_MAX_FAILED_ATTEMPTS_15M:
            raise HTTPException(
                status_code=429,
                detail="OTP ကုဒ် မှားယွင်းရိုက်ထည့်မှု များပြားနေပါသည်။ ၁၅ မိနစ်ခန့်ကြာမှ OTP အသစ်ပြန်တောင်းပါ (Too many failed OTP attempts)."
            )


def _record_otp_failure(phone: str, db: Session):
    now_ts = time.time()
    cutoff = now_ts - OTP_WINDOW_SECONDS
    invalidate = False
    with _otp_guard_lock:
        recent_fails = [t for t in _otp_failed_attempts[phone] if t > cutoff]
        recent_fails.append(now_ts)
        _otp_failed_attempts[phone] = recent_fails
        if len(recent_fails) >= OTP_MAX_FAILED_ATTEMPTS_15M:
            invalidate = True
    if invalidate:
        db.query(TelegramVerification).filter(
            TelegramVerification.phone == phone,
            TelegramVerification.is_used == False
        ).update({"is_used": True, "purpose": "locked_out"})
        db.commit()


def _clear_otp_failures(phone: str):
    with _otp_guard_lock:
        _otp_failed_attempts.pop(phone, None)


@router.post("/telegram/request-otp")
def request_telegram_otp(req: TelegramOtpRequest, db: Session = Depends(get_db)):
    """
    Generates a 6-digit OTP verification code for the phone number.
    Pushes via Telegram Bot (@SG4DMyanmarBot) to the user's verified Telegram chat.
    Blocks public OTP reset for ADMIN accounts and enforces rate limits.
    """
    clean_identifier = req.phone.strip()
    if not clean_identifier:
        raise HTTPException(status_code=400, detail="Phone number or User ID is required.")

    purpose = (req.purpose or "register").strip().lower()
    if purpose not in ("register", "reset_password"):
        purpose = "register"

    # If requested for forgot_password, check if user exists in the system FIRST
    if purpose == "reset_password":
        existing_user = db.query(User).filter(
            (User.phone == clean_identifier) | 
            (User.username == clean_identifier) |
            (User.phone == normalize_phone(clean_identifier))
        ).first()
        if not existing_user:
            raise HTTPException(
                status_code=404,
                detail="အကောင့်ရှာမတွေ့ပါ (User ID / ဖုန်းနံပါတ် မှားယွင်းနေပါသည်)။ အကောင့်မရှိသေးပါက ကျေးဇူးပြု၍ စာရင်းသွင်းရန် (Sign Up) တွင် အကောင့်အသစ်ဖွင့်ပေးပါ ခင်ဗျာ။"
            )
        if existing_user.role == UserRole.ADMIN:
            raise HTTPException(
                status_code=403,
                detail="Admin အကောင့်များ၏ စကားဝှက်ကို Telegram OTP ဖြင့် ပြန်လည်သတ်မှတ်ခွင့် မပြုပါ (Admin password reset via Telegram OTP is disabled for security)."
            )
        clean_phone = normalize_phone(existing_user.phone)
    else:
        clean_phone = normalize_phone(clean_identifier)

    _check_otp_request_rate_limit(clean_phone)

    # 1. Generate & save OTP code in database
    otp_code = generate_and_save_otp(db, clean_phone, purpose=purpose)

    # 2. Push directly to user's Telegram if chat_id is already verified & linked
    telegram_res = send_otp_to_telegram(db, clean_phone, otp_code, purpose=purpose)

    return {
        "success": True,
        "phone": clean_phone,
        "message": telegram_res["message"],
        "telegram_bot": f"@{settings.TELEGRAM_BOT_USERNAME}",
        "deep_link": telegram_res["deep_link"],
        "sent_via_bot": telegram_res["sent_via_bot"],
        "expires_in_minutes": 10
    }

@router.post("/telegram/verify-otp")
def verify_telegram_otp(req: TelegramOtpVerifyRequest, db: Session = Depends(get_db)):
    """Verifies the Telegram OTP code for registration / phone verification."""
    clean_phone = normalize_phone(req.phone)
    clean_code = req.code.strip()

    _check_otp_not_locked(clean_phone)

    record = db.query(TelegramVerification).filter(
        TelegramVerification.phone == clean_phone,
        TelegramVerification.purpose == "register",
        TelegramVerification.is_used == False
    ).order_by(TelegramVerification.id.desc()).with_for_update().first()

    if not record or not secrets.compare_digest(str(record.code), clean_code):
        _record_otp_failure(clean_phone, db)
        raise HTTPException(status_code=400, detail="Invalid OTP verification code.")

    # Safely compare expires_at against now_mmt
    exp = record.expires_at
    now = now_mmt()
    if hasattr(exp, 'tzinfo') and exp.tzinfo is not None:
        exp = exp.replace(tzinfo=None)
    if hasattr(now, 'tzinfo') and now.tzinfo is not None:
        now = now.replace(tzinfo=None)
    if exp < now:
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")

    _clear_otp_failures(clean_phone)
    record.is_used = True
    record.purpose = "register_verified"
    record.expires_at = now + timedelta(minutes=30)  # Valid 30 min to complete /register submission
    
    # Mark user as verified if already exists
    user = db.query(User).filter(User.phone == clean_phone).first()
    if user:
        user.is_verified = True

    db.commit()

    return {
        "success": True,
        "phone": clean_phone,
        "verified": True,
        "message": "Phone number successfully verified via Telegram!"
    }

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Resets non-admin user password using a Telegram reset_password OTP code.
    """
    clean_identifier = req.phone.strip()
    clean_code = req.otp_code.strip()

    user = db.query(User).filter(
        (User.phone == clean_identifier) | 
        (User.username == clean_identifier) |
        (User.phone == normalize_phone(clean_identifier))
    ).with_for_update().first()
    if not user:
        raise HTTPException(
            status_code=404, 
            detail="အကောင့်ရှာမတွေ့ပါ (User ID / ဖုန်းနံပါတ် မှားယွင်းနေပါသည်)။ ကျေးဇူးပြု၍ စာရင်းသွင်းရန် (Sign Up) တွင် အကောင့်အသစ်ဖွင့်ပေးပါ ခင်ဗျာ။"
        )
    if user.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Admin အကောင့်များ၏ စကားဝှက်ကို Telegram OTP ဖြင့် ပြန်လည်သတ်မှတ်ခွင့် မပြုပါ (Admin password reset via Telegram OTP is disabled for security)."
        )

    clean_phone = normalize_phone(user.phone)
    _check_otp_not_locked(clean_phone)

    record = db.query(TelegramVerification).filter(
        TelegramVerification.phone == clean_phone,
        TelegramVerification.purpose == "reset_password",
        TelegramVerification.is_used == False
    ).order_by(TelegramVerification.id.desc()).with_for_update().first()

    if not record or not secrets.compare_digest(str(record.code), clean_code):
        _record_otp_failure(clean_phone, db)
        raise HTTPException(status_code=400, detail="Invalid OTP verification code.")

    exp = record.expires_at
    now = now_mmt()
    if hasattr(exp, 'tzinfo') and exp.tzinfo is not None:
        exp = exp.replace(tzinfo=None)
    if hasattr(now, 'tzinfo') and now.tzinfo is not None:
        now = now.replace(tzinfo=None)
    if exp < now:
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")

    _clear_otp_failures(clean_phone)
    record.is_used = True
    record.purpose = "reset_password_used"
    user.hashed_password = hash_password(req.new_password)
    db.commit()

    return {
        "success": True,
        "phone": clean_phone,
        "message": "Password successfully reset! You can now log in with your new password."
    }

@router.post("/register", response_model=TokenResponse)
def register(req: UserRegister, db: Session = Depends(get_db)):
    clean_phone = normalize_phone(req.phone)
    clean_username = req.username.strip() if req.username else None

    # Check phone uniqueness
    existing_phone = db.query(User).filter(User.phone == clean_phone).first()
    if existing_phone:
        raise HTTPException(status_code=400, detail="Phone number is already registered.")

    # Check username uniqueness if provided
    if clean_username:
        existing_username = db.query(User).filter(User.username == clean_username).first()
        if existing_username:
            raise HTTPException(status_code=400, detail=f"Username '{clean_username}' is already taken. Please choose another.")

    # 1. Mandatory Referral Code Enforcement
    clean_ref = req.referral_code.strip().upper()
    agent = db.query(User).filter(
        User.agent_code == clean_ref,
        User.role.in_([UserRole.AGENT, UserRole.ADMIN]),
        User.is_active == True
    ).first()

    if not agent:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid Agent/Referral code '{clean_ref}'! Registration requires an authorized active Agent code."
        )

    # 2. Server-side Telegram OTP verification enforcement
    now = now_mmt()
    verified_rec = db.query(TelegramVerification).filter(
        TelegramVerification.phone == clean_phone,
        TelegramVerification.purpose == "register_verified",
        TelegramVerification.is_used == True
    ).order_by(TelegramVerification.id.desc()).with_for_update().first()

    if not verified_rec:
        raise HTTPException(
            status_code=400,
            detail="တယ်လီဂရမ် OTP အတည်ပြုချက် လိုအပ်ပါသည် (Telegram OTP verification is required before registering)."
        )

    v_exp = verified_rec.expires_at
    if hasattr(v_exp, 'tzinfo') and v_exp.tzinfo is not None:
        v_exp = v_exp.replace(tzinfo=None)
    if v_exp < now:
        raise HTTPException(
            status_code=400,
            detail="Telegram OTP အတည်ပြုချက် သက်တမ်းကုန်ဆုံးသွားပါပြီ။ ကျေးဇူးပြု၍ OTP အသစ်တောင်းယူ အတည်ပြုပေးပါ။"
        )

    verified_rec.purpose = "register_consumed"
    is_verified = True

    # Check if Telegram chat mapping exists
    mapping = db.query(TelegramChatMapping).filter(TelegramChatMapping.phone == clean_phone).first()
    telegram_id = mapping.chat_id if mapping else None
    telegram_username = mapping.telegram_username if mapping else None

    # 3. Create User linked to Agent
    user = User(
        username=clean_username or req.full_name.strip(),
        phone=clean_phone,
        full_name=req.full_name.strip(),
        hashed_password=hash_password(req.password),
        role=UserRole.USER,
        country_code=req.country_code or "+95",
        balance=0.0,
        is_verified=is_verified,
        telegram_id=telegram_id,
        telegram_username=telegram_username,
        referred_by_code=agent.agent_code,
        agent_id=agent.id,
        created_at=now_mmt()
    )
    db.add(user)
    db.flush()

    # Welcome notification
    welcome_notif = Notification(
        user_id=user.id,
        title="🇲🇲 Welcome to SG4D Myanmar!",
        message=f"Account created successfully for {user.username} under Agent {agent.full_name} ({agent.agent_code}). Deposit via KPay, WavePay or AYA Pay to start placing bets!",
        notif_type="SYSTEM",
        is_read=False
    )
    db.add(welcome_notif)

    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/login", response_model=TokenResponse)
def login(req: UserLogin, db: Session = Depends(get_db)):
    # Support login with either username or phone number (or identifier)
    login_id = (req.identifier or req.username or req.phone or "").strip()
    if not login_id:
        raise HTTPException(
            status_code=400, 
            detail="Username or Phone number is required for login."
        )

    # Lookup user by either username or phone number (also alias michael/admin for ADMIN)
    clean_id = login_id.lower()
    if clean_id in ["admin", "michael"]:
        user = db.query(User).filter(
            (User.username.ilike(login_id)) | (User.phone == login_id)
        ).first()
        if not user:
            user = db.query(User).filter(User.role == UserRole.ADMIN).order_by(User.id.asc()).first()
    else:
        user = db.query(User).filter(
            (User.phone == login_id) | (User.username == login_id) | (User.username.ilike(login_id))
        ).first()

    is_valid_pw = False
    if user:
        is_valid_pw = verify_password(req.password, user.hashed_password)

    if not user or not is_valid_pw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/phone number or password."
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated.")
    if getattr(user, "is_suspended", False):
        raise HTTPException(
            status_code=403,
            detail="သင့်အကောင့်အား ယာယီဆိုင်းငံ့ထားပါသည် (Account is suspended). ကျေးဇူးပြု၍ Customer Service သို့ ဆက်သွယ်ပါ။"
        )

    # Login requires only valid credentials (User is already bound to Agent from registration)
    token = create_access_token(user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserResponse)
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    setting = db.query(SystemSetting).first()
    is_credit_enabled = bool(setting.is_agent_credit_enabled) if setting and hasattr(setting, "is_agent_credit_enabled") else False
    current_user.is_agent_credit_enabled = is_credit_enabled
    return current_user

@router.get("/verify-agent-code/{code}")
def verify_agent_code(code: str, db: Session = Depends(get_db)):
    """Verifies if an agent code is valid and active before submitting registration."""
    clean_code = code.strip().upper()
    agent = db.query(User).filter(
        User.agent_code == clean_code,
        User.role.in_([UserRole.AGENT, UserRole.ADMIN]),
        User.is_active == True
    ).first()
    if not agent:
        return {"valid": False, "message": "Agent code not found or inactive."}
    return {
        "valid": True,
        "agent_name": agent.full_name,
        "agent_code": agent.agent_code,
        "message": f"Verified Agent: {agent.full_name} ({agent.agent_code})"
    }

@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Allows authenticated user to change their password."""
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=400, 
            detail="လက်ရှိ စကားဝှက် မှားယွင်းနေပါသည် (Current password is incorrect)."
        )
    
    if len(req.new_password) < 6:
        raise HTTPException(
            status_code=400, 
            detail="စကားဝှက်အသစ်သည် အနည်းဆုံး ၆ လုံး ရှိရပါမည် (Password must be at least 6 characters)."
        )

    current_user.hashed_password = hash_password(req.new_password)
    db.commit()
    return {
        "success": True, 
        "message": "စကားဝှက် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ (Password changed successfully)!"
    }

@router.get("/agent-summary")
def get_current_agent_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns Agent specific metrics for logged in agent on frontend application:
    - Downline players count and list
    - Credit Limit, Used Credit, Available Credit
    - Pending 30% commission (Tuesday release) & Settled Commission
    - Recent commission history
    """
    from app.models.user import AgentCommissionLog
    from app.models.bet import BetSlip
    from sqlalchemy import func

    if current_user.role != UserRole.AGENT:
        return {"is_agent": False}

    agent_code = current_user.agent_code or "AGT8899"
    downline_players = db.query(User).filter(
        (User.referred_by_code == agent_code) | (User.agent_id == current_user.id),
        User.is_simulated == False,
        User.role == UserRole.USER
    ).order_by(User.id.desc()).all()

    pending_comm = db.query(func.coalesce(func.sum(AgentCommissionLog.commission_amount), 0.0)).filter(
        AgentCommissionLog.agent_id == current_user.id,
        AgentCommissionLog.is_settled == False
    ).scalar()

    settled_comm = db.query(func.coalesce(func.sum(AgentCommissionLog.commission_amount), 0.0)).filter(
        AgentCommissionLog.agent_id == current_user.id,
        AgentCommissionLog.is_settled == True
    ).scalar()

    recent_logs = (
        db.query(AgentCommissionLog, User, BetSlip)
        .join(User, AgentCommissionLog.player_id == User.id)
        .outerjoin(BetSlip, AgentCommissionLog.bet_slip_id == BetSlip.id)
        .filter(AgentCommissionLog.agent_id == current_user.id)
        .order_by(AgentCommissionLog.id.desc())
        .limit(30)
        .all()
    )

    logs_data = []
    for c, player, slip in recent_logs:
        logs_data.append({
            "id": c.id,
            "player_name": "Direct Self-Bet" if player.id == current_user.id else (player.full_name or player.nickname or "Player"),
            "player_phone": player.phone,
            "voucher": slip.slip_code if slip else f"SLIP-{c.bet_slip_id}",
            "bet_total_stake": float(c.bet_total_stake),
            "commission_rate": f"{int((c.commission_rate or 0.15) * 100)}%",
            "commission_amount": float(c.commission_amount),
            "is_settled": bool(c.is_settled),
            "settlement_status": c.settlement_status or ("SETTLED" if c.is_settled else "PENDING"),
            "created_at": c.created_at.strftime("%d/%m/%Y %I:%M %p") if c.created_at else ""
        })

    from app.core.agent_level import evaluate_and_update_agent_level
    lvl_info = evaluate_and_update_agent_level(current_user, db, commit=False, allow_mutate=False)
    available_credit = max(0.0, (current_user.credit_limit or 0.0) - (current_user.used_credit or 0.0))

    setting = db.query(SystemSetting).first()
    is_credit_enabled = bool(setting.is_agent_credit_enabled) if setting and hasattr(setting, "is_agent_credit_enabled") else False

    return {
        "is_agent": True,
        "is_agent_credit_enabled": is_credit_enabled,
        "credit_status": "ENABLED" if is_credit_enabled else "SUSPENDED",
        "level": current_user.level or "Tier 1",
        "level_info": lvl_info,
        "commission_rate": lvl_info.get("commission_rate_str", "15%"),
        "commission_rate_val": lvl_info.get("commission_rate", 0.15),
        "commission_rate_str": lvl_info.get("commission_rate_str", "15%"),
        "agent_code": agent_code,
        "agent_name": current_user.full_name,
        "phone": current_user.phone,
        "balance": float(current_user.balance or 0.0),
        "security_deposit": float(current_user.security_deposit or 0.0),
        "credit_limit": float(current_user.credit_limit or 0.0),
        "used_credit": float(current_user.used_credit or 0.0),
        "available_credit": float(available_credit),
        "is_betting_locked": bool(current_user.is_betting_locked),
        "settlement_status": current_user.settlement_status or "SETTLED",
        "pending_commission": float(pending_comm),
        "settled_commission": float(settled_comm),
        "downline_players_count": len(downline_players),
        "downline_players": [
            {
                "id": p.id,
                "name": p.full_name or p.nickname or "Player",
                "phone": p.phone,
                "joined_at": p.created_at.strftime("%d/%m/%Y") if p.created_at else ""
            } for p in downline_players[:20]
        ],
        "recent_commissions": logs_data
    }

