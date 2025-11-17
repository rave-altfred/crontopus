"""
Pydantic schemas for API token operations.
"""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, validator


class APITokenCreate(BaseModel):
    """Schema for creating a new API token."""
    name: str = Field(..., min_length=1, max_length=255, description="Friendly name for the token (e.g., 'CI/CD Pipeline')")
    scopes: List[str] = Field(..., min_items=1, description="List of permission scopes (e.g., ['read:runs', 'write:jobs'])")
    expires_days: Optional[int] = Field(None, gt=0, le=365, description="Days until token expires (None = never expires)")
    
    @validator('scopes')
    def validate_scopes(cls, v):
        """Validate that all scopes are known."""
        from crontopus_api.models.api_token import AVAILABLE_SCOPES
        
        # Check if all scopes are valid
        invalid_scopes = []
        for scope in v:
            # Allow wildcards like read:*, write:*
            if scope.endswith(':*'):
                prefix = scope[:-1]
                valid_prefix = any(s.startswith(prefix) for s in AVAILABLE_SCOPES)
                if not valid_prefix:
                    invalid_scopes.append(scope)
            elif scope not in AVAILABLE_SCOPES:
                invalid_scopes.append(scope)
        
        if invalid_scopes:
            raise ValueError(f"Invalid scopes: {', '.join(invalid_scopes)}. Available: {', '.join(AVAILABLE_SCOPES)}")
        
        return v


class APITokenCreateResponse(BaseModel):
    """Schema for API token creation response (includes plaintext token)."""
    id: int
    name: str
    scopes: List[str]
    token: str = Field(..., description="Plaintext token - SAVE THIS NOW! It won't be shown again.")
    created_at: datetime
    expires_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class APITokenResponse(BaseModel):
    """Schema for API token list/get response (NO plaintext token)."""
    id: int
    name: str
    scopes: List[str]
    last_used_at: Optional[datetime]
    created_at: datetime
    expires_at: Optional[datetime]
    is_expired: bool = Field(..., description="Whether token has expired")
    
    class Config:
        from_attributes = True
    
    @validator('scopes', pre=True)
    def parse_scopes(cls, v):
        """Convert comma-separated string to list."""
        if isinstance(v, str):
            return [s.strip() for s in v.split(',')]
        return v


class APITokenUpdate(BaseModel):
    """Schema for updating an API token."""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="New name for the token")
    expires_days: Optional[int] = Field(None, gt=0, le=365, description="Days until token expires (None = never expires)")


class APITokenListResponse(BaseModel):
    """Schema for paginated API token list."""
    tokens: List[APITokenResponse]
    total: int
    page: int
    page_size: int
