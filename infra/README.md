# Crontopus Infrastructure

This directory contains deployment configurations and scripts for all Crontopus infrastructure components.

## Directory Structure

```
infra/
├── app-platform/          # DigitalOcean App Platform deployment
│   ├── deploy-app-platform.sh   # Deploy backend + frontend to App Platform
│   ├── app.yaml           # App Platform spec (gitignored, contains secrets)
│   ├── app.yaml.example   # Template for app.yaml
│   └── README.md          # App Platform setup guide
│
├── forgejo/               # Forgejo Git server (job manifests)
│   ├── deploy.sh          # Deploy Forgejo to droplet
│   ├── create-droplet.sh  # Create DigitalOcean droplet
│   ├── docker-compose.yml # Forgejo + PostgreSQL + Nginx
│   ├── nginx.conf         # Nginx configuration with SSL
│   ├── secrets/           # Docker secrets (gitignored)
│   └── README.md          # Forgejo setup guide
│
└── docker/                # Local development Docker configs
    ├── Dockerfile.backend
    ├── Dockerfile.agent
    └── docker-compose.yml  # Local dev environment
```

## Deployment Workflows

### App Platform (Backend + Frontend)

Deploy the main Crontopus application:

```bash
cd infra/app-platform
./deploy-app-platform.sh
```

This deploys:
- **Backend** (FastAPI): https://crontopus.com/api
- **Frontend** (React): https://crontopus.com

See [app-platform/README.md](app-platform/README.md) for details.

### Forgejo Git Server

Deploy Forgejo for job manifest storage:

```bash
cd infra/forgejo
./create-droplet.sh          # Create droplet
./deploy.sh <droplet_ip>     # Deploy Forgejo
```

This deploys:
- **Forgejo**: https://git.crontopus.com
- **PostgreSQL**: Database backend
- **Nginx**: Reverse proxy with SSL
- **Certbot**: Automatic SSL renewal

See [forgejo/README.md](forgejo/README.md) for details.

### Agent

Agents are deployed directly on user machines (not in infrastructure). See [agent/README.md](../agent/README.md).

## Secrets Management

- **App Platform**: Secrets in `app.yaml` (gitignored)
- **Forgejo**: Docker secrets in `forgejo/secrets/` (gitignored)
- **Never commit secrets** to version control

## DNS Configuration

All services use custom domains:
- `crontopus.com` → App Platform backend/frontend
- `git.crontopus.com` → Forgejo droplet

DNS records managed via DigitalOcean DNS or external provider.

## Cost Breakdown

| Component | Service | Cost |
|-----------|---------|------|
| Backend + Frontend | App Platform (Basic) | $12/month |
| Database | Managed PostgreSQL | $15/month |
| Forgejo | Droplet (Basic 1GB) | $6/month |
| Container Registry | DigitalOcean Registry | Free |
| **Total** | | **~$33/month** |

## Maintenance

### Update Backend/Frontend

```bash
cd infra/app-platform
./deploy-app-platform.sh
```

### Update Forgejo

```bash
ssh root@<forgejo-ip>
cd /opt/forgejo
docker compose pull forgejo
docker compose up -d forgejo
```

### View Logs

**App Platform:**
```bash
doctl apps logs <app-id> backend --follow
```

**Forgejo:**
```bash
ssh root@<forgejo-ip>
cd /opt/forgejo
docker compose logs -f forgejo
```

## Monitoring

- **App Platform**: Built-in metrics at https://cloud.digitalocean.com/apps
- **Forgejo**: Docker health checks
- **SSL**: Certbot auto-renewal (systemd timer)

## Disaster Recovery

### Backup Forgejo

```bash
ssh root@<forgejo-ip>
cd /opt/forgejo
docker compose exec db pg_dump -U forgejo forgejo > backup.sql
docker compose exec forgejo tar czf - /data > forgejo-data.tar.gz
```

### Restore Forgejo

1. Create new droplet: `./create-droplet.sh`
2. Restore database: `psql < backup.sql`
3. Restore data: `tar xzf forgejo-data.tar.gz -C /`
4. Deploy: `./deploy.sh <ip>`
