#!/bin/sh
# Crontopus Check-in Helper Script
# This script is automatically installed by the Crontopus agent
# Usage: checkin <job_name> <namespace> <status>

# Read configuration from agent config
CONFIG_FILE="$HOME/.crontopus/config.yaml"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Config file not found at $CONFIG_FILE" >&2
    exit 1
fi

# Parse YAML config (simple grep-based parser)
BACKEND_URL=$(grep -E '^\s*url:' "$CONFIG_FILE" | head -1 | sed 's/.*url:[[:space:]]*//' | tr -d '"' | tr -d "'")
ENDPOINT_ID=$(grep -E '^\s*id:' "$CONFIG_FILE" | head -1 | sed 's/.*id:[[:space:]]*//')
ENDPOINT_TOKEN=$(grep -E '^\s*token:' "$CONFIG_FILE" | head -1 | sed 's/.*token:[[:space:]]*//' | tr -d '"' | tr -d "'")

# Validate inputs
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Usage: $0 <job_name> <namespace> <status>" >&2
    exit 1
fi

JOB_NAME="$1"
NAMESPACE="$2"
STATUS="$3"

# Make the API call
curl -s -X POST \
    -H "Authorization: Bearer $ENDPOINT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"endpoint_id\":$ENDPOINT_ID,\"job_name\":\"$JOB_NAME\",\"namespace\":\"$NAMESPACE\",\"status\":\"$STATUS\"}" \
    "$BACKEND_URL/api/runs/check-in" > /dev/null 2>&1
