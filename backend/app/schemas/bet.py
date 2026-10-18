from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime

class BetItemInput(BaseModel):
    number: str = Field(..., example="1234")
    bet_type: str = Field("ordinary", example="ordinary") # "ordinary", "box", "roll"
    big_amount: int = Field(0, ge=0, example=1000)
    small_amount: int = Field(0, ge=0, example=1000)
    custom_combinations: Optional[List[str]] = None

class CalculateStakeRequest(BaseModel):
    items: List[BetItemInput]

class CalculateStakeResponse(BaseModel):
    items: List[dict]
    total_combinations: int
    total_stake: int

class PlaceBetRequest(BaseModel):
    draw_id: Optional[int] = None
    draw_ids: Optional[List[int]] = None
    items: List[BetItemInput]

class BetItemResponse(BaseModel):
    id: int
    number: str
    bet_type: str
    big_amount: float
    small_amount: float
    combination_count: int
    combinations: List[str]
    item_stake: float
    item_payout: float
    is_won: int
    win_details: List[dict]

    class Config:
        from_attributes = True

class BetSlipResponse(BaseModel):
    id: int
    slip_code: str
    draw_id: int
    draw_number: Optional[str] = None
    draw_date: Optional[str] = None
    total_stake: float
    total_payout: float
    status: str
    created_at: datetime
    settled_at: Optional[datetime] = None
    items: List[BetItemResponse]

    class Config:
        from_attributes = True
