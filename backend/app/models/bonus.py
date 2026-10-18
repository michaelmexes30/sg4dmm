from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base
from app.core.timezone_utils import now_mmt

class WeeklyBonus(Base):
    """
    Weekly Bonus records:
    10% cashback bonus distributed every Monday at 11:00 AM MMT
    for players who bet >= 10,000 MMK on at least one draw day (Wed, Sat, Sun).
    """
    __tablename__ = "weekly_bonuses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Calendar week span (MMT)
    week_start_date = Column(String(10), nullable=False) # e.g. "2026-10-05" (Monday)
    week_end_date = Column(String(10), nullable=False)   # e.g. "2026-10-11" (Sunday)
    settlement_date = Column(String(10), nullable=False) # e.g. "2026-10-12" (Monday 11:00 AM)
    
    # Qualifying statistics
    wednesday_bet_total = Column(Float, default=0.0)
    saturday_bet_total = Column(Float, default=0.0)
    sunday_bet_total = Column(Float, default=0.0)
    total_qualifying_bets = Column(Float, nullable=False) # Total bets in the week
    
    qualifying_draw_days_count = Column(Integer, default=0) # Number of draw days with >= 10,000 MMK
    is_qualified = Column(Boolean, default=True)
    
    bonus_rate = Column(Float, default=0.10) # 10%
    bonus_amount = Column(Float, nullable=False) # 10% of total qualifying bets
    
    is_credited = Column(Boolean, default=False)
    credited_at = Column(DateTime, nullable=True)
    user_balance_after = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=now_mmt, index=True)
    user = relationship("User")
