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
from crontopus_api.models import Endpoint, EndpointStatus, User, JobInstance, JobInstanceStatus, JobInstanceSource
from crontopus_api.schemas.agent import (
    AgentEnroll,
    AgentEnrollResponse,
    AgentHeartbeat,
    AgentResponse,
    AgentListResponse
)
from crontopus_api.schemas.job_instance import (
    DiscoveredJobsRequest,
    DiscoveredJobsResponse,
    JobInstancesRequest,
    JobInstancesResponse,
    EndpointJobsResponse,
    JobInstanceResponse
)
from crontopus_api.security.dependencies import get_current_user
from crontopus_api.security.enrollment_auth import get_user_for_enrollment
from crontopus_api.security.password import get_password_hash

router = APIRouter(prefix="/endpoints", tags=["endpoints"])


@router.post("/enroll", response_model=AgentEnrollResponse, status_code=status.HTTP_201_CREATED)
async def enroll_endpoint(
    endpoint_data: AgentEnroll,
    current_user: User = Depends(get_user_for_enrollment),
    db: Session = Depends(get_db)
):
    """
    Enroll a new endpoint.
    
    Authentication:
    - Accepts enrollment tokens (cet_...) or JWT tokens
    - Enrollment tokens are long-lived and designed for agent deployment
    - JWT tokens are short-lived user session tokens
    
    If a machine_id is provided and an endpoint with that machine_id already
    exists for this tenant, it will be reactivated with a new token instead
    of creating a duplicate. This prevents duplicate endpoints when reinstalling
    on the same physical machine.
    
    Only authenticated users can enroll endpoints.
    """
    # Check if endpoint with same machine_id already exists
    existing_endpoint = None
    if endpoint_data.machine_id:
        existing_endpoint = db.query(Endpoint).filter(
            Endpoint.tenant_id == current_user.tenant_id,
            Endpoint.machine_id == endpoint_data.machine_id
        ).first()
    
    # Generate new token
    token = secrets.token_urlsafe(32)
    token_hash = get_password_hash(token)
    
    if existing_endpoint:
        # Reuse existing endpoint, update token and metadata
        existing_endpoint.name = endpoint_data.name
        existing_endpoint.hostname = endpoint_data.hostname
        existing_endpoint.platform = endpoint_data.platform
        existing_endpoint.version = endpoint_data.version
        existing_endpoint.git_repo_url = endpoint_data.git_repo_url
        existing_endpoint.git_branch = endpoint_data.git_branch
        existing_endpoint.token_hash = token_hash
        existing_endpoint.status = EndpointStatus.ACTIVE
        existing_endpoint.enrolled_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(existing_endpoint)
        
        return AgentEnrollResponse(
            agent_id=existing_endpoint.id,
            token=token
        )
    else:
        # Create new endpoint
        endpoint = Endpoint(
            tenant_id=current_user.tenant_id,
            name=endpoint_data.name,
            hostname=endpoint_data.hostname,
            machine_id=endpoint_data.machine_id,
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
            agent_id=endpoint.id,
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
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[DEBUG] list_endpoints called for tenant: {current_user.tenant_id}")
    logger.info(f"[DEBUG] Endpoint.__tablename__ = {Endpoint.__tablename__}")
    logger.info(f"[DEBUG] Endpoint.__table__.name = {Endpoint.__table__.name}")
    
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


@router.post("/{endpoint_id}/discovered-jobs", response_model=DiscoveredJobsResponse)
async def report_discovered_jobs(
    endpoint_id: int,
    discovered_jobs: DiscoveredJobsRequest,
    db: Session = Depends(get_db)
):
    """
    Report jobs discovered on an endpoint.
    
    Endpoint agents call this endpoint when they discover existing
    cron jobs or scheduled tasks. These jobs are imported to Git
    under the 'discovered' namespace.
    
    TODO: Actually create job manifests in Git for discovered jobs
    TODO: Add endpoint token authentication
    """
    # Verify endpoint exists
    endpoint = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Endpoint not found"
        )
    
    jobs_created = 0
    
    for job in discovered_jobs.jobs:
        # Check if job instance already exists for this endpoint
        existing = db.query(JobInstance).filter(
            JobInstance.endpoint_id == endpoint_id,
            JobInstance.job_name == job.name,
            JobInstance.namespace == job.namespace
        ).first()
        
        if not existing:
            # Create new job instance
            job_instance = JobInstance(
                tenant_id=endpoint.tenant_id,
                job_name=job.name,
                namespace=job.namespace,
                endpoint_id=endpoint_id,
                status=JobInstanceStatus.SCHEDULED,
                source=JobInstanceSource.DISCOVERED,
                original_command=job.command
            )
            db.add(job_instance)
            jobs_created += 1
        else:
            # Update existing instance
            existing.last_seen = datetime.now(timezone.utc)
            existing.original_command = job.command
    
    db.commit()
    
    # TODO: Create job manifests in Git for discovered jobs
    # This would involve:
    # 1. Generate YAML manifest from job data
    # 2. Commit to tenant's Git repo under discovered/ namespace
    # 3. Store Git commit hash for tracking
    
    return DiscoveredJobsResponse(
        message=f"Discovered {jobs_created} new jobs",
        jobs_created=jobs_created,
        endpoint_id=endpoint_id
    )


@router.post("/{endpoint_id}/job-instances", response_model=JobInstancesResponse)
async def report_job_instances(
    endpoint_id: int,
    instances_data: JobInstancesRequest,
    db: Session = Depends(get_db)
):
    """
    Report current job instances on an endpoint.
    
    Endpoint agents call this endpoint periodically (during sync) to report
    which jobs are currently scheduled. This enables tracking of:
    - Which endpoints are running which jobs
    - Job deployment status across infrastructure
    - Drift detection (jobs removed from endpoint)
    
    TODO: Add endpoint token authentication
    """
    # Verify endpoint exists
    endpoint = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Endpoint not found"
        )
    
    instances_updated = 0
    reported_job_ids = []
    
    for instance_report in instances_data.instances:
        # Find or create job instance
        job_instance = db.query(JobInstance).filter(
            JobInstance.endpoint_id == endpoint_id,
            JobInstance.job_name == instance_report.job_name,
            JobInstance.namespace == instance_report.namespace
        ).first()
        
        if job_instance:
            # Update existing instance
            job_instance.status = getattr(JobInstanceStatus, instance_report.status.upper())
            job_instance.last_seen = datetime.now(timezone.utc)
            if instance_report.original_command:
                job_instance.original_command = instance_report.original_command
            reported_job_ids.append(job_instance.id)
        else:
            # Create new instance
            job_instance = JobInstance(
                tenant_id=endpoint.tenant_id,
                job_name=instance_report.job_name,
                namespace=instance_report.namespace,
                endpoint_id=endpoint_id,
                status=getattr(JobInstanceStatus, instance_report.status.upper()),
                source=getattr(JobInstanceSource, instance_report.source.upper()),
                original_command=instance_report.original_command
            )
            db.add(job_instance)
        
        instances_updated += 1
    
    # Mark jobs not reported as potentially removed (optional drift detection)
    # This could be enabled via configuration
    # db.query(JobInstance).filter(
    #     JobInstance.endpoint_id == endpoint_id,
    #     JobInstance.id.notin_(reported_job_ids)
    # ).update({"status": JobInstanceStatus.ERROR})
    
    db.commit()
    
    return JobInstancesResponse(
        message=f"Updated {instances_updated} job instances",
        instances_updated=instances_updated,
        endpoint_id=endpoint_id
    )


@router.get("/{endpoint_id}/jobs", response_model=EndpointJobsResponse)
async def get_endpoint_jobs(
    endpoint_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all jobs running on a specific endpoint.
    
    Returns job instances with their current status.
    Enforces tenant isolation.
    """
    # Verify endpoint exists and belongs to tenant
    endpoint = db.query(Endpoint).filter(
        Endpoint.id == endpoint_id,
        Endpoint.tenant_id == current_user.tenant_id
    ).first()
    
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Endpoint not found"
        )
    
    # Get all job instances for this endpoint
    job_instances = db.query(JobInstance).filter(
        JobInstance.endpoint_id == endpoint_id
    ).all()
    
    return EndpointJobsResponse(
        endpoint_id=endpoint_id,
        jobs=job_instances,
        total=len(job_instances)
    )


@router.get("/install/script/{platform}")
async def get_install_script(
    platform: str,
    token: str = Query(..., description="Enrollment token (cet_...)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate a pre-configured install script for the current user.
    
    Platform can be: 'linux', 'macos', or 'windows'.
    Token: Enrollment token (cet_...) to embed in the script.
    
    The generated script includes:
    - User's enrollment token (passed as query parameter)
    - Tenant-specific Git repository URL
    - Username and tenant ID
    - Platform-specific installer that downloads and configures agent
    
    Security: The generated script contains sensitive credentials.
    Users should be warned not to share it.
    """
    settings = get_settings()
    
    # Validate that the provided token is an enrollment token
    if not token.startswith("cet_"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token format. Expected enrollment token (cet_...)"
        )
    
    # Verify token belongs to current user
    from crontopus_api.models.enrollment_token import EnrollmentToken
    enrollment_token_record = db.query(EnrollmentToken).filter(
        EnrollmentToken.token_hash == EnrollmentToken.hash_token(token),
        EnrollmentToken.tenant_id == current_user.tenant_id
    ).first()
    
    if not enrollment_token_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment token not found or does not belong to your account"
        )
    
    if not enrollment_token_record.is_valid():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enrollment token is expired or usage limit exceeded"
        )
    
    # User's enrollment token (from query parameter)
    enrollment_token = token
    
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
echo "[4/4] Installing as system service..."
echo ""

if [ "$OS" = "darwin" ]; then
    # macOS (launchd)
    echo "Setting up launchd service..."
    mkdir -p ~/Library/LaunchAgents
    
    # Create launchd plist
    cat > ~/Library/LaunchAgents/com.crontopus.agent.plist << 'PLIST_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.crontopus.agent</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/crontopus-agent</string>
        <string>--config</string>
        <string>${{HOME}}/.crontopus/config.yaml</string>
    </array>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>Crashed</key>
        <true/>
    </dict>
    
    <key>ThrottleInterval</key>
    <integer>30</integer>
    
    <key>WorkingDirectory</key>
    <string>${{HOME}}/.crontopus</string>
    
    <key>StandardOutPath</key>
    <string>${{HOME}}/.crontopus/agent.log</string>
    
    <key>StandardErrorPath</key>
    <string>${{HOME}}/.crontopus/agent.error.log</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>HOME</key>
        <string>${{HOME}}</string>
    </dict>
</dict>
</plist>
PLIST_EOF
    
    # Load the service
    launchctl unload ~/Library/LaunchAgents/com.crontopus.agent.plist 2>/dev/null || true
    launchctl load ~/Library/LaunchAgents/com.crontopus.agent.plist
    
    echo "✓ Agent installed as launchd service"
    echo "✓ Service will start automatically on login"
    echo ""
    echo "Service management:"
    echo "  Start:   launchctl start com.crontopus.agent"
    echo "  Stop:    launchctl stop com.crontopus.agent"
    echo "  Restart: launchctl unload ~/Library/LaunchAgents/com.crontopus.agent.plist && launchctl load ~/Library/LaunchAgents/com.crontopus.agent.plist"
    echo "  Logs:    tail -f ~/.crontopus/agent.log"
else
    # Linux (systemd)
    echo "Setting up systemd service..."
    
    # Create systemd unit file
    cat > /tmp/crontopus-agent.service << SYSTEMD_EOF
[Unit]
Description=Crontopus Agent
After=network.target

[Service]
Type=simple
User=${{USER}}
WorkingDirectory=${{HOME}}/.crontopus
ExecStart=/usr/local/bin/crontopus-agent --config ${{HOME}}/.crontopus/config.yaml
Restart=always
RestartSec=30
StandardOutput=append:${{HOME}}/.crontopus/agent.log
StandardError=append:${{HOME}}/.crontopus/agent.error.log

[Install]
WantedBy=multi-user.target
SYSTEMD_EOF
    
    # Install service
    sudo mv /tmp/crontopus-agent.service /etc/systemd/system/crontopus-agent.service
    sudo systemctl daemon-reload
    sudo systemctl enable crontopus-agent
    sudo systemctl start crontopus-agent
    
    echo "✓ Agent installed as systemd service"
    echo "✓ Service enabled and started"
    echo ""
    echo "Service management:"
    echo "  Status:  sudo systemctl status crontopus-agent"
    echo "  Stop:    sudo systemctl stop crontopus-agent"
    echo "  Restart: sudo systemctl restart crontopus-agent"
    echo "  Logs:    sudo journalctl -u crontopus-agent -f"
fi

echo ""
echo "===================================================="
echo "  Installation Complete!"
echo "===================================================="
echo ""
echo "Config: ~/.crontopus/config.yaml"
echo "Logs:   ~/.crontopus/agent.log"
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
Write-Host "[4/4] Installing as scheduled task..." -ForegroundColor Yellow
Write-Host ""

# Remove existing task if present
$TaskName = "CrontopusAgent"
try {{
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
}} catch {{}}

# Create scheduled task action
$Action = New-ScheduledTaskAction `
    -Execute "C:\\Program Files\\Crontopus\\crontopus-agent.exe" `
    -Argument "--config C:\\ProgramData\\Crontopus\\config.yaml" `
    -WorkingDirectory "C:\\ProgramData\\Crontopus"

# Create trigger (at system startup)
$Trigger = New-ScheduledTaskTrigger -AtStartup

# Create settings
$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Days 0) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

# Create principal (run as current user)
$Principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType S4U `
    -RunLevel Highest

# Register the task
try {{
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Trigger $Trigger `
        -Settings $Settings `
        -Principal $Principal `
        -Description "Crontopus Agent - Job scheduling and management" `
        -Force | Out-Null
    
    # Start the task immediately
    Start-ScheduledTask -TaskName $TaskName
    
    # Wait and verify
    Start-Sleep -Seconds 2
    $Task = Get-ScheduledTask -TaskName $TaskName
    
    if ($Task.State -eq "Running") {{
        Write-Host "✓ Agent installed as scheduled task" -ForegroundColor Green
        Write-Host "✓ Task started successfully" -ForegroundColor Green
        Write-Host "✓ Service will start automatically on system boot" -ForegroundColor Green
    }} else {{
        Write-Host "✗ Task created but not running. Check Task Scheduler." -ForegroundColor Yellow
    }}
}} catch {{
    Write-Host "✗ Failed to create scheduled task: $_" -ForegroundColor Red
    Write-Host "You can manually create it using Task Scheduler" -ForegroundColor Yellow
    exit 1
}}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  Installation Complete!" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Task management:"
Write-Host "  Status:  Get-ScheduledTask -TaskName CrontopusAgent | Select State"
Write-Host "  Start:   Start-ScheduledTask -TaskName CrontopusAgent"
Write-Host "  Stop:    Stop-ScheduledTask -TaskName CrontopusAgent"
Write-Host "  Remove:  Unregister-ScheduledTask -TaskName CrontopusAgent"
Write-Host ""
Write-Host "Config: C:\\ProgramData\\Crontopus\\config.yaml"
Write-Host "Logs:   C:\\ProgramData\\Crontopus\\agent.log"
Write-Host ""
Write-Host "Documentation: https://github.com/rave-altfred/crontopus/blob/main/agent/README.md"
Write-Host ""
"""
