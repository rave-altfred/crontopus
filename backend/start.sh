#!/bin/bash
set -e

# Check if alembic_version needs reset (if endpoint/endpoints table doesn't exist)
echo "Checking database state..."
echo "Checking for 'endpoint' table..."
ENDPOINT_COUNT=$(psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='endpoint';" 2>/dev/null || echo "0")
echo "Checking for 'endpoints' table..."
ENDPOINTS_COUNT=$(psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='endpoints';" 2>/dev/null || echo "0")

echo "endpoint table count: $ENDPOINT_COUNT"
echo "endpoints table count: $ENDPOINTS_COUNT"

# List all tables for debugging
echo "All tables in database:"
psql "${DATABASE_URL}" -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;" 2>/dev/null || true

if [ "$ENDPOINT_COUNT" = " 0" ] && [ "$ENDPOINTS_COUNT" = " 0" ]; then
    echo "Neither endpoint nor endpoints table found, resetting alembic version to force migration..."
    psql "${DATABASE_URL}" -c "UPDATE alembic_version SET version_num='6e6023d3e120' WHERE version_num='15f02fc423e9';" 2>/dev/null || true
else
    echo "Endpoint table exists, no migration reset needed"
fi

echo "Running database migrations..."
alembic upgrade head

echo "Starting uvicorn..."
exec uvicorn crontopus_api.main:app --host 0.0.0.0 --port 8000
