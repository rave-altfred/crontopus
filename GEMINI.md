# Crontopus

**Crontopus** is a proprietary, API-first job scheduling and monitoring platform inspired by GitOps principles. It combines simple "ping-based" monitoring with a signed agent that manages native OS schedulers (cron, Windows Task Scheduler).

## Project Overview

- **Architecture:** GitOps-based.
    - **Single Source of Truth:** Job definitions are stored as YAML manifests in tenant-specific Git repositories (Forgejo).
    - **Agent:** A Go binary running on endpoints (Linux, macOS, Windows) that pulls manifests from Git and reconciles the local scheduler. It *never* executes jobs directly; it manages the native scheduler.
    - **Backend:** FastAPI service handling API requests, auth, and committing changes to Git.
    - **Frontend:** React 19 web console.
- **Current Status:** **Phase 17: Rate Limiting - Production Deployment**. The team is currently deploying and verifying rate limiting using Redis/Valkey on DigitalOcean.

## Tech Stack

- **Backend:** Python (FastAPI), PostgreSQL, Redis (Valkey), SQLAlchemy, Alembic.
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4.
- **Agent:** Go (Golang).
- **CLI:** Python.
- **Infrastructure:** Docker, DigitalOcean App Platform, Forgejo (Git).

## Development Setup

### 1. Backend (Python/FastAPI)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -e .
# Ensure DB is running (see Docker below)
alembic upgrade head
uvicorn crontopus_api.main:app --reload
# Runs at http://localhost:8000
```

### 2. Frontend (React/Vite)

```bash
cd frontend
npm install
npm run dev
# Runs at http://localhost:5173
```

### 3. Agent (Go)

```bash
cd agent
go build -o build/crontopus-agent ./cmd/crontopus-agent
./build/crontopus-agent --config config.yaml
```

### 4. CLI (Python)

```bash
cd cli
python3 -m venv venv
./venv/bin/pip install -e .
./venv/bin/python main.py --help
```

### 5. Infrastructure (Docker)

Use `docker-compose.yml` in the root (if applicable, though usually individual folders have their own or standard local dev implies running Postgres/Redis locally).
*   **Redis:** Required for Rate Limiting. `brew install redis && brew services start redis`.
*   **Postgres:** Required for Backend. `brew install postgresql@14 && brew services start postgresql@14`.

## Production Deployment

Deployment to DigitalOcean App Platform is handled by a script that builds Docker images, pushes them to the registry, and updates the App Platform spec.

```bash
./infra/app-platform/deploy-app-platform.sh
```

**Prerequisites:**
*   `docker` installed and running
*   `doctl` (DigitalOcean CLI) installed and authenticated

## Testing

*   **Backend:** `cd backend && ./run_tests.sh` (Requires Docker).
*   **Frontend:** `cd frontend && npm test`.
*   **Agent:** `cd agent && go test -v ./pkg/...`.

## Key Conventions

*   **Agent vs Endpoint:** An **Agent** is the binary software. An **Endpoint** is a specific machine running the agent.
*   **Job Definition vs Instance:** **Definition** is the YAML in Git. **Instance** is the actual scheduled job on the endpoint.
*   **GitOps:** All job changes via UI/API result in Git commits to `crontopus/job-manifests-{username}`.
*   **API First:** CLI and Frontend use the exact same API endpoints.

## Recent Context (Phase 17)

*   Rate limiting has been implemented using `slowapi` and Redis.
*   Production environment uses DigitalOcean App Platform with a managed Valkey (Redis) instance (DB index 3).
*   **Next Steps:**
    *   Phase 17.1: Add endpoint token authentication to check-in endpoint.
    *   Phase 17.2: Implement user API tokens.
