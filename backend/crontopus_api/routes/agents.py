"""
Agent management routes.

Handles agent enrollment, heartbeat, and lifecycle management.
"""
import secrets
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from crontopus_api.config import get_db
from crontopus_api.models import Agent, AgentStatus, User
from crontopus_api.schemas.agent import (
    AgentEnroll,
    AgentEnrollResponse,
    AgentHeartbeat,
    AgentResponse,
    AgentListResponse
)
from crontopus_api.security.dependencies import get_current_user
from crontopus_api.security.password import get_password_hash

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("/enroll", response_model=AgentEnrollResponse, status_code=status.HTTP_201_CREATED)
async def enroll_agent(
    agent_data: AgentEnroll,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Enroll a new agent.
    
    Creates a new agent and returns an authentication token.
    Only authenticated users can enroll agents.
    """
    # Generate agent token
    token = secrets.token_urlsafe(32)
    token_hash = get_password_hash(token)
    
    # Create agent
    agent = Agent(
        tenant_id=current_user.tenant_id,
        name=agent_data.name,
        hostname=agent_data.hostname,
        platform=agent_data.platform,
        version=agent_data.version,
        git_repo_url=agent_data.git_repo_url,
        git_branch=agent_data.git_branch,
        token_hash=token_hash,
        status=AgentStatus.ACTIVE
    )
    
    db.add(agent)
    db.commit()
    db.refresh(agent)
    
    return AgentEnrollResponse(
        agent_id=agent.id,
        token=token
    )


@router.get("", response_model=AgentListResponse)
async def list_agents(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    status_filter: Optional[AgentStatus] = Query(None, alias="status", description="Filter by status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all agents for the current tenant.
    
    Supports pagination and filtering by status.
    """
    # Base query with tenant isolation
    query = db.query(Agent).filter(Agent.tenant_id == current_user.tenant_id)
    
    # Apply status filter
    if status_filter:
        query = query.filter(Agent.status == status_filter)
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * page_size
    agents = query.order_by(Agent.enrolled_at.desc()).offset(offset).limit(page_size).all()
    
    return AgentListResponse(
        agents=agents,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get details of a specific agent.
    
    Enforces tenant isolation.
    """
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.tenant_id == current_user.tenant_id
    ).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    return agent


@router.post("/{agent_id}/heartbeat", status_code=status.HTTP_200_OK)
async def agent_heartbeat(
    agent_id: int,
    heartbeat_data: AgentHeartbeat,
    db: Session = Depends(get_db)
):
    """
    Record agent heartbeat.
    
    Agents call this endpoint periodically to report they are alive.
    TODO: Add agent token authentication
    """
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Update last heartbeat
    agent.last_heartbeat = datetime.now(timezone.utc)
    
    # Update status if provided
    if heartbeat_data.status:
        agent.status = heartbeat_data.status
    
    # Update platform/version if provided
    if heartbeat_data.platform:
        agent.platform = heartbeat_data.platform
    if heartbeat_data.version:
        agent.version = heartbeat_data.version
    
    db.commit()
    
    return {"message": "Heartbeat recorded", "agent_id": agent_id}


@router.delete("/{agent_id}", status_code=status.HTTP_200_OK)
async def revoke_agent(
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Revoke an agent.
    
    Marks the agent as revoked, preventing further API calls.
    """
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.tenant_id == current_user.tenant_id
    ).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    agent.status = AgentStatus.REVOKED
    db.commit()
    
    return {"message": "Agent revoked", "agent_id": agent_id}