# Crontopus Agent Installer for Windows
# Usage: Invoke-WebRequest -Uri "https://get.crontopus.com/install.ps1" -OutFile "install.ps1"; .\install.ps1

param(
    [string]$Version = "latest",
    [string]$InstallDir = "C:\Program Files\Crontopus",
    [string]$Repo = "YOUR_GITHUB_ORG/crontopus"  # Update with actual repo
)

$ErrorActionPreference = "Stop"

# Functions
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Log-Info($message) {
    Write-ColorOutput Green "[INFO] $message"
}

function Log-Warn($message) {
    Write-ColorOutput Yellow "[WARN] $message"
}

function Log-Error($message) {
    Write-ColorOutput Red "[ERROR] $message"
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-LatestVersion {
    if ($Version -eq "latest") {
        Log-Info "Fetching latest version..."
        try {
            $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
            $script:Version = $response.tag_name -replace '^agent-v', ''
            Log-Info "Latest version: $Version"
        }
        catch {
            Log-Error "Failed to fetch latest version: $_"
            exit 1
        }
    }
}

function Download-Agent {
    $binaryName = "crontopus-agent-windows-amd64.exe"
    $downloadUrl = "https://github.com/$Repo/releases/download/agent-v$Version/$binaryName"
    $checksumUrl = "$downloadUrl.sha256"
    
    Log-Info "Downloading from: $downloadUrl"
    
    # Create temp directory
    $tempDir = Join-Path $env:TEMP "crontopus-install-$(Get-Random)"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    $tempBinary = Join-Path $tempDir $binaryName
    $tempChecksum = Join-Path $tempDir "$binaryName.sha256"
    
    try {
        # Download binary
        Invoke-WebRequest -Uri $downloadUrl -OutFile $tempBinary -UseBasicParsing
        Log-Info "Downloaded binary"
        
        # Download checksum
        try {
            Invoke-WebRequest -Uri $checksumUrl -OutFile $tempChecksum -UseBasicParsing
            
            # Verify checksum
            Log-Info "Verifying checksum..."
            $downloadedHash = (Get-FileHash -Path $tempBinary -Algorithm SHA256).Hash
            $expectedHash = (Get-Content $tempChecksum -Raw).Split()[0]
            
            if ($downloadedHash -ne $expectedHash) {
                Log-Error "Checksum verification failed!"
                Log-Error "Expected: $expectedHash"
                Log-Error "Got: $downloadedHash"
                exit 1
            }
            Log-Info "Checksum verified"
        }
        catch {
            Log-Warn "Failed to download/verify checksum, skipping verification"
        }
        
        # Create installation directory
        if (-not (Test-Path $InstallDir)) {
            Log-Info "Creating installation directory: $InstallDir"
            New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
        }
        
        # Copy binary
        $destPath = Join-Path $InstallDir "crontopus-agent.exe"
        Log-Info "Installing to: $destPath"
        Copy-Item -Path $tempBinary -Destination $destPath -Force
        
        return $destPath
    }
    finally {
        # Cleanup
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Add-ToPath {
    param([string]$directory)
    
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    if ($currentPath -notlike "*$directory*") {
        Log-Info "Adding to system PATH: $directory"
        $newPath = "$currentPath;$directory"
        [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
        $env:Path = "$env:Path;$directory"
        Log-Info "Added to PATH (requires new terminal to take effect)"
    }
    else {
        Log-Info "Already in PATH"
    }
}

function Create-ConfigDirectory {
    $configDir = "C:\ProgramData\Crontopus"
    if (-not (Test-Path $configDir)) {
        Log-Info "Creating configuration directory: $configDir"
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }
    return $configDir
}

function Show-NextSteps {
    param([string]$installedPath, [string]$configDir)
    
    Write-Host ""
    Write-ColorOutput Green "✓ Crontopus Agent installed successfully!"
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Create configuration file:"
    Write-Host "     Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/$Repo/main/agent/config.example.yaml' -OutFile '$configDir\config.yaml'"
    Write-Host ""
    Write-Host "  2. Edit configuration with your credentials:"
    Write-Host "     notepad $configDir\config.yaml"
    Write-Host ""
    Write-Host "  3. Run the agent:"
    Write-Host "     crontopus-agent.exe --config $configDir\config.yaml"
    Write-Host ""
    Write-Host "For deployment as a Windows Service, see:"
    Write-Host "  https://github.com/$Repo/blob/main/agent/examples/crontopus-agent-task.xml"
    Write-Host ""
    Write-Host "Documentation: https://github.com/$Repo/blob/main/agent/README.md"
}

# Main execution
try {
    Log-Info "Crontopus Agent Installer for Windows"
    Write-Host ""
    
    # Check for administrator privileges
    if (-not (Test-Administrator)) {
        Log-Error "This script requires administrator privileges"
        Log-Error "Please run PowerShell as Administrator and try again"
        exit 1
    }
    
    # Detect Windows version
    $osVersion = [System.Environment]::OSVersion.Version
    Log-Info "Windows version: $($osVersion.Major).$($osVersion.Minor)"
    
    if ($osVersion.Major -lt 10 -and -not ($osVersion.Major -eq 6 -and $osVersion.Minor -ge 1)) {
        Log-Warn "Windows 7/Server 2008 R2 or later required"
    }
    
    Get-LatestVersion
    $installedPath = Download-Agent
    Add-ToPath $InstallDir
    $configDir = Create-ConfigDirectory
    
    # Verify installation
    $version = & $installedPath --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Log-Info "Successfully installed: $version"
    }
    else {
        Log-Warn "Installation verification failed (binary might not support --version)"
    }
    
    Show-NextSteps -installedPath $installedPath -configDir $configDir
}
catch {
    Log-Error "Installation failed: $_"
    exit 1
}
