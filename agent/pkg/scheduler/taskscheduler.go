package scheduler

import (
	"encoding/xml"
	"fmt"
	"os/exec"
	"strings"
)

// TaskScheduler manages jobs using Windows Task Scheduler
type TaskScheduler struct {
	folderPath string
}

// NewTaskScheduler creates a new Task Scheduler adapter
func NewTaskScheduler() (*TaskScheduler, error) {
	return &TaskScheduler{
		folderPath: "\\Crontopus\\",
	}, nil
}

// Add creates a new scheduled task
func (s *TaskScheduler) Add(job JobEntry) error {
	// Check if task already exists
	exists, err := s.Verify(job.Name)
	if err != nil {
		return fmt.Errorf("failed to check if task exists: %w", err)
	}
	if exists {
		return fmt.Errorf("task %s already exists", job.Name)
	}

	// Convert cron schedule to Task Scheduler triggers
	triggers, err := s.cronToTriggers(job.Schedule)
	if err != nil {
		return fmt.Errorf("failed to parse schedule: %w", err)
	}

	// Create task XML
	taskXML := s.generateTaskXML(job.Name, job.Command, triggers)

	// Build task path with namespace: \Crontopus\{namespace}\{job-name}
	namespace := job.Namespace
	if namespace == "" {
		namespace = "default"
	}
	taskPath := s.folderPath + namespace + "\\" + job.Name
	cmd := exec.Command("schtasks", "/Create", "/TN", taskPath, "/XML", "-")
	cmd.Stdin = strings.NewReader(taskXML)
	
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to create task: %w: %s", err, output)
	}

	return nil
}

// Update modifies an existing scheduled task
func (s *TaskScheduler) Update(job JobEntry) error {
	// Remove and recreate (schtasks doesn't have direct update)
	if err := s.Remove(job.Name); err != nil {
		return err
	}
	return s.Add(job)
}

// Remove deletes a scheduled task
// Note: name should include namespace for removal
func (s *TaskScheduler) Remove(name string) error {
	// Try to find task in any namespace folder (backward compatible)
	taskPath := s.findTaskPath(name)
	if taskPath == "" {
		return fmt.Errorf("task %s not found", name)
	}
	
	cmd := exec.Command("schtasks", "/Delete", "/TN", taskPath, "/F")
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to delete task: %w: %s", err, output)
	}

	return nil
}

// findTaskPath searches for a task by name across all namespace folders
func (s *TaskScheduler) findTaskPath(name string) string {
	// List all tasks in Crontopus folder
	cmd := exec.Command("schtasks", "/Query", "/FO", "LIST")
	output, err := cmd.Output()
	if err != nil {
		return ""
	}
	
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "TaskName:") {
			taskPath := strings.TrimSpace(strings.TrimPrefix(line, "TaskName:"))
			if strings.HasPrefix(taskPath, s.folderPath) && strings.HasSuffix(taskPath, "\\"+name) {
				return taskPath
			}
		}
	}
	return ""
}

// List returns all Crontopus-managed scheduled tasks
func (s *TaskScheduler) List() ([]JobEntry, error) {
	// List all tasks in Crontopus folder
	cmd := exec.Command("schtasks", "/Query", "/TN", s.folderPath, "/FO", "LIST", "/V")
	output, err := cmd.Output()
	
	if err != nil {
		// If folder doesn't exist, return empty list
		if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
			return []JobEntry{}, nil
		}
		return nil, fmt.Errorf("failed to list tasks: %w", err)
	}

	// Parse output to extract task names
	jobs := []JobEntry{}
	lines := strings.Split(string(output), "\n")
	
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "TaskName:") {
			taskName := strings.TrimSpace(strings.TrimPrefix(line, "TaskName:"))
			// Remove folder path prefix
			taskName = strings.TrimPrefix(taskName, s.folderPath)
			
			if taskName != "" {
				// Get task details
				job, err := s.getTaskDetails(taskName)
				if err == nil {
					jobs = append(jobs, *job)
				}
			}
		}
	}

	return jobs, nil
}

// ListAll returns ALL scheduled tasks (including non-Crontopus tasks)
func (s *TaskScheduler) ListAll() ([]JobEntry, error) {
	// List all tasks (not just Crontopus folder)
	cmd := exec.Command("schtasks", "/Query", "/FO", "LIST", "/V")
	output, err := cmd.Output()
	
	if err != nil {
		return nil, fmt.Errorf("failed to list all tasks: %w", err)
	}

	jobs := []JobEntry{}
	lines := strings.Split(string(output), "\n")
	
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "TaskName:") {
			taskPath := strings.TrimSpace(strings.TrimPrefix(line, "TaskName:"))
			
			// Skip system tasks and empty names
			if taskPath == "" || strings.HasPrefix(taskPath, "\\Microsoft\\") {
				continue
			}
			
			// Extract task name from path
			parts := strings.Split(taskPath, "\\")
			taskName := parts[len(parts)-1]
			if taskName == "" {
				continue
			}
			
			// Try to get task details
			cmd := exec.Command("schtasks", "/Query", "/TN", taskPath, "/XML")
			taskOutput, err := cmd.Output()
			if err != nil {
				continue // Skip if we can't read details
			}
			
			// Parse XML
			var task Task
			if err := xml.Unmarshal(taskOutput, &task); err != nil {
				continue
			}
			
			command := ""
			if len(task.Actions.Exec) > 0 {
				command = task.Actions.Exec[0].Command
				if task.Actions.Exec[0].Arguments != "" {
					command += " " + task.Actions.Exec[0].Arguments
				}
			}
			
			// Convert triggers to cron (simplified)
			schedule := s.triggersToSimpleCron(task.Triggers)
			
			jobs = append(jobs, JobEntry{
				Name:     taskName,
				Schedule: schedule,
				Command:  command,
			})
		}
	}

	return jobs, nil
}

// Verify checks if a task exists
func (s *TaskScheduler) Verify(name string) (bool, error) {
	// Search for task (handles namespace folders)
	taskPath := s.findTaskPath(name)
	if taskPath == "" {
		return false, nil
	}
	cmd := exec.Command("schtasks", "/Query", "/TN", taskPath)
	
	if err := cmd.Run(); err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
			// Task doesn't exist
			return false, nil
		}
		return false, fmt.Errorf("failed to verify task: %w", err)
	}

	return true, nil
}

// getTaskDetails retrieves task details (simplified)
func (s *TaskScheduler) getTaskDetails(name string) (*JobEntry, error) {
	taskPath := s.folderPath + name
	cmd := exec.Command("schtasks", "/Query", "/TN", taskPath, "/XML")
	output, err := cmd.Output()
	
	if err != nil {
		return nil, fmt.Errorf("failed to get task XML: %w", err)
	}

	// Parse XML to extract command and schedule (basic parsing)
	var task Task
	if err := xml.Unmarshal(output, &task); err != nil {
		return nil, fmt.Errorf("failed to parse task XML: %w", err)
	}

	command := ""
	if len(task.Actions.Exec) > 0 {
		command = task.Actions.Exec[0].Command
		if task.Actions.Exec[0].Arguments != "" {
			command += " " + task.Actions.Exec[0].Arguments
		}
	}

	// Convert triggers back to cron format (simplified)
	schedule := s.triggersToSimpleCron(task.Triggers)

	return &JobEntry{
		Name:     name,
		Schedule: schedule,
		Command:  command,
	}, nil
}

// cronToTriggers converts cron schedule to Task Scheduler triggers (simplified)
func (s *TaskScheduler) cronToTriggers(cronSchedule string) (string, error) {
	// This is a simplified conversion
	// Full implementation would parse cron fields and create appropriate triggers
	// For now, return a basic daily trigger as placeholder
	return `<CalendarTrigger><StartBoundary>2024-01-01T00:00:00</StartBoundary><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger>`, nil
}

// triggersToSimpleCron converts triggers back to cron (simplified)
func (s *TaskScheduler) triggersToSimpleCron(triggers Triggers) string {
	// Simplified: return a placeholder cron
	return "0 0 * * *"
}

// generateTaskXML creates the Task Scheduler XML definition
func (s *TaskScheduler) generateTaskXML(name, command string, triggers string) string {
	// Split command into executable and arguments
	parts := strings.Fields(command)
	executable := parts[0]
	arguments := ""
	if len(parts) > 1 {
		arguments = strings.Join(parts[1:], " ")
	}

	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Crontopus managed task</Description>
  </RegistrationInfo>
  <Triggers>
    %s
  </Triggers>
  <Principals>
    <Principal>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>%s</Command>
      <Arguments>%s</Arguments>
    </Exec>
  </Actions>
</Task>`, triggers, executable, arguments)
}

// XML structs for parsing Task Scheduler XML
type Task struct {
	XMLName  xml.Name `xml:"Task"`
	Triggers Triggers `xml:"Triggers"`
	Actions  Actions  `xml:"Actions"`
}

type Triggers struct {
	CalendarTrigger []CalendarTrigger `xml:"CalendarTrigger"`
}

type CalendarTrigger struct {
	StartBoundary string `xml:"StartBoundary"`
}

type Actions struct {
	Exec []ExecAction `xml:"Exec"`
}

type ExecAction struct {
	Command   string `xml:"Command"`
	Arguments string `xml:"Arguments"`
}
