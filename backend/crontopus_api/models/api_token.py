"""
API Token model for user authentication.

API tokens enable programmatic access to the Crontopus API for:
- CI/CD pipelines
- External integrations
- Automation scripts
- Third-party tools

Tokens are hashed using SHA256 before storage (like GitHub personal access tokens).
Plaintext tokens are shown only once during creation.
"""
from sqlalchemy import Column, String, DateTime, Integer, Text, func, Index
from datetime import datetime, timezone
import enum

from crontopus_api.models.base import TenantScopedBase


class APIToken(TenantScopedBase):
    """
    API Token model for user authentication.
    
    Enables programmatic API access with fine-grained permissions.
    Tokens are hashed (SHA256) before storage for security.
    """
    __tablename__ = 'api_tokens'
    
    # Token identification
    name = Column(String(255), nullable=False)  # User-friendly name (e.g., "CI/CD Pipeline")
    token_hash = Column(String(64), nullable=False, unique=True, index=True)  # SHA256 hash (64 hex chars)
    
    # Ownership
    user_id = Column(Integer, nullable=False, index=True)  # User who created the token
    # tenant_id inherited from TenantScopedBase
    
    # Permissions (comma-separated scopes)
    scopes = Column(Text, nullable=False, default="read:runs")  # e.g., "read:runs,write:jobs,read:agents"
    
    # Usage tracking
    last_used_at = Column(DateTime(timezone=True), nullable=True)  # Updated on each API call
    
    # Expiration
    expires_at = Column(DateTime(timezone=True), nullable=True)  # NULL = never expires
    
    # Timestamps inherited from TenantScopedBase (created_at, updated_at)
    
    # Composite index for efficient lookups
    __table_args__ = (
        Index('idx_api_tokens_user_tenant', 'user_id', 'tenant_id'),
        Index('idx_api_tokens_tenant_hash', 'tenant_id', 'token_hash'),
    )
    
    def __repr__(self):
        return f"<APIToken(id={self.id}, name={self.name}, user_id={self.user_id}, tenant_id={self.tenant_id}, scopes={self.scopes})>"
    
    def is_expired(self) -> bool:
        """Check if token has expired."""
        if self.expires_at is None:
            return False
        return datetime.now(timezone.utc) > self.expires_at
    
    def has_scope(self, required_scope: str) -> bool:
        """Check if token has a specific scope."""
        token_scopes = [s.strip() for s in self.scopes.split(',')]
        
        # admin:* grants all permissions
        if "admin:*" in token_scopes:
            return True
        
        # Check for exact scope match
        if required_scope in token_scopes:
            return True
        
        # Check for wildcard matches (e.g., read:* matches read:runs)
        for scope in token_scopes:
            if scope.endswith(':*'):
                prefix = scope[:-1]  # Remove '*'
                if required_scope.startswith(prefix):
                    return True
        
        return False


# Available scopes (for documentation and validation)
AVAILABLE_SCOPES = [
    "read:runs",      # View job run history
    "write:jobs",     # Create, update, delete jobs
    "read:jobs",      # View jobs
    "read:agents",    # View agents/endpoints
    "write:agents",   # Enroll, update, delete agents
    "read:tokens",    # View API tokens (own tokens only)
    "write:tokens",   # Create, update, delete API tokens
    "admin:*",        # All permissions (admin access)
]
