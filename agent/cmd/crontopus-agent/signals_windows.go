//go:build windows

package main

import (
	"log"
	"os"
	"os/signal"

	"github.com/crontopus/agent/pkg/client"
	"github.com/crontopus/agent/pkg/scheduler"
)

// setupSignals configures signal handling for Windows
func setupSignals(sch scheduler.Scheduler, apiClient *client.Client, endpointID int) (chan os.Signal, chan os.Signal) {
	sigChan := make(chan os.Signal, 1)
	discoverChan := make(chan os.Signal, 1) // Not used on Windows, but returned for consistency
	
	signal.Notify(sigChan, os.Interrupt)
	
	log.Println("Agent running. Press Ctrl+C to stop.")
	log.Println("Note: Manual job discovery via signal is not supported on Windows")
	
	return sigChan, discoverChan
}
