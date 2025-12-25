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
VERSION="$(date +%Y%m%d-%H%M%S)"
APP_ID="${DIGITALOCEAN_APP_ID:-}"

# Parse flags
NO_CACHE=""
for arg in "$@"; do
    case $arg in
        --no-cache)
            NO_CACHE="--no-cache"
            shift
            ;;
    esac
done

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Crontopus Deployment${NC}"
echo -e "${BLUE}  Version: ${VERSION}${NC}"
echo -e "${BLUE}================================================${NC}"

# Check for --skip-tests flag
SKIP_TESTS=false
for arg in "$@"; do
  if [ "$arg" == "--skip-tests" ]; then
    SKIP_TESTS=true
    break
  fi
done

# Run Tests (Pre-flight Check)
if [ "$SKIP_TESTS" = false ]; then
    echo ""
    echo -e "${BLUE}🧪 Running pre-flight tests...${NC}"
    
    # Backend Tests
    echo -e "  ${BLUE}> Running Backend tests...${NC}"
    if [ -f "backend/run_tests.sh" ]; then
        # Run in a subshell to preserve current directory
        (
            cd backend
            chmod +x run_tests.sh
            # Use || true to prevent set -e from exiting immediately so we can capture output
            EXIT_CODE=0
            OUTPUT=$(./run_tests.sh 2>&1) || EXIT_CODE=$?
            if [ $EXIT_CODE -ne 0 ]; then
                echo -e "${RED}❌ Backend tests failed!${NC}"
                echo "$OUTPUT"
                exit 1
            fi
        )
        if [ $? -ne 0 ]; then
            echo -e "${RED}Aborting deployment due to failed tests.${NC}"
            exit 1
        fi
        echo -e "${GREEN}  ✓ Backend tests passed${NC}"
    else
        echo -e "${YELLOW}  ⚠ Backend test script not found, skipping...${NC}"
    fi

    # Frontend Tests
    echo -e "  ${BLUE}> Running Frontend tests...${NC}"
    if [ -d "frontend" ]; then
        # Run in a subshell to preserve current directory
        (
            cd frontend
            if [ -f "package.json" ]; then
                # Ensure dependencies are installed (quietly)
                npm install > /dev/null 2>&1
                # Use || true to prevent set -e from exiting immediately so we can capture output
                EXIT_CODE=0
                OUTPUT=$(npm test -- --run 2>&1) || EXIT_CODE=$?
                if [ $EXIT_CODE -ne 0 ]; then
                    echo -e "${RED}❌ Frontend tests failed!${NC}"
                    echo "$OUTPUT"
                    exit 1
                fi
            fi
        )
        if [ $? -ne 0 ]; then
            echo -e "${RED}Aborting deployment due to failed tests.${NC}"
            exit 1
        fi
        echo -e "${GREEN}  ✓ Frontend tests passed${NC}"
    else
        echo -e "${YELLOW}  ⚠ Frontend directory not found, skipping...${NC}"
    fi
    
    echo -e "${GREEN}✅ All tests passed! Proceeding with deployment...${NC}"
else
    echo ""
    echo -e "${YELLOW}⏩ Skipping tests as requested...${NC}"
fi

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
if [ -n "$NO_CACHE" ]; then
  echo -e "${BLUE}Building backend image (no cache)...${NC}"
else
  echo -e "${BLUE}Building backend image...${NC}"
fi
docker build \
  $NO_CACHE \
  -t ${REGISTRY}/backend:${VERSION} \
  -t ${REGISTRY}/backend:latest \
  --platform linux/amd64 \
  ./backend

echo -e "${GREEN}✓ Backend image built${NC}"

# Build frontend image (if Dockerfile exists)
if [ -f "./frontend/Dockerfile" ]; then
  echo ""
  if [ -n "$NO_CACHE" ]; then
    echo -e "${BLUE}Building frontend image (no cache)...${NC}"
  else
    echo -e "${BLUE}Building frontend image...${NC}"
  fi
  
# Create .env for build with API URL
  echo "VITE_API_URL=https://crontopus.com/api" > ./frontend/.env.production
  
  docker build \
    $NO_CACHE \
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

# Cleanup old images (keep latest tags for caching, remove old versioned tags)
echo ""
echo -e "${BLUE}Cleaning up old Docker images...${NC}"

# Remove old versioned backend images (keep latest and current version)
docker images --format "{{.Repository}}:{{.Tag}}" | \
  grep "${REGISTRY}/backend:" | \
  grep -v ":latest$" | \
  grep -v ":${VERSION}$" | \
  xargs -r docker rmi 2>/dev/null || true

# Remove old versioned frontend images (keep latest and current version)
if [ "$FRONTEND_BUILT" = true ]; then
  docker images --format "{{.Repository}}:{{.Tag}}" | \
    grep "${REGISTRY}/frontend:" | \
    grep -v ":latest$" | \
    grep -v ":${VERSION}$" | \
    xargs -r docker rmi 2>/dev/null || true
fi

echo -e "${GREEN}✓ Old images cleaned up${NC}"

# Update app.yaml with versioned tags
echo ""
echo -e "${BLUE}Updating app.yaml with version tags...${NC}"
TEMP_SPEC="/tmp/crontopus-app-${VERSION}.yaml"
cp infra/app-platform/app.yaml "$TEMP_SPEC"

# Replace 'tag: latest' with versioned tags for both backend and frontend
sed -i.bak "s|tag: latest|tag: ${VERSION}|g" "$TEMP_SPEC"
rm "${TEMP_SPEC}.bak" 2>/dev/null || true

echo -e "${GREEN}✓ App spec updated with version ${VERSION}${NC}"

# Create or update App Platform app
echo ""
if [ -z "$APP_ID" ]; then
    echo -e "${BLUE}Checking if App Platform app exists...${NC}"
    
    # Try to find existing app by name
    EXISTING_APP_ID=$(doctl apps list --format ID,Spec.Name --no-header 2>/dev/null | grep "crontopus" | awk '{print $1}' | head -n 1)
    
    if [ -n "$EXISTING_APP_ID" ]; then
        echo -e "${GREEN}✓ Found existing app: ${EXISTING_APP_ID}${NC}"
        APP_ID=$EXISTING_APP_ID
        
        echo -e "${BLUE}Updating app spec and deploying...${NC}"
        # Note: `doctl apps update` automatically triggers a deployment
        # No need to call create-deployment separately
        DEPLOYMENT_OUTPUT=$(doctl apps update $APP_ID --spec "$TEMP_SPEC" 2>&1)
        DEPLOYMENT_EXIT_CODE=$?
        
        if [ $DEPLOYMENT_EXIT_CODE -eq 0 ]; then
            echo -e "${GREEN}✓ App spec updated, deployment started${NC}"
            
            # Wait for deployment to complete
            echo -e "${BLUE}Waiting for deployment to complete...${NC}"
            sleep 5  # Give the system time to create the deployment
            
            # Get latest deployment ID and wait for it
            LATEST_DEPLOYMENT_ID=$(doctl apps list-deployments $APP_ID --format ID --no-header | head -n 1)
            
            if [ -n "$LATEST_DEPLOYMENT_ID" ]; then
                echo -e "${BLUE}Monitoring deployment ${LATEST_DEPLOYMENT_ID}...${NC}"
                
                # Poll deployment status
                MAX_WAIT=600  # 10 minutes
                ELAPSED=0
                while [ $ELAPSED -lt $MAX_WAIT ]; do
                    DEPLOY_STATUS=$(doctl apps get-deployment $APP_ID $LATEST_DEPLOYMENT_ID --format Phase --no-header 2>/dev/null)
                    
                    if [ "$DEPLOY_STATUS" = "ACTIVE" ]; then
                        echo -e "${GREEN}✓ Deployment successful${NC}"
                        break
                    elif [ "$DEPLOY_STATUS" = "ERROR" ] || [ "$DEPLOY_STATUS" = "CANCELED" ]; then
                        echo -e "${RED}✗ Deployment failed with status: ${DEPLOY_STATUS}${NC}"
                        DEPLOYMENT_EXIT_CODE=1
                        break
                    else
                        echo -e "${BLUE}Status: ${DEPLOY_STATUS}... (${ELAPSED}s elapsed)${NC}"
                        sleep 10
                        ELAPSED=$((ELAPSED + 10))
                    fi
                done
                
                if [ $ELAPSED -ge $MAX_WAIT ]; then
                    echo -e "${YELLOW}⚠ Deployment timeout after ${MAX_WAIT}s${NC}"
                fi
            fi
        fi
        
        if [ $DEPLOYMENT_EXIT_CODE -ne 0 ]; then
            echo -e "${RED}✗ Deployment failed${NC}"
            echo "$DEPLOYMENT_OUTPUT"
            
            # Extract deployment ID from output
            DEPLOYMENT_ID=$(echo "$DEPLOYMENT_OUTPUT" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -n 1)
            
            if [ -n "$DEPLOYMENT_ID" ]; then
                echo ""
                echo -e "${BLUE}Fetching deployment logs...${NC}"
                doctl apps logs $APP_ID backend --type deploy --deployment $DEPLOYMENT_ID 2>&1 | tail -30
            fi
            
            exit 1
        fi
        
        echo -e "${GREEN}✓ Deployment complete${NC}"
    else
        echo -e "${BLUE}Creating new App Platform app...${NC}"
        APP_RESPONSE=$(doctl apps create --spec "$TEMP_SPEC" --format ID --no-header)
        APP_ID=$APP_RESPONSE
        echo -e "${GREEN}✓ App created: ${APP_ID}${NC}"
        echo -e "${YELLOW}Save this for future deployments:${NC}"
        echo -e "${YELLOW}  export DIGITALOCEAN_APP_ID=${APP_ID}${NC}"
        
        # Wait for new app to be ready
        echo -e "${BLUE}Waiting for app to initialize...${NC}"
        sleep 10
        
        # Get latest deployment ID and wait for it
        LATEST_DEPLOYMENT_ID=$(doctl apps list-deployments $APP_ID --format ID --no-header | head -n 1)
        
        if [ -n "$LATEST_DEPLOYMENT_ID" ]; then
            echo -e "${BLUE}Monitoring deployment ${LATEST_DEPLOYMENT_ID}...${NC}"
            
            # Poll deployment status
            MAX_WAIT=600  # 10 minutes
            ELAPSED=0
            while [ $ELAPSED -lt $MAX_WAIT ]; do
                DEPLOY_STATUS=$(doctl apps get-deployment $APP_ID $LATEST_DEPLOYMENT_ID --format Phase --no-header 2>/dev/null)
                
                if [ "$DEPLOY_STATUS" = "ACTIVE" ]; then
                    echo -e "${GREEN}✓ Deployment successful${NC}"
                    break
                elif [ "$DEPLOY_STATUS" = "ERROR" ] || [ "$DEPLOY_STATUS" = "CANCELED" ]; then
                    echo -e "${RED}✗ Deployment failed with status: ${DEPLOY_STATUS}${NC}"
                    exit 1
                else
                    echo -e "${BLUE}Status: ${DEPLOY_STATUS}... (${ELAPSED}s elapsed)${NC}"
                    sleep 10
                    ELAPSED=$((ELAPSED + 10))
                fi
            done
            
            if [ $ELAPSED -ge $MAX_WAIT ]; then
                echo -e "${YELLOW}⚠ Deployment timeout after ${MAX_WAIT}s${NC}"
            fi
        fi
    fi
else
    echo -e "${BLUE}Updating app spec and deploying...${NC}"
    # Note: `doctl apps update` automatically triggers a deployment
    DEPLOYMENT_OUTPUT=$(doctl apps update $APP_ID --spec "$TEMP_SPEC" 2>&1)
    DEPLOYMENT_EXIT_CODE=$?
    
    if [ $DEPLOYMENT_EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✓ App spec updated, deployment started${NC}"
        echo -e "${BLUE}Waiting for deployment to complete...${NC}"
        sleep 5
        
        # Get latest deployment ID and wait for it
        LATEST_DEPLOYMENT_ID=$(doctl apps list-deployments $APP_ID --format ID --no-header | head -n 1)
        
        if [ -n "$LATEST_DEPLOYMENT_ID" ]; then
            echo -e "${BLUE}Monitoring deployment ${LATEST_DEPLOYMENT_ID}...${NC}"
            
            # Poll deployment status
            MAX_WAIT=600  # 10 minutes
            ELAPSED=0
            while [ $ELAPSED -lt $MAX_WAIT ]; do
                DEPLOY_STATUS=$(doctl apps get-deployment $APP_ID $LATEST_DEPLOYMENT_ID --format Phase --no-header 2>/dev/null)
                
                if [ "$DEPLOY_STATUS" = "ACTIVE" ]; then
                    echo -e "${GREEN}✓ Deployment successful${NC}"
                    break
                elif [ "$DEPLOY_STATUS" = "ERROR" ] || [ "$DEPLOY_STATUS" = "CANCELED" ]; then
                    echo -e "${RED}✗ Deployment failed with status: ${DEPLOY_STATUS}${NC}"
                    DEPLOYMENT_EXIT_CODE=1
                    break
                else
                    echo -e "${BLUE}Status: ${DEPLOY_STATUS}... (${ELAPSED}s elapsed)${NC}"
                    sleep 10
                    ELAPSED=$((ELAPSED + 10))
                fi
            done
            
            if [ $ELAPSED -ge $MAX_WAIT ]; then
                echo -e "${YELLOW}⚠ Deployment timeout after ${MAX_WAIT}s${NC}"
            fi
        fi
    fi
    
    if [ $DEPLOYMENT_EXIT_CODE -ne 0 ]; then
        echo -e "${RED}✗ Deployment failed${NC}"
        echo "$DEPLOYMENT_OUTPUT"
        
        # Extract deployment ID from output
        DEPLOYMENT_ID=$(echo "$DEPLOYMENT_OUTPUT" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -n 1)
        
        if [ -n "$DEPLOYMENT_ID" ]; then
            echo ""
            echo -e "${BLUE}Fetching deployment logs...${NC}"
            doctl apps logs $APP_ID backend --type deploy --deployment $DEPLOYMENT_ID 2>&1 | tail -30
        fi
        
        exit 1
    fi
    
    echo -e "${GREEN}✓ Deployment complete${NC}"
fi

# Cleanup temp spec
rm -f "$TEMP_SPEC"

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}  Backend: ${REGISTRY}/backend:${VERSION}${NC}"
if [ "$FRONTEND_BUILT" = true ]; then
  echo -e "${GREEN}  Frontend: ${REGISTRY}/frontend:${VERSION}${NC}"
fi
echo -e "${GREEN}================================================${NC}"

# DNS and connectivity validation
echo ""
echo -e "${BLUE}Validating deployment...${NC}"

# Get app URL
APP_URL=$(doctl apps get $APP_ID --format DefaultIngress --no-header 2>/dev/null | tr -d '\n' | xargs)

if [ -n "$APP_URL" ]; then
    echo -e "${BLUE}App URL: ${APP_URL}${NC}"
    
    # Extract hostname from URL (remove protocol and path)
    APP_HOSTNAME=$(echo "$APP_URL" | sed -E 's|https?://||' | sed 's|/.*||' | tr -d '\n' | xargs)
    
    # Resolve DNS
    echo -e "${BLUE}Resolving DNS for ${APP_HOSTNAME}...${NC}"
    APP_IP=$(dig +short "$APP_HOSTNAME" | head -n 1)
    
    if [ -n "$APP_IP" ]; then
        echo -e "${GREEN}✓ DNS resolves to: ${APP_IP}${NC}"
    else
        echo -e "${YELLOW}⚠ DNS resolution failed or still propagating${NC}"
    fi
    
    # Test health endpoint
    echo -e "${BLUE}Testing health endpoint...${NC}"
    HEALTH_RESPONSE=$(curl -s --connect-timeout 10 --max-time 15 "${APP_URL}/health" 2>&1)
    HEALTH_EXIT_CODE=$?
    
    if [ $HEALTH_EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✓ Health check passed${NC}"
        
        # Parse database status if jq is available
        if command -v jq &> /dev/null; then
            DB_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.database // "unknown"' 2>/dev/null)
            if [ "$DB_STATUS" = "connected" ]; then
                echo -e "${GREEN}✓ Database: connected${NC}"
            elif [ "$DB_STATUS" = "error" ]; then
                echo -e "${RED}✗ Database: error${NC}"
                DB_ERROR=$(echo "$HEALTH_RESPONSE" | jq -r '.database_error // ""' 2>/dev/null)
                if [ -n "$DB_ERROR" ]; then
                    echo -e "${RED}  Error: ${DB_ERROR}${NC}"
                fi
            else
                echo -e "${YELLOW}⚠ Database: ${DB_STATUS}${NC}"
            fi
        fi
    else
        echo -e "${RED}✗ Health check failed${NC}"
        echo -e "${RED}  Error: ${HEALTH_RESPONSE}${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Could not retrieve app URL${NC}"
fi

# Check and update custom domain DNS records
echo ""
echo -e "${BLUE}Checking custom domain DNS records...${NC}"

CUSTOM_DOMAINS=$(doctl apps get $APP_ID -o json 2>/dev/null | jq -r '.[0].spec.domains // [] | .[] | .domain' 2>/dev/null)

if [ -n "$CUSTOM_DOMAINS" ] && [ -n "$APP_HOSTNAME" ]; then
    while IFS= read -r domain; do
        if [ -n "$domain" ] && [ "$domain" != "null" ] && [ "$domain" != "@" ]; then
            # Extract base domain and subdomain
            if [[ "$domain" == *.*.* ]]; then
                # Has subdomain (e.g. www.crontopus.com)
                SUBDOMAIN=$(echo "$domain" | cut -d. -f1)
                BASE_DOMAIN=$(echo "$domain" | cut -d. -f2-)
            else
                # No subdomain (e.g. crontopus.com)
                SUBDOMAIN="@"
                BASE_DOMAIN="$domain"
            fi
            
            # Get current CNAME record
            CURRENT_CNAME=$(dig +short "$domain" CNAME | sed 's/\.$//')
            
            if [ -n "$CURRENT_CNAME" ] && [ "$CURRENT_CNAME" != "$APP_HOSTNAME" ]; then
                echo -e "${YELLOW}⚠ Updating DNS for ${domain}${NC}"
                echo -e "${YELLOW}  Old: ${CURRENT_CNAME}${NC}"
                echo -e "${YELLOW}  New: ${APP_HOSTNAME}${NC}"
                
                # Get record ID
                RECORD_ID=$(doctl compute domain records list "$BASE_DOMAIN" --format ID,Type,Name,Data --no-header 2>/dev/null | grep "CNAME.*$SUBDOMAIN" | awk '{print $1}' | head -n 1)
                
                if [ -n "$RECORD_ID" ]; then
                    # Add trailing dot if not present (required for CNAME records)
                    APP_HOSTNAME_FQDN="$APP_HOSTNAME"
                    [[ "$APP_HOSTNAME_FQDN" != *.  ]] && APP_HOSTNAME_FQDN="${APP_HOSTNAME_FQDN}."
                    
                    UPDATE_OUTPUT=$(doctl compute domain records update "$BASE_DOMAIN" \
                        --record-id "$RECORD_ID" \
                        --record-type CNAME \
                        --record-name "$SUBDOMAIN" \
                        --record-data "$APP_HOSTNAME_FQDN" 2>&1)
                    UPDATE_EXIT_CODE=$?
                    
                    if [ $UPDATE_EXIT_CODE -eq 0 ]; then
                        echo -e "${GREEN}✓ DNS record updated for ${domain}${NC}"
                    else
                        echo -e "${RED}✗ Failed to update DNS for ${domain}${NC}"
                        echo -e "${RED}  Error: $UPDATE_OUTPUT${NC}"
                    fi
                else
                    echo -e "${YELLOW}⚠ Could not find CNAME record for ${domain}${NC}"
                fi
            elif [ -n "$CURRENT_CNAME" ]; then
                echo -e "${GREEN}✓ DNS for ${domain} is correct${NC}"
            fi
        fi
    done <<< "$CUSTOM_DOMAINS"
fi

echo ""
echo -e "${BLUE}For detailed logs, run:${NC}"
echo -e "  doctl apps logs $APP_ID backend --type run --follow"
