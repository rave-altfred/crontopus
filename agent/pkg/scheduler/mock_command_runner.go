package scheduler

// MockCommandRunner is a mock implementation of CommandRunner for testing
type MockCommandRunner struct {
	// Mock responses mapped by command name
	responses map[string][]byte
	errors    map[string]error
	// Capture executed commands
	executed []string
}

func NewMockCommandRunner() *MockCommandRunner {
	return &MockCommandRunner{
		responses: make(map[string][]byte),
		errors:    make(map[string]error),
		executed:  []string{},
	}
}

func (m *MockCommandRunner) Run(command string, args ...string) ([]byte, error) {
	cmdStr := command
	for _, arg := range args {
		cmdStr += " " + arg
	}
	m.executed = append(m.executed, cmdStr)

	if err, ok := m.errors[cmdStr]; ok {
		return nil, err
	}
	if output, ok := m.responses[cmdStr]; ok {
		return output, nil
	}
	return []byte{}, nil
}

func (m *MockCommandRunner) RunWithInput(input string, command string, args ...string) ([]byte, error) {
	return m.Run(command, args...)
}

// Mock helpers
func (m *MockCommandRunner) On(command string, output []byte) {
	m.responses[command] = output
}

func (m *MockCommandRunner) OnError(command string, err error) {
	m.errors[command] = err
}

func (m *MockCommandRunner) WasCalled(command string) bool {
	for _, cmd := range m.executed {
		if cmd == command {
			return true
		}
	}
	return false
}
