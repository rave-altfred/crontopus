"""
Pydantic schemas for job check-ins and run history.
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

from crontopus_api.models.job_run import JobStatus


class AgentCheckinRequest(BaseModel):
    """
    Simplified schema for agent callback check-ins.
    
    This is what the agent's wrapper script sends:
    - endpoint_id: Which endpoint ran the job
    - job_name: Name of the job from manifest
    - namespace: Namespace/group (e.g., production, staging, discovered)
    - status: success or failure
    - exit_code: Process exit code (0 = success)
    - duration: Execution time in seconds
    - output: Captured stdout/stderr (max 10,000 chars)
    - error_message: Last part of output if failed
    """
    endpoint_id: int = Field(..., description="Endpoint that executed the job")
    job_name: str = Field(..., description="Job name from Git manifest")
    namespace: str = Field(..., description="Job namespace/group")
    status: str = Field(..., description="Execution status: success or failure")
    exit_code: Optional[int] = Field(None, description="Process exit code")
    duration: Optional[int] = Field(None, description="Execution duration in seconds")
    output: Optional[str] = Field(None, max_length=10000, description="Job output (stdout/stderr)")
    error_message: Optional[str] = Field(None, description="Error details if failed")
    
    def to_job_status(self) -> JobStatus:
        """Convert string status to JobStatus enum."""
        status_map = {
            "success": JobStatus.SUCCESS,
            "failure": JobStatus.FAILURE,
            "running": JobStatus.RUNNING,
            "timeout": JobStatus.TIMEOUT,
            "cancelled": JobStatus.CANCELLED,
        }
        return status_map.get(self.status.lower(), JobStatus.FAILURE)


class CheckinRequest(BaseModel):
    """
    Schema for job check-in request.
    
    Jobs send this to report execution results.
    """
    job_name: str = Field(..., description="Job name from Git manifest")
    tenant: str = Field(..., description="Tenant identifier")
    status: JobStatus = Field(..., description="Execution status")
    
    # Optional execution details
    output: Optional[str] = Field(None, max_length=10000, description="Job output (stdout/stderr)")
    error_message: Optional[str] = Field(None, description="Error details if failed")
    exit_code: Optional[int] = Field(None, description="Process exit code")
    
    # Timing
    started_at: datetime = Field(..., description="When job started")
    finished_at: Optional[datetime] = Field(None, description="When job finished")
    duration: Optional[int] = Field(None, description="Duration in seconds")
    
    # Agent (optional)
    agent_id: Optional[str] = Field(None, description="Agent that executed the job")


class CheckinResponse(BaseModel):
    """Schema for check-in response."""
    run_id: int
    message: str = "Check-in recorded successfully"
    
    class Config:
        from_attributes = True


class JobRunResponse(BaseModel):
    """Schema for job run history response."""
    id: int
    tenant_id: str
    job_name: str
    status: JobStatus
    
    started_at: datetime
    finished_at: Optional[datetime]
    duration: Optional[int]
    
    output: Optional[str]
    error_message: Optional[str]
    exit_code: Optional[int]
    
    agent_id: Optional[str]
    
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class JobRunListResponse(BaseModel):
    """Schema for paginated job run list."""
    runs: list[JobRunResponse]
    total: int
    page: int
    page_size: int
