# Crontopus Agent

The Crontopus Agent is a lightweight daemon that manages native OS schedulers (cron/Task Scheduler) based on job manifests stored in Git. It pulls job definitions from your tenant-specific repository and reconciles them with the local scheduler.

**Key Features:**
- 🔄 **GitOps-Based**: Jobs defined as YAML in Git, agent syncs and applies changes
- 🖥️ **Cross-Platform**: Supports Linux, macOS (cron), and Windows (Task Scheduler)
- 🔐 **Secure**: Enrollment-based authentication, encrypted token storage
- 🎯 **Reconciliation**: Continuous drift detection and correction
- 📡 **Heartbeat**: Regular check-ins with control plane for monitoring

**Important**: The agent does NOT execute jobs directly. It only manages scheduler entries. The OS scheduler executes jobs, which then check-in to the control plane.

---

## Quick Start

### Installation

**Linux/macOS:**
```bash
# Download and install (one-command installer - coming soon)
curl -fsSL https://get.crontopus.com/install.sh | bash

# Or download binary manually
wget https://github.com/crontopus/crontopus/releases/latest/download/crontopus-agent-linux-amd64
chmod +x crontopus-agent-linux-amd64
sudo mv crontopus-agent-linux-amd64 /usr/local/bin/crontopus-agent
```

**Windows:**
```powershell
# Download and install (PowerShell installer - coming soon)
iwr -useb https://get.crontopus.com/install.ps1 | iex

# Or download binary manually from GitHub releases
```

**From Source:**
```bash
cd agent
go build -o crontopus-agent ./cmd/crontopus-agent
```

### Configuration

1. **Get Enrollment Token:**
```bash
# Authenticate with Crontopus CLI
crontopus auth login

# Extract your enrollment token
cat ~/.crontopus/token | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])"
```

2. **Create Configuration File:**
```bash
# Copy example config
cp config.example.yaml config.yaml

# Edit with your settings
vim config.yaml
```

**Minimal Configuration:**
```yaml
agent:
  name: "my-server"           # Agent name (optional, auto-detected)
  hostname: "server-01"       # Hostname (optional, auto-detected)
  platform: "linux"           # linux, darwin, or windows
  version: "0.1.0"

backend:
  api_url: "https://crontopus.com"
  enrollment_token: "YOUR_TOKEN_HERE"

git:
  url: "https://git.crontopus.com/crontopus/job-manifests-{username}.git"
  branch: "main"
  sync_interval: 30  # seconds
  auth:
    type: "basic"     # basic, token, or ssh
    username: "your-username"
    password: "your-token-or-password"
  local_path: "~/.crontopus/job-manifests"
```

3. **Run Agent:**
```bash
# Run in foreground (for testing)
./crontopus-agent --config config.yaml

# Or install as system service (see Deployment section)
```

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                 Crontopus Agent                        │
│                                                        │
│  ┌──────────────┐    ┌─────────────┐   ┌──────────┐  │
│  │ Git Syncer   │───▶│ Manifest    │──▶│ Recon-   │  │
│  │              │    │ Parser      │   │ ciler    │  │
│  │ (30s poll)   │    │ (YAML)      │   │          │  │
│  └──────────────┘    └─────────────┘   └────┬─────┘  │
│                                               │        │
│  ┌──────────────┐                            ▼        │
│  │ Heartbeat    │               ┌─────────────────┐   │
│  │ (30s)        │               │ Scheduler       │   │
│  └──────┬───────┘               │ Abstraction     │   │
│         │                       └────────┬────────┘   │
└─────────┼──────────────────────────────┬─────────────┘
          │                               │
          ▼                               ▼
   ┌──────────────┐            ┌──────────────────┐
   │  Backend API │            │  OS Scheduler    │
   │  (crontopus) │            │  (cron/Task Sch) │
   └──────────────┘            └──────────────────┘
```

**Components:**

- **Git Syncer**: Clones/pulls job manifest repository on configurable interval
- **Manifest Parser**: Parses YAML files and validates against job-manifest-spec.md
- **Reconciler**: Compares desired state (Git) with current state (scheduler), applies diffs
- **Scheduler Abstraction**: Platform-specific adapters for cron/Task Scheduler
- **Heartbeat**: Reports agent health to backend every 30 seconds

---

## Platform Support

### Linux/macOS (Cron)

**Supported:**
- ✅ Standard cron (Vixie cron, cronie)
- ✅ macOS cron
- ✅ All standard cron expressions (5-field format)

**Implementation Details:**
- Jobs identified with marker: `# CRONTOPUS:job-name`
- Uses `crontab -l` to read, `crontab <file>` to write
- Atomic updates (temp file + install)
- Preserves non-Crontopus entries

**Cron Format:**
```
# ┌───────────── minute (0 - 59)
# │ ┌───────────── hour (0 - 23)
# │ │ ┌───────────── day of month (1 - 31)
# │ │ │ ┌───────────── month (1 - 12)
# │ │ │ │ ┌───────────── day of week (0 - 6) (Sunday=0)
# │ │ │ │ │
# * * * * * command
```

**Examples:**
- `0 * * * *` - Every hour
- `*/15 * * * *` - Every 15 minutes
- `0 2 * * *` - Daily at 2:00 AM
- `0 9-17 * * 1-5` - Hourly, 9 AM-5 PM, Monday-Friday

**Limitations:**
- No timezone support (uses system timezone)
- No seconds resolution (minimum 1 minute)
- No job dependencies

### Windows (Task Scheduler)

**Supported:**
- ✅ Windows 10/11
- ✅ Windows Server 2016+
- ✅ Task Scheduler 2.0 (Vista+)

**Implementation Details:**
- Tasks stored in `\Crontopus\` folder
- Uses `schtasks.exe` CLI
- Creates tasks via XML definition
- Simplified cron-to-trigger conversion

**Current Limitations:**
- ⚠️ **Basic cron conversion**: Only simple schedules supported initially
- ⚠️ **No complex expressions**: Ranges, steps, lists need enhancement
- ⚠️ Full Task Scheduler feature set not yet utilized

**Planned Enhancements:**
- Full cron expression support
- Multiple triggers per task
- Advanced scheduling (idle, on event)

---

## Configuration Reference

### Agent Section

```yaml
agent:
  name: "my-agent"                          # Agent identifier (auto-detected if omitted)
  hostname: "server-01"                     # Hostname (auto-detected if omitted)
  platform: "linux"                         # linux, darwin, or windows
  version: "0.1.0"                          # Agent version
  token_path: "~/.crontopus/agent-token"    # Path to store agent token
```

### Backend Section

```yaml
backend:
  api_url: "https://crontopus.com"          # Control plane API URL
  enrollment_token: "YOUR_TOKEN_HERE"       # User token from `crontopus auth login`
```

**Getting Enrollment Token:**
```bash
crontopus auth login
cat ~/.crontopus/token | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])"
```

### Git Section

```yaml
git:
  url: "https://git.crontopus.com/crontopus/job-manifests-{username}.git"
  branch: "main"                            # Git branch to sync (default: main)
  sync_interval: 30                         # Sync interval in seconds (default: 30)
  local_path: "~/.crontopus/job-manifests"  # Local clone path
  
  auth:
    type: "basic"                           # basic, token, or ssh
    
    # For basic/token auth:
    username: "your-username"
    password: "your-password-or-token"
    
    # For SSH auth:
    # type: "ssh"
    # key_path: "~/.ssh/id_ed25519"
```

**Authentication Types:**

1. **Basic Auth** (username + password):
   ```yaml
   auth:
     type: "basic"
     username: "alice"
     password: "secret123"
   ```

2. **Token Auth** (username + personal access token):
   ```yaml
   auth:
     type: "token"
     username: "alice"
     password: "forgejo_token_xyz123"
   ```

3. **SSH Key**:
   ```yaml
   auth:
     type: "ssh"
     key_path: "~/.ssh/id_ed25519"
   ```

---

## Deployment

### Linux (systemd)

**Service File:** `/etc/systemd/system/crontopus-agent.service`

```ini
[Unit]
Description=Crontopus Agent
After=network.target

[Service]
Type=simple
User=crontopus
Group=crontopus
ExecStart=/usr/local/bin/crontopus-agent --config /etc/crontopus/config.yaml
Restart=always
RestartSec=10

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/lib/crontopus

[Install]
WantedBy=multi-user.target
```

**Setup:**
```bash
# Create user
sudo useradd -r -s /bin/false crontopus

# Create directories
sudo mkdir -p /etc/crontopus /var/lib/crontopus
sudo chown crontopus:crontopus /var/lib/crontopus

# Copy files
sudo cp crontopus-agent /usr/local/bin/
sudo cp config.yaml /etc/crontopus/

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable crontopus-agent
sudo systemctl start crontopus-agent

# Check status
sudo systemctl status crontopus-agent
sudo journalctl -u crontopus-agent -f
```

### macOS (launchd)

**Plist File:** `~/Library/LaunchAgents/com.crontopus.agent.plist`

```xml
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
        <string>/Users/USERNAME/.crontopus/config.yaml</string>
    </array>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>/Users/USERNAME/.crontopus/agent.log</string>
    
    <key>StandardErrorPath</key>
    <string>/Users/USERNAME/.crontopus/agent.error.log</string>
</dict>
</plist>
```

**Setup:**
```bash
# Copy files
cp crontopus-agent /usr/local/bin/
mkdir -p ~/.crontopus
cp config.yaml ~/.crontopus/

# Edit plist with your username
sed -i '' 's/USERNAME/'$(whoami)'/g' com.crontopus.agent.plist

# Install and start
cp com.crontopus.agent.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.crontopus.agent.plist

# Check status
launchctl list | grep crontopus
tail -f ~/.crontopus/agent.log
```

### Windows (Service)

**Coming Soon**: Native Windows Service implementation with automatic installation.

**Current Workaround:**
```powershell
# Run in background with Task Scheduler
schtasks /create /tn "Crontopus Agent" /tr "C:\Program Files\Crontopus\crontopus-agent.exe --config C:\ProgramData\Crontopus\config.yaml" /sc onstart /ru SYSTEM
```

---

## Troubleshooting

### Agent Fails to Enroll

**Symptom:** `Failed to enroll agent: unauthorized`

**Solutions:**
1. Verify enrollment token is correct:
   ```bash
   cat ~/.crontopus/token | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])"
   ```

2. Check backend connectivity:
   ```bash
   curl https://crontopus.com/health
   ```

3. Ensure you're authenticated with CLI:
   ```bash
   crontopus auth whoami
   ```

### Jobs Not Appearing in Scheduler

**Symptom:** Agent syncs Git but jobs don't show in `crontab -l` or Task Scheduler

**Solutions:**
1. Check job manifest is valid:
   ```bash
   cat ~/.crontopus/job-manifests/production/your-job.yaml
   ```

2. Verify job is enabled:
   ```yaml
   spec:
     enabled: true  # Must be true
     paused: false  # Must be false
   ```

3. Check agent logs for parsing errors:
   ```bash
   # Look for "Error parsing manifest" or "Reconciliation failed"
   ```

4. Verify scheduler permissions:
   ```bash
   # Linux/macOS: agent must run as user with crontab access
   # Windows: agent must have admin rights for Task Scheduler
   ```

### Git Sync Fails

**Symptom:** `Error syncing Git repository: authentication failed`

**Solutions:**
1. Test Git credentials manually:
   ```bash
   git clone https://username:token@git.crontopus.com/crontopus/job-manifests-username.git
   ```

2. For SSH auth, verify key permissions:
   ```bash
   chmod 600 ~/.ssh/id_ed25519
   ssh-add ~/.ssh/id_ed25519
   ```

3. Check repository URL is correct:
   ```yaml
   git:
     url: "https://git.crontopus.com/crontopus/job-manifests-{YOUR_USERNAME}.git"
   ```

### High CPU/Memory Usage

**Symptom:** Agent consuming excessive resources

**Solutions:**
1. Increase sync interval:
   ```yaml
   git:
     sync_interval: 300  # 5 minutes instead of 30 seconds
   ```

2. Check for large manifest repository:
   ```bash
   du -sh ~/.crontopus/job-manifests
   # If > 100 MB, consider splitting into multiple repos (future feature)
   ```

3. Profile agent (development build):
   ```bash
   go tool pprof http://localhost:6060/debug/pprof/heap
   ```

### Drift Detected Every Cycle

**Symptom:** Agent reports drift and reconciles on every sync

**Possible Causes:**
1. **External modifications**: Another process modifying crontab/Task Scheduler
2. **Format mismatch**: Scheduler output format differs from expected
3. **Timezone issues**: Schedule interpreted differently

**Solutions:**
1. Ensure no other tools modify scheduler
2. Check agent logs for specific job names with drift
3. Verify cron expressions are standard 5-field format

---

## Security Considerations

### Token Storage

- Agent tokens stored in `~/.crontopus/agent-token` (or configured path)
- File permissions: `0600` (owner read/write only)
- Token encrypted at rest (future enhancement)

### Git Credentials

- **Never commit passwords to Git repositories**
- Use personal access tokens with limited scope
- Prefer SSH keys over HTTPS credentials
- Rotate tokens regularly

### Scheduler Access

- Linux/macOS: Agent runs as user with crontab access (no root required)
- Windows: Requires admin rights for Task Scheduler (can be scoped to `\Crontopus\` folder)

### Network Security

- Agent initiates all connections (no inbound ports)
- HTTPS/TLS for all backend API calls
- Git over HTTPS or SSH (not plain HTTP)

---

## Monitoring

### Agent Status

Check agent status via CLI:
```bash
crontopus agents list
crontopus agents show <agent-id>
```

### Logs

**Linux (systemd):**
```bash
sudo journalctl -u crontopus-agent -f
```

**macOS (launchd):**
```bash
tail -f ~/.crontopus/agent.log
```

**Windows:**
```powershell
Get-Content -Path "C:\ProgramData\Crontopus\agent.log" -Wait
```

### Metrics (Future)

Prometheus metrics endpoint (Phase 9.6):
```bash
curl http://localhost:9090/metrics
```

---

## FAQ

**Q: Does the agent execute jobs?**  
A: No. The agent only manages scheduler entries. The OS scheduler (cron/Task Scheduler) executes jobs.

**Q: What happens if the agent crashes?**  
A: Scheduled jobs continue running (managed by OS scheduler). Agent resumes on restart.

**Q: Can I run multiple agents on one machine?**  
A: Yes, but they must have different names and token files. Not recommended (use one agent per machine).

**Q: How do I update job schedules?**  
A: Edit YAML in Git, commit, push. Agent syncs automatically (default: 30 seconds).

**Q: Can the agent manage non-Crontopus jobs?**  
A: No. The agent only manages jobs with the `# CRONTOPUS:` marker. Other crontab entries are preserved.

**Q: What Git providers are supported?**  
A: Any Git server with HTTPS/SSH access (Forgejo, GitHub, GitLab, Bitbucket, etc.).

---

## Development

### Building from Source

```bash
cd agent
go build -o crontopus-agent ./cmd/crontopus-agent
```

### Running Tests

```bash
go test ./pkg/scheduler/...
```

### Testing with Local Backend

```bash
# Start backend
cd backend
uvicorn crontopus_api.main:app --reload

# Configure agent for localhost
cat > config.yaml <<EOF
backend:
  api_url: "http://localhost:8000"
  enrollment_token: "YOUR_DEV_TOKEN"
# ... rest of config
EOF

# Run agent
./crontopus-agent --config config.yaml
```

---

## Support

- **Documentation**: https://docs.crontopus.com
- **Issues**: https://github.com/crontopus/crontopus/issues
- **Discussions**: https://github.com/crontopus/crontopus/discussions

---

## License

Proprietary. All rights reserved.
