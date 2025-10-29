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

### 1. Create Droplet

```bash
# Via DigitalOcean CLI (optional)
doctl compute droplet create forgejo \
    --image ubuntu-22-04-x64 \
    --size s-1vcpu-1gb \
    --region sfo3 \
    --ssh-keys <your-ssh-key-id>

# Or use DigitalOcean web console
```

### 2. Configure Environment

```bash
cd infra/forgejo
cp .env.example .env

# Generate secure password
openssl rand -base64 32

# Edit .env and set POSTGRES_PASSWORD
```

### 3. Update DNS

Create an A record in your DNS provider:
- **Type**: A
- **Name**: git
- **Value**: [droplet IP address]
- **TTL**: 300

### 4. Deploy

```bash
chmod +x deploy.sh
./deploy.sh <droplet_ip>
```

The script will:
- Upload configuration files
- Install Docker
- Obtain SSL certificate
- Start all services

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

## Management

### View Logs

```bash
ssh root@<droplet_ip>
cd /opt/forgejo
docker compose logs -f forgejo
```

### Backup

```bash
# Database backup
docker compose exec db pg_dump -U forgejo forgejo > backup.sql

# Data directory backup
docker compose exec forgejo tar czf - /data > forgejo-data.tar.gz
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
