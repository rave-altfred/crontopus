# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Architecture Overview

Crontopus is a **monorepo** for an API-first job scheduling and monitoring platform with multiple independent components:

- **backend/** — FastAPI application serving the core REST API
  - Structure: `crontopus_api/` with routes, models, schemas, services, security, utils, workers
  - Database migrations in `migrations/`
  
- **agent/** — Go service that manages native OS schedulers (cron/Task Scheduler)
  - Entry point: `cmd/crontopus-agent/main.go`
  - Packages: `pkg/scheduler`, `pkg/security`, `pkg/sync`, `pkg/runner`, `pkg/utils`
  - **Critical**: The agent does NOT execute jobs; it only creates/updates/removes scheduler entries. The OS scheduler executes jobs, which then check-in to the control plane.
  
- **cli/** — Python CLI that wraps the backend API
  - Entry point: `main.py`
  - Commands: `commands/jobs.py`, `commands/agents.py`, `commands/auth.py`, `commands/logs.py`, `commands/tenants.py`
  - Core modules: `core/api_client.py`, `core/auth.py`, `core/config.py`, `core/formatter.py`
  
- **frontend/** — React/TypeScript web console
  - Structure: `src/` with pages, components, api, hooks, store, styles
  
- **internal_admin/** — Private operator dashboard
  - Separate API (`api/`) and web interface (`web/`)
  - Background workers (`workers/`)

## Key Design Principles

1. **GitOps-First**: Job definitions live in Git (Forgejo) as YAML manifests, NOT in database
2. **Agent as Reconciler**: Agent pulls from Git and manages scheduler state, does NOT execute jobs
3. **Ping-Based Check-ins**: Jobs report results via HTTP POST to control plane
4. **Multi-Tenant**: Isolated tenant data and policies
5. **Database for Runtime Only**: Database stores users, tenants, run history, metrics - NOT job definitions

## Component Relationships

```
   ┌────────────────────────────┐
   │   Git (Forgejo)            │
   │   Job Manifests (YAML)     │
   │   - production/            │
   │   - staging/               │
   └──────────────┤──────────────┘
                        │ git pull
                        ▼
 ┌─────────────┐   ┌──────────────┐   ┌─────────────┐
 │   CLI       │──▶│   Backend    │◀──│   Agent     │
 │   (Py)      │   │   (FastAPI)  │   │   (Go)      │
 └─────────────┘   └──────────────┘   └───────┤──────┘
       │                  ▲                        │
       │                  │                        │
       ▼                  │                        ▼
 ┌─────────────┐        │            ┌──────────────┐
 │  Frontend   │────────┘            │ OS Scheduler │
 │  (React)    │                         │ (cron/Task)  │
 └─────────────┘                         └──────────────┘

Key:
- Agent pulls job manifests from Git (NOT from Backend API)
- Backend stores run history, metrics, auth (NOT job definitions)
- CLI/Frontend read jobs from Git via Forgejo API
```

## Development Commands

**Note**: This project is currently in early scaffolding phase. Many build/test commands need to be defined.

### Backend (FastAPI)
```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -e .

# Run migrations
alembic upgrade head

# Run development server
uvicorn crontopus_api.main:app --reload
```

### Agent (Go)
```bash
cd agent

# Build the agent
go build -o build/crontopus-agent ./cmd/crontopus-agent

# Run the agent (requires enrollment token)
./build/crontopus-agent --config /path/to/config.yaml
```

### CLI (Python)
```bash
cd cli

# Create virtual environment
python3 -m venv venv

# Install CLI in development mode
./venv/bin/pip install -e .

# Run CLI
./venv/bin/python main.py --help
./venv/bin/python main.py auth login
./venv/bin/python main.py auth whoami

# Available commands (as of Phase 2.1):
# - auth login    : Authenticate and save token
# - auth logout   : Clear saved token
# - auth whoami   : Show current user

# Coming in Phase 2.2:
# - runs list     : Show job run history
# - runs show     : Show specific run details
```

### Frontend (React)
```bash
cd frontend

# Install dependencies (check for package.json)
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

### Internal Admin
```bash
cd internal_admin

# Commands TBD - check for package.json or requirements file
```

## Important Implementation Notes

### Agent Behavior
- **NEVER implement job execution in the agent**
- Agent only performs CRUD operations on OS scheduler entries
- Agent verifies scheduler entries match desired state (reconciliation loop)
- Jobs themselves must include check-in logic (`curl` to backend API endpoint)

### API Structure
When adding new endpoints to backend:
- Routes go in `backend/crontopus_api/routes/`
- Models (DB tables) go in `backend/crontopus_api/models/`
- Pydantic schemas go in `backend/crontopus_api/schemas/`
- Business logic goes in `backend/crontopus_api/services/`
- Background tasks go in `backend/crontopus_api/workers/`

### CLI Development
- CLI is a thin wrapper around API endpoints
- All logic should live in the backend API
- Use `core/api_client.py` for HTTP calls
- Use `core/formatter.py` for consistent output formatting

### Multi-Tenancy
- All API endpoints must enforce tenant isolation
- Agent enrollment must be tenant-specific
- Frontend must show only tenant-scoped data

## Documentation

See `docs/` directory for detailed specifications:
- `architecture.md` — System design and component interactions
- `api-reference.md` — REST API endpoint documentation
- `agent-protocol.md` — Agent-to-control-plane communication protocol
- `cli-reference.md` — CLI command reference
- `deployment.md` — Production deployment guide
- `roadmap.md` — Feature roadmap

## Configuration & Infrastructure

- `infra/` — Deployment configurations for all services
  - `infra/app-platform/` — Backend + Frontend (App Platform)
    - `deploy-app-platform.sh` — Automated deployment script
    - `app.yaml` — App Platform specification (gitignored)
  - `infra/forgejo/` — Git server (Droplet)
    - `create-droplet.sh` — Create droplet
    - `deploy.sh` — Deploy Forgejo with SSL
    - `docker-compose.yml` — Forgejo + PostgreSQL + Nginx
  - `infra/docker/` — Local development Docker configs
- `examples/job-manifests/` — Example job manifest repository
- Root-level `docker-compose.yml` — Local dev orchestration

## Production Deployment

**Services:**
- Backend + Frontend: https://crontopus.com (App Platform)
- Git Server: https://git.crontopus.com (Droplet)
- Job Manifests: https://git.crontopus.com/crontopus/job-manifests

**Deployment Commands:**

```bash
# Deploy backend + frontend (with automatic migrations)
cd infra/app-platform
./deploy-app-platform.sh

# Update app spec only (without rebuilding images)
doctl apps update 934e7b77-38da-49bb-bfcf-0ab6d7b8fa2f --spec app.yaml
doctl apps create-deployment 934e7b77-38da-49bb-bfcf-0ab6d7b8fa2f --wait

# Deploy/update Forgejo
cd infra/forgejo
./deploy.sh 207.154.244.141
```

**Important Notes:**
- Database migrations run automatically on backend startup via `start.sh`
- CORS is configured at App Platform level using service-level `routes` (not `ingress`)
- Frontend API URL is set at build time via `VITE_API_URL` build arg in Dockerfile
