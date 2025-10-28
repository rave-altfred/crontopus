"""
Authentication commands.

Handles user login and logout operations.
"""
import click
from getpass import getpass

from core.api_client import api_client
from core.auth import save_token, clear_token, get_username
from core.formatter import print_success, print_error, print_info


@click.group()
def auth():
    """Authentication commands."""
    pass


@auth.command()
@click.option('--username', '-u', prompt=True, help='Username')
@click.option('--password', '-p', prompt=True, hide_input=True, help='Password')
def login(username: str, password: str):
    """
    Login to Crontopus and save authentication token.
    
    Example:
        crontopus auth login
        crontopus auth login -u myuser
    """
    try:
        # Call login endpoint
        response = api_client.post(
            "/api/auth/login",
            json={
                "username": username,
                "password": password
            }
        )
        
        data = response.json()
        token = data.get("access_token")
        
        if not token:
            print_error("No token received from server")
            return
        
        # Save token
        save_token(token, username)
        print_success(f"Logged in as {username}")
        
    except Exception as e:
        print_error(f"Login failed: {e}")


@auth.command()
def logout():
    """
    Logout from Crontopus and remove saved token.
    
    Example:
        crontopus auth logout
    """
    username = get_username()
    
    if not username:
        print_info("Not logged in")
        return
    
    clear_token()
    print_success(f"Logged out (was {username})")


@auth.command()
def whoami():
    """
    Show current logged in user.
    
    Example:
        crontopus auth whoami
    """
    username = get_username()
    
    if username:
        print_info(f"Logged in as: {username}")
    else:
        print_info("Not logged in")