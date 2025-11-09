package wrapper

import (
	"fmt"
	"runtime"
	"strings"
)

// WrapCommand wraps a job command with check-in callbacks
// The wrapped command will automatically report success/failure to the backend
func WrapCommand(originalCommand, backendURL, endpointToken string, endpointID int, jobName, namespace string) string {
	// Determine shell syntax based on platform
	if runtime.GOOS == "windows" {
		return wrapWindows(originalCommand, backendURL, endpointToken, endpointID, jobName, namespace)
	}
	return wrapUnix(originalCommand, backendURL, endpointToken, endpointID, jobName, namespace)
}

// wrapUnix wraps command for Unix-like systems (Linux, macOS)
func wrapUnix(originalCommand, backendURL, endpointToken string, endpointID int, jobName, namespace string) string {
	successURL := fmt.Sprintf("%s/api/runs/check-in", backendURL)
	failureURL := fmt.Sprintf("%s/api/runs/check-in", backendURL)
	
	// Escape quotes in the original command
	escapedCommand := strings.ReplaceAll(originalCommand, "'", "'\\''")
	
	// Build wrapper script
	// Format: (original_command) && curl success || curl failure
	wrapper := fmt.Sprintf(
		`sh -c '(%s) && curl -X POST -H "Authorization: Bearer %s" -H "Content-Type: application/json" -d "{\"endpoint_id\":%d,\"job_name\":\"%s\",\"namespace\":\"%s\",\"status\":\"success\"}" "%s" || curl -X POST -H "Authorization: Bearer %s" -H "Content-Type: application/json" -d "{\"endpoint_id\":%d,\"job_name\":\"%s\",\"namespace\":\"%s\",\"status\":\"failure\"}" "%s"'`,
		escapedCommand,
		endpointToken, endpointID, jobName, namespace, successURL,
		endpointToken, endpointID, jobName, namespace, failureURL,
	)
	
	return wrapper
}

// wrapWindows wraps command for Windows systems
func wrapWindows(originalCommand, backendURL, endpointToken string, endpointID int, jobName, namespace string) string {
	successURL := fmt.Sprintf("%s/api/runs/check-in", backendURL)
	failureURL := fmt.Sprintf("%s/api/runs/check-in", backendURL)
	
	// Escape quotes for PowerShell
	escapedCommand := strings.ReplaceAll(originalCommand, "\"", "`\"")
	
	// Build PowerShell wrapper script
	wrapper := fmt.Sprintf(
		`powershell.exe -Command "$ErrorActionPreference='Stop'; try { %s; Invoke-RestMethod -Uri '%s' -Method POST -Headers @{'Authorization'='Bearer %s'; 'Content-Type'='application/json'} -Body (ConvertTo-Json @{endpoint_id=%d; job_name='%s'; namespace='%s'; status='success'}) } catch { Invoke-RestMethod -Uri '%s' -Method POST -Headers @{'Authorization'='Bearer %s'; 'Content-Type'='application/json'} -Body (ConvertTo-Json @{endpoint_id=%d; job_name='%s'; namespace='%s'; status='failure'}) }"`,
		escapedCommand,
		successURL, endpointToken, endpointID, jobName, namespace,
		failureURL, endpointToken, endpointID, jobName, namespace,
	)
	
	return wrapper
}

// ShouldWrap determines if a command should be wrapped
// Don't wrap if it's already wrapped or if it's a special command
func ShouldWrap(command string) bool {
	// Skip if already wrapped
	if strings.Contains(command, "check-in") {
		return false
	}
	if strings.Contains(command, "curl") && strings.Contains(command, "api/runs") {
		return false
	}
	if strings.Contains(command, "Invoke-RestMethod") && strings.Contains(command, "check-in") {
		return false
	}
	
	// Skip empty commands
	if strings.TrimSpace(command) == "" {
		return false
	}
	
	return true
}
