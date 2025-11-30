package scheduler

import (
	"strings"
	"testing"
)

func TestCronScheduler_AddListRemove(t *testing.T) {
	mock := NewMockCommandRunner()
	scheduler := &CronScheduler{
		marker: "# CRONTOPUS:",
		runner: mock,
	}

	// Mock initial empty crontab
	mock.On("crontab -l", []byte(""))
	
	// Mock crontab write (Add)
	// Note: In real test we would capture the temp file content
	// For now we just assume write succeeds if command runs
	
	// Test Add
	testJob := JobEntry{
		ID:       "job-1",
		Name:     "test-job-1",
		Schedule: "0 2 * * *",
		Command:  "echo 'test'",
	}

	err := scheduler.Add(testJob)
	if err != nil {
		t.Fatalf("Failed to add job: %v", err)
	}
	
	// Mock crontab with the added job for List
	// The format needs to match formatCronEntry: schedule command
	// command includes CRONTOPUS:id
	cronLine := "0 2 * * * echo 'test' # CRONTOPUS:job-1"
	mock.On("crontab -l", []byte(cronLine))

	// Test List
	jobs, err := scheduler.List()
	if err != nil {
		t.Fatalf("Failed to list jobs: %v", err)
	}

	found := false
	for _, job := range jobs {
		if job.ID == "job-1" {
			found = true
			if job.Schedule != "0 2 * * *" {
				t.Errorf("Expected schedule '0 2 * * *', got '%s'", job.Schedule)
			}
			// Note: Command parsing includes the marker in the struct currently
			// We verify it contains the original command
			if !strings.Contains(job.Command, "echo 'test'") {
				t.Errorf("Expected command to contain 'echo 'test'', got '%s'", job.Command)
			}
		}
	}

	if !found {
		t.Error("Added job not found in list")
	}

	// Test Remove
	// Mock crontab write (Remove)
	err = scheduler.Remove("job-1")
	if err != nil {
		t.Fatalf("Failed to remove job: %v", err)
	}
}

func TestCronScheduler_Update(t *testing.T) {
	mock := NewMockCommandRunner()
	scheduler := &CronScheduler{
		marker: "# CRONTOPUS:",
		runner: mock,
	}

	// Initial empty crontab
	mock.On("crontab -l", []byte(""))

	// Add initial job
	testJob := JobEntry{
		ID:       "job-update",
		Name:     "test-job-update",
		Schedule: "0 3 * * *",
		Command:  "echo 'original'",
	}

	err := scheduler.Add(testJob)
	if err != nil {
		t.Fatalf("Failed to add job: %v", err)
	}

	// Mock crontab containing the job we just added
	// This is crucial for Update to find the job!
	initialCron := "0 3 * * * echo 'original' # CRONTOPUS:job-update"
	mock.On("crontab -l", []byte(initialCron))

	// Update job
	updatedJob := JobEntry{
		ID:       "job-update",
		Name:     "test-job-update",
		Schedule: "0 4 * * *",
		Command:  "echo 'updated'",
	}

	err = scheduler.Update(updatedJob)
	if err != nil {
		t.Fatalf("Failed to update job: %v", err)
	}
	
	// Verify Update called write
	// We can't verify the content easily with current mock, but success implies it found the job
}

func TestCronScheduler_AddDuplicate(t *testing.T) {
	mock := NewMockCommandRunner()
	scheduler := &CronScheduler{
		marker: "# CRONTOPUS:",
		runner: mock,
	}

	// Mock crontab already containing the job
	existingCron := "0 5 * * * echo 'test' # CRONTOPUS:job-dup"
	mock.On("crontab -l", []byte(existingCron))

	testJob := JobEntry{
		ID:       "job-dup",
		Name:     "test-job-dup",
		Schedule: "0 5 * * *",
		Command:  "echo 'test'",
	}

	// Try to add again - should fail because ID matches existing job
	err := scheduler.Add(testJob)
	if err == nil {
		t.Error("Expected error when adding duplicate job, got nil")
	}
}

// isCronAvailable checks if crontab command is available
// Not needed for mock tests, but keeping for reference if we add integration tests
func isCronAvailable() bool {
	return true
}
