package wrapper

import (
	_ "embed"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

//go:embed templates/checkin.sh
var checkinScriptTemplate string

//go:embed templates/run-job.sh
var runJobScriptTemplate string

// InstallCheckinScript installs the check-in helper script to ~/.crontopus/bin/checkin
// and the run-job wrapper to ~/.crontopus/bin/run-job
func InstallCheckinScript() error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to get home directory: %w", err)
	}

	binDir := filepath.Join(homeDir, ".crontopus", "bin")
	if err := os.MkdirAll(binDir, 0755); err != nil {
		return fmt.Errorf("failed to create bin directory: %w", err)
	}

	// Install checkin script
	checkinPath := filepath.Join(binDir, "checkin")
	if err := os.WriteFile(checkinPath, []byte(checkinScriptTemplate), 0755); err != nil {
		return fmt.Errorf("failed to write checkin script: %w", err)
	}

	// Install run-job script
	runJobPath := filepath.Join(binDir, "run-job")
	if err := os.WriteFile(runJobPath, []byte(runJobScriptTemplate), 0755); err != nil {
		return fmt.Errorf("failed to write run-job script: %w", err)
	}

	return nil
}

// WriteJobConfig writes job configuration to ~/.crontopus/jobs/<uuid>.yaml
// This config is read by the run-job script
func WriteJobConfig(jobID, jobName, namespace, command string) error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to get home directory: %w", err)
	}

	jobsDir := filepath.Join(homeDir, ".crontopus", "jobs")
	if err := os.MkdirAll(jobsDir, 0755); err != nil {
		return fmt.Errorf("failed to create jobs directory: %w", err)
	}

	configPath := filepath.Join(jobsDir, jobID+".yaml")
	configContent := fmt.Sprintf(`job_name: "%s"
namespace: "%s"
command: "%s"
`,
		strings.ReplaceAll(jobName, "\"", "\\\""),
		strings.ReplaceAll(namespace, "\"", "\\\""),
		strings.ReplaceAll(command, "\"", "\\\""),
	)

	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		return fmt.Errorf("failed to write job config: %w", err)
	}

	return nil
}

// WrapCommandWithID wraps a job using the elegant format with job config file
// Returns: ~/.crontopus/bin/run-job <uuid>
func WrapCommandWithID(jobID string) string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		// Fallback to relative path
		return fmt.Sprintf("~/.crontopus/bin/run-job %s", jobID)
	}
	
	runJobPath := filepath.Join(homeDir, ".crontopus", "bin", "run-job")
	return fmt.Sprintf("%s %s", runJobPath, jobID)
}

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
// Captures output, exit code, and timing information
func wrapUnix(originalCommand, backendURL, endpointToken string, endpointID int, jobName, namespace string) string {
	// Get home directory for checkin script path
	homeDir, err := os.UserHomeDir()
	if err != nil {
		// Fallback to inline curl if we can't get home dir
		return wrapUnixInline(originalCommand, backendURL, endpointToken, endpointID, jobName, namespace)
	}
	
	checkinScript := filepath.Join(homeDir, ".crontopus", "bin", "checkin")
	
	// Escape quotes in the original command
	escapedCommand := strings.ReplaceAll(originalCommand, "'", "'\\''")
	
	// Escape job name and namespace for shell (they may contain spaces)
	escapedJobName := strings.ReplaceAll(jobName, "'", "'\\''")
	escapedNamespace := strings.ReplaceAll(namespace, "'", "'\\''")
	
	// Build wrapper with output capture
	// Creates a wrapper script that:
	// 1. Records start time
	// 2. Captures stdout/stderr to temp file
	// 3. Records exit code
	// 4. Calculates duration
	// 5. Sends all data to checkin script
	wrapper := fmt.Sprintf(
		`sh -c 'LOGFILE=$(mktemp); START=$(date +%%s); { %s; } > "$LOGFILE" 2>&1; EXIT_CODE=$?; END=$(date +%%s); DURATION=$((END - START)); %s "%s" "%s" "$EXIT_CODE" "$DURATION" "$LOGFILE"; rm -f "$LOGFILE"; exit $EXIT_CODE'`,
		escapedCommand,
		checkinScript, escapedJobName, escapedNamespace,
	)
	
	return wrapper
}

// wrapUnixInline wraps command with inline curl (fallback method)
func wrapUnixInline(originalCommand, backendURL, endpointToken string, endpointID int, jobName, namespace string) string {
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
