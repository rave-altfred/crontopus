"""
CLI configuration management.

Handles API URL configuration and file paths for token storage.
"""
import os
from pathlib import Path
from typing import Optional


class Config:
    """
    CLI configuration manager.
    
    Manages API URL, token storage, and other CLI settings.
    """
    
    def __init__(self):
        # Default API URL (can be overridden via env var or CLI flag)
        self.api_url = os.getenv("CRONTOPUS_API_URL", "http://localhost:8000")
        
        # Config directory in user's home
        self.config_dir = Path.home() / ".crontopus"
        self.config_dir.mkdir(exist_ok=True)
        
        # Token storage path
        self.token_file = self.config_dir / "token"
        
        # Config file for persistent settings
        self.config_file = self.config_dir / "config.yaml"
    
    def set_api_url(self, url: str) -> None:
        """Set the API URL."""
        self.api_url = url.rstrip("/")
    
    def get_api_url(self) -> str:
        """Get the API URL."""
        return self.api_url
    
    def get_token_path(self) -> Path:
        """Get the path to token file."""
        return self.token_file
    
    def get_config_path(self) -> Path:
        """Get the path to config file."""
        return self.config_file


# Global config instance
config = Config()