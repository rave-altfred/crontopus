"""
Check-in and run history routes.

Jobs report execution results via check-ins.
Run history is queried by authenticated users.
"""
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, case
from pydantic import BaseModel

from crontopus_api.config import get_db
from crontopus_api.models import JobRun, JobStatus, User, Endpoint
from crontopus_api.schemas.checkin import (
    CheckinRequest,
    CheckinResponse,
    JobRunResponse,
    JobRunListResponse,
    AgentCheckinRequest
)
from crontopus_api.security.dependencies import get_current_user
from crontopus_api.middleware.rate_limit import limiter

router = APIRouter(tags=["checkins", "runs"])


@router.post("/runs/check-in", response_model=CheckinResponse, status_code=status.HTTP_201_CREATED)
# @limiter.limit("100/minute")  # TODO: Fix async compatibility issue
async def agent_checkin(
    request: Request,
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


# Response models for aggregated views
class JobAggregation(BaseModel):
    job_name: str
    namespace: str
    endpoint_count: int
    run_count: int
    success_count: int
    failure_count: int
    health: str  # "healthy", "degraded", "warning"


class JobAggregationListResponse(BaseModel):
    jobs: List[JobAggregation]
    total: int


class EndpointAggregation(BaseModel):
    id: int
    name: str
    hostname: Optional[str]
    platform: str
    machine_id: str
    version: str
    run_count: int
    success_count: int
    failure_count: int
    health: str  # "healthy", "degraded", "warning"


class EndpointAggregationListResponse(BaseModel):
    endpoints: List[EndpointAggregation]
    total: int


@router.get("/runs/by-job", response_model=JobAggregationListResponse)
async def runs_by_job(
    days: int = Query(7, ge=1, le=365, description="Days to look back"),
    job_name: Optional[str] = Query(None, description="Filter by job name"),
    namespace: Optional[str] = Query(None, description="Filter by namespace"),
    endpoint_id: Optional[int] = Query(None, description="Filter by endpoint ID"),
    status: Optional[JobStatus] = Query(None, description="Filter by status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get aggregated job run statistics grouped by job.
    
    Returns job-level metrics including:
    - Number of endpoints running the job
    - Total run count
    - Success/failure counts
    - Health status (healthy/degraded/warning)
    """
    # Calculate time window
    since = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Base query with tenant isolation and time filter
    query = db.query(
        JobRun.job_name,
        JobRun.namespace,
        func.count(func.distinct(JobRun.endpoint_id)).label('endpoint_count'),
        func.count(JobRun.id).label('run_count'),
        func.sum(case((JobRun.status == JobStatus.SUCCESS, 1), else_=0)).label('success_count'),
        func.sum(case((JobRun.status == JobStatus.FAILURE, 1), else_=0)).label('failure_count')
    ).filter(
        JobRun.tenant_id == current_user.tenant_id,
        JobRun.started_at >= since
    )
    
    # Apply filters
    if job_name:
        query = query.filter(JobRun.job_name.ilike(f"%{job_name}%"))
    if namespace:
        query = query.filter(JobRun.namespace == namespace)
    if endpoint_id:
        query = query.filter(JobRun.endpoint_id == endpoint_id)
    if status:
        query = query.filter(JobRun.status == status)
    
    # Group by job and namespace
    query = query.group_by(JobRun.job_name, JobRun.namespace)
    query = query.order_by(desc('run_count'))
    
    results = query.all()
    
    # Calculate health for each job
    jobs = []
    for row in results:
        success = row.success_count or 0
        failure = row.failure_count or 0
        total = row.run_count
        
        # Calculate health
        if total == 0:
            health = "warning"
        else:
            success_rate = success / total
            if success_rate >= 0.95:
                health = "healthy"
            elif success_rate >= 0.70:
                health = "degraded"
            else:
                health = "warning"
        
        jobs.append(JobAggregation(
            job_name=row.job_name,
            namespace=row.namespace or "default",
            endpoint_count=row.endpoint_count or 0,
            run_count=row.run_count,
            success_count=success,
            failure_count=failure,
            health=health
        ))
    
    return JobAggregationListResponse(
        jobs=jobs,
        total=len(jobs)
    )


@router.get("/runs/by-endpoint", response_model=EndpointAggregationListResponse)
async def runs_by_endpoint(
    days: int = Query(7, ge=1, le=365, description="Days to look back"),
    name: Optional[str] = Query(None, description="Filter by endpoint name"),
    hostname: Optional[str] = Query(None, description="Filter by hostname"),
    platform: Optional[str] = Query(None, description="Filter by platform"),
    machine_id: Optional[str] = Query(None, description="Filter by machine ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get aggregated job run statistics grouped by endpoint.
    
    Returns endpoint-level metrics including:
    - Total run count
    - Success/failure counts
    - Health status (healthy/degraded/warning)
    """
    # Calculate time window
    since = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Base query: get all endpoints for tenant with run stats
    endpoint_query = db.query(Endpoint).filter(
        Endpoint.tenant_id == current_user.tenant_id
    )
    
    # Apply endpoint filters
    if name:
        endpoint_query = endpoint_query.filter(Endpoint.name.ilike(f"%{name}%"))
    if hostname:
        endpoint_query = endpoint_query.filter(Endpoint.hostname.ilike(f"%{hostname}%"))
    if platform:
        endpoint_query = endpoint_query.filter(Endpoint.platform.ilike(f"%{platform}%"))
    if machine_id:
        endpoint_query = endpoint_query.filter(Endpoint.machine_id.ilike(f"%{machine_id}%"))
    
    endpoints_list = endpoint_query.all()
    
    # Get run stats for each endpoint
    endpoint_aggregations = []
    for endpoint in endpoints_list:
        # Query runs for this endpoint in the time window
        run_stats = db.query(
            func.count(JobRun.id).label('run_count'),
            func.sum(case((JobRun.status == JobStatus.SUCCESS, 1), else_=0)).label('success_count'),
            func.sum(case((JobRun.status == JobStatus.FAILURE, 1), else_=0)).label('failure_count')
        ).filter(
            JobRun.endpoint_id == endpoint.id,
            JobRun.started_at >= since
        ).first()
        
        run_count = run_stats.run_count or 0
        success = run_stats.success_count or 0
        failure = run_stats.failure_count or 0
        
        # Calculate health
        if run_count == 0:
            health = "warning"
        else:
            success_rate = success / run_count
            if success_rate >= 0.95:
                health = "healthy"
            elif success_rate >= 0.70:
                health = "degraded"
            else:
                health = "warning"
        
        endpoint_aggregations.append(EndpointAggregation(
            id=endpoint.id,
            name=endpoint.name,
            hostname=endpoint.hostname,
            platform=endpoint.platform,
            machine_id=endpoint.machine_id,
            version=endpoint.version,
            run_count=run_count,
            success_count=success,
            failure_count=failure,
            health=health
        ))
    
    # Sort by run count descending
    endpoint_aggregations.sort(key=lambda x: x.run_count, reverse=True)
    
    return EndpointAggregationListResponse(
        endpoints=endpoint_aggregations,
        total=len(endpoint_aggregations)
    )


@router.get("/runs", response_model=JobRunListResponse)
async def list_runs(
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of runs to return"),
    job_name: Optional[str] = Query(None, description="Filter by job name"),
    namespace: Optional[str] = Query(None, description="Filter by namespace"),
    endpoint_id: Optional[int] = Query(None, description="Filter by endpoint ID"),
    status: Optional[JobStatus] = Query(None, description="Filter by status"),
    days: Optional[int] = Query(None, ge=1, le=365, description="Days to look back"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List job run history for the current tenant.
    
    Supports filtering by job name, namespace, endpoint, status, and time window.
    Returns up to 'limit' most recent runs (default 100).
    """
    # Base query with tenant isolation
    query = db.query(JobRun).filter(JobRun.tenant_id == current_user.tenant_id)
    
    # Apply time filter if specified
    if days:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        query = query.filter(JobRun.started_at >= since)
    
    # Apply filters
    if job_name:
        query = query.filter(JobRun.job_name.ilike(f"%{job_name}%"))
    
    if namespace:
        query = query.filter(JobRun.namespace == namespace)
    
    if endpoint_id:
        query = query.filter(JobRun.endpoint_id == endpoint_id)
    
    if status:
        query = query.filter(JobRun.status == status)
    
    # Get total count
    total = query.count()
    
    # Apply limit (no pagination, just top N results)
    runs = query.order_by(JobRun.started_at.desc()).limit(limit).all()
    
    return JobRunListResponse(
        runs=runs,
        total=total,
        page=1,
        page_size=limit
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
