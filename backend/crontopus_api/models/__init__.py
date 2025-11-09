"""
Database models for Crontopus API.

Note: Job definitions live in Git (Forgejo), not in the database.
Database stores only runtime data: users, tenants, endpoints, run history, job instances, metrics.
"""
from .base import TenantScopedBase
from .tenant import Tenant
from .user import User
from .job_run import JobRun, JobStatus
from .agent import Agent, AgentStatus  # Keep for backward compatibility during migration
from .endpoint import Endpoint, EndpointStatus
from .job_instance import JobInstance, JobInstanceStatus, JobInstanceSource
from .enrollment_token import EnrollmentToken

__all__ = [
    "TenantScopedBase",
    "Tenant",
    "User",
    "JobRun",
    "JobStatus",
    "Agent",
    "AgentStatus",
    "Endpoint",
    "EndpointStatus",
    "JobInstance",
    "JobInstanceStatus",
    "JobInstanceSource",
    "EnrollmentToken",
]
