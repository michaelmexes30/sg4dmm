from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, Text
import enum
from app.database import Base
from app.core.timezone_utils import now_mmt

class LedgerEntryType(str, enum.Enum):
    DEPOSIT = "DEPOSIT"
    WITHDRAWAL = "WITHDRAWAL"
    BET_REVENUE = "BET_REVENUE"
    PAYOUT_EXPENSE = "PAYOUT_EXPENSE"
    AGENT_COMMISSION = "AGENT_COMMISSION" # 30% agent commission/cashback
    WEEKLY_BONUS = "WEEKLY_BONUS"         # 10% player weekly bonus
    ADJUSTMENT = "ADJUSTMENT"
    REFUND = "REFUND"

class FinancialLedger(Base):
    __tablename__ = "financial_ledger"

    id = Column(Integer, primary_key=True, index=True)
    entry_type = Column(Enum(LedgerEntryType), nullable=False, index=True)
    
    amount = Column(Float, nullable=False) # positive for inflow, negative for expense
    running_balance = Column(Float, default=0.0)
    
    reference_id = Column(String(64), nullable=True, index=True) # slip_code or transaction_id
    reference_type = Column(String(30), nullable=True) # "TRANSACTION", "BET_SLIP", "COMMISSION", "BONUS"
    
    description = Column(Text, nullable=False)
    logged_at_mmt = Column(DateTime, default=now_mmt, index=True)
    date_str = Column(String(10), index=True) # YYYY-MM-DD in MMT

class DailyLedgerSummary(Base):
    """Pre-aggregated daily ledger summary for rapid dashboard reporting"""
    __tablename__ = "daily_ledger_summaries"

    id = Column(Integer, primary_key=True, index=True)
    date_str = Column(String(10), unique=True, index=True, nullable=False)
    
    total_deposits = Column(Float, default=0.0)
    total_withdrawals = Column(Float, default=0.0)
    total_bet_volume = Column(Float, default=0.0)
    total_payouts = Column(Float, default=0.0)
    total_agent_commissions = Column(Float, default=0.0) # 30% agent payouts
    total_weekly_bonuses = Column(Float, default=0.0)    # 10% weekly bonuses
    
    # Net profit = bet_volume - (payouts + agent_commissions + weekly_bonuses)
    net_profit = Column(Float, default=0.0)
    total_transactions_count = Column(Integer, default=0)
    total_bets_count = Column(Integer, default=0)
    
    updated_at_mmt = Column(DateTime, default=now_mmt)
