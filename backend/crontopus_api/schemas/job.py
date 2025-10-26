"""
Pydantic schemas for job management.
"""
from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator

from crontopus_api.utils.validators import validate_cron_expression


class JobCreate(BaseModel):
    """Schema for creating a new job."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    schedule: str = Field(..., description="Cron expression (e.g., '0 * * * *')")
    timezone: str = Field(default="UTC", max_length=50)
    command: str = Field(..., min_length=1, description="Command to execute")
    is_enabled: bool = Field(default=True)
    metadata: Optional[Dict[str, Any]] = None
    agent_id: Optional[str] = None
    
    @field_validator("schedule")
    @classmethod
    def validate_schedule(cls, v: str) -> str:
        """Validate cron expression format."""
        is_valid, error = validate_cron_expression(v)
        if not is_valid:
            raise ValueError(f"Invalid cron expression: {error}")
        return v


class JobUpdate(BaseModel):
    """Schema for updating an existing job."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    schedule: Optional[str] = Field(None, description="Cron expression (e.g., '0 * * * *')")
    timezone: Optional[str] = Field(None, max_length=50)
    command: Optional[str] = Field(None, min_length=1)
    is_enabled: Optional[bool] = None
    metadata: Optional[Dict[str, Any]] = None
    agent_id: Optional[str] = None
    
    @field_validator("schedule")
    @classmethod
    def validate_schedule(cls, v: Optional[str]) -> Optional[str]:
        """Validate cron expression format if provided."""
        if v is not None:
            is_valid, error = validate_cron_expression(v)
            if not is_valid:
                raise ValueError(f"Invalid cron expression: {error}")
        return v


class JobResponse(BaseModel):
    """Schema for job response."""
    id: int
    tenant_id: str
    name: str
    description: Optional[str]
    schedule: str
    timezone: str
    command: str
    checkin_url: Optional[str]
    is_enabled: bool
    job_metadata: Optional[Dict[str, Any]]
    agent_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class JobListResponse(BaseModel):
    """Schema for paginated job list response."""
    jobs: list[JobResponse]
    total: int
    page: int
    page_size: int
