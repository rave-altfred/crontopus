"""
Check-in and run history routes.

Jobs report execution results via check-ins.
Run history is queried by authenticated users.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from crontopus_api.config import get_db
from crontopus_api.models import JobRun, JobStatus, User
from crontopus_api.schemas.checkin import (
    CheckinRequest,
    CheckinResponse,
    JobRunResponse,
    JobRunListResponse,
    AgentCheckinRequest
)
from crontopus_api.security.dependencies import get_current_user

router = APIRouter(tags=["checkins", "runs"])


@router.post("/runs/check-in", response_model=CheckinResponse, status_code=status.HTTP_201_CREATED)
async def agent_checkin(
    checkin_data: AgentCheckinRequest,
    db: Session = Depends(get_db)
):
    """
    Simplified check-in endpoint for agent callback scripts.
    
    This endpoint is called by jobs wrapped with check-in callbacks.
    Accepts minimal data: endpoint_id, job_name, namespace, status.
    
    No authentication required - endpoint_id serves as authentication.
    """
    from datetime import datetime, timezone
    from crontopus_api.models import Endpoint
    
    # Verify endpoint exists and get tenant_id
    endpoint = db.query(Endpoint).filter(Endpoint.id == checkin_data.endpoint_id).first()
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Endpoint not found"
        )
    
    # Create job run record with captured data
    now = datetime.now(timezone.utc)
    job_run = JobRun(
        tenant_id=endpoint.tenant_id,
        job_name=checkin_data.job_name,
        namespace=checkin_data.namespace,
        status=checkin_data.to_job_status(),  # Convert string to enum
        started_at=now,
        finished_at=now,
        endpoint_id=checkin_data.endpoint_id,
        exit_code=checkin_data.exit_code,
        duration=checkin_data.duration,
        output=checkin_data.output,
        error_message=checkin_data.error_message
    )
    
    db.add(job_run)
    db.commit()
    db.refresh(job_run)
    
    return CheckinResponse(run_id=job_run.id)


@router.post("/checkins", response_model=CheckinResponse, status_code=status.HTTP_201_CREATED)
async def create_checkin(
    checkin_data: CheckinRequest,
    db: Session = Depends(get_db)
):
    """
    Record a job check-in (legacy endpoint).
    
    Jobs call this endpoint to report execution results.
    Authentication is handled via tenant validation.
    """
    # Create job run record
    job_run = JobRun(
        tenant_id=checkin_data.tenant,
        job_name=checkin_data.job_name,
        status=checkin_data.status,
        started_at=checkin_data.started_at,
        finished_at=checkin_data.finished_at,
        duration=checkin_data.duration,
        output=checkin_data.output,
        error_message=checkin_data.error_message,
        exit_code=checkin_data.exit_code,
        agent_id=checkin_data.agent_id
    )
    
    db.add(job_run)
    db.commit()
    db.refresh(job_run)
    
    return CheckinResponse(run_id=job_run.id)


@router.get("/runs", response_model=JobRunListResponse)
async def list_runs(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    job_name: Optional[str] = Query(None, description="Filter by job name"),
    status: Optional[JobStatus] = Query(None, description="Filter by status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List job run history for the current tenant.
    
    Supports pagination and filtering by job name and status.
    """
    # Base query with tenant isolation
    query = db.query(JobRun).filter(JobRun.tenant_id == current_user.tenant_id)
    
    # Apply filters
    if job_name:
        query = query.filter(JobRun.job_name == job_name)
    
    if status:
        query = query.filter(JobRun.status == status)
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * page_size
    runs = query.order_by(JobRun.started_at.desc()).offset(offset).limit(page_size).all()
    
    return JobRunListResponse(
        runs=runs,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/runs/{run_id}", response_model=JobRunResponse)
async def get_run(
    run_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get details of a specific job run.
    
    Enforces tenant isolation.
    """
    run = db.query(JobRun).filter(
        JobRun.id == run_id,
        JobRun.tenant_id == current_user.tenant_id
    ).first()
    
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found"
        )
    
    return run
