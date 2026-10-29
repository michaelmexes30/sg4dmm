from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base
from app.core.timezone_utils import now_mmt

class MiniGameBet(Base):
    __tablename__ = "mini_game_bets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    game_type = Column(String(30), nullable=False, index=True) # "WHEEL", "COIN_FLIP", "DICE"
    
    # Financial fields
    stake_amount = Column(Float, nullable=False)
    payout_multiplier = Column(Float, default=0.0)
    payout_amount = Column(Float, default=0.0)
    is_win = Column(Boolean, default=False)
    
    # Game input & outcome metadata
    player_choice = Column(String(50), nullable=True) # e.g. "HEAD", "TAIL", "BIG", "SMALL", "TRIPLE", "SPIN"
    result_data = Column(JSON, nullable=True)         # Details: e.g. {"dice": [4, 5, 2], "sum": 11, "outcome": "BIG"}
    
    created_at = Column(DateTime, default=now_mmt, index=True)
    date_str = Column(String(10), index=True)
