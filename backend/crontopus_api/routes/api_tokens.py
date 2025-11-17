"""
API Token management routes.

Enables users to create, list, update, and revoke API tokens for programmatic access.
"""
from typing import Optional
from datetime import datetime, timedelta, timezone
import secrets
import hashlib
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from fastapi_limiter.depends import RateLimiter

from crontopus_api.config import get_db
from crontopus_api.models import APIToken, User
from crontopus_api.schemas.api_token import (
    APITokenCreate,
    APITokenCreateResponse,
    APITokenResponse,
    APITokenUpdate,
    APITokenListResponse
)
from crontopus_api.security.dependencies import get_current_user

router = APIRouter(prefix="/tokens", tags=["api_tokens"])


def generate_token() -> str:
    """
    Generate a secure API token with format: ctp_<random_string>
    
    Similar to GitHub personal access tokens.
    """
    # Generate 32 bytes of random data (256 bits)
    random_bytes = secrets.token_urlsafe(32)
    return f"ctp_{random_bytes}"


def hash_token(token: str) -> str:
    """
    Hash a token using SHA256.
    
    Args:
        token: Plaintext token (e.g., ctp_abc123...)
        
    Returns:
        Hex-encoded SHA256 hash (64 characters)
    """
    return hashlib.sha256(token.encode()).hexdigest()


@router.post("", response_model=APITokenCreateResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(RateLimiter(times=10, seconds=60))])
async def create_api_token(
    request: Request,
    token_data: APITokenCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new API token.
    
    Returns the plaintext token ONCE. Save it securely - you won't see it again!
    
    Token format: ctp_<random_string>
    """
    # Generate plaintext token
    plaintext_token = generate_token()
    token_hash_value = hash_token(plaintext_token)
    
    # Calculate expiration date
    expires_at = None
    if token_data.expires_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=token_data.expires_days)
    
    # Create token record
    api_token = APIToken(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        name=token_data.name,
        token_hash=token_hash_value,
        scopes=','.join(token_data.scopes),  # Store as comma-separated string
        expires_at=expires_at
    )
    
    db.add(api_token)
    db.commit()
    db.refresh(api_token)
    
    # Return response with plaintext token
    return APITokenCreateResponse(
        id=api_token.id,
        name=api_token.name,
        scopes=token_data.scopes,
        token=plaintext_token,  # ONLY TIME WE RETURN THIS!
        created_at=api_token.created_at,
        expires_at=api_token.expires_at
    )


@router.get("", response_model=APITokenListResponse, dependencies=[Depends(RateLimiter(times=60, seconds=60))])
async def list_api_tokens(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all API tokens for the current user.
    
    Does NOT return plaintext tokens (they are never retrievable after creation).
    """
    # Query tokens for current user and tenant
    query = db.query(APIToken).filter(
        APIToken.user_id == current_user.id,
        APIToken.tenant_id == current_user.tenant_id
    )
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * page_size
    tokens = query.order_by(APIToken.created_at.desc()).offset(offset).limit(page_size).all()
    
    # Convert to response models
    token_responses = []
    for token in tokens:
        token_responses.append(APITokenResponse(
            id=token.id,
            name=token.name,
            scopes=[s.strip() for s in token.scopes.split(',')],
            last_used_at=token.last_used_at,
            created_at=token.created_at,
            expires_at=token.expires_at,
            is_expired=token.is_expired()
        ))
    
    return APITokenListResponse(
        tokens=token_responses,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{token_id}", response_model=APITokenResponse, dependencies=[Depends(RateLimiter(times=60, seconds=60))])
async def get_api_token(
    request: Request,
    token_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get details of a specific API token.
    
    Does NOT return the plaintext token (never retrievable after creation).
    """
    # Query token with user and tenant isolation
    token = db.query(APIToken).filter(
        APIToken.id == token_id,
        APIToken.user_id == current_user.id,
        APIToken.tenant_id == current_user.tenant_id
    ).first()
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API token not found"
        )
    
    return APITokenResponse(
        id=token.id,
        name=token.name,
        scopes=[s.strip() for s in token.scopes.split(',')],
        last_used_at=token.last_used_at,
        created_at=token.created_at,
        expires_at=token.expires_at,
        is_expired=token.is_expired()
    )


@router.patch("/{token_id}", response_model=APITokenResponse, dependencies=[Depends(RateLimiter(times=30, seconds=60))])
async def update_api_token(
    request: Request,
    token_id: int,
    token_update: APITokenUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update an API token's name or expiration.
    
    Cannot update scopes or regenerate the token - create a new token instead.
    """
    # Query token with user and tenant isolation
    token = db.query(APIToken).filter(
        APIToken.id == token_id,
        APIToken.user_id == current_user.id,
        APIToken.tenant_id == current_user.tenant_id
    ).first()
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API token not found"
        )
    
    # Update fields
    if token_update.name is not None:
        token.name = token_update.name
    
    if token_update.expires_days is not None:
        token.expires_at = datetime.now(timezone.utc) + timedelta(days=token_update.expires_days)
    
    db.commit()
    db.refresh(token)
    
    return APITokenResponse(
        id=token.id,
        name=token.name,
        scopes=[s.strip() for s in token.scopes.split(',')],
        last_used_at=token.last_used_at,
        created_at=token.created_at,
        expires_at=token.expires_at,
        is_expired=token.is_expired()
    )


@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(RateLimiter(times=30, seconds=60))])
async def revoke_api_token(
    request: Request,
    token_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Revoke (delete) an API token.
    
    This is permanent and cannot be undone. The token will immediately stop working.
    """
    # Query token with user and tenant isolation
    token = db.query(APIToken).filter(
        APIToken.id == token_id,
        APIToken.user_id == current_user.id,
        APIToken.tenant_id == current_user.tenant_id
    ).first()
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API token not found"
        )
    
    # Hard delete (permanently remove from database)
    db.delete(token)
    db.commit()
    
    return None
