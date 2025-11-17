"""
FastAPI dependencies for authentication and authorization.
"""
from typing import Optional
import hashlib
from datetime import datetime, timezone
import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from crontopus_api.config import get_db
from crontopus_api.models import User, APIToken
from crontopus_api.security.jwt import decode_access_token

logger = logging.getLogger(__name__)

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to get current authenticated user from JWT token or API token.
    
    Supports two authentication methods:
    1. JWT tokens (short-lived, for web UI and CLI)
    2. API tokens (long-lived, for programmatic access) - format: ctp_...
    
    Usage:
        @app.get("/protected")
        async def protected_route(current_user: User = Depends(get_current_user)):
            return {"user": current_user.username}
    
    Args:
        credentials: HTTP Authorization header with Bearer token
        db: Database session
        
    Returns:
        User object if authenticated
        
    Raises:
        HTTPException: 401 if token is invalid or user not found
    """
    token = credentials.credentials
    
    # Check if token looks like an API token (starts with "ctp_")
    if token.startswith("ctp_"):
        # Try API token authentication
        user = await authenticate_api_token(token, db)
        if user:
            return user
        # If API token is invalid, fall through to JWT attempt
    
    # Try JWT token authentication
    payload = decode_access_token(token)
    if payload is not None:
        # Extract user_id from token
        user_id: Optional[int] = payload.get("user_id")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Get user from database
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check if user is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive"
            )
        
        return user
    
    # Both JWT and API token authentication failed
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def authenticate_api_token(token: str, db: Session) -> Optional[User]:
    """
    Authenticate user using an API token.
    
    Args:
        token: Plaintext API token (e.g., ctp_abc123...)
        db: Database session
        
    Returns:
        User object if token is valid, None otherwise
    """
    # Hash the token to look it up in database
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    # Look up token in database
    api_token = db.query(APIToken).filter(
        APIToken.token_hash == token_hash
    ).first()
    
    if not api_token:
        logger.warning(f"API token not found (hash: {token_hash[:8]}...)")
        return None
    
    # Check if token has expired
    if api_token.is_expired():
        logger.warning(f"API token {api_token.id} ({api_token.name}) has expired")
        return None
    
    # Update last_used_at timestamp
    api_token.last_used_at = datetime.now(timezone.utc)
    db.commit()
    
    # Get associated user
    user = db.query(User).filter(User.id == api_token.user_id).first()
    if not user:
        logger.error(f"API token {api_token.id} references non-existent user {api_token.user_id}")
        return None
    
    # Check if user is active
    if not user.is_active:
        logger.warning(f"API token {api_token.id} belongs to inactive user {user.id}")
        return None
    
    logger.debug(f"API token {api_token.id} ({api_token.name}) authenticated successfully for user {user.id}")
    return user
