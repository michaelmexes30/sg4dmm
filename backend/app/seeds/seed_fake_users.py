import random
import json
import re
import logging
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.lottery import LotteryDraw, DrawStatus
from app.core.security import hash_password

logger = logging.getLogger("seed_fake_users")

# Category A: 100 Authentic Myanmar script nicknames & handles
BURMESE_HANDLES = [
    "ချစ်သူ့မောင်", "စာဥလေး", "ဘိုကျား", "ဆရာကြီးမျိုး", "ရွှေမင်းသား", "မင်းသမီးလေး", "ဖိုးလပြည့်",
    "ကံထူးရှင်", "ကိုပေါက်", "ငွေလမင်း", "မေပျို", "သဲလေး", "မမမိုး", "ကိုထက်", "ညီလေး",
    "အောင်ဇေယျ", "စိန်ရွှေမိုး", "မိုးမိုး", "လူလည်လေး", "ကိုကြီးကျော်", "ဆုကြီးရှင်", "ကံစမ်းမောင်",
    "မောင်ချစ်", "ဥက္ကာမင်း", "ထူးထူး", "မိုးညို", "မင်းမင်း", "နွယ်နွယ်", "ဝင်းဝင်း", "ကျော်ကြီး",
    "သားကြီး", "ပန်းနု", "ချစ်လေး", "ဝက်ကလေး", "မိုးကောင်း", "ရွှေဘိုသား", "မန္တလေးသား", "ရန်ကုန်သူ",
    "မုံရွာသား", "ပုဂံသား", "မြဝတီသား", "ထားဝယ်သူ", "တောင်ကြီးသူ", "ဧရာဝတီသား", "ပဲခူးသား", "ရွှေစင်",
    "မေသူ", "ယမင်း", "စန္ဒီ", "နီလာ", "မေစပယ်", "ဇေယျာ", "မင်းခန့်", "ဘုန်းမြတ်", "ရဲရင့်",
    "ကောင်းမြတ်", "အောင်ကောင်း", "သက်ပိုင်", "ဝေယံ", "ကျော်ဇင်", "ဟိန်းထက်", "ဖြိုးဝေ", "ဇင်မင်း",
    "နေလင်း", "စိုးမိုး", "သန့်ဇင်", "မျိုးမင်း", "တင်ဝင်း", "ချစ်ကို", "လင်းထက်", "ဉာဏ်လင်း",
    "မြတ်သူ", "အောင်သူ", "အောင်ဆန်း", "ထက်အောင်", "ရဲမင်း", "မိုးထက်", "ဇော်ဇော်", "သီဟ",
    "စိုးစိုး", "လှလှ", "မြမြ", "သန်းသန်း", "တင်တင်", "စန်းစန်း", "အေးအေး", "ခင်ခင်", "ရီရီ",
    "ကြည်ကြည်", "သောင်းသောင်း", "မြင့်မြင့်", "မောင်မောင်", "နိုင်နိုင်", "ဇင်ဇင်", "မေမေ", "ဖိုးသား",
    "အာလူးလေး", "မမကြီး", "ကိုကို", "မေတ္တာရှင်", "စိန်ကလေး", "ရွှေကြာ"
]

# Category B: 100 Gaming / Casual / Slang / Football handles
CASUAL_HANDLES = [
    "koko kalay lay", "chit oo may", "mokoo94", "4Dsayar gyi", "Agent84", "Ronaldo7", "Messi10",
    "JackpotHunter", "LuckyMan88", "KyawGyi88", "ShweMinThar", "TharGyi", "KoKoLay", "SuSu99",
    "MgKaung", "ZawGyi", "BoGyi99", "King4D", "LuckyBoy99", "GoldDigger", "WinnerKing",
    "ProGambler", "Master4D", "GoldenPeacock", "AungBalar", "HtunHtun77", "LinLin88", "MinMin99",
    "KaungKaung", "NyiLay94", "ChitThu", "SweetGirl", "PrincessMay", "AngelPoe", "SmartBoy",
    "CoolZaw", "RockStar9", "AlphaMan", "Tiger88", "Dragon99", "EagleEye", "Phoenix7",
    "BlackPanther", "StarBoy", "TopPlayer", "VIP_Aung", "BossKyaw", "BigBossZaw", "SuperStar",
    "Champion88", "SpeedyWin", "GoldenBoy", "RichMan99", "BillionaireZaw", "SevenStar", "NineNine",
    "TripleSeven", "Power4D", "NumberOne", "ApexHunter", "GhostRider", "Shadow99", "Falcon8",
    "LionHeart", "ThunderBolt", "LightningWin", "StormBringer", "FireBall", "IceCool", "SunnyBoy",
    "MoonLight", "StarGazer", "SkyWalker", "NightOwl", "DayDreamer", "GoldenTouch", "MagicHands",
    "FortuneHunter", "DestinyWin", "CashKing", "MoneyMaker", "DollarSign", "EuroStar", "SingaPools",
    "TotoMaster", "LuckyStrike", "GrandSlam", "HighRoller", "PokerFace", "AceWinner", "CardShark",
    "DiceRoller", "WheelFortune", "JackpotWinner", "MillionaireMaker", "GoldRush", "SilverBullet",
    "DiamondWin", "RubyStar", "SpeedDemon", "IronMan", "CaptainWin", "NeoMatrix"
]

# Category C: 100 Realistic Short Names (no U / Daw)
SHORT_NAMES = [
    "Myint Zaw", "Zaw Oo", "Aung Kyaw", "Tun Tun", "Thant Zin", "Kyaw Gyi", "Su Myat",
    "Nilar Win", "Min Khant", "Wai Yan", "Hein Htet", "Phyo Wai", "Zin Min", "Nay Lin",
    "Thet Paing", "Kaung Myat", "Yan Naing", "Htet Aung", "Myo Min", "Tin Win", "Ye Min",
    "Sai Tun", "Sai Lin", "Sai Lwin", "Bhone Myat", "Sithu Win", "Zayar Tun", "Hnin Ei",
    "Aye Thida", "Phyu Phyu", "Ei Thandar", "Yoon Waddy", "May Thet", "Thinzar Moe", "Sandar Myint",
    "Poe Ei", "Chaw Su", "Wut Yee", "Shwe Zin", "Myat Noe", "Thiri Aung", "Khin Myo",
    "Zin Mar", "Nandar Win", "Khaing Khaing", "Yadanar Bo", "Thet Htar", "Hsu Myat", "Nadi Moe",
    "Yu Yu", "Mi Mi", "San San", "Nwe Nwe", "May May", "Khin Khin", "Aye Aye", "Hla Hla",
    "Mya Mya", "Swe Swe", "Win Win", "Tin Tin", "Than Than", "Soe Soe", "Moe Moe", "Nyein Nyein",
    "Kyaw Kyaw", "Aung Aung", "Min Min", "Thant Thant", "Myo Myo", "Zaw Zaw", "Hein Hein",
    "Ko Ko", "Bo Bo", "Nyi Nyi", "Po Po", "To To", "Phoe Phoe", "Naing Naing", "Lin Lin",
    "Lwin Lwin", "Khant Khant", "Htut Htut", "Lay Lay", "Gyi Gyi", "Thu Thu", "Thiha Zaw",
    "Nay Chi", "Pan Ei", "Nan Khin", "Thaw Zin", "Pyae Phyo", "Kaung Sett", "Swan Htet",
    "Kaung Kin", "Thura Aung", "Aung Myo", "Zin Ko", "Chit San", "Moe Yan"
]

PHONE_PREFIXES = [
    "0979", "0978", "0977", "0976", # Atom/Telenor
    "0997", "0996", "0995", "0998", # Ooredoo
    "0925", "0926", "0942", "0944", "0945", "0940", # MPT
    "0969", "0968", "0967" # Mytel
]

def mask_name(name: str) -> str:
    """Masks name or handle for privacy:
    'ချစ်သူ့မောင်' -> 'ချစ်သူ့***'
    'စာဥလေး' -> 'စာဥ***'
    'koko kalay lay' -> 'koko kalay l***'
    'Myint Zaw' -> 'Myint Z***'
    'Ronaldo7' -> 'Ronaldo***'
    'ဆရာကြီးမျိုး' -> 'ဆရာကြီး***'
    """
    if not name:
        return "***"
        
    has_burmese = any('\u1000' <= char <= '\u109f' for char in name)
    if has_burmese:
        # For Burmese script handles
        if len(name) <= 3:
            return name[0] + "***"
        elif len(name) <= 6:
            return name[:len(name)-2] + "***"
        else:
            return name[:len(name)-3] + "***"

    parts = name.split()
    if len(parts) > 1:
        prefix = ' '.join(parts[:-1])
        last = parts[-1]
        return f"{prefix} {last[0]}***"
    else:
        if len(name) <= 4:
            return name[:2] + "***"
        return name[:-3] + "***"

def mask_phone(phone: str) -> str:
    """e.g. '09791234567' -> '0979***567'"""
    clean = phone.replace("+95", "0")
    if len(clean) >= 9:
        return f"{clean[:4]}***{clean[-3:]}"
    return clean[:3] + "***" + clean[-2:]

def generate_300_myanmar_users(count=300):
    users = []
    used_phones = set()
    used_usernames = set()
    
    # Interleave 100 Burmese handles, 100 Casual/Slang handles, 100 Short names
    raw_names = []
    for i in range(100):
        if i < len(BURMESE_HANDLES): raw_names.append(BURMESE_HANDLES[i])
        if i < len(CASUAL_HANDLES): raw_names.append(CASUAL_HANDLES[i])
        if i < len(SHORT_NAMES): raw_names.append(SHORT_NAMES[i])
        
    random.seed(20261014) # Deterministic
    
    for i in range(count):
        full_name = raw_names[i % len(raw_names)]
        
        # Username generation
        # Clean latin characters for username
        cleaned_latin = re.sub(r'[^a-zA-Z0-9]', '', full_name.lower())
        if not cleaned_latin or len(cleaned_latin) < 3:
            cleaned_latin = f"user_{i+10}"
            
        suffix_num = random.randint(10, 999)
        username = f"{cleaned_latin}{suffix_num}"
        while username in used_usernames:
            suffix_num = random.randint(100, 9999)
            username = f"{cleaned_latin}{suffix_num}"
        used_usernames.add(username)
        
        # Phone generation
        p_prefix = random.choice(PHONE_PREFIXES)
        p_mid = random.randint(1000000, 9999999)
        phone = f"{p_prefix}{str(p_mid)[-7:]}"
        while phone in used_phones:
            p_mid = random.randint(1000000, 9999999)
            phone = f"{p_prefix}{str(p_mid)[-7:]}"
        used_phones.add(phone)
        
        users.append({
            "index": i,
            "username": username,
            "phone": phone,
            "full_name": full_name,
            "masked_name": mask_name(full_name),
            "masked_phone": mask_phone(phone),
            "balance": float(random.randint(15, 120) * 1000)
        })
        
    return users

FAKE_USERS_POOL = generate_300_myanmar_users(300)

def seed_fake_users_into_db(db: Session):
    """Inserts the 300 fake Myanmar players into users table if not already seeded"""
    default_hashed_pw = hash_password("player123")
    seeded_count = 0
    
    for u_data in FAKE_USERS_POOL:
        existing = db.query(User).filter(
            (User.phone == u_data["phone"]) | (User.username == u_data["username"])
        ).first()
        if not existing:
            new_u = User(
                username=u_data["username"],
                phone=u_data["phone"],
                full_name=u_data["full_name"],
                hashed_password=default_hashed_pw,
                role=UserRole.USER,
                balance=u_data["balance"],
                is_active=True,
                is_verified=True,
                is_simulated=True,
                country_code="+95",
                referred_by_code=None,
                agent_id=None
            )
            db.add(new_u)
            seeded_count += 1
            
    if seeded_count > 0:
        db.commit()
        logger.info(f"Seeded {seeded_count} fake Myanmar users into users table.")
    return len(FAKE_USERS_POOL)

def generate_winners_for_draw(draw: LotteryDraw, user_start_index: int) -> list:
    """
    Generates a realistic non-repeating winner set for a settled draw based on the 300 user pool.
    Rules:
    - User slice starts at user_start_index and picks distinct users.
    - Matches user request:
      Wednesday Draw (like 2026-10-14):
      - 1st Prize: 10,000,000 MMK (1 winner) e.g. "ချစ်သူ့မောင်"
      - 2nd Prize: 1,600,000 MMK (1 winner) e.g. "Zaw Oo"
      - 3rd Prize: NIL (0 winners)
      - Starter Prizes: 9 persons with different amounts (e.g. "ဆရာကြီးမျိုး", "koko kalay lay", "စာဥလေး", "Ronaldo7", "Myint Zaw", "ဘိုကျား", "mokoo94", "chit oo may", "4Dsayar gyi")
      - Consolation Prizes: 5 persons with different amounts (e.g. "Agent84", "ရွှေမင်းသား", "Thant Zin", "မင်းသမီးလေး", "LuckyMan88")
    - Other draws have realistic varying distributions with NILs on some prizes.
    """
    starters = draw.starter_prizes
    consolations = draw.consolidation_prizes
    draw_date = draw.draw_date
    draw_number = draw.draw_number
    
    winners = []
    user_cursor = user_start_index % len(FAKE_USERS_POOL)
    
    def get_next_user():
        nonlocal user_cursor
        user = FAKE_USERS_POOL[user_cursor]
        user_cursor = (user_cursor + 1) % len(FAKE_USERS_POOL)
        return user

    # 1. Wednesday 2026-10-14 Specific Guidelines
    if draw_date == "2026-10-14":
        # 1st Prize: 10,000,000 MMK (e.g. "ချစ်သူ့မောင်")
        u1 = get_next_user()
        winners.append({
            "user_id": u1["index"] + 10,
            "player_name": "ချစ်သူ့မောင်",
            "masked_name": mask_name("ချစ်သူ့မောင်"),
            "phone": u1["phone"],
            "masked_phone": u1["masked_phone"],
            "prize_tier": "1st Prize",
            "prize_tier_mm": "ပထမဆု",
            "winning_number": draw.first_prize,
            "stake_amount": 5000,
            "multiplier": 2000,
            "payout_amount": 10000000,
            "draw_date": draw_date,
            "draw_number": draw_number,
            "is_simulated": True
        })
        
        # 2nd Prize: 1,600,000 MMK (e.g. "Zaw Oo")
        u2 = get_next_user()
        winners.append({
            "user_id": u2["index"] + 10,
            "player_name": "Zaw Oo",
            "masked_name": mask_name("Zaw Oo"),
            "phone": u2["phone"],
            "masked_phone": u2["masked_phone"],
            "prize_tier": "2nd Prize",
            "prize_tier_mm": "ဒုတိယဆု",
            "winning_number": draw.second_prize,
            "stake_amount": 1600,
            "multiplier": 1000,
            "payout_amount": 1600000,
            "draw_date": draw_date,
            "draw_number": draw_number,
            "is_simulated": True
        })
        
        # 3rd Prize: NIL (Explicitly NO winner for 3rd prize as requested!)
        
        # Starter Prizes: 9 persons with different amounts
        starter_names = [
            "ဆရာကြီးမျိုး", "koko kalay lay", "စာဥလေး", "Ronaldo7", "Myint Zaw",
            "ဘိုကျား", "mokoo94", "chit oo may", "4Dsayar gyi"
        ]
        starter_stakes = [5000, 3000, 2000, 2000, 1000, 1000, 1000, 500, 500]
        for idx, stake in enumerate(starter_stakes):
            u = get_next_user()
            custom_name = starter_names[idx] if idx < len(starter_names) else u["full_name"]
            num = starters[idx % len(starters)] if starters else "5075"
            winners.append({
                "user_id": u["index"] + 10,
                "player_name": custom_name,
                "masked_name": mask_name(custom_name),
                "phone": u["phone"],
                "masked_phone": u["masked_phone"],
                "prize_tier": "Starter Prize",
                "prize_tier_mm": "အထူးဆု",
                "winning_number": num,
                "stake_amount": stake,
                "multiplier": 100,
                "payout_amount": stake * 100,
                "draw_date": draw_date,
                "draw_number": draw_number,
                "is_simulated": True
            })
            
        # Consolation Prizes: 5 persons with different amounts
        cons_names = ["Agent84", "ရွှေမင်းသား", "Thant Zin", "မင်းသမီးလေး", "LuckyMan88"]
        cons_stakes = [5000, 3000, 2000, 1000, 1000]
        for idx, stake in enumerate(cons_stakes):
            u = get_next_user()
            custom_name = cons_names[idx] if idx < len(cons_names) else u["full_name"]
            num = consolations[idx % len(consolations)] if consolations else "1125"
            winners.append({
                "user_id": u["index"] + 10,
                "player_name": custom_name,
                "masked_name": mask_name(custom_name),
                "phone": u["phone"],
                "masked_phone": u["masked_phone"],
                "prize_tier": "Consolation Prize",
                "prize_tier_mm": "နှစ်သိမ့်ဆု",
                "winning_number": num,
                "stake_amount": stake,
                "multiplier": 30,
                "payout_amount": stake * 30,
                "draw_date": draw_date,
                "draw_number": draw_number,
                "is_simulated": True
            })

    elif draw_date == "2026-10-11": # Sunday
        # 1st Prize: NIL
        u2 = get_next_user()
        winners.append({
            "user_id": u2["index"] + 10,
            "player_name": u2["full_name"],
            "masked_name": u2["masked_name"],
            "phone": u2["phone"],
            "masked_phone": u2["masked_phone"],
            "prize_tier": "2nd Prize",
            "prize_tier_mm": "ဒုတိယဆု",
            "winning_number": draw.second_prize,
            "stake_amount": 2000,
            "multiplier": 1000,
            "payout_amount": 2000000,
            "draw_date": draw_date,
            "draw_number": draw_number,
            "is_simulated": True
        })
        u3 = get_next_user()
        winners.append({
            "user_id": u3["index"] + 10,
            "player_name": u3["full_name"],
            "masked_name": u3["masked_name"],
            "phone": u3["phone"],
            "masked_phone": u3["masked_phone"],
            "prize_tier": "3rd Prize",
            "prize_tier_mm": "တတိယဆု",
            "winning_number": draw.third_prize,
            "stake_amount": 1000,
            "multiplier": 500,
            "payout_amount": 500000,
            "draw_date": draw_date,
            "draw_number": draw_number,
            "is_simulated": True
        })
        # 7 Starters
        for idx, stake in enumerate([4000, 3000, 2000, 1000, 1000, 500, 500]):
            u = get_next_user()
            winners.append({
                "user_id": u["index"] + 10,
                "player_name": u["full_name"],
                "masked_name": u["masked_name"],
                "phone": u["phone"],
                "masked_phone": u["masked_phone"],
                "prize_tier": "Starter Prize",
                "prize_tier_mm": "အထူးဆု",
                "winning_number": starters[idx % len(starters)] if starters else "5000",
                "stake_amount": stake,
                "multiplier": 100,
                "payout_amount": stake * 100,
                "draw_date": draw_date,
                "draw_number": draw_number,
                "is_simulated": True
            })
        # 6 Consolations
        for idx, stake in enumerate([3000, 2000, 1000, 1000, 500, 500]):
            u = get_next_user()
            winners.append({
                "user_id": u["index"] + 10,
                "player_name": u["full_name"],
                "masked_name": u["masked_name"],
                "phone": u["phone"],
                "masked_phone": u["masked_phone"],
                "prize_tier": "Consolation Prize",
                "prize_tier_mm": "နှစ်သိမ့်ဆု",
                "winning_number": consolations[idx % len(consolations)] if consolations else "1000",
                "stake_amount": stake,
                "multiplier": 30,
                "payout_amount": stake * 30,
                "draw_date": draw_date,
                "draw_number": draw_number,
                "is_simulated": True
            })

    elif draw_date == "2026-10-10": # Saturday
        # 1st Prize: 6,000,000 MMK
        u1 = get_next_user()
        winners.append({
            "user_id": u1["index"] + 10,
            "player_name": u1["full_name"],
            "masked_name": u1["masked_name"],
            "phone": u1["phone"],
            "masked_phone": u1["masked_phone"],
            "prize_tier": "1st Prize",
            "prize_tier_mm": "ပထမဆု",
            "winning_number": draw.first_prize,
            "stake_amount": 3000,
            "multiplier": 2000,
            "payout_amount": 6000000,
            "draw_date": draw_date,
            "draw_number": draw_number,
            "is_simulated": True
        })
        # 2nd Prize: NIL
        # 3rd Prize: 500,000 MMK
        u3 = get_next_user()
        winners.append({
            "user_id": u3["index"] + 10,
            "player_name": u3["full_name"],
            "masked_name": u3["masked_name"],
            "phone": u3["phone"],
            "masked_phone": u3["masked_phone"],
            "prize_tier": "3rd Prize",
            "prize_tier_mm": "တတိယဆု",
            "winning_number": draw.third_prize,
            "stake_amount": 1000,
            "multiplier": 500,
            "payout_amount": 500000,
            "draw_date": draw_date,
            "draw_number": draw_number,
            "is_simulated": True
        })
        # 8 Starters
        for idx, stake in enumerate([3000, 2000, 2000, 1000, 1000, 1000, 500, 500]):
            u = get_next_user()
            winners.append({
                "user_id": u["index"] + 10,
                "player_name": u["full_name"],
                "masked_name": u["masked_name"],
                "phone": u["phone"],
                "masked_phone": u["masked_phone"],
                "prize_tier": "Starter Prize",
                "prize_tier_mm": "အထူးဆု",
                "winning_number": starters[idx % len(starters)] if starters else "5000",
                "stake_amount": stake,
                "multiplier": 100,
                "payout_amount": stake * 100,
                "draw_date": draw_date,
                "draw_number": draw_number,
                "is_simulated": True
            })
        # 4 Consolations
        for idx, stake in enumerate([2000, 1000, 1000, 500]):
            u = get_next_user()
            winners.append({
                "user_id": u["index"] + 10,
                "player_name": u["full_name"],
                "masked_name": u["masked_name"],
                "phone": u["phone"],
                "masked_phone": u["masked_phone"],
                "prize_tier": "Consolation Prize",
                "prize_tier_mm": "နှစ်သိမ့်ဆု",
                "winning_number": consolations[idx % len(consolations)] if consolations else "1000",
                "stake_amount": stake,
                "multiplier": 30,
                "payout_amount": stake * 30,
                "draw_date": draw_date,
                "draw_number": draw_number,
                "is_simulated": True
            })

    elif draw_date == "2026-10-07": # Wednesday
        # 1st Prize: 8,000,000 MMK
        u1 = get_next_user()
        winners.append({
            "user_id": u1["index"] + 10,
            "player_name": u1["full_name"],
            "masked_name": u1["masked_name"],
            "phone": u1["phone"],
            "masked_phone": u1["masked_phone"],
            "prize_tier": "1st Prize",
            "prize_tier_mm": "ပထမဆု",
            "winning_number": draw.first_prize,
            "stake_amount": 4000,
            "multiplier": 2000,
            "payout_amount": 8000000,
            "draw_date": draw_date,
            "draw_number": draw_number,
            "is_simulated": True
        })
        # 2nd Prize: 1,000,000 MMK
        u2 = get_next_user()
        winners.append({
            "user_id": u2["index"] + 10,
            "player_name": u2["full_name"],
            "masked_name": u2["masked_name"],
            "phone": u2["phone"],
            "masked_phone": u2["masked_phone"],
            "prize_tier": "2nd Prize",
            "prize_tier_mm": "ဒုတိယဆု",
            "winning_number": draw.second_prize,
            "stake_amount": 1000,
            "multiplier": 1000,
            "payout_amount": 1000000,
            "draw_date": draw_date,
            "draw_number": draw_number,
            "is_simulated": True
        })
        # 3rd Prize: 1,000,000 MMK (2,000 stake x 500)
        u3 = get_next_user()
        winners.append({
            "user_id": u3["index"] + 10,
            "player_name": u3["full_name"],
            "masked_name": u3["masked_name"],
            "phone": u3["phone"],
            "masked_phone": u3["masked_phone"],
            "prize_tier": "3rd Prize",
            "prize_tier_mm": "တတိယဆု",
            "winning_number": draw.third_prize,
            "stake_amount": 2000,
            "multiplier": 500,
            "payout_amount": 1000000,
            "draw_date": draw_date,
            "draw_number": draw_number,
            "is_simulated": True
        })
        # 10 Starters
        for idx, stake in enumerate([5000, 3000, 2000, 2000, 1000, 1000, 1000, 500, 500, 500]):
            u = get_next_user()
            winners.append({
                "user_id": u["index"] + 10,
                "player_name": u["full_name"],
                "masked_name": u["masked_name"],
                "phone": u["phone"],
                "masked_phone": u["masked_phone"],
                "prize_tier": "Starter Prize",
                "prize_tier_mm": "အထူးဆု",
                "winning_number": starters[idx % len(starters)] if starters else "5000",
                "stake_amount": stake,
                "multiplier": 100,
                "payout_amount": stake * 100,
                "draw_date": draw_date,
                "draw_number": draw_number,
                "is_simulated": True
            })
        # 6 Consolations
        for idx, stake in enumerate([4000, 2000, 1000, 1000, 500, 500]):
            u = get_next_user()
            winners.append({
                "user_id": u["index"] + 10,
                "player_name": u["full_name"],
                "masked_name": u["masked_name"],
                "phone": u["phone"],
                "masked_phone": u["masked_phone"],
                "prize_tier": "Consolation Prize",
                "prize_tier_mm": "နှစ်သိမ့်ဆု",
                "winning_number": consolations[idx % len(consolations)] if consolations else "1000",
                "stake_amount": stake,
                "multiplier": 30,
                "payout_amount": stake * 30,
                "draw_date": draw_date,
                "draw_number": draw_number,
                "is_simulated": True
            })

    else:
        # Default realistic generator for other draws (2026-10-04, 2026-10-03, and future draws)
        has_first = random.random() < 0.75 # 75% chance 1st prize won
        if has_first:
            u1 = get_next_user()
            stake1 = random.choice([2000, 3000, 4000, 5000])
            winners.append({
                "user_id": u1["index"] + 10,
                "player_name": u1["full_name"],
                "masked_name": u1["masked_name"],
                "phone": u1["phone"],
                "masked_phone": u1["masked_phone"],
                "prize_tier": "1st Prize",
                "prize_tier_mm": "ပထမဆု",
                "winning_number": draw.first_prize,
                "stake_amount": stake1,
                "multiplier": 2000,
                "payout_amount": stake1 * 2000,
                "draw_date": draw_date,
                "draw_number": draw_number,
                "is_simulated": True
            })
            
        has_second = random.random() < 0.85
        if has_second:
            u2 = get_next_user()
            stake2 = random.choice([1000, 1500, 2000])
            winners.append({
                "user_id": u2["index"] + 10,
                "player_name": u2["full_name"],
                "masked_name": u2["masked_name"],
                "phone": u2["phone"],
                "masked_phone": u2["masked_phone"],
                "prize_tier": "2nd Prize",
                "prize_tier_mm": "ဒုတိယဆု",
                "winning_number": draw.second_prize,
                "stake_amount": stake2,
                "multiplier": 1000,
                "payout_amount": stake2 * 1000,
                "draw_date": draw_date,
                "draw_number": draw_number,
                "is_simulated": True
            })

        has_third = random.random() < 0.65 # Sometimes NIL
        if has_third:
            u3 = get_next_user()
            stake3 = random.choice([500, 1000, 2000])
            winners.append({
                "user_id": u3["index"] + 10,
                "player_name": u3["full_name"],
                "masked_name": u3["masked_name"],
                "phone": u3["phone"],
                "masked_phone": u3["masked_phone"],
                "prize_tier": "3rd Prize",
                "prize_tier_mm": "တတိယဆု",
                "winning_number": draw.third_prize,
                "stake_amount": stake3,
                "multiplier": 500,
                "payout_amount": stake3 * 500,
                "draw_date": draw_date,
                "draw_number": draw_number,
                "is_simulated": True
            })

        # 6 to 9 Starters
        s_count = random.randint(6, 9)
        for idx in range(s_count):
            u = get_next_user()
            stake = random.choice([500, 1000, 1000, 2000, 3000])
            winners.append({
                "user_id": u["index"] + 10,
                "player_name": u["full_name"],
                "masked_name": u["masked_name"],
                "phone": u["phone"],
                "masked_phone": u["masked_phone"],
                "prize_tier": "Starter Prize",
                "prize_tier_mm": "အထူးဆု",
                "winning_number": starters[idx % len(starters)] if starters else "5000",
                "stake_amount": stake,
                "multiplier": 100,
                "payout_amount": stake * 100,
                "draw_date": draw_date,
                "draw_number": draw_number,
                "is_simulated": True
            })

        # 4 to 6 Consolations
        c_count = random.randint(4, 6)
        for idx in range(c_count):
            u = get_next_user()
            stake = random.choice([500, 1000, 2000, 3000])
            winners.append({
                "user_id": u["index"] + 10,
                "player_name": u["full_name"],
                "masked_name": u["masked_name"],
                "phone": u["phone"],
                "masked_phone": u["masked_phone"],
                "prize_tier": "Consolation Prize",
                "prize_tier_mm": "နှစ်သိမ့်ဆု",
                "winning_number": consolations[idx % len(consolations)] if consolations else "1000",
                "stake_amount": stake,
                "multiplier": 30,
                "payout_amount": stake * 30,
                "draw_date": draw_date,
                "draw_number": draw_number,
                "is_simulated": True
            })

    return winners

def merge_real_and_simulated_winners(real_winners: list, simulated_winners: list) -> list:
    """
    Merges real production winners with simulated winners for public display.
    - Real winners are always placed at the very top (is_simulated=False).
    - Simulated winners are marked is_simulated=True.
    - If a real user wins 1st Prize or 2nd Prize, remove redundant fake ones.
    - Real financial ledger strictly counts real slips only.
    """
    if not real_winners:
        return simulated_winners
        
    for rw in real_winners:
        rw["is_simulated"] = False
        
    real_tiers = {rw.get("prize_tier") for rw in real_winners}
    
    filtered_simulated = []
    for sw in simulated_winners:
        sw["is_simulated"] = True
        if sw.get("prize_tier") in ["1st Prize", "2nd Prize"] and sw.get("prize_tier") in real_tiers:
            continue
        filtered_simulated.append(sw)
        
    return real_winners + filtered_simulated

def populate_all_draws_winners(db: Session):
    """
    Populates winners for all settled draws in the database ensuring
    each draw uses a distinct, non-overlapping batch of the 300 users.
    Production financial ledger is strictly isolated and never touched.
    """
    settled_draws = (
        db.query(LotteryDraw)
        .filter(LotteryDraw.status == DrawStatus.SETTLED)
        .order_by(LotteryDraw.draw_date.desc())
        .all()
    )
    
    user_cursor = 0
    total_populated = 0
    
    for draw in settled_draws:
        draw_winners = generate_winners_for_draw(draw, user_cursor)
        for w in draw_winners:
            w["is_simulated"] = True
            
        draw.winners_json = json.dumps(draw_winners)
        
        # Advance user_cursor by number of winners used so next draw gets completely fresh users!
        user_cursor = (user_cursor + len(draw_winners) + 3) % len(FAKE_USERS_POOL)
        total_populated += len(draw_winners)
        
    db.commit()
    logger.info(f"Populated {total_populated} distinct winners across {len(settled_draws)} settled draws.")
    return total_populated
