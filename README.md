# 🦑 Crontopus

**Crontopus** is a proprietary, API-first job scheduling and monitoring platform inspired by GitOps principles.  
It combines the simplicity of cron monitoring (like Cronhub or Healthchecks.io) with the control and security of signed, self-hosted agents (like Rundeck or Jenkins), designed for modern DevOps environments.

---

## 🚀 Architecture Overview

Crontopus is built around a **clean API-first approach**:


- **Backend (FastAPI)** – Core orchestration API exposing REST endpoints for jobs, agents, pings, alerts, and tenants.
- **CLI** – Thin Python wrapper around the public API — provides developer tools such as "crontopus run" and "crontopus agents enroll".
- **Frontend (React)** – Web console for managing jobs, agents, and alerts visually.
- **Agent (Go)** – Lightweight signed service for Linux / Windows that executes jobs and streams logs to the control plane.
- **Internal Admin** – Private dashboard for operators — tenants, billing, and system health.
- **Infra** – Docker and DigitalOcean App Platform specs for prod / dev deploys.

---

## 🧱 Folder Structure

```
crontopus/
├── backend/          # FastAPI backend (core API)
├── frontend/         # React/Tailwind web console
├── cli/              # Python CLI (API wrapper)
├── agent/            # Go agent (executed jobs)
├── internal_admin/   # Internal admin dashboard
├── infra/            # Dockerfiles & App Platform YAMLs
└── docs/             # Architecture, API, and deployment guides
```

---

## 🧩 Key Features

- **Ping Mode** – Any existing scheduler (cron, Jenkins, Kubernetes CronJob) can report back via a simple HTTP ping.  
- **Agent Mode** – Install a secure, signed agent for local job execution and log streaming.  
- **GitOps Integration** – Sync job manifests directly from Git (Gitea, GitHub, Forgejo).  
- **Unified API Surface** – Everything (UI, CLI, agent) uses the same REST endpoints.  
- **Alerts & Metrics** – Built-in notifications (Slack, email, PagerDuty) and Prometheus metrics.  
- **Multi-Tenant & Secure** – Each tenant has isolated agents, jobs, and credentials.

---

## 🧰 Quick Start (Development)

```bash
# clone the repository
git clone https://github.com/youruser/crontopus.git
cd crontopus

# start local dev environment
docker-compose up --build
```

Then visit **http://localhost:8000/docs** for API docs or **http://localhost:5173** for the web console.

---

## ⚙️ Deployment (DigitalOcean)

Crontopus is optimized for **DigitalOcean App Platform**.

```bash
# deploy development environment
doctl apps create --spec infra/app-platform/app-dev.yaml

# deploy production environment
doctl apps create --spec infra/app-platform/app.yaml
```

---

## 💻 CLI Example

```bash
# login with API key
crontopus login --api-key <token>

# list jobs
crontopus jobs list

# run job manually
crontopus run job cleanup

# tail logs
crontopus logs job cleanup
```

---

## 🧠 API-First Philosophy

All functionality is exposed via the REST API first, and both the CLI and Web Console consume the same endpoints.  
This ensures:
- **Consistency** across interfaces  
- **Extensibility** for future SDKs  
- **Automation-friendly** design for DevOps teams  

---

## 📚 Documentation

- `docs/architecture.md` – System and data-flow diagrams
- `docs/api-reference.md` – Auto-generated OpenAPI spec
- `docs/cli-reference.md` – CLI command reference
- `docs/deployment.md` – Deployment steps and configuration
- `docs/agent-protocol.md` – Agent communication protocol
- `docs/roadmap.md` – Planned features and milestones

---

## 🧑‍💻 Contributing

Crontopus is a closed, proprietary system.  
Contributions are currently limited to internal developers and approved partners.

---

## 🪪 License

All rights reserved.  

Crontopus is proprietary software developed and owned by **[Your Company or Name]**.  
Unauthorized copying, distribution, modification, or hosting of this software, in whole or in part, is strictly prohibited without prior written permission from the author.
