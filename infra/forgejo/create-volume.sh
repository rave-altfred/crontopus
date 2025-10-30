#!/bin/bash
set -e

# Create DigitalOcean Volume for Forgejo (one-time setup)
# This volume persists independently and can be attached to any droplet

VOLUME_NAME="forgejo-data-volume"
VOLUME_SIZE="10"  # GB
REGION="fra1"     # Match your droplet region

echo "🦑 Creating persistent DigitalOcean Volume for Forgejo"
echo ""

# Check if doctl is installed
if ! command -v doctl &> /dev/null; then
    echo "❌ doctl CLI not found. Install it first:"
    echo "   brew install doctl"
    echo "   doctl auth init"
    exit 1
fi

# Check if volume already exists
EXISTING_VOLUME=$(doctl compute volume list --format Name --no-header | grep "^${VOLUME_NAME}$" || true)

if [ -n "$EXISTING_VOLUME" ]; then
    echo "✅ Volume '$VOLUME_NAME' already exists"
    VOLUME_ID=$(doctl compute volume list --format ID,Name --no-header | grep "$VOLUME_NAME" | awk '{print $1}')
    
    echo ""
    echo "📋 Volume Information:"
    doctl compute volume get "$VOLUME_ID" --format ID,Name,Size,Region,DropletIDs
    
    echo ""
    echo "Volume is ready to be attached to droplets."
    exit 0
fi

echo "📦 Creating volume '$VOLUME_NAME' (${VOLUME_SIZE}GB in $REGION)..."
echo ""

VOLUME_ID=$(doctl compute volume create "$VOLUME_NAME" \
    --region "$REGION" \
    --size "${VOLUME_SIZE}GiB" \
    --fs-type ext4 \
    --format ID \
    --no-header)

echo "✅ Volume created successfully!"
echo ""
echo "📋 Volume Information:"
doctl compute volume get "$VOLUME_ID" --format ID,Name,Size,Region,DropletIDs

echo ""
echo "✅ Volume is ready!"
echo ""
echo "Next steps:"
echo "1. This volume will be automatically attached when creating a new droplet"
echo "2. Use ./create-droplet.sh to create a droplet that uses this volume"
echo ""
echo "💡 Backup commands:"
echo "   Create snapshot: doctl compute volume-snapshot create $VOLUME_ID --snapshot-name forgejo-backup-\$(date +%Y%m%d)"
echo "   List snapshots:  doctl compute volume-snapshot list $VOLUME_ID"
