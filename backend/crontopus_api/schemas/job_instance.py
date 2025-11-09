"""
Pydantic schemas for job instances and discovered jobs.
"""
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class DiscoveredJob(BaseModel):
    """Schema for a discovered job on an endpoint."""
    name: str = Field(..., description="Job name extracted from scheduler")
    schedule: str = Field(..., description="Cron expression")
    command: str = Field(..., description="Original command before callback injection")
    namespace: Optional[str] = Field("discovered", description="Namespace for discovered jobs")


class DiscoveredJobsRequest(BaseModel):
    """Schema for reporting discovered jobs from an endpoint."""
    jobs: List[DiscoveredJob] = Field(..., description="List of discovered jobs")


class DiscoveredJobsResponse(BaseModel):
    """Response after reporting discovered jobs."""
    message: str
    jobs_created: int
    endpoint_id: int


class JobInstanceReport(BaseModel):
    """Schema for reporting a job instance on an endpoint."""
    job_name: str = Field(..., description="Job name from manifest")
    namespace: str = Field("production", description="Job namespace")
    status: str = Field(..., description="Job status: scheduled, running, paused, error")
    source: str = Field("git", description="Source: git or discovered")
    original_command: Optional[str] = Field(None, description="Original command before callback injection")


class JobInstancesRequest(BaseModel):
    """Schema for reporting job instances from an endpoint."""
    instances: List[JobInstanceReport] = Field(..., description="List of job instances")


class JobInstancesResponse(BaseModel):
    """Response after reporting job instances."""
    message: str
    instances_updated: int
    endpoint_id: int


class JobInstanceResponse(BaseModel):
    """Schema for a job instance."""
    id: int
    job_name: str
    namespace: str
    endpoint_id: int
    status: str
    source: str
    original_command: Optional[str]
    last_seen: datetime
    
    class Config:
        from_attributes = True


class EndpointJobsResponse(BaseModel):
    """Response for listing jobs on an endpoint."""
    endpoint_id: int
    jobs: List[JobInstanceResponse]
    total: int
