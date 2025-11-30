#!/bin/bash

# Exit on error
set -e

# Configure Docker Host for macOS Docker Desktop if default socket is missing
if [ ! -S "/var/run/docker.sock" ] && [ -S "$HOME/.docker/run/docker.sock" ]; then
    export DOCKER_HOST="unix://$HOME/.docker/run/docker.sock"
    echo "Using Docker socket at $DOCKER_HOST"
fi

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "Warning: venv not found. Running with system python."
fi

# Add current directory to PYTHONPATH so crontopus_api module can be found
export PYTHONPATH=$PYTHONPATH:.

# Disable Testcontainers Ryuk (cleanup container) to avoid port binding issues/timeouts
export TESTCONTAINERS_RYUK_DISABLED=true

# Run pytest with passed arguments
echo "Running tests..."
pytest "$@"
