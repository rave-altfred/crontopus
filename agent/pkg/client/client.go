package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client is an HTTP client for communicating with the Crontopus backend
type Client struct {
	baseURL    string
	httpClient *http.Client
	token      string
}

// NewClient creates a new API client
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SetToken sets the authentication token
func (c *Client) SetToken(token string) {
	c.token = token
}

// EnrollRequest represents agent enrollment request
type EnrollRequest struct {
	Name        string `json:"name"`
	Hostname    string `json:"hostname"`
	MachineID   string `json:"machine_id,omitempty"`
	Platform    string `json:"platform"`
	Version     string `json:"version"`
	GitRepoURL  string `json:"git_repo_url,omitempty"`
	GitBranch   string `json:"git_branch,omitempty"`
}

// EnrollResponse represents agent enrollment response
type EnrollResponse struct {
	EndpointID int    `json:"endpoint_id"` // Updated terminology
	AgentID    int    `json:"agent_id"`    // Backward compatibility
	Token      string `json:"token"`
	Message    string `json:"message"`
}

// Enroll enrolls the agent with the backend
func (c *Client) Enroll(req EnrollRequest, enrollmentToken string) (*EnrollResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", c.baseURL+"/api/endpoints/enroll", bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+enrollmentToken)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("enrollment failed with status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var enrollResp EnrollResponse
	if err := json.NewDecoder(resp.Body).Decode(&enrollResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &enrollResp, nil
}

// HeartbeatRequest represents heartbeat request
type HeartbeatRequest struct {
	Status   string `json:"status,omitempty"`
	Platform string `json:"platform,omitempty"`
	Version  string `json:"version,omitempty"`
}

// Heartbeat sends a heartbeat to the backend
func (c *Client) Heartbeat(endpointID int, req HeartbeatRequest) error {
	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/api/endpoints/%d/heartbeat", c.baseURL, endpointID)
	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	// TODO: Add agent token authentication once implemented in backend

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("heartbeat failed with status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

// DiscoveredJob represents a job found in the OS scheduler
type DiscoveredJob struct {
	Name      string `json:"name"`
	Schedule  string `json:"schedule"`
	Command   string `json:"command"`
	Namespace string `json:"namespace,omitempty"`
}

// DiscoverJobsRequest represents discovered jobs to send to backend
type DiscoverJobsRequest struct {
	Jobs []DiscoveredJob `json:"jobs"`
}

// DiscoverJobs sends discovered jobs to the backend
func (c *Client) DiscoverJobs(endpointID int, jobs []DiscoveredJob) error {
	req := DiscoverJobsRequest{Jobs: jobs}
	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/api/endpoints/%d/discovered-jobs", c.baseURL, endpointID)
	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.token)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("discover jobs failed with status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

// JobInstance represents a job instance on this endpoint
type JobInstance struct {
	JobName         string `json:"job_name"`
	Namespace       string `json:"namespace"`
	Status          string `json:"status"`           // scheduled, running, paused, error
	Source          string `json:"source"`           // git, discovered
	OriginalCommand string `json:"original_command"` // Original command before wrapping
}

// ReportJobInstancesRequest represents job instances to report
type ReportJobInstancesRequest struct {
	Instances []JobInstance `json:"instances"`
}

// ReportJobInstances sends current job instances to the backend
func (c *Client) ReportJobInstances(endpointID int, instances []JobInstance) error {
	req := ReportJobInstancesRequest{Instances: instances}
	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/api/endpoints/%d/job-instances", c.baseURL, endpointID)
	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.token)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("report job instances failed with status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}
