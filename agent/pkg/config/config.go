package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// Config represents the agent configuration
type Config struct {
	Agent   AgentConfig   `yaml:"agent"`
	Backend BackendConfig `yaml:"backend"`
}

// AgentConfig contains agent-specific configuration
type AgentConfig struct {
	Name     string `yaml:"name"`
	Hostname string `yaml:"hostname"`
	Platform string `yaml:"platform"`
	Version  string `yaml:"version"`
	// Path to store agent token
	TokenPath string `yaml:"token_path"`
}

// BackendConfig contains backend API configuration
type BackendConfig struct {
	APIURL string `yaml:"api_url"`
	// User token for initial enrollment (from CLI login)
	EnrollmentToken string `yaml:"enrollment_token"`
}

// LoadConfig loads configuration from a YAML file
func LoadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Set defaults
	if config.Agent.TokenPath == "" {
		homeDir, _ := os.UserHomeDir()
		config.Agent.TokenPath = homeDir + "/.crontopus/agent-token"
	}
	if config.Agent.Platform == "" {
		config.Agent.Platform = "darwin" // or detect dynamically
	}
	if config.Agent.Version == "" {
		config.Agent.Version = "0.1.0"
	}

	return &config, nil
}
