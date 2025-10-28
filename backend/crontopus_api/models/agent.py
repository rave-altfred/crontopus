"""
Agent model for tracking enrolled agents.

Agents are deployed on servers to sync jobs from Git and manage OS schedulers.
Each agent belongs to a tenant and reports heartbeat to maintain connection.
"""
from sqlalchemy import Column, String, DateTime, Enum as SQLEnum, func
import enum

from crontopus_api.models.base import TenantScopedBase


class AgentStatus(enum.Enum):
    """Agent status."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    REVOKED = "revoked"


class Agent(TenantScopedBase):
    """
    Agent model for enrolled agents.
    
    Agents pull job manifests from Git and reconcile with OS schedulers.
    They report heartbeat to backend to maintain connection.
    """
    
    # Agent identification
    name = Column(String(255), nullable=False, index=True)
    hostname = Column(String(255), nullable=True)
    
    # Status
    status = Column(
        SQLEnum(AgentStatus),
        nullable=False,
        default=AgentStatus.ACTIVE,
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
        return f"<Agent(id={self.id}, name={self.name}, status={self.status.value}, tenant_id={self.tenant_id})>"
