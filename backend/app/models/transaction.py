from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
import enum
from app.database import Base
from app.core.timezone_utils import now_mmt

class TransactionType(str, enum.Enum):
    DEPOSIT = "DEPOSIT"
    WITHDRAWAL = "WITHDRAWAL"
    WIN_PAYOUT = "WIN_PAYOUT"

class GatewayType(str, enum.Enum):
    KPAY = "kpay"
    WAVEPAY = "wavepay"
    AYAPAY = "ayapay"
    BANK_TRANSFER = "bank_transfer"

class TransactionStatus(str, enum.Enum):
    AUTO_APPROVED = "AUTO_APPROVED"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    FLAGGED_EXPIRED = "FLAGGED_EXPIRED"
    REJECTED = "REJECTED"
    COMPLETED = "COMPLETED"
    REVERTED = "REVERTED"

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    tx_type = Column(Enum(TransactionType), default=TransactionType.DEPOSIT, nullable=False)
    gateway = Column(String(20), nullable=False) # kpay, wavepay, ayapay
    
    # Financial Verification Fields
    transaction_id = Column(String(64), index=True, nullable=False) # User input / extracted
    receiver_id = Column(String(50), nullable=False) # Target agent account / phone
    amount = Column(Float, nullable=False)
    
    # Screenshot proof
    slip_image_url = Column(String(255), nullable=True)
    
    # Timezone & 15-Min Expiry Audit Trail
    tx_timestamp_raw = Column(String(64), nullable=True) # Time string from receipt / user device
    client_timezone = Column(String(20), default="MMT")  # e.g., MMT, ICT, SGT, KST, JST
    tx_timestamp_mmt = Column(DateTime, nullable=False)  # Normalized to MMT (UTC+6:30)
    submission_timestamp_mmt = Column(DateTime, default=now_mmt, nullable=False)
    delta_minutes = Column(Float, default=0.0)
    
    # Verification Result
    is_time_valid = Column(Boolean, default=False)
    is_receiver_valid = Column(Boolean, default=False)
    is_tx_unique = Column(Boolean, default=True)
    
    status = Column(Enum(TransactionStatus), default=TransactionStatus.MANUAL_REVIEW, nullable=False, index=True)
    verification_notes = Column(Text, nullable=True)
    
    # Admin resolution
    reviewed_by = Column(String(50), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=now_mmt, index=True)

    # Relationships
    user = relationship("User", back_populates="transactions")

class TransactionArchive(Base):
    """Archived transaction logs older than 90 days"""
    __tablename__ = "transaction_archives"

    id = Column(Integer, primary_key=True, index=True)
    original_tx_id = Column(Integer, index=True)
    user_id = Column(Integer, index=True)
    tx_type = Column(String(20))
    gateway = Column(String(20))
    transaction_id = Column(String(64), index=True)
    receiver_id = Column(String(50))
    amount = Column(Float)
    status = Column(String(20))
    tx_timestamp_mmt = Column(DateTime)
    submission_timestamp_mmt = Column(DateTime)
    verification_notes = Column(Text)
    created_at = Column(DateTime)
    archived_at = Column(DateTime, default=now_mmt)
