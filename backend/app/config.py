import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "SG4DMyanmar Golden Peacock Platform (ရွှေဥဒေါင်း)"
    VERSION: str = "2.1.0"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "sg4d-myanmar-electric-purple-super-secret-key-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Timezone settings (Myanmar Standard Time: UTC+6:30)
    TIMEZONE_MMT: str = "Asia/Yangon"
    MMT_OFFSET_HOURS: float = 6.5
    
    # Payment Gateway Operating Hours (MMT)
    GATEWAY_OPERATING_START_HOUR: int = 8   # 08:00 AM MMT
    GATEWAY_OPERATING_END_HOUR: int = 20    # 08:00 PM MMT
    
    # Financial Verification Window (Minutes)
    PAYMENT_EXPIRY_MINUTES: int = 15
    
    # Draw Days & Betting Cutoff Time (MMT)
    DRAW_DAYS: list = ["Wednesday", "Saturday", "Sunday"]
    DRAW_CUTOFF_HOUR: int = 16   # 4:30 PM MMT -> Hour 16
    DRAW_CUTOFF_MINUTE: int = 30 # Minute 30
    DRAW_RESULT_SETTLE_HOUR: int = 18 # 06:00 PM MMT
    
    # Betting Limits per 4D Number (in MMK)
    MIN_BET_AMOUNT: int = 50       # 50 MMK min
    MAX_BET_AMOUNT: int = 10000    # 10,000 MMK max
    
    # Agent Commission & Cashback Rate (30%)
    AGENT_COMMISSION_RATE: float = 0.30
    
    # Active Player Weekly Bonus Rule (10% bonus if >= 10,000 MMK on at least one draw day, settled Tuesday 11:00 AM)
    WEEKLY_BONUS_QUALIFYING_MIN_BET: float = 10000.0 # 10,000 MMK in a single draw day
    WEEKLY_BONUS_RATE: float = 0.10                  # 10% Weekly Bonus
    WEEKLY_BONUS_SCHEDULE_DAY: str = "tue"           # Tuesday
    WEEKLY_BONUS_SCHEDULE_HOUR: int = 11             # 11:00 AM MMT
    WEEKLY_BONUS_SCHEDULE_MINUTE: int = 0
    
    # Weekly Settlement Schedule (Both Weekly Bonus & Agent Commission settled Tuesday 11:00 AM)
    SETTLEMENT_SCHEDULE_DAY: str = "tue"
    SETTLEMENT_WINDOW_START_HOUR: int = 9            # 9:00 AM MMT
    SETTLEMENT_DEADLINE_HOUR: int = 11               # 11:00 AM MMT (Deadline)
    
    # Archive Policy: Retain 90 days (3 months)
    ARCHIVE_RETENTION_DAYS: int = 90
    
    # Database URL
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./sg4dmyanmar.db")
    
    # Designated Official Receiver Accounts for Verification
    RECEIVER_ACCOUNTS: dict = {
        "kpay": [
            {"account_name": "Daw Myo Thiri Khin", "account_number": "09795007441", "qr_code": "/assets/kpay_qr_sample.png"},
            {"account_name": "SG4D Official KPay 2", "account_number": "09798888888", "qr_code": "/static/qr/kpay2.png"}
        ],
        "wavepay": [
            {"account_name": "Ye Win Htut", "account_number": "09894169717", "qr_code": "/assets/wave_qr_sample.png"}
        ],
        "ayapay": [
            {"account_name": "Daw Myo Thiri Khin", "account_number": "09795007441", "qr_code": "/static/qr/aya1.png"}
        ]
    }
    
    # Singapore 4D Standard Payout Multipliers (MMK per 1 MMK unit stake)
    # 1st: 2000x, 2nd: 1000x, 3rd: 500x, Starter: 100x, Consolation: 30x, Box/Permutation Roll: 10x
    PAYOUT_MULTIPLIERS: dict = {
        "first_prize": 2000,
        "second_prize": 1000,
        "third_prize": 500,
        "starter_prize": 100,
        "consolation_prize": 30,
        "box_roll_prize": 10
    }
    
    # Telegram Bot Settings for Sign Up & Forgot Password OTP
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "8983323210:AAHrHimAeBEv9C8VrWpo0qWyF_dLPnedGFc")
    TELEGRAM_BOT_USERNAME: str = os.getenv("TELEGRAM_BOT_USERNAME", "SG4DMyanmarBot")
    TELEGRAM_FINANCE_GROUP_ID: str = os.getenv("TELEGRAM_FINANCE_GROUP_ID", "")

    # Cloud & Deployment URL Settings
    RENDER_EXTERNAL_URL: str = os.getenv("RENDER_EXTERNAL_URL", "https://sg4dmm.onrender.com")
    APK_DOWNLOAD_URL: str = os.getenv(
        "APK_DOWNLOAD_URL", 
        "https://tinyurl.com/sg4d-myanmar-apk"
    )

settings = Settings()

