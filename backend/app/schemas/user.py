from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class UserRegister(BaseModel):
    username: Optional[str] = Field(None, example="TestMich") # User handle or username
    phone: str = Field(..., example="09888888888")
    full_name: str = Field(..., example="TestMich")
    password: str = Field(..., min_length=6)
    country_code: Optional[str] = "+95"
    referral_code: str = Field(..., min_length=3, example="AGT8899") # MANDATORY Agent Code
    telegram_otp: Optional[str] = None # OTP code verified via Telegram

class UserLogin(BaseModel):
    # Support login with either username or phone number
    identifier: Optional[str] = Field(None, example="TestMich or 09888888888")
    phone: Optional[str] = Field(None, example="09888888888")
    username: Optional[str] = Field(None, example="TestMich")
    password: str
    referral_code: Optional[str] = Field(None, example="AGT8899")

class TelegramOtpRequest(BaseModel):
    phone: str = Field(..., example="09888888888")
    purpose: Optional[str] = Field("register", example="reset_password")

class TelegramOtpVerifyRequest(BaseModel):
    phone: str = Field(..., example="09888888888")
    code: str = Field(..., example="123456")

class ResetPasswordRequest(BaseModel):
    phone: str = Field(..., example="09888888888")
    otp_code: str = Field(..., example="123456")
    new_password: str = Field(..., min_length=6, example="NewPassword123!")

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., example="OldPassword123!")
    new_password: str = Field(..., min_length=6, example="NewPassword123!")

class UserResponse(BaseModel):
    id: int
    username: Optional[str] = None
    phone: str
    full_name: str
    role: str
    balance: float
    is_verified: bool = True
    country_code: str
    telegram_id: Optional[str] = None
    telegram_username: Optional[str] = None
    agent_code: Optional[str] = None
    referred_by_code: Optional[str] = None
    total_commission_earned: Optional[float] = 0.0
    credit_limit: Optional[float] = 0.0
    security_deposit: Optional[float] = 0.0
    used_credit: Optional[float] = 0.0
    level: Optional[str] = "Level 1"
    is_betting_locked: Optional[bool] = False
    settlement_status: Optional[str] = "SETTLED"
    is_agent_credit_enabled: Optional[bool] = False
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
