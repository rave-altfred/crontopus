"""
Pydantic schemas for authentication.
"""
from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    """Schema for user registration."""
    tenant_id: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)


class UserLogin(BaseModel):
    """Schema for user login."""
    username: str
    password: str


class Token(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Schema for decoded token data."""
    user_id: int
    tenant_id: str
    username: str


class UserResponse(BaseModel):
    """Schema for user response."""
    id: int
    tenant_id: str
    email: str
    username: str
    is_active: bool
    role: str
    
    class Config:
        from_attributes = True
