"""
Authentication routes for user registration and login.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from crontopus_api.config import get_db, settings
from crontopus_api.models import User, Tenant
from crontopus_api.schemas.auth import UserRegister, UserLogin, Token, UserResponse
from crontopus_api.security import verify_password, get_password_hash, create_access_token
from crontopus_api.security.dependencies import get_current_user
from crontopus_api.services.forgejo import ForgejoClient
import httpx
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["authentication"])


async def create_tenant_repository(tenant_id: str) -> bool:
    """
    Create a Git repository for a new tenant.
    
    Args:
        tenant_id: The tenant ID
        
    Returns:
        True if successful, False otherwise
    """
    logger.info(f"Starting repository creation for tenant: {tenant_id}")
    try:
        url = f"{settings.forgejo_url}/api/v1/orgs/crontopus/repos"
        headers = {
            "Authorization": f"token {settings.forgejo_token}",
            "Content-Type": "application/json"
        }
        
        repo_name = f"job-manifests-{tenant_id}"
        
        payload = {
            "name": repo_name,
            "description": f"Job manifests for tenant {tenant_id}",
            "private": True,
            "auto_init": True,
            "default_branch": "main",
            "readme": "Default"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=30.0)
            
            if response.status_code == 201:
                logger.info(f"Created Git repository: {repo_name}")
                
                # Create production and staging directories with placeholder files
                forgejo = ForgejoClient(
                    base_url=settings.forgejo_url,
                    username=settings.forgejo_username,
                    token=settings.forgejo_token
                )
                
                # Create .gitkeep files in production and staging directories
                for namespace in ["production", "staging"]:
                    try:
                        await forgejo.create_or_update_file(
                            owner="crontopus",
                            repo=repo_name,
                            file_path=f"{namespace}/.gitkeep",
                            content="# Directory for job manifests\n",
                            message=f"Initialize {namespace} directory",
                            author_name="Crontopus",
                            author_email="bot@crontopus.io"
                        )
                    except Exception as e:
                        logger.warning(f"Could not create {namespace} directory: {e}")
                
                return True
            elif response.status_code == 409:
                # Repository already exists
                logger.info(f"Repository {repo_name} already exists")
                return True
            else:
                logger.error(f"Failed to create repository: {response.status_code} - {response.text}")
                return False
                
    except Exception as e:
        logger.error(f"Error creating tenant repository: {e}")
        return False


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
    is_new_tenant = False
    if not tenant:
        tenant = Tenant(
            id=user_data.tenant_id,
            name=user_data.tenant_id.replace("-", " ").title()
        )
        db.add(tenant)
        db.commit()
        is_new_tenant = True
    
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
    
    # Create Git repository for new tenant
    repo_created = False
    if is_new_tenant:
        try:
            repo_created = await create_tenant_repository(user_data.tenant_id)
            if not repo_created:
                logger.error(f"Repository creation returned False for tenant {user_data.tenant_id}")
        except Exception as e:
            logger.error(f"Exception creating Git repository for tenant {user_data.tenant_id}: {e}", exc_info=True)
            # Don't fail registration if Git repo creation fails
    
    # Log successful registration
    logger.info(f"User registered: {user_data.username}, tenant: {user_data.tenant_id}, new_tenant: {is_new_tenant}, repo_created: {repo_created}")
    
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


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user information.
    
    Returns the profile of the currently authenticated user.
    """
    return current_user
