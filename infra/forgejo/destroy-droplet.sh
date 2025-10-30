#!/bin/bash
set -e

# Destroy Forgejo droplet (volume is preserved)
# Usage: ./destroy-droplet.sh

DROPLET_NAME="forgejo-crontopus"
VOLUME_NAME="forgejo-data-volume"

echo "🦑 Destroying Forgejo droplet"
echo ""

# Check if doctl is installed
if ! command -v doctl &> /dev/null; then
    echo "❌ doctl CLI not found. Install it first:"
    echo "   brew install doctl"
    exit 1
fi

# Find droplet
echo "🔍 Looking for droplet '$DROPLET_NAME'..."
DROPLET_ID=$(doctl compute droplet list --format ID,Name --no-header | grep "$DROPLET_NAME" | awk '{print $1}' || true)

if [ -z "$DROPLET_ID" ]; then
    echo "✅ Droplet '$DROPLET_NAME' not found (already deleted)"
    exit 0
fi

echo "Found droplet: $DROPLET_ID"
echo ""

# Check if volume exists and is attached
VOLUME_ID=$(doctl compute volume list --format ID,Name --no-header | grep "$VOLUME_NAME" | awk '{print $1}' || true)

if [ -n "$VOLUME_ID" ]; then
    echo "📋 Volume status:"
    doctl compute volume get "$VOLUME_ID" --format ID,Name,DropletIDs
    echo ""
    
    echo "⚠️  NOTE: Volume '$VOLUME_NAME' will be preserved and can be reattached"
fi

echo "⚠️  WARNING: This will destroy the droplet '$DROPLET_NAME'"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "🗑️  Deleting droplet..."
doctl compute droplet delete "$DROPLET_ID" --force

echo ""
echo "✅ Droplet destroyed!"
echo ""

if [ -n "$VOLUME_ID" ]; then
    echo "💾 Volume '$VOLUME_NAME' is preserved:"
    doctl compute volume get "$VOLUME_ID" --format ID,Name,Size,DropletIDs
    echo ""
    echo "To recreate the droplet with this volume:"
    echo "  ./create-droplet.sh"
fi
