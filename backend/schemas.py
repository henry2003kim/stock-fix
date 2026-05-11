from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    investment_budget: float
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class ForgotUsernameRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    username: str
    email: EmailStr
    new_password: str


class BudgetUpdate(BaseModel):
    budget: float


class PinRequest(BaseModel):
    ticker: str


class TransactionCreate(BaseModel):
    ticker: str
    quantity: float
    price: float
    action: str = "BUY"
    note: Optional[str] = None


class TransactionResponse(BaseModel):
    id: int
    ticker: str
    quantity: float
    price: float
    action: str
    note: Optional[str]
    executed_at: datetime

    class Config:
        from_attributes = True


class AdvisorRequest(BaseModel):
    budget: float
    pinned_tickers: list[str]
    aggressiveness: int = 3
    transactions: Optional[list[dict]] = None
