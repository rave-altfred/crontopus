"""
JobRun model for tracking job execution history.

Since job definitions live in Git, we only track runtime data here:
- Which job ran (by name from Git manifest)
- When it ran and how long it took
- Success/failure status and output
"""
from sqlalchemy import Column, String, Integer, Text, DateTime, Enum as SQLEnum, func
import enum

from crontopus_api.models.base import TenantScopedBase


class JobStatus(enum.Enum):
    """Job execution status."""
    RUNNING = "running"
    SUCCESS = "success"
    FAILURE = "failure"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


class JobRun(TenantScopedBase):
    """
    Job run history model.
    
    Stores execution history for jobs. Jobs are defined in Git,
    so we reference them by name (from manifest metadata.name).
    """
    
    # Job identification (from Git manifest)
    job_name = Column(String(255), nullable=False, index=True)
    
    # Execution details
    status = Column(
        SQLEnum(JobStatus),
        nullable=False,
        index=True
    )
    
    # Timestamps
    started_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)
    duration = Column(Integer, nullable=True)  # seconds
    
    # Output
    output = Column(Text, nullable=True)  # stdout/stderr
    error_message = Column(Text, nullable=True)  # error details
    exit_code = Column(Integer, nullable=True)
    
    # Agent that executed the job (optional)
    agent_id = Column(String(255), nullable=True, index=True)
    
    # Check-in metadata
    checkin_secret_hash = Column(String(255), nullable=True)  # for verification
    
    def __repr__(self):
        return f"<JobRun(id={self.id}, job_name={self.job_name}, status={self.status.value}, tenant_id={self.tenant_id})>"
