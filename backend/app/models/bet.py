from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
import enum
import json
from app.database import Base
from app.core.timezone_utils import now_mmt

class BetSlipStatus(str, enum.Enum):
    PENDING = "PENDING"
    WON = "WON"
    LOST = "LOST"
    CANCELLED = "CANCELLED"
    VOID = "VOID" # For bets flagged if placed after 4:30 PM cutoff

class BetSlip(Base):
    __tablename__ = "bet_slips"

    id = Column(Integer, primary_key=True, index=True)
    slip_code = Column(String(32), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    draw_id = Column(Integer, ForeignKey("lottery_draws.id"), nullable=False, index=True)
    
    total_stake = Column(Float, nullable=False)
    total_payout = Column(Float, default=0.0)
    status = Column(Enum(BetSlipStatus), default=BetSlipStatus.PENDING, nullable=False)
    
    # Associated Agent & 30% Commission tracking
    agent_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    agent_commission = Column(Float, default=0.0) # 30% of total_stake
    
    # Audit timestamps
    created_at = Column(DateTime, default=now_mmt, index=True)
    settled_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="bets")
    agent = relationship("User", foreign_keys=[agent_id])
    draw = relationship("LotteryDraw", back_populates="bets")
    items = relationship("BetItem", back_populates="slip", cascade="all, delete-orphan")

    @property
    def draw_number(self):
        return self.draw.draw_number if self.draw else None

    @property
    def draw_date(self):
        return self.draw.draw_date if self.draw else None

class BetItem(Base):
    __tablename__ = "bet_items"

    id = Column(Integer, primary_key=True, index=True)
    slip_id = Column(Integer, ForeignKey("bet_slips.id"), nullable=False, index=True)
    
    number = Column(String(4), nullable=False) # e.g. "1234" or "R123"
    bet_type = Column(String(20), default="ordinary") # "ordinary", "box", "roll"
    
    big_amount = Column(Float, default=0.0)
    small_amount = Column(Float, default=0.0)
    
    combination_count = Column(Integer, default=1)
    combinations_json = Column(Text, default="[]") # all expanded 4D numbers
    
    item_stake = Column(Float, nullable=False)
    item_payout = Column(Float, default=0.0)
    is_won = Column(Integer, default=0)
    win_details_json = Column(Text, default="[]")
    edit_logs_json = Column(Text, default="[]")

    slip = relationship("BetSlip", back_populates="items")

    @property
    def combinations(self):
        try:
            return json.loads(self.combinations_json)
        except Exception:
            return [self.number]

    @property
    def win_details(self):
        try:
            return json.loads(self.win_details_json)
        except Exception:
            return []

    @property
    def edit_logs(self):
        try:
            return json.loads(self.edit_logs_json or "[]")
        except Exception:
            return []

class BetArchive(Base):
    """Archive table for settled bets older than 90 days (3 months)"""
    __tablename__ = "bet_archives"

    id = Column(Integer, primary_key=True, index=True)
    original_slip_id = Column(Integer, index=True)
    slip_code = Column(String(32), index=True)
    user_id = Column(Integer, index=True)
    agent_id = Column(Integer, index=True)
    draw_id = Column(Integer, index=True)
    total_stake = Column(Float)
    total_payout = Column(Float)
    agent_commission = Column(Float)
    status = Column(String(20))
    items_data_json = Column(Text)
    bet_created_at = Column(DateTime)
    archived_at = Column(DateTime, default=now_mmt)

class BetEditLog(Base):
    """Audit log tracking every modification made to bet numbers by administrators"""
    __tablename__ = "bet_edit_logs"

    id = Column(Integer, primary_key=True, index=True)
    slip_id = Column(Integer, ForeignKey("bet_slips.id"), nullable=False, index=True)
    bet_item_id = Column(Integer, ForeignKey("bet_items.id"), nullable=False, index=True)
    
    old_number = Column(String(10), nullable=False)
    new_number = Column(String(10), nullable=False)
    
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    admin_name = Column(String(100), nullable=False)
    note = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=now_mmt, index=True)

    slip = relationship("BetSlip")
    bet_item = relationship("BetItem")
    admin = relationship("User")

