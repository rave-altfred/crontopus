"""
Job management routes.
All routes require authentication and enforce tenant isolation.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from crontopus_api.config import get_db
from crontopus_api.models import Job, User
from crontopus_api.schemas.job import JobCreate, JobUpdate, JobResponse, JobListResponse
from crontopus_api.security.dependencies import get_current_user

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    job_data: JobCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new job.
    
    The job will be associated with the authenticated user's tenant.
    """
    # Create job with tenant isolation
    new_job = Job(
        tenant_id=current_user.tenant_id,
        name=job_data.name,
        description=job_data.description,
        schedule=job_data.schedule,
        timezone=job_data.timezone,
        command=job_data.command,
        is_enabled=job_data.is_enabled,
        job_metadata=job_data.metadata,
        agent_id=job_data.agent_id
    )
    
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    
    return new_job


@router.get("", response_model=JobListResponse)
async def list_jobs(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    enabled: Optional[bool] = Query(None, description="Filter by enabled status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all jobs for the current tenant.
    
    Supports pagination and filtering.
    """
    # Base query with tenant isolation
    query = db.query(Job).filter(Job.tenant_id == current_user.tenant_id)
    
    # Apply filters
    if enabled is not None:
        query = query.filter(Job.is_enabled == enabled)
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * page_size
    jobs = query.order_by(Job.created_at.desc()).offset(offset).limit(page_size).all()
    
    return JobListResponse(
        jobs=jobs,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific job by ID.
    
    Enforces tenant isolation - users can only access jobs from their tenant.
    """
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.tenant_id == current_user.tenant_id
    ).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    return job


@router.put("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: int,
    job_data: JobUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update an existing job.
    
    Only updates fields that are provided in the request.
    Enforces tenant isolation.
    """
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.tenant_id == current_user.tenant_id
    ).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    # Update only provided fields
    update_data = job_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(job, field, value)
    
    db.commit()
    db.refresh(job)
    
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a job.
    
    Enforces tenant isolation - users can only delete jobs from their tenant.
    """
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.tenant_id == current_user.tenant_id
    ).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    db.delete(job)
    db.commit()
    
    return None