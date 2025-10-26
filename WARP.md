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

1. **API-First**: All functionality exposed via REST API before UI/CLI implementation
2. **Agent as Reconciler**: Agent manages scheduler state, does NOT execute jobs
3. **Ping-Based Check-ins**: Jobs report results via HTTP POST to control plane
4. **Multi-Tenant**: Isolated tenant data and policies
5. **GitOps Integration**: Job manifests synced from Forgejo

## Component Relationships

```
┌─────────────┐     ┌──────────────┐
│   CLI       │────▶│   Backend    │◀────┐
└─────────────┘     │   (FastAPI)  │     │
                    └──────────────┘     │
                            ▲            │
                            │            │
┌─────────────┐            │      ┌─────────────┐
│  Frontend   │────────────┘      │   Agent     │
│  (React)    │                   │   (Go)      │
└─────────────┘                   └─────────────┘
                                        │
                                        ▼
                                  ┌──────────────┐
                                  │ OS Scheduler │
                                  │ (cron/Task)  │
                                  └──────────────┘
```

## Development Commands

**Note**: This project is currently in early scaffolding phase. Many build/test commands need to be defined.

### Backend (FastAPI)
```bash
# Install dependencies (command TBD - check for requirements.txt or pyproject.toml)
cd backend

# Run development server (typical FastAPI command)
uvicorn crontopus_api.main:app --reload

# Run migrations
# Command TBD - check backend/migrations/ and backend/scripts/
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

# Install CLI (check for pyproject.toml configuration)
# Likely: pip install -e .

# Use CLI
python main.py --help
python main.py jobs list
python main.py agents enroll
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

- `infra/` — Contains Dockerfiles and DigitalOcean App Platform deployment specs
- Root-level `docker-compose.yml` — Multi-service orchestration (currently empty)
- Root-level `Makefile` — Project-wide build automation (currently empty)
