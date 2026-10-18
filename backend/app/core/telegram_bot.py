import re
import random
import logging
import threading
import time
import requests
from datetime import timedelta
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.user import User, TelegramVerification, TelegramChatMapping
from app.core.timezone_utils import now_mmt, MMT_TZ

logger = logging.getLogger("telegram_bot")
logger.setLevel(logging.INFO)

TELEGRAM_API_BASE = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"

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
    """Sends a text message to a Telegram chat using Telegram Bot API"""
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
            return False
        return True
    except Exception as e:
        logger.error(f"Error calling Telegram sendMessage for {chat_id}: {e}")
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
    if settings.APK_DOWNLOAD_URL:
        return settings.APK_DOWNLOAD_URL
    if settings.RENDER_EXTERNAL_URL:
        base = settings.RENDER_EXTERNAL_URL.rstrip('/')
        return f"{base}/download/apk"
    return "http://192.168.99.224:8000/download/apk"

def send_apk_info_message(chat_id: str, first_name: str = "Member"):
    """Sends Android APK download link and info to user using short/masked link"""
    short_apk_url = "https://tinyurl.com/sg4d-myanmar-apk"
    github_apk = "https://github.com/michaelmexes30/sg4dmm/releases/download/v1.0.1/SG4D_Myanmar_V1.0.1.apk"
    web_url = "https://sg4dmm.onrender.com/"

    apk_text = (
        f"🇲🇲 <b>SG4D Myanmar (ရွှေဥဒေါင်း) Mobile App</b>\n\n"
        f"မင်္ဂလာပါ <b>{first_name}</b> ခင်ဗျာ!\n"
        f"SG4D Myanmar တရားဝင် Android Mobile APK ကို အောက်ပါ Link မှ လုံခြုံစိတ်ချစွာ ဒေါင်းလုဒ်ရယူနိုင်ပါပြီ။\n\n"
        f"📱 Version: <b>v1.0.1 (Android Official)</b>\n"
        f"⚡️ ပေါ့ပါးသွက်လက်ပြီး လိုင်းဆွဲအားကောင်းခြင်း\n"
        f"🎰 4D ကံစမ်းဂဏန်းများ လွယ်ကူစွာထိုးနိုင်ခြင်း\n"
        f"📊 ထီပေါက်စဉ်များ Live စစ်ဆေးနိုင်ခြင်း\n"
        f"💳 KPay / WavePay QR ဖြင့် အလွယ်တကူ ငွေသွင်းငွေထုတ် ပြုလုပ်နိုင်ခြင်း\n\n"
        f"👉 <b>ဒေါင်းလုဒ်ရယူရန်:</b> <a href=\"{short_apk_url}\"><b>[ 📲 Download SG4D APK ]</b></a>\n"
        f"👉 <b>Mirror Link:</b> <a href=\"{github_apk}\"><b>[ ⚡️ Backup Download ]</b></a>"
    )
    inline_keyboard = {
        "inline_keyboard": [
            [{"text": "📲 Download APK (တိုက်ရိုက်ဒေါင်းရန်)", "url": short_apk_url}],
            [{"text": "⚡️ Download APK (Backup Link)", "url": github_apk}],
            [{"text": "🌐 Online Platform သို့ ဝင်ရန်", "url": web_url}]
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
    from_user = message.get("from", {})
    first_name = from_user.get("first_name", "Member")
    username = from_user.get("username", "")

    bot_username = settings.TELEGRAM_BOT_USERNAME

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
        render_apk = "https://sg4dmm.onrender.com/download/apk"
        github_apk = "https://github.com/michaelmexes30/sg4dmm/releases/download/v1.0.1/SG4D_Myanmar_V1.0.1.apk"
        web_url = "https://sg4dmm.onrender.com/"
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
            f"• အောက်ပါ <b>[ 📲 Download Android APK ]</b> ခလုတ်ကို နှိပ်၍ ဖုန်းထဲသို့ ဒေါင်းလုဒ်ဆွဲယူနိုင်ပါသည် ခင်ဗျာ။\n"
            f"👉 <a href=\"{render_apk}\"><b>တိုက်ရိုက်ဒေါင်းလုဒ်ရယူရန် Link</b></a>"
        )
        inline_markup = {
            "inline_keyboard": [
                [{"text": "📲 Download APK (တိုက်ရိုက်ဒေါင်းရန်)", "url": render_apk}],
                [{"text": "⚡️ Download APK (GitHub Mirror)", "url": github_apk}],
                [{"text": "🌐 Online Platform သို့ ဝင်ရန်", "url": web_url}]
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
            [{"text": "📲 Download Android APK", "url": apk_url}],
            [{"text": "🌐 Online Platform သို့ ဝင်ရန်", "url": settings.RENDER_EXTERNAL_URL or "http://192.168.99.224:8000"}]
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
