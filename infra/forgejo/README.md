# Forgejo Deployment for Crontopus

Forgejo hosts the Git repositories containing job manifests for Crontopus agents.

## Architecture

- **Forgejo**: Self-hosted Git service (port 3000, 22)
- **PostgreSQL**: Database backend
- **Nginx**: Reverse proxy with SSL
- **Certbot**: Automatic SSL certificate management

## Prerequisites

1. **DigitalOcean Droplet**: $6/month Basic droplet (Ubuntu 22.04)
2. **DNS**: A record for `git.crontopus.com` pointing to droplet IP
3. **SSH Access**: Root access to droplet

## Deployment Steps

### 0. Create Volume (One-Time Setup)

```bash
cd infra/forgejo
./create-volume.sh
```

This creates a persistent 10GB volume that survives droplet recreation.

### 1. Create Droplet

```bash
./create-droplet.sh
```

This script will:
- Check if volume exists (or prompt you to create it)
- Detach volume from old droplet if needed
- Create new droplet with auto-mount configuration
- Attach volume to new droplet
- Verify volume is mounted at `/mnt/forgejo-data`

### 2. Configure Secrets

```bash
cd infra/forgejo

# Generate secure password
mkdir -p secrets
openssl rand -base64 32 > secrets/postgres_password.txt
```

### 3. Update DNS

Create an A record in your DNS provider:
- **Type**: A
- **Name**: git
- **Value**: [droplet IP address]
- **TTL**: 300

### 4. Deploy

```bash
./deploy.sh <droplet_ip>
```

The script will:
- Upload configuration files and secrets
- Detect if volume is mounted and use appropriate docker-compose config
- Install Docker and Docker Compose
- Install certbot and obtain SSL certificate
- Set up automatic certificate renewal hooks
- Start all services (PostgreSQL, Forgejo, Nginx)

**Note**: The script is idempotent and volume-aware. It automatically uses volume-based storage if mounted.

### 5. Complete Forgejo Setup

1. Visit `https://git.crontopus.com`
2. Complete initial setup wizard:
   - Database is already configured
   - Set admin username/password
   - Set base URL to `https://git.crontopus.com`
3. Create organization: `crontopus`
4. Create repository: `job-manifests`

## Post-Deployment

### Create Job Manifests Repository

```bash
# Clone and initialize
git clone https://git.crontopus.com/crontopus/job-manifests.git
cd job-manifests

# Create directory structure
mkdir -p production staging
touch README.md

# Add example job
cat > production/backup-db.yaml << 'EOF'
apiVersion: v1
kind: Job
metadata:
  name: backup-database
  namespace: production
spec:
  schedule: "0 2 * * *"
  command: "/usr/local/bin/backup-db.sh"
  timeout: 300
  retryPolicy: "OnFailure"
  maxRetries: 2
EOF

git add .
git commit -m "Initial job manifests"
git push origin main
```

### Configure Agent Access

Agents need read access to the repository. Options:

**Option A: Deploy Key (recommended for agents)**
```bash
# On agent machine
ssh-keygen -t ed25519 -C "crontopus-agent-prod"

# Add public key to repository settings -> Deploy Keys
```

**Option B: Access Token**
```bash
# In Forgejo: Settings -> Applications -> Generate Token
# Scope: read:repository
```

### Update Agent Configuration

```yaml
# agent/config.yaml
git:
  url: "https://git.crontopus.com/crontopus/job-manifests.git"
  branch: "main"
  auth:
    type: "ssh"  # or "token"
    key_path: "/etc/crontopus/deploy_key"
```

## Droplet Lifecycle

### Destroy and Recreate

With persistent volumes, you can safely destroy and recreate droplets:

```bash
# Destroy droplet (volume is preserved)
./destroy-droplet.sh

# Create new droplet (attaches existing volume)
./create-droplet.sh

# Deploy Forgejo (detects volume, uses existing data)
./deploy.sh <new_droplet_ip>
```

All Git repositories and PostgreSQL data persist on the volume.

## Management

### View Logs

```bash
ssh root@<droplet_ip>
cd /opt/forgejo
docker compose logs -f forgejo
```

### Backup

**Recommended: Volume Snapshots**
```bash
# Create snapshot of entire volume (includes DB + repos)
doctl compute volume-snapshot create forgejo-data-volume \
    --snapshot-name "forgejo-backup-$(date +%Y%m%d-%H%M)"

# List snapshots
doctl compute volume-snapshot list forgejo-data-volume

# Restore from snapshot (create new volume)
doctl compute volume create forgejo-data-restored \
    --snapshot <snapshot-id> \
    --region fra1
```

**Manual Backups**
```bash
# SSH to droplet
ssh root@<droplet_ip>

# Database backup
cd /opt/forgejo
docker compose exec db pg_dump -U forgejo forgejo > /mnt/forgejo-data/backup.sql

# Or full volume tar
tar czf /root/forgejo-backup.tar.gz /mnt/forgejo-data/
```

### Update Forgejo

```bash
ssh root@<droplet_ip>
cd /opt/forgejo
docker compose pull forgejo
docker compose up -d forgejo
```

### Restart Services

```bash
ssh root@<droplet_ip>
cd /opt/forgejo
docker compose restart
```

## Troubleshooting

### SSL Certificate Issues

```bash
# Manually renew certificate
docker compose run --rm certbot renew

# Check certificate status
docker compose exec nginx ls -la /etc/letsencrypt/live/git.crontopus.com/
```

### Database Connection Issues

```bash
# Check database logs
docker compose logs db

# Connect to database
docker compose exec db psql -U forgejo -d forgejo
```

### Port Conflicts

If ports 80, 443, or 22 are in use:
```bash
# Check what's using the port
sudo lsof -i :80
sudo lsof -i :443
sudo lsof -i :22

# Stop conflicting service (e.g., Apache)
sudo systemctl stop apache2
```

## Security Considerations

1. **Firewall**: Configure UFW to only allow 80, 443, and 22
2. **SSH**: Disable password auth, use keys only
3. **Backups**: Set up automated daily backups
4. **Updates**: Keep Forgejo and system packages updated
5. **Access**: Use deploy keys instead of user credentials for agents

## Cost

- **Droplet**: $6/month (1GB RAM, 25GB SSD)
- **Bandwidth**: Included (1TB/month)
- **Backups**: Optional $1.20/month

**Total**: ~$6-7/month
