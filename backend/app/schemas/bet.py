from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class BetItemInput(BaseModel):
    number: str = Field(..., description="Bet number (4D, 2D, or 3D)")
    bet_type: str = Field(default="ordinary", description="ordinary, roll, box, straight, tote, r")
    big_amount: float = Field(default=0, ge=0)
    small_amount: float = Field(default=0, ge=0)
    custom_combinations: Optional[List[str]] = None

class CalculateStakeRequest(BaseModel):
    items: List[BetItemInput]

class CalculatedItem(BaseModel):
    number: str
    bet_type: str
    big_per_unit: float
    small_per_unit: float
    combination_count: int
    combinations: List[str]
    total_stake: float

class CalculateStakeResponse(BaseModel):
    items: List[CalculatedItem]
    total_stake: float
    total_combinations: int

class PlaceBetRequest(BaseModel):
    draw_id: Optional[int] = None
    draw_ids: Optional[List[int]] = None
    game_type: Optional[str] = "4D"
    items: List[BetItemInput]

class BetItemResponse(BaseModel):
    id: int
    number: str
    bet_type: str
    game_type: Optional[str] = "4D"
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
    game_type: Optional[str] = "4D"
    draw_id: int
    draw_number: Optional[str] = None
    draw_date: Optional[str] = None
    draw_session: Optional[str] = None
    draw_time: Optional[str] = None
    total_stake: float
    total_payout: float
    status: str
    created_at: datetime
    settled_at: Optional[datetime] = None
    items: List[BetItemResponse]

    class Config:
        from_attributes = True
