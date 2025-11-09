"""
Endpoint model for tracking machines running agents.

Endpoints are servers/machines where the crontopus-agent binary is installed.
Each endpoint belongs to a tenant and reports heartbeat to maintain connection.

Terminology:
- Agent = The binary software (crontopus-agent)
- Endpoint = A machine running an agent instance
"""
from sqlalchemy import Column, String, DateTime, Enum as SQLEnum, func
import enum

from crontopus_api.models.base import TenantScopedBase


class EndpointStatus(enum.Enum):
    """Endpoint status."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    REVOKED = "revoked"


class Endpoint(TenantScopedBase):
    """
    Endpoint model for enrolled machines running agents.
    
    Endpoints run the agent binary which pulls job manifests from Git
    and reconciles with OS schedulers. They report heartbeat to backend.
    """
    __tablename__ = 'endpoints'
    
    # Endpoint identification
    name = Column(String(255), nullable=False, index=True)
    hostname = Column(String(255), nullable=True)
    
    # Status
    status = Column(
        SQLEnum(EndpointStatus),
        nullable=False,
        default=EndpointStatus.ACTIVE,
        index=True
    )
    
    # Connection tracking
    last_heartbeat = Column(DateTime(timezone=True), nullable=True)
    enrolled_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Git repository configuration
    git_repo_url = Column(String(512), nullable=True)
    git_branch = Column(String(255), nullable=True, default="main")
    
    # Agent authentication token (hashed)
    token_hash = Column(String(255), nullable=True)
    
    # Platform information
    platform = Column(String(50), nullable=True)  # linux, darwin, windows
    version = Column(String(50), nullable=True)   # agent version
    
    def __repr__(self):
        return f"<Endpoint(id={self.id}, name={self.name}, status={self.status.value}, tenant_id={self.tenant_id})>"
