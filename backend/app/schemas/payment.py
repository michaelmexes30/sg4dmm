from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class DepositSubmissionRequest(BaseModel):
    gateway: str = Field(..., example="kpay") # kpay, wavepay, ayapay
    transaction_id: str = Field(..., example="20261013894123") # Full or last 6 digits
    receiver_id: str = Field(..., example="09987654321") # Target agent wallet
    amount: float = Field(..., gt=0, example=20000.0)
    raw_timestamp: str = Field(..., example="2026-10-13 11:15:00")
    client_timezone: Optional[str] = Field("MMT", example="MMT") # MMT, ICT, SGT, KST, JST
    slip_image_url: Optional[str] = None

class DepositVerificationResponse(BaseModel):
    success: bool
    transaction_id: Optional[int] = None
    status: str
    amount: float = 0.0
    new_balance: Optional[float] = None
    delta_minutes: float = 0.0
    is_time_valid: bool = False
    is_receiver_valid: bool = False
    notes: Optional[str] = None
    message: str

class TransactionResponse(BaseModel):
    id: int
    tx_type: str
    gateway: str
    transaction_id: str
    receiver_id: str
    amount: float
    slip_image_url: Optional[str]
    client_timezone: str
    tx_timestamp_mmt: datetime
    submission_timestamp_mmt: datetime
    delta_minutes: float
    status: str
    verification_notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class WithdrawSubmissionRequest(BaseModel):
    gateway: str = Field(..., example="kpay")
    receiver_account: str = Field(..., example="09888888888")
    receiver_name: str = Field(..., example="Ko Ko")
    amount: float = Field(..., ge=1000.0, example=50000.0)

class WithdrawResponse(BaseModel):
    success: bool
    transaction_id: int
    amount: float
    new_balance: float
    status: str
    message: str
