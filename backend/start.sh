#!/bin/bash
set -e

# Check if alembic_version needs reset (if endpoint table doesn't exist)
echo "Checking database state..."
psql "${DATABASE_URL}" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='endpoint';" > /tmp/endpoint_check.txt 2>/dev/null || echo "0" > /tmp/endpoint_check.txt

if grep -q "0" /tmp/endpoint_check.txt; then
    echo "Endpoint table not found, resetting alembic version to force migration..."
    psql "${DATABASE_URL}" -c "UPDATE alembic_version SET version_num='6e6023d3e120' WHERE version_num='15f02fc423e9';" 2>/dev/null || true
fi

echo "Running database migrations..."
alembic upgrade head

echo "Starting uvicorn..."
exec uvicorn crontopus_api.main:app --host 0.0.0.0 --port 8000
