#!/bin/bash
set -e

# Crontopus Agent Uninstaller
# Removes agent binary, service, configuration, and optionally crontab entries

echo "================================"
echo "  Crontopus Agent Uninstaller"
echo "================================"
echo ""

# Detect platform
OS="$(uname -s)"
case "$OS" in
    Darwin)
        PLATFORM="darwin"
        ;;
    Linux)
        PLATFORM="linux"
        ;;
    MINGW*|MSYS*|CYGWIN*)
        PLATFORM="windows"
        ;;
    *)
        echo "Error: Unsupported platform: $OS"
        exit 1
        ;;
esac

echo "Platform detected: $PLATFORM"
echo ""

# Stop and remove service
echo "Stopping agent service..."
if [ "$PLATFORM" = "darwin" ]; then
    # macOS - launchd
    PLIST_PATH="$HOME/Library/LaunchAgents/com.crontopus.agent.plist"
    if [ -f "$PLIST_PATH" ]; then
        launchctl unload "$PLIST_PATH" 2>/dev/null || true
        launchctl remove com.crontopus.agent 2>/dev/null || true
        rm -f "$PLIST_PATH"
        echo "✓ Removed launchd service"
    else
        echo "  Service not found (already removed)"
    fi
elif [ "$PLATFORM" = "linux" ]; then
    # Linux - systemd
    SERVICE_PATH="/etc/systemd/system/crontopus-agent.service"
    if [ -f "$SERVICE_PATH" ]; then
        sudo systemctl stop crontopus-agent 2>/dev/null || true
        sudo systemctl disable crontopus-agent 2>/dev/null || true
        sudo rm -f "$SERVICE_PATH"
        sudo systemctl daemon-reload
        echo "✓ Removed systemd service"
    else
        echo "  Service not found (already removed)"
    fi
elif [ "$PLATFORM" = "windows" ]; then
    # Windows - Task Scheduler
    schtasks //Delete //TN "Crontopus Agent" //F 2>/dev/null || true
    echo "✓ Removed scheduled task"
fi

# Remove agent binary
echo ""
echo "Removing agent files..."
AGENT_DIR="$HOME/.crontopus"
if [ -d "$AGENT_DIR" ]; then
    rm -rf "$AGENT_DIR"
    echo "✓ Removed $AGENT_DIR"
else
    echo "  Agent directory not found"
fi

# Ask about crontab cleanup
echo ""
read -p "Remove Crontopus jobs from crontab? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ "$PLATFORM" = "darwin" ] || [ "$PLATFORM" = "linux" ]; then
        # Remove all Crontopus-marked entries
        if crontab -l > /dev/null 2>&1; then
            TEMP_CRONTAB=$(mktemp)
            crontab -l | grep -v "# CRONTOPUS:" > "$TEMP_CRONTAB" || true
            if [ -s "$TEMP_CRONTAB" ]; then
                crontab "$TEMP_CRONTAB"
                echo "✓ Removed Crontopus jobs from crontab"
            else
                crontab -r
                echo "✓ Cleared crontab (all jobs were Crontopus-managed)"
            fi
            rm -f "$TEMP_CRONTAB"
        else
            echo "  No crontab found"
        fi
    elif [ "$PLATFORM" = "windows" ]; then
        echo "  Windows crontab cleanup not implemented (jobs removed via Task Scheduler)"
    fi
fi

# Ask about complete cleanup (remove all traces)
echo ""
read -p "Remove ALL cron jobs (including non-Crontopus jobs)? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ "$PLATFORM" = "darwin" ] || [ "$PLATFORM" = "linux" ]; then
        crontab -r 2>/dev/null || true
        echo "✓ Cleared all cron jobs"
    fi
fi

echo ""
echo "================================"
echo "  Uninstall Complete"
echo "================================"
echo ""
echo "The Crontopus agent has been removed from your system."
echo "To reinstall, download a new installer from:"
echo "  https://www.crontopus.com/endpoints"
echo ""
