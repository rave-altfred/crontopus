package scheduler

// JobEntry represents a scheduled job
type JobEntry struct {
	ID        string // UUID from manifest (primary identifier)
	Name      string // Job name from manifest (human-readable)
	Namespace string // Namespace/group (from directory structure)
	Schedule  string // Cron expression
	Command   string // Command to execute
	User      string // User to run as (optional)
}

// Scheduler is the interface for managing scheduled jobs
type Scheduler interface {
	// Add creates a new scheduled job
	Add(job JobEntry) error

	// Update modifies an existing scheduled job
	Update(job JobEntry) error

	// Remove deletes a scheduled job by name
	Remove(name string) error

	// List returns all currently scheduled jobs managed by Crontopus
	List() ([]JobEntry, error)

	// ListAll returns ALL scheduled jobs (including non-Crontopus jobs)
	ListAll() ([]JobEntry, error)

	// Verify checks if a job exists and matches the expected state
	Verify(name string) (bool, error)
}
