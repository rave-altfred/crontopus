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
- [ ] `crontopus agents enroll` - Generate enrollment token
- [ ] `crontopus agents list` - List all agents
- [ ] `crontopus agents revoke <id>` - Revoke agent credentials

**Deliverable**: Operators can manage agents via CLI

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
- [ ] Set up React project with TypeScript and Tailwind CSS
- [ ] Configure build tooling (Vite or Create React App)
- [ ] Implement routing (React Router)
- [ ] Create authentication flow (login/logout)
- [ ] Build API client layer (`src/api/`)
- [ ] Set up state management (Context API or Zustand)

**Deliverable**: Basic web app with authentication

### 5.2 Job & Run History UI
- [ ] Jobs list page (reads from Forgejo via API, not database)
- [ ] Job detail page (shows manifest content from Git + run history from DB)
- [ ] Run history visualization (timeline, status indicators)
- [ ] Link to edit job in Git (opens Forgejo)
- [ ] Job manifest viewer (syntax highlighting)

**Deliverable**: Users can view jobs (from Git) and run history via web interface

**Note**: Job editing happens in Git, not in web UI. UI provides link to Forgejo for editing.

### 5.3 Agent & Alert Management UI
- [ ] Agents list page
- [ ] Agent detail page (status, assigned jobs, heartbeat)
- [ ] Alert rules configuration page
- [ ] Alert history/incidents page
- [ ] Notification channel setup

**Deliverable**: Complete web console for all core features

---

## Phase 6: GitOps Integration (MOVED TO PHASE 1.3)

### 6.1 Job Manifest Format (Part of Phase 1.3)
- [ ] Design job manifest YAML schema
- [ ] Create example job manifests
- [ ] Document manifest structure
- [ ] Build manifest parser and validator

**Note**: This is now part of Phase 1.3. Agent reads manifests directly from Git.

### 6.2 Forgejo Repository Setup
- [ ] Create example job repository structure
- [ ] Set up Forgejo instance (or use existing)
- [ ] Configure repository access for agents
- [ ] Document Git workflow for job management

**Deliverable**: Job manifest repository is ready for agents to clone

### 6.2 Manifest Validation & CI
- [ ] Build manifest validation CLI tool
- [ ] Create pre-commit hooks
- [ ] Add CI pipeline example for manifest validation
- [ ] Implement diff preview before sync

**Deliverable**: Teams can use GitOps workflows for job management

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

### 8.2 Performance & Scalability
- [ ] Add database indexing strategy
- [ ] Implement query optimization
- [ ] Add Redis caching layer
- [ ] Set up background job queue (Celery or similar)
- [ ] Load testing and optimization

**Deliverable**: System handles production-scale workloads

### 8.3 Deployment & Infrastructure
- [ ] Create production Dockerfiles (`infra/`)
- [ ] Write docker-compose.yml for local development
- [ ] Create DigitalOcean App Platform deployment specs
- [ ] Document backup and recovery procedures
- [ ] Set up CI/CD pipelines
- [ ] Create deployment runbooks

**Deliverable**: Production deployment ready

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

### Beta Release - End of Phase 5
- ✅ Agent-based scheduler management
- ✅ Web console for all features
- ✅ Alerting and notifications
- ✅ Multi-tenant support

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
