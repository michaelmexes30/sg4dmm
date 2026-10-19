from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean
from app.database import Base
from app.core.timezone_utils import now_mmt

class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    
    # Payment Gateways Configuration (WavePay & KPay)
    wave_phone = Column(String(50), default="09894169717")
    wave_name = Column(String(100), default="Ye Win Htut")
    wave_qr_url = Column(String(255), nullable=True, default="/assets/wave_qr_sample.png")
    
    kpay_phone = Column(String(50), default="09798888888")
    kpay_name = Column(String(100), default="Daw Hla Hla")
    kpay_qr_url = Column(String(255), nullable=True, default="/assets/kpay_qr_sample.png")

    # 4D Game Settings & Restrictions
    bet_end_time = Column(String(20), default="04:30 PM")
    result_confirm_time = Column(String(20), default="06:00 PM")
    consecutive_reward_percent = Column(Float, default=20.0) # 20%
    min_amount_per_bet = Column(Float, default=50.0)
    max_amount_per_bet = Column(Float, default=10000.0)
    max_amount_per_slip = Column(Float, default=100000.0)
    max_amount_per_number = Column(Float, default=11000.0) # Max risk cap per single 4D number
    default_bet_amount = Column(Float, default=100.0)

    # Company Ledger Summary tracking
    company_balance_oct = Column(Float, default=4198200.0) # Matches screenshot Ks 4,198,200

    # Active Player Weekly Bonus & Agent Commission Settings
    weekly_bonus_rate = Column(Float, default=10.0) # 10%
    weekly_bonus_min_bet = Column(Float, default=10000.0) # 10,000 MMK
    commission_rate = Column(Float, default=30.0) # 30% Agent Commission

    # Agent Level & Credit Multiplier System (Deposit x Multiplier = Credit)
    # Default credit multiplier is 1.6x (e.g. 100,000 MMK Deposit gives 160,000 MMK Credit)
    agent_credit_multiplier = Column(Float, default=1.6)
    # Agent Credit Feature Status: False = Temporarily Suspended (ခေတ္တဆိုင်းငံ့ထားသည်)
    is_agent_credit_enabled = Column(Boolean, default=False)
    
    # 5 Level Deposit Requirements
    agent_lvl1_deposit = Column(Float, default=100000.0)   # Level 1: 100,000 MMK
    agent_lvl2_deposit = Column(Float, default=300000.0)   # Level 2: 300,000 MMK
    agent_lvl3_deposit = Column(Float, default=500000.0)   # Level 3: 500,000 MMK
    agent_lvl4_deposit = Column(Float, default=800000.0)   # Level 4: 800,000 MMK
    agent_lvl5_deposit = Column(Float, default=1000000.0)  # Level 5: 1,000,000 MMK

    # Turnover Targets required to Level Up (Agent self-bets + Downline bets)
    agent_lvl2_target_turnover = Column(Float, default=6000000.0)  # Tier 2: 6,000,000 MMK
    agent_lvl3_target_turnover = Column(Float, default=10000000.0) # Tier 3: 10,000,000 MMK
    agent_lvl4_target_turnover = Column(Float, default=15000000.0) # Tier 4: 15,000,000 MMK
    agent_lvl5_target_turnover = Column(Float, default=20000000.0) # Tier 5: 20,000,000 MMK

    # 4 Tier Commission Percentage & Turnover Targets
    agent_tier1_turnover = Column(Float, default=3000000.0)  # Tier 1: 3,000,000 MMK
    agent_tier1_commission = Column(Float, default=15.0)     # Tier 1: 15%
    agent_tier2_turnover = Column(Float, default=6000000.0)  # Tier 2: 6,000,000 MMK
    agent_tier2_commission = Column(Float, default=20.0)     # Tier 2: 20%
    agent_tier3_turnover = Column(Float, default=10000000.0) # Tier 3: 10,000,000 MMK
    agent_tier3_commission = Column(Float, default=25.0)     # Tier 3: 25%
    agent_tier4_turnover = Column(Float, default=15000000.0) # Tier 4: 15,000,000 MMK
    agent_tier4_commission = Column(Float, default=30.0)     # Tier 4: 30%

    updated_at = Column(DateTime, default=now_mmt, onupdate=now_mmt)

class ApplicationRelease(Base):
    __tablename__ = "application_releases"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False) # e.g. "Salone4D_V1.0.15"
    build_number = Column(Integer, nullable=False) # e.g. 24
    version = Column(String(30), nullable=False) # e.g. "1.0.15"
    apk_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=now_mmt)
