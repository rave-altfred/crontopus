"""
JobInstance model for tracking job deployments on endpoints.

A JobInstance represents an actual scheduled job on a specific endpoint.
This is the "current state" (what's actually scheduled), while job manifests
in Git represent the "desired state" (what should be scheduled).
"""
from sqlalchemy import Column, String, DateTime, Enum as SQLEnum, Integer, ForeignKey, Text, func
import enum

from crontopus_api.models.base import TenantScopedBase


class JobInstanceStatus(enum.Enum):
    """Job instance status."""
    SCHEDULED = "scheduled"  # Job is scheduled in OS scheduler
    RUNNING = "running"      # Job is currently executing
    PAUSED = "paused"        # Job is disabled/paused
    ERROR = "error"          # Job has configuration error


class JobInstanceSource(enum.Enum):
    """Source of job instance."""
    GIT = "git"              # Job defined in Git manifest
    DISCOVERED = "discovered"  # Job discovered on endpoint


class JobInstance(TenantScopedBase):
    """
    JobInstance model for tracking jobs on endpoints.
    
    Each JobInstance represents a job that is actually scheduled on
    a specific endpoint. This enables many-to-many tracking:
    - One job can run on multiple endpoints
    - One endpoint can run multiple jobs
    """
    
    # Job identification (references Git manifest)
    job_name = Column(String(255), nullable=False, index=True)
    namespace = Column(String(255), nullable=False, default="production", index=True)
    
    # Endpoint relationship
    endpoint_id = Column(Integer, ForeignKey("endpoint.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Status
    status = Column(
        SQLEnum(JobInstanceStatus),
        nullable=False,
        default=JobInstanceStatus.SCHEDULED,
        index=True
    )
    
    # Source tracking
    source = Column(
        SQLEnum(JobInstanceSource),
        nullable=False,
        default=JobInstanceSource.GIT,
        index=True
    )
    
    # Original command (for discovered jobs, before callback injection)
    original_command = Column(Text, nullable=True)
    
    # Timing
    last_seen = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    def __repr__(self):
        return f"<JobInstance(id={self.id}, job={self.namespace}/{self.job_name}, endpoint_id={self.endpoint_id}, status={self.status.value})>"
