from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class LedgerItemResponse(BaseModel):
    id: int
    entry_type: str
    amount: float
    running_balance: float
    reference_id: Optional[str]
    reference_type: Optional[str]
    description: str
    logged_at_mmt: datetime
    date_str: str

    class Config:
        from_attributes = True

class DailySummaryResponse(BaseModel):
    id: int
    date_str: str
    total_deposits: float
    total_withdrawals: float
    total_bet_volume: float
    total_payouts: float
    net_profit: float
    total_transactions_count: int
    total_bets_count: int

    class Config:
        from_attributes = True

class FinancialDashboardOverview(BaseModel):
    total_deposits_all_time: float
    total_payouts_all_time: float
    total_net_profit: float
    today_deposits: float
    today_payouts: float
    today_net_profit: float
    active_bets_pool: float
    recent_transactions: List[LedgerItemResponse]
