#!/bin/bash

# Crontopus Deployment Script
# Builds and deploys backend and frontend to DigitalOcean App Platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="registry.digitalocean.com/crontopus-registry"
VERSION="${1:-$(date +%Y%m%d-%H%M%S)}"
APP_ID="${DIGITALOCEAN_APP_ID:-}"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Crontopus Deployment${NC}"
echo -e "${BLUE}  Version: ${VERSION}${NC}"
echo -e "${BLUE}================================================${NC}"

# Check prerequisites
echo ""
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found. Please install Docker.${NC}"
    exit 1
fi

if ! command -v doctl &> /dev/null; then
    echo -e "${RED}✗ doctl CLI not found. Please install: https://docs.digitalocean.com/reference/doctl/how-to/install/${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites satisfied${NC}"

# Authenticate with DigitalOcean Container Registry
echo ""
echo -e "${BLUE}Authenticating with DigitalOcean Container Registry...${NC}"
doctl registry login
echo -e "${GREEN}✓ Authenticated${NC}"

# Build backend image
echo ""
echo -e "${BLUE}Building backend image...${NC}"
docker build \
  -t ${REGISTRY}/backend:${VERSION} \
  -t ${REGISTRY}/backend:latest \
  --platform linux/amd64 \
  ./backend

echo -e "${GREEN}✓ Backend image built${NC}"

# Build frontend image (if Dockerfile exists)
if [ -f "./frontend/Dockerfile" ]; then
  echo ""
  echo -e "${BLUE}Building frontend image...${NC}"
  docker build \
    -t ${REGISTRY}/frontend:${VERSION} \
    -t ${REGISTRY}/frontend:latest \
    --platform linux/amd64 \
    ./frontend

  echo -e "${GREEN}✓ Frontend image built${NC}"
  FRONTEND_BUILT=true
else
  echo ""
  echo -e "${YELLOW}⚠ Frontend Dockerfile not found, skipping frontend build${NC}"
  FRONTEND_BUILT=false
fi

# Push images
echo ""
echo -e "${BLUE}Pushing images to registry...${NC}"

docker push ${REGISTRY}/backend:${VERSION}
docker push ${REGISTRY}/backend:latest
echo -e "${GREEN}✓ Backend images pushed${NC}"

if [ "$FRONTEND_BUILT" = true ]; then
  docker push ${REGISTRY}/frontend:${VERSION}
  docker push ${REGISTRY}/frontend:latest
  echo -e "${GREEN}✓ Frontend images pushed${NC}"
fi

# Create or update App Platform app
echo ""
if [ -z "$APP_ID" ]; then
    echo -e "${BLUE}Checking if App Platform app exists...${NC}"
    
    # Try to find existing app by name
    EXISTING_APP_ID=$(doctl apps list --format ID,Spec.Name --no-header 2>/dev/null | grep "crontopus" | awk '{print $1}' | head -n 1)
    
    if [ -n "$EXISTING_APP_ID" ]; then
        echo -e "${GREEN}✓ Found existing app: ${EXISTING_APP_ID}${NC}"
        APP_ID=$EXISTING_APP_ID
        
        echo -e "${BLUE}Updating app spec...${NC}"
        doctl apps update $APP_ID --spec .do/app.yaml
        echo -e "${GREEN}✓ App spec updated${NC}"
        
        echo -e "${BLUE}Triggering deployment...${NC}"
        doctl apps create-deployment $APP_ID --wait
        echo -e "${GREEN}✓ Deployment complete${NC}"
    else
        echo -e "${BLUE}Creating new App Platform app...${NC}"
        APP_RESPONSE=$(doctl apps create --spec .do/app.yaml --format ID --no-header)
        APP_ID=$APP_RESPONSE
        echo -e "${GREEN}✓ App created: ${APP_ID}${NC}"
        echo -e "${YELLOW}Save this for future deployments:${NC}"
        echo -e "${YELLOW}  export DIGITALOCEAN_APP_ID=${APP_ID}${NC}"
    fi
else
    echo -e "${BLUE}Updating app spec...${NC}"
    doctl apps update $APP_ID --spec .do/app.yaml
    echo -e "${GREEN}✓ App spec updated${NC}"
    
    echo -e "${BLUE}Triggering deployment...${NC}"
    doctl apps create-deployment $APP_ID --wait
    echo -e "${GREEN}✓ Deployment complete${NC}"
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}  Backend: ${REGISTRY}/backend:${VERSION}${NC}"
if [ "$FRONTEND_BUILT" = true ]; then
  echo -e "${GREEN}  Frontend: ${REGISTRY}/frontend:${VERSION}${NC}"
fi
echo -e "${GREEN}================================================${NC}"
