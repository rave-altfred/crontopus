"""
Pydantic schemas for agent management.
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

from crontopus_api.models.endpoint import EndpointStatus


class AgentEnroll(BaseModel):
    """Schema for agent enrollment request."""
    name: str = Field(..., description="Agent name")
    hostname: Optional[str] = Field(None, description="Agent hostname")
    platform: Optional[str] = Field(None, description="Platform (linux, darwin, windows)")
    version: Optional[str] = Field(None, description="Agent version")
    git_repo_url: Optional[str] = Field(None, description="Git repository URL")
    git_branch: Optional[str] = Field("main", description="Git branch")


class AgentEnrollResponse(BaseModel):
    """Schema for agent enrollment response."""
    agent_id: int
    token: str = Field(..., description="Agent authentication token")
    message: str = "Agent enrolled successfully"
    
    class Config:
        from_attributes = True


class AgentHeartbeat(BaseModel):
    """Schema for agent heartbeat request."""
    status: Optional[EndpointStatus] = Field(None, description="Agent status")
    platform: Optional[str] = Field(None, description="Platform info")
    version: Optional[str] = Field(None, description="Agent version")


class AgentResponse(BaseModel):
    """Schema for agent response."""
    id: int
    tenant_id: str
    name: str
    hostname: Optional[str]
    status: EndpointStatus
    
    last_heartbeat: Optional[datetime]
    enrolled_at: datetime
    
    git_repo_url: Optional[str]
    git_branch: Optional[str]
    
    platform: Optional[str]
    version: Optional[str]
    
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class AgentListResponse(BaseModel):
    """Schema for paginated agent list."""
    agents: list[AgentResponse]
    total: int
    page: int
    page_size: int
