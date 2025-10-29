#!/bin/bash
set -e

# Create Forgejo Droplet on DigitalOcean
# Region: fra1 (Frankfurt)
# VPC: 30be8537-17ab-439e-9197-1b26478b2d8d

VPC_ID="30be8537-17ab-439e-9197-1b26478b2d8d"
REGION="fra1"
DROPLET_NAME="forgejo-crontopus"

echo "🦑 Creating Forgejo droplet in $REGION..."

# Get first SSH key ID
SSH_KEY_ID=$(doctl compute ssh-key list --format ID --no-header | head -1)

if [ -z "$SSH_KEY_ID" ]; then
    echo "❌ No SSH keys found in your DigitalOcean account"
    echo "Add one first: doctl compute ssh-key create <name> --public-key-file ~/.ssh/id_rsa.pub"
    exit 1
fi

echo "Using SSH key ID: $SSH_KEY_ID"

# Create droplet
doctl compute droplet create "$DROPLET_NAME" \
    --image ubuntu-22-04-x64 \
    --size s-1vcpu-1gb \
    --region "$REGION" \
    --vpc-uuid "$VPC_ID" \
    --ssh-keys "$SSH_KEY_ID" \
    --tag-names forgejo,crontopus \
    --wait

echo ""
echo "✅ Droplet created successfully!"
echo ""

# Get droplet IP
DROPLET_IP=$(doctl compute droplet list --format Name,PublicIPv4 --no-header | grep "^$DROPLET_NAME" | awk '{print $2}')

echo "Droplet IP: $DROPLET_IP"
echo ""
echo "Next steps:"
echo "1. Update DNS A record: git.crontopus.com -> $DROPLET_IP"
echo "2. Wait 1-2 minutes for droplet to boot"
echo "3. Configure .env file: cd infra/forgejo && cp .env.example .env"
echo "4. Deploy Forgejo: ./deploy.sh $DROPLET_IP"
