package scheduler

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// CronScheduler manages jobs using cron
type CronScheduler struct {
	// Marker to identify Crontopus-managed entries
	marker string
}

// NewCronScheduler creates a new cron scheduler
func NewCronScheduler() (*CronScheduler, error) {
	return &CronScheduler{
		marker: "# CRONTOPUS:",
	}, nil
}

// Add creates a new cron job
func (s *CronScheduler) Add(job JobEntry) error {
	// Get current crontab
	entries, err := s.readCrontab()
	if err != nil {
		return fmt.Errorf("failed to read crontab: %w", err)
	}

	// Check if job already exists (by UUID or name)
	for _, entry := range entries {
		existingJob := s.parseCronEntry(entry)
		if existingJob != nil {
			// Match by UUID if both have UUIDs
			if job.ID != "" && existingJob.ID != "" && existingJob.ID == job.ID {
				return fmt.Errorf("job with ID %s already exists", job.ID)
			}
			// Fall back to name matching for legacy jobs
			if existingJob.Name == job.Name {
				return fmt.Errorf("job %s already exists", job.Name)
			}
		}
	}

	// Add new entry
	newEntry := s.formatCronEntry(job)
	entries = append(entries, newEntry)

	// Write back to crontab
	return s.writeCrontab(entries)
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
		if !strings.Contains(entry, s.marker) {
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
	cmd := exec.Command("crontab", "-l")
	output, err := cmd.Output()
	
	// crontab returns error if no crontab exists
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
			// No crontab exists, return empty
			return []string{}, nil
		}
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
	cmd := exec.Command("crontab", tmpFile.Name())
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to install crontab: %w: %s", err, output)
	}

	return nil
}

// formatCronEntry formats a JobEntry as a cron line
// Format: schedule command # CRONTOPUS:job-uuid (new) or # CRONTOPUS:namespace:job-name (legacy)
func (s *CronScheduler) formatCronEntry(job JobEntry) string {
	// Use UUID-based marker (new format)
	if job.ID != "" {
		return fmt.Sprintf("%s %s %s%s", job.Schedule, job.Command, s.marker, job.ID)
	}
	
	// Fallback to old format (backward compatibility during migration)
	namespace := job.Namespace
	if namespace == "" {
		namespace = "default"
	}
	return fmt.Sprintf("%s %s %s%s:%s", job.Schedule, job.Command, s.marker, namespace, job.Name)
}

// parseCronEntry parses a cron line into a JobEntry
// Expected format: schedule command # CRONTOPUS:job-uuid (new) or # CRONTOPUS:namespace:job-name (legacy)
func (s *CronScheduler) parseCronEntry(line string) *JobEntry {
	// Only parse Crontopus-managed entries
	if !strings.Contains(line, s.marker) {
		return nil
	}

	// Extract identifier from marker
	parts := strings.Split(line, s.marker)
	if len(parts) != 2 {
		return nil
	}

	// Parse identifier (could be UUID or namespace:job-name)
	identifier := strings.TrimSpace(parts[1])
	identifierParts := strings.SplitN(identifier, ":", 2)
	
	var id, namespace, name string
	if len(identifierParts) == 1 {
		// New format: UUID only
		id = identifier
		// Name and namespace will be extracted from command or left empty
	} else if len(identifierParts) == 2 {
		// Legacy format: namespace:job-name
		namespace = identifierParts[0]
		name = identifierParts[1]
	}
	
	cronPart := strings.TrimSpace(parts[0])

	// Parse schedule and command
	// Format: "* * * * * command"
	fields := strings.Fields(cronPart)
	if len(fields) < 6 {
		return nil
	}

	schedule := strings.Join(fields[0:5], " ")
	command := strings.Join(fields[5:], " ")

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
// Checkin format: sh -c '... /path/to/checkin job-name namespace ...'
func extractJobNameFromCheckin(command string) string {
	// Look for checkin command pattern
	if !strings.Contains(command, "checkin") {
		return ""
	}
	
	// Pattern: checkin job-name namespace
	// Find "checkin" and extract the next two tokens
	parts := strings.Fields(command)
	for i, part := range parts {
		if strings.HasSuffix(part, "checkin") && i+1 < len(parts) {
			// Next token is job name
			jobName := parts[i+1]
			// Clean up any quotes or special chars
			jobName = strings.Trim(jobName, "'\"")
			return jobName
		}
	}
	
	return ""
}

// extractNamespaceFromCheckin extracts the namespace from a checkin command
// Checkin format: sh -c '... /path/to/checkin job-name namespace ...'
func extractNamespaceFromCheckin(command string) string {
	// Look for checkin command pattern
	if !strings.Contains(command, "checkin") {
		return ""
	}
	
	// Pattern: checkin job-name namespace
	// Find "checkin" and extract the namespace (3rd token after checkin)
	parts := strings.Fields(command)
	for i, part := range parts {
		if strings.HasSuffix(part, "checkin") && i+2 < len(parts) {
			// Token after job name is namespace
			namespace := parts[i+2]
			// Clean up any quotes or special chars
			namespace = strings.Trim(namespace, "'\"")
			return namespace
		}
	}
	
	return ""
}
