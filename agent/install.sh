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
        # Fetch latest release tag
        # The grep/sed logic extracts the tag name (e.g., "v0.1.14") and removes the 'v' prefix for the VERSION variable if present,
        # but we actually want the clean version number for the asset name construction.
        
        # Get the full tag name first
        TAG_NAME=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"tag_name": "([^"]+)".*/\1/')
        
        if [ -z "$TAG_NAME" ]; then
            log_error "Failed to fetch latest version"
            exit 1
        fi
        
        # Clean version (remove v prefix if present)
        VERSION=${TAG_NAME#v}
        # But keep the tag for the URL
        RELEASE_TAG=$TAG_NAME
        
        log_info "Latest version: $VERSION (Tag: $RELEASE_TAG)"
    else
        # If version is manually specified, assume v-prefix for tag if not present
        if [[ "$VERSION" != v* ]]; then
            RELEASE_TAG="v$VERSION"
        else
            RELEASE_TAG="$VERSION"
            VERSION=${VERSION#v}
        fi
    fi
}

download_binary() {
    # Asset naming convention: crontopus-agent-v0.1.14-darwin-arm64.tar.gz
    local asset_name="crontopus-agent-v${VERSION}-${PLATFORM}.tar.gz"
    local download_url="https://github.com/$REPO/releases/download/${RELEASE_TAG}/${asset_name}"
    local checksum_url="${download_url}.sha256"
    
    log_info "Downloading from: $download_url"
    
    # Create temp directory
    local tmp_dir=$(mktemp -d)
    trap "rm -rf $tmp_dir" EXIT
    
    # Download archive
    if ! curl -fsSL "$download_url" -o "$tmp_dir/$asset_name"; then
        log_error "Failed to download archive. Please check if the version and platform are correct."
        exit 1
    fi
    
    log_info "Extracting archive..."
    tar -xzf "$tmp_dir/$asset_name" -C "$tmp_dir"
    
    # Find the binary (it might be in a subdirectory or named differently)
    # The binary inside the archive usually includes the platform suffix (e.g. crontopus-agent-darwin-arm64)
    local binary_path=""
    
    # Try finding any file starting with crontopus-agent that is NOT the archive or checksum
    binary_path=$(find "$tmp_dir" -type f -name "crontopus-agent*" ! -name "*.sha256" ! -name "*.tar.gz" | head -n 1)
    
    if [ -z "$binary_path" ]; then
        log_error "Could not find 'crontopus-agent' binary in the downloaded archive."
        # Debug info
        log_warn "Contents of archive:"
        ls -R "$tmp_dir"
        exit 1
    fi
    
    log_info "Found binary: $(basename "$binary_path")"
    
    # Make executable
    chmod +x "$binary_path"
    
    # Move to install directory
    log_info "Installing to: $INSTALL_DIR/$BINARY_NAME"
    
    if [ -w "$INSTALL_DIR" ]; then
        mv "$binary_path" "$INSTALL_DIR/$BINARY_NAME"
    else
        log_info "Requesting sudo for installation..."
        sudo mv "$binary_path" "$INSTALL_DIR/$BINARY_NAME"
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
