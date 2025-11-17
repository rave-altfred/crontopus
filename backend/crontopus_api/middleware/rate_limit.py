"""
Rate limiting middleware for Crontopus API.

Uses fastapi-limiter with async Redis backend to prevent DDoS attacks and abuse.
Different limits per endpoint type based on use case.
"""
from typing import Callable
from fastapi import Request, HTTPException
from starlette.status import HTTP_429_TOO_MANY_REQUESTS

from crontopus_api.config import settings


async def get_identifier(request: Request) -> str:
    """
    Get rate limit identifier from request.
    
    Priority:
    1. User ID (from JWT token) - for authenticated endpoints
    2. Endpoint ID (from request body) - for check-ins
    3. IP address - fallback for unauthenticated requests
    """
    # Check if user is authenticated (JWT token)
    if hasattr(request.state, 'user') and request.state.user:
        return f"user:{request.state.user.id}"
    
    # Check for endpoint_id in request (check-in endpoint)
    if request.method == "POST" and "/check-in" in str(request.url):
        # Try to get endpoint_id from request body (already parsed by FastAPI)
        if hasattr(request.state, 'endpoint_id'):
            return f"endpoint:{request.state.endpoint_id}"
    
    # Fallback to IP address
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return f"ip:{forwarded.split(',')[0].strip()}"
    return f"ip:{request.client.host if request.client else 'unknown'}"


# Rate limit configurations from development-plan.md Phase 17
RATE_LIMITS = {
    # Authentication endpoints - prevent brute force
    "auth_login": "5/minute",
    "auth_register": "3/hour",
    
    # Check-in endpoint - support high-frequency jobs
    "check_in": "100/minute",
    
    # Job management - prevent spam
    "job_create": "30/minute",
    "job_update": "30/minute",
    "job_delete": "30/minute",
    
    # API reads - standard usage
    "api_read": "60/minute",
    
    # Default limits
    "authenticated": "60/minute",
    "unauthenticated": "10/minute",
}


# Export for use in main.py and routes
__all__ = ["get_identifier", "RATE_LIMITS"]
