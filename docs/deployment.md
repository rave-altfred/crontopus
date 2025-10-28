# Deployment Guide

## Quick Start - Docker Compose

```bash
docker-compose up -d
docker-compose exec backend alembic upgrade head
```

Backend: http://localhost:8000

## Production - DigitalOcean

1. Update `.do/app.yaml` with your GitHub repo
2. Deploy via DO dashboard
3. Set SECRET_KEY in environment variables
4. Run migrations via console

## Agent Deployment

**Linux/macOS:**
```bash
# Download binary, create config, install as systemd service
# See agent/TESTING.md for details
```

See full documentation in this file for detailed instructions.
