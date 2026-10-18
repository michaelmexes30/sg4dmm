import os
import re
import logging
from datetime import datetime, date, time
from typing import Dict, Any, Tuple, Optional
from PIL import Image

logger = logging.getLogger("ocr_verifier")

def extract_slip_date(text: str) -> Optional[date]:
    """
    Extracts the calendar date from receipt text.
    Handles DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, YYYY/MM/DD, and DD MMM YYYY.
    """
    # 1. DD/MM/YYYY or DD-MM-YYYY
    m = re.search(r'\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b', text)
    if m:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return date(year, month, day)
        except ValueError:
            pass

    # 2. YYYY-MM-DD or YYYY/MM/DD
    m = re.search(r'\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b', text)
    if m:
        year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return date(year, month, day)
        except ValueError:
            pass

    # 3. DD MMM YYYY (e.g. 16 Oct 2026)
    m = re.search(r'\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b', text)
    if m:
        try:
            dt = datetime.strptime(f"{m.group(1)} {m.group(2)[:3]} {m.group(3)}", "%d %b %Y")
            return dt.date()
        except Exception:
            pass

    return None

def extract_slip_time(text: str) -> Optional[time]:
    """
    Extracts transaction time of day from receipt text.
    Handles 12-hour AM/PM and 24-hour formats (with or without seconds).
    """
    # 1. 12H AM/PM (e.g. 04:11:34 PM or 04:11 PM)
    m = re.search(r'\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)\b', text)
    if m:
        h, mi, s, mer = m.groups()
        s = s or '0'
        try:
            dt = datetime.strptime(f"{h}:{mi}:{s} {mer.upper()}", "%I:%M:%S %p")
            return dt.time()
        except Exception:
            pass

    # 2. 24H with seconds (e.g. 15:29:41 or 16:11:34)
    m = re.search(r'\b([01]?\d|2[0-3]):([0-5]\d):([0-5]\d)\b', text)
    if m:
        h, mi, s = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return time(h, mi, s)

    # 3. 24H without seconds (e.g. 15:29 or 16:11)
    m = re.search(r'\b([01]?\d|2[0-3]):([0-5]\d)\b', text)
    if m:
        h, mi = int(m.group(1)), int(m.group(2))
        return time(h, mi, 0)

    return None

def extract_slip_datetime(text: str) -> Optional[datetime]:
    """
    Extracts combined transaction datetime from receipt OCR text.
    Uses date and time extractors.
    """
    d = extract_slip_date(text)
    t = extract_slip_time(text)
    if d and t:
        return datetime.combine(d, t)
    return None

def extract_text_from_image(image_path: str) -> str:
    """
    Extracts text from receipt image using Windows Native OCR engine.
    Fast, offline, and accurate for KBZPay and WavePay receipts.
    Includes targeted time-band recovery for screenshots with edge bars.
    """
    if not image_path or not os.path.exists(image_path):
        return ""
    try:
        from winrt.windows.media.ocr import OcrEngine
        from winrt.windows.globalization import Language
        from winrt.windows.storage.streams import DataWriter
        from winrt.windows.graphics.imaging import SoftwareBitmap, BitmapPixelFormat

        engine = OcrEngine.try_create_from_language(Language('en-US'))
        if not engine:
            engine = OcrEngine.try_create_from_user_profile_languages()

        def _ocr_pil_image(pil_img):
            rgba = pil_img.convert('RGBA')
            wtr = DataWriter()
            wtr.write_bytes(rgba.tobytes())
            s_bmp = SoftwareBitmap.create_copy_from_buffer(
                wtr.detach_buffer(), 
                BitmapPixelFormat.RGBA8, 
                rgba.width, 
                rgba.height
            )
            return engine.recognize_async(s_bmp).get()

        img = Image.open(image_path)
        res = _ocr_pil_image(img)
        full_text = res.text or ""

        # Check if full_text already has a complete datetime
        if not extract_slip_datetime(full_text):
            # Targeted recovery: look for lines containing 'Time', 'Date', or a date sequence
            time_y = None
            time_h = 25
            for line in res.lines:
                t = line.text
                if 'Time' in t or 'Date' in t or re.search(r'\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}', t):
                    for w in line.words:
                        if re.search(r'\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}', w.text) or 'Time' in w.text:
                            time_y = w.bounding_rect.y
                            time_h = w.bounding_rect.height
                            break
                if time_y:
                    break

            if time_y is not None:
                # Crop horizontal band across the value area (e.g. right 60%, trimming 2% scrollbar on right)
                y1 = max(0, int(time_y - 25))
                y2 = min(img.height, int(time_y + time_h + 35))
                x1 = int(img.width * 0.35)
                x2 = int(img.width * 0.98)
                band = img.crop((x1, y1, x2, y2))
                # 2x upscale with bicubic/lanczos
                band_2x = band.resize((band.width * 2, band.height * 2), Image.Resampling.LANCZOS)
                res_band = _ocr_pil_image(band_2x)
                if res_band.text:
                    full_text += " " + res_band.text

        return full_text
    except Exception as e:
        logger.error(f"Error extracting OCR from {image_path}: {e}")
        return ""

def parse_and_validate_receipt(
    slip_image_path: str,
    gateway: str,
    input_tx_id: str,
    input_amount: float,
    expected_receiver_phone: str,
    expected_receiver_name: str,
    submission_time_mmt: Optional[datetime] = None
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Validates uploaded receipt slip:
    1. Extracts full text via Windows native OCR.
    2. Verifies Receiver Name and Receiver Phone against official company account.
    3. Verifies Transaction ID matches the receipt.
    4. Verifies Amount matches the receipt.
    Returns:
    (is_valid: bool, reason: str, details: dict)
    """
    g = gateway.lower()
    clean_input_tx = input_tx_id.strip()
    clean_expected_phone = re.sub(r"[^\d]", "", expected_receiver_phone or "")
    expected_phone_suffix = clean_expected_phone[-4:] if len(clean_expected_phone) >= 4 else clean_expected_phone

    if not slip_image_path or not os.path.exists(slip_image_path):
        return False, "ငွေလွှဲပြေစာပုံ ထည့်သွင်းထားခြင်း မရှိပါသဖြင့် လူကိုယ်တိုင်စစ်ဆေးရန် လိုအပ်ပါသည် (No Slip Image).", {
            "error_code": "NO_SLIP"
        }

    ocr_text = extract_text_from_image(slip_image_path)
    if not ocr_text or len(ocr_text.strip()) < 10:
        return False, "ငွေလွှဲပြေစာပုံမှ စာသားများကို စနစ်မှ မဖတ်ရှုနိုင်ပါသဖြင့် Admin မှ စစ်ဆေးပေးပါမည် (OCR Unreadable).", {
            "error_code": "OCR_FAILED",
            "raw_text": ocr_text
        }

    normalized_text = ocr_text.replace('\n', ' ')

    # 1. Check Transaction ID
    # Look for full or partial Tx ID in text
    tx_match = None
    all_numbers = re.findall(r'\b\d{6,24}\b', normalized_text)
    for num_seq in all_numbers:
        if clean_input_tx in num_seq or num_seq.endswith(clean_input_tx):
            tx_match = num_seq
            break

    if not tx_match:
        # Also check alphanumeric for WavePay
        if "wave" in g:
            alpha_tokens = re.findall(r'\b[A-Za-z0-9]{6,24}\b', normalized_text)
            for tok in alpha_tokens:
                if clean_input_tx.lower() in tok.lower():
                    tx_match = tok
                    break

    if not tx_match:
        return False, f"ထည့်သွင်းထားသော Transaction ID '{clean_input_tx}' သည် ပြေစာပါကုဒ်နှင့် မကိုက်ညီပါခင်ဗျာ (TxID Mismatch).", {
            "error_code": "TXID_MISMATCH",
            "input_tx": clean_input_tx,
            "raw_text": normalized_text[:200]
        }

    # 2. Check Receiver Name & Receiver Phone
    # Look for receiver name in KPay: 'Transfer <Name> ( <digits>)' or 'Transfer To <Name>'
    # Or in WavePay: 'To: <Name>' or 'Receiver: <Name>'
    slip_receiver_name = None
    slip_phone_suffix = None

    # KPay receipt pattern: Transfer U Phone Thiha ( 3766) or Transfer Daw Myo Thiri Khin ( 7441)
    kpay_receiver_match = re.search(r'Transfer\s+(?:To\s+)?([A-Za-z\s]+?)\s*\(\s*\*?(\d{3,6})\s*\)', normalized_text, re.IGNORECASE)
    if kpay_receiver_match:
        slip_receiver_name = kpay_receiver_match.group(1).strip()
        slip_phone_suffix = kpay_receiver_match.group(2).strip()
    else:
        # Fallback name search around Transfer / To
        to_match = re.search(r'(?:Transfer To|To|Receiver)\s*[:\-]?\s*([A-Za-z\s]{3,30})', normalized_text, re.IGNORECASE)
        if to_match:
            candidate = to_match.group(1).strip()
            # remove words like Amount, Notes, etc.
            candidate = re.split(r'\b(?:Amount|Notes|Transaction|Date|Time)\b', candidate, flags=re.IGNORECASE)[0].strip()
            if candidate and len(candidate) > 2:
                slip_receiver_name = candidate

    # Search for phone suffix (***7441 or 3766)
    if not slip_phone_suffix:
        phone_match = re.search(r'\(\s*\*+(\d{3,6})\s*\)', normalized_text)
        if phone_match:
            slip_phone_suffix = phone_match.group(1).strip()

    # Compare Receiver Name with expected company receiver name
    expected_tokens = [w.lower() for w in (expected_receiver_name or "").split() if len(w) > 2]
    # words that identify the name uniquely (ignoring U, Daw, Ko, Ma honorifics)
    name_core_tokens = [w for w in expected_tokens if w not in ["daw", "u", "ko", "ma", "mg"]]
    if not name_core_tokens:
        name_core_tokens = expected_tokens

    name_matches = False
    if name_core_tokens:
        matches_count = sum(1 for tok in name_core_tokens if tok in normalized_text.lower())
        if matches_count >= max(1, len(name_core_tokens) - 1):
            name_matches = True

    phone_matches = False
    if expected_phone_suffix:
        if expected_phone_suffix in normalized_text:
            phone_matches = True
        elif slip_phone_suffix and clean_expected_phone.endswith(slip_phone_suffix):
            phone_matches = True

    # If slip explicitly contains another receiver name (e.g. U Phone Thiha) and DOES NOT match our company receiver
    if slip_receiver_name and not name_matches:
        return False, f"ငွေလွှဲပြေစာပါ လက်ခံသူမှာ '{slip_receiver_name}' ဖြစ်နေပြီး ကုမ္ပဏီ တရားဝင်ငွေလက်ခံသူ '{expected_receiver_name}' နှင့် မကိုက်ညီသောကြောင့် အလိုအလျောက်အတည်ပြုခြင်းကို ပယ်ဖျက်လိုက်ပါသည် (Receiver Name Mismatch).", {
            "error_code": "RECEIVER_NAME_MISMATCH",
            "slip_receiver_name": slip_receiver_name,
            "expected_receiver_name": expected_receiver_name,
            "slip_phone_suffix": slip_phone_suffix,
            "expected_phone": expected_receiver_phone
        }

    # If phone suffix is detected and explicitly does not match
    if slip_phone_suffix and not phone_matches:
        return False, f"ငွေလွှဲပြေစာပါ လက်ခံသူဖုန်းနံပါတ် (အဆုံး: {slip_phone_suffix}) သည် ကုမ္ပဏီငွေလက်ခံသူဖုန်းနံပါတ် ({expected_receiver_phone}) နှင့် မကိုက်ညီပါခင်ဗျာ (Receiver Phone Mismatch).", {
            "error_code": "RECEIVER_PHONE_MISMATCH",
            "slip_phone_suffix": slip_phone_suffix,
            "expected_phone": expected_receiver_phone
        }

    # Neither name nor phone found in slip
    if not name_matches and not phone_matches:
        return False, f"ငွေလွှဲပြေစာတွင် ကုမ္ပဏီငွေလက်ခံသူ '{expected_receiver_name}' ({expected_receiver_phone}) အချက်အလက်များ မတွေ့ရှိရပါသဖြင့် Admin မှ စစ်ဆေးပေးပါမည် (Receiver Not Found).", {
            "error_code": "RECEIVER_NOT_FOUND",
            "expected_receiver_name": expected_receiver_name,
            "expected_phone": expected_receiver_phone
        }

    # 3. Check Amount
    # Find amount in text
    amt_matches = re.findall(r'(?:^|[^\d])([0-9,]+(?:\.\d{2})?)\s*(?:Ks|MMK)', normalized_text, re.IGNORECASE)
    clean_amts = []
    for a in amt_matches:
        try:
            val = float(a.replace(',', ''))
            clean_amts.append(val)
        except Exception:
            pass

    if clean_amts:
        amount_matches = any(abs(val - input_amount) < 1.0 for val in clean_amts)
        if not amount_matches:
            return False, f"ထည့်သွင်းထားသော ငွေပမာဏ ({input_amount:,.0f} MMK) သည် ပြေစာပါ ငွေပမာဏ ({clean_amts[0]:,.0f} MMK) နှင့် မကိုက်ညီပါခင်ဗျာ (Amount Mismatch).", {
                "error_code": "AMOUNT_MISMATCH",
                "input_amount": input_amount,
                "slip_amounts": clean_amts
            }

    # 4A. Check Slip Date (First)
    slip_date = extract_slip_date(normalized_text)
    if not slip_date:
        return False, "ငွေလွှဲပြေစာတွင် ရက်စွဲ (Date) အား တွေ့ရှိရခြင်း မရှိပါသဖြင့် Admin မှ စစ်ဆေးပေးပါမည် (Date Not Found).", {
            "error_code": "SLIP_DATE_NOT_FOUND",
            "slip_receiver_name": slip_receiver_name or expected_receiver_name,
            "slip_phone_suffix": slip_phone_suffix or expected_phone_suffix,
            "matched_tx_id": tx_match,
            "input_amount": input_amount
        }

    if submission_time_mmt:
        today_mmt = submission_time_mmt.date()
        if slip_date != today_mmt:
            return False, f"ငွေလွှဲပြေစာပါ ရက်စွဲမှာ '{slip_date.strftime('%d/%m/%Y')}' ဖြစ်နေပြီး ယနေ့ရက်စွဲ '{today_mmt.strftime('%d/%m/%Y')}' နှင့် မကိုက်ညီပါသဖြင့် အလိုအလျောက်အတည်ပြုခြင်းကို ပယ်ဖျက်လိုက်ပါသည် (Date Mismatch).", {
                "error_code": "SLIP_DATE_MISMATCH",
                "slip_date": slip_date,
                "today_mmt": today_mmt,
                "slip_receiver_name": slip_receiver_name or expected_receiver_name,
                "slip_phone_suffix": slip_phone_suffix or expected_phone_suffix,
                "matched_tx_id": tx_match,
                "input_amount": input_amount
            }

    # 4B. Check Slip Time (Second)
    slip_time = extract_slip_time(normalized_text)
    if not slip_time:
        return False, f"ငွေလွှဲပြေစာပါ ရက်စွဲမှာ ယနေ့ ({slip_date.strftime('%d/%m/%Y')}) ဖြစ်သော်လည်း ငွေလွှဲချိန် (Time) အား တိကျစွာ မဖတ်ရှုနိုင်သဖြင့် Admin မှ စစ်ဆေးပေးပါမည် (Time Unverified).", {
            "error_code": "SLIP_TIME_UNVERIFIED",
            "slip_date": slip_date,
            "slip_receiver_name": slip_receiver_name or expected_receiver_name,
            "slip_phone_suffix": slip_phone_suffix or expected_phone_suffix,
            "matched_tx_id": tx_match,
            "input_amount": input_amount
        }

    from app.core.timezone_utils import MMT_TZ
    slip_datetime = MMT_TZ.localize(datetime.combine(slip_date, slip_time))

    if submission_time_mmt:
        delta_mins = (submission_time_mmt - slip_datetime).total_seconds() / 60.0
        if delta_mins > 15.0:
            return False, f"ငွေလွှဲပြေစာသည် သတ်မှတ်ချိန် (၁၅ မိနစ်) ကျော်လွန်နေပါသည်ခင်ဗျာ (ပြေစာပါအချိန်: {slip_datetime.strftime('%H:%M:%S')}၊ လွန်ခဲ့သော {delta_mins:.1f} မိနစ်က လွှဲခဲ့သည်)။", {
                "error_code": "SLIP_TIMESTAMP_EXPIRED",
                "slip_date": slip_date,
                "slip_time": slip_time,
                "slip_datetime": slip_datetime,
                "delta_minutes": round(delta_mins, 1),
                "slip_receiver_name": slip_receiver_name or expected_receiver_name,
                "slip_phone_suffix": slip_phone_suffix or expected_phone_suffix,
                "matched_tx_id": tx_match,
                "input_amount": input_amount
            }
        elif delta_mins < -5.0:
            return False, f"ငွေလွှဲပြေစာပါ အချိန်သည် အနာဂတ်အချိန် ဖြစ်နေပါသည်ခင်ဗျာ (ပြေစာပါအချိန်: {slip_datetime.strftime('%H:%M:%S')})။", {
                "error_code": "SLIP_TIMESTAMP_FUTURE",
                "slip_date": slip_date,
                "slip_time": slip_time,
                "slip_datetime": slip_datetime,
                "delta_minutes": round(delta_mins, 1)
            }

    return True, "ငွေလွှဲပြေစာအား အောင်မြင်စွာ စိစစ်ပြီးပါပြီ (Slip Verified Successfully).", {
        "slip_receiver_name": slip_receiver_name or expected_receiver_name,
        "slip_phone_suffix": slip_phone_suffix or expected_phone_suffix,
        "matched_tx_id": tx_match,
        "input_amount": input_amount,
        "slip_date": slip_date,
        "slip_time": slip_time,
        "slip_datetime": slip_datetime
    }
