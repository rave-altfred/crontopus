package integration

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/crontopus/agent/pkg/scheduler"
	"github.com/docker/docker/pkg/stdcopy"
	"github.com/stretchr/testify/assert"
	"github.com/testcontainers/testcontainers-go"
)

// DockerExitError implements ExitError interface
type DockerExitError struct {
	Code int
	msg  string
}

func (e *DockerExitError) Error() string {
	return e.msg
}

func (e *DockerExitError) ExitCode() int {
	return e.Code
}

// DockerCommandRunner implements scheduler.CommandRunner using a Docker container
type DockerCommandRunner struct {
	container testcontainers.Container
	ctx       context.Context
}

func (r *DockerCommandRunner) Run(name string, args ...string) ([]byte, error) {
	// Construct command string
	cmd := []string{name}
	cmd = append(cmd, args...)

	// Exec in container
	exitCode, reader, err := r.container.Exec(r.ctx, cmd)
	if err != nil {
		return nil, err
	}

	// Read output handling Docker multiplexing headers
	// We need separate buffers for stdout and stderr
	var stdout, stderr strings.Builder
	if _, err := stdcopy.StdCopy(&stdout, &stderr, reader); err != nil {
		// Fallback for non-multiplexed streams (e.g. if TTY enabled)
		// But here we assume multiplexed.
		return nil, err
	}
	
	outputStr := stdout.String()
	if stderr.Len() > 0 {
		outputStr += stderr.String()
	}
	output := []byte(outputStr)

	if exitCode != 0 {
		return output, &DockerExitError{
			Code: exitCode,
			msg:  fmt.Sprintf("command failed with exit code %d: %s", exitCode, string(output)),
		}
	}

	return output, nil
}

func (r *DockerCommandRunner) RunWithInput(input string, name string, args ...string) ([]byte, error) {
	// 1. Create temp file on host
	tmpFile, err := os.CreateTemp("", "docker-input-*")
	if err != nil {
		return nil, err
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString(input); err != nil {
		return nil, err
	}
	tmpFile.Close()

	// 2. Copy to container
	containerPath := "/tmp/input-" + filepath.Base(tmpFile.Name())
	if err := r.container.CopyFileToContainer(r.ctx, tmpFile.Name(), containerPath, 0644); err != nil {
		return nil, err
	}

	// 3. Execute command using sh -c to pipe input
	// This simulates: cat input | command args
	// We escape the command arguments just in case (simplistic escaping)
	flatArgs := ""
	for _, arg := range args {
		flatArgs += " " + arg
	}
	
	fullCmd := []string{"sh", "-c", fmt.Sprintf("cat %s | %s%s", containerPath, name, flatArgs)}

	exitCode, reader, err := r.container.Exec(r.ctx, fullCmd)
	if err != nil {
		return nil, err
	}

	// Read output handling Docker headers
	var stdout, stderr strings.Builder
	if _, err := stdcopy.StdCopy(&stdout, &stderr, reader); err != nil {
		return nil, err
	}
	
	outputStr := stdout.String()
	if stderr.Len() > 0 {
		outputStr += stderr.String()
	}
	output := []byte(outputStr)

	if exitCode != 0 {
		return output, &DockerExitError{
			Code: exitCode,
			msg:  fmt.Sprintf("command failed with exit code %d: %s", exitCode, string(output)),
		}
	}

	return output, nil
}

func TestCronSchedulerIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	ctx := context.Background()

	// Start Ubuntu container with cron installed
	req := testcontainers.ContainerRequest{
		Image: "ubuntu:22.04",
		Cmd:   []string{"tail", "-f", "/dev/null"}, // Keep running
		Env: map[string]string{
			"DEBIAN_FRONTEND": "noninteractive",
		},
	}

	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	assert.NoError(t, err)
	defer container.Terminate(ctx)

	// Install cron inside container
	// We do this via Exec after start because LifecycleHooks are complex to debug if they fail
	exitCode, _, err := container.Exec(ctx, []string{"apt-get", "update"})
	assert.NoError(t, err)
	assert.Equal(t, 0, exitCode, "apt-get update failed")

	exitCode, _, err = container.Exec(ctx, []string{"apt-get", "install", "-y", "cron"})
	assert.NoError(t, err)
	assert.Equal(t, 0, exitCode, "apt-get install cron failed")

	runner := &DockerCommandRunner{
		container: container,
		ctx:       ctx,
	}

	// Initialize Scheduler with Docker Runner
	s := scheduler.NewCronSchedulerWithRunner(runner)

	// Test 1: Add job
	job := scheduler.JobEntry{
		ID:       "test-job-1",
		Name:     "Test Job 1",
		Schedule: "* * * * *",
		Command:  "echo hello",
	}
	// Manually add marker as per note
	job.Command = "echo hello # CRONTOPUS:test-job-1"

	err = s.Add(job)
	assert.NoError(t, err, "Add should succeed")

	// Verify with raw command
	out, err := runner.Run("crontab", "-l")
	assert.NoError(t, err)
	output := string(out)
	assert.Contains(t, output, "echo hello")
	assert.Contains(t, output, "CRONTOPUS:test-job-1")

	// Test 2: List back
	listedJobs, err := s.List()
	assert.NoError(t, err)
	assert.Len(t, listedJobs, 1)
	assert.Equal(t, "test-job-1", listedJobs[0].ID)
	assert.Equal(t, "echo hello # CRONTOPUS:test-job-1", listedJobs[0].Command)

	// Test 3: Clear / Remove
	err = s.Remove("test-job-1")
	assert.NoError(t, err)

	out, err = runner.Run("crontab", "-l")
	// Should be empty or contain no crontopus jobs
	output = string(out)
	assert.NotContains(t, output, "test-job-1")
}
