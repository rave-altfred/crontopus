"""
Authentication and token management.

Handles JWT token storage, retrieval, and validation.
"""
from pathlib import Path
from typing import Optional
import json
from datetime import datetime

from core.config import config


def save_token(token: str, username: str) -> None:
    """
    Save JWT token to disk.
    
    Args:
        token: JWT access token
        username: Username associated with token
    """
    token_data = {
        "access_token": token,
        "username": username,
        "saved_at": datetime.utcnow().isoformat()
    }
    
    token_path = config.get_token_path()
    token_path.write_text(json.dumps(token_data, indent=2))
    token_path.chmod(0o600)  # Secure permissions (owner read/write only)


def load_token() -> Optional[str]:
    """
    Load JWT token from disk.
    
    Returns:
        Token string if exists, None otherwise
    """
    token_path = config.get_token_path()
    
    if not token_path.exists():
        return None
    
    try:
        token_data = json.loads(token_path.read_text())
        return token_data.get("access_token")
    except (json.JSONDecodeError, KeyError):
        return None


def get_username() -> Optional[str]:
    """
    Get username associated with saved token.
    
    Returns:
        Username if token exists, None otherwise
    """
    token_path = config.get_token_path()
    
    if not token_path.exists():
        return None
    
    try:
        token_data = json.loads(token_path.read_text())
        return token_data.get("username")
    except (json.JSONDecodeError, KeyError):
        return None


def clear_token() -> None:
    """
    Remove saved token from disk.
    """
    token_path = config.get_token_path()
    if token_path.exists():
        token_path.unlink()


def is_authenticated() -> bool:
    """
    Check if user is authenticated (token exists).
    
    Returns:
        True if token exists, False otherwise
    """
    return load_token() is not None