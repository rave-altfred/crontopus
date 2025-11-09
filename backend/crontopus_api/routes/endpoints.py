"""
Endpoint management routes.

Handles endpoint enrollment, heartbeat, and lifecycle management.

Terminology:
- Agent = Binary software (crontopus-agent)
- Endpoint = Machine running an agent instance
"""
import secrets
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from crontopus_api.config import get_db, get_settings
from crontopus_api.models import Endpoint, EndpointStatus, User
from crontopus_api.schemas.agent import (
    AgentEnroll,
    AgentEnrollResponse,
    AgentHeartbeat,
    AgentResponse,
    AgentListResponse
)
from crontopus_api.security.dependencies import get_current_user
from crontopus_api.security.password import get_password_hash

router = APIRouter(prefix="/endpoints", tags=["endpoints"])


@router.post("/enroll", response_model=AgentEnrollResponse, status_code=status.HTTP_201_CREATED)
async def enroll_endpoint(
    endpoint_data: AgentEnroll,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Enroll a new endpoint.
    
    Creates a new endpoint and returns an authentication token.
    Only authenticated users can enroll endpoints.
    """
    # Generate endpoint token
    token = secrets.token_urlsafe(32)
    token_hash = get_password_hash(token)
    
    # Create endpoint
    endpoint = Endpoint(
        tenant_id=current_user.tenant_id,
        name=endpoint_data.name,
        hostname=endpoint_data.hostname,
        platform=endpoint_data.platform,
        version=endpoint_data.version,
        git_repo_url=endpoint_data.git_repo_url,
        git_branch=endpoint_data.git_branch,
        token_hash=token_hash,
        status=EndpointStatus.ACTIVE
    )
    
    db.add(endpoint)
    db.commit()
    db.refresh(endpoint)
    
    return AgentEnrollResponse(
        agent_id=endpoint.id,  # Keep field name for backward compatibility
        token=token
    )


@router.get("", response_model=AgentListResponse)
async def list_endpoints(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    status_filter: Optional[EndpointStatus] = Query(None, alias="status", description="Filter by status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all endpoints for the current tenant.
    
    Supports pagination and filtering by status.
    """
    # Base query with tenant isolation
    query = db.query(Endpoint).filter(Endpoint.tenant_id == current_user.tenant_id)
    
    # Apply status filter
    if status_filter:
        query = query.filter(Endpoint.status == status_filter)
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * page_size
    endpoints = query.order_by(Endpoint.enrolled_at.desc()).offset(offset).limit(page_size).all()
    
    return AgentListResponse(
        agents=endpoints,  # Keep field name for backward compatibility
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{endpoint_id}", response_model=AgentResponse)
async def get_endpoint(
    endpoint_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get details of a specific endpoint.
    
    Enforces tenant isolation.
    """
    endpoint = db.query(Endpoint).filter(
        Endpoint.id == endpoint_id,
        Endpoint.tenant_id == current_user.tenant_id
    ).first()
    
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Endpoint not found"
        )
    
    return endpoint


@router.post("/{endpoint_id}/heartbeat", status_code=status.HTTP_200_OK)
async def endpoint_heartbeat(
    endpoint_id: int,
    heartbeat_data: AgentHeartbeat,
    db: Session = Depends(get_db)
):
    """
    Record endpoint heartbeat.
    
    Endpoints call this endpoint periodically to report they are alive.
    TODO: Add endpoint token authentication
    """
    endpoint = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Endpoint not found"
        )
    
    # Update last heartbeat
    endpoint.last_heartbeat = datetime.now(timezone.utc)
    
    # Update status if provided
    if heartbeat_data.status:
        endpoint.status = heartbeat_data.status
    
    # Update platform/version if provided
    if heartbeat_data.platform:
        endpoint.platform = heartbeat_data.platform
    if heartbeat_data.version:
        endpoint.version = heartbeat_data.version
    
    db.commit()
    
    return {"message": "Heartbeat recorded", "endpoint_id": endpoint_id}


@router.delete("/{endpoint_id}", status_code=status.HTTP_200_OK)
async def revoke_endpoint(
    endpoint_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Revoke an endpoint.
    
    Marks the endpoint as revoked, preventing further API calls.
    """
    endpoint = db.query(Endpoint).filter(
        Endpoint.id == endpoint_id,
        Endpoint.tenant_id == current_user.tenant_id
    ).first()
    
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Endpoint not found"
        )
    
    endpoint.status = EndpointStatus.REVOKED
    db.commit()
    
    return {"message": "Endpoint revoked", "endpoint_id": endpoint_id}


@router.get("/install/script/{platform}")
async def get_install_script(
    platform: str,
    current_user: User = Depends(get_current_user)
):
    """
    Generate a pre-configured install script for the current user.
    
    Platform can be: 'linux', 'macos', or 'windows'.
    
    The generated script includes:
    - User's enrollment token (current access token)
    - Tenant-specific Git repository URL
    - Username and tenant ID
    - Platform-specific installer that downloads and configures agent
    
    Security: The generated script contains sensitive credentials.
    Users should be warned not to share it.
    """
    settings = get_settings()
    
    # User's enrollment token (using their current access token)
    enrollment_token = current_user.username  # TODO: Use actual token from auth context
    
    # Tenant-specific Git repository URL
    git_repo_url = f"https://git.crontopus.com/crontopus/job-manifests-{current_user.username}.git"
    
    if platform in ['linux', 'macos']:
        script_content = _generate_bash_installer(
            enrollment_token=enrollment_token,
            git_repo_url=git_repo_url,
            username=current_user.username,
            tenant_id=current_user.tenant_id,
            api_url=settings.api_url or "https://crontopus.com"
        )
        media_type = "text/x-shellscript"
        filename = "install-crontopus-agent.sh"
    
    elif platform == 'windows':
        script_content = _generate_powershell_installer(
            enrollment_token=enrollment_token,
            git_repo_url=git_repo_url,
            username=current_user.username,
            tenant_id=current_user.tenant_id,
            api_url=settings.api_url or "https://crontopus.com"
        )
        media_type = "text/plain"
        filename = "install-crontopus-agent.ps1"
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid platform: {platform}. Must be 'linux', 'macos', or 'windows'"
        )
    
    return Response(
        content=script_content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


def _generate_bash_installer(
    enrollment_token: str,
    git_repo_url: str,
    username: str,
    tenant_id: str,
    api_url: str
) -> str:
    """Generate pre-configured bash installer for Linux/macOS"""
    return f"""#!/bin/bash
# Crontopus Agent Pre-Configured Installer
# Generated for: {username}
# Tenant: {tenant_id}
# 
# WARNING: This script contains your credentials. Do not share it!

set -e

# Pre-configured values (DO NOT SHARE THIS SCRIPT)
ENROLLMENT_TOKEN="{enrollment_token}"
GIT_REPO_URL="{git_repo_url}"
USERNAME="{username}"
TENANT_ID="{tenant_id}"
API_URL="{api_url}"

echo "===================================================="
echo "  Crontopus Agent Installer"
echo "  User: {username}"
echo "===================================================="
echo ""

# Download and run generic installer
echo "[1/3] Downloading and installing agent binary..."
curl -fsSL https://raw.githubusercontent.com/rave-altfred/crontopus/main/agent/install.sh | bash

if [ $? -ne 0 ]; then
    echo "Error: Failed to install agent binary"
    exit 1
fi

echo ""
echo "[2/3] Creating configuration file..."

# Create config directory
mkdir -p ~/.crontopus

# Auto-detect platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
HOSTNAME=$(hostname)

# Generate config file with pre-configured values
cat > ~/.crontopus/config.yaml << EOF
agent:
  name: "${{HOSTNAME}}-agent"
  hostname: "${{HOSTNAME}}"
  platform: "${{OS}}"
  version: "0.1.0"
  token_path: "~/.crontopus/agent-token"

backend:
  api_url: "${{API_URL}}"
  enrollment_token: "${{ENROLLMENT_TOKEN}}"

git:
  url: "${{GIT_REPO_URL}}"
  branch: "main"
  sync_interval: 30
  auth:
    type: "basic"
    username: "${{USERNAME}}"
    password: "${{ENROLLMENT_TOKEN}}"
  local_path: "~/.crontopus/job-manifests"
EOF

echo "✓ Configuration created at ~/.crontopus/config.yaml"
echo ""
echo "[3/3] Verifying installation..."

# Verify agent binary
if command -v crontopus-agent >/dev/null 2>&1; then
    VERSION=$(crontopus-agent --version 2>/dev/null || echo "unknown")
    echo "✓ Agent installed: $VERSION"
else
    echo "✗ Agent binary not found in PATH"
    exit 1
fi

echo ""
echo "[4/4] Starting agent..."
echo ""

# Start agent in background
nohup crontopus-agent --config ~/.crontopus/config.yaml > ~/.crontopus/agent.log 2>&1 &
AGENT_PID=$!

# Wait a moment and check if it's still running
sleep 2
if ps -p $AGENT_PID > /dev/null; then
    echo "✓ Agent started successfully (PID: $AGENT_PID)"
    echo "✓ Logs: ~/.crontopus/agent.log"
else
    echo "✗ Agent failed to start. Check logs at ~/.crontopus/agent.log"
    exit 1
fi

echo ""
echo "===================================================="
echo "  Installation Complete!"
echo "===================================================="
echo ""
echo "Agent Status:"
echo "  PID: $AGENT_PID"
echo "  Config: ~/.crontopus/config.yaml"
echo "  Logs: ~/.crontopus/agent.log"
echo ""
echo "To stop the agent:"
echo "  kill $AGENT_PID"
echo ""
echo "To install as a system service (recommended):"
if [ "$OS" = "darwin" ]; then
    echo "  # macOS (launchd)"
    echo "  curl -fsSL https://raw.githubusercontent.com/rave-altfred/crontopus/main/agent/examples/com.crontopus.agent.plist -o ~/Library/LaunchAgents/com.crontopus.agent.plist"
    echo "  launchctl load ~/Library/LaunchAgents/com.crontopus.agent.plist"
else
    echo "  # Linux (systemd)"
    echo "  sudo curl -fsSL https://raw.githubusercontent.com/rave-altfred/crontopus/main/agent/examples/crontopus-agent.service -o /etc/systemd/system/crontopus-agent.service"
    echo "  sudo systemctl daemon-reload"
    echo "  sudo systemctl enable --now crontopus-agent"
fi
echo ""
echo "Documentation: https://github.com/rave-altfred/crontopus/blob/main/agent/README.md"
echo ""
"""


def _generate_powershell_installer(
    enrollment_token: str,
    git_repo_url: str,
    username: str,
    tenant_id: str,
    api_url: str
) -> str:
    """Generate pre-configured PowerShell installer for Windows"""
    return f"""# Crontopus Agent Pre-Configured Installer
# Generated for: {username}
# Tenant: {tenant_id}
#
# WARNING: This script contains your credentials. Do not share it!

$ErrorActionPreference = "Stop"

# Pre-configured values (DO NOT SHARE THIS SCRIPT)
$EnrollmentToken = "{enrollment_token}"
$GitRepoUrl = "{git_repo_url}"
$Username = "{username}"
$TenantId = "{tenant_id}"
$ApiUrl = "{api_url}"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  Crontopus Agent Installer" -ForegroundColor Cyan
Write-Host "  User: {username}" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Downloading and installing agent binary..." -ForegroundColor Yellow

try {{
    # Download and run generic installer
    iwr -useb https://raw.githubusercontent.com/rave-altfred/crontopus/main/agent/install.ps1 | iex
}} catch {{
    Write-Host "Error: Failed to install agent binary: $_" -ForegroundColor Red
    exit 1
}}

Write-Host ""
Write-Host "[2/3] Creating configuration file..." -ForegroundColor Yellow

# Create config directory
$ConfigDir = "C:\\ProgramData\\Crontopus"
if (-not (Test-Path $ConfigDir)) {{
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
}}

# Generate config file with pre-configured values
$ConfigContent = @"
agent:
  name: "$($env:COMPUTERNAME)-agent"
  hostname: "$($env:COMPUTERNAME)"
  platform: "windows"
  version: "0.1.0"
  token_path: "C:\\ProgramData\\Crontopus\\agent-token"

backend:
  api_url: "$ApiUrl"
  enrollment_token: "$EnrollmentToken"

git:
  url: "$GitRepoUrl"
  branch: "main"
  sync_interval: 30
  auth:
    type: "basic"
    username: "$Username"
    password: "$EnrollmentToken"
  local_path: "C:\\ProgramData\\Crontopus\\manifests"
"@

$ConfigContent | Out-File -FilePath "$ConfigDir\\config.yaml" -Encoding UTF8

Write-Host "✓ Configuration created at $ConfigDir\\config.yaml" -ForegroundColor Green
Write-Host ""
Write-Host "[3/3] Verifying installation..." -ForegroundColor Yellow

# Verify agent binary
if (Get-Command crontopus-agent.exe -ErrorAction SilentlyContinue) {{
    $Version = & crontopus-agent.exe --version 2>$null
    Write-Host "✓ Agent installed: $Version" -ForegroundColor Green
}} else {{
    Write-Host "✗ Agent binary not found in PATH" -ForegroundColor Red
    exit 1
}}

Write-Host ""
Write-Host "[4/4] Starting agent..." -ForegroundColor Yellow
Write-Host ""

# Start agent in background
try {{
    $AgentProcess = Start-Process -FilePath "crontopus-agent.exe" `
        -ArgumentList "--config", "C:\\ProgramData\\Crontopus\\config.yaml" `
        -NoNewWindow `
        -PassThru `
        -RedirectStandardOutput "C:\\ProgramData\\Crontopus\\agent.log" `
        -RedirectStandardError "C:\\ProgramData\\Crontopus\\agent-error.log"
    
    # Wait a moment and check if it's still running
    Start-Sleep -Seconds 2
    if ($AgentProcess.HasExited) {{
        Write-Host "✗ Agent failed to start. Check logs at C:\\ProgramData\\Crontopus\\agent-error.log" -ForegroundColor Red
        exit 1
    }} else {{
        Write-Host "✓ Agent started successfully (PID: $($AgentProcess.Id))" -ForegroundColor Green
        Write-Host "✓ Logs: C:\\ProgramData\\Crontopus\\agent.log" -ForegroundColor Green
    }}
}} catch {{
    Write-Host "✗ Failed to start agent: $_" -ForegroundColor Red
    exit 1
}}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  Installation Complete!" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Agent Status:"
Write-Host "  PID: $($AgentProcess.Id)"
Write-Host "  Config: C:\\ProgramData\\Crontopus\\config.yaml"
Write-Host "  Logs: C:\\ProgramData\\Crontopus\\agent.log"
Write-Host ""
Write-Host "To stop the agent:"
Write-Host "  Stop-Process -Id $($AgentProcess.Id)"
Write-Host ""
Write-Host "To install as a Windows Service (recommended):"
Write-Host "  See: https://github.com/rave-altfred/crontopus/blob/main/agent/examples/crontopus-agent-task.xml"
Write-Host ""
Write-Host "Documentation: https://github.com/rave-altfred/crontopus/blob/main/agent/README.md"
Write-Host ""
"""
