#!/bin/bash
set -e

# Forgejo Droplet Deployment Script
# Usage: ./deploy.sh [droplet_ip]

DROPLET_IP="${1:-}"
DOMAIN="git.crontopus.com"
DEPLOY_USER="root"

if [ -z "$DROPLET_IP" ]; then
    echo "Usage: $0 <droplet_ip>"
    echo "Example: $0 159.65.123.45"
    exit 1
fi

echo "🦑 Deploying Forgejo to $DROPLET_IP"

# Check if secrets exist locally
if [ ! -f secrets/postgres_password.txt ]; then
    echo "❌ secrets/postgres_password.txt not found."
    echo "Generate it first:"
    echo "  mkdir -p secrets"
    echo "  openssl rand -base64 32 > secrets/postgres_password.txt"
    exit 1
fi

# Upload deployment files
echo "📤 Uploading deployment files..."
ssh "$DEPLOY_USER@$DROPLET_IP" "mkdir -p /opt/forgejo/secrets"

# Use volume-based docker-compose if volume is mounted, otherwise use regular
if ssh "$DEPLOY_USER@$DROPLET_IP" "mountpoint -q /mnt/forgejo-data" 2>/dev/null; then
    echo "✅ Volume detected, using volume-based configuration"
    scp docker-compose-volume.yml "$DEPLOY_USER@$DROPLET_IP:/opt/forgejo/docker-compose.yml"
else
    echo "⚠️  No volume detected, using Docker volumes"
    scp docker-compose.yml "$DEPLOY_USER@$DROPLET_IP:/opt/forgejo/docker-compose.yml"
fi

scp nginx.conf nginx-init.conf .env "$DEPLOY_USER@$DROPLET_IP:/opt/forgejo/"
scp secrets/postgres_password.txt "$DEPLOY_USER@$DROPLET_IP:/opt/forgejo/secrets/"
ssh "$DEPLOY_USER@$DROPLET_IP" "chmod 600 /opt/forgejo/secrets/postgres_password.txt"

# Install Docker if needed
echo "🐳 Installing Docker..."
ssh "$DEPLOY_USER@$DROPLET_IP" << 'ENDSSH'
    if ! command -v docker &> /dev/null; then
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        rm get-docker.sh
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        apt-get update
        apt-get install -y docker-compose-plugin
    fi
ENDSSH

# Check if postgres data exists on volume
echo "🔍 Checking for existing database..."
if ssh "$DEPLOY_USER@$DROPLET_IP" "[ -d /mnt/forgejo-data/postgres/base ] && [ \"\$(ls -A /mnt/forgejo-data/postgres/base 2>/dev/null)\" ]" 2>/dev/null; then
    echo "✅ Existing database found on volume - will preserve it"
    echo "⚠️  Make sure you're using the SAME postgres password as before!"
    echo ""
    read -p "Continue with deployment? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment aborted."
        exit 1
    fi
    EXISTING_DB=true
else
    echo "📋 No existing database found - will create new one"
    EXISTING_DB=false
fi

# Start all services
# Install certbot and get SSL certificate
echo "🔒 Setting up SSL certificate..."
ssh "$DEPLOY_USER@$DROPLET_IP" << 'ENDSSH'
    # Install certbot if not present
    if ! command -v certbot &> /dev/null; then
        snap install --classic certbot
        ln -sf /snap/bin/certbot /usr/bin/certbot
    fi
    
    # If using volume and certificates exist there, restore them first
    if mountpoint -q /mnt/forgejo-data 2>/dev/null && [ -d "/mnt/forgejo-data/letsencrypt/live" ]; then
        echo "📋 Restoring SSL certificates from volume..."
        mkdir -p /etc/letsencrypt
        cp -av /mnt/forgejo-data/letsencrypt/* /etc/letsencrypt/
        echo "✅ Certificates restored from volume"
    fi
    
    # Check if certificate exists
    if [ ! -d "/etc/letsencrypt/live/git.crontopus.com" ]; then
        echo "Obtaining SSL certificate..."
        cd /opt/forgejo
        
        # Start services without nginx first
        docker compose up -d db forgejo
        sleep 10
        
        # Get certificate using standalone mode
        certbot certonly --standalone \
            -d git.crontopus.com \
            --non-interactive \
            --agree-tos \
            --email admin@crontopus.com
        
        # Create renewal hooks
        mkdir -p /etc/letsencrypt/renewal-hooks/pre /etc/letsencrypt/renewal-hooks/post
        
        cat > /etc/letsencrypt/renewal-hooks/pre/stop-nginx.sh << 'HOOK'
#!/bin/bash
cd /opt/forgejo && docker compose stop nginx
HOOK
        chmod +x /etc/letsencrypt/renewal-hooks/pre/stop-nginx.sh
        
        cat > /etc/letsencrypt/renewal-hooks/post/start-nginx.sh << 'HOOK'
#!/bin/bash
cd /opt/forgejo && docker compose start nginx
HOOK
        chmod +x /etc/letsencrypt/renewal-hooks/post/start-nginx.sh
    else
        echo "SSL certificate already exists"
    fi
    
    # If using volume, sync certificates to volume
    if mountpoint -q /mnt/forgejo-data 2>/dev/null; then
        echo "📋 Syncing SSL certificates to volume..."
        mkdir -p /mnt/forgejo-data/letsencrypt
        cp -av /etc/letsencrypt/* /mnt/forgejo-data/letsencrypt/
        echo "✅ Certificates synced to volume"
    fi
ENDSSH

# Start all services
echo "🚀 Starting Forgejo services..."
ssh "$DEPLOY_USER@$DROPLET_IP" << 'ENDSSH'
    cd /opt/forgejo
    docker compose up -d
    
    echo "⏳ Waiting for services to be ready..."
    sleep 10
    
    docker compose ps
ENDSSH

echo ""
echo "✅ Forgejo deployed successfully!"
echo ""

# Check if volume is in use
if ssh "$DEPLOY_USER@$DROPLET_IP" "mountpoint -q /mnt/forgejo-data" 2>/dev/null; then
    echo "💾 Storage: Using DigitalOcean Volume at /mnt/forgejo-data"
    ssh "$DEPLOY_USER@$DROPLET_IP" "df -h /mnt/forgejo-data"
else
    echo "💾 Storage: Using Docker volumes"
fi

echo ""
echo "Next steps:"
echo "1. Point DNS A record for git.crontopus.com to $DROPLET_IP"
echo "2. Wait for DNS propagation (1-5 minutes)"
echo "3. Visit https://git.crontopus.com to complete setup"
echo "4. Create admin user and initial organization"
echo ""
echo "To view logs: ssh $DEPLOY_USER@$DROPLET_IP 'cd /opt/forgejo && docker compose logs -f'"
