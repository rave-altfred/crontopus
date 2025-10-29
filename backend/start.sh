#!/bin/bash
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting uvicorn..."
exec uvicorn crontopus_api.main:app --host 0.0.0.0 --port 8000
