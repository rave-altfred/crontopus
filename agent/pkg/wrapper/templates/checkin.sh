#!/bin/sh
# Crontopus Check-in Helper Script
# This script is automatically installed by the Crontopus agent
# Usage: checkin <job_name> <namespace> <exit_code> <duration> <output_file>

# Read configuration from agent config
CONFIG_FILE="$HOME/.crontopus/config.yaml"
TOKEN_FILE="$HOME/.crontopus/agent-token"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Config file not found at $CONFIG_FILE" >&2
    exit 1
fi

if [ ! -f "$TOKEN_FILE" ]; then
    echo "Error: Token file not found at $TOKEN_FILE" >&2
    exit 1
fi

# Parse backend URL from YAML config
BACKEND_URL=$(grep -E '^\s*api_url:' "$CONFIG_FILE" | head -1 | sed 's/.*api_url:[[:space:]]*//' | tr -d '"' | tr -d "'")

# Parse endpoint ID and token from JSON token file
ENDPOINT_ID=$(grep -o '"agent_id":[0-9]*' "$TOKEN_FILE" | head -1 | sed 's/"agent_id"://')
ENDPOINT_TOKEN=$(grep -o '"token":"[^"]*"' "$TOKEN_FILE" | head -1 | sed 's/"token":"//' | sed 's/"$//')

# Validate inputs
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ] || [ -z "$4" ] || [ -z "$5" ]; then
    echo "Usage: $0 <job_name> <namespace> <exit_code> <duration> <output_file>" >&2
    exit 1
fi

JOB_NAME="$1"
NAMESPACE="$2"
EXIT_CODE="$3"
DURATION="$4"
OUTPUT_FILE="$5"

# Determine status from exit code
if [ "$EXIT_CODE" -eq 0 ]; then
    STATUS="success"
else
    STATUS="failure"
fi

# Read output from file (limit to 10000 chars to match DB limit)
OUTPUT=""
if [ -f "$OUTPUT_FILE" ]; then
    OUTPUT=$(head -c 10000 "$OUTPUT_FILE" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr '\n' ' ' | sed 's/\r//g')
fi

# Extract error message from output if job failed (last 500 chars)
ERROR_MESSAGE=""
if [ "$EXIT_CODE" -ne 0 ] && [ -f "$OUTPUT_FILE" ]; then
    ERROR_MESSAGE=$(tail -c 500 "$OUTPUT_FILE" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr '\n' ' ' | sed 's/\r//g')
fi

# Build JSON payload
JSON_PAYLOAD=$(cat <<EOF
{
  "endpoint_id": $ENDPOINT_ID,
  "job_name": "$JOB_NAME",
  "namespace": "$NAMESPACE",
  "status": "$STATUS",
  "exit_code": $EXIT_CODE,
  "duration": $DURATION,
  "output": "$OUTPUT",
  "error_message": "$ERROR_MESSAGE"
}
EOF
)

# Make the API call
curl -s -X POST \
    -H "Authorization: Bearer $ENDPOINT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$JSON_PAYLOAD" \
    "$BACKEND_URL/api/runs/check-in" > /dev/null 2>&1
