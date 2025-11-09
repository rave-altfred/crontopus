"""
Enrollment Token management routes.

Allows users to generate, list, and revoke long-lived enrollment tokens
for agent deployment.
"""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from crontopus_api.config import get_db
from crontopus_api.models import EnrollmentToken, User
from crontopus_api.security.dependencies import get_current_user

router = APIRouter(prefix="/enrollment-tokens", tags=["enrollment-tokens"])


# Schemas
class EnrollmentTokenCreate(BaseModel):
    """Request to create an enrollment token."""
    name: str = Field(..., min_length=1, max_length=255, description="Human-readable name for the token")
    expires_in_days: Optional[int] = Field(None, ge=1, le=365, description="Token expiry in days (None = never expires)")
    max_uses: Optional[int] = Field(None, ge=1, description="Maximum number of enrollments (None = unlimited)")


class EnrollmentTokenResponse(BaseModel):
    """Response after creating a token (includes plaintext token)."""
    id: int
    name: str
    token: str  # Only shown once at creation time!
    expires_at: Optional[datetime]
    max_uses: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True


class EnrollmentTokenListItem(BaseModel):
    """Enrollment token info (without plaintext token)."""
    id: int
    name: str
    used_count: int
    max_uses: Optional[int]
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True


class EnrollmentTokenListResponse(BaseModel):
    """Paginated list of enrollment tokens."""
    tokens: list[EnrollmentTokenListItem]
    total: int
    page: int
    page_size: int


@router.post("", response_model=EnrollmentTokenResponse, status_code=status.HTTP_201_CREATED)
async def create_enrollment_token(
    token_data: EnrollmentTokenCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new enrollment token.
    
    The plaintext token is only returned once at creation time.
    Users should save it securely as it cannot be retrieved later.
    """
    # Generate token
    plaintext_token = f"cet_{secrets.token_urlsafe(32)}"  # cet = crontopus enrollment token
    token_hash = EnrollmentToken.hash_token(plaintext_token)
    
    # Calculate expiry
    expires_at = None
    if token_data.expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=token_data.expires_in_days)
    
    # Create token
    enrollment_token = EnrollmentToken(
        tenant_id=current_user.tenant_id,
        name=token_data.name,
        token_hash=token_hash,
        max_uses=token_data.max_uses,
        expires_at=expires_at
    )
    
    db.add(enrollment_token)
    db.commit()
    db.refresh(enrollment_token)
    
    # Return response with plaintext token (only time it's shown!)
    return EnrollmentTokenResponse(
        id=enrollment_token.id,
        name=enrollment_token.name,
        token=plaintext_token,
        expires_at=enrollment_token.expires_at,
        max_uses=enrollment_token.max_uses,
        created_at=enrollment_token.created_at
    )


@router.get("", response_model=EnrollmentTokenListResponse)
async def list_enrollment_tokens(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all enrollment tokens for the current user.
    
    Does not include plaintext tokens (only shown at creation time).
    """
    # Base query with tenant isolation
    query = db.query(EnrollmentToken).filter(
        EnrollmentToken.tenant_id == current_user.tenant_id
    )
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * page_size
    tokens = query.order_by(EnrollmentToken.created_at.desc()).offset(offset).limit(page_size).all()
    
    return EnrollmentTokenListResponse(
        tokens=tokens,
        total=total,
        page=page,
        page_size=page_size
    )


@router.delete("/{token_id}", status_code=status.HTTP_200_OK)
async def delete_enrollment_token(
    token_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete (revoke) an enrollment token.
    
    Once deleted, the token can no longer be used for enrollment.
    """
    token = db.query(EnrollmentToken).filter(
        EnrollmentToken.id == token_id,
        EnrollmentToken.tenant_id == current_user.tenant_id
    ).first()
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment token not found"
        )
    
    db.delete(token)
    db.commit()
    
    return {"message": "Enrollment token deleted", "id": token_id}
