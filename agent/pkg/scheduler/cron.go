package scheduler

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// CronScheduler manages jobs using cron
type CronScheduler struct {
	// Marker to identify Crontopus-managed entries
	marker string
	// Command runner for executing crontab
	runner CommandRunner
}

// NewCronScheduler creates a new cron scheduler
func NewCronScheduler() (*CronScheduler, error) {
	return &CronScheduler{
		marker: "# CRONTOPUS:",
		runner: &RealCommandRunner{},
	}, nil
}

// Add creates a new cron job
// Automatically removes any discovered (unmarked) jobs with the same name to avoid duplicates
func (s *CronScheduler) Add(job JobEntry) error {
	// Get current crontab
	entries, err := s.readCrontab()
	if err != nil {
		return fmt.Errorf("failed to read crontab: %w", err)
	}

	// Build list of new entries, removing both:
	// 1. Existing Crontopus-managed jobs with same ID/name (error case)
	// 2. Discovered (unmarked) jobs with matching command (deduplication)
	newEntries := []string{}
	for _, entry := range entries {
		// Skip empty lines and comments
		if strings.TrimSpace(entry) == "" || (strings.HasPrefix(strings.TrimSpace(entry), "#") && !strings.Contains(strings.TrimSpace(entry), "CRONTOPUS:")) {
			newEntries = append(newEntries, entry)
			continue
		}
		
		// Check for existing Crontopus-managed job
		existingJob := s.parseCronEntry(entry)
		if existingJob != nil {
			// Only check UUID collision - UUID is the unique identifier
			if job.ID != "" && existingJob.ID != "" && existingJob.ID == job.ID {
				return fmt.Errorf("job with ID %s already exists", job.ID)
			}
			newEntries = append(newEntries, entry)
			continue
		}
		
		// Check for discovered job with identical command content
		// Discovered jobs are unmarked, but may have same command as job we're adding
		if !strings.Contains(entry, s.marker) {
			fields := strings.Fields(entry)
			if len(fields) >= 6 {
				discoveredCommand := strings.Join(fields[5:], " ")
				
				// Remove discovered job if command exactly matches
				// This prevents duplicates when taking over a discovered job
				if discoveredCommand == job.Command {
					continue // Skip - we're replacing it with UUID-tracked version
				}
			}
		}
		
		newEntries = append(newEntries, entry)
	}

	// Add new entry
	newEntry := s.formatCronEntry(job)
	newEntries = append(newEntries, newEntry)

	// Write back to crontab
	return s.writeCrontab(newEntries)
}

// Update modifies an existing cron job
func (s *CronScheduler) Update(job JobEntry) error {
	// Get current crontab
	entries, err := s.readCrontab()
	if err != nil {
		return fmt.Errorf("failed to read crontab: %w", err)
	}

	// Find and replace the entry (match by UUID if available, else by name)
	found := false
	for i, entry := range entries {
		existingJob := s.parseCronEntry(entry)
		if existingJob != nil {
			// Match by UUID if both have UUIDs
			if job.ID != "" && existingJob.ID != "" {
				if existingJob.ID == job.ID {
					entries[i] = s.formatCronEntry(job)
					found = true
					break
				}
			} else if existingJob.Name == job.Name {
				// Fall back to name matching for legacy jobs
				entries[i] = s.formatCronEntry(job)
				found = true
				break
			}
		}
	}

	if !found {
		return fmt.Errorf("job %s not found", job.Name)
	}

	// Write back to crontab
	return s.writeCrontab(entries)
}

// Remove deletes a cron job by name (supports both UUID and name-based lookups)
func (s *CronScheduler) Remove(identifier string) error {
	// Get current crontab
	entries, err := s.readCrontab()
	if err != nil {
		return fmt.Errorf("failed to read crontab: %w", err)
	}

	// Filter out the job (match by UUID or name)
	newEntries := []string{}
	found := false
	for _, entry := range entries {
		existingJob := s.parseCronEntry(entry)
		if existingJob != nil {
			// Match by UUID first, then by name
			if (existingJob.ID != "" && existingJob.ID == identifier) || existingJob.Name == identifier {
				found = true
				continue // Skip this entry
			}
		}
		newEntries = append(newEntries, entry)
	}

	if !found {
		return fmt.Errorf("job %s not found", identifier)
	}

	// Write back to crontab
	return s.writeCrontab(newEntries)
}

// List returns all Crontopus-managed cron jobs
// List returns all Crontopus-managed cron jobs
func (s *CronScheduler) List() ([]JobEntry, error) {
	entries, err := s.readCrontab()
	if err != nil {
		return nil, fmt.Errorf("failed to read crontab: %w", err)
	}

	jobs := []JobEntry{}
	for _, entry := range entries {
		if job := s.parseCronEntry(entry); job != nil {
			jobs = append(jobs, *job)
		}
	}

	return jobs, nil
}

// ListAll returns ALL cron jobs (including non-Crontopus jobs)
func (s *CronScheduler) ListAll() ([]JobEntry, error) {
	entries, err := s.readCrontab()
	if err != nil {
		return nil, fmt.Errorf("failed to read crontab: %w", err)
	}

	jobs := []JobEntry{}
	for i, entry := range entries {
		// Skip empty lines and comments
		entry = strings.TrimSpace(entry)
		if entry == "" || strings.HasPrefix(entry, "#") {
			continue
		}

		// Try to parse as Crontopus-managed job first
		if job := s.parseCronEntry(entry); job != nil {
			jobs = append(jobs, *job)
			continue
		}

		// Parse as discovered job (non-Crontopus)
		fields := strings.Fields(entry)
		if len(fields) < 6 {
			continue // Invalid entry
		}

		schedule := strings.Join(fields[0:5], " ")
		command := strings.Join(fields[5:], " ")

		// Try to extract job name from checkin command
		// Checkin format: /path/to/checkin job-name namespace ...
		name := extractJobNameFromCheckin(command)
		if name == "" {
			// Fallback: generate unique name if we can't extract it
			name = fmt.Sprintf("discovered-job-%d", i)
		}
		
		// Try to extract namespace from checkin command
		namespace := extractNamespaceFromCheckin(command)
		if namespace == "" {
			namespace = "discovered"
		}

		jobs = append(jobs, JobEntry{
			Name:      name,
			Namespace: namespace,
			Schedule:  schedule,
			Command:   command,
		})
	}

	return jobs, nil
}

// RemoveByCommand removes a cron job by matching command (for unmarked jobs)
func (s *CronScheduler) RemoveByCommand(command string) error {
	// Get current crontab
	entries, err := s.readCrontab()
	if err != nil {
		return fmt.Errorf("failed to read crontab: %w", err)
	}

	// Filter out jobs matching the command
	newEntries := []string{}
	found := false
	for _, entry := range entries {
		// Skip empty lines
		if strings.TrimSpace(entry) == "" {
			continue
		}
		
	// Check if this is an unmarked job matching the command
	// Unmarked jobs don't contain CRONTOPUS:
	if !strings.Contains(entry, "CRONTOPUS:") {
		// Extract command from cron entry
		fields := strings.Fields(entry)
		if len(fields) >= 6 {
			entryCommand := strings.Join(fields[5:], " ")
			if entryCommand == command {
				found = true
				continue // Skip this entry
			}
		}
	}
		newEntries = append(newEntries, entry)
	}

	if !found {
		return nil // Not an error if not found
	}

	// Write back to crontab
	return s.writeCrontab(newEntries)
}

// Verify checks if a job exists
func (s *CronScheduler) Verify(name string) (bool, error) {
	entries, err := s.readCrontab()
	if err != nil {
		return false, fmt.Errorf("failed to read crontab: %w", err)
	}

	for _, entry := range entries {
		if s.extractJobName(entry) == name {
			return true, nil
		}
	}

	return false, nil
}

// readCrontab reads the current user's crontab
func (s *CronScheduler) readCrontab() ([]string, error) {
	output, err := s.runner.Run("crontab", "-l")
	
	// crontab returns error if no crontab exists
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
			// No crontab exists, return empty
			return []string{}, nil
		}
		// Some runners might return error if output is empty or command failed
		// We need to handle this based on how the runner reports errors
		// For now, assume standard exec.ExitError behavior
		return nil, err
	}

	// Parse lines
	scanner := bufio.NewScanner(strings.NewReader(string(output)))
	entries := []string{}
	for scanner.Scan() {
		entries = append(entries, scanner.Text())
	}

	return entries, nil
}

// writeCrontab writes the crontab entries
func (s *CronScheduler) writeCrontab(entries []string) error {
	// Create temp file
	tmpFile, err := os.CreateTemp("", "crontab-*")
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tmpFile.Name())

	// Write entries
	for _, entry := range entries {
		if _, err := tmpFile.WriteString(entry + "\n"); err != nil {
			return fmt.Errorf("failed to write to temp file: %w", err)
		}
	}
	tmpFile.Close()

	// Install crontab
	if _, err := s.runner.Run("crontab", tmpFile.Name()); err != nil {
		return fmt.Errorf("failed to install crontab: %w", err)
	}

	return nil
}

// formatCronEntry formats a JobEntry as a cron line
// Format: schedule command (where command includes CRONTOPUS:uuid)
func (s *CronScheduler) formatCronEntry(job JobEntry) string {
	// Command already contains CRONTOPUS:uuid marker (from WrapCommandWithID)
	return fmt.Sprintf("%s %s", job.Schedule, job.Command)
}

// parseCronEntry parses a cron line into a JobEntry
// Expected format: schedule command (where command contains CRONTOPUS:uuid)
func (s *CronScheduler) parseCronEntry(line string) *JobEntry {
	// Only parse Crontopus-managed entries (command contains CRONTOPUS:)
	if !strings.Contains(line, "CRONTOPUS:") {
		return nil
	}

	// Parse schedule and command
	// Format: "* * * * * command"
	fields := strings.Fields(line)
	if len(fields) < 6 {
		return nil
	}

	schedule := strings.Join(fields[0:5], " ")
	command := strings.Join(fields[5:], " ")
	
	// Extract UUID from command (format: /path/to/run-job CRONTOPUS:uuid)
	var id string
	if idx := strings.Index(command, "CRONTOPUS:"); idx != -1 {
		// Extract UUID after CRONTOPUS:
		uuidPart := command[idx+len("CRONTOPUS:"):]
		// UUID is the first token after CRONTOPUS:
		uuidFields := strings.Fields(uuidPart)
		if len(uuidFields) > 0 {
			id = uuidFields[0]
		}
	}
	
	if id == "" {
		return nil
	}

	// Extract name and namespace from job config file
	// For elegant format, we need to read the config file
	// But for listing purposes, we can use placeholder values
	// The reconciler will have the correct values from Git
	name := id // Use UUID as name fallback
	namespace := "default"
	
	// Try to read from job config if available
	homeDir, err := os.UserHomeDir()
	if err == nil {
		configPath := filepath.Join(homeDir, ".crontopus", "jobs", id+".yaml")
		if data, err := os.ReadFile(configPath); err == nil {
			// Parse YAML manually (simple key: value format)
			for _, line := range strings.Split(string(data), "\n") {
				if strings.HasPrefix(line, "job_name:") {
					name = strings.Trim(strings.TrimPrefix(line, "job_name:"), ` "'`)
				} else if strings.HasPrefix(line, "namespace:") {
					namespace = strings.Trim(strings.TrimPrefix(line, "namespace:"), ` "'`)
				}
			}
		}
	}

	return &JobEntry{
		ID:        id,
		Name:      name,
		Namespace: namespace,
		Schedule:  schedule,
		Command:   command,
	}
}

// extractJobName extracts the job name from a cron entry
func (s *CronScheduler) extractJobName(line string) string {
	if job := s.parseCronEntry(line); job != nil {
		return job.Name
	}
	return ""
}

// extractJobID extracts the job UUID from a cron entry
func (s *CronScheduler) extractJobID(line string) string {
	if job := s.parseCronEntry(line); job != nil {
		return job.ID
	}
	return ""
}

// extractJobNameFromCheckin extracts the job name from a checkin command
// Checkin format: sh -c '... /path/to/checkin "job-name" "namespace" ...'
func extractJobNameFromCheckin(command string) string {
	// Look for checkin command pattern
	if !strings.Contains(command, "checkin") {
		return ""
	}
	
	// Pattern: checkin "job-name" "namespace"
	// Find "checkin" and extract the next quoted or unquoted token
	parts := strings.Fields(command)
	for i, part := range parts {
		if strings.HasSuffix(part, "checkin") {
			// Job name is either:
			// 1. Next token if quoted (may span multiple fields)
			// 2. Next single field if unquoted
			
			// Look for quoted string starting after checkin
			rest := strings.Join(parts[i+1:], " ")
			if jobName := extractQuotedString(rest); jobName != "" {
				return jobName
			}
			
			// Fallback: unquoted single field
			if i+1 < len(parts) {
				return strings.Trim(parts[i+1], "'\"")
			}
		}
	}
	
	return ""
}

// extractNamespaceFromCheckin extracts the namespace from a checkin command
// Checkin format: sh -c '... /path/to/checkin "job-name" "namespace" ...'
func extractNamespaceFromCheckin(command string) string {
	// Look for checkin command pattern
	if !strings.Contains(command, "checkin") {
		return ""
	}
	
	// Pattern: checkin "job-name" "namespace"
	// Find "checkin", skip job name, extract namespace
	parts := strings.Fields(command)
	for i, part := range parts {
		if strings.HasSuffix(part, "checkin") {
			// Skip job name and extract namespace
			rest := strings.Join(parts[i+1:], " ")
			
			// Extract first quoted string (job name)
			if jobName := extractQuotedString(rest); jobName != "" {
				// Remove job name from rest and extract namespace
				after := strings.TrimSpace(strings.TrimPrefix(rest, fmt.Sprintf("\"%s\"", jobName)))
				if namespace := extractQuotedString(after); namespace != "" {
					return namespace
				}
			}
			
			// Fallback: unquoted, namespace is 2 fields after checkin
			if i+2 < len(parts) {
				return strings.Trim(parts[i+2], "'\"")
			}
		}
	}
	
	return ""
}

// extractQuotedString extracts the first quoted string from input
// Handles both single and double quotes
func extractQuotedString(s string) string {
	s = strings.TrimSpace(s)
	
	// Check for double quotes
	if strings.HasPrefix(s, "\"") {
		if end := strings.Index(s[1:], "\""); end != -1 {
			return s[1 : end+1]
		}
	}
	
	// Check for single quotes
	if strings.HasPrefix(s, "'") {
		if end := strings.Index(s[1:], "'"); end != -1 {
			return s[1 : end+1]
		}
	}
	
	return ""
}
