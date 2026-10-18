from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base
from app.core.timezone_utils import now_mmt

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    AGENT = "AGENT"
    USER = "USER"
    CUSTOMER_SERVICE = "CUSTOMER_SERVICE"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=True) # e.g. "mglikko"
    nickname = Column(String(100), nullable=True) # e.g. "mglikko", "Theint Thiri Swe"
    phone = Column(String(20), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
    balance = Column(Float, default=0.0, nullable=False)
    is_active = Column(Boolean, default=True)
    is_suspended = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=True) # Telegram Phone Verified
    is_simulated = Column(Boolean, default=False) # True for seed/marketing users
    avatar_url = Column(String(255), nullable=True) # Avatar URL / image
    level = Column(String(20), default="Level 1")
    has_commission = Column(Boolean, default=False)
    country_code = Column(String(10), default="+95")
    telegram_id = Column(String(50), nullable=True)
    telegram_username = Column(String(50), nullable=True)
    
    # Referral & Agent System
    # Agents possess their own unique agent_code (e.g. "AGT8899")
    agent_code = Column(String(30), unique=True, index=True, nullable=True)
    # Users MUST be registered with an agent's referral code
    referred_by_code = Column(String(30), index=True, nullable=True)
    agent_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Agent Commission Tracking
    commission_rate = Column(Float, default=0.30) # 30% cashback
    total_commission_earned = Column(Float, default=0.0)
    
    # Agent Credit & Tuesday Settlement System
    credit_limit = Column(Float, default=0.0)          # e.g. 3,000,000 MMK
    security_deposit = Column(Float, default=0.0)      # e.g. 1,000,000 MMK
    used_credit = Column(Float, default=0.0)           # Current week stake against credit
    is_betting_locked = Column(Boolean, default=False) # Locked if weekly debt is unsettled
    settlement_status = Column(String(30), default="ACTIVE") # ACTIVE, PENDING_SETTLEMENT, OVERDUE_LOCKED
    
    created_at = Column(DateTime, default=now_mmt)
    
    # Relationships
    bets = relationship("BetSlip", back_populates="user", cascade="all, delete-orphan", foreign_keys="BetSlip.user_id")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    referred_users = relationship("User", backref="referring_agent", remote_side=[id], foreign_keys=[agent_id])
    commissions = relationship("AgentCommissionLog", back_populates="agent", foreign_keys="AgentCommissionLog.agent_id")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

class AgentCommissionLog(Base):
    """30% Commission / Cashback earned by agent on user bets (Settled every Tuesday 11:00 AM)"""
    __tablename__ = "agent_commission_logs"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    player_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    bet_slip_id = Column(Integer, ForeignKey("bet_slips.id"), nullable=False, index=True)
    
    bet_total_stake = Column(Float, nullable=False)
    commission_rate = Column(Float, default=0.30)
    commission_amount = Column(Float, nullable=False) # 30% of total stake
    agent_balance_after = Column(Float, nullable=False)
    
    # Tuesday Settlement Status
    is_settled = Column(Boolean, default=False, index=True)
    settled_at = Column(DateTime, nullable=True)
    settlement_batch = Column(String(50), nullable=True)
    settlement_status = Column(String(30), default="PENDING") # PENDING, SETTLED, WITHHELD
    
    created_at = Column(DateTime, default=now_mmt, index=True)

    agent = relationship("User", foreign_keys=[agent_id], back_populates="commissions")
    player = relationship("User", foreign_keys=[player_id])

class Notification(Base):
    """In-app and push notification system"""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True) # Null for broadcast announcement
    title = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    category = Column(String(40), default="Announcement") # Withdraw, Announcement, Win, TopUp
    notif_type = Column(String(40), default="SYSTEM")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now_mmt, index=True)

    user = relationship("User", back_populates="notifications")

class TelegramChatMapping(Base):
    """Mapping of phone number to Telegram Chat ID for automatic OTP and notification delivery"""
    __tablename__ = "telegram_chat_mappings"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(30), unique=True, index=True, nullable=False)
    chat_id = Column(String(50), index=True, nullable=False)
    telegram_username = Column(String(100), nullable=True)
    first_name = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=now_mmt)
    updated_at = Column(DateTime, default=now_mmt, onupdate=now_mmt)

class TelegramVerification(Base):
    """OTP Verification code sent via Telegram Bot"""
    __tablename__ = "telegram_verifications"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(30), nullable=False, index=True)
    code = Column(String(10), nullable=False)
    purpose = Column(String(30), default="register") # "register", "reset_password"
    chat_id = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=now_mmt)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)

class AgentLevelLog(Base):
    """Audit log for manual or automated Agent Level Up / modifications"""
    __tablename__ = "agent_level_logs"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    admin_username = Column(String(50), nullable=True) # e.g. "admin", "CS3"
    
    old_level = Column(String(20), nullable=False) # e.g. "Level 1"
    new_level = Column(String(20), nullable=False) # e.g. "Level 2"
    
    old_deposit = Column(Float, default=0.0)
    new_deposit = Column(Float, default=0.0)
    
    old_credit_limit = Column(Float, default=0.0)
    new_credit_limit = Column(Float, default=0.0)
    
    action_type = Column(String(30), default="MANUAL_OVERRIDE") # "MANUAL_OVERRIDE", "AUTO_PROGRESSION"
    reason = Column(Text, nullable=True) # Admin remarks or notes
    
    created_at = Column(DateTime, default=now_mmt, index=True)

    agent = relationship("User", foreign_keys=[agent_id])
    admin = relationship("User", foreign_keys=[admin_id])
