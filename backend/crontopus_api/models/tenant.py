"""
Tenant model for multi-tenancy support.
Each tenant represents an isolated organization/workspace.
"""
from sqlalchemy import Column, String, Boolean, DateTime, func

from crontopus_api.config import Base


class Tenant(Base):
    """
    Tenant model representing an isolated organization.
    
    All tenant-scoped data (jobs, agents, users) belong to a tenant.
    Tenants are completely isolated from each other at the database level.
    """
    __tablename__ = "tenants"
    
    id = Column(String, primary_key=True, index=True)  # e.g., "acme-corp"
    name = Column(String, nullable=False)  # e.g., "ACME Corporation"
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Timestamps
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
    
    def __repr__(self):
        return f"<Tenant(id={self.id}, name={self.name})>"
