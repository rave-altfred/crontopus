"""
Base model classes with multi-tenancy support.
All models that require tenant isolation should inherit from TenantScopedBase.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.ext.declarative import declared_attr

from crontopus_api.config import Base


class TenantScopedBase(Base):
    """
    Abstract base class for all tenant-scoped models.
    
    Provides:
    - tenant_id: Foreign key to tenant (required for all queries)
    - id: Primary key (UUID or integer)
    - created_at: Timestamp of record creation
    - updated_at: Timestamp of last update
    
    All models inheriting from this class will automatically enforce
    tenant isolation at the database level.
    """
    __abstract__ = True
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True)
    
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
    
    @declared_attr
    def __tablename__(cls):
        """Generate table name from class name (snake_case)."""
        import re
        name = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', cls.__name__)
        return re.sub('([a-z0-9])([A-Z])', r'\1_\2', name).lower()
    
    def __repr__(self):
        return f"<{self.__class__.__name__}(id={self.id}, tenant_id={self.tenant_id})>"
