package scheduler

import (
	"testing"
)

func TestCronScheduler_AddListRemove(t *testing.T) {
	// Only run on Unix-like systems
	if !isCronAvailable() {
		t.Skip("crontab not available on this system")
	}

	scheduler, err := NewCronScheduler()
	if err != nil {
		t.Fatalf("Failed to create cron scheduler: %v", err)
	}

	// Clean up any existing test jobs
	_ = scheduler.Remove("test-job-1")

	// Test Add
	testJob := JobEntry{
		Name:     "test-job-1",
		Schedule: "0 2 * * *",
		Command:  "echo 'test'",
	}

	err = scheduler.Add(testJob)
	if err != nil {
		t.Fatalf("Failed to add job: %v", err)
	}

	// Test List
	jobs, err := scheduler.List()
	if err != nil {
		t.Fatalf("Failed to list jobs: %v", err)
	}

	found := false
	for _, job := range jobs {
		if job.Name == "test-job-1" {
			found = true
			if job.Schedule != "0 2 * * *" {
				t.Errorf("Expected schedule '0 2 * * *', got '%s'", job.Schedule)
			}
			if job.Command != "echo 'test'" {
				t.Errorf("Expected command 'echo 'test'', got '%s'", job.Command)
			}
		}
	}

	if !found {
		t.Error("Added job not found in list")
	}

	// Test Verify
	exists, err := scheduler.Verify("test-job-1")
	if err != nil {
		t.Fatalf("Failed to verify job: %v", err)
	}
	if !exists {
		t.Error("Job should exist after adding")
	}

	// Test Remove
	err = scheduler.Remove("test-job-1")
	if err != nil {
		t.Fatalf("Failed to remove job: %v", err)
	}

	// Verify removal
	exists, err = scheduler.Verify("test-job-1")
	if err != nil {
		t.Fatalf("Failed to verify job after removal: %v", err)
	}
	if exists {
		t.Error("Job should not exist after removal")
	}
}

func TestCronScheduler_Update(t *testing.T) {
	if !isCronAvailable() {
		t.Skip("crontab not available on this system")
	}

	scheduler, err := NewCronScheduler()
	if err != nil {
		t.Fatalf("Failed to create cron scheduler: %v", err)
	}

	// Clean up
	_ = scheduler.Remove("test-job-update")

	// Add initial job
	testJob := JobEntry{
		Name:     "test-job-update",
		Schedule: "0 3 * * *",
		Command:  "echo 'original'",
	}

	err = scheduler.Add(testJob)
	if err != nil {
		t.Fatalf("Failed to add job: %v", err)
	}

	// Update job
	updatedJob := JobEntry{
		Name:     "test-job-update",
		Schedule: "0 4 * * *",
		Command:  "echo 'updated'",
	}

	err = scheduler.Update(updatedJob)
	if err != nil {
		t.Fatalf("Failed to update job: %v", err)
	}

	// Verify update
	jobs, err := scheduler.List()
	if err != nil {
		t.Fatalf("Failed to list jobs: %v", err)
	}

	for _, job := range jobs {
		if job.Name == "test-job-update" {
			if job.Schedule != "0 4 * * *" {
				t.Errorf("Expected updated schedule '0 4 * * *', got '%s'", job.Schedule)
			}
			if job.Command != "echo 'updated'" {
				t.Errorf("Expected updated command 'echo 'updated'', got '%s'", job.Command)
			}
		}
	}

	// Clean up
	_ = scheduler.Remove("test-job-update")
}

func TestCronScheduler_AddDuplicate(t *testing.T) {
	if !isCronAvailable() {
		t.Skip("crontab not available on this system")
	}

	scheduler, err := NewCronScheduler()
	if err != nil {
		t.Fatalf("Failed to create cron scheduler: %v", err)
	}

	// Clean up
	_ = scheduler.Remove("test-job-dup")

	testJob := JobEntry{
		Name:     "test-job-dup",
		Schedule: "0 5 * * *",
		Command:  "echo 'test'",
	}

	// Add first time
	err = scheduler.Add(testJob)
	if err != nil {
		t.Fatalf("Failed to add job: %v", err)
	}

	// Try to add again - should fail
	err = scheduler.Add(testJob)
	if err == nil {
		t.Error("Expected error when adding duplicate job, got nil")
	}

	// Clean up
	_ = scheduler.Remove("test-job-dup")
}

// isCronAvailable checks if crontab command is available
func isCronAvailable() bool {
	_, err := NewCronScheduler()
	return err == nil
}
