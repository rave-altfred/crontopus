# 🧪 Comprehensive Test Plan for Crontopus

## 1. Testing Philosophy
We follow the **Test Pyramid** approach:
- **Unit Tests** (70%): Fast, isolated tests for individual components.
- **Integration Tests** (20%): Verifying interactions between components (API ↔ DB, Agent ↔ OS).
- **E2E Tests** (10%): Full user flows ensuring the system works as a whole.

All tests must run in **CI (GitHub Actions)** to prevent regressions. Local testing should be easy via `make test`.

---

## 2. Backend Testing (FastAPI)
**Goal**: 90% Coverage, robust integration testing.

### 2.1 Unit Tests
- **Framework**: `pytest`
- **Focus**:
  - Business logic in `services/`
  - Request validation in `schemas/`
  - Utility functions
- **Mocking**: Use `unittest.mock` or `pytest-mock` for external services (Forgejo API, Redis, SMTP).

### 2.2 Integration Tests
- **Database**: Move from SQLite to **PostgreSQL** (via `testcontainers` or Docker service) to match production behavior (JSONB, array types, locking).
- **Redis**: Test rate limiting logic against a real Redis instance.
- **Forgejo**: Mock HTTP responses from Forgejo but verify the *client logic* handles auth, errors, and retries correctly.

### 2.3 API Contract Tests
- Verify that endpoints return data matching the OpenAPI schema.
- Tools: `schemathesis` or manual property checks.

---

## 3. Agent Testing (Go)
**Current Status**: Manual script (`test-agent.sh`), some scheduler tests.
**Goal**: Robust automated testing for all platforms.

### 3.1 Unit Tests
- **Framework**: Go standard `testing` + `testify/assert`.
- **Coverage**:
  - `pkg/config`: Parsing and validation.
  - `pkg/manifest`: YAML parsing, UUID generation.
  - `pkg/git`: Sync logic (mocking the `git` command or library).
  - `pkg/scheduler`: Platform-specific adapters (Linux/macOS/Windows).

### 3.2 Scheduler Integration Tests
- **Linux**: Run tests in a Docker container with `cron` installed. Verify `crontab -l` matches expectation.
- **Windows**: Use GitHub Actions Windows runners to test Task Scheduler interaction (`schtasks`).
- **Drift Detection**: Verify agent correctly identifies and rectifies drift between Git and OS.

### 3.3 Mock Backend
- Create a lightweight HTTP stub server in Go to simulate Backend API (`/enroll`, `/checkin`, `/heartbeat`).
- Verify Agent handles network partitions (retries, backoff).

---

## 4. Frontend Testing (React)
**Goal**: Catch UI regressions and logic errors.

### 4.1 Unit & Component Tests
- **Framework**: **Vitest** (fast, compatible with Vite) + **React Testing Library**.
- **Focus**:
  - Form validation (Login, Register, JobNew).
  - Complex components (`ManifestViewer`, Log tables).
  - Custom hooks (`useAuth`, `useTheme`).
  - Utility functions.

### 4.2 Snapshot Testing
- Capture DOM structure of static pages (Dashboard layouts) to catch accidental layout shifts.

---

## 5. End-to-End (E2E) Testing
**Framework**: **Playwright** (TypeScript).
**Why Playwright?**: Excellent trace viewer, auto-waiting, and multiple browser support.

### 5.1 Critical User Flows
1.  **Onboarding**: Register -> Login -> Dashboard load.
2.  **Job Management**:
    *   Create Job (UI) -> Verify calls API -> Verify backend commits to Git (mocked).
    *   Edit Job -> Verify updates.
    *   Delete Job.
3.  **Agent Download**: Verify "Download Agent" wizard generates correct token/script.
4.  **Visual Regression**: Verify Dark Mode/Light Mode rendering.

### 5.2 Infrastructure
- Spin up the full stack (Backend, Frontend, Postgres, Redis) using `docker-compose` in CI.
- Seed database with test user/tenant.

---

## 6. Performance & Load Testing
**Tools**: **k6** (JavaScript-based, easy to version control).

### 6.1 Scenarios
- **Check-in Storm**: Simulate 1,000 agents sending check-ins simultaneously. Verify Backend/Redis handles the load.
- **Rate Limiting**: Verify `429 Too Many Requests` is returned when limits are exceeded.
- **Git Sync**: Test backend performance when creating 100 jobs rapidly (Git lock contention).

---

## 7. Security Testing
- **Static Analysis (SAST)**:
  - Python: `bandit`, `ruff`
  - Go: `gosec`
  - JS/TS: `npm audit`
- **Dependency Scanning**: Dependabot or Renovate.
- **Secret Scanning**: `trufflehog` or `gitleaks` in CI to prevent committing tokens.

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [x] **Backend**: Switch `pytest` to use Dockerized Postgres.
- [x] **Frontend**: Setup Vitest + React Testing Library. Write tests for `Login` and `Register`.
- [x] **Agent**: Refactor `scheduler` package to use interfaces for easier mocking.

### Phase 2: Integration (Weeks 3-4)
- [ ] **Agent**: Add Docker-based cron integration tests.
- [ ] **Backend**: Add Redis rate-limiting tests.
- [x] **CI**: Setup GitHub Actions for Frontend/Backend/Agent unit tests.

### Phase 3: E2E & Performance (Weeks 5-6)
- [ ] **E2E**: Setup Playwright. Implement "Critical User Flows".
- [ ] **Load**: Write k6 script for check-in storm.

---

## 9. Test Data Management
Since Crontopus is GitOps-based, testing involves real Git repositories.
- **Unit/Integration**: Mock the `ForgejoClient` to avoid network calls.
- **E2E**: Use a **temporary, ephemeral Git server** (e.g., a fresh containerized Gitea/Forgejo instance) or a "test" organization in the real Forgejo instance that gets wiped after tests.
