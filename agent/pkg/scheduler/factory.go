package scheduler

import (
	"fmt"
	"runtime"
)

// NewScheduler creates the appropriate scheduler for the current OS
func NewScheduler() (Scheduler, error) {
	switch runtime.GOOS {
	case "linux", "darwin":
		return NewCronScheduler()
	case "windows":
		return NewTaskScheduler()
	default:
		return nil, fmt.Errorf("unsupported operating system: %s", runtime.GOOS)
	}
}
