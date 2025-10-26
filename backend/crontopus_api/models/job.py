"""
Job model for scheduled job definitions.
"""
from sqlalchemy import Column, String, Text, Boolean, JSON

from crontopus_api.models.base import TenantScopedBase


class Job(TenantScopedBase):
    """
    Job model representing a scheduled job.
    
    Jobs define what should be executed, when it should run (schedule),
    and how results should be reported back to the control plane.
    """
    
    # Basic info
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Scheduling
    schedule = Column(String(255), nullable=False)  # Cron expression, e.g., "0 * * * *"
    timezone = Column(String(50), default="UTC", nullable=False)
    
    # Execution details
    command = Column(Text, nullable=False)  # Command to execute
    
    # Check-in configuration
    checkin_url = Column(String(512), nullable=True)  # URL for job to report results
    checkin_secret = Column(String(255), nullable=True)  # Secret token for check-ins
    
    # Status
    is_enabled = Column(Boolean, default=True, nullable=False)
    
    # Metadata (tags, environment variables, etc.)
    # Named job_metadata to avoid conflict with SQLAlchemy's metadata attribute
    job_metadata = Column(JSON, nullable=True)
    
    # Agent assignment (optional - for agent-managed jobs)
    agent_id = Column(String(255), nullable=True, index=True)
    
    def __repr__(self):
        return f"<Job(id={self.id}, name={self.name}, schedule={self.schedule}, tenant_id={self.tenant_id})>"
