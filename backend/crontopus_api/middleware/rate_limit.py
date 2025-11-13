"""
Rate limiting middleware for Crontopus API.

Uses SlowAPI with Redis backend to prevent DDoS attacks and abuse.
Different limits per endpoint type based on use case.
"""
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from redis import Redis
from typing import Callable
from fastapi import Request

from crontopus_api.config import settings


def _get_redis_client() -> Redis:
    """
    Create Redis client for rate limiting storage.
    
    Uses Valkey in production (database index 1) and Redis in development (database 0).
    """
    return Redis.from_url(
        settings.redis_url,
        db=settings.redis_database,
        decode_responses=True
    )


def _get_identifier(request: Request) -> str:
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
    return f"ip:{get_remote_address(request)}"


# Initialize rate limiter with Redis storage
# Note: swallow_errors=True prevents 500 errors in production if Redis is temporarily unavailable
limiter = Limiter(
    key_func=_get_identifier,
    storage_uri=f"{settings.redis_url}/{settings.redis_database}",
    strategy="fixed-window",
    headers_enabled=True,  # Add X-RateLimit-* headers
    swallow_errors=True,  # Graceful degradation if Redis unavailable
)


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


def get_rate_limit_for_endpoint(path: str, authenticated: bool = False) -> str:
    """
    Get rate limit string for a specific endpoint.
    
    Args:
        path: Request path
        authenticated: Whether user is authenticated
        
    Returns:
        Rate limit string (e.g., "60/minute")
    """
    # Authentication endpoints
    if "/auth/login" in path:
        return RATE_LIMITS["auth_login"]
    if "/auth/register" in path:
        return RATE_LIMITS["auth_register"]
    
    # Check-in endpoint
    if "/check-in" in path or "/runs/check-in" in path:
        return RATE_LIMITS["check_in"]
    
    # Job management
    if "/jobs" in path:
        if "POST" in str(path):
            return RATE_LIMITS["job_create"]
        if "PUT" in str(path) or "PATCH" in str(path):
            return RATE_LIMITS["job_update"]
        if "DELETE" in str(path):
            return RATE_LIMITS["job_delete"]
    
    # Default based on authentication
    if authenticated:
        return RATE_LIMITS["authenticated"]
    else:
        return RATE_LIMITS["unauthenticated"]


# Export for use in main.py
__all__ = ["limiter", "RateLimitExceeded", "_rate_limit_exceeded_handler", "RATE_LIMITS"]
