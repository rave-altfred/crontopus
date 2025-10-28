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

	// Check if job already exists
	for _, entry := range entries {
		if s.extractJobName(entry) == job.Name {
			return fmt.Errorf("job %s already exists", job.Name)
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

	// Find and replace the entry
	found := false
	for i, entry := range entries {
		if s.extractJobName(entry) == job.Name {
			entries[i] = s.formatCronEntry(job)
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("job %s not found", job.Name)
	}

	// Write back to crontab
	return s.writeCrontab(entries)
}

// Remove deletes a cron job
func (s *CronScheduler) Remove(name string) error {
	// Get current crontab
	entries, err := s.readCrontab()
	if err != nil {
		return fmt.Errorf("failed to read crontab: %w", err)
	}

	// Filter out the job
	newEntries := []string{}
	found := false
	for _, entry := range entries {
		if s.extractJobName(entry) == name {
			found = true
			continue // Skip this entry
		}
		newEntries = append(newEntries, entry)
	}

	if !found {
		return fmt.Errorf("job %s not found", name)
	}

	// Write back to crontab
	return s.writeCrontab(newEntries)
}

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
func (s *CronScheduler) formatCronEntry(job JobEntry) string {
	return fmt.Sprintf("%s %s %s%s", job.Schedule, job.Command, s.marker, job.Name)
}

// parseCronEntry parses a cron line into a JobEntry
func (s *CronScheduler) parseCronEntry(line string) *JobEntry {
	// Only parse Crontopus-managed entries
	if !strings.Contains(line, s.marker) {
		return nil
	}

	// Extract job name from marker
	parts := strings.Split(line, s.marker)
	if len(parts) != 2 {
		return nil
	}

	name := strings.TrimSpace(parts[1])
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
		Name:     name,
		Schedule: schedule,
		Command:  command,
	}
}

// extractJobName extracts the job name from a cron entry
func (s *CronScheduler) extractJobName(line string) string {
	if job := s.parseCronEntry(line); job != nil {
		return job.Name
	}
	return ""
}
