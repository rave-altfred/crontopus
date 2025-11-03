#!/bin/bash
set -e

# Create Forgejo Droplet on DigitalOcean
# Region: fra1 (Frankfurt)
# VPC: 803fc5f1-6165-4f81-8b92-a055a62f6292 (app-platform VPC)
# Automatically attaches persistent volume and sets up mount

VPC_ID="803fc5f1-6165-4f81-8b92-a055a62f6292"
REGION="fra1"
DROPLET_NAME="forgejo-crontopus"
VOLUME_NAME="forgejo-data-volume"
MOUNT_POINT="/mnt/forgejo-data"

echo "🦑 Creating Forgejo droplet in $REGION..."
echo ""

# Check if volume exists
echo "🔍 Checking for volume '$VOLUME_NAME'..."
VOLUME_ID=$(doctl compute volume list --format ID,Name --no-header | grep "$VOLUME_NAME" | awk '{print $1}' || true)

if [ -z "$VOLUME_ID" ]; then
    echo "❌ Volume '$VOLUME_NAME' not found."
    echo "Create it first: ./create-volume.sh"
    exit 1
fi

echo "✅ Found volume: $VOLUME_ID"
echo ""

# Check if volume is attached to another droplet
ATTACHED_TO=$(doctl compute volume get "$VOLUME_ID" --format DropletIDs --no-header)
if [ -n "$ATTACHED_TO" ] && [ "$ATTACHED_TO" != "" ]; then
    echo "⚠️  Volume is currently attached to droplet: $ATTACHED_TO"
    echo "Detaching..."
    doctl compute volume-action detach "$VOLUME_ID" "$ATTACHED_TO" --wait
    echo "✅ Volume detached"
    echo ""
fi

# Get first SSH key ID
SSH_KEY_ID=$(doctl compute ssh-key list --format ID --no-header | head -1)

if [ -z "$SSH_KEY_ID" ]; then
    echo "❌ No SSH keys found in your DigitalOcean account"
    echo "Add one first: doctl compute ssh-key create <name> --public-key-file ~/.ssh/id_rsa.pub"
    exit 1
fi

echo "Using SSH key ID: $SSH_KEY_ID"

# Create droplet with user-data for volume mounting
echo "📦 Creating droplet with volume mounting script..."

cat > /tmp/forgejo-user-data.sh << 'USERDATA'
#!/bin/bash
# Droplet initialization script - runs on first boot

MOUNT_POINT="/mnt/forgejo-data"
DEVICE="/dev/disk/by-id/scsi-0DO_Volume_forgejo-data-volume"

# Wait for volume device to appear
echo "Waiting for volume device..."
for i in {1..30}; do
    if [ -e "$DEVICE" ]; then
        break
    fi
    sleep 2
done

if [ ! -e "$DEVICE" ]; then
    echo "Volume device not found after 60 seconds"
    exit 1
fi

# Create mount point
mkdir -p "$MOUNT_POINT"

# Check if volume is formatted
if ! blkid "$DEVICE" &>/dev/null; then
    echo "Formatting volume as ext4..."
    mkfs.ext4 -F "$DEVICE"
fi

# Mount volume
echo "Mounting volume..."
mount -o discard,defaults,noatime "$DEVICE" "$MOUNT_POINT"

# Add to fstab for persistent mount
if ! grep -q "$DEVICE" /etc/fstab; then
    echo "$DEVICE $MOUNT_POINT ext4 defaults,nofail,discard,noatime 0 0" >> /etc/fstab
fi

chmod 755 "$MOUNT_POINT"

echo "Volume mounted at $MOUNT_POINT"
USERDATA

doctl compute droplet create "$DROPLET_NAME" \
    --image ubuntu-22-04-x64 \
    --size s-1vcpu-1gb \
    --region "$REGION" \
    --vpc-uuid "$VPC_ID" \
    --ssh-keys "$SSH_KEY_ID" \
    --tag-names forgejo,crontopus \
    --user-data-file /tmp/forgejo-user-data.sh \
    --wait

rm /tmp/forgejo-user-data.sh

echo ""
echo "✅ Droplet created successfully!"
echo ""

# Get droplet info
DROPLET_INFO=$(doctl compute droplet list --format Name,PublicIPv4,ID --no-header | grep "^$DROPLET_NAME")
DROPLET_IP=$(echo "$DROPLET_INFO" | awk '{print $2}')
DROPLET_ID=$(echo "$DROPLET_INFO" | awk '{print $3}')

echo "Droplet IP: $DROPLET_IP"
echo "Droplet ID: $DROPLET_ID"
echo ""

# Attach volume to droplet
echo "🔗 Attaching volume to droplet..."
doctl compute volume-action attach "$VOLUME_ID" "$DROPLET_ID" --wait
echo "✅ Volume attached"
echo ""

echo "⏳ Waiting for droplet to boot and mount volume (60 seconds)..."
sleep 60

# Verify mount
echo "🔍 Verifying volume mount..."
if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "root@$DROPLET_IP" "mountpoint -q $MOUNT_POINT && df -h $MOUNT_POINT" 2>/dev/null; then
    echo "✅ Volume successfully mounted at $MOUNT_POINT"
else
    echo "⚠️  Volume mount verification failed. You may need to mount manually."
    echo "   SSH to droplet and check: ssh root@$DROPLET_IP"
fi

echo ""
echo "✅ Droplet setup complete!"
echo ""
echo "Next steps:"
echo "1. Update DNS A record: git.crontopus.com -> $DROPLET_IP"
echo "2. Configure secrets: mkdir -p secrets && openssl rand -base64 32 > secrets/postgres_password.txt"
echo "3. Deploy Forgejo: ./deploy.sh $DROPLET_IP"
