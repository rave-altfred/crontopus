#!/bin/bash
# Crontopus Agent Installer
# Usage: curl -fsSL https://get.crontopus.com/install.sh | bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REPO="rave-altfred/crontopus"
VERSION="${CRONTOPUS_VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
BINARY_NAME="crontopus-agent"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

detect_platform() {
    local os=$(uname -s | tr '[:upper:]' '[:lower:]')
    local arch=$(uname -m)
    
    case "$os" in
        linux)
            OS="linux"
            ;;
        darwin)
            OS="darwin"
            ;;
        *)
            log_error "Unsupported operating system: $os"
            exit 1
            ;;
    esac
    
    case "$arch" in
        x86_64|amd64)
            ARCH="amd64"
            ;;
        aarch64|arm64)
            ARCH="arm64"
            ;;
        *)
            log_error "Unsupported architecture: $arch"
            exit 1
            ;;
    esac
    
    PLATFORM="${OS}-${ARCH}"
    log_info "Detected platform: $PLATFORM"
}

get_latest_version() {
    if [ "$VERSION" = "latest" ]; then
        log_info "Fetching latest version..."
        # Fetch latest release tag (handles both "v" and "agent-v" prefixes)
        VERSION=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"(agent-)?v([^"]+)".*/\2/')
        if [ -z "$VERSION" ]; then
            log_error "Failed to fetch latest version"
            exit 1
        fi
        log_info "Latest version: $VERSION"
    fi
}

download_binary() {
    local binary_name="crontopus-agent-${PLATFORM}"
    # Try v-prefixed tag first (new format), fallback to agent-v prefix (old format)
    local base_url="https://github.com/$REPO/releases/download"
    local download_url="${base_url}/v${VERSION}/${binary_name}"
    local checksum_url="${download_url}.sha256"
    
    log_info "Downloading from: $download_url"
    
    # Create temp directory
    local tmp_dir=$(mktemp -d)
    trap "rm -rf $tmp_dir" EXIT
    
    # Download binary
    if ! curl -fsSL "$download_url" -o "$tmp_dir/$binary_name"; then
        log_warn "Download failed with v-prefix. Trying agent-v prefix..."
        # Fallback to agent-v prefix
        download_url="${base_url}/agent-v${VERSION}/${binary_name}"
        checksum_url="${download_url}.sha256"
        log_info "Downloading from: $download_url"
        
        if ! curl -fsSL "$download_url" -o "$tmp_dir/$binary_name"; then
            log_error "Failed to download binary"
            exit 1
        fi
    fi
    
    # Download checksum
    if ! curl -fsSL "$checksum_url" -o "$tmp_dir/${binary_name}.sha256"; then
        log_warn "Failed to download checksum, skipping verification"
    else
        log_info "Verifying checksum..."
        if command -v sha256sum >/dev/null 2>&1; then
            (cd "$tmp_dir" && sha256sum -c "${binary_name}.sha256")
        elif command -v shasum >/dev/null 2>&1; then
            (cd "$tmp_dir" && shasum -a 256 -c "${binary_name}.sha256")
        else
            log_warn "No checksum tool found, skipping verification"
        fi
    fi
    
    # Make executable
    chmod +x "$tmp_dir/$binary_name"
    
    # Move to install directory
    log_info "Installing to: $INSTALL_DIR/$BINARY_NAME"
    
    if [ -w "$INSTALL_DIR" ]; then
        mv "$tmp_dir/$binary_name" "$INSTALL_DIR/$BINARY_NAME"
    else
        log_info "Requesting sudo for installation..."
        sudo mv "$tmp_dir/$binary_name" "$INSTALL_DIR/$BINARY_NAME"
    fi
}

verify_installation() {
    if command -v $BINARY_NAME >/dev/null 2>&1; then
        local installed_version=$($BINARY_NAME --version 2>/dev/null || echo "unknown")
        log_info "Successfully installed: $installed_version"
    else
        log_error "Installation verification failed"
        exit 1
    fi
}

print_next_steps() {
    echo ""
    echo -e "${GREEN}✓ Crontopus Agent installed successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Create configuration file:"
    echo "     mkdir -p ~/.crontopus"
    echo "     curl -fsSL https://raw.githubusercontent.com/$REPO/main/agent/config.example.yaml -o ~/.crontopus/config.yaml"
    echo ""
    echo "  2. Edit configuration with your credentials:"
    echo "     vim ~/.crontopus/config.yaml"
    echo ""
    echo "  3. Run the agent:"
    echo "     $BINARY_NAME --config ~/.crontopus/config.yaml"
    echo ""
    echo "For deployment as a system service, see:"
    echo "  https://github.com/$REPO/tree/main/agent/examples"
    echo ""
    echo "Documentation: https://github.com/$REPO/blob/main/agent/README.md"
}

# Main execution
main() {
    log_info "Crontopus Agent Installer"
    echo ""
    
    detect_platform
    get_latest_version
    download_binary
    verify_installation
    print_next_steps
}

main "$@"
