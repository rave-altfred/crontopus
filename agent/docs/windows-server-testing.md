# Windows Server Testing Guide

This guide covers end-to-end testing of the Crontopus Agent on Windows Server using DigitalOcean droplets.

## Why Windows Server?

Windows Server is **critical** for enterprise job scheduling. Many businesses run scheduled tasks on Windows Server for:
- Database backups (SQL Server)
- ETL/data processing jobs
- System maintenance scripts
- Application-specific automation
- Active Directory maintenance

## Test Infrastructure

### DigitalOcean Windows Server Droplet

**Cost**: ~$24/month (can destroy/recreate as needed for testing)

**Specs**:
- **OS**: Windows Server 2019 Datacenter or Windows Server 2022 Datacenter
- **Size**: Basic (2 vCPUs, 4GB RAM, 80GB SSD)
- **Region**: Choose closest to your location
- **Networking**: Add to same VPC as other Crontopus infrastructure (optional)

### Creating Test Droplet

```bash
# Using doctl CLI
doctl compute droplet create crontopus-test-windows \
  --image windows-2019-datacenter \
  --size s-2vcpu-4gb \
  --region nyc1 \
  --enable-private-networking \
  --wait

# Get droplet IP and initial password
doctl compute droplet get crontopus-test-windows --format ID,PublicIPv4
# Check email for initial Administrator password
```

### Accessing Windows Server

1. **Remote Desktop (RDP)**:
   ```bash
   # macOS
   open "rdp://Administrator@<DROPLET_IP>"
   
   # Linux
   rdesktop <DROPLET_IP>
   
   # Windows
   mstsc /v:<DROPLET_IP>
   ```

2. **Change Administrator Password** (first login)

3. **Enable PowerShell Remoting** (optional):
   ```powershell
   Enable-PSRemoting -Force
   Set-Item WSMan:\localhost\Client\TrustedHosts -Value "<DROPLET_IP>" -Force
   ```

---

## Test Environment Setup

### 1. Install Git

```powershell
# Using winget (Windows Package Manager)
winget install Git.Git

# Or download installer
Invoke-WebRequest -Uri "https://github.com/git-for-windows/git/releases/latest/download/Git-2.42.0-64-bit.exe" -OutFile "Git-Installer.exe"
Start-Process -FilePath ".\Git-Installer.exe" -ArgumentList "/VERYSILENT" -Wait
```

### 2. Install Go (for building from source)

```powershell
# Download Go
Invoke-WebRequest -Uri "https://go.dev/dl/go1.21.0.windows-amd64.msi" -OutFile "go-installer.msi"
Start-Process msiexec.exe -ArgumentList "/i go-installer.msi /quiet" -Wait

# Verify installation
go version
```

### 3. Clone Repository

```powershell
cd C:\
git clone https://github.com/YOUR_ORG/crontopus.git
cd crontopus\agent
```

### 4. Build Agent

```powershell
go build -o crontopus-agent.exe .\cmd\crontopus-agent
```

---

## Testing Scenarios

### Test 1: Basic Task Scheduler Integration

**Goal**: Verify agent can create, update, and remove tasks.

```powershell
# Create test config
@"
agent:
  name: "windows-test-agent"
  platform: "windows"
  version: "0.1.0"

backend:
  api_url: "https://crontopus.com"
  enrollment_token: "YOUR_TOKEN_HERE"

git:
  url: "https://git.crontopus.com/crontopus/job-manifests-USERNAME.git"
  branch: "main"
  sync_interval: 30
  auth:
    type: "basic"
    username: "USERNAME"
    password: "TOKEN_OR_PASSWORD"
  local_path: "C:\ProgramData\Crontopus\manifests"
"@ | Out-File -FilePath config.yaml -Encoding UTF8

# Run agent
.\crontopus-agent.exe --config config.yaml

# In another PowerShell window, verify tasks
schtasks /query /tn "\Crontopus\" /fo LIST /v
```

**Expected**: Tasks appear in `\Crontopus\` folder matching Git manifests.

### Test 2: Cron Expression Conversion

**Goal**: Test various cron schedules convert to Task Scheduler triggers.

**Test Cases**:
```yaml
# manifest-test-schedules.yaml
---
apiVersion: v1
kind: Job
metadata:
  name: test-hourly
spec:
  schedule: "0 * * * *"  # Every hour
  command: powershell.exe
  args: ["-Command", "Write-Host 'Hourly test'"]
---
apiVersion: v1
kind: Job
metadata:
  name: test-daily-2am
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  command: powershell.exe
  args: ["-Command", "Write-Host 'Daily test'"]
---
apiVersion: v1
kind: Job
metadata:
  name: test-every-15min
spec:
  schedule: "*/15 * * * *"  # Every 15 minutes
  command: powershell.exe
  args: ["-Command", "Write-Host '15min test'"]
```

**Verification**:
```powershell
# Export task XML and verify triggers
schtasks /query /tn "\Crontopus\test-hourly" /xml

# Check trigger schedule matches
Get-ScheduledTask -TaskPath "\Crontopus\" | Get-ScheduledTaskInfo
```

### Test 3: PowerShell Execution Context

**Goal**: Verify PowerShell scripts execute with correct policies and profiles.

```yaml
# manifest-powershell-test.yaml
apiVersion: v1
kind: Job
metadata:
  name: test-powershell-context
spec:
  schedule: "* * * * *"  # Every minute for testing
  command: powershell.exe
  args:
    - "-ExecutionPolicy"
    - "Bypass"
    - "-NoProfile"
    - "-Command"
    - "Get-Date | Out-File C:\ProgramData\Crontopus\test-output.txt -Append"
```

**Verification**:
```powershell
# Wait 2 minutes, then check output
Get-Content C:\ProgramData\Crontopus\test-output.txt

# Verify execution policy didn't block
Get-EventLog -LogName Application -Source "Task Scheduler" -Newest 10
```

### Test 4: Service Account Permissions

**Goal**: Test agent running as different service accounts.

```powershell
# Create dedicated service account
net user CrontopusAgent "ComplexP@ssw0rd!" /add
net localgroup Administrators CrontopusAgent /add

# Grant logon as service right
# Computer Configuration → Windows Settings → Security Settings → Local Policies → User Rights Assignment
# "Log on as a service" → Add CrontopusAgent

# Create scheduled task to run agent as service account
schtasks /create /tn "Crontopus Agent" /tr "C:\crontopus\agent\crontopus-agent.exe --config C:\ProgramData\Crontopus\config.yaml" /sc onstart /ru CrontopusAgent /rp "ComplexP@ssw0rd!" /rl highest
```

### Test 5: Event Log Integration

**Goal**: Verify task execution logs to Event Log.

```powershell
# After running tasks, check Event Logs
Get-WinEvent -LogName "Microsoft-Windows-TaskScheduler/Operational" -MaxEvents 20 | 
  Where-Object { $_.TaskCategory -eq "Task Scheduler launched task" } |
  Format-Table TimeCreated, Message -AutoSize

# Check for errors
Get-EventLog -LogName Application -Source "Task Scheduler" -EntryType Error -Newest 10
```

### Test 6: Long-Running Stability

**Goal**: Verify agent stability over 24+ hours.

```powershell
# Start agent in background
Start-Process -FilePath ".\crontopus-agent.exe" -ArgumentList "--config", "config.yaml" -WindowStyle Hidden

# Monitor memory/CPU usage
while ($true) {
    $proc = Get-Process crontopus-agent -ErrorAction SilentlyContinue
    if ($proc) {
        $mem = [math]::Round($proc.WorkingSet64 / 1MB, 2)
        $cpu = $proc.CPU
        Write-Host "$(Get-Date) - Memory: ${mem}MB, CPU: ${cpu}s"
    }
    Start-Sleep -Seconds 300  # Check every 5 minutes
}
```

### Test 7: Active Directory Domain Scenario

**Goal**: Test in domain-joined environment (optional, advanced).

**Prerequisites**:
- Domain controller available
- Test domain configured

```powershell
# Join domain
Add-Computer -DomainName "corp.example.com" -Credential (Get-Credential) -Restart

# After reboot, test with domain account
# Configure agent to run as domain service account
```

---

## Task Scheduler Specifics

### Inspecting Task XML

```powershell
# Export task definition
schtasks /query /tn "\Crontopus\job-name" /xml > task.xml

# Parse XML in PowerShell
[xml]$xml = Get-Content task.xml
$xml.Task.Triggers.CalendarTrigger
$xml.Task.Actions.Exec
```

### Common Task Scheduler Issues

**Issue**: Task doesn't run
```powershell
# Check task history
Get-ScheduledTask -TaskName "job-name" -TaskPath "\Crontopus\" | Get-ScheduledTaskInfo

# Enable history if disabled
wevtutil sl Microsoft-Windows-TaskScheduler/Operational /e:true
```

**Issue**: Task runs but fails
```powershell
# Check last run result code
schtasks /query /tn "\Crontopus\job-name" /v /fo LIST | Select-String "Last Result"

# Common codes:
# 0x0 - Success
# 0x1 - Incorrect function
# 0x41301 - Task is currently running
```

**Issue**: Permissions error
```powershell
# Run task manually as test
schtasks /run /tn "\Crontopus\job-name"

# Check effective permissions
icacls "C:\Windows\System32\Tasks\Crontopus"
```

---

## Performance Benchmarks

### Memory Usage

**Baseline**: Agent with 0 jobs
```powershell
Get-Process crontopus-agent | Select-Object WorkingSet64, PrivateMemorySize64
```

**Expected**: < 50 MB

### CPU Usage

**Baseline**: Agent with 10 jobs, 30s sync interval
```powershell
# Monitor for 5 minutes
$cpu = (Get-Counter '\Process(crontopus-agent)\% Processor Time' -SampleInterval 10 -MaxSamples 30).CounterSamples.CookedValue
$avgCpu = ($cpu | Measure-Object -Average).Average
Write-Host "Average CPU: $avgCpu%"
```

**Expected**: < 5% CPU average

### Reconciliation Speed

**Test**: Time to reconcile 100 jobs

```powershell
Measure-Command {
    # Trigger reconciliation by committing 100 new jobs to Git
    # Agent should sync and apply within sync_interval + reconcile_time
}
```

**Expected**: < 10 seconds for 100 jobs

---

## Cleanup

### Remove Test Tasks

```powershell
# List all Crontopus tasks
schtasks /query /tn "\Crontopus\" /fo LIST

# Delete all Crontopus tasks
Get-ScheduledTask -TaskPath "\Crontopus\" | Unregister-ScheduledTask -Confirm:$false
```

### Stop Agent

```powershell
Stop-Process -Name crontopus-agent -Force
```

### Destroy Droplet

```bash
doctl compute droplet delete crontopus-test-windows
```

---

## Automation Script

Complete automated test run:

```powershell
# run-windows-tests.ps1

# Build agent
go build -o crontopus-agent.exe .\cmd\crontopus-agent

# Run tests
Describe "Crontopus Agent Windows Tests" {
    It "Creates task successfully" {
        # Test implementation
    }
    
    It "Updates existing task" {
        # Test implementation
    }
    
    It "Removes task on manifest deletion" {
        # Test implementation
    }
    
    It "Handles invalid cron expressions" {
        # Test implementation
    }
}
```

---

## CI/CD Integration

### GitHub Actions (Limited)

```yaml
# .github/workflows/windows-test.yml
name: Windows Agent Tests

on: [push, pull_request]

jobs:
  test-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.21'
      
      - name: Build agent
        working-directory: agent
        run: go build -o crontopus-agent.exe .\cmd\crontopus-agent
      
      - name: Run unit tests
        working-directory: agent
        run: go test ./pkg/scheduler/...
```

**Limitation**: GitHub Actions Windows runners don't have full Task Scheduler admin rights for integration tests.

### Manual Testing Workflow

1. Create DigitalOcean Windows Server droplet
2. RDP into droplet
3. Clone repository
4. Run test script
5. Collect results
6. Destroy droplet

**Cost**: ~$0.03/hour = ~$0.50 for full test suite (< 1 hour)

---

## Reporting Issues

When reporting Windows-specific issues, include:

```powershell
# System information
systeminfo | findstr /B /C:"OS Name" /C:"OS Version"

# Task Scheduler version
schtasks /?

# PowerShell version
$PSVersionTable.PSVersion

# Task details
schtasks /query /tn "\Crontopus\job-name" /v /fo LIST

# Event log errors
Get-EventLog -LogName Application -Source "Task Scheduler" -EntryType Error -Newest 5 | Format-List
```

---

## Next Steps

After Windows Server testing:
1. Document any Windows-specific quirks in main README
2. Improve cron-to-trigger conversion logic
3. Add Windows Service implementation (Phase 9.4)
4. Create Windows installer (Phase 9.3)
5. Production Windows Server deployment guide
