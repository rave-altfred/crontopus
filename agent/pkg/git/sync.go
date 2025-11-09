package git

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// Syncer handles Git repository operations for job manifests
type Syncer struct {
	repoURL     string
	localPath   string
	branch      string
	authToken   string // Access token for Git authentication
	username    string // Username for Git authentication
}

// NewSyncer creates a new Git syncer
func NewSyncer(repoURL, localPath, branch, authToken, username string) (*Syncer, error) {
	if repoURL == "" {
		return nil, fmt.Errorf("repository URL cannot be empty")
	}
	if localPath == "" {
		return nil, fmt.Errorf("local path cannot be empty")
	}
	if branch == "" {
		branch = "main" // Default to main branch
	}

	return &Syncer{
		repoURL:   repoURL,
		localPath: localPath,
		branch:    branch,
		authToken: authToken,
		username:  username,
	}, nil
}

// Clone clones the repository to local path
func (s *Syncer) Clone() error {
	// Check if directory already exists
	if _, err := os.Stat(s.localPath); err == nil {
		// Directory exists, check if it's a git repo
		gitDir := filepath.Join(s.localPath, ".git")
		if _, err := os.Stat(gitDir); err == nil {
			// Already cloned, do nothing
			return nil
		}
		// Directory exists but not a git repo, remove it
		if err := os.RemoveAll(s.localPath); err != nil {
			return fmt.Errorf("failed to remove existing directory: %w", err)
		}
	}

	// Construct authenticated URL if token provided
	cloneURL := s.getAuthenticatedURL()
	
	// Clone the repository
	cmd := exec.Command("git", "clone", "--branch", s.branch, "--single-branch", cloneURL, s.localPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to clone repository: %w: %s", err, output)
	}

	return nil
}

// Pull fetches and merges latest changes from remote
func (s *Syncer) Pull() error {
	// Check if local path exists
	if _, err := os.Stat(s.localPath); os.IsNotExist(err) {
		return fmt.Errorf("local repository does not exist, run Clone() first")
	}

	// Fetch latest changes
	cmd := exec.Command("git", "-C", s.localPath, "fetch", "origin", s.branch)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to fetch from remote: %w: %s", err, output)
	}

	// Reset to origin/branch (hard reset to handle any local changes)
	cmd = exec.Command("git", "-C", s.localPath, "reset", "--hard", fmt.Sprintf("origin/%s", s.branch))
	output, err = cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to reset to remote branch: %w: %s", err, output)
	}

	return nil
}

// GetCurrentCommit returns the current commit hash
func (s *Syncer) GetCurrentCommit() (string, error) {
	cmd := exec.Command("git", "-C", s.localPath, "rev-parse", "HEAD")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get current commit: %w", err)
	}

	return strings.TrimSpace(string(output)), nil
}

// Sync ensures the local repository is up-to-date
// Clones if not exists, pulls if exists
func (s *Syncer) Sync() error {
	if _, err := os.Stat(s.localPath); os.IsNotExist(err) {
		// Repository doesn't exist, clone it
		return s.Clone()
	}

	// Repository exists, pull latest changes
	return s.Pull()
}

// GetLocalPath returns the local path of the repository
func (s *Syncer) GetLocalPath() string {
	return s.localPath
}

// HasChanges checks if there are changes between current state and remote
func (s *Syncer) HasChanges() (bool, error) {
	// Get current commit
	currentCommit, err := s.GetCurrentCommit()
	if err != nil {
		return false, err
	}

	// Get remote commit
	cmd := exec.Command("git", "-C", s.localPath, "ls-remote", "origin", s.branch)
	output, err := cmd.Output()
	if err != nil {
		return false, fmt.Errorf("failed to get remote commit: %w", err)
	}

	remoteCommit := strings.Fields(string(output))[0]

	return currentCommit != remoteCommit, nil
}

// getAuthenticatedURL constructs a Git URL with embedded credentials
func (s *Syncer) getAuthenticatedURL() string {
	// If no auth token, return original URL
	if s.authToken == "" {
		return s.repoURL
	}
	
	// Parse URL and inject credentials
	// Assumes URL format: https://git.example.com/org/repo.git
	// Converts to: https://username:token@git.example.com/org/repo.git
	if strings.HasPrefix(s.repoURL, "https://") {
		// Remove https:// prefix
		urlWithoutScheme := strings.TrimPrefix(s.repoURL, "https://")
		// Construct authenticated URL
		return fmt.Sprintf("https://%s:%s@%s", s.username, s.authToken, urlWithoutScheme)
	}
	
	// For non-HTTPS URLs, return as-is
	return s.repoURL
}
