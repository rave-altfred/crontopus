#!/bin/bash
set -e

echo "=== Crontopus Agent Test Script ==="
echo ""

# Check if backend is running
echo "1. Checking if backend is running..."
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "❌ Backend is not running!"
    echo "   Start backend with: cd backend && uvicorn crontopus_api.main:app --reload"
    exit 1
fi
echo "✅ Backend is running"
echo ""

# Check if user is logged in and get token
echo "2. Checking CLI authentication..."
if ! python3 -m cli.main auth whoami > /dev/null 2>&1; then
    echo "❌ Not logged in!"
    echo "   Login with: python3 -m cli.main auth login"
    exit 1
fi
TOKEN=$(cat ~/.crontopus/token)
echo "✅ Authenticated"
echo ""

# Update config with enrollment token
echo "3. Updating agent config with enrollment token..."
sed -i.bak "s/enrollment_token: \"\"/enrollment_token: \"$TOKEN\"/" config-test.yaml
echo "✅ Config updated"
echo ""

# Clean up any existing test data
echo "4. Cleaning up existing test data..."
rm -rf .crontopus/
crontab -l 2>/dev/null | grep -v "# CRONTOPUS:" | crontab - 2>/dev/null || true
echo "✅ Cleaned up"
echo ""

# Build and run agent
echo "5. Building agent..."
go build -o build/crontopus-agent ./cmd/crontopus-agent
echo "✅ Agent built"
echo ""

echo "6. Starting agent (Press Ctrl+C to stop)..."
echo "   Watch for:"
echo "   - Git repository cloning"
echo "   - Job manifest parsing (4 jobs expected: 3 enabled + 1 paused)"
echo "   - Initial reconciliation"
echo "   - Jobs added to crontab"
echo ""
echo "=== Agent Output ==="
./build/crontopus-agent --config config-test.yaml
