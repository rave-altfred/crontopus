# 🦑 Crontopus

**Crontopus** is a proprietary, API-first job scheduling and monitoring platform inspired by GitOps principles.  
It combines the simplicity of "ping-based" cron monitoring with the control of an optional signed agent that manages native OS schedulers.

**Terminology**:
- **Agent** = Binary software (one per platform: Linux, macOS, Windows)
- **Endpoint** = Machine/server running an agent instance (many endpoints can run the same agent)
- **Enrollment Token** = Long-lived token for secure remote agent deployment
- **Machine ID** = Platform-specific unique identifier (prevents duplicate endpoints)
- **Git Token** = Forgejo access token for secure repository cloning (auto-created per user)
- **Job Definition** = YAML manifest in Git (desired state)
- **Job Instance** = Actual scheduled job on a specific endpoint (current state)

---

## 🚀 Architecture Overview

Crontopus is built around **GitOps principles** with a clean separation of concerns:

### Job Definitions (Git)
- **Job Manifests** — YAML files in Git (Forgejo) define what jobs to run, when, and how
- **Version Control** — All changes tracked via Git commits, PRs, and reviews
- **Single Source of Truth** — Git is the authoritative source for job configurations
- **Tenant-Specific Repositories** — Each tenant has a private repository: `crontopus/job-manifests-{username}`
  - Automatically created during user registration
  - Complete isolation between tenants
  - Example: User "alice" gets repository `crontopus/job-manifests-alice`
- **UI Management** — Users create/edit/delete jobs via UI, which commits to Git behind the scenes

### Runtime Components
- **Backend (FastAPI)** — REST API for authentication, run history, metrics, agent management, and job CRUD (commits to Git)
  - Production: https://crontopus.com/api
  - Job endpoints: POST/PUT/DELETE `/api/jobs` (commits YAML manifests to tenant-specific Forgejo repos)
  - Automatic Git repository creation for new tenants
- **Agent (Go)** — Pulls job manifests from tenant's Git repository, reconciles with native OS scheduler (cron/Task Scheduler). **Never executes jobs directly.**
- **CLI** — Wrapper for API calls (auth, viewing run history, agent management) and Git operations (viewing jobs)
- **Frontend (React)** — Web console for creating/editing/viewing jobs and run history
  - Production: https://crontopus.com
  - Jobs are managed via UI forms that commit to Git via backend API
  - Full CRUD interface: create, edit, delete jobs with real-time Git sync
- **Forgejo (Git)** — Self-hosted Git server for job manifests
  - Production: https://git.crontopus.com
  - Tenant-specific private repositories (auto-created)
- **Internal Admin** — Private dashboard for operators (tenants, plans, system health) [Planned]
- **Infra** — Deployment scripts and configurations for all services

---

## 🧱 Folder Structure

```
crontopus/
├── backend/          # FastAPI backend (core API)
├── frontend/         # React/Tailwind web console
├── cli/              # Python CLI (API wrapper)
├── agent/            # Go agent (manages native schedulers)
├── internal_admin/   # Internal admin dashboard [Planned]
├── infra/            # Deployment configurations
│   ├── app-platform/ # Backend + Frontend deployment
│   ├── forgejo/      # Git server deployment
│   └── docker/       # Local development
├── examples/         # Example job manifests
└── docs/             # Architecture, API, and deployment guides
```

---

## 🧩 Key Features

- **Ping Mode (Agent Optional)** — Any existing scheduler (cron, Jenkins, Windows Task Scheduler, Kubernetes CronJob, etc.) includes a simple HTTP **check-in** to report run results directly to Crontopus.  
- **Agent Mode (Native Scheduler Management)** — Install a signed agent to **apply and reconcile job definitions** on the local OS scheduler (create/update/remove, enable/disable), handle token rotation, and enforce schedule/policy constraints. **The agent never executes jobs.**  
- **Zero-Configuration Deployment** — Download pre-configured installers from webapp with embedded credentials - run one command and agent is ready!  
  - Long-lived enrollment tokens (no JWT expiration issues)
  - Automatic Git authentication with Forgejo access tokens
  - Automatic system service installation (launchd/systemd/Task Scheduler)
  - Agent starts immediately and survives reboots
- **Smart Deduplication** — Machine ID-based endpoint detection prevents duplicate entries on reinstallation. Reinstall on the same machine reuses existing endpoint.
- **Secure Git Access** — Automatic Forgejo user and access token creation on registration. Agents authenticate using per-user tokens (follows industry standards).
- **Bidirectional Sync** — Agent reconciles between Git (desired state) and scheduler (current state). Discovers existing cron jobs and imports them to Git automatically.
- **Automatic Callback Injection** — Agent wraps all job commands with check-in callbacks using an elegant helper script (`~/.crontopus/bin/checkin`). Jobs automatically report success/failure without manual instrumentation. Crontab entries remain clean and readable.
- **Multi-Endpoint Management** — Track which jobs are running on which machines (endpoints). View job-to-endpoint and endpoint-to-job relationships in web UI. Database-level protection prevents duplicate job assignments on same endpoint.
- **Rate Limiting & DDoS Protection** ⚠️ — Infrastructure in place with SlowAPI and Redis/Valkey backend. Per-endpoint rate limits configured (login 5/min, check-ins 100/min, API 60/min). Temporarily disabled due to async compatibility issue - awaiting fastapi-limiter migration.
- **GitOps Integration** — Sync job manifests and policies from tenant-specific Git repositories in **Forgejo**.  
- **API First Development** — UI and CLI both talk to the same REST endpoints.  
- **Alerts & Metrics** — Slack/email/PagerDuty notifications and Prometheus metrics.  
- **Multi-Tenant & Secure** — Complete tenant isolation with private Git repositories; enrollment token-based agent deployment; no inbound ports required.

---

## 🧠 API-First Philosophy

All functionality is exposed via the REST API first; both the CLI and Web Console consume the same endpoints.  
This ensures:
- **Consistency** across interfaces  
- **Extensibility** for future SDKs/integrations  
- **Automation-friendly** design for DevOps teams  

---

## 🚀 Quick Start

### Production Services

- **Web Console**: https://crontopus.com
- **API**: https://crontopus.com/api
- **Git Server**: https://git.crontopus.com
- **Job Manifests**: https://git.crontopus.com/crontopus/job-manifests

### Local Development

**Prerequisites:**

```bash
# PostgreSQL (for database)
brew install postgresql@14
brew services start postgresql@14
psql postgres
CREATE DATABASE crontopus;
CREATE USER crontopus WITH PASSWORD 'crontopus';
GRANT ALL PRIVILEGES ON DATABASE crontopus TO crontopus;
\q

# Redis (for rate limiting in development)
brew install redis
brew services start redis
redis-cli ping  # Should return: PONG
```

**Backend Setup:**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -e .
alembic upgrade head
uvicorn crontopus_api.main:app --reload
```

Backend will run at `http://localhost:8000`

**CLI Setup:**

```bash
cd cli
python3 -m venv venv
./venv/bin/pip install -e .

# Authenticate
./venv/bin/python main.py auth login

# View runs
./venv/bin/python main.py runs list

# Manage agents
./venv/bin/python main.py agents list
```

**Agent Setup:**

**Recommended: Zero-Configuration Install** (from webapp):
1. Login to https://crontopus.com
2. Navigate to "Download Agent" page
3. Select your platform (Linux/macOS/Windows)
4. Download and run the pre-configured installer
5. Agent automatically installs, configures, and starts running!

**Manual Installation:**
```bash
# Linux/macOS
curl -fsSL https://raw.githubusercontent.com/rave-altfred/crontopus/main/agent/install.sh | bash

# Windows (PowerShell)
iwr -useb https://raw.githubusercontent.com/rave-altfred/crontopus/main/agent/install.ps1 | iex

# Or build from source
cd agent
go build -o build/crontopus-agent ./cmd/crontopus-agent
./build/crontopus-agent --config config.yaml
```

**See [agent/README.md](agent/README.md) for comprehensive installation, configuration, and deployment guide.**

**Platform Support:**
- ✅ Linux (Ubuntu, Debian, RHEL, Alpine) with cron
- ✅ macOS with cron
- ✅ **Windows Server 2019/2022** (enterprise focus)
- ✅ Windows 10/11 Pro/Enterprise

**Testing:** Windows Server testing guide available at [agent/docs/windows-server-testing.md](agent/docs/windows-server-testing.md)

**Frontend Setup:**

```bash
cd frontend
npm install
npm run dev
```

Frontend will run at `http://localhost:5173`

**Tech Stack:**
- React 19 + TypeScript + Vite
- Tailwind CSS v4 with Dracula theme dark mode
- lucide-react for icons
- react-syntax-highlighter for code display
- Custom PCB-inspired ASCII art logo

### API Routing

**Important**: FastAPI adds trailing slashes to root routes!

- Backend routes are registered with prefix `/api`
- Jobs endpoints are special:
  - `GET /api/jobs/` - List jobs (note trailing slash)
  - `POST /api/jobs` - Create job (no trailing slash)
  - `PUT /api/jobs/{namespace}/{job_name}` - Update job
  - `DELETE /api/jobs/{namespace}/{job_name}` - Delete job

When calling APIs from frontend/CLI, match the exact path including trailing slashes.

**Response Structures**:
- `/api/runs` returns `{runs: [], total, page, page_size}` - extract `response.data.runs`
- `/api/agents` returns `{agents: [], total, page, page_size}` - extract `response.data.agents`
- `/api/jobs/` returns `{jobs: [], count, source, repository}` - extract `response.data.jobs`

### Deployment

See [infra/README.md](infra/README.md) for deployment instructions.

---

## 🪪 License

All rights reserved.  

Crontopus is proprietary software developed and owned by **[Your Company or Name]**.  
Unauthorized copying, distribution, modification, or hosting of this software, in whole or in part, is strictly prohibited without prior written permission.