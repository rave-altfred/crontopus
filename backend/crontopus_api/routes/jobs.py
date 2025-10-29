"""
Job manifest routes - for viewing jobs from Forgejo.
Note: Job definitions live in Git, not in database.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from ..security.auth import get_current_user
from ..schemas.user import User
from ..services.forgejo import ForgejoClient
from ..config import settings


router = APIRouter(prefix="/jobs", tags=["jobs"])


def get_forgejo_client() -> ForgejoClient:
    """Get Forgejo client instance."""
    # TODO: Make this configurable per tenant
    return ForgejoClient(
        base_url=settings.forgejo_url,
        username=settings.forgejo_username,
        token=settings.forgejo_token
    )


@router.get("/")
async def list_jobs(
    namespace: Optional[str] = Query(None, description="Filter by namespace (production, staging)"),
    current_user: User = Depends(get_current_user),
    forgejo: ForgejoClient = Depends(get_forgejo_client)
):
    """
    List all job manifests from Git repository.
    
    Jobs are stored in Git, not in the database.
    This endpoint fetches the manifest list from Forgejo.
    """
    try:
        # TODO: Make owner/repo configurable per tenant
        manifests = await forgejo.list_job_manifests(
            owner="crontopus",
            repo="job-manifests",
            namespace=namespace
        )
        
        return {
            "jobs": manifests,
            "count": len(manifests),
            "source": "git",
            "repository": "https://git.crontopus.com/crontopus/job-manifests"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch jobs from Git: {str(e)}")


@router.get("/{job_path:path}")
async def get_job(
    job_path: str,
    current_user: User = Depends(get_current_user),
    forgejo: ForgejoClient = Depends(get_forgejo_client)
):
    """
    Get a specific job manifest by path.
    
    Example paths:
    - production/backup-database.yaml
    - staging/test-job.yaml
    """
    try:
        manifest = await forgejo.get_job_manifest(
            owner="crontopus",
            repo="job-manifests",
            file_path=job_path
        )
        
        # Validate manifest
        is_valid, error = await forgejo.validate_manifest(manifest)
        
        return {
            "manifest": manifest,
            "valid": is_valid,
            "error": error,
            "source": "git",
            "path": job_path
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Job not found: {str(e)}")


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
        manifest = await forgejo.get_job_manifest(
            owner="crontopus",
            repo="job-manifests",
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
