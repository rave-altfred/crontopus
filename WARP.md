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
   - Users create/edit/delete jobs via UI, which commits to Git via backend API
   - Git remains single source of truth
   - Each tenant has a private repository: `crontopus/job-manifests-{tenant_id}`
2. **Agent as Reconciler**: Agent pulls from tenant's Git repo and manages scheduler state, does NOT execute jobs
3. **Ping-Based Check-ins**: Jobs report results via HTTP POST to control plane
4. **Multi-Tenant**: Complete isolation with tenant-specific Git repositories
   - One tenant per user (`tenant_id = username`)
   - Repositories auto-created during registration
   - All job operations scoped to tenant's repository
5. **Database for Runtime Only**: Database stores users, tenants, run history, metrics - NOT job definitions

## Component Relationships

```
   ┌────────────────────────────┐
   │   Git (Forgejo)            │
   │   Job Manifests (YAML)     │
   │   - production/            │
   │   - staging/               │
   └──────────────┤──────────────┘
                        │ git pull      ▲ git commit
                        ▼                       │
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
- Backend commits job changes to Git when users create/edit/delete via UI
- Backend stores run history, metrics, auth (NOT job definitions)
- CLI/Frontend read jobs from Git via Forgejo API
- CLI/Frontend write jobs via Backend API → Git
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
- Pydantic schemas go in `backend/crontopus_api/schemas/` or inline in routes for simple cases
- Business logic goes in `backend/crontopus_api/services/`
- Background tasks go in `backend/crontopus_api/workers/`

### API Routing (FastAPI)

**Router Prefix Composition:**
- All routers are included in `main.py` with `prefix=settings.api_prefix` (which is `/api`)
- Each router defines its own routes relative to that prefix
- Jobs router is special: included with `prefix="/api/jobs"` because its routes start with `/`

**Trailing Slash Behavior:**
- FastAPI automatically adds trailing slash to routes defined as `@router.get("/")`
- Example: `@router.get("/")` in jobs router becomes `GET /api/jobs/` (with trailing slash)
- Example: `@router.post("")` in jobs router becomes `POST /api/jobs` (no trailing slash)
- Frontend API clients must match these exact paths including trailing slashes

**Registered Routes:**
```
GET  /api/auth/me
POST /api/auth/login
GET  /api/runs           ← Returns {runs: [], total, page, page_size}
GET  /api/agents         ← Returns {agents: [], total, page, page_size}
GET  /api/jobs/          ← Returns {jobs: [], count, source, repository} (Note trailing slash!)
POST /api/jobs           ← Create job (No trailing slash)
PUT  /api/jobs/{namespace}/{job_name}
DELETE /api/jobs/{namespace}/{job_name}
```

**Response Structure:**
- `/api/runs` and `/api/agents` return paginated responses with nested arrays
- Frontend clients must extract the nested array (e.g., `response.data.runs`, `response.data.agents`)
- `/api/jobs/` returns `{jobs: [...], count, source, repository}` - extract `response.data.jobs`

### Job Management
- Job CRUD operations go through backend API endpoints:
  - `POST /api/jobs` - Create new job (commits YAML to Git)
  - `PUT /api/jobs/{namespace}/{job_name}` - Update existing job
  - `DELETE /api/jobs/{namespace}/{job_name}` - Delete job from Git
- Backend uses `ForgejoClient` service to commit changes to Git
- All operations maintain GitOps architecture (Git as source of truth)

### CLI Development
- CLI is a thin wrapper around API endpoints
- All logic should live in the backend API
- Use `core/api_client.py` for HTTP calls
- Use `core/formatter.py` for consistent output formatting

### Multi-Tenancy
- **Tenant Model**: One tenant per user (`tenant_id = username`)
- **Git Repositories**: Each tenant has a private repository (`crontopus/job-manifests-{tenant_id}`)
- **Auto-Creation**: Repository automatically created during user registration
  - Initialized with `production/` and `staging/` directories
  - Includes `.gitkeep` files for directory structure
- **Isolation**: All API endpoints enforce tenant isolation
  - Job CRUD operations scoped to tenant's repository
  - Agents pull from tenant-specific repository
  - Frontend shows only tenant-scoped data
- **Registration Flow**:
  1. User registers with username/email/password
  2. Backend sets `tenant_id = username`
  3. Backend calls Forgejo API to create `crontopus/job-manifests-{username}`
  4. Repository initialized as private with directory structure
  5. User can immediately create jobs via UI

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
  - `infra/forgejo/` — Git server (Droplet with persistent volume)
    - `create-volume.sh` — Create persistent DigitalOcean Volume (one-time)
    - `create-droplet.sh` — Create droplet with auto-mount
    - `destroy-droplet.sh` — Safely destroy droplet (preserves volume)
    - `deploy.sh` — Deploy Forgejo with SSL (volume-aware)
    - `docker-compose.yml` — Forgejo + PostgreSQL + Nginx (Docker volumes)
    - `docker-compose-volume.yml` — Volume-based configuration
  - `infra/docker/` — Local development Docker configs
- `examples/job-manifests/` — Example job manifest repository
- Root-level `docker-compose.yml` — Local dev orchestration

## Production Deployment

**Services:**
- Backend + Frontend: https://crontopus.com (App Platform)
- Git Server: https://git.crontopus.com (Droplet + Volume)
- Job Manifests: Tenant-specific repositories at `https://git.crontopus.com/crontopus/job-manifests-{username}`

**Deployment Commands:**

```bash
# Deploy backend + frontend (with automatic migrations)
cd infra/app-platform
./deploy-app-platform.sh

# Update app spec only (without rebuilding images)
doctl apps update 934e7b77-38da-49bb-bfcf-0ab6d7b8fa2f --spec app.yaml
doctl apps create-deployment 934e7b77-38da-49bb-bfcf-0ab6d7b8fa2f --wait

# Deploy/recreate Forgejo with persistent volume
cd infra/forgejo
./create-volume.sh         # One-time: create persistent volume
./destroy-droplet.sh       # Destroy old droplet (preserves volume)
./create-droplet.sh        # Create new droplet with volume
./deploy.sh <droplet_ip>   # Deploy Forgejo
```

**Important Notes:**
- Database migrations run automatically on backend startup via `start.sh`
- CORS is configured at App Platform level using service-level `routes` (not `ingress`)
- Frontend API URL is set at build time via `VITE_API_URL` build arg in Dockerfile
- Forgejo data persists on DigitalOcean Volume, survives droplet recreation
- Deployment script uses dynamic version tags (format: `YYYYMMDD-HHMMSS`)
- Script polls deployment status every 10s until ACTIVE/ERROR/CANCELED (10-minute timeout)
