#!/bin/bash
# Docker cleanup script - keeps only latest images and removes dangling resources

echo "🧹 Cleaning up Docker resources..."

# Remove stopped containers
echo "Removing stopped containers..."
docker container prune -f

# Remove dangling images (untagged)
echo "Removing dangling images..."
docker image prune -f

# Remove unused volumes
echo "Removing unused volumes..."
docker volume prune -f

# Remove unused networks
echo "Removing unused networks..."
docker network prune -f

# Keep only latest tagged images for crontopus components
echo "Cleaning old crontopus images (keeping latest)..."
for component in backend agent; do
    # Get all images for this component except latest
    images=$(docker images --filter=reference="crontopus-${component}:*" --format "{{.ID}} {{.Tag}}" | grep -v latest | awk '{print $1}')
    if [ ! -z "$images" ]; then
        echo "Removing old ${component} images..."
        echo "$images" | xargs -r docker rmi -f
    fi
done

# Show remaining images
echo ""
echo "📦 Remaining images:"
docker images | grep crontopus || echo "No crontopus images found"

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Disk space reclaimed:"
docker system df
