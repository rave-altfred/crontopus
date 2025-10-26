# 🦑 Crontopus

**Crontopus** is a proprietary, API-first job scheduling and monitoring platform inspired by GitOps principles.  
It combines the simplicity of “ping-based” cron monitoring with the control of an optional signed agent that manages native OS schedulers.

---

## 🚀 Architecture Overview

Crontopus is built around a **clean API-first approach**:

- **Backend (FastAPI)** — Core orchestration API exposing REST endpoints for jobs, agents, pings (check-ins), alerts, and tenants.  
- **CLI** — Thin Python wrapper around the public API; provides developer tools such as `crontopus run` and `crontopus agents enroll`.  
- **Frontend (React)** — Web console for managing jobs, agents, runs, and alerts.  
- **Agent (Go)** — Lightweight **signed** service for Linux/Windows that **creates, updates, removes, and verifies native scheduler entries (cron / Task Scheduler)** based on Git-backed manifests and control-plane policy. **Schedulers execute jobs; the agent does not.** Job outcomes are reported by the scheduler via **check-ins to the control plane**.  
- **Internal Admin** — Private dashboard for operators (tenants, plans, system health).  
- **Infra** — Dockerfiles and DigitalOcean App Platform specs for prod/dev deployments.

---

## 🧱 Folder Structure

```
crontopus/
├── backend/          # FastAPI backend (core API)
├── frontend/         # React/Tailwind web console
├── cli/              # Python CLI (API wrapper)
├── agent/            # Go agent (manages native schedulers)
├── internal_admin/   # Internal admin dashboard
├── infra/            # Dockerfiles & App Platform YAMLs
└── docs/             # Architecture, API, and deployment guides
```

---

## 🧩 Key Features

- **Ping Mode (Agent Optional)** — Any existing scheduler (cron, Jenkins, Windows Task Scheduler, Kubernetes CronJob, etc.) includes a simple HTTP **check-in** to report run results directly to Crontopus.  
- **Agent Mode (Native Scheduler Management)** — Install a signed agent to **apply and reconcile job definitions** on the local OS scheduler (create/update/remove, enable/disable), handle token rotation, and enforce schedule/policy constraints. **The agent never executes jobs.**  
- **GitOps Integration** — Sync job manifests and policies from Git **Forgejo**.  
- **API First Development** — UI and CLI both talk to the same REST endpoints.  
- **Alerts & Metrics** — Slack/email/PagerDuty notifications and Prometheus metrics.  
- **Multi-Tenant & Secure** — Isolated tenants; signed agent enrollment; no inbound ports required.

---

## 🧠 API-First Philosophy

All functionality is exposed via the REST API first; both the CLI and Web Console consume the same endpoints.  
This ensures:
- **Consistency** across interfaces  
- **Extensibility** for future SDKs/integrations  
- **Automation-friendly** design for DevOps teams  

---

## 🪪 License

All rights reserved.  

Crontopus is proprietary software developed and owned by **[Your Company or Name]**.  
Unauthorized copying, distribution, modification, or hosting of this software, in whole or in part, is strictly prohibited without prior written permission.