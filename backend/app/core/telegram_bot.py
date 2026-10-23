import os
import re
import html
import random
import logging
import threading
import time
import requests
from typing import Optional
from datetime import timedelta
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.user import User, TelegramVerification, TelegramChatMapping
from app.core.timezone_utils import now_mmt, MMT_TZ

logger = logging.getLogger("telegram_bot")
logger.setLevel(logging.INFO)

TELEGRAM_API_BASE = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"
FALLBACK_GROUP_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static", "telegram_group_id.txt")

def _save_fallback_group_id(gid: str):
    """Persists Telegram group ID to a file so it survives container restarts."""
    try:
        os.makedirs(os.path.dirname(FALLBACK_GROUP_FILE), exist_ok=True)
        with open(FALLBACK_GROUP_FILE, "w", encoding="utf-8") as f:
            f.write(str(gid).strip())
        logger.info(f"Persisted telegram_finance_group_id to file: {gid}")
    except Exception as e:
        logger.error(f"Error persisting fallback group ID: {e}")

def _get_fallback_group_id() -> Optional[str]:
    """Retrieves persisted Telegram group ID from file or env setting."""
    try:
        if os.path.exists(FALLBACK_GROUP_FILE):
            with open(FALLBACK_GROUP_FILE, "r", encoding="utf-8") as f:
                val = f.read().strip()
                if val:
                    return val
    except Exception:
        pass
    env_id = getattr(settings, "TELEGRAM_FINANCE_GROUP_ID", "")
    return env_id.strip() if env_id else None

def normalize_phone(phone: str) -> str:
    """
    Normalizes phone numbers to standard Myanmar format (09xxxxxxxxx)
    Handles: +959..., 959..., 09..., 9..., spaces, and dashes.
    """
    if not phone:
        return ""
    cleaned = re.sub(r'[\s\-\(\)\+]', '', str(phone).strip())
    if cleaned.startswith('959') and len(cleaned) >= 11:
        return '09' + cleaned[3:]
    if cleaned.startswith('9509'):
        return '09' + cleaned[4:]
    if cleaned.startswith('9') and len(cleaned) in (9, 10):
        return '0' + cleaned
    return cleaned

def send_telegram_message(chat_id: str, text: str, reply_markup: dict = None, parse_mode: str = "HTML") -> bool:
    """Sends a text message to a Telegram chat using Telegram Bot API with automatic plain-text retry if HTML fails."""
    try:
        url = f"{TELEGRAM_API_BASE}/sendMessage"
        payload = {
            "chat_id": str(chat_id),
            "text": text,
            "parse_mode": parse_mode
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup

        resp = requests.post(url, json=payload, timeout=12)
        data = resp.json()
        if not data.get("ok"):
            logger.warning(f"Telegram sendMessage failed for chat_id {chat_id}: {data}")
            # If HTML parsing failed, strip HTML tags and retry as plain text immediately
            if parse_mode == "HTML":
                logger.info(f"Retrying sendMessage for chat_id {chat_id} in plain text mode...")
                plain_text = re.sub(r'<[^>]+>', '', text)
                payload["text"] = plain_text
                payload.pop("parse_mode", None)
                fb_resp = requests.post(url, json=payload, timeout=12)
                fb_data = fb_resp.json()
                if fb_data.get("ok"):
                    logger.info(f"Plain text fallback succeeded for {chat_id}!")
                    return True
                else:
                    logger.warning(f"Plain text fallback also failed for {chat_id}: {fb_data}")
            return False
        return True
    except Exception as e:
        logger.error(f"Error calling Telegram sendMessage for {chat_id}: {e}")
        return False

def notify_finance_alert(
    db: Session,
    tx_type: str,            # "DEPOSIT" or "WITHDRAWAL"
    amount: float,
    user_phone: str,
    user_name: str,
    gateway: str,
    transaction_id: str,
    status: str,
    notes: str = ""
) -> bool:
    """
    Sends real-time Telegram alert to the designated Finance Telegram Group.
    """
    is_deposit = (tx_type.upper() == "DEPOSIT")
    # 100% Manual Review Policy: Alert for ALL requests (>= 1,000 MMK) so Admin can check bank app & approve immediately
    if amount < 1000.0:
        return False

    try:
        from app.models.settings import SystemSetting
        setting = db.query(SystemSetting).first()
        group_id = (setting.telegram_finance_group_id if setting else None) or _get_fallback_group_id()
        
        if not group_id:
            logger.info(f"Finance alert logged but no telegram_finance_group_id configured. Type: {tx_type}, Amount: {amount:,.0f} MMK, Tx: {transaction_id}")
            return False

        if setting and not setting.telegram_finance_group_id and group_id:
            setting.telegram_finance_group_id = group_id
            db.commit()

        time_str = now_mmt().strftime("%Y-%m-%d %I:%M:%S %p MMT")
        safe_name = html.escape(str(user_name or "Player"))
        safe_notes = html.escape(str(notes or ""))
        
        type_badge = "💳 <b>ငွေသွင်း (TOPUP)</b>" if is_deposit else "💸 <b>ငွေထုတ် (WITHDRAWAL)</b>"
        header = "💳 <b>SG4D TOPUP NOTIFICATION (ငွေသွင်း အသိပေးချက်)</b> 💳" if is_deposit else "💸 <b>SG4D WITHDRAWAL NOTIFICATION (ငွေထုတ်ယူမှု အသိပေးချက်)</b> 💸"
        
        if status in ["AUTO_APPROVED", "COMPLETED"]:
            status_badge = "✅ အောင်မြင် (COMPLETED)"
        elif status == "MANUAL_REVIEW":
            status_badge = "⏳ စစ်ဆေးအတည်ပြုရန် (PENDING APPROVAL)" if is_deposit else "⏳ ငွေလွှဲပေးရန် စောင့်ဆိုင်းဆဲ (PENDING TRANSFER)"
        elif status == "FLAGGED_EXPIRED":
            status_badge = "⚠️ ၁၅ မိနစ်ကျော်လွန် (EXPIRED REVIEW)"
        elif status == "REJECTED":
            status_badge = "❌ ပယ်ချထားသည် (REJECTED)"
        else:
            status_badge = f"ℹ️ {status}"

        alert_text = (
            f"{header}\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"📌 <b>အမျိုးအစား:</b> {type_badge}\n"
            f"💰 <b>ငွေပမာဏ:</b> <b>{amount:,.0f} MMK</b>\n"
            f"👤 <b>ကစားသူ:</b> {safe_name} (<code>{user_phone}</code>)\n"
            f"🏦 <b>Payment Gateway:</b> <b>{gateway.upper()}</b>\n"
            f"🔖 <b>Transaction ID:</b> <code>{transaction_id}</code>\n"
            f"📊 <b>အခြေအနေ:</b> <b>{status_badge}</b>\n"
            f"⏱️ <b>အချိန်:</b> {time_str}\n"
        )
        if safe_notes:
            alert_text += f"📝 <b>အသေးစိတ်/လက်ခံမည့်သူ:</b> <i>{safe_notes}</i>\n"
            
        if is_deposit and status == "MANUAL_REVIEW":
            alert_text += (
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"🛡️ <b>လုံခြုံရေး သတိပေးချက်:</b> AI ပြေစာအတု လိမ်လည်မှုများမှ ၁၀၀% ကာကွယ်ရန် Auto-Approve ပိတ်ထားပါသည်။ KPay / WavePay လက်ခံအကောင့်ထဲ ငွေတကယ်ဝင်/မဝင် စစ်ဆေးပြီးမှ Admin Dashboard [Deposit View] တွင် Approve ပေးပါရန်။\n"
            )
        alert_text += f"━━━━━━━━━━━━━━━━━━━━"

        def _send_async(gid, txt):
            send_telegram_message(gid, txt)

        t = threading.Thread(target=_send_async, args=(group_id, alert_text), daemon=True)
        t.start()
        return True
    except Exception as e:
        logger.error(f"Error in notify_finance_alert: {e}")
        return False

def upsert_telegram_mapping(db: Session, phone: str, chat_id: str, username: str = None, first_name: str = None):
    """Safely inserts or updates a Telegram chat mapping without duplicate key conflicts."""
    clean_phone = normalize_phone(phone)
    if not clean_phone or not chat_id:
        return None

    mapping = db.query(TelegramChatMapping).filter(TelegramChatMapping.phone == clean_phone).first()
    if mapping:
        mapping.chat_id = str(chat_id)
        if username:
            mapping.telegram_username = username
        if first_name:
            mapping.first_name = first_name
        mapping.updated_at = now_mmt()
    else:
        mapping = TelegramChatMapping(
            phone=clean_phone,
            chat_id=str(chat_id),
            telegram_username=username,
            first_name=first_name,
            created_at=now_mmt(),
            updated_at=now_mmt()
        )
        db.add(mapping)

    # Also update user profile if exists
    user = db.query(User).filter(User.phone == clean_phone).first()
    if user:
        user.telegram_id = str(chat_id)
        if username:
            user.telegram_username = username

    db.flush()
    return mapping

def generate_and_save_otp(db: Session, phone: str, purpose: str = "register", chat_id: str = None) -> str:
    """Generates a 6-digit OTP code, invalidates old ones, and saves to database"""
    clean_phone = normalize_phone(phone)
    otp_code = f"{random.randint(100000, 999999)}"
    expires_at = now_mmt() + timedelta(minutes=10)

    # Invalidate previous unused codes for this phone
    db.query(TelegramVerification).filter(
        TelegramVerification.phone == clean_phone,
        TelegramVerification.is_used == False
    ).update({"is_used": True})

    verification = TelegramVerification(
        phone=clean_phone,
        code=otp_code,
        purpose=purpose,
        chat_id=str(chat_id) if chat_id else None,
        created_at=now_mmt(),
        expires_at=expires_at,
        is_used=False
    )
    db.add(verification)

    # If chat_id is known, link or update TelegramChatMapping
    if chat_id:
        upsert_telegram_mapping(db, clean_phone, str(chat_id))

    db.commit()
    return otp_code

def send_otp_to_telegram(db: Session, phone: str, otp_code: str, purpose: str = "register") -> dict:
    """
    Sends OTP directly to user's Telegram if their chat_id is linked.
    If chat_id is not yet linked, provides a deep link to @SG4DMyanmarBot.
    """
    clean_phone = normalize_phone(phone)
    bot_user = settings.TELEGRAM_BOT_USERNAME
    deep_link = f"https://t.me/{bot_user}?start=otp_{clean_phone}"

    # Check for known chat_id
    mapping = db.query(TelegramChatMapping).filter(TelegramChatMapping.phone == clean_phone).first()
    chat_id = mapping.chat_id if mapping else None

    if not chat_id:
        user = db.query(User).filter(User.phone == clean_phone).first()
        if user and user.telegram_id:
            chat_id = user.telegram_id

    purpose_title = "အကောင့်သစ် ဖွင့်ရန် (Sign Up OTP)" if purpose == "register" else "စကားဝှက် ပြန်လည်ရယူရန် (Reset Password OTP)"

    if chat_id:
        msg_text = (
            f"🇲🇲 <b>SG4D Myanmar (ရွှေဥဒေါင်း)</b>\n\n"
            f"🔐 <b>{purpose_title}</b>\n"
            f"ဖုန်းနံပါတ်: <code>{clean_phone}</code>\n\n"
            f"🔑 သင်၏ လုံခြုံရေး အတည်ပြုကုဒ် (OTP) မှာ:\n"
            f"👉 <b><code>{otp_code}</code></b> 👈\n\n"
            f"⚠️ <i>(၁၀ မိနစ်အတွင်း အသုံးပြုပါ ခင်ဗျာ။ ဤကုဒ်ကို မည်သူ့ကိုမျှ မမျှဝေပါနှင့်။)</i>"
        )
        sent = send_telegram_message(chat_id, msg_text)
        if sent:
            return {
                "sent_via_bot": True,
                "phone": clean_phone,
                "chat_id": chat_id,
                "telegram_bot": f"@{bot_user}",
                "deep_link": deep_link,
                "message": f"OTP အတည်ပြုကုဒ်ကို သင်၏ Telegram (@{bot_user}) သို့ တိုက်ရိုက် ပေးပို့လိုက်ပါပြီ ခင်ဗျာ။"
            }

    # If chat_id not known yet or send failed
    return {
        "sent_via_bot": False,
        "phone": clean_phone,
        "chat_id": None,
        "telegram_bot": f"@{bot_user}",
        "deep_link": deep_link,
        "message": f"ကျေးဇူးပြု၍ Telegram Bot (@{bot_user}) တွင် OTP ကုဒ် ရယူပေးပါ ခင်ဗျာ။"
    }

def get_apk_download_url() -> str:
    """Returns public APK download URL based on environment or server config"""
    if settings.APK_DOWNLOAD_URL and "tinyurl" not in settings.APK_DOWNLOAD_URL:
        return settings.APK_DOWNLOAD_URL
    return "https://sg4dmm.onrender.com/download/apk"


def send_apk_info_message(chat_id: str, first_name: str = "Member"):
    """Sends Android APK download link and Web App info to user"""
    apk_url = get_apk_download_url()
    web_url = "https://sg4dmm.onrender.com"

    apk_text = (
        f"🇲🇲 <b>SG4D Myanmar (ရွှေဥဒေါင်း) - 2D | 3D | 4D</b>\n\n"
        f"မင်္ဂလာပါ <b>{first_name}</b> ခင်ဗျာ!\n"
        f"SG4D Myanmar ၏ 2D, 3D နှင့် 4D ဂိမ်းအသစ်များ အားလုံး စုံလင်စွာ ကစားနိုင်ပါပြီ။\n\n"
        f"🎮 <b>Web App ဖြင့် တိုက်ရိုက်ကစားရန်</b>:\n"
        f"ဖုန်း Browser သို့မဟုတ် Telegram အတွင်းမှ App ဒေါင်းစရာမလိုဘဲ ချက်ချင်း တိုက်ရိုက်ကစားနိုင်ပါသည်။\n\n"
        f"📲 <b>Android APK ဒေါင်းလုဒ်ရယူရန်</b>:\n"
        f"ဖုန်းထဲသို့ APK သီးသန့် အက်ပ်အနေဖြင့် သွင်းယူလိုပါက အောက်ပါခလုတ်ကို နှိပ်၍ ဒေါင်းလုဒ်ရယူနိုင်ပါသည် ခင်ဗျာ။\n\n"
        f"⚡️ 2D (ထိုင်းစတော့ မနက် ၁၂:၀၁ / ညနေ ၀၄:၃၀)\n"
        f"🎲 3D (လဆန်း ၁ ရက် / ၁၆ ရက်)\n"
        f"🎰 4D (စင်ကာပူ ပူးလ်စ် ဗုဒ္ဓဟူး၊ စနေ၊ တနင်္ဂနွေ)\n"
        f"💳 KPay / WavePay QR ဖြင့် အလျင်အမြန် ငွေသွင်းငွေထုတ်"
    )
    inline_keyboard = {
        "inline_keyboard": [
            [{"text": "🎮 Play Online (တိုက်ရိုက်ကစားရန်)", "web_app": {"url": web_url}}],
            [{"text": "📲 Download APK (Android App)", "url": apk_url}]
        ]
    }
    send_telegram_message(chat_id, apk_text, reply_markup=inline_keyboard)



def handle_telegram_update(update: dict, db: Session):
    """Processes an individual update event received from Telegram"""
    message = update.get("message")
    if not message:
        return

    chat = message.get("chat", {})
    chat_id = str(chat.get("id"))
    chat_type = chat.get("type", "private")
    from_user = message.get("from", {})
    first_name = from_user.get("first_name", "Member")
    username = from_user.get("username", "")

    bot_username = settings.TELEGRAM_BOT_USERNAME

    # Case 0: Message from a Telegram Group / Supergroup (Finance Notification Group auto-bind)
    if chat_type in ["group", "supergroup"]:
        text = (message.get("text") or "").strip()
        is_bot_added = False
        if "new_chat_members" in message:
            for member in message["new_chat_members"]:
                if member.get("username", "").lower() == bot_username.lower():
                    is_bot_added = True
                    break

        from app.models.settings import SystemSetting
        setting = db.query(SystemSetting).first()
        should_bind = (
            is_bot_added or 
            text.startswith(("/set_finance_group", "/finance", "/id", "/start", "/help", "/withdraw")) or 
            f"@{bot_username.lower()}" in text.lower() or 
            (setting and not setting.telegram_finance_group_id)
        )

        if should_bind and setting:
            setting.telegram_finance_group_id = chat_id
            db.commit()
            _save_fallback_group_id(chat_id)
            group_title = chat.get("title", "SG4D Finance Group")
            confirm_msg = (
                f"🔔 <b>SG4D Myanmar Finance Alert Bot ချိတ်ဆက်ပြီးပါပြီ!</b>\n\n"
                f"ဤ Telegram Group (<code>{group_title}</code>) အား <b>Topup & Withdraw</b> အလိုအလျောက် သတိပေးစာများ ပေးပို့မည့် တရားဝင် Group အဖြစ် သတ်မှတ်လိုက်ပါပြီ ခင်ဗျာ။\n\n"
                f"🆔 <b>Group Chat ID:</b> <code>{chat_id}</code>\n"
                f"💰 <b>ဆိုင်းငံ့ ငွေထုတ်စာရင်းများကို ၃ မိနစ်တစ်ကြိမ် အလိုအလျောက် သတိပေးချက် ပို့ဆောင်ပါမည်။</b>"
            )
            send_telegram_message(chat_id, confirm_msg)
            # Immediately trigger pending withdrawals check
            threading.Thread(target=check_and_notify_pending_withdrawals_job, daemon=True).start()
        return

    # Case A: User shared phone contact
    if "contact" in message and message["contact"]:
        raw_contact_phone = message["contact"].get("phone_number", "")
        phone = normalize_phone(raw_contact_phone)
        if phone:
            upsert_telegram_mapping(db, phone, chat_id, username, first_name)

            # Check if active OTP is pending, otherwise generate a new one
            active_otp = db.query(TelegramVerification).filter(
                TelegramVerification.phone == phone,
                TelegramVerification.is_used == False,
                TelegramVerification.expires_at > now_mmt()
            ).order_by(TelegramVerification.id.desc()).first()

            if active_otp:
                otp_code = active_otp.code
            else:
                otp_code = generate_and_save_otp(db, phone, purpose="register", chat_id=None)

            reply_text = (
                f"🇲🇲 <b>SG4D Myanmar (ရွှေဥဒေါင်း)</b>\n\n"
                f"မင်္ဂလာပါ <b>{first_name}</b> ခင်ဗျာ!\n"
                f"ဖုန်းနံပါတ် <code>{phone}</code> ကို အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ။\n\n"
                f"🔑 သင်၏ အတည်ပြုကုဒ် (OTP) မှာ:\n"
                f"👉 <b><code>{otp_code}</code></b> 👈\n\n"
                f"⚠️ <i>(၁၀ မိနစ်အတွင်း အသုံးပြုပါ ခင်ဗျာ။ ဤကုဒ်ကို ဝဘ်ဆိုက်တွင် ရိုက်ထည့်၍ Sign Up အကောင့်ဖွင့်ခြင်း သို့မဟုတ် စကားဝှက် Reset ပြုလုပ်နိုင်ပါသည်။)</i>"
            )
            send_telegram_message(chat_id, reply_text)
            return

    # Case B: Text messages
    text = (message.get("text") or "").strip()
    if not text:
        return

    # 1. /start otp_<phone> or /start <phone>
    if text.startswith("/start"):
        parts = text.split()
        if len(parts) > 1:
            arg = parts[1].strip()
            # If parameter has otp_ prefix: e.g. otp_09795007441
            if arg.startswith("otp_"):
                phone = normalize_phone(arg[4:])
            else:
                phone = normalize_phone(arg)

            if phone and len(phone) >= 7:
                upsert_telegram_mapping(db, phone, chat_id, username, first_name)

                # Check if an active OTP was already requested from web
                active_otp = db.query(TelegramVerification).filter(
                    TelegramVerification.phone == phone,
                    TelegramVerification.is_used == False,
                    TelegramVerification.expires_at > now_mmt()
                ).order_by(TelegramVerification.id.desc()).first()

                if active_otp:
                    otp_code = active_otp.code
                else:
                    otp_code = generate_and_save_otp(db, phone, purpose="register", chat_id=None)

                reply_text = (
                    f"🇲🇲 <b>SG4D Myanmar (ရွှေဥဒေါင်း)</b>\n\n"
                    f"မင်္ဂလာပါ <b>{first_name}</b> ခင်ဗျာ!\n"
                    f"ဖုန်းနံပါတ်: <code>{phone}</code>\n\n"
                    f"🔑 သင်၏ လုံခြုံရေး အတည်ပြုကုဒ် (OTP) မှာ:\n"
                    f"👉 <b><code>{otp_code}</code></b> 👈 <i>(ကုဒ်ကို ဖိ၍ Copy ယူပါ)</i>\n\n"
                    f"⚠️ <i>(၁၀ မိနစ်အတွင်း အသုံးပြုပါ ခင်ဗျာ။ ဤကုဒ်ကို SG4D App တွင် ပြန်လည်ရိုက်ထည့်၍ အတည်ပြုပေးပါ ခင်ဗျာ။)</i>"
                )
                send_telegram_message(chat_id, reply_text)
                return

        # General /start (without params)
        short_apk = "https://tinyurl.com/sg4d-myanmar-apk"
        keyboard = {
            "keyboard": [
                [{"text": "📱 ဖုန်းနံပါတ် ပေးပို့ရန် (Share Contact)", "request_contact": True}],
                [{"text": "📲 Android APK ဒေါင်းလုဒ်ရယူရန်"}]
            ],
            "resize_keyboard": True,
            "one_time_keyboard": False
        }
        welcome_text = (
            f"🇲🇲 <b>မင်္ဂလာပါ! SG4D Myanmar (ရွှေဥဒေါင်း) Telegram Bot မှ ကြိုဆိုပါသည်။</b>\n\n"
            f"၁။ <b>OTP ရယူရန်</b>:\n"
            f"• ဝဘ်ဆိုက်တွင် အကောင့်ဖွင့်ရန် သို့မဟုတ် စကားဝှက် Reset ပြုလုပ်ရန် အောက်ပါ <b>[ 📱 ဖုန်းနံပါတ် ပေးပို့ရန် ]</b> ခလုတ်ကို နှိပ်ပါ (သို့မဟုတ် ဖုန်းနံပါတ် ရိုက်ထည့်ပို့ပါ)။\n\n"
            f"၂။ <b>Android Mobile App (APK) ရယူရန်</b>:\n"
            f"• အောက်ပါ <b>[ 📲 Download APK ]</b> ခလုတ်ကို နှိပ်၍ ဖုန်းထဲသို့ ဒေါင်းလုဒ်ဆွဲယူနိုင်ပါသည် ခင်ဗျာ။\n"
            f"👉 <a href=\"{short_apk}\"><b>[ 📲 Download SG4D APK ]</b></a>"
        )
        inline_markup = {
            "inline_keyboard": [
                [{"text": "📲 Download APK", "url": short_apk}]
            ]
        }
        send_telegram_message(chat_id, welcome_text, reply_markup=inline_markup)
        return


    # 2. User typed a phone number directly: e.g. 09795007441, +959795007441
    phone_candidate = normalize_phone(text)
    if re.match(r'^09\d{7,9}$', phone_candidate):
        phone = phone_candidate
        upsert_telegram_mapping(db, phone, chat_id, username, first_name)

        # Check existing active OTP or generate new
        active_otp = db.query(TelegramVerification).filter(
            TelegramVerification.phone == phone,
            TelegramVerification.is_used == False,
            TelegramVerification.expires_at > now_mmt()
        ).order_by(TelegramVerification.id.desc()).first()

        if active_otp:
            otp_code = active_otp.code
        else:
            otp_code = generate_and_save_otp(db, phone, purpose="register", chat_id=None)

        reply_text = (
            f"🇲🇲 <b>SG4D Myanmar (ရွှေဥဒေါင်း)</b>\n\n"
            f"ဖုန်းနံပါတ်: <code>{phone}</code>\n\n"
            f"🔑 သင်၏ အတည်ပြုကုဒ် (OTP) မှာ:\n"
            f"👉 <b><code>{otp_code}</code></b> 👈\n\n"
            f"⚠️ <i>(၁၀ မိနစ်အတွင်း အသုံးပြုပါ ခင်ဗျာ။ ဤကုဒ်ကို ဝဘ်ဆိုက်တွင် ရိုက်ထည့်၍ အကောင့်ဖွင့်ခြင်း သို့မဟုတ် စကားဝှက် Reset ပြုလုပ်ပါ ခင်ဗျာ။)</i>"
        )
        send_telegram_message(chat_id, reply_text)
        return

    # 3. /otp command
    if text.lower() == "/otp":
        mapping = db.query(TelegramChatMapping).filter(TelegramChatMapping.chat_id == chat_id).first()
        if mapping:
            phone = mapping.phone
            otp_code = generate_and_save_otp(db, phone, purpose="register", chat_id=None)
            reply_text = (
                f"🇲🇲 <b>SG4D Myanmar (ရွှေဥဒေါင်း)</b>\n\n"
                f"ဖုန်းနံပါတ်: <code>{phone}</code>\n\n"
                f"🔑 သင်၏ အတည်ပြုကုဒ် (OTP) အသစ်မှာ:\n"
                f"👉 <b><code>{otp_code}</code></b> 👈\n\n"
                f"⚠️ <i>(၁၀ မိနစ်အတွင်း အသုံးပြုပါ ခင်ဗျာ။)</i>"
            )
            send_telegram_message(chat_id, reply_text)
            return
        else:
            send_telegram_message(
                chat_id,
                "ကျေးဇူးပြု၍ သင်၏ ဖုန်းနံပါတ် (ဥပမာ- <code>09795007441</code>) ကို အရင်ရိုက်ထည့် ပေးပို့ပေးပါ ခင်ဗျာ။"
            )
            return

    # 4. APK Download Commands & Keywords
    lower_text = text.lower()
    apk_keywords = [
        "/apk", "/app", "/download", "apk", "app", "application", 
        "ဆော့ဝဲ", "ဆော့ဝဲလ်", "ဒေါင်းလုဒ်", "ဒေါင်း", "download", "link", "လင့်", "လင့်", "game", "ဂိမ်း"
    ]
    if any(kw in lower_text for kw in apk_keywords):
        send_apk_info_message(chat_id, first_name)
        return

    # 5. /help command or default fallback
    apk_url = get_apk_download_url()
    help_text = (
        f"🇲🇲 <b>SG4D Myanmar (ရွှေဥဒေါင်း) အကူအညီ</b>\n\n"
        f"• <b>မိုဘိုင်း App (APK) ဒေါင်းလုဒ်ရယူရန်</b>:\n"
        f"👉 /apk သို့မဟုတ် /download ကို နှိပ်ပါ (သို့မဟုတ် 'apk' ဟု စာပို့ပါ)\n\n"
        f"• <b>အကောင့်သစ်ဖွင့်ရန် (Sign Up) / စကားဝှက်မေ့နေပါက (Forgot Password)</b>:\n"
        f"၁။ သင်၏ ဖုန်းနံပါတ် (ဥပမာ- <code>09795007441</code>) ကို ဤနေရာတွင် ပေးပို့ပါ\n"
        f"၂။ ရရှိလာသော OTP ကုဒ် ၆ လုံးကို ဝဘ်ဆိုက်တွင် ရိုက်ထည့်၍ အတည်ပြုပါ ခင်ဗျာ။\n\n"
        f"• ကုဒ် အသစ်တောင်းယူရန်: /otp ကို နှိပ်ပါ"
    )
    inline_help_markup = {
        "inline_keyboard": [
            [{"text": "📲 Download APK", "url": apk_url}]
        ]
    }
    send_telegram_message(chat_id, help_text, reply_markup=inline_help_markup)


def run_telegram_bot_poller():
    """Continuous polling loop for Telegram Bot updates"""
    logger.info(f"Starting Telegram Bot Poller for @{settings.TELEGRAM_BOT_USERNAME}...")
    offset = 0

    while True:
        try:
            url = f"{TELEGRAM_API_BASE}/getUpdates?offset={offset}&timeout=20"
            resp = requests.get(url, timeout=25)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    updates = data.get("result", [])
                    if updates:
                        db = SessionLocal()
                        try:
                            for update in updates:
                                update_id = update.get("update_id")
                                if update_id is not None and update_id >= offset:
                                    offset = update_id + 1
                                handle_telegram_update(update, db)
                        except Exception as e:
                            logger.error(f"Error handling Telegram update: {e}", exc_info=True)
                        finally:
                            db.close()
            elif resp.status_code == 409:
                logger.warning("Telegram Bot getUpdates conflict (another instance may be polling). Retrying in 10s...")
                time.sleep(10)
            else:
                time.sleep(3)
        except Exception as e:
            # Sleep briefly on network / timeout errors and retry
            time.sleep(3)

def start_telegram_bot_background():
    """Starts the Telegram bot polling listener in a daemon background thread"""
    thread = threading.Thread(target=run_telegram_bot_poller, daemon=True, name="TelegramBotPoller")
    thread.start()
    logger.info("Telegram Bot background poller thread started.")
    return thread

def _calc_minutes_elapsed(ts) -> int:
    """Safely calculates elapsed minutes from a naive or aware datetime relative to now_mmt."""
    if not ts:
        return 0
    now = now_mmt()
    try:
        if ts.tzinfo is None:
            ts = MMT_TZ.localize(ts)
        else:
            ts = ts.astimezone(MMT_TZ)
        return max(0, int((now - ts).total_seconds() / 60))
    except Exception:
        return 0

def check_and_notify_pending_withdrawals_job():
    """
    Recurring Background Job:
    Checks for any pending withdrawal review requests (status == MANUAL_REVIEW).
    As long as any pending withdrawals exist, sends a reminder alert to the Telegram Finance Group every 3 minutes.
    """
    db = SessionLocal()
    try:
        from sqlalchemy import or_
        from app.models.settings import SystemSetting
        from app.models.transaction import Transaction, TransactionType, TransactionStatus

        setting = db.query(SystemSetting).first()
        group_id = (setting.telegram_finance_group_id if setting else None) or _get_fallback_group_id()
        if not group_id:
            logger.warning("Pending withdrawal reminder job: No telegram_finance_group_id configured.")
            return

        if setting and not setting.telegram_finance_group_id and group_id:
            setting.telegram_finance_group_id = group_id
            db.commit()

        pending_txs = db.query(Transaction).filter(
            Transaction.tx_type == TransactionType.WITHDRAWAL,
            or_(
                Transaction.status == TransactionStatus.MANUAL_REVIEW,
                Transaction.status == "MANUAL_REVIEW"
            )
        ).order_by(Transaction.id.asc()).all()

        if not pending_txs:
            return  # No pending withdrawals, silence

        count = len(pending_txs)
        total_amount = sum(float(t.amount or 0.0) for t in pending_txs)
        time_str = now_mmt().strftime("%I:%M:%S %p MMT")

        items_text = []
        for i, t in enumerate(pending_txs[:8], 1):
            u_phone = t.user.phone if (t.user and t.user.phone) else "Unknown"
            u_name = (t.user.nickname or t.user.full_name or t.user.username) if t.user else "Player"
            gw_str = (t.gateway or "KPAY").upper()
            delta_mins = _calc_minutes_elapsed(t.submission_timestamp_mmt or t.created_at)
            rec_id = t.receiver_id or u_phone
            safe_name = html.escape(str(u_name))
            safe_rec_id = html.escape(str(rec_id))

            items_text.append(
                f"{i}. <b>{t.amount:,.0f} MMK</b> ({gw_str})\n"
                f"   👤 {safe_name} (<code>{u_phone}</code>)\n"
                f"   🏦 လက်ခံ: <code>{safe_rec_id}</code>\n"
                f"   🔖 ID: <code>{t.transaction_id}</code>\n"
                f"   ⏳ <b>ဆိုင်းငံ့ကြာချိန်: {delta_mins} မိနစ်</b>"
            )

        more_text = f"\n... နှင့် အခြား <b>{count - 8}</b> စောင် ကျန်ရှိနေပါသည်" if count > 8 else ""

        alert_text = (
            f"⏰ <b>[PENDING WITHDRAWAL REMINDER - သတိပေးချက်]</b> ⏰\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"⚠️ <b>ငွေလွှဲပေးရန် စောင့်ဆိုင်းနေသော ငွေထုတ်စာရင်း ({count}) စောင် ရှိနေပါသည်!</b>\n"
            f"💰 <b>ဆိုင်းငံ့ စုစုပေါင်း:</b> <b>{total_amount:,.0f} MMK</b>\n"
            f"⏱️ <b>သတိပေးချိန်:</b> {time_str}\n\n"
            f"📋 <b>ဆိုင်းငံ့ စာရင်းများ:</b>\n\n"
            + "\n\n".join(items_text)
            + more_text +
            f"\n\n━━━━━━━━━━━━━━━━━━━━\n"
            f"👉 <i>(ငွေထုတ်စာရင်း ဆိုင်းငံ့နေသ၍ ၃ မိနစ်တစ်ကြိမ် အသိပေးစာ ပေးပို့နေမည် ဖြစ်ပါသည်။ Admin Panel [Withdraw Review] တွင် အတည်ပြုငွေလွှဲပေးပါရန်။)</i>"
        )

        sent = send_telegram_message(group_id, alert_text)
        if sent:
            logger.info(f"Sent 3-min pending withdrawal reminder for {count} pending requests to group {group_id}.")
        else:
            logger.warning(f"Failed to send 3-min pending withdrawal reminder to group {group_id}.")
    except Exception as e:
        logger.error(f"Error in check_and_notify_pending_withdrawals_job: {e}", exc_info=True)
    finally:
        db.close()
