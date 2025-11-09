"""Authentication for agent enrollment using enrollment tokens."""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from crontopus_api.config import get_db
from crontopus_api.models.user import User
from crontopus_api.models.enrollment_token import EnrollmentToken
from crontopus_api.security.dependencies import get_current_user

security = HTTPBearer()


async def get_user_from_enrollment_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Verify enrollment token and return associated user.
    
    Returns None if token is not an enrollment token (allowing fallback to JWT).
    Raises HTTPException if token is invalid enrollment token.
    """
    token = credentials.credentials
    
    # Check if this is an enrollment token (format: cet_...)
    if not token.startswith("cet_"):
        return None
    
    # Find matching enrollment token in database
    enrollment_token = db.query(EnrollmentToken).filter(
        EnrollmentToken.token_hash == EnrollmentToken.hash_token(token)
    ).first()
    
    if not enrollment_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid enrollment token"
        )
    
    if not enrollment_token.is_valid():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Enrollment token expired or usage limit exceeded"
        )
    
    # Increment usage count
    enrollment_token.increment_usage(db)
    
    # Get the user associated with this token
    user = db.query(User).filter(User.tenant_id == enrollment_token.tenant_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User associated with enrollment token not found"
        )
    
    return user


async def get_user_for_enrollment(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    """
    Authenticate user for agent enrollment.
    
    Accepts either:
    1. Enrollment token (cet_...) - long-lived token for agent deployment
    2. JWT token - standard user authentication
    
    Returns the authenticated user or raises HTTPException.
    """
    # Try enrollment token first
    user = await get_user_from_enrollment_token(credentials, db)
    if user:
        return user
    
    # Fallback to JWT authentication
    try:
        return await get_current_user(credentials, db)
    except HTTPException as e:
        # Re-raise with more specific error message
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials. Provide either a valid enrollment token (cet_...) or JWT token."
        )
