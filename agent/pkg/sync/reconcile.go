package sync

import (
	"fmt"
	"log"

	"github.com/crontopus/agent/pkg/client"
	"github.com/crontopus/agent/pkg/manifest"
	"github.com/crontopus/agent/pkg/scheduler"
	"github.com/crontopus/agent/pkg/wrapper"
)

// Reconciler manages synchronization between Git manifests and OS scheduler
type Reconciler struct {
	scheduler     scheduler.Scheduler
	parser        *manifest.Parser
	backendURL    string
	endpointID    int
	endpointToken string
}

// NewReconciler creates a new reconciler
func NewReconciler(sch scheduler.Scheduler, parser *manifest.Parser, backendURL string, endpointID int, endpointToken string) *Reconciler {
	return &Reconciler{
		scheduler:     sch,
		parser:        parser,
		backendURL:    backendURL,
		endpointID:    endpointID,
		endpointToken: endpointToken,
	}
}

// Reconcile syncs Git manifests with the OS scheduler
// Returns number of changes applied (added, updated, removed)
func (r *Reconciler) Reconcile() (int, error) {
	// Parse all manifests from Git
	manifests, err := r.parser.ParseAll()
	if err != nil {
		return 0, fmt.Errorf("failed to parse manifests: %w", err)
	}

	log.Printf("Reconciliation: Found %d job manifests in Git", len(manifests))

	// Get current scheduler state
	currentJobs, err := r.scheduler.List()
	if err != nil {
		return 0, fmt.Errorf("failed to list current jobs: %w", err)
	}

	log.Printf("Reconciliation: Found %d jobs in scheduler", len(currentJobs))

	// Build maps for easier comparison
	// Use UUID as key for precise matching
	desiredJobs := make(map[string]*manifest.JobManifest)
	for _, m := range manifests {
		if m.ShouldSchedule() {
			desiredJobs[m.Metadata.ID] = m
		}
	}

	// Map current jobs by UUID (new format) or fallback to name (legacy)
	currentJobsMap := make(map[string]scheduler.JobEntry)
	for _, job := range currentJobs {
		if job.ID != "" {
			// UUID-based job (new format)
			currentJobsMap[job.ID] = job
		} else {
			// Legacy format - use name as key (for backward compatibility)
			currentJobsMap[job.Name] = job
		}
	}

	changeCount := 0

	// Add or update jobs
	for jobID, manifest := range desiredJobs {
		command := manifest.GetFullCommand()
		
		// Wrap command with callback injection
		if wrapper.ShouldWrap(command) && r.backendURL != "" {
			// Use namespace from manifest (extracted from directory structure)
			namespace := manifest.Namespace
			if namespace == "" {
				namespace = "default"
			}
			command = wrapper.WrapCommand(command, r.backendURL, r.endpointToken, r.endpointID, manifest.Metadata.Name, namespace)
			log.Printf("Wrapped command for job '%s' (ID: %s) in namespace '%s' with callback injection", manifest.Metadata.Name, jobID, namespace)
		}
		
		jobEntry := scheduler.JobEntry{
			ID:        manifest.Metadata.ID,
			Name:      manifest.Metadata.Name,
			Namespace: manifest.Namespace,
			Schedule:  manifest.Spec.Schedule,
			Command:   command,
		}

		if existing, exists := currentJobsMap[jobID]; exists {
			// Job exists (matched by UUID), check if it needs update
			if r.needsUpdate(existing, jobEntry) {
				log.Printf("Reconciliation: Updating job '%s' (ID: %s)", manifest.Metadata.Name, jobID)
				if err := r.scheduler.Update(jobEntry); err != nil {
					log.Printf("Error updating job '%s': %v", manifest.Metadata.Name, err)
					continue
				}
				changeCount++
			} else {
				log.Printf("Reconciliation: Job '%s' (ID: %s) is up-to-date", manifest.Metadata.Name, jobID)
			}
		} else {
			// Job doesn't exist, add it
			log.Printf("Reconciliation: Adding new job '%s' (ID: %s)", manifest.Metadata.Name, jobID)
			if err := r.scheduler.Add(jobEntry); err != nil {
				log.Printf("Error adding job '%s': %v", manifest.Metadata.Name, err)
				continue
			}
			changeCount++
		}
	}

	// Remove jobs that are no longer in Git
	for key, job := range currentJobsMap {
		if _, exists := desiredJobs[key]; !exists {
			// Only remove Crontopus-managed jobs (with markers)
			if job.ID != "" || job.Name != "" {
				displayName := job.Name
				if displayName == "" {
					displayName = job.ID
				}
				log.Printf("Reconciliation: Removing job '%s' (no longer in Git)", displayName)
				if err := r.scheduler.Remove(job.Name); err != nil {
					log.Printf("Error removing job '%s': %v", displayName, err)
					continue
				}
				changeCount++
			}
		}
	}

	log.Printf("Reconciliation complete: %d changes applied", changeCount)
	return changeCount, nil
}

// needsUpdate checks if a job needs to be updated
func (r *Reconciler) needsUpdate(current, desired scheduler.JobEntry) bool {
	// Compare schedule and command
	if current.Schedule != desired.Schedule {
		return true
	}
	if current.Command != desired.Command {
		return true
	}
	return false
}

// DetectDrift checks if there are differences between Git and scheduler
// Returns true if drift detected, false otherwise
func (r *Reconciler) DetectDrift() (bool, error) {
	// Parse all manifests from Git
	manifests, err := r.parser.ParseAll()
	if err != nil {
		return false, fmt.Errorf("failed to parse manifests: %w", err)
	}

	// Get current scheduler state
	currentJobs, err := r.scheduler.List()
	if err != nil {
		return false, fmt.Errorf("failed to list current jobs: %w", err)
	}

	// Build maps
	desiredJobs := make(map[string]*manifest.JobManifest)
	for _, m := range manifests {
		if m.ShouldSchedule() {
			desiredJobs[m.Metadata.Name] = m
		}
	}

	currentJobsMap := make(map[string]scheduler.JobEntry)
	for _, job := range currentJobs {
		currentJobsMap[job.Name] = job
	}

	// Check for drift

	// 1. Check if number of jobs differs
	if len(desiredJobs) != len(currentJobsMap) {
		return true, nil
	}

	// 2. Check if any job needs update
	for name, manifest := range desiredJobs {
		jobEntry := scheduler.JobEntry{
			Name:      manifest.Metadata.Name,
			Namespace: manifest.Namespace,
			Schedule:  manifest.Spec.Schedule,
			Command:   manifest.GetFullCommand(),
		}

		if existing, exists := currentJobsMap[name]; exists {
			if r.needsUpdate(existing, jobEntry) {
				return true, nil
			}
		} else {
			// Job in Git but not in scheduler
			return true, nil
		}
	}

	// 3. Check if there are jobs in scheduler not in Git
	for name := range currentJobsMap {
		if _, exists := desiredJobs[name]; !exists {
			return true, nil
		}
	}

	// No drift detected
	return false, nil
}

// ReportJobInstances reports current job instances to the backend
func (r *Reconciler) ReportJobInstances(apiClient *client.Client) error {
	// Get all manifests to determine namespace and source
	manifests, err := r.parser.ParseAll()
	if err != nil {
		return fmt.Errorf("failed to parse manifests: %w", err)
	}
	
	// Build map of job names to manifests
	manifestMap := make(map[string]*manifest.JobManifest)
	for _, m := range manifests {
		manifestMap[m.Metadata.Name] = m
	}
	
	// Get currently scheduled jobs
	currentJobs, err := r.scheduler.List()
	if err != nil {
		return fmt.Errorf("failed to list current jobs: %w", err)
	}
	
	// Build job instances
	instances := []client.JobInstance{}
	for _, job := range currentJobs {
		namespace := "default"
		source := "git"
		
		// Check if job is from Git manifest
		if manifest, exists := manifestMap[job.Name]; exists {
			// Use namespace from manifest (extracted from directory structure)
			namespace = manifest.Namespace
			if namespace == "" {
				namespace = "default"
			}
		} else {
			// Job not in manifests = discovered
			source = "discovered"
			namespace = "discovered"
		}
		
		instances = append(instances, client.JobInstance{
			JobName:   job.Name,
			Namespace: namespace,
			Status:    "scheduled", // Assume scheduled if in scheduler
			Source:    source,
			Command:   job.Command,
		})
	}
	
	// Report to backend
	if len(instances) > 0 {
		if err := apiClient.ReportJobInstances(r.endpointID, instances); err != nil {
			return fmt.Errorf("failed to report job instances: %w", err)
		}
		log.Printf("Reported %d job instances to backend", len(instances))
	}
	
	return nil
}
