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
REGISTRY="registry.digitalocean.com/crontopus"
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

# Build frontend image
echo ""
echo -e "${BLUE}Building frontend image...${NC}"
docker build \
  -t ${REGISTRY}/frontend:${VERSION} \
  -t ${REGISTRY}/frontend:latest \
  --platform linux/amd64 \
  ./frontend

echo -e "${GREEN}✓ Frontend image built${NC}"

# Push images
echo ""
echo -e "${BLUE}Pushing images to registry...${NC}"

docker push ${REGISTRY}/backend:${VERSION}
docker push ${REGISTRY}/backend:latest
echo -e "${GREEN}✓ Backend images pushed${NC}"

docker push ${REGISTRY}/frontend:${VERSION}
docker push ${REGISTRY}/frontend:latest
echo -e "${GREEN}✓ Frontend images pushed${NC}"

# Trigger App Platform deployment
echo ""
if [ -z "$APP_ID" ]; then
    echo -e "${YELLOW}⚠ DIGITALOCEAN_APP_ID not set${NC}"
    echo -e "${YELLOW}To trigger deployment automatically, set:${NC}"
    echo -e "${YELLOW}  export DIGITALOCEAN_APP_ID=<your-app-id>${NC}"
    echo ""
    echo -e "${BLUE}To deploy manually:${NC}"
    echo -e "  doctl apps create-deployment <app-id>"
else
    echo -e "${BLUE}Triggering App Platform deployment...${NC}"
    doctl apps create-deployment $APP_ID
    echo -e "${GREEN}✓ Deployment triggered${NC}"
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}  Backend: ${REGISTRY}/backend:${VERSION}${NC}"
echo -e "${GREEN}  Frontend: ${REGISTRY}/frontend:${VERSION}${NC}"
echo -e "${GREEN}================================================${NC}"
