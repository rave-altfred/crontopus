"""
Enrollment Token model for agent enrollment.

Enrollment tokens are long-lived credentials that allow agents to enroll
without requiring user JWT tokens. This enables easier agent deployment.
"""
import hashlib
from sqlalchemy import Column, String, Integer, DateTime, func
from datetime import datetime, timezone

from crontopus_api.models.base import TenantScopedBase


class EnrollmentToken(TenantScopedBase):
    """
    Enrollment token for agent enrollment.
    
    Users can generate multiple enrollment tokens with different lifetimes
    and usage limits. Tokens can be revoked at any time.
    """
    
    # Token identification
    name = Column(String(255), nullable=False)  # User-friendly name
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    
    # Usage tracking
    used_count = Column(Integer, nullable=False, default=0)
    max_uses = Column(Integer, nullable=True)  # None = unlimited
    
    # Expiration
    expires_at = Column(DateTime(timezone=True), nullable=True)  # None = never expires
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    
    def is_valid(self) -> bool:
        """Check if token is still valid (not expired, not exceeded usage limit)."""
        # Check expiry
        if self.expires_at and datetime.now(timezone.utc) > self.expires_at:
            return False
        
        # Check usage limit
        if self.max_uses and self.used_count >= self.max_uses:
            return False
        
        return True
    
    def increment_usage(self, db):
        """Increment usage counter and update last_used_at."""
        self.used_count += 1
        self.last_used_at = datetime.now(timezone.utc)
        db.commit()
    
    @staticmethod
    def hash_token(plaintext_token: str) -> str:
        """Hash a plaintext token for storage/comparison."""
        return hashlib.sha256(plaintext_token.encode()).hexdigest()
    
    def __repr__(self):
        return f"<EnrollmentToken(id={self.id}, name={self.name}, tenant_id={self.tenant_id}, used={self.used_count}/{self.max_uses or '∞'})>"
