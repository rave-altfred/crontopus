package scheduler

// CommandRunner abstracts OS command execution
type CommandRunner interface {
	Run(command string, args ...string) ([]byte, error)
	RunWithInput(input string, command string, args ...string) ([]byte, error)
}
