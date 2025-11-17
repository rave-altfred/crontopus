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
2. **Bidirectional Sync**: Agent reconciles between Git (desired state) and scheduler (current state)
   - **Git → Scheduler**: Apply job definitions from Git to scheduler
   - **Scheduler → Git**: Discover existing jobs and import to Git
   - Agent does NOT execute jobs, only manages scheduler entries
3. **Automatic Callback Injection**: Agent wraps all job commands with check-in callbacks
   - Jobs automatically report success/failure to control plane
   - Helper script at `~/.crontopus/bin/checkin` handles API calls (cleaner than inline curl)
   - No manual instrumentation required
4. **Multi-Tenant**: Complete isolation with tenant-specific Git repositories
   - One tenant per user (`tenant_id = username`)
   - Repositories auto-created during registration
   - All job operations scoped to tenant's repository
5. **Database for Runtime Only**: Database stores users, tenants, endpoints, run history, job instances - NOT job definitions
6. **Terminology**:
   - **Agent** = Binary software (one per platform: Linux agent, macOS agent, Windows agent)
   - **Endpoint** = Machine/server running an agent instance (many endpoints run the same agent binary)
   - **Job Definition** = YAML manifest in Git (desired state)
   - **Job Instance** = Actual scheduled job on a specific endpoint (current state)

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

## Current Development Phase

**Phase 17: API Security & Rate Limiting** ⚠️ **PHASES 17.1 & 17.3 COMPLETE** (Nov 2025)
- Phase 17.1: Check-in Authentication ✅ Complete (Nov 17, 2025)
- Phase 17.2: User API Tokens ❌ Not Started
- Phase 17.3: Rate Limiting & DDoS Protection ✅ Complete (Nov 17, 2025)
- Phase 17.4: Documentation & Migration ⚠️ Partial

**Phase 17.1 Status** (✅ Complete):
- ✅ Check-in endpoint validates endpoint tokens (bcrypt verification)
- ✅ Authorization header: `Bearer <endpoint_token>` required
- ✅ Backward compatibility maintained (token optional during migration)
- ✅ Comprehensive logging for security monitoring
- ✅ Agent scripts already include tokens (no changes needed)
- ✅ Deployed to production (version 20251117-173117)

**Phase 17.3 Status** (✅ Complete):
- ✅ Rate limiting infrastructure complete (fastapi-limiter + Redis/Valkey)
- ✅ Smart identifier: User ID → Endpoint ID → IP fallback
- ✅ 23 endpoints protected with rate limiting
- ✅ Per-endpoint limits: Login 5/min, Register 3/hr, Check-ins 100/min, API 60/min
- ✅ Production deployment with Valkey database 3 (dedicated to Crontopus)
- ✅ Local development with Redis (localhost:6379)
- ✅ Rate limit headers (X-RateLimit-*) configured
- ✅ Deployed to production (version 20251117-140902)

**Previous Phases**:

**Phase 16: UI Branding & Theme** ✅ **COMPLETE** (Nov 2025)
- Phase 16.1: PCB-Inspired Logo ✅ Complete
- Phase 16.2: ASCII Art Logo Implementation ✅ Complete
- Phase 16.3: Dracula Theme Integration ✅ Complete

**Key Achievements**:
- ✅ Custom PCB-inspired ASCII art logo in Courier monospace font
- ✅ Static logo rendering (removed typing animation for performance)
- ✅ Complete Dracula theme implementation across all pages and components
- ✅ Consistent dark mode: Background (#282a36), Cards (#44475a), Borders (#6272a4)
- ✅ Dracula color accents: Purple (#bd93f9), Pink (#ff79c6), Green (#50fa7b), Red (#ff5555)
- ✅ Light mode retains original green brand colors for contrast
- ✅ 389 lines updated across 18 files for complete theme coverage

**Phase 15: Aggregated Run Reports** ✅ **COMPLETE** (Nov 2025)
- Phase 15.1: Backend Aggregation APIs ✅ Complete
- Phase 15.2: Run by Job Page ✅ Complete
- Phase 15.3: Run by Endpoint Page ✅ Complete
- Phase 15.4: Enhanced Job Run Log ✅ Complete

**Key Achievements**:
- ✅ `/api/runs/by-job` endpoint for job-level aggregation
- ✅ `/api/runs/by-endpoint` endpoint for endpoint-level aggregation
- ✅ Health calculation: healthy (95%+), degraded (70-95%), warning (<70%)
- ✅ Run by Job page with filters (time, job name, namespace, status)
- ✅ Run by Endpoint page with filters (time, name, hostname, platform, machine ID)
- ✅ Job Run Log with enhanced filters (limit, job name, namespace, status, time window)
- ✅ Three report pages in navigation menu
- ✅ Color-coded health badges (green/yellow/red)

**Phase 12: Job Discovery & Multi-Endpoint Tracking** ✅ **COMPLETE** (Nov 2025)
- Phase 12.1: Job Instance Tracking ✅ Complete
- Phase 12.2: Job Discovery & Reporting ✅ Complete
- Phase 12.3: Callback Injection ✅ Complete
- Phase 12.4: Cross-Reference APIs ✅ Complete
- Phase 12.5-12.9: Frontend Integration & Testing ✅ Complete

**Key Achievements**:
- ✅ JobInstance model with drift detection
- ✅ Automatic job discovery (every 5 minutes)
- ✅ Job instance reporting (every 30s sync)
- ✅ Elegant callback wrapper: `~/.crontopus/bin/run-job CRONTOPUS:<uuid>` (v0.1.14)
- ✅ Job configs in `~/.crontopus/jobs/<uuid>.yaml`
- ✅ Cross-reference APIs: job↔endpoints mapping
- ✅ Clean crontab entries (~50 chars vs 300+)
- ✅ Proper handling of job names with spaces (v0.1.12 fix)

**Phase 14: Discovered Jobs Management** ✅ **COMPLETE** (Nov 2025)
- Phase 14.1: Agent No-Wrap Mode ✅ Complete
- Phase 14.2: Backend Job Adoption System ✅ Complete
- Phase 14.3: Frontend Discovered Job UI ✅ Partial (filter/badge complete, adopt modal future)
- Phase 14.4: Testing & Validation ✅ Complete

**Key Achievements**:
- ✅ Discovered jobs remain externally-managed (no wrapping)
- ✅ External apps can remove their own cron entries
- ✅ Agent won't recreate discovered jobs if removed
- ✅ Job adoption API allows taking ownership
- ✅ Deletion prevented for discovered jobs (must adopt or use external app)
- ✅ Frontend: discovered namespace filter with purple badge
- ✅ Agent v0.1.9 with discovered job protection
- ✅ Fixed job instance reporting (v0.1.10-v0.1.11)
- ✅ Both Git-managed and discovered jobs now visible in UI

**Phase 13: UUID-Based Job Identification** ✅ **COMPLETE** (Nov 2025)
- Phase 13.1: Manifest Schema with UUID ✅ Complete
- Phase 13.2: UUID-based Crontab Markers ✅ Complete  
- Phase 13.3: Real Name Extraction from Discovery ✅ Complete
- Phase 13.4: UUID-based Reconciliation ✅ Complete
- Phase 13.5: Backend UUID Support ✅ Complete
- Phase 13.6: Dynamic Namespace Discovery ✅ Complete
- Phase 13.7: Migration Strategy ✅ Complete
- Phase 13.8: End-to-End Testing ✅ Complete

**Key Achievements**:
- ✅ Jobs identified by UUID instead of name (enables job renaming)
- ✅ Crontab markers use UUID format: `# CRONTOPUS:<uuid>`
- ✅ Discovery extracts real job names from checkin commands
- ✅ No more duplicate jobs in crontab
- ✅ No more name collisions (job1 from Git vs job1 discovered)
- ✅ Cross-tenant job tracking fixed
- ✅ Dynamic namespace support (no hardcoded production/staging)
- ✅ Drift detection removes stale job instances from UI
- ✅ Agent v0.1.8 with RemoveByCommand() to prevent reconciliation loops
- ✅ Uninstaller script for all platforms

**Previous Phases**:
- Phase 10: Enrollment Token System ✅ Complete
- Phase 9: Agent Documentation & Distribution ✅ Complete

**Next Steps**:
1. Phase 17.2: User API Tokens (enable programmatic API access)
2. Phase 17.4: Complete documentation for check-in authentication and rate limiting
3. Phase 4: Alerting & Monitoring (Planned)
4. Phase 17.5 (Future): Make token required for check-ins (remove backward compatibility)

See `docs/development-plan.md` for full roadmap.

## Development Commands

### Backend (FastAPI)
```bash
cd backend

# Prerequisites: Install and start PostgreSQL
brew install postgresql@14
brew services start postgresql@14
psql postgres
CREATE DATABASE crontopus;
CREATE USER crontopus WITH PASSWORD 'crontopus';
GRANT ALL PRIVILEGES ON DATABASE crontopus TO crontopus;
\q

# Prerequisites: Install and start Redis (for rate limiting)
brew install redis
brew services start redis
redis-cli ping  # Should return: PONG

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

# For detailed documentation:
# - See agent/README.md for complete installation guide
# - See agent/examples/ for systemd/launchd/Task Scheduler templates
# - See agent/docs/windows-server-testing.md for Windows Server testing
```

**Agent Status (Phase 9, 10, 12, 13, 14 Complete - Current: v0.1.14)**:
- ✅ Comprehensive documentation (README, deployment examples)
- ✅ Platform support: Linux, macOS, Windows Server 2019/2022, Windows 10/11
- ✅ Binary distribution and automated releases (GitHub Actions)
- ✅ Pre-configured agent installers with automatic startup
- ✅ Zero-configuration deployment from webapp
- ✅ Long-lived enrollment tokens (replaces short-lived JWT)
- ✅ Machine ID-based deduplication (prevents duplicate endpoints)
- ✅ Automatic system service installation (launchd/systemd/Task Scheduler)
- ✅ Git authentication with Forgejo access tokens
- ✅ Secure token-based repository cloning
- ✅ UUID-based job identification (v0.1.7+)
- ✅ Real name extraction from discovered jobs (v0.1.7+)
- ✅ Duplicate job removal via RemoveByCommand() (v0.1.8)
- ✅ Uninstaller script with crontab cleanup (v0.1.8)
- ✅ Discovered job protection - no wrapping (v0.1.9)
- ✅ Job instance reporting with drift detection (v0.1.10-v0.1.11)
- ✅ Job name handling with spaces (v0.1.12)
- ✅ Elegant crontab format with external job configs (v0.1.13)
- ✅ Simplified crontab: `~/.crontopus/bin/run-job CRONTOPUS:<uuid>` (v0.1.14)
- ✅ Automatic job discovery and callback injection (Phase 12)
- ✅ Cross-reference APIs for job-endpoint tracking (Phase 12)

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

# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

**Tech Stack:**
- React 19 + TypeScript + Vite
- Tailwind CSS v4 (configured via CSS, not tailwind.config.js)
- Dark mode support (light/dark/auto with lucide-react icons)
- lucide-react for icons
- react-syntax-highlighter for code display

### Internal Admin
```bash
cd internal_admin

# Commands TBD - check for package.json or requirements file
```

## Important Implementation Notes

### Agent vs Endpoint
- **Agent** = The binary software (e.g., `crontopus-agent` for Linux, macOS, or Windows)
- **Endpoint** = A machine/server running an agent instance
- **Many endpoints** can run the **same agent binary**
- Database model is now `Endpoint` (not `Agent`)
- API routes use `/api/endpoints/*` (not `/api/agents/*`)

### Agent Behavior
- **NEVER implement job execution in the agent**
- Agent only performs CRUD operations on OS scheduler entries
- Agent reconciles bidirectionally:
  - **Git → Scheduler**: Apply job definitions from Git
  - **Scheduler → Git**: Discover existing jobs and report to backend
- Agent automatically injects check-in callbacks into all job commands
- Jobs report execution results automatically via injected callbacks

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
GET    /api/auth/me
POST   /api/auth/login
GET    /api/runs                                      ← Returns {runs: [], total, page, page_size} (with filters: limit, namespace, endpoint_id, status, days)
GET    /api/runs/by-job                               ← Aggregated job statistics (filters: days, job_name, namespace, endpoint_id, status)
GET    /api/runs/by-endpoint                          ← Aggregated endpoint statistics (filters: days, name, hostname, platform, machine_id)
GET    /api/agents                                    ← Returns {agents: [], total, page, page_size}
GET    /api/endpoints                                 ← Returns {agents: [], total, page, page_size} (backward compat)
POST   /api/endpoints/enroll                          ← Enroll endpoint (accepts JWT or enrollment token)
GET    /api/endpoints/install/script/{platform}       ← Download pre-configured installer
GET    /api/enrollment-tokens                         ← List enrollment tokens
POST   /api/enrollment-tokens                         ← Create enrollment token
DELETE /api/enrollment-tokens/{id}                    ← Delete enrollment token
GET    /api/jobs/                                     ← Returns {jobs: [], count, source, repository} (Note trailing slash!)
POST   /api/jobs                                      ← Create job (No trailing slash)
PUT    /api/jobs/{namespace}/{job_name}
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
- **Git Authentication**: Automatic Forgejo user and access token creation
  - Token stored in `User.git_token` column
  - Embedded in agent installer config as `git.auth.token`
  - Agent constructs authenticated URLs: `https://username:token@git.crontopus.com/repo.git`
- **Isolation**: All API endpoints enforce tenant isolation
  - Job CRUD operations scoped to tenant's repository
  - Agents pull from tenant-specific repository
  - Frontend shows only tenant-scoped data
- **Registration Flow**:
  1. User registers with username/email/password
  2. Backend sets `tenant_id = username`
  3. Backend creates Forgejo user via `ForgejoClient.create_user()`
  4. Backend generates access token via `ForgejoClient.create_access_token()`
  5. Token stored in `User.git_token` for agent installers
  6. Backend creates `crontopus/job-manifests-{username}` repository
  7. Repository initialized as private with directory structure
  8. User can immediately create jobs via UI and agents can clone repository

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

**Network Architecture:**
- VPC: `803fc5f1-6165-4f81-8b92-a055a62f6292` (dedicated app VPC)
- All services (App Platform, Forgejo droplet) run in same VPC for private network communication
- App Platform uses private networking to access Forgejo via internal IP
- Database accessible via private VPC networking

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
./create-droplet.sh        # Create new droplet with volume (same VPC)
./deploy.sh <droplet_ip>   # Deploy Forgejo (detects existing DB and prompts)
```

**Important Notes:**
- Database migrations run automatically on backend startup via `start.sh`
- CORS is configured at App Platform level using service-level `routes` (not `ingress`)
- Frontend API URL is set at build time via `VITE_API_URL` build arg in Dockerfile
- Forgejo data persists on DigitalOcean Volume at `/mnt/forgejo-data` (survives droplet recreation)
  - Deploy script detects existing postgres data and prompts before overwriting
  - SSL certificates automatically restored from volume if they exist
  - Volume detachment issues fixed (properly strips brackets from droplet IDs)
- All services run in same VPC (`803fc5f1-6165-4f81-8b92-a055a62f6292`) for private networking
- Deployment script uses dynamic version tags (format: `YYYYMMDD-HHMMSS`)
- Script polls deployment status every 10s until ACTIVE/ERROR/CANCELED (10-minute timeout)
- App-platform deployment waits for completion before running DNS updates (both create and update paths)
