from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, Text
from sqlalchemy.orm import relationship
import enum
import json
from app.database import Base
from app.core.timezone_utils import now_mmt

class DrawStatus(str, enum.Enum):
    UPCOMING = "UPCOMING"
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    SETTLED = "SETTLED"

class LotteryDraw(Base):
    __tablename__ = "lottery_draws"

    id = Column(Integer, primary_key=True, index=True)
    draw_number = Column(String(20), unique=True, index=True, nullable=False) # e.g. "5422/26"
    draw_date = Column(String(20), nullable=False) # e.g. "2026-10-14"
    draw_time_mmt = Column(String(30), default="06:00 PM MMT") # Singapore draw 6:30 PM SGT = 5:00 PM MMT
    status = Column(Enum(DrawStatus), default=DrawStatus.OPEN, nullable=False)
    
    # Official Singapore 4D Results
    first_prize = Column(String(4), nullable=True)
    second_prize = Column(String(4), nullable=True)
    third_prize = Column(String(4), nullable=True)
    
    # JSON list of 10 starter numbers e.g. '["1234", "5678", ...]'
    starter_prizes_json = Column(Text, default="[]")
    
    # JSON list of 10 consolidation numbers e.g. '["9012", "3456", ...]'
    consolidation_prizes_json = Column(Text, default="[]")
    
    # JSON list of admin closed numbers (cannot be bet) e.g. '["1234", "9999"]'
    closed_numbers_json = Column(Text, default="[]")
    
    # JSON list of winning players for social proof & results verification
    winners_json = Column(Text, default="[]")
    
    total_pool_stake = Column(Float, default=0.0)
    total_payout = Column(Float, default=0.0)
    settled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=now_mmt)

    # Relationships
    bets = relationship("BetSlip", back_populates="draw")

    @property
    def starter_prizes(self):
        try:
            return json.loads(self.starter_prizes_json)
        except Exception:
            return []

    @property
    def consolidation_prizes(self):
        try:
            return json.loads(self.consolidation_prizes_json)
        except Exception:
            return []

    @property
    def closed_numbers(self):
        try:
            return json.loads(self.closed_numbers_json) if self.closed_numbers_json else []
        except Exception:
            return []

    @property
    def winners(self):
        try:
            return json.loads(self.winners_json) if self.winners_json else []
        except Exception:
            return []


