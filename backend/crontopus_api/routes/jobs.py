"""
Job manifest routes - for viewing and managing jobs in Forgejo.

Routing:
- This router has NO prefix defined
- Routes are included in main.py with prefix="/api/jobs"
- @router.get("/") becomes GET /api/jobs/ (note trailing slash added by FastAPI)
- @router.post("") becomes POST /api/jobs (no trailing slash)
- Frontend must call GET /api/jobs/ (with slash) to match FastAPI routing

Job Storage:
- Job definitions live in Git (Forgejo), NOT in database
- All CRUD operations commit changes to Git
- Database only stores run history and metadata
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body, Request
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
import yaml

from sqlalchemy.orm import Session
from fastapi_limiter.depends import RateLimiter
from ..security.dependencies import get_current_user
from ..models.user import User
from ..models import JobInstance, Endpoint
from ..services.forgejo import ForgejoClient
from ..config import settings, get_db


router = APIRouter(tags=["jobs"])


class JobCreateRequest(BaseModel):
    """Request body for creating a job."""
    name: str = Field(..., description="Job name (will be used as filename)")
    namespace: str = Field(..., description="Namespace/group for organizing jobs")
    schedule: str = Field(..., description="Cron expression")
    command: str = Field(..., description="Command to execute")
    args: Optional[list[str]] = Field(None, description="Command arguments")
    env: Optional[Dict[str, str]] = Field(None, description="Environment variables")
    enabled: bool = Field(True, description="Whether job is enabled")
    paused: bool = Field(False, description="Whether job is paused")
    timezone: Optional[str] = Field(None, description="Timezone for schedule")
    labels: Optional[Dict[str, str]] = Field(None, description="Job labels")
    

class JobUpdateRequest(BaseModel):
    """Request body for updating a job."""
    schedule: Optional[str] = None
    command: Optional[str] = None
    args: Optional[list[str]] = None
    env: Optional[Dict[str, str]] = None
    enabled: Optional[bool] = None
    paused: Optional[bool] = None
    timezone: Optional[str] = None
    labels: Optional[Dict[str, str]] = None


def get_forgejo_client() -> ForgejoClient:
    """Get Forgejo client instance."""
    # TODO: Make this configurable per tenant
    return ForgejoClient(
        base_url=settings.forgejo_url,
        username=settings.forgejo_username,
        token=settings.forgejo_token
    )


@router.get("/", dependencies=[Depends(RateLimiter(times=60, seconds=60))])
async def list_jobs(
    request: Request,
    namespace: Optional[str] = Query(None, description="Filter by namespace/group"),
    current_user: User = Depends(get_current_user),
    forgejo: ForgejoClient = Depends(get_forgejo_client)
):
    """
    List all job manifests from Git repository.
    
    Jobs are stored in Git, not in the database.
    This endpoint fetches the manifest list from Forgejo.
    """
    try:
        # Use tenant-specific repository for isolation
        repo_name = f"job-manifests-{current_user.tenant_id}"
        manifests = await forgejo.list_job_manifests(
            owner="crontopus",
            repo=repo_name,
            namespace=namespace
        )
        
        return {
            "jobs": manifests,
            "count": len(manifests),
            "source": "git",
            "repository": f"https://git.crontopus.com/crontopus/{repo_name}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch jobs from Git: {str(e)}")


# Removed catch-all route - use /jobs/{namespace}/{job_name} instead


@router.post("", status_code=201, dependencies=[Depends(RateLimiter(times=30, seconds=60))])
async def create_job(
    request: Request,
    job: JobCreateRequest,
    forgejo: ForgejoClient = Depends(get_forgejo_client),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new job by committing a manifest to Git.
    
    The job will be created in the specified namespace directory.
    """
    try:
        import uuid
        
        # Build the manifest
        manifest = {
            "apiVersion": "v1",
            "kind": "Job",
            "metadata": {
                "id": str(uuid.uuid4()),
                "name": job.name,
                "namespace": job.namespace,
                "tenant": current_user.tenant_id,
            },
            "spec": {
                "schedule": job.schedule,
                "command": job.command,
                "enabled": job.enabled,
                "paused": job.paused,
            },
        }
        
        # Add optional fields
        if job.args:
            manifest["spec"]["args"] = job.args
        if job.env:
            manifest["spec"]["env"] = job.env
        if job.timezone:
            manifest["spec"]["timezone"] = job.timezone
        if job.labels:
            manifest["metadata"]["labels"] = job.labels
            
        # Convert to YAML
        yaml_content = yaml.dump(manifest, sort_keys=False, default_flow_style=False)
        
        # Construct file path
        file_path = f"{job.namespace}/{job.name}.yaml"
        
        # Commit to Git
        # Use tenant-specific repository for isolation
        repo_name = f"job-manifests-{current_user.tenant_id}"
        result = await forgejo.create_or_update_file(
            owner="crontopus",
            repo=repo_name,
            file_path=file_path,
            content=yaml_content,
            message=f"Create job {job.name} in {job.namespace}",
            author_name=current_user.username,
            author_email=current_user.email or f"{current_user.username}@crontopus.io",
        )
        
        return {
            "message": "Job created successfully",
            "path": file_path,
            "commit": result.get("commit"),
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{namespace}/{job_name}", dependencies=[Depends(RateLimiter(times=30, seconds=60))])
async def update_job(
    request: Request,
    namespace: str,
    job_name: str,
    updates: JobUpdateRequest,
    forgejo: ForgejoClient = Depends(get_forgejo_client),
    current_user: User = Depends(get_current_user),
):
    """
    Update an existing job by modifying its manifest in Git.
    
    Only the fields provided in the request will be updated.
    """
    try:
        # Construct file path
        file_path = f"{namespace}/{job_name}.yaml"
        
        # Fetch current manifest
        # Use tenant-specific repository for isolation
        repo_name = f"job-manifests-{current_user.tenant_id}"
        manifest_data = await forgejo.get_job_manifest(
            owner="crontopus",
            repo=repo_name,
            file_path=file_path
        )
        if not manifest_data:
            raise HTTPException(status_code=404, detail="Job not found")
            
        # Parse YAML
        manifest = manifest_data  # get_job_manifest already returns parsed manifest
        
        # Remove _meta section (internal use only, shouldn't be written to Git)
        manifest.pop('_meta', None)
        
        # Update fields (only if provided)
        if updates.schedule is not None:
            manifest["spec"]["schedule"] = updates.schedule
        if updates.command is not None:
            manifest["spec"]["command"] = updates.command
        if updates.args is not None:
            manifest["spec"]["args"] = updates.args
        if updates.env is not None:
            manifest["spec"]["env"] = updates.env
        if updates.enabled is not None:
            manifest["spec"]["enabled"] = updates.enabled
        if updates.paused is not None:
            manifest["spec"]["paused"] = updates.paused
        if updates.timezone is not None:
            manifest["spec"]["timezone"] = updates.timezone
        if updates.labels is not None:
            manifest["metadata"]["labels"] = updates.labels
            
        # Convert to YAML
        yaml_content = yaml.dump(manifest, sort_keys=False, default_flow_style=False)
        
        # Commit to Git
        # Use tenant-specific repository for isolation
        repo_name = f"job-manifests-{current_user.tenant_id}"
        result = await forgejo.create_or_update_file(
            owner="crontopus",
            repo=repo_name,
            file_path=file_path,
            content=yaml_content,
            message=f"Update job {job_name} in {namespace}",
            author_name=current_user.username,
            author_email=current_user.email or f"{current_user.username}@crontopus.io",
        )
        
        return {
            "message": "Job updated successfully",
            "path": file_path,
            "commit": result.get("commit"),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{namespace}/{job_name}", dependencies=[Depends(RateLimiter(times=30, seconds=60))])
async def delete_job(
    request: Request,
    namespace: str,
    job_name: str,
    forgejo: ForgejoClient = Depends(get_forgejo_client),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a job by removing its manifest from Git.
    Discovered jobs cannot be deleted - they must be managed by their external application.
    """
    try:
        # Construct file path
        file_path = f"{namespace}/{job_name}.yaml"
        
        # Fetch current manifest to check if it's discovered
        repo_name = f"job-manifests-{current_user.tenant_id}"
        manifest_data = await forgejo.get_job_manifest(
            owner="crontopus",
            repo=repo_name,
            file_path=file_path
        )
        
        if manifest_data:
            # Check if job is discovered
            labels = manifest_data.get("metadata", {}).get("labels", {})
            if labels.get("source") == "discovered":
                raise HTTPException(
                    status_code=403,
                    detail="Cannot delete discovered jobs. Remove this job using the application that created it, or adopt it first."
                )
        
        # Delete from Git
        result = await forgejo.delete_file(
            owner="crontopus",
            repo=repo_name,
            file_path=file_path,
            message=f"Delete job {job_name} from {namespace}",
            author_name=current_user.username,
            author_email=current_user.email or f"{current_user.username}@crontopus.io",
        )
        
        return {
            "message": "Job deleted successfully",
            "path": file_path,
            "commit": result.get("commit"),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{namespace}/{job_name}/adopt", dependencies=[Depends(RateLimiter(times=30, seconds=60))])
async def adopt_job(
    request: Request,
    namespace: str,
    job_name: str,
    target_namespace: str = Body(..., embed=True, description="Target namespace (production/staging)"),
    forgejo: ForgejoClient = Depends(get_forgejo_client),
    current_user: User = Depends(get_current_user),
):
    """
    Adopt a discovered job by moving it to a managed namespace.
    
    This removes the 'discovered' label and moves the job from 'discovered' to target namespace.
    After adoption, Crontopus will fully manage the job (wrapping, monitoring, etc).
    """
    try:
        # Validate source is discovered namespace
        if namespace != "discovered":
            raise HTTPException(
                status_code=400,
                detail="Only jobs in 'discovered' namespace can be adopted"
            )
        
        # Fetch current manifest
        repo_name = f"job-manifests-{current_user.tenant_id}"
        file_path = f"{namespace}/{job_name}.yaml"
        manifest_data = await forgejo.get_job_manifest(
            owner="crontopus",
            repo=repo_name,
            file_path=file_path
        )
        
        if not manifest_data:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Verify it's actually a discovered job
        labels = manifest_data.get("metadata", {}).get("labels", {})
        if labels.get("source") != "discovered":
            raise HTTPException(
                status_code=400,
                detail="This job is not marked as discovered"
            )
        
        # Remove _meta section
        manifest_data.pop('_meta', None)
        
        # Update metadata: change namespace and remove discovered label
        manifest_data["metadata"]["namespace"] = target_namespace
        if "labels" in manifest_data["metadata"]:
            manifest_data["metadata"]["labels"].pop("source", None)
            manifest_data["metadata"]["labels"].pop("endpoint_id", None)
            # If no labels left, remove the labels key
            if not manifest_data["metadata"]["labels"]:
                manifest_data["metadata"].pop("labels")
        
        # Convert to YAML
        yaml_content = yaml.dump(manifest_data, sort_keys=False, default_flow_style=False)
        
        # Create new file in target namespace
        new_file_path = f"{target_namespace}/{job_name}.yaml"
        await forgejo.create_or_update_file(
            owner="crontopus",
            repo=repo_name,
            file_path=new_file_path,
            content=yaml_content,
            message=f"Adopt job {job_name} from discovered to {target_namespace}",
            author_name=current_user.username,
            author_email=current_user.email or f"{current_user.username}@crontopus.io",
        )
        
        # Delete old file from discovered namespace
        await forgejo.delete_file(
            owner="crontopus",
            repo=repo_name,
            file_path=file_path,
            message=f"Remove {job_name} from discovered (adopted to {target_namespace})",
            author_name=current_user.username,
            author_email=current_user.email or f"{current_user.username}@crontopus.io",
        )
        
        return {
            "message": f"Job adopted successfully and moved to {target_namespace}",
            "old_path": file_path,
            "new_path": new_file_path,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{namespace}/{job_name}")
async def get_job_by_name(
    namespace: str,
    job_name: str,
    current_user: User = Depends(get_current_user),
    forgejo: ForgejoClient = Depends(get_forgejo_client)
):
    """
    Get a job manifest by namespace and name.
    
    This is a convenience endpoint that constructs the path.
    """
    # Add .yaml extension if not present
    if not job_name.endswith(('.yaml', '.yml')):
        job_name = f"{job_name}.yaml"
    
    job_path = f"{namespace}/{job_name}"
    
    try:
        # Use tenant-specific repository for isolation
        repo_name = f"job-manifests-{current_user.tenant_id}"
        manifest = await forgejo.get_job_manifest(
            owner="crontopus",
            repo=repo_name,
            file_path=job_path
        )
        
        is_valid, error = await forgejo.validate_manifest(manifest)
        
        return {
            "manifest": manifest,
            "valid": is_valid,
            "error": error,
            "source": "git",
            "namespace": namespace,
            "name": job_name
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Job not found: {str(e)}")


@router.get("/{namespace}/{job_name}/endpoints")
async def get_job_endpoints(
    namespace: str,
    job_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all endpoints running a specific job.
    
    Returns list of endpoints with their job instance status.
    Enforces tenant isolation.
    """
    # Strip .yaml extension if present
    if job_name.endswith(('.yaml', '.yml')):
        job_name = job_name[:-5] if job_name.endswith('.yaml') else job_name[:-4]
    
    # Get all job instances for this job in tenant
    job_instances = db.query(JobInstance).join(Endpoint).filter(
        JobInstance.job_name == job_name,
        JobInstance.namespace == namespace,
        JobInstance.tenant_id == current_user.tenant_id
    ).all()
    
    # Get endpoint details for each instance
    endpoints_data = []
    for instance in job_instances:
        endpoint = db.query(Endpoint).filter(Endpoint.id == instance.endpoint_id).first()
        if endpoint:
            endpoints_data.append({
                "endpoint_id": endpoint.id,
                "name": endpoint.name,
                "hostname": endpoint.hostname,
                "platform": endpoint.platform,
                "status": endpoint.status.value,
                "last_heartbeat": endpoint.last_heartbeat,
                "job_instance": {
                    "status": instance.status.value,
                    "source": instance.source.value,
                    "last_seen": instance.last_seen
                }
            })
    
    return {
        "job_name": job_name,
        "namespace": namespace,
        "endpoints": endpoints_data,
        "total": len(endpoints_data)
    }
