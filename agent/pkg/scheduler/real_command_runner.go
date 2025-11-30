package scheduler

import (
	"os/exec"
	"strings"
)

// RealCommandRunner implements CommandRunner using os/exec
type RealCommandRunner struct{}

func (r *RealCommandRunner) Run(command string, args ...string) ([]byte, error) {
	cmd := exec.Command(command, args...)
	return cmd.Output()
}

func (r *RealCommandRunner) RunWithInput(input string, command string, args ...string) ([]byte, error) {
	cmd := exec.Command(command, args...)
	cmd.Stdin = strings.NewReader(input)
	return cmd.CombinedOutput()
}
