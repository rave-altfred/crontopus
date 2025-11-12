#!/bin/sh
# Crontopus Job Runner
# Usage: run-job <job-uuid>
# 
# This script reads job configuration from ~/.crontopus/jobs/<uuid>.yaml
# and executes it with automatic check-in to the Crontopus backend.

set -e

# Validate input
if [ -z "$1" ]; then
    echo "Error: Job UUID required" >&2
    echo "Usage: $0 <job-uuid>" >&2
    exit 1
fi

JOB_UUID="$1"
JOB_CONFIG="$HOME/.crontopus/jobs/${JOB_UUID}.yaml"

# Check if config exists
if [ ! -f "$JOB_CONFIG" ]; then
    echo "Error: Job config not found: $JOB_CONFIG" >&2
    exit 1
fi

# Parse job config using basic grep/sed (no external dependencies)
JOB_NAME=$(grep '^job_name:' "$JOB_CONFIG" | sed 's/job_name: *//' | tr -d '"' | tr -d "'")
NAMESPACE=$(grep '^namespace:' "$JOB_CONFIG" | sed 's/namespace: *//' | tr -d '"' | tr -d "'")
COMMAND=$(grep '^command:' "$JOB_CONFIG" | sed 's/command: *//' | sed 's/^"//' | sed 's/"$//')

# Validate required fields
if [ -z "$JOB_NAME" ] || [ -z "$NAMESPACE" ] || [ -z "$COMMAND" ]; then
    echo "Error: Invalid job config (missing required fields)" >&2
    exit 1
fi

# Execute job with timing and output capture
LOGFILE=$(mktemp)
START=$(date +%s)

# Run command and capture output
eval "$COMMAND" > "$LOGFILE" 2>&1
EXIT_CODE=$?

END=$(date +%s)
DURATION=$((END - START))

# Check-in to backend
if [ -f "$HOME/.crontopus/bin/checkin" ]; then
    "$HOME/.crontopus/bin/checkin" "$JOB_NAME" "$NAMESPACE" "$EXIT_CODE" "$DURATION" "$LOGFILE" 2>&1 || true
fi

# Cleanup
rm -f "$LOGFILE"

exit $EXIT_CODE
