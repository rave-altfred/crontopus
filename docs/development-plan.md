# 🦑 Crontopus Development Plan

## Project Status

**Current State**: Phase 1 (Foundation) - GitOps Architecture
**Architecture**: Monorepo with 5 independent components  
**Implementation**: Backend authentication complete, pivoting to GitOps for job definitions

---

## Development Philosophy

**GitOps-First**: Job definitions live in Git (Forgejo), not in database. Database stores only runtime data (run history, metrics, alerts).

**API-First Approach**: Build and test backend endpoints before implementing UI or CLI features.

**Iterative Development**: Deliver working features incrementally rather than building all components in parallel.

**Testing Strategy**: Unit tests alongside implementation, integration tests after core features are complete.

---

## Phase 1: Foundation & Core Backend (MVP)

### 1.1 Backend Infrastructure Setup
- [x] Set up FastAPI project structure and dependencies (`requirements.txt` or `pyproject.toml`)
- [x] Configure database connection (PostgreSQL recommended for multi-tenancy)
- [x] Implement configuration management (`backend/crontopus_api/config.py`)
- [x] Set up Alembic for database migrations
- [x] Create base models for multi-tenancy support

**Deliverable**: ✅ Backend can start, connect to database, and serve health check endpoint

### 1.2 Authentication & Multi-Tenancy
- [x] Implement tenant model and isolation strategy
- [x] Build authentication system (`backend/crontopus_api/security/`)
- [x] Create user management endpoints
- [x] Implement JWT token generation and validation
- [ ] Add tenant context middleware for all requests (deferred to Phase 1.3)

**Deliverable**: ✅ Users can register, authenticate, and access tenant-scoped resources

### 1.3 GitOps Job Definition System
- [x] ~~Design and implement job schema/model~~ (REMOVED - jobs live in Git)
- [x] ~~Build CRUD endpoints for jobs~~ (REMOVED - jobs live in Git)
- [x] Add job validation logic (cron expression validator - KEPT for agent use)
- [x] Design YAML job manifest schema for Git repository
- [x] Create example job manifests in Git
- [x] Document job manifest structure

**Deliverable**: ✅ Job manifest specification complete with examples

**Note**: Job definitions are YAML files in Git. See `docs/job-manifest-spec.md` and `examples/job-manifests/`

### 1.4 Job Run History & Check-in System
- [x] Design JobRun data model (job_name, tenant_id, status, output, timing)
- [x] Build check-in endpoint:
  - `POST /api/checkins` - Report job execution result (with job identifier from Git)
- [ ] Implement anonymous check-in via secret tokens (job-specific secrets - deferred to Phase 3)
- [x] Store run history with timestamps and outcomes
- [x] Build endpoint to retrieve run history:
  - `GET /api/runs` - List all runs (tenant-scoped)
  - `GET /api/runs/{job_name}` - Get runs for specific job
- [x] Create comprehensive tests for check-in and run history

**Deliverable**: ✅ Jobs can report execution results; run history is tracked in database

**Note**: Check-ins reference job by name/identifier (from Git manifest), not database ID. Secret token authentication will be added when agent is implemented.

---

## Phase 2: Basic CLI & Testing

### 2.1 CLI Foundation
- [x] Set up Python CLI project (`cli/pyproject.toml`)
- [x] Implement `core/api_client.py` - HTTP client wrapper
- [x] Implement `core/auth.py` - Token storage and management
- [x] Implement `core/config.py` - CLI configuration
- [x] Implement `core/formatter.py` - Output formatting (tables, JSON)
- [x] Implement authentication commands (`login`, `logout`, `whoami`)
- [x] Test CLI authentication flow

**Deliverable**: ✅ CLI can authenticate and communicate with backend

### 2.2 Job & Run Management Commands
- [x] `crontopus auth login` - Authenticate user
- [ ] `crontopus jobs list` - List all jobs (reads from Git via Forgejo API - deferred to Phase 3)
- [ ] `crontopus jobs validate <file>` - Validate job manifest YAML (deferred to Phase 3)
- [x] `crontopus runs list` - Show run history with pagination and filtering
- [x] `crontopus runs show <run_id>` - Show detailed run information
- [ ] `crontopus agents list` - List enrolled agents (deferred to Phase 3)

**Deliverable**: ✅ Developers can view job run history via CLI

**Note**: Job creation/editing happens via Git commits, not CLI commands. Job/agent commands deferred until Phase 3 when those components exist.

### 2.3 Testing Infrastructure
- [x] Set up pytest for backend with conftest.py
- [x] Create shared test fixtures (db, client, test_user, test_tenant, auth_headers)
- [x] Write comprehensive authentication tests (14 tests)
  - Registration (successful, duplicate username/email, password validation)
  - Login (successful, wrong password, inactive user)
  - Token validation and protected endpoints
- [x] Write check-in and run history tests (13 tests)
  - Check-in validation and recording
  - Run history listing, pagination, filtering
  - Tenant isolation
- [x] Add pytest-cov for test coverage reporting (82% coverage)

**Deliverable**: ✅ Core API functionality has automated test coverage (27 tests, 82% coverage)

---

## Phase 3: Agent Development

### 3.1 Agent Foundation
- [x] Set up Go project structure with `go.mod`
- [x] Implement configuration loading (YAML/JSON)
- [x] Build HTTP client for control plane communication
- [x] Implement agent enrollment flow:
  - User provides enrollment token (from CLI login)
  - Agent registers with backend and receives agent token
  - Token stored securely to disk for persistence
- [x] Create agent authentication/token storage mechanism
- [x] Implement heartbeat goroutine (30s interval)
- [x] Graceful shutdown handling
- [x] Build and test agent successfully

**Deliverable**: ✅ Agent can enroll with backend and maintain authenticated session

### 3.2 Scheduler Abstraction Layer
- [x] Design scheduler interface (`pkg/scheduler/interface.go`)
- [x] Implement Linux/macOS cron adapter (`pkg/scheduler/cron.go`)
  - Parse crontab format
  - Add/update/remove cron entries with marker-based identification
  - Verify entries exist
  - Tested successfully on macOS
- [x] Implement Windows Task Scheduler adapter (`pkg/scheduler/taskscheduler.go`)
  - Interface with schtasks CLI
  - Create/update/delete scheduled tasks in \Crontopus\ folder
  - Generate XML task definitions
  - Simplified cron-to-trigger conversion (placeholder for full implementation)
- [x] Add platform detection and scheduler selection (factory pattern)
- [x] Integrate scheduler into agent main loop
- [x] Test scheduler functionality on macOS (all tests passing)

**Deliverable**: ✅ Agent can manage native OS schedulers on Linux, macOS, and Windows

### 3.3 Git-based Job Sync & Reconciliation
- [x] Implement Git clone/pull logic (`pkg/git/sync.go`)
  - Clone job manifest repository (Forgejo/Git)
  - Periodic git pull for updates with hard reset
  - Support custom branch (default: main)
  - Track current commit hash
- [x] Implement YAML manifest parser (`pkg/manifest/parser.go`)
  - Parse job manifests matching job-manifest-spec.md schema
  - Validate required fields (apiVersion, kind, metadata, spec)
  - Support enabled/paused flags
  - Recursively parse all .yaml/.yml files
- [x] Implement reconciliation logic (`pkg/sync/reconcile.go`)
  - Compare Git manifests (desired state) with scheduler state (current)
  - Apply differences (add/update/remove scheduler entries)
  - Return change count for monitoring
- [x] Add reconciliation scheduling (periodic sync, configurable interval, default 30s)
- [x] Implement drift detection to avoid unnecessary reconciliation
- [x] Add comprehensive logging for all sync/reconciliation operations
- [x] Integrate into agent main loop with graceful shutdown

**Deliverable**: ✅ Agent continuously syncs from Git and reconciles OS scheduler state

**Note**: Agent pulls job definitions from Git, NOT from backend API

### 3.4 Agent Backend Integration
- [x] Build agent management API in backend:
  - `POST /api/agents/enroll` - Enroll new agent
  - `GET /api/agents` - List enrolled agents
  - `GET /api/agents/{id}` - Get agent details
  - `DELETE /api/agents/{id}` - Revoke agent
- [x] Add agent heartbeat/status tracking:
  - `POST /api/agents/{id}/heartbeat` - Agent reports alive status
- [x] Agent Git repository configuration (stored in agent model)
- [x] Create Agent database model with status tracking
- [x] Generate and apply Alembic migration
- [x] Test all agent endpoints

**Deliverable**: ✅ Backend can manage agents and track their health

**Note**: Agents fetch jobs from Git, not from backend. Backend only manages agent lifecycle.

### 3.5 Agent CLI Commands
- [x] `crontopus agents list` - List all enrolled agents
  - Pagination support (--page, --page-size)
  - Status filtering (--status active/inactive/offline)
  - JSON output option (--json)
  - Rich table display with hostname, platform, status, heartbeat time
- [x] `crontopus agents show <id>` - Show detailed agent information
  - Display agent metadata (name, hostname, platform, version)
  - Show Git configuration (repo URL, branch)
  - Display timing (enrolled, last heartbeat)
  - JSON output option
- [x] `crontopus agents revoke <id>` - Revoke agent credentials
  - Confirmation prompt (skip with --yes)
  - Soft delete (marks as revoked, not hard delete)
- [x] Auto-detect hostname in agent config if not specified
- [x] Add CLI requirements.txt (click, requests, rich)

**Deliverable**: ✅ Operators can manage agents via CLI

**Note**: Enrollment token comes from user login (`crontopus auth login`), not a separate enroll command.

---

## Phase 4: Alerting & Monitoring

### 4.1 Alert Rules Engine
- [ ] Design alert rule schema (job failure, missed check-in, etc.)
- [ ] Build alert rule CRUD API
- [ ] Implement alert evaluation logic (worker process)
- [ ] Create alert history/incident tracking

**Deliverable**: System can detect and record alert conditions

### 4.2 Notification Channels
- [ ] Implement Slack notifications (`backend/crontopus_api/workers/notifications.py`)
- [ ] Implement email notifications (SMTP)
- [ ] Implement PagerDuty integration
- [ ] Add notification channel configuration API
- [ ] Build notification dispatch worker

**Deliverable**: Alerts trigger notifications to external systems

### 4.3 Metrics & Observability
- [ ] Add Prometheus metrics endpoint (`/metrics`)
  - Job execution counts
  - Check-in success/failure rates
  - Agent health status
  - API request metrics
- [ ] Implement structured logging (JSON format)
- [ ] Add request tracing (correlation IDs)

**Deliverable**: System is observable via metrics and logs

---

## Phase 5: Frontend Web Console

### 5.1 Frontend Foundation
- [x] Set up React project with TypeScript and Tailwind CSS
  - Vite + React 18 + TypeScript
  - Tailwind CSS with PostCSS
  - Project structure with pages, components, layouts, contexts, api
- [x] Configure build tooling (Vite)
  - Fast dev server with HMR
  - Production builds optimized
  - Environment variables support (VITE_API_URL)
- [x] Implement routing (React Router)
  - BrowserRouter with protected routes
  - Route nesting for layout
  - Navigation guards for authentication
  - Register and Login routes
- [x] Create authentication flow (login/logout/register)
  - Login page with form validation
  - Registration page with password confirmation and validation
  - JWT token storage in localStorage
  - Auth Context with React hooks
  - Protected route component
  - Automatic token refresh on 401
  - Auto-login after registration
- [x] Build API client layer (`src/api/`)
  - Axios-based HTTP client
  - Request/response interceptors
  - API services: auth, agents, runs
  - TypeScript interfaces for all data types
  - OAuth2 form data for login
- [x] Set up state management (Context API)
  - AuthContext for user state
  - useAuth hook for components

**Deliverable**: ✅ Full authentication system with registration, login, and protected routes

### 5.2 Job & Run History UI
- [x] Main layout with header and sidebar navigation
  - Responsive design with Tailwind CSS
  - User info display and logout button
  - Navigation menu for Dashboard, Runs, Agents
- [x] Dashboard page
  - Stats cards: Active Agents, Successful Runs, Failed Runs
  - Recent job runs table with status indicators
  - Links to detailed views
- [x] Run history page
  - Full job runs list with pagination support
  - Status badges (success/failure/timeout)
  - Sortable columns: Job Name, Status, Started At, Duration
  - Empty state handling
- [ ] Jobs list page (reads from Forgejo via API, not database) - **Deferred to Phase 6**
- [ ] Job detail page (shows manifest content from Git + run history from DB) - **Deferred to Phase 6**
- [ ] Link to edit job in Git (opens Forgejo) - **Deferred to Phase 6**
- [ ] Job manifest viewer (syntax highlighting) - **Deferred to Phase 6**

**Deliverable**: ✅ Users can view dashboard, run history, and agents via web interface

**Note**: Jobs pages require Forgejo integration (Phase 6). Job editing happens in Git, not in web UI.

### 5.3 Agent & Alert Management UI
- [x] Agents list page
  - Table view with Name, Hostname, Platform, Status, Last Heartbeat
  - Status badges (active/inactive/offline)
  - Empty state for no agents
  - Real-time data from API
- [ ] Agent detail page (status, assigned jobs, heartbeat) - **Future enhancement**
- [ ] Alert rules configuration page - **Phase 4 dependency**
- [ ] Alert history/incidents page - **Phase 4 dependency**
- [ ] Notification channel setup - **Phase 4 dependency**

**Deliverable**: ✅ Web console with core features: auth, dashboard, runs, agents

### 5.4 UI/UX Enhancements
- [x] Theme selection (light/dark/auto)
  - ThemeContext with localStorage persistence
  - ThemeSelector component with lucide-react icons (Sun, Moon, Monitor)
  - Tailwind CSS v4 dark mode configuration via `@variant dark`
  - System preference detection for auto mode
  - Real-time theme switching without page reload
- [x] Dark mode styling across all pages
  - Dashboard, Jobs, Runs, Agents pages
  - MainLayout header and sidebar
  - Login and Register pages (future)
  - Consistent dark mode color scheme

**Deliverable**: ✅ Professional theme support with persistent user preference

**Deployment Status**: ✅ Frontend and backend fully deployed to production at https://crontopus.com
- Frontend served via Nginx with SPA routing
- API routing configured using service-level `routes`: `/api/*` and `/health` → backend, `/` → frontend  
- Tailwind CSS v4 with @tailwindcss/postcss (dark mode via CSS `@variant`)
- lucide-react for icon library
- Docker multi-stage builds for optimized images
- Health checks and monitoring active
- Custom domains with automatic DNS updates
- Database migrations run automatically on backend startup via `start.sh`
- CORS configured for production domains (crontopus.com, www.crontopus.com)
- OAuth2 password flow for secure authentication

---

## Phase 6: GitOps Integration

### 6.1 Job Manifest Format (Completed in Phase 1.3)
- [x] Design job manifest YAML schema
- [x] Create example job manifests
- [x] Document manifest structure
- [x] Build manifest parser and validator

**Deliverable**: ✅ Job manifest specification complete with examples

### 6.2 Forgejo Repository Setup
- [x] Create example job repository structure
- [x] Set up Forgejo instance on DigitalOcean droplet
- [x] Deploy at https://git.crontopus.com with SSL
- [x] Configure repository access for agents (SSH, token, basic auth)
- [x] Document Git workflow for job management
- [x] Create organization `crontopus` and repository `job-manifests`
- [x] Initialize with production/staging directory structure
- [x] Add example jobs: backup-database, cleanup-logs, api-health-check

**Deliverable**: ✅ Job manifest repository ready at https://git.crontopus.com/crontopus/job-manifests

**Infrastructure**:
- Droplet: forgejo-crontopus (139.59.214.80) in fra1
- Volume: forgejo-data-volume (10GB block storage)
- Stack: Forgejo 1.21 + PostgreSQL 15 (containerized) + Nginx + Certbot
- SSL: Let's Encrypt with auto-renewal
- Storage: Persistent volume at `/mnt/forgejo-data`
- Deployment: Fully automated via `infra/forgejo/deploy.sh` (volume-aware)

### 6.3 Agent Git Integration
- [x] Update agent configuration with Git settings
- [x] Document authentication methods (basic, token, SSH)
- [x] Add security best practices guide
- [x] Test Git sync functionality with Forgejo

**Deliverable**: ✅ Agents configured to sync from Forgejo

### 6.4 Forgejo Persistent Storage
- [x] Create DigitalOcean Volume for Forgejo data (10GB block storage)
- [x] Attach volume to Forgejo droplet
- [x] Mount volume at `/mnt/forgejo-data`
- [x] Update docker-compose.yml to use volume mount paths
- [x] Update deployment scripts to handle volume setup
- [x] Document backup and restore procedures
- [x] Add droplet lifecycle management (destroy/recreate with volume preservation)
- [x] Fix database preservation on droplet recreation
  - Deploy script detects existing postgres data before deployment
  - Confirmation prompt when existing database found
  - SSL certificates automatically restored from volume
  - Volume detachment parsing fixed (strips brackets from droplet IDs)

**Deliverable**: ✅ Forgejo data persisted on DigitalOcean Volume with backup strategy

**Benefits**:
- Data survives droplet replacement
- Easy snapshots for backups
- Can resize volume independently
- Better disaster recovery

**Implementation**:
- Volume: `forgejo-data-volume` (10GB, fra1)
- Droplet: Recreated in same VPC as app-platform
- Auto-mount on boot via user-data script
- SSL certificates synced to volume
- Scripts: create-volume.sh, destroy-droplet.sh, updated deploy.sh
- Database preservation verified through droplet recreation

### 6.8 VPC Network Consolidation
- [x] Move all services to single VPC for private networking
  - VPC ID: `803fc5f1-6165-4f81-8b92-a055a62f6292` (dedicated app VPC)
  - App Platform migrated to dedicated VPC
  - Forgejo droplet recreated in same VPC
  - Private network communication between services
- [x] Update infrastructure documentation
  - Network architecture diagram
  - VPC configuration details
  - Service connectivity requirements

**Deliverable**: ✅ All services running in single VPC with private networking

**Benefits**:
- Improved security (private service-to-service communication)
- Better network performance (low latency within VPC)
- Simplified firewall rules
- Foundation for future service mesh

### 6.5 Frontend Jobs Integration
- [x] Create jobs API client (TypeScript interfaces)
- [x] Build Jobs list page with environment filters
- [x] Create Job detail page with YAML viewer
- [x] Add ManifestViewer component with syntax highlighting (react-syntax-highlighter)
- [x] Add Jobs navigation link to sidebar
- [x] Integrate with run history (show recent runs per job)
- [x] Add "Edit in Git" button linking to Forgejo
- [x] Display job metadata (schedule, labels, status, environment)

**Deliverable**: ✅ Users can view and manage jobs through web UI

**Features**:
- View all job manifests from Git
- Filter by environment (production/staging)
- View YAML with syntax highlighting and copy button
- See recent runs for each job
- Navigate to Forgejo for editing
- Responsive design matching existing pages

### 6.6 Job Management UI (GitOps + UI)
- [x] Extend ForgejoClient with Git write operations
  - `create_or_update_file()` - Commit new/updated files to Git (POST for new, PUT for updates)
  - `delete_file()` - Remove files from Git repository
  - Base64 encoding and author attribution
  - Fixed Forgejo API: POST creates new files, PUT updates existing (requires SHA)
- [x] Add job CRUD endpoints to backend
  - `POST /api/jobs` - Create new job (commits YAML to Git)
  - `PUT /api/jobs/{namespace}/{job_name}` - Update existing job
  - `DELETE /api/jobs/{namespace}/{job_name}` - Delete job from Git
  - Pydantic models: JobCreateRequest, JobUpdateRequest
  - Tenant-specific repositories: `job-manifests-{tenant_id}`
- [x] Create JobNew page component in frontend
  - Form fields: name, namespace, schedule, command, args, env, labels, timezone, enabled/paused
  - Comprehensive form validation
  - Error handling and validation feedback
- [x] Add job creation page (`/jobs/new`)
  - JobNew component with full form
  - POST to backend on submit
  - Success message and redirect to jobs list
- [x] Add "New Job" button to jobs list page
  - Prominent button in page header
  - Links to `/jobs/new` route
- [x] Fix API response handling issues
  - Fixed agents API to extract `agents` array from response
  - Fixed runs API to extract `runs` array from response
  - Both endpoints return paginated responses with nested arrays
- [x] Add edit functionality to job detail page
  - JobEdit component with pre-filled form from current manifest
  - PUT updated data to backend
  - Route: `/jobs/:namespace/:jobName/edit`
  - GitOps compliant - commits changes to Git
- [x] Add delete functionality
  - Delete button with confirmation modal
  - DELETE request to backend
  - Redirect to jobs list after successful deletion
  - GitOps compliant - removes file from Git
- [x] Implement tenant-specific Git repositories
  - Repository naming: `crontopus/job-manifests-{tenant_id}`
  - Automatic repository creation during user registration
  - Complete tenant isolation (each tenant has own private repo)
  - Auto-initialized with `production/` and `staging/` directories
- [x] Simplify tenant model to username-based
  - `tenant_id = username` (one tenant per user)
  - Automatic tenant assignment during registration
  - Repository created automatically for new tenants
  - Removed tenant_id from registration form
- [x] Deployment infrastructure improvements
  - Deployment script uses dynamic version tags (not "latest")
  - Added deployment status polling with 10-minute timeout
  - Script waits for ACTIVE/ERROR/CANCELED status before completing
- [x] Test end-to-end workflow
  - TypeScript compilation successful
  - All components integrated with routing
  - API client methods implemented (create, update, delete)
  - Production deployment verified at https://crontopus.com
  - Tenant repository auto-creation tested and working

**Deliverable**: ✅ Users can create, edit, and delete jobs through UI while maintaining GitOps architecture with full tenant isolation

**Implementation Status**: ✅ **COMPLETE** - Deployed to production with tenant-specific repositories and automatic Git integration

### 6.7 Manifest Validation & CI (Optional - Future)
- [ ] Build manifest validation CLI tool
- [ ] Create pre-commit hooks
- [ ] Add CI pipeline example for manifest validation
- [ ] Implement diff preview before sync

**Deliverable**: Teams can use GitOps workflows with validation (deferred to future phase)

---

## Phase 7: Internal Admin Dashboard

### 7.1 Admin Backend API
- [ ] Build tenant management API (`internal_admin/api/`)
- [ ] Implement usage metrics and billing data collection
- [ ] Create system health dashboard API
- [ ] Add operator audit logging

**Deliverable**: Admin API for platform operations

### 7.2 Admin Web Interface
- [ ] Tenant management UI (create, suspend, delete tenants)
- [ ] Usage dashboard (API calls, storage, agents per tenant)
- [ ] System health monitoring page
- [ ] Audit log viewer

**Deliverable**: Operators can manage multi-tenant platform

---

## Phase 8: Production Readiness

### 8.1 Security Hardening
- [ ] Implement rate limiting
- [ ] Add API key management for service accounts
- [ ] Enable HTTPS enforcement
- [ ] Implement agent signing and verification
- [ ] Add security headers and CORS configuration
- [ ] Conduct security audit

**Deliverable**: Production-grade security posture

### 8.1a Authentication Enhancements
- [ ] SMTP integration for outgoing emails
  - Configure SMTP server (SendGrid, AWS SES, or Postmark)
  - Email templates for system notifications
  - Email verification for new accounts
  - Welcome emails and onboarding
- [ ] Forgot password flow
  - Password reset request endpoint
  - Secure token generation and expiration
  - Password reset email with magic link
  - Password reset form in frontend
  - Password strength validation
- [ ] SSO integration (OAuth2/OIDC)
  - Google OAuth2 integration
  - Facebook OAuth2 integration (optional)
  - GitHub OAuth2 integration (optional)
  - SSO account linking with existing accounts
  - SSO-only mode configuration (optional)

**Deliverable**: Enhanced authentication with email workflows and SSO options

**Benefits**:
- Reduced friction for user onboarding
- Self-service password recovery
- Enterprise-ready SSO support
- Improved security with email verification

### 8.2 Performance & Scalability
- [ ] Add database indexing strategy
- [ ] Implement query optimization
- [ ] Add Redis caching layer
- [ ] Set up background job queue (Celery or similar)
- [ ] Load testing and optimization

**Deliverable**: System handles production-scale workloads

### 8.3 Deployment & Infrastructure
- [x] Create production Dockerfiles
  - `backend/Dockerfile` - FastAPI with health checks, non-root user, automatic migrations via start.sh
  - `frontend/Dockerfile` - Multi-stage build (Node 20 + Nginx Alpine) with VITE_API_URL build arg
  - `agent/Dockerfile` - Multi-stage Go build, minimal alpine image
- [x] Write docker-compose.yml for local development
  - PostgreSQL 15
  - Backend with hot reload
  - Volume mounts for development
  - Health checks
- [x] Create DigitalOcean App Platform deployment specs
  - `.do/app.yaml` with managed database, VPC configuration, custom domains
  - Auto-scaling configuration
  - Environment variable management
  - Health checks with 10s timeout
- [x] Set up CI/CD pipelines
  - GitHub Actions workflow
  - Backend tests with coverage (pytest)
  - Agent build and tests (Go)
  - Docker build verification
  - Linting (ruff, black, gofmt, go vet)
  - Runs on push/PR to main/develop
- [x] Create deployment automation
  - `scripts/deploy.sh` - Automated deployment script
  - Docker layer caching for fast rebuilds (~1-2s)
  - Automatic app creation/update
  - Automatic log fetching on deployment failures
  - DNS and connectivity validation
  - Database connectivity verification
- [x] Configure production infrastructure
  - Container registry: `registry.digitalocean.com/crontopus-registry`
  - VPC networking with private database access
  - Database firewall rules configured
  - Custom domains: `crontopus.com` (primary), `www.crontopus.com` (alias)
- [x] Deploy to production
  - Backend deployed at https://crontopus.com/api
  - Frontend deployed at https://crontopus.com
  - Ingress routing: `/api/*` to backend, `/` to frontend
  - Health checks passing with database connectivity
  - App Platform app ID: `934e7b77-38da-49bb-bfcf-0ab6d7b8fa2f`
  - Frontend Dockerfile: Multi-stage build (Node 20 + Nginx Alpine)
  - Nginx configuration: SPA routing, gzip, caching, security headers
- [x] Create deployment documentation
  - `docs/deployment.md` with quick start guides
  - Docker Compose instructions
  - DigitalOcean deployment steps
  - Agent deployment procedures

**Deliverable**: ✅ Production deployment ready and live

**Note**: Backend is fully deployed and operational at https://crontopus.com with database connectivity. Deployment script provides one-command deployments with validation.

### 8.4 Documentation
- [ ] Complete `docs/architecture.md`
- [ ] Complete `docs/api-reference.md` (OpenAPI/Swagger)
- [ ] Complete `docs/agent-protocol.md`
- [ ] Complete `docs/cli-reference.md`
- [ ] Complete `docs/deployment.md`
- [ ] Write user guides and tutorials
- [ ] Create troubleshooting guide

**Deliverable**: Comprehensive documentation

---

## Phase 9: Agent Distribution & Enhancement

**Status**: Agent core functionality complete (Phase 3), enhancements pending

### 9.1 Agent Documentation
- [x] Create comprehensive `agent/README.md`
  - Installation instructions for Linux, macOS, Windows
  - Configuration guide with all options explained
  - Troubleshooting section
  - Architecture overview
- [x] Document scheduler-specific behavior
  - Cron syntax and limitations
  - Task Scheduler XML format details
  - Platform-specific quirks
  - Windows Server 2019/2022 as primary enterprise targets
- [x] Add agent deployment examples
  - Systemd service file (Linux): `agent/examples/crontopus-agent.service`
  - Launchd plist (macOS): `agent/examples/com.crontopus.agent.plist`
  - Windows Task Scheduler: `agent/examples/crontopus-agent-task.xml`
- [x] Create Windows Server testing guide
  - `agent/docs/windows-server-testing.md`
  - DigitalOcean droplet setup (~$24/month)
  - 7 comprehensive test scenarios
  - PowerShell, Task Scheduler, AD integration
  - Performance benchmarks and troubleshooting

**Deliverable**: ✅ Complete agent documentation for end users with enterprise Windows Server focus

### 9.2 Agent Testing & Platform Verification

**Testing Strategy**: Hybrid approach using GitHub Actions (Linux/macOS) + DigitalOcean Droplets (Windows Server)

- [x] Linux/macOS cron testing (verified on macOS)
- [ ] Linux testing on multiple distributions (GitHub Actions)
  - Ubuntu 20.04/22.04 LTS (system cron)
  - Debian 11/12 (system cron)
  - RHEL 8/9 / Rocky Linux (cronie)
  - Alpine Linux (busybox cron)
  - Verify crontab format consistency
  - Test user vs system crontab
- [ ] **Windows Server testing** (DigitalOcean Droplet - **CRITICAL for enterprise**)
  - **Windows Server 2019 Datacenter** (primary target)
  - **Windows Server 2022 Datacenter** (latest LTS)
  - Windows Server 2016 (legacy support)
  - Task Scheduler XML format validation
  - PowerShell execution context (ExecutionPolicy, profiles)
  - Active Directory domain-joined scenarios
  - Service account permissions testing
  - Event Log integration verification
  - Remote Desktop testing workflow
- [ ] Windows Desktop testing (GitHub Actions / local VMs)
  - Windows 10 Pro/Enterprise (21H2, 22H2)
  - Windows 11 Pro/Enterprise
  - User-level vs system-level task creation
- [ ] Cross-platform integration tests
  - Git sync on all platforms (HTTPS, SSH, token auth)
  - Manifest parsing consistency (line endings, encoding)
  - Scheduler reconciliation accuracy
  - Token storage and encryption
  - Enrollment and heartbeat flow
- [ ] Performance testing
  - Large manifest repositories (100+ jobs)
  - High-frequency reconciliation (5s interval)
  - Memory and CPU profiling with pprof
  - Concurrent job scheduling stress test
  - Long-running agent stability (24h+ uptime)

**Test Infrastructure**:
- GitHub Actions: Linux (free), macOS (free)
- DigitalOcean Droplet: Windows Server 2019/2022 (~$24/month)
- Cost-effective: Destroy/recreate droplet as needed for testing

**Deliverable**: Agent verified on all target platforms with enterprise Windows Server validation

### 9.3 Binary Distribution
- [x] Set up automated builds
  - GitHub Actions for multi-platform builds (`.github/workflows/agent-release.yml`)
  - Build matrix: linux (amd64, arm64), darwin (amd64, arm64), windows (amd64)
  - Versioned releases with semantic versioning (agent-v0.1.0)
  - Triggers on `agent-v*.*.*` tags
- [x] Create installation scripts
  - `agent/install.sh` for Linux/macOS (curl-to-bash installer)
  - `agent/install.ps1` for Windows (PowerShell installer)
  - Auto-detect platform and architecture
  - SHA256 checksum verification
  - Package managers: Homebrew (macOS), apt/yum (Linux), Chocolatey (Windows) - **Future**
- [x] Binary signing and verification
  - Checksum files (SHA256) - automated in workflow
  - Code signing certificates - **Future enhancement**
  - GPG signatures for verification - **Future enhancement**
- [x] Release automation
  - Automated GitHub releases on version tags
  - Release notes generation from commits
  - Binary upload to GitHub Releases
  - Latest tag tracking (`agent-latest`)

**Deliverable**: ✅ Users can install agent via one-command installers on all platforms

**Usage**:
```bash
# Create a release
git tag agent-v0.1.0
git push origin agent-v0.1.0

# Install on Linux/macOS
curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/crontopus/main/agent/install.sh | bash

# Install on Windows
iwr -useb https://raw.githubusercontent.com/YOUR_ORG/crontopus/main/agent/install.ps1 | iex
```

### 9.4 System Service Integration
- [ ] Linux systemd integration
  - `.service` file template
  - Auto-start on boot
  - Log rotation with journald
  - Resource limits (cgroups)
- [ ] macOS launchd integration
  - `.plist` file template
  - LaunchAgent vs LaunchDaemon guidance
  - Log management with unified logging
- [ ] Windows Service wrapper
  - Native Windows Service implementation
  - Event Log integration
  - Service recovery policies
  - Service Control Manager integration
- [ ] Service management CLI commands
  - `crontopus-agent install` - Install as system service
  - `crontopus-agent uninstall` - Remove service
  - `crontopus-agent start/stop/restart` - Service control
  - `crontopus-agent status` - Service status check

**Deliverable**: Agent runs as native system service on all platforms

### 9.5 Agent Security Hardening
- [ ] Secure credential storage
  - Linux: Keyring integration (libsecret, gnome-keyring)
  - macOS: Keychain integration
  - Windows: Credential Manager (DPAPI)
  - Fallback: Encrypted file with OS-specific key derivation
- [ ] Agent binary signing and verification
  - Code signing for all platforms
  - Backend verification of agent signatures during enrollment
  - Version-based revocation (block outdated agents)
- [ ] TLS certificate pinning
  - Pin backend API certificate
  - Detect MITM attacks
  - Configurable pinning policies
- [ ] Secure update mechanism
  - Auto-update capability with signature verification
  - Rollback support on failed updates
  - Update channels (stable, beta)
- [ ] Audit logging
  - Log all scheduler modifications
  - Git sync events with commit hashes
  - Enrollment and token operations
  - Tamper-evident logs

**Deliverable**: Agent meets enterprise security standards (Phase 8.1 dependency)

### 9.6 Agent Observability
- [ ] Structured logging
  - JSON log format option
  - Log levels (debug, info, warn, error)
  - Contextual fields (agent_id, job_name, commit_hash)
  - Log aggregation friendly
- [ ] Metrics exposure
  - Prometheus `/metrics` endpoint (optional HTTP server)
  - Metrics: sync_duration, reconciliation_changes, heartbeat_failures, scheduler_errors
  - Job-level metrics: execution_count, last_run_timestamp
- [ ] Health check endpoint
  - HTTP health endpoint for monitoring
  - Reports: git_sync_status, scheduler_status, backend_connectivity
  - Used by service managers and monitoring tools
- [ ] Distributed tracing
  - OpenTelemetry integration
  - Trace reconciliation operations
  - Link agent operations to backend API calls

**Deliverable**: Agent operations are fully observable (Phase 4 integration)

### 9.7 Advanced Agent Features
- [ ] Job dependency support
  - Parse `spec.dependsOn` from manifests
  - Coordinate execution order with backend
  - Timeout and failure handling
- [ ] Resource limits enforcement
  - Parse `spec.resources` from manifests
  - Apply cgroup limits (Linux)
  - Job priority and nice values
- [ ] Execution isolation (optional)
  - Container execution mode (Docker/Podman)
  - VM execution mode (Firecracker)
  - Sandboxing for untrusted jobs
- [ ] Multi-repository support
  - Sync from multiple Git repositories
  - Repository priorities and namespacing
  - Conflict resolution strategies
- [ ] Intelligent reconciliation
  - Incremental sync (only changed files)
  - Conditional reconciliation (only if commit changed)
  - Reconciliation dry-run mode

**Deliverable**: Agent supports advanced job orchestration features

### 9.8 Agent Update & Maintenance
- [ ] Version compatibility matrix
  - Document agent-to-backend compatibility
  - API versioning strategy
  - Deprecation notices
- [ ] Auto-update mechanism
  - Backend notifies agent of new versions
  - Agent downloads and verifies binary
  - Graceful restart with job preservation
  - Rollback on update failures
- [ ] Configuration validation
  - `crontopus-agent validate --config config.yaml`
  - Pre-flight checks before service start
  - Migration tool for config upgrades
- [ ] Telemetry and crash reporting
  - Optional telemetry collection
  - Crash dumps with privacy controls
  - Version adoption metrics

**Deliverable**: Agent lifecycle management is seamless for operators

### 9.9 Pre-Configured Agent Download (UX Enhancement)

**Goal**: Zero-configuration agent installation from webapp

- [x] Backend: Dynamic installer generation endpoint
  - `GET /api/agents/install/script/{platform}` - Generate pre-configured install script
  - Embed user's enrollment token in script
  - Embed tenant-specific Git repository URL
  - Platform-specific scripts (bash for Linux/macOS, PowerShell for Windows)
  - Set proper Content-Disposition headers for download
- [ ] Backend: Install token security
  - Generate short-lived install tokens (24-48 hours)
  - Track token usage (one-time use preferred)
  - Token revocation endpoint
  - Audit log for install token generation
- [x] Frontend: Agent download page
  - Platform selection UI (Linux, macOS, Windows)
  - Download buttons for each platform
  - Visual instructions for running downloaded script
  - Security warnings about token protection
  - Copy-paste command option (alternative to download)
- [x] Frontend: Download page UI/UX
  - Clear "Download Agent" navigation item
  - Step-by-step instructions with icons
  - Platform auto-detection (suggest correct platform)
  - "What happens next?" explanation
  - Link to deployment documentation
- [x] Script generation logic
  - Generate bash installer with embedded config
  - Generate PowerShell installer with embedded config
  - Auto-fill enrollment token, Git repo URL, username
  - Create config.yaml with pre-configured values
  - Include agent binary download and installation
  - Add post-install verification steps
  - **Automatic agent startup** - Agent starts running immediately after install

**User Flow**:
1. User clicks "Download Agent" in webapp
2. Selects platform (Linux/macOS/Windows)
3. Downloads pre-configured install script
4. Runs script with single command
5. Agent auto-installs, enrolls, and **starts running** with zero manual config

**Deliverable**: ✅ Users can deploy agents with zero configuration - download, run, done!

**Implementation Status**: ✅ **COMPLETE** - Backend generates platform-specific installers with embedded credentials, frontend provides download UI with platform selection, agents start automatically after installation

**Benefits**:
- ✅ Zero-configuration deployment
- ✅ Smooth onboarding experience
- ✅ Reduced support burden
- ✅ Secure (embedded credentials, token-based)
- ✅ Platform-specific optimizations

---

## Phase 10: Enrollment Token System & Endpoint Management

**Status**: ✅ Complete

**Terminology**:
- **Agent** = The binary software (one per platform: Linux agent, macOS agent, Windows agent)
- **Endpoint** = A machine/server running an agent instance (many endpoints can run the same agent)
- **Enrollment Token** = Long-lived token for remote agent deployment (replaces short-lived JWT)
- **Machine ID** = Platform-specific unique identifier for deduplication on reinstallation
- **Git Token** = Forgejo access token for secure repository cloning

**Goal**: Enable secure, zero-configuration agent deployment with automatic endpoint deduplication and Git authentication.

### 10.1 Enrollment Token System

- [x] Create `EnrollmentToken` model with fields: id, tenant_id, token_hash, name, expires_at, created_at, used_count, max_uses, last_used_at
- [x] Generate migration `e3f87db142ee_add_enrollment_tokens_table.py`
- [x] Create enrollment token endpoints:
  - `POST /api/enrollment-tokens` - Create new enrollment token
  - `GET /api/enrollment-tokens` - List enrollment tokens
  - `DELETE /api/enrollment-tokens/{id}` - Delete enrollment token
- [x] Implement dual authentication system (JWT + enrollment tokens)
  - Created `enrollment_auth.py` module with `get_user_for_enrollment()`
  - Updated `/api/endpoints/enroll` to accept both token types
  - Updated `/api/endpoints/install/script/{platform}` to validate enrollment tokens
- [x] Frontend enrollment token management UI
  - Token creation form with name and optional expiry/max_uses
  - Token display (plaintext shown once, then hashed)
  - Token list with usage statistics
  - Download buttons enabled only when token exists
- [x] Agent support for enrollment tokens
  - Updated enrollment request to send git_repo_url and git_branch
  - Token embedded in installer scripts

**Deliverable**: ✅ Long-lived enrollment tokens replace short-lived JWT tokens for remote agent deployment

### 10.2 Machine ID-Based Deduplication

- [x] Add `machine_id` column to `endpoint` table
  - Migration: `8572de0ee777_add_machine_id_to_endpoint.py`
  - Indexed for fast lookups
- [x] Create `agent/pkg/utils/machineid.go` with cross-platform machine ID collection
  - macOS: IOPlatformUUID from ioreg
  - Linux: /etc/machine-id or /var/lib/dbus/machine-id
  - Windows: MachineGuid from registry
  - SHA-256 hashing for privacy
- [x] Update enrollment logic to check for existing endpoints
  - Query by tenant_id + machine_id
  - Reuse existing endpoint on reinstall (update token and metadata)
  - Create new endpoint only if machine_id is new
- [x] Agent v0.1.2 released with machine_id support
  - GitHub Actions workflow successful
  - Binaries available for all platforms

**Deliverable**: ✅ Reinstalling agent on same machine reuses existing endpoint instead of creating duplicates

### 10.3 Automatic Service Installation

- [x] macOS: Automatic launchd service creation and loading
  - Creates plist at ~/Library/LaunchAgents/com.crontopus.agent.plist
  - Auto-restart on crash with ThrottleInterval
  - Loads immediately with launchctl
- [x] Linux: Automatic systemd service creation and start
  - Creates unit at /etc/systemd/system/crontopus-agent.service
  - Enables and starts service
  - Restart policies configured
- [x] Windows: Automatic scheduled task creation
  - Creates task "CrontopusAgent" with auto-restart
  - Runs at startup with highest privileges
  - Starts immediately after creation

**Deliverable**: ✅ Agent installs as system service automatically on all platforms

### 10.4 Git Authentication with Forgejo Access Tokens

- [x] Add `git_token` column to User model
- [x] Create migration `efa1a3d79845_add_git_token_to_users.py`
- [x] Implement Forgejo user creation and access token generation
  - `ForgejoClient.create_user()` - Create Forgejo user for tenant
  - `ForgejoClient.create_access_token()` - Generate access token for Git operations
- [x] Update registration flow to create Forgejo users and store tokens
  - Token stored in `User.git_token` field
  - Automatic user provisioning on registration
- [x] Update installer generation to embed Git tokens
  - Changed from `git.auth.type: basic` to `git.auth.type: token`
  - Config includes `git.auth.token` with Forgejo access token
  - Fallback to enrollment token if git_token not available
- [x] Agent support for token-based Git authentication
  - Updated `config.go` with `GitAuthConfig` (Type, Token)
  - Modified `git.Syncer` to construct authenticated URLs
  - Method: `https://username:token@git.crontopus.com/repo.git`
- [x] Agent v0.1.3 released with Git authentication support
  - GitHub Actions workflow successful
  - Binaries available for all platforms
- [x] Migration table name fix deployed
  - Fixed from `'users'` to `'user'` (singular)
  - Deployment successful (version 20251109-205602)
- [x] Fixed token path configuration issue
  - Changed from `token_path: "~/.crontopus/agent-token"` (literal tilde) to `$HOME/.crontopus/agent-token`
  - Added cleanup for legacy nested token paths in installer
  - Fixed tenant transfer mechanism (endpoint switches tenant on re-enrollment)
  - Deployment successful (version 20251110-103330)

**Deliverable**: ✅ Agents authenticate to Git using Forgejo access tokens

**Implementation Status**: ✅ **COMPLETE** - Agent v0.1.3 deployed to production

### 10.5 Elegant Check-in Helper Script

- [x] Create embedded shell script template (`agent/pkg/wrapper/templates/checkin.sh`)
  - Reads config from `~/.crontopus/config.yaml` (backend URL, endpoint ID, token)
  - Accepts job_name, namespace, status as arguments
  - Makes check-in API call with curl
- [x] Add `InstallCheckinScript()` function to wrapper package
  - Installs script to `~/.crontopus/bin/checkin` on agent startup
  - Sets executable permissions (0755)
- [x] Update `wrapUnix()` to use helper script
  - Changed from inline curl commands to `~/.crontopus/bin/checkin job ns status`
  - Fallback to inline curl if helper script installation fails
- [x] Agent v0.1.4 released with helper script support
  - Tested locally on macOS
  - Crontab entries now much cleaner and more readable

**Before**:
```bash
sh -c '(ls -la) && curl -X POST -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d "{...}" "URL" || curl -X POST ...'
```

**After**:
```bash
sh -c '(ls -la) && ~/.crontopus/bin/checkin test2 production success || ~/.crontopus/bin/checkin test2 production failure'
```

**Deliverable**: ✅ Crontab entries are clean and readable with helper script abstraction

### 10.6 Job Instance Unique Constraints

- [x] Add unique constraint to JobInstance model
  - UniqueConstraint on (tenant_id, endpoint_id, namespace, job_name)
  - Prevents same endpoint from having duplicate job assignments
- [x] Create database migration `ce60163757c5_add_unique_constraint_to_job_instances.py`
  - PostgreSQL supports CREATE UNIQUE CONSTRAINT directly
- [x] Update job assignment endpoint with IntegrityError handling
  - Catches duplicate assignments at database level
  - Returns 409 Conflict with clear error message
- [x] Deploy backend with migration to production
  - Migration successful: `Running upgrade efa1a3d79845 -> ce60163757c5`
  - Constraint active in production database

**Deliverable**: ✅ Database enforces uniqueness - prevents duplicate job instances on same endpoint

**Benefits**:
- ✅ Secure remote agent deployment without exposing short-lived JWT tokens
- ✅ Token usage tracking and revocation
- ✅ No duplicate endpoints on reinstallation
- ✅ Zero-configuration deployment with automatic startup
- ✅ Platform-specific unique machine identification
- ✅ Secure Git repository access with per-user tokens
- ✅ Follows industry standards (Docker, AWS CLI, GitLab Runner pattern)
- ✅ File-based token storage with OS permissions (0600)
- ✅ Clean, readable crontab entries with helper script
- ✅ Database-level protection against duplicate job assignments

---

## Phase 11: Flexible Namespace System

**Status**: Planned

**Goal**: Replace hardcoded `production`/`staging` namespaces with flexible user-defined groups. Treat namespaces as organizational units that users can create and manage.

**Motivation**:
- Current system forces users into predefined `production`/`staging` categories
- Enterprise users need flexible job organization (by team, service, customer, environment)
- Namespace inference from job name (not directory) causes misclassification:
  - Job named `backup-staging-db` in `production/` directory → misclassified as "staging"
  - Job named `backup` in `staging/` directory → misclassified as "production"
  - Breaks intended separation between environments

### 11.1 Core Namespace Design

**System-managed namespaces** (immutable, cannot be deleted):
- `discovered` - Auto-populated by agent discovery (jobs found on endpoints)
- `default` - Fallback for jobs without explicit namespace

**User-managed namespaces**: Fully flexible, user creates as needed
- Examples: `backup`, `monitoring`, `team-platform`, `customer-acme`
- No predefined `production` or `staging` (users create if needed)
- Namespace = Git directory name in job manifest repository

**Implementation Approach**: Git-based (Option A - No Database Model)
- Namespaces are Git directories in `job-manifests-{tenant}` repository
- Backend reads namespaces dynamically from Git structure
- No database table needed initially (can add later for metadata/RBAC)
- Namespace metadata (description, color) can live in `namespace.yaml` if needed

### 11.2 Repository Structure

- [ ] Update repository initialization to create system namespaces
  - Remove `production/` and `staging/` creation
  - Create `discovered/.gitkeep` and `default/.gitkeep` on tenant registration
  - Update `initialize_job_repository()` in auth routes
- [ ] Document namespace naming rules
  - Pattern: `^[a-z0-9]([-a-z0-9]*[a-z0-9])?$` (Kubernetes-style)
  - Max 63 characters
  - Reserved names: `discovered`, `default`, `system`

**Git Structure**:
```
job-manifests-{username}/
├── discovered/          # System namespace (agent-populated)
│   └── .gitkeep
├── default/             # System namespace (fallback)
│   └── .gitkeep
└── (user creates additional namespaces)
```

**Deliverable**: Clean repository structure with only system namespaces

### 11.3 Backend Namespace API

- [ ] Add namespace CRUD endpoints
  - `GET /api/namespaces` - List namespaces from Git (directory listing)
  - `POST /api/namespaces` - Create namespace (create Git directory with .gitkeep)
  - `DELETE /api/namespaces/{name}` - Delete namespace (only if empty, not system)
- [ ] Namespace listing implementation
  - Read directory structure from Git via Forgejo API
  - Count jobs per namespace (YAML files in directory)
  - Return metadata: name, is_system, job_count
- [ ] Namespace validation
  - Validate naming rules on creation
  - Prevent creation of system namespaces (`discovered`, `default`)
  - Prevent deletion of system namespaces
  - Prevent deletion of non-empty namespaces (must delete jobs first)
- [ ] Update job CRUD endpoints
  - Jobs must specify namespace (defaults to `default` if omitted)
  - Validate namespace exists before creating job
  - Allow jobs to be moved between namespaces (future enhancement)

**Deliverable**: RESTful namespace management API backed by Git

### 11.4 Agent Namespace Handling

- [ ] Fix namespace inference bug
  - **Current bug**: Agent infers namespace from job name pattern (e.g., `backup-staging-*` → "staging")
  - **Fix**: Agent must read namespace from Git directory structure, not job name
  - Update manifest parser to extract namespace from file path
  - Store namespace in Job struct from directory name
- [ ] Update reconciliation logic
  - Scheduler entries must include namespace in marker
  - Cron marker format: `# CRONTOPUS:namespace:job-name`
  - Windows Task Scheduler: Task path `\Crontopus\{namespace}\{job-name}`
- [ ] Discovery behavior
  - All discovered jobs go to `discovered/` namespace
  - Agent config: `discovery.target_namespace: discovered` (hardcoded)
  - Backend creates manifests in `discovered/` directory
- [ ] Agent syncs all namespace directories
  - Recursively sync all directories from Git root
  - Each namespace directory becomes scheduler entries
  - Respect namespace isolation in reconciliation

**Deliverable**: Agent correctly handles namespaces from directory structure

### 11.5 Frontend Namespace Management

- [ ] Create Namespaces/Groups management page
  - List all namespaces with job counts
  - Create new namespace button with validation
  - Delete namespace (with confirmation, only if empty)
  - Visual distinction for system namespaces (badge, icon)
- [ ] Update Jobs page with namespace filter
  - Dropdown to filter jobs by namespace: "All Groups", "discovered", "default", user namespaces
  - Show namespace badge on each job card
  - Display job count per namespace
- [ ] Update job create/edit forms
  - Namespace selector (dropdown of existing namespaces)
  - "+ Create new group" button inline
  - Default to `default` namespace
  - Prevent selection of `discovered` (system-managed)
- [ ] Navigation updates
  - Add "Groups" or "Namespaces" to sidebar navigation
  - Update breadcrumbs to show: Jobs > {namespace} > {job-name}

**UI Mockup - Groups Page**:
```
Groups                           [+ Create Group]

┌─────────────────────────────────────────────────┐
│ 📂 discovered                            3 jobs │
│ System-managed (agent discovery)       [System] │
├─────────────────────────────────────────────────┤
│ 📂 default                               2 jobs │
│ Default namespace for new jobs         [System] │
├─────────────────────────────────────────────────┤
│ 📁 backup                                8 jobs │
│                                   [Edit][Delete]│
└─────────────────────────────────────────────────┘
```

**Deliverable**: Complete namespace management UI

### 11.6 Migration for Existing Tenants

- [ ] Create migration script for production tenants
  - Create `discovered/` and `default/` directories in existing repositories
  - Optionally migrate jobs from `production/` → `default/` or keep as custom namespace
  - Optionally migrate jobs from `staging/` → `default/` or keep as custom namespace
  - Document migration strategy for users
- [ ] Update documentation
  - Remove references to hardcoded `production`/`staging`
  - Document flexible namespace system
  - Add namespace best practices guide
  - Update job manifest examples with various namespaces

**Deliverable**: Smooth migration path for existing deployments

### 11.7 Testing & Validation

- [ ] Backend tests
  - Test namespace CRUD operations
  - Test namespace validation (naming rules, system namespace protection)
  - Test namespace listing with job counts
  - Test job creation with namespace validation
- [ ] Agent tests
  - Test namespace inference from directory structure (not job name)
  - Test reconciliation with namespace isolation
  - Test cron marker format includes namespace
  - Test discovered jobs go to correct namespace
- [ ] Frontend tests
  - Test namespace management page (create, list, delete)
  - Test job filtering by namespace
  - Test job creation with namespace selector
- [ ] Integration tests
  - End-to-end: Create namespace → Create job in namespace → Agent syncs → Scheduler entry created
  - Test namespace deletion (empty vs non-empty)
  - Test system namespace protection

**Deliverable**: Comprehensive test coverage for flexible namespace system

**Benefits**:
- ✅ Flexible job organization (team, service, environment, customer)
- ✅ No forced `production`/`staging` structure
- ✅ Correct namespace inference from Git directory (not job name)
- ✅ System namespaces protected from user modification
- ✅ Scalable for enterprise users with many logical groupings
- ✅ Clean Git repository structure
- ✅ No database model needed initially (pure Git-based)

---

## Phase 13: UUID-Based Job Identification (Critical Fix)

**Status**: ✅ **COMPLETE**

**Goal**: Replace name-based job identification with UUIDs to fix fundamental identity and reconciliation issues.

### Problems with Current Name-Based Approach:
1. ❌ Name collisions: job1 from Git vs job1 discovered locally
2. ❌ Can't rename jobs: name is the identifier
3. ❌ Generated names like `discovered-job-0` are meaningless
4. ❌ Reconciliation can't match unmarked jobs to Git jobs
5. ❌ Cross-tenant job tracking broken (jobs from ravemen12 appear as ravemen13's)
6. ❌ Installer stripping markers causes duplicates on reconciliation

### 13.1 Manifest Schema Update

- [x] Update job manifest specification (`docs/job-manifest-spec.md`)
  - Add `metadata.id` field (UUID v4)
  - Keep `metadata.name` as human-readable, non-unique label
  - ID is immutable, name can be changed
- [x] Update manifest parser in agent
  - Read `metadata.id` field
  - Generate UUID if missing (backward compatibility)
  - Validate UUID format
- [x] Update manifest examples
  - Add ID to all example manifests
  - Document ID generation strategy

**Example Manifest**:
```yaml
apiVersion: v1
kind: Job
metadata:
  id: "550e8400-e29b-41d4-a716-446655440000"  # UUID - immutable identifier
  name: backup-database  # Human-readable - can be renamed
  namespace: production
  tenant: ravemen15
spec:
  schedule: "0 2 * * *"
  command: /opt/scripts/backup.sh
```

**Deliverable**: ✅ Job manifests support UUID-based identification

### 13.2 Crontab Marker Update

- [x] Change marker format from name-based to UUID-based
  - Old: `# CRONTOPUS:namespace:job-name`
  - New: `# CRONTOPUS:550e8400-e29b-41d4-a716-446655440000`
- [x] Update cron scheduler to read/write UUID markers
  - `formatCronEntry()` uses UUID instead of namespace:name
  - `parseCronEntry()` extracts UUID from marker
  - `extractJobID()` added
- [x] Add backward compatibility
  - Detect old format markers: `# CRONTOPUS:namespace:name`
  - Support both formats during transition
  - Log migration for visibility

**Deliverable**: ✅ Crontab entries identified by UUID, not name

### 13.3 Discovery Update

- [x] Generate UUIDs for discovered jobs
  - Use `google/uuid` package in Go
  - Each discovered job gets unique UUID immediately
  - Try to extract real name from checkin command
- [x] Extract job name from wrapped commands
  - Parse checkin helper call: `/checkin job-name namespace`
  - Use extracted name instead of `discovered-job-N`
  - Fall back to `discovered-job-N` if can't extract
- [x] Update discovery payload
  - Backend generates UUID when importing to Git
  - Backend uses UUID as primary key
  - Import to Git with UUID in metadata

**Example**:
```go
// Before: discovered-job-0, discovered-job-1
// After: Extract from checkin command
discoveredJob := DiscoveredJob{
    ID:        uuid.New().String(),
    Name:      extractNameFromCheckin(job.Command),  // "test1", "test2"
    Schedule:  job.Schedule,
    Command:   job.Command,
    Namespace: "discovered",
}
```

**Deliverable**: ✅ Discovered jobs have meaningful names and unique UUIDs

### 13.4 Reconciliation Logic Update

- [x] Update reconciler to match by UUID
  - Build map of Git jobs by UUID (not name)
  - Build map of scheduler jobs by UUID (from marker)
  - Match: Git UUID == Scheduler UUID
- [x] Handle unmarked jobs in scheduler
  - Added `RemoveByCommand()` method
  - After adding discovered job, remove unmarked duplicate
  - Prevents reconciliation loops
- [x] Update comparison logic
  - Compare by UUID first
  - If match: check if schedule/command changed → update
  - If no match: job missing from scheduler → add
- [x] Remove name-based matching fallback
  - Keep `extractJobName()` for legacy support
  - Use `currentJobsMap[uuid]` as primary
  - Name matching only for old-format markers

**Deliverable**: ✅ Reconciliation uses UUIDs, no more duplicates or name collisions

### 13.5 Backend API Updates

- [x] Update job CRUD endpoints to use UUIDs
  - `POST /api/jobs` generates UUID automatically
  - Keep namespace/name routing for compatibility
  - UUIDs stored in Git manifests
- [x] Update JobInstance model
  - Add `job_id` column (UUID, nullable for migration)
  - Keep `job_name` for display purposes
  - Index on job_id for performance
- [x] Update discovery endpoint
  - Generate UUID when importing to Git
  - Store UUID in manifest metadata
  - Backend creates manifests with UUIDs
- [x] Create migration
  - Add `job_id` column to job_instances
  - Column nullable for gradual rollout
  - Index added for fast lookups
- [x] Fix namespace discovery
  - Dynamically scan all directories in Git
  - Remove hardcoded production/staging/discovered list
  - Support custom namespaces (default, dev, qa, etc.)
- [x] Enable drift detection
  - Remove stale job instances not reported by agent
  - Keeps UI in sync with actual endpoint state

**Deliverable**: ✅ Backend tracks jobs by UUID with dynamic namespace support

### 13.6 Frontend Updates

- [x] Jobs page dynamically discovers namespaces from Git
  - No more hardcoded Production/Staging buttons
  - Fetches actual namespaces from repository
- [ ] Update job detail page (Future)
  - Show UUID in metadata section
  - Use UUID for edit/delete operations
- [ ] Update job-endpoint pairing (Future)
  - Match by UUID instead of namespace/name
  - Display name for UX, use UUID for logic

**Deliverable**: ✅ Frontend lists jobs from all namespaces dynamically

### 13.7 Migration Strategy

- [x] Generate UUIDs for existing jobs
  - New jobs automatically get UUIDs from backend
  - Agent generates UUIDs for manifests without them
  - Backward compatible with old markers
- [x] Update markers in production crontabs
  - Agent supports both old and new marker formats
  - New jobs use UUID markers
  - Gradual migration, no downtime required
- [x] Database migration
  - Added job_id column (nullable)
  - Future: backfill for existing records

**Deliverable**: ✅ Smooth migration from name-based to UUID-based system

### 13.8 Testing

- [x] Agent tests
  - UUID marker format working
  - Reconciliation with UUID matching verified
  - Backward compatibility with old markers tested
  - Discovery with name extraction validated
- [x] Backend tests
  - Job CRUD generates UUIDs
  - Discovery endpoint creates UUIDs
  - Drift detection removes stale instances
- [x] Integration tests
  - Fresh install validation complete
  - Single discovered job with UUID marker
  - No duplicates in crontab
  - Real job names extracted from commands
  - Cross-tenant isolation verified

**Deliverable**: ✅ UUID system validated end-to-end

### Benefits:
- ✅ Jobs can be renamed without breaking sync
- ✅ No name collisions (job1 from Git vs job1 discovered)
- ✅ Clear reconciliation logic (UUID match = same job)
- ✅ Discovered jobs get meaningful names from checkin commands
- ✅ No more `discovered-job-0` generic names
- ✅ Installer stripping markers works correctly (UUIDs prevent duplicates)
- ✅ Cross-tenant job tracking fixed
- ✅ Foundation for future features (job templates, job history)

---

## Phase 14: Discovered Jobs Management (Externally-Managed Jobs)

**Status**: ✅ **COMPLETE**

**Goal**: Prevent Crontopus from interfering with externally-managed cron jobs while still providing visibility.

### Problem Statement:
When Crontopus discovers and wraps external cron jobs:
1. ❌ Original apps can't remove their own jobs (command changed)
2. ❌ Agent recreates removed discovered jobs (wrong assumption)
3. ❌ No way for users to take ownership of discovered jobs
4. ❌ Uninstallers break when jobs are wrapped

### 14.1 Agent: No-Wrap Mode for Discovered Jobs

- [x] Skip wrapping for jobs with `source: discovered` label
  - Agent checks `metadata.labels.source` before wrapping
  - Discovered jobs keep original commands intact
  - Only UUID marker added for tracking
  - External apps can find and remove their own cron entries
- [x] Read-only reconciliation for discovered jobs
  - Agent won't recreate discovered jobs if removed
  - Logs: "Discovered job not found - removed externally. Not recreating."
  - Job will be cleaned up from Git in removal phase
- [x] Agent v0.1.9 released with discovered job protection

**Deliverable**: ✅ Discovered jobs remain externally-managed with original commands

### 14.2 Backend: Job Adoption System

- [x] Add adoption endpoint
  - `POST /api/jobs/{namespace}/{job_name}/adopt` with `target_namespace` in body
  - Moves job from `discovered/` to `production/` or `staging/`
  - Removes `source: discovered` label (Crontopus takes ownership)
  - Deletes old file, creates new file in Git
  - On next sync: agent wraps job with callbacks (full management)
- [x] Prevent deletion of discovered jobs
  - `DELETE /api/jobs/{namespace}/{job_name}` checks for `source: discovered`
  - Returns 403 Forbidden with message:
    "Cannot delete discovered jobs. Remove using the application that created it, or adopt it first."
  - Forces users to use external app uninstaller or adopt first

**Deliverable**: ✅ Users can adopt discovered jobs to take full ownership

### 14.3 Frontend: Discovered Job UI

- [x] Add discovered namespace filter
  - "🔍 Discovered" button on jobs page
  - Purple badge with emoji for discovered jobs
  - Distinct visual styling (purple background)
- [x] Add adopt API method
  - `jobsApi.adopt(namespace, jobName, targetNamespace)`
  - POST to backend adoption endpoint
- [ ] Add "Adopt Job" button to job detail page (Future)
  - Button visible only for discovered jobs
  - Modal to select target namespace (production/staging)
  - Confirms adoption with explanation
- [ ] Disable delete button for discovered jobs (Future)
  - Hide or gray out delete button
  - Tooltip: "Remove using external application, or adopt first"
- [ ] Add explanatory banner (Future)
  - "This job is managed by an external application"
  - Link to documentation about adoption

**Deliverable**: ✅ Discovered jobs visually distinguished with basic UI support

### 14.4 Testing & Validation

- [ ] Create external cron job for testing
  - Use crontab -e to add test job manually
  - Verify agent discovers without wrapping
  - Check UUID marker added
  - Verify original command unchanged
- [ ] Test external removal
  - Remove cron entry using crontab -e
  - Verify agent doesn't recreate on next sync
  - Verify job removed from Git
- [ ] Test adoption flow
  - Discover external job
  - Adopt to production namespace
  - Verify source label removed
  - Verify agent wraps job on next sync
  - Verify callbacks work
- [ ] Test uninstaller scenarios
  - Install external app with cron
  - Crontopus discovers job
  - Uninstall external app
  - Verify app can remove its own job
  - Verify Crontopus removes from Git

**Deliverable**: End-to-end validation of discovered job lifecycle

### Benefits:
- ✅ External apps can manage their own cron jobs
- ✅ Uninstallers work correctly (commands unchanged)
- ✅ Users get visibility into external jobs
- ✅ Users can adopt jobs to take full control
- ✅ Clear UX about what's Crontopus-managed vs external
- ✅ No interference with external job lifecycle
- ✅ Solves fundamental conflict with external applications

---

## Phase 12: Job Discovery & Multi-Endpoint Tracking (Future)

**Status**: Planned

**Goal**: Enable bidirectional sync with job discovery and automatic callback injection.

### 12.1 Job Instance Tracking

- [ ] Create `JobInstance` model
  - Fields: id, job_name, endpoint_id, namespace, tenant_id, status, last_seen, source, original_command, created_at, updated_at
  - Source: 'git' (defined in Git) or 'discovered' (found on endpoint)
  - Status: 'scheduled', 'running', 'paused', 'error'
- [ ] Generate Alembic migration for job_instances table
- [ ] Add JobInstance CRUD operations in backend
- [ ] Create JobInstance Pydantic schemas

**Deliverable**: Database tracks which jobs are on which endpoints

### 12.2 Job Discovery & Reporting

- [ ] Backend: Job discovery endpoint
  - `POST /api/endpoints/{endpoint_id}/discovered-jobs`
  - Accept list of jobs found on endpoint (name, schedule, command)
  - Create job manifests in Git under `discovered/` namespace
  - Mark as source='discovered'
- [ ] Backend: Job instance reporting endpoint
  - `POST /api/endpoints/{endpoint_id}/job-instances`
  - Accept current state of endpoint's scheduler
  - Update JobInstance records with last_seen timestamp
  - Detect jobs that disappeared from endpoint
- [ ] Agent: Scheduler discovery on enrollment
  - Read existing cron entries (Linux/macOS)
  - Read existing Task Scheduler tasks (Windows)
  - Parse schedule and command from existing entries
  - Send discovered jobs to backend on first enrollment
- [ ] Agent: Job instance reporting on every sync
  - Report which jobs are currently scheduled
  - Include status (scheduled/running/paused/error)
  - Send every sync cycle (30s default)

**Deliverable**: Endpoints report existing jobs and current state to backend

**User Flow**:
1. Agent enrolls with backend
2. Agent reads local scheduler (finds 3 existing cron jobs)
3. Agent sends discovered jobs to backend
4. Backend creates manifests in Git: `discovered/backup-db.yaml`, etc.
5. Next sync: Agent pulls from Git (now includes discovered jobs)
6. Agent reconciles and injects callbacks into all jobs

### 12.3 Callback Injection

- [ ] Agent: Implement callback wrapper logic
  - Wrap every job command with success/failure callbacks
  - Format: `(CMD && curl ... success) || curl ... failure`
  - Use endpoint's authentication token for callbacks
  - Include job_name, endpoint_id in callback payload
- [ ] Agent: Detect and preserve existing callbacks
  - Don't double-wrap jobs that already have callbacks
  - Parse job command to detect existing curl callbacks
- [ ] Backend: Job-specific tokens (optional enhancement)
  - Generate unique token per job for callbacks
  - Store in JobInstance model
  - More secure than using endpoint token

**Deliverable**: All jobs automatically report execution status

**Callback Example**:
```bash
# Original job
/scripts/backup.sh

# After callback injection
(/scripts/backup.sh && curl -X POST https://crontopus.com/api/checkins \
  -H "Authorization: Bearer $ENDPOINT_TOKEN" \
  -d '{"job_name":"backup-db","endpoint_id":"123","status":"success"}') || \
curl -X POST https://crontopus.com/api/checkins \
  -H "Authorization: Bearer $ENDPOINT_TOKEN" \
  -d '{"job_name":"backup-db","endpoint_id":"123","status":"failure"}'
```

### 12.4 Cross-Reference APIs

- [ ] Backend: Job-to-Endpoints mapping
  - `GET /api/jobs/{namespace}/{job_name}/endpoints`
  - Returns list of endpoints running this job
  - Include endpoint status, last run time, last_seen
- [ ] Backend: Endpoint-to-Jobs mapping
  - `GET /api/endpoints/{endpoint_id}/jobs`
  - Returns list of jobs on this endpoint
  - Include job status, source (git/discovered), last run
- [ ] Backend: Job instance filtering
  - Query params: ?source=git|discovered
  - Query params: ?status=scheduled|running|paused|error
  - Support pagination

**Deliverable**: API endpoints for many-to-many Job ↔ Endpoint relationships

### 12.5 Frontend: Enhanced Jobs Page

- [ ] Update Jobs list page
  - Show all jobs from Git (git-defined + discovered)
  - Add badge: "Git" vs "Discovered"
  - Add filter: All | Git-defined | Discovered
- [ ] Make jobs expandable
  - Click job to expand inline
  - Show list of endpoints running this job
  - Show endpoint status (alive/offline)
  - Show last run time per endpoint
  - Show success/failure status
- [ ] Add endpoint count badge
  - "3 endpoints" badge on each job
  - Click to expand/collapse
- [ ] Link to endpoint details
  - Click endpoint name to navigate to endpoint page

**Deliverable**: Users see which endpoints are running each job

**UI Mockup**:
```
Jobs (75)  [+ New Job]  [Filter: All ▼]

┌─────────────────────────────────────────────────────┐
│ [Git] backup-database            production         │
│ Schedule: 0 2 * * *              ▼ 3 endpoints      │
│ ├─ endpoint-prod-01 (alive)   Last: 2h ago ✓       │
│ ├─ endpoint-prod-02 (alive)   Last: 2h ago ✓       │
│ └─ endpoint-prod-03 (offline) Last: 1d ago ✗       │
├─────────────────────────────────────────────────────┤
│ [Discovered] cleanup-temp        discovered         │
│ Schedule: 0 3 * * *              ▼ 1 endpoint       │
│ └─ endpoint-prod-01 (alive)   Last: 1h ago ✓       │
└─────────────────────────────────────────────────────┘
```

### 12.6 Frontend: Enhanced Endpoints Page

- [ ] Rename "Agents" page to "Endpoints" page
- [ ] Update page to show all endpoints
  - Name, hostname, platform, status (alive/offline)
  - Last heartbeat time
  - Job count badge
- [ ] Make endpoints expandable
  - Click endpoint to expand inline
  - Show list of jobs on this endpoint
  - Show job source (git/discovered)
  - Show job status and last run
  - Link to job details
- [ ] Add filtering
  - Filter by status: All | Alive | Offline
  - Filter by platform: All | Linux | macOS | Windows
  - Search by hostname or name

**Deliverable**: Users see which jobs are running on each endpoint

**UI Mockup**:
```
Endpoints (12)  [Search...]

┌─────────────────────────────────────────────────────┐
│ endpoint-prod-01     Ubuntu 22.04   Alive (2m ago)  │
│ 10.0.1.15                            ▼ 8 jobs       │
│ ├─ [Git] backup-database (prod)      Last: 2h ago ✓ │
│ ├─ [Git] cleanup-logs (prod)         Last: 1h ago ✓ │
│ ├─ [Discovered] cleanup-temp (disc)  Last: 3h ago ✓ │
│ └─ [Git] api-health-check (prod)     Last: 5m ago ✓ │
├─────────────────────────────────────────────────────┤
│ endpoint-staging-01  macOS 14.2     Alive (1m ago)  │
│ 192.168.1.50                         ▼ 3 jobs       │
│ ...                                                  │
└─────────────────────────────────────────────────────┘
```

### 12.7 Frontend: New Agents Page

- [ ] Create new "Agents" page for downloads
  - Moved from "Download Agent" to "Agents"
  - Show platform selection (Linux, macOS, Windows)
  - Download pre-configured installers (Phase 9.9)
- [ ] Update navigation
  - "Agents" → Binary download page
  - "Endpoints" → Machines running agents
  - "Jobs" → Job definitions

**Deliverable**: Clear separation in UI between Agents (downloads) and Endpoints (machines)

### 12.8 Agent Configuration

- [ ] Add discovery settings to agent config
  - `discovery.enabled: true` - Enable discovery on enrollment
  - `discovery.import_to_namespace: discovered` - Namespace for imported jobs
  - `reconciliation.remove_unmanaged: false` - Don't remove jobs not in Git
  - `reconciliation.inject_callbacks: true` - Auto-inject check-in callbacks
- [ ] Update agent README with discovery documentation
- [ ] Add discovery troubleshooting guide

**Deliverable**: Configurable job discovery and callback injection

### 12.9 Testing & Validation

- [ ] Backend tests
  - Test endpoint enrollment (renamed from agent)
  - Test job discovery endpoint
  - Test job instance reporting
  - Test cross-reference APIs
- [ ] Agent tests
  - Test scheduler discovery (cron, Task Scheduler)
  - Test callback injection
  - Test job instance reporting
- [ ] Integration tests
  - End-to-end: enroll → discover → sync → reconcile → callback
  - Test with pre-existing cron jobs
  - Test callback success/failure paths
- [ ] Frontend tests
  - Test expandable Jobs page
  - Test expandable Endpoints page
  - Test filtering and search

**Deliverable**: Comprehensive test coverage for Phase 10 features

---

## Development Guidelines

### Component Order
1. **Backend first**: Always implement and test API endpoints before UI
2. **CLI second**: Build CLI commands after API is stable
3. **Frontend last**: Build web UI after CLI validates the API design

### Testing Requirements
- Unit tests for all business logic
- Integration tests for API endpoints
- End-to-end tests for critical user workflows
- Minimum 80% code coverage target

### Code Review Checkpoints
- API design review before implementation
- Security review for authentication/authorization changes
- Performance review for database queries
- UI/UX review for frontend changes

### Documentation Requirements
- API endpoints documented in OpenAPI spec
- CLI commands documented with examples
- Architecture decisions recorded in `docs/`
- Setup instructions for new developers

---

## Timeline Estimates

| Phase | Estimated Duration | Blockers |
|-------|-------------------|----------|
| Phase 1: Foundation & Core Backend | 3-4 weeks | None |
| Phase 2: Basic CLI & Testing | 1-2 weeks | Requires Phase 1 |
| Phase 3: Agent Development | 3-4 weeks | Requires Phase 1 |
| Phase 4: Alerting & Monitoring | 2-3 weeks | Requires Phase 1 |
| Phase 5: Frontend Web Console | 3-4 weeks | Requires Phase 1 |
| Phase 6: GitOps Integration | 2-3 weeks | Requires Phase 1, 3 |
| Phase 7: Internal Admin Dashboard | 2-3 weeks | Requires Phase 1 |
| Phase 8: Production Readiness | 2-3 weeks | Requires all phases |

**Total Estimated Timeline**: 4-6 months for complete implementation

---

## Success Criteria

### MVP (Minimum Viable Product) - End of Phase 2
- ✅ Backend API with job management and check-ins
- ✅ CLI for job management
- ✅ Users can create jobs and receive check-ins from external schedulers
- ✅ Basic test coverage

### Beta Release - End of Phase 6
- ✅ Agent-based scheduler management
- ✅ Web console with dashboard, runs, agents
- ✅ GitOps integration with Forgejo
- ✅ Multi-tenant support
- ⏸️ Alerting and notifications (Phase 4 - deferred)

### Production Release - End of Phase 8
- ✅ GitOps integration
- ✅ Admin dashboard
- ✅ Production deployment ready
- ✅ Complete documentation
- ✅ Security hardened

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cross-platform scheduler compatibility | High | Early testing on Linux and Windows |
| Agent security vulnerabilities | Critical | Code signing, security audits |
| Database performance at scale | Medium | Early load testing, proper indexing |
| GitOps sync reliability | Medium | Retry logic, error handling, manual fallback |
| Multi-tenant data isolation bugs | Critical | Thorough testing, security review |

---

## Next Steps

1. **Immediate**: Set up backend development environment and dependencies
2. **Week 1**: Implement database models and authentication
3. **Week 2**: Build core job management API
4. **Week 3**: Implement check-in system and test with curl
5. **Week 4**: Start CLI development for job management

**First milestone target**: MVP (Phase 1-2) complete in 4-6 weeks
