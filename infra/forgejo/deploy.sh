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
scp docker-compose.yml nginx.conf nginx-init.conf .env "$DEPLOY_USER@$DROPLET_IP:/opt/forgejo/"
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

# Initial SSL certificate with certbot
echo "🔒 Setting up SSL certificate..."
ssh "$DEPLOY_USER@$DROPLET_IP" << 'ENDSSH'
    cd /opt/forgejo
    
    # Check if certificate already exists
    CERT_PATH="/var/lib/docker/volumes/forgejo_certbot_conf/_data/live/git.crontopus.com"
    if [ ! -d "$CERT_PATH" ]; then
        echo "Obtaining SSL certificate..."
        
        # Use HTTP-only nginx config for certificate acquisition
        cp nginx-init.conf nginx.conf.active
        
        # Start services with HTTP-only nginx
        docker compose up -d db
        sleep 5
        docker compose up -d nginx
        sleep 10
        
        # Get certificate
        docker compose run --rm certbot certonly --webroot \
            --webroot-path /var/www/certbot \
            --email admin@crontopus.com \
            --agree-tos \
            --no-eff-email \
            -d git.crontopus.com
        
        # Switch to SSL nginx config
        cp nginx.conf nginx.conf.active
        docker compose restart nginx
    else
        echo "SSL certificate already exists"
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
echo "Next steps:"
echo "1. Point DNS A record for git.crontopus.com to $DROPLET_IP"
echo "2. Wait for DNS propagation (1-5 minutes)"
echo "3. Visit https://git.crontopus.com to complete setup"
echo "4. Create admin user and initial organization"
echo ""
echo "To view logs: ssh $DEPLOY_USER@$DROPLET_IP 'cd /opt/forgejo && docker compose logs -f'"
