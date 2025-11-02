# 🦑 Crontopus

**Crontopus** is a proprietary, API-first job scheduling and monitoring platform inspired by GitOps principles.  
It combines the simplicity of “ping-based” cron monitoring with the control of an optional signed agent that manages native OS schedulers.

---

## 🚀 Architecture Overview

Crontopus is built around **GitOps principles** with a clean separation of concerns:

### Job Definitions (Git)
- **Job Manifests** — YAML files in Git (Forgejo) define what jobs to run, when, and how
- **Version Control** — All changes tracked via Git commits, PRs, and reviews
- **Single Source of Truth** — Git is the authoritative source for job configurations
- **Repository**: https://git.crontopus.com/crontopus/job-manifests (private)
- **UI Management** — Users create/edit/delete jobs via UI, which commits to Git behind the scenes

### Runtime Components
- **Backend (FastAPI)** — REST API for authentication, run history, metrics, agent management, and job CRUD (commits to Git)
  - Production: https://crontopus.com/api
  - Job endpoints: POST/PUT/DELETE `/api/jobs` (commits YAML manifests to Forgejo)
- **Agent (Go)** — Pulls job manifests from Git, reconciles with native OS scheduler (cron/Task Scheduler). **Never executes jobs directly.**
- **CLI** — Wrapper for API calls (auth, viewing run history, agent management) and Git operations (viewing jobs)
- **Frontend (React)** — Web console for creating/editing/viewing jobs and run history
  - Production: https://crontopus.com
  - Jobs are managed via UI forms that commit to Git via backend API
- **Forgejo (Git)** — Self-hosted Git server for job manifests
  - Production: https://git.crontopus.com
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
- **GitOps Integration** — Sync job manifests and policies from Git **Forgejo**.  
- **API First Development** — UI and CLI both talk to the same REST endpoints.  
- **Alerts & Metrics** — Slack/email/PagerDuty notifications and Prometheus metrics.  
- **Multi-Tenant & Secure** — Isolated tenants; signed agent enrollment; no inbound ports required.

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

```bash
cd agent
go build -o build/crontopus-agent ./cmd/crontopus-agent

# Configure agent
cp config.example.yaml config.yaml
# Edit config.yaml with your settings

# Run agent
./build/crontopus-agent --config config.yaml
```

**Frontend Setup:**

```bash
cd frontend
npm install
npm run dev
```

Frontend will run at `http://localhost:5173`

### API Routing

**Important**: FastAPI adds trailing slashes to root routes!

- Backend routes are registered with prefix `/api`
- Jobs endpoints are special:
  - `GET /api/jobs/` - List jobs (note trailing slash)
  - `POST /api/jobs` - Create job (no trailing slash)
  - `PUT /api/jobs/{namespace}/{job_name}` - Update job
  - `DELETE /api/jobs/{namespace}/{job_name}` - Delete job

When calling APIs from frontend/CLI, match the exact path including trailing slashes.

### Deployment

See [infra/README.md](infra/README.md) for deployment instructions.

---

## 🪪 License

All rights reserved.  

Crontopus is proprietary software developed and owned by **[Your Company or Name]**.  
Unauthorized copying, distribution, modification, or hosting of this software, in whole or in part, is strictly prohibited without prior written permission.