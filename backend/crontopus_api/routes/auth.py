"""
Authentication routes for user registration and login.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from crontopus_api.config import get_db
from crontopus_api.models import User, Tenant
from crontopus_api.schemas.auth import UserRegister, UserLogin, Token, UserResponse
from crontopus_api.security import verify_password, get_password_hash, create_access_token

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """
    Register a new user.
    
    Creates a new user account associated with a tenant.
    If the tenant doesn't exist, it will be created.
    """
    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.email == user_data.email) | (User.username == user_data.username)
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email or username already exists"
        )
    
    # Check if tenant exists, create if not
    tenant = db.query(Tenant).filter(Tenant.id == user_data.tenant_id).first()
    if not tenant:
        tenant = Tenant(
            id=user_data.tenant_id,
            name=user_data.tenant_id.replace("-", " ").title()
        )
        db.add(tenant)
        db.commit()
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        tenant_id=user_data.tenant_id,
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_password
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Authenticate user and return JWT token.
    
    Validates username/password and returns an access token.
    Uses OAuth2 password flow with form data to prevent credential exposure in logs.
    """
    # Find user by username
    user = db.query(User).filter(User.username == form_data.username).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify password
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    # Create access token
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "user_id": user.id,
            "tenant_id": user.tenant_id,
            "username": user.username
        }
    )
    
    return {"access_token": access_token, "token_type": "bearer"}