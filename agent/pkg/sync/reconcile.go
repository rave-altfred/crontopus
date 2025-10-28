package sync

import (
	"fmt"
	"log"

	"github.com/crontopus/agent/pkg/manifest"
	"github.com/crontopus/agent/pkg/scheduler"
)

// Reconciler manages synchronization between Git manifests and OS scheduler
type Reconciler struct {
	scheduler scheduler.Scheduler
	parser    *manifest.Parser
}

// NewReconciler creates a new reconciler
func NewReconciler(sch scheduler.Scheduler, parser *manifest.Parser) *Reconciler {
	return &Reconciler{
		scheduler: sch,
		parser:    parser,
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

	changeCount := 0

	// Add or update jobs
	for name, manifest := range desiredJobs {
		jobEntry := scheduler.JobEntry{
			Name:     manifest.Metadata.Name,
			Schedule: manifest.Spec.Schedule,
			Command:  manifest.GetFullCommand(),
		}

		if existing, exists := currentJobsMap[name]; exists {
			// Job exists, check if it needs update
			if r.needsUpdate(existing, jobEntry) {
				log.Printf("Reconciliation: Updating job '%s'", name)
				if err := r.scheduler.Update(jobEntry); err != nil {
					log.Printf("Error updating job '%s': %v", name, err)
					continue
				}
				changeCount++
			} else {
				log.Printf("Reconciliation: Job '%s' is up-to-date", name)
			}
		} else {
			// Job doesn't exist, add it
			log.Printf("Reconciliation: Adding new job '%s'", name)
			if err := r.scheduler.Add(jobEntry); err != nil {
				log.Printf("Error adding job '%s': %v", name, err)
				continue
			}
			changeCount++
		}
	}

	// Remove jobs that are no longer in Git
	for name := range currentJobsMap {
		if _, exists := desiredJobs[name]; !exists {
			log.Printf("Reconciliation: Removing job '%s' (no longer in Git)", name)
			if err := r.scheduler.Remove(name); err != nil {
				log.Printf("Error removing job '%s': %v", name, err)
				continue
			}
			changeCount++
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
			Name:     manifest.Metadata.Name,
			Schedule: manifest.Spec.Schedule,
			Command:  manifest.GetFullCommand(),
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
