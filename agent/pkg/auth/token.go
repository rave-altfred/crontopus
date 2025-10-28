package auth

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// TokenData represents the stored token information
type TokenData struct {
	AgentID int    `json:"agent_id"`
	Token   string `json:"token"`
}

// SaveToken saves the agent token to disk
func SaveToken(path string, data TokenData) error {
	// Ensure directory exists
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("failed to create token directory: %w", err)
	}

	// Marshal token data
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal token data: %w", err)
	}

	// Write to file with secure permissions
	if err := os.WriteFile(path, jsonData, 0600); err != nil {
		return fmt.Errorf("failed to write token file: %w", err)
	}

	return nil
}

// LoadToken loads the agent token from disk
func LoadToken(path string) (*TokenData, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil // Token doesn't exist yet
		}
		return nil, fmt.Errorf("failed to read token file: %w", err)
	}

	var tokenData TokenData
	if err := json.Unmarshal(data, &tokenData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal token data: %w", err)
	}

	return &tokenData, nil
}
