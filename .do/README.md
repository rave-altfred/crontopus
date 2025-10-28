# DigitalOcean Deployment Setup

## Prerequisites

1. **DigitalOcean Account** with billing enabled
2. **GitHub Repository** with code pushed
3. **DigitalOcean Personal Access Token** with write access

## Setup Steps

### 1. Container Registry

**Already created:** `crontopus-registry`

Verify access:
```bash
doctl registry login
docker pull registry.digitalocean.com/crontopus-registry/backend:latest
```

### 2. Configure GitHub Secrets

Add these secrets to your GitHub repository:
- Go to **Settings → Secrets and variables → Actions**
- Add:
  - `DIGITALOCEAN_ACCESS_TOKEN`: Your DO personal access token

### 3. Configuration

**Already configured:**
- Registry: `crontopus-registry` 
- VPC: `fra1-crontopus-vpc` (Frankfurt)
- Database: Existing PostgreSQL cluster
- Region: `fra1`

### 4. Push to Trigger Build

```bash
git add .
git commit -m "Configure DO registry"
git push origin main
```

This will trigger GitHub Actions to:
1. Build Docker images
2. Push to DO Container Registry
3. Tag with `latest` and commit SHA

### 5. Deploy App

**Via Dashboard:**
1. Go to **Apps → Create App**
2. Select **From Container Registry**
3. Choose `your-registry-name/backend:latest`
4. Click **Import App Spec** → Upload `.do/app.yaml`
5. Set environment variables (especially `SECRET_KEY`)
6. Click **Create Resources**

**Via CLI:**
```bash
doctl apps create --spec .do/app.yaml
```

### 6. Run Database Migrations

After first deployment:
```bash
# Via console in DO dashboard
doctl apps create-deployment <app-id> --wait

# Then run migrations in console
alembic upgrade head
```

## Subsequent Deployments

Once set up, deployments are automatic:
1. Push to `main` branch
2. GitHub Actions builds and pushes to registry
3. DO App Platform auto-deploys new image

## Cost Optimization

**Container Registry:**
- Basic Plan: $5/month (500GB bandwidth)
- Storage: $0.02/GB/month

**App Platform (Current Plans):**
- `apps-s-1vcpu-0.5gb`: $5/month (512MB RAM, 50GB bandwidth) - Starter
- `apps-s-1vcpu-1gb-fixed`: $10/month (1GB RAM, 100GB bandwidth) - Fixed
- `apps-s-1vcpu-1gb`: $12/month (1GB RAM, 150GB bandwidth, manual scaling) - **Recommended**

**Database:**
- Development: $7/month (0.25 vCPU, 512MB RAM)
- Basic Production: $15/month (1 vCPU, 1GB RAM, 10GB storage)

**Total minimal setup:**
- Starter: $5 (registry) + $5 (app) + $7 (dev DB) = **$17/month**
- Recommended: $5 (registry) + $12 (app) + $15 (prod DB) = **$32/month**

## Troubleshooting

**Registry authentication fails:**
```bash
# Test registry access
doctl registry login
docker pull registry.digitalocean.com/your-registry-name/backend:latest
```

**App won't start:**
- Check logs in App → Runtime Logs
- Verify environment variables
- Ensure migrations ran

**Images not updating:**
- Check GitHub Actions logs
- Verify `autodeploy: true` in app.yaml
- Manually trigger deployment: `doctl apps create-deployment <app-id>`
