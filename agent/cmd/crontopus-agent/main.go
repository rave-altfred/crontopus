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
	"github.com/crontopus/agent/pkg/git"
	"github.com/crontopus/agent/pkg/manifest"
	"github.com/crontopus/agent/pkg/scheduler"
	"github.com/crontopus/agent/pkg/sync"
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

	// Initialize Git syncer
	if cfg.Git.RepoURL == "" {
		log.Println("Warning: No Git repository configured. Agent will only manage existing jobs.")
	} else {
		gitSyncer, err := git.NewSyncer(cfg.Git.RepoURL, cfg.Git.LocalPath, cfg.Git.Branch)
		if err != nil {
			log.Fatalf("Failed to create Git syncer: %v", err)
		}
		log.Printf("Git syncer initialized: %s (branch: %s)", cfg.Git.RepoURL, cfg.Git.Branch)

		// Perform initial sync
		log.Println("Performing initial Git sync...")
		if err := gitSyncer.Sync(); err != nil {
			log.Fatalf("Failed to sync Git repository: %v", err)
		}
		log.Printf("Git repository synced to: %s", cfg.Git.LocalPath)

		// Initialize manifest parser and reconciler
		parser := manifest.NewParser(cfg.Git.LocalPath)
		reconciler := sync.NewReconciler(sch, parser)

		// Perform initial reconciliation
		log.Println("Performing initial reconciliation...")
		changes, err := reconciler.Reconcile()
		if err != nil {
			log.Printf("Warning: Initial reconciliation failed: %v", err)
		} else {
			log.Printf("Initial reconciliation complete: %d changes applied", changes)
		}

		// Start reconciliation loop
		stopReconChan := make(chan struct{})
		go reconciliationLoop(gitSyncer, reconciler, cfg, stopReconChan)
		defer close(stopReconChan)
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

func reconciliationLoop(gitSyncer *git.Syncer, reconciler *sync.Reconciler, cfg *config.Config, stopChan chan struct{}) {
	interval := time.Duration(cfg.Git.SyncInterval) * time.Second
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	log.Printf("Reconciliation loop started (interval: %s)", interval)

	for {
		select {
		case <-ticker.C:
			// Sync Git repository
			log.Println("Syncing Git repository...")
			if err := gitSyncer.Sync(); err != nil {
				log.Printf("Error syncing Git repository: %v", err)
				continue
			}

			// Check for drift
			drift, err := reconciler.DetectDrift()
			if err != nil {
				log.Printf("Error detecting drift: %v", err)
				continue
			}

			if drift {
				log.Println("Drift detected, reconciling...")
				changes, err := reconciler.Reconcile()
				if err != nil {
					log.Printf("Error during reconciliation: %v", err)
				} else {
					log.Printf("Reconciliation complete: %d changes applied", changes)
				}
			} else {
				log.Println("No drift detected, scheduler state matches Git")
			}

		case <-stopChan:
			log.Println("Reconciliation loop stopping...")
			return
		}
	}
}
