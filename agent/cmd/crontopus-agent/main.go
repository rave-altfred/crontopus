package main

import (
	"flag"
	"fmt"
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

// Version is set during build via ldflags
var Version = "dev"

func main() {
	// Parse command line flags
	configPath := flag.String("config", "config.yaml", "Path to configuration file")
	versionFlag := flag.Bool("version", false, "Print version and exit")
	flag.Parse()

	// Handle version flag
	if *versionFlag {
		fmt.Printf("Crontopus Agent v%s\n", Version)
		os.Exit(0)
	}

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

		// Support both endpoint_id (new) and agent_id (backward compat)
		endpointID := enrollResp.EndpointID
		if endpointID == 0 {
			endpointID = enrollResp.AgentID
		}

		tokenData = &auth.TokenData{
			AgentID: endpointID,
			Token:   enrollResp.Token,
		}

		if err := auth.SaveToken(cfg.Agent.TokenPath, *tokenData); err != nil {
			log.Fatalf("Failed to save token: %v", err)
		}

		log.Printf("Endpoint enrolled successfully! Endpoint ID: %d", tokenData.AgentID)
	} else {
		log.Printf("Using existing endpoint token (Endpoint ID: %d)", tokenData.AgentID)
	}

	// Set token for API client
	apiClient.SetToken(tokenData.Token)

	// Initialize scheduler
	sch, err := scheduler.NewScheduler()
	if err != nil {
		log.Fatalf("Failed to initialize scheduler: %v", err)
	}
	log.Printf("Scheduler initialized for platform: %s", cfg.Agent.Platform)

	// List all jobs (including discovered jobs)
	allJobs, err := sch.ListAll()
	if err != nil {
		log.Printf("Warning: Failed to list all jobs: %v", err)
	} else {
		log.Printf("Found %d total jobs on this endpoint", len(allJobs))
		
		// Filter Crontopus-managed vs discovered jobs
		managedJobs, err := sch.List()
		if err != nil {
			log.Printf("Warning: Failed to list managed jobs: %v", err)
		} else {
			managedCount := len(managedJobs)
			discoveredCount := len(allJobs) - managedCount
			log.Printf("  - %d Crontopus-managed jobs", managedCount)
			log.Printf("  - %d discovered jobs", discoveredCount)
			
			// Send discovered jobs to backend
			if discoveredCount > 0 {
				log.Println("Reporting discovered jobs to backend...")
				discoveredJobs := []client.DiscoveredJob{}
				
				// Build map of managed job names for fast lookup
				managedNames := make(map[string]bool)
				for _, j := range managedJobs {
					managedNames[j.Name] = true
				}
				
				// Find jobs that aren't managed
				for _, j := range allJobs {
					if !managedNames[j.Name] {
						discoveredJobs = append(discoveredJobs, client.DiscoveredJob{
							Name:     j.Name,
							Schedule: j.Schedule,
							Command:  j.Command,
						})
					}
				}
				
				if err := apiClient.DiscoverJobs(tokenData.AgentID, discoveredJobs); err != nil {
					log.Printf("Warning: Failed to report discovered jobs: %v", err)
				} else {
					log.Printf("Reported %d discovered jobs to backend", len(discoveredJobs))
				}
			}
		}
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
		reconciler := sync.NewReconciler(sch, parser, cfg.Backend.APIURL, tokenData.AgentID, tokenData.Token)

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
		go reconciliationLoop(gitSyncer, reconciler, apiClient, cfg, stopReconChan)
		defer close(stopReconChan)
	}

	// Start heartbeat goroutine
	stopChan := make(chan struct{})
	endpointID := tokenData.AgentID // AgentID field now stores EndpointID
	go heartbeatLoop(apiClient, endpointID, cfg, stopChan)

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	log.Println("Agent running. Press Ctrl+C to stop.")
	<-sigChan

	log.Println("Shutting down agent...")
	close(stopChan)
	time.Sleep(1 * time.Second) // Give heartbeat goroutine time to finish
}

func heartbeatLoop(apiClient *client.Client, endpointID int, cfg *config.Config, stopChan chan struct{}) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Send initial heartbeat
	sendHeartbeat(apiClient, endpointID, cfg)

	for {
		select {
		case <-ticker.C:
			sendHeartbeat(apiClient, endpointID, cfg)
		case <-stopChan:
			log.Println("Heartbeat loop stopping...")
			return
		}
	}
}

func sendHeartbeat(apiClient *client.Client, endpointID int, cfg *config.Config) {
	req := client.HeartbeatRequest{
		Status:   "active",
		Platform: cfg.Agent.Platform,
		Version:  cfg.Agent.Version,
	}

	if err := apiClient.Heartbeat(endpointID, req); err != nil {
		log.Printf("Failed to send heartbeat: %v", err)
	} else {
		log.Printf("Heartbeat sent (Endpoint ID: %d)", endpointID)
	}
}

func reconciliationLoop(gitSyncer *git.Syncer, reconciler *sync.Reconciler, apiClient *client.Client, cfg *config.Config, stopChan chan struct{}) {
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
			
			// Report job instances to backend
			if err := reconciler.ReportJobInstances(apiClient); err != nil {
				log.Printf("Error reporting job instances: %v", err)
			}

		case <-stopChan:
			log.Println("Reconciliation loop stopping...")
			return
		}
	}
}
