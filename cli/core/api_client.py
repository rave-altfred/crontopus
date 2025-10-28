"""
HTTP API client for Crontopus backend.

Provides a convenient wrapper around httpx for making API requests.
"""
import httpx
from typing import Optional, Dict, Any
import sys

from core.config import config
from core.auth import load_token


class APIClient:
    """
    HTTP client for Crontopus API.
    
    Automatically includes authentication headers and handles common errors.
    """
    
    def __init__(self, base_url: Optional[str] = None):
        """
        Initialize API client.
        
        Args:
            base_url: Optional API base URL (defaults to config value)
        """
        self.base_url = (base_url or config.get_api_url()).rstrip("/")
        self.client = httpx.Client(base_url=self.base_url, timeout=30.0)
    
    def _get_headers(self) -> Dict[str, str]:
        """Get request headers with auth token if available."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        # Add auth token if available
        token = load_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        return headers
    
    def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> httpx.Response:
        """
        Make a GET request.
        
        Args:
            path: API endpoint path (e.g., "/api/runs")
            params: Optional query parameters
        
        Returns:
            httpx.Response object
        """
        try:
            response = self.client.get(
                path,
                headers=self._get_headers(),
                params=params
            )
            response.raise_for_status()
            return response
        except httpx.HTTPStatusError as e:
            self._handle_error(e)
            sys.exit(1)
        except httpx.RequestError as e:
            print(f"❌ Network error: {e}")
            sys.exit(1)
    
    def post(self, path: str, json: Optional[Dict[str, Any]] = None) -> httpx.Response:
        """
        Make a POST request.
        
        Args:
            path: API endpoint path
            json: Optional JSON body
        
        Returns:
            httpx.Response object
        """
        try:
            response = self.client.post(
                path,
                headers=self._get_headers(),
                json=json
            )
            response.raise_for_status()
            return response
        except httpx.HTTPStatusError as e:
            self._handle_error(e)
            sys.exit(1)
        except httpx.RequestError as e:
            print(f"❌ Network error: {e}")
            sys.exit(1)
    
    def delete(self, path: str) -> httpx.Response:
        """
        Make a DELETE request.
        
        Args:
            path: API endpoint path
        
        Returns:
            httpx.Response object
        """
        try:
            response = self.client.delete(
                path,
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response
        except httpx.HTTPStatusError as e:
            self._handle_error(e)
            sys.exit(1)
        except httpx.RequestError as e:
            print(f"❌ Network error: {e}")
            sys.exit(1)
    
    def _handle_error(self, error: httpx.HTTPStatusError) -> None:
        """Handle HTTP errors with user-friendly messages."""
        status_code = error.response.status_code
        
        if status_code == 401:
            print("❌ Unauthorized. Please login first: crontopus auth login")
        elif status_code == 403:
            print("❌ Forbidden. You don't have permission to access this resource.")
        elif status_code == 404:
            print("❌ Not found.")
        elif status_code == 422:
            # Validation error - show details if available
            try:
                detail = error.response.json().get("detail", "Validation error")
                print(f"❌ Validation error: {detail}")
            except:
                print("❌ Validation error")
        else:
            print(f"❌ API error ({status_code}): {error}")
    
    def close(self) -> None:
        """Close the HTTP client."""
        self.client.close()


# Create a default client instance
api_client = APIClient()