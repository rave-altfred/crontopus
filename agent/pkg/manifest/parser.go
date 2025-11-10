package manifest

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// JobManifest represents a parsed job manifest from YAML
type JobManifest struct {
	APIVersion string   `yaml:"apiVersion"`
	Kind       string   `yaml:"kind"`
	Metadata   Metadata `yaml:"metadata"`
	Spec       Spec     `yaml:"spec"`
	
	// Namespace is extracted from the directory structure (not from YAML)
	Namespace string `yaml:"-"`
}

// Metadata contains job metadata
type Metadata struct {
	Name        string            `yaml:"name"`
	Tenant      string            `yaml:"tenant"`
	Labels      map[string]string `yaml:"labels,omitempty"`
	Annotations map[string]string `yaml:"annotations,omitempty"`
}

// Spec contains job specification
type Spec struct {
	Schedule   string            `yaml:"schedule"`
	Timezone   string            `yaml:"timezone,omitempty"`
	Command    string            `yaml:"command"`
	Args       []string          `yaml:"args,omitempty"`
	WorkingDir string            `yaml:"workingDir,omitempty"`
	Env        map[string]string `yaml:"env,omitempty"`
	Checkin    *CheckinSpec      `yaml:"checkin,omitempty"`
	Retry      *RetrySpec        `yaml:"retry,omitempty"`
	Agent      *AgentSpec        `yaml:"agent,omitempty"`
	Enabled    *bool             `yaml:"enabled,omitempty"`
	Paused     *bool             `yaml:"paused,omitempty"`
}

// CheckinSpec contains check-in configuration
type CheckinSpec struct {
	Enabled bool   `yaml:"enabled"`
	Secret  string `yaml:"secret,omitempty"`
	Timeout int    `yaml:"timeout,omitempty"`
}

// RetrySpec contains retry configuration
type RetrySpec struct {
	Enabled  bool   `yaml:"enabled"`
	Attempts int    `yaml:"attempts,omitempty"`
	Backoff  string `yaml:"backoff,omitempty"`
}

// AgentSpec contains agent selection criteria
type AgentSpec struct {
	Selector map[string]string `yaml:"selector,omitempty"`
}

// Parser handles parsing job manifests from YAML files
type Parser struct {
	manifestDir string
}

// NewParser creates a new manifest parser
func NewParser(manifestDir string) *Parser {
	return &Parser{
		manifestDir: manifestDir,
	}
}

// ParseFile parses a single YAML file and extracts namespace from directory
func (p *Parser) ParseFile(filePath string) (*JobManifest, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file %s: %w", filePath, err)
	}

	var manifest JobManifest
	if err := yaml.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("failed to parse YAML in %s: %w", filePath, err)
	}

	// Extract namespace from directory structure
	// Path format: /path/to/manifests/namespace/job.yaml
	relPath, err := filepath.Rel(p.manifestDir, filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to get relative path for %s: %w", filePath, err)
	}
	
	// Get namespace from first directory component
	parts := strings.Split(filepath.ToSlash(relPath), "/")
	if len(parts) >= 2 {
		manifest.Namespace = parts[0]
	} else {
		// File directly in manifest dir (shouldn't happen, but default to "default")
		manifest.Namespace = "default"
	}

	// Validate manifest
	if err := p.validate(&manifest); err != nil {
		return nil, fmt.Errorf("validation failed for %s: %w", filePath, err)
	}

	return &manifest, nil
}

// ParseAll parses all YAML files in the manifest directory recursively
func (p *Parser) ParseAll() ([]*JobManifest, error) {
	var manifests []*JobManifest

	err := filepath.Walk(p.manifestDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip directories and non-YAML files
		if info.IsDir() {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		if ext != ".yaml" && ext != ".yml" {
			return nil
		}

		// Parse the file
		manifest, err := p.ParseFile(path)
		if err != nil {
			// Log error but continue parsing other files
			fmt.Printf("Warning: Failed to parse %s: %v\n", path, err)
			return nil
		}

		manifests = append(manifests, manifest)
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk manifest directory: %w", err)
	}

	return manifests, nil
}

// validate performs basic validation on the manifest
func (p *Parser) validate(m *JobManifest) error {
	// Check API version
	if m.APIVersion == "" {
		return fmt.Errorf("apiVersion is required")
	}
	if m.APIVersion != "v1" {
		return fmt.Errorf("unsupported apiVersion: %s (only v1 is supported)", m.APIVersion)
	}

	// Check kind
	if m.Kind != "Job" {
		return fmt.Errorf("unsupported kind: %s (only Job is supported)", m.Kind)
	}

	// Check metadata
	if m.Metadata.Name == "" {
		return fmt.Errorf("metadata.name is required")
	}
	if m.Metadata.Tenant == "" {
		return fmt.Errorf("metadata.tenant is required")
	}

	// Validate job name format (alphanumeric and hyphens, max 63 chars)
	if len(m.Metadata.Name) > 63 {
		return fmt.Errorf("metadata.name must be 63 characters or less")
	}

	// Check spec
	if m.Spec.Schedule == "" {
		return fmt.Errorf("spec.schedule is required")
	}
	if m.Spec.Command == "" {
		return fmt.Errorf("spec.command is required")
	}

	return nil
}

// IsEnabled returns whether the job is enabled
func (m *JobManifest) IsEnabled() bool {
	if m.Spec.Enabled != nil {
		return *m.Spec.Enabled
	}
	return true // Default to enabled
}

// IsPaused returns whether the job is paused
func (m *JobManifest) IsPaused() bool {
	if m.Spec.Paused != nil {
		return *m.Spec.Paused
	}
	return false // Default to not paused
}

// GetFullCommand returns the complete command with arguments
func (m *JobManifest) GetFullCommand() string {
	if len(m.Spec.Args) == 0 {
		return m.Spec.Command
	}

	// Join command and args
	parts := []string{m.Spec.Command}
	parts = append(parts, m.Spec.Args...)
	return strings.Join(parts, " ")
}

// ShouldSchedule returns whether the job should be scheduled
// (enabled and not paused)
func (m *JobManifest) ShouldSchedule() bool {
	return m.IsEnabled() && !m.IsPaused()
}
