"""
User model for authentication and authorization.
Users belong to tenants and have role-based permissions.
"""
from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from crontopus_api.models.base import TenantScopedBase


class User(TenantScopedBase):
    """
    User model for authentication.
    
    Each user belongs to a tenant and has credentials for authentication.
    Multi-tenancy is enforced - users can only access data within their tenant.
    """
    
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    
    # User status
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    
    # Role within tenant (e.g., "admin", "user", "viewer")
    role = Column(String, default="user", nullable=False)
    
    # Forgejo Git access token (for cloning job manifest repositories)
    git_token = Column(String, nullable=True)
    
    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, tenant_id={self.tenant_id})>"
