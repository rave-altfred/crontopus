//go:build unix

package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/crontopus/agent/pkg/client"
	"github.com/crontopus/agent/pkg/scheduler"
)

// setupSignals configures signal handling for Unix systems (Linux, macOS)
func setupSignals(sch scheduler.Scheduler, apiClient *client.Client, endpointID int) (chan os.Signal, chan os.Signal) {
	sigChan := make(chan os.Signal, 1)
	discoverChan := make(chan os.Signal, 1)
	
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	signal.Notify(discoverChan, syscall.SIGUSR1) // SIGUSR1 triggers manual discovery
	
	log.Println("Agent running. Press Ctrl+C to stop.")
	log.Println("Send SIGUSR1 to trigger job discovery: kill -USR1 <pid>")
	
	return sigChan, discoverChan
}
