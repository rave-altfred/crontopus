"""
Namespace routes for managing job organization groups.

Namespaces are Git directories in the job manifest repository.
They provide flexible organization without database overhead.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field, validator
from typing import List
import re
import logging
from fastapi_limiter.depends import RateLimiter

from sqlalchemy.orm import Session
from ..security.dependencies import get_current_user
from ..models.user import User
from ..services.forgejo import ForgejoClient
from ..config import settings, get_db


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/namespaces", tags=["namespaces"])

# System namespaces that cannot be created or deleted by users
SYSTEM_NAMESPACES = {"discovered", "default"}


class NamespaceResponse(BaseModel):
    """Response model for a namespace."""
    name: str
    is_system: bool
    job_count: int


class NamespaceCreateRequest(BaseModel):
    """Request body for creating a namespace."""
    name: str = Field(..., description="Namespace name (lowercase, alphanumeric, hyphens)")
    
    @validator('name')
    def validate_name(cls, v):
        """Validate namespace naming rules."""
        # Kubernetes-style naming: lowercase, alphanumeric, hyphens
        # Must start and end with alphanumeric
        if not re.match(r'^[a-z0-9]([-a-z0-9]*[a-z0-9])?$', v):
            raise ValueError(
                'Namespace name must be lowercase alphanumeric with hyphens, '
                'starting and ending with alphanumeric character'
            )
        
        if len(v) > 63:
            raise ValueError('Namespace name must be 63 characters or less')
        
        if v in SYSTEM_NAMESPACES:
            raise ValueError(f'Cannot create system namespace: {v}')
        
        return v


def get_forgejo_client() -> ForgejoClient:
    """Get Forgejo client instance."""
    return ForgejoClient(
        base_url=settings.forgejo_url,
        username=settings.forgejo_username,
        token=settings.forgejo_token
    )


@router.get("/", response_model=List[NamespaceResponse], dependencies=[Depends(RateLimiter(times=60, seconds=60))])
async def list_namespaces(
    request: Request,
    current_user: User = Depends(get_current_user),
    forgejo: ForgejoClient = Depends(get_forgejo_client)
):
    """
    List all namespaces (groups) for the current tenant.
    
    Namespaces are discovered from the Git repository directory structure.
    Each directory in the root of the job manifest repository is a namespace.
    """
    try:
        repo_name = f"job-manifests-{current_user.tenant_id}"
        
        # Get directory listing from Git repository root
        contents = await forgejo.get_repository_tree(
            owner="crontopus",
            repo=repo_name,
            path=""
        )
        
        namespaces = []
        
        for item in contents:
            # Only include directories (namespaces)
            if item.get("type") == "dir":
                namespace_name = item["name"]
                
                # Count jobs in this namespace (YAML files)
                try:
                    namespace_contents = await forgejo.get_repository_tree(
                        owner="crontopus",
                        repo=repo_name,
                        path=namespace_name
                    )
                    
                    # Count YAML files (jobs)
                    job_count = sum(
                        1 for f in namespace_contents
                        if f.get("type") == "file" and f["name"].endswith((".yaml", ".yml"))
                    )
                except Exception as e:
                    logger.warning(f"Could not count jobs in namespace {namespace_name}: {e}")
                    job_count = 0
                
                namespaces.append(NamespaceResponse(
                    name=namespace_name,
                    is_system=namespace_name in SYSTEM_NAMESPACES,
                    job_count=job_count
                ))
        
        # Sort: system namespaces first, then alphabetically
        namespaces.sort(key=lambda ns: (not ns.is_system, ns.name))
        
        return namespaces
        
    except Exception as e:
        logger.error(f"Error listing namespaces: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list namespaces: {str(e)}"
        )


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=NamespaceResponse, dependencies=[Depends(RateLimiter(times=30, seconds=60))])
async def create_namespace(
    request: Request,
    namespace_data: NamespaceCreateRequest,
    current_user: User = Depends(get_current_user),
    forgejo: ForgejoClient = Depends(get_forgejo_client)
):
    """
    Create a new namespace (group) by creating a Git directory.
    
    System namespaces (discovered, default) cannot be created via API.
    """
    try:
        repo_name = f"job-manifests-{current_user.tenant_id}"
        
        # Check if namespace already exists
        try:
            existing = await forgejo.get_repository_tree(
                owner="crontopus",
                repo=repo_name,
                path=namespace_data.name
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Namespace '{namespace_data.name}' already exists"
                )
        except HTTPException:
            raise  # Re-raise our own exception
        except Exception:
            # Directory doesn't exist, that's what we want
            pass
        
        # Create namespace directory with .gitkeep file
        file_path = f"{namespace_data.name}/.gitkeep"
        
        await forgejo.create_or_update_file(
            owner="crontopus",
            repo=repo_name,
            file_path=file_path,
            content=f"# Namespace: {namespace_data.name}\n# Jobs in this group will appear here\n",
            message=f"Create namespace: {namespace_data.name}",
            author_name=current_user.username,
            author_email=current_user.email or f"{current_user.username}@crontopus.io"
        )
        
        logger.info(f"Created namespace {namespace_data.name} for tenant {current_user.tenant_id}")
        
        return NamespaceResponse(
            name=namespace_data.name,
            is_system=False,
            job_count=0
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating namespace: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create namespace: {str(e)}"
        )


@router.delete("/{name}", status_code=status.HTTP_200_OK, dependencies=[Depends(RateLimiter(times=30, seconds=60))])
async def delete_namespace(
    request: Request,
    name: str,
    current_user: User = Depends(get_current_user),
    forgejo: ForgejoClient = Depends(get_forgejo_client)
):
    """
    Delete a namespace (group).
    
    Only allowed if:
    - Namespace is not a system namespace (discovered, default)
    - Namespace is empty (contains no jobs)
    """
    try:
        # Validate not a system namespace
        if name in SYSTEM_NAMESPACES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete system namespace: {name}"
            )
        
        repo_name = f"job-manifests-{current_user.tenant_id}"
        
        # Check if namespace exists and count jobs
        try:
            contents = await forgejo.get_repository_tree(
                owner="crontopus",
                repo=repo_name,
                path=name
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Namespace '{name}' not found"
            )
        
        # Count YAML files (jobs)
        yaml_files = [
            f for f in contents
            if f.get("type") == "file" and f["name"].endswith((".yaml", ".yml"))
        ]
        
        if yaml_files:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete namespace with {len(yaml_files)} jobs. Delete all jobs first."
            )
        
        # Delete .gitkeep file (which removes the empty directory)
        await forgejo.delete_file(
            owner="crontopus",
            repo=repo_name,
            file_path=f"{name}/.gitkeep",
            message=f"Delete namespace: {name}",
            author_name=current_user.username,
            author_email=current_user.email or f"{current_user.username}@crontopus.io"
        )
        
        logger.info(f"Deleted namespace {name} for tenant {current_user.tenant_id}")
        
        return {"message": f"Namespace '{name}' deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting namespace: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete namespace: {str(e)}"
        )
