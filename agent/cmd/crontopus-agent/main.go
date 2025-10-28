package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/crontopus/agent/pkg/auth"
	"github.com/crontopus/agent/pkg/client"
	"github.com/crontopus/agent/pkg/config"
	"github.com/crontopus/agent/pkg/scheduler"
)

func main() {
	// Parse command line flags
	configPath := flag.String("config", "config.yaml", "Path to configuration file")
	flag.Parse()

	// Load configuration
	cfg, err := config.LoadConfig(*configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	log.Printf("Starting Crontopus Agent v%s", cfg.Agent.Version)
	log.Printf("Agent: %s (hostname: %s, platform: %s)", cfg.Agent.Name, cfg.Agent.Hostname, cfg.Agent.Platform)

	// Create API client
	apiClient := client.NewClient(cfg.Backend.APIURL)

	// Try to load existing token
	tokenData, err := auth.LoadToken(cfg.Agent.TokenPath)
	if err != nil {
		log.Fatalf("Failed to load token: %v", err)
	}

	// If no token exists, enroll the agent
	if tokenData == nil {
		log.Println("No agent token found, enrolling agent...")
		
		if cfg.Backend.EnrollmentToken == "" {
			log.Fatal("No enrollment token provided in config. Please add enrollment_token to backend section.")
		}

		enrollReq := client.EnrollRequest{
			Name:     cfg.Agent.Name,
			Hostname: cfg.Agent.Hostname,
			Platform: cfg.Agent.Platform,
			Version:  cfg.Agent.Version,
		}

		enrollResp, err := apiClient.Enroll(enrollReq, cfg.Backend.EnrollmentToken)
		if err != nil {
			log.Fatalf("Failed to enroll agent: %v", err)
		}

		tokenData = &auth.TokenData{
			AgentID: enrollResp.AgentID,
			Token:   enrollResp.Token,
		}

		if err := auth.SaveToken(cfg.Agent.TokenPath, *tokenData); err != nil {
			log.Fatalf("Failed to save token: %v", err)
		}

		log.Printf("Agent enrolled successfully! Agent ID: %d", tokenData.AgentID)
	} else {
		log.Printf("Using existing agent token (Agent ID: %d)", tokenData.AgentID)
	}

	// Set token for API client
	apiClient.SetToken(tokenData.Token)

	// Initialize scheduler
	sch, err := scheduler.NewScheduler()
	if err != nil {
		log.Fatalf("Failed to initialize scheduler: %v", err)
	}
	log.Printf("Scheduler initialized for platform: %s", cfg.Agent.Platform)

	// List existing jobs managed by Crontopus
	jobs, err := sch.List()
	if err != nil {
		log.Printf("Warning: Failed to list existing jobs: %v", err)
	} else {
		log.Printf("Found %d existing Crontopus-managed jobs", len(jobs))
	}

	// Start heartbeat goroutine
	stopChan := make(chan struct{})
	go heartbeatLoop(apiClient, tokenData.AgentID, cfg, stopChan)

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	log.Println("Agent running. Press Ctrl+C to stop.")
	<-sigChan

	log.Println("Shutting down agent...")
	close(stopChan)
	time.Sleep(1 * time.Second) // Give heartbeat goroutine time to finish
}

func heartbeatLoop(apiClient *client.Client, agentID int, cfg *config.Config, stopChan chan struct{}) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Send initial heartbeat
	sendHeartbeat(apiClient, agentID, cfg)

	for {
		select {
		case <-ticker.C:
			sendHeartbeat(apiClient, agentID, cfg)
		case <-stopChan:
			log.Println("Heartbeat loop stopping...")
			return
		}
	}
}

func sendHeartbeat(apiClient *client.Client, agentID int, cfg *config.Config) {
	req := client.HeartbeatRequest{
		Status:   "active",
		Platform: cfg.Agent.Platform,
		Version:  cfg.Agent.Version,
	}

	if err := apiClient.Heartbeat(agentID, req); err != nil {
		log.Printf("Failed to send heartbeat: %v", err)
	} else {
		log.Printf("Heartbeat sent (Agent ID: %d)", agentID)
	}
}