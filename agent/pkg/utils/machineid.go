package utils

import (
	"crypto/sha256"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

// GetMachineID returns a unique identifier for the current machine.
// This is used to detect reinstallations on the same physical machine.
//
// Platform-specific sources:
//   - macOS: Hardware UUID from IOPlatformUUID
//   - Linux: Machine ID from /etc/machine-id or /var/lib/dbus/machine-id
//   - Windows: Machine GUID from registry
func GetMachineID() (string, error) {
	var id string
	var err error

	switch runtime.GOOS {
	case "darwin":
		id, err = getMachineIDDarwin()
	case "linux":
		id, err = getMachineIDLinux()
	case "windows":
		id, err = getMachineIDWindows()
	default:
		return "", fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}

	if err != nil {
		return "", fmt.Errorf("failed to get machine ID: %w", err)
	}

	// Normalize: trim whitespace and convert to lowercase
	id = strings.ToLower(strings.TrimSpace(id))

	// Hash the ID for privacy (optional, but recommended)
	hash := sha256.Sum256([]byte(id))
	return fmt.Sprintf("%x", hash), nil
}

// getMachineIDDarwin gets the hardware UUID on macOS
func getMachineIDDarwin() (string, error) {
	cmd := exec.Command("ioreg", "-rd1", "-c", "IOPlatformExpertDevice")
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}

	// Parse output for IOPlatformUUID
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if strings.Contains(line, "IOPlatformUUID") {
			parts := strings.Split(line, "=")
			if len(parts) == 2 {
				uuid := strings.Trim(strings.TrimSpace(parts[1]), "\"")
				return uuid, nil
			}
		}
	}

	return "", fmt.Errorf("IOPlatformUUID not found")
}

// getMachineIDLinux gets the machine ID on Linux
func getMachineIDLinux() (string, error) {
	// Try /etc/machine-id first
	id, err := os.ReadFile("/etc/machine-id")
	if err == nil {
		return string(id), nil
	}

	// Fallback to /var/lib/dbus/machine-id
	id, err = os.ReadFile("/var/lib/dbus/machine-id")
	if err == nil {
		return string(id), nil
	}

	return "", fmt.Errorf("machine-id not found in /etc/machine-id or /var/lib/dbus/machine-id")
}

// getMachineIDWindows gets the machine GUID on Windows
func getMachineIDWindows() (string, error) {
	cmd := exec.Command("reg", "query", `HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography`, "/v", "MachineGuid")
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}

	// Parse output for MachineGuid value
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if strings.Contains(line, "MachineGuid") {
			parts := strings.Fields(line)
			if len(parts) >= 3 {
				return parts[len(parts)-1], nil
			}
		}
	}

	return "", fmt.Errorf("MachineGuid not found in registry")
}
