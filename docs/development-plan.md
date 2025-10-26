# 🦑 Crontopus Development Plan

## Project Status

**Current State**: Early scaffolding phase  
**Architecture**: Monorepo with 5 independent components  
**Implementation**: File structure created, awaiting core implementation

---

## Development Philosophy

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

### 1.3 Core Job Management API
- [ ] Design and implement job schema/model
- [ ] Build CRUD endpoints for jobs:
  - `POST /api/jobs` - Create job
  - `GET /api/jobs` - List jobs (tenant-scoped)
  - `GET /api/jobs/{id}` - Get job details
  - `PUT /api/jobs/{id}` - Update job
  - `DELETE /api/jobs/{id}` - Delete job
- [ ] Add job validation logic
- [ ] Implement job scheduling metadata (cron expressions, etc.)

**Deliverable**: Jobs can be created, read, updated, and deleted via API

### 1.4 Ping/Check-in System
- [ ] Design check-in data model (job runs, status, output, timing)
- [ ] Build check-in endpoint:
  - `POST /api/jobs/{id}/checkin` - Report job execution result
- [ ] Implement anonymous check-in via secret tokens
- [ ] Store run history with timestamps and outcomes
- [ ] Build endpoint to retrieve run history:
  - `GET /api/jobs/{id}/runs`

**Deliverable**: External schedulers can report job results to Crontopus

---

## Phase 2: Basic CLI & Testing

### 2.1 CLI Foundation
- [ ] Set up Python CLI project (`cli/pyproject.toml`)
- [ ] Implement `core/api_client.py` - HTTP client wrapper
- [ ] Implement `core/auth.py` - Token storage and management
- [ ] Implement `core/config.py` - CLI configuration
- [ ] Implement `core/formatter.py` - Output formatting (tables, JSON)

**Deliverable**: CLI can authenticate and communicate with backend

### 2.2 Job Management Commands
- [ ] `crontopus auth login` - Authenticate user
- [ ] `crontopus jobs list` - List all jobs
- [ ] `crontopus jobs create` - Create new job (interactive or from YAML)
- [ ] `crontopus jobs get <id>` - Show job details
- [ ] `crontopus jobs delete <id>` - Delete job
- [ ] `crontopus jobs runs <id>` - Show run history

**Deliverable**: Developers can manage jobs via CLI

### 2.3 Testing Infrastructure
- [ ] Set up pytest for backend
- [ ] Write unit tests for job CRUD operations
- [ ] Write unit tests for authentication flow
- [ ] Write integration tests for check-in endpoint
- [ ] Add test coverage reporting

**Deliverable**: Core API functionality has automated test coverage

---

## Phase 3: Agent Development

### 3.1 Agent Foundation
- [ ] Set up Go project structure with `go.mod`
- [ ] Implement configuration loading (YAML/JSON)
- [ ] Build HTTP client for control plane communication
- [ ] Implement agent enrollment flow:
  - Generate enrollment token from backend
  - Agent registers with token and receives credentials
- [ ] Create agent authentication/token refresh mechanism

**Deliverable**: Agent can enroll with backend and maintain authenticated session

### 3.2 Scheduler Abstraction Layer
- [ ] Design scheduler interface (`pkg/scheduler/interface.go`)
- [ ] Implement Linux cron adapter (`pkg/scheduler/cron.go`)
  - Parse crontab format
  - Add/update/remove cron entries
  - Verify entries exist
- [ ] Implement Windows Task Scheduler adapter (`pkg/scheduler/windows.go`)
  - Interface with Task Scheduler API
  - Create/update/delete scheduled tasks
  - Verify task state
- [ ] Add platform detection and scheduler selection

**Deliverable**: Agent can manage native OS schedulers on Linux and Windows

### 3.3 Job Reconciliation Loop
- [ ] Implement sync logic (`pkg/sync/reconcile.go`)
  - Fetch desired state from control plane
  - Compare with current scheduler state
  - Apply differences (create/update/delete)
- [ ] Add reconciliation scheduling (periodic sync)
- [ ] Implement drift detection and correction
- [ ] Add logging and error handling

**Deliverable**: Agent continuously reconciles scheduler state with backend

### 3.4 Agent Backend Integration
- [ ] Build agent management API in backend:
  - `POST /api/agents/enroll` - Enroll new agent
  - `GET /api/agents` - List enrolled agents
  - `GET /api/agents/{id}` - Get agent details
  - `DELETE /api/agents/{id}` - Revoke agent
- [ ] Implement agent-to-job assignment logic
- [ ] Build endpoint for agents to fetch assigned jobs:
  - `GET /api/agents/{id}/jobs`
- [ ] Add agent heartbeat/status tracking

**Deliverable**: Backend can manage agents and provide job manifests

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

### 5.2 Job Management UI
- [ ] Jobs list page with filtering/sorting
- [ ] Job detail page (configuration, run history)
- [ ] Job creation form
- [ ] Job editing interface
- [ ] Run history visualization (timeline, status indicators)

**Deliverable**: Users can manage jobs via web interface

### 5.3 Agent & Alert Management UI
- [ ] Agents list page
- [ ] Agent detail page (status, assigned jobs, heartbeat)
- [ ] Alert rules configuration page
- [ ] Alert history/incidents page
- [ ] Notification channel setup

**Deliverable**: Complete web console for all core features

---

## Phase 6: GitOps Integration

### 6.1 Forgejo Integration
- [ ] Implement Git repository sync worker
- [ ] Design job manifest format (YAML)
- [ ] Build manifest parser and validator
- [ ] Create sync API endpoints (trigger manual sync)
- [ ] Implement webhook handler for automatic sync on push

**Deliverable**: Jobs can be defined in Git and synced to Crontopus

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
