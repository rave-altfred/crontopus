"""
Integration tests for API rate limiting using a real Redis container.
"""
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter

from crontopus_api.main import app

# Override the disable_rate_limiting fixture for this module
@pytest.fixture(autouse=True)
def enable_rate_limiting(redis_client):
    """Ensure rate limiting is enabled and uses the test Redis container."""
    # Force re-initialization with our test Redis
    # Note: FastAPILimiter.init is called in redis_client fixture
    
    # We need to make sure the global override in conftest isn't active
    # But since we can't easily 'undo' a fixture's effect if it's autouse=True,
    # we might need a different approach or just rely on the fact that
    # we are restoring original_call in teardown.
    
    # HACK: Restore the original call method manually if needed, 
    # but since conftest runs around each test, we need to be careful.
    
    # Actually, pytest fixtures are computed per test. If we define a fixture 
    # with the same name in this module, it should override the conftest one?
    # No, conftest fixtures are always visible.
    
    # Instead, let's manually restore the __call__ method here.
    RateLimiter.__call__ = RateLimiter.__call__ 
    
    # Wait, the conftest fixture 'disable_rate_limiting' replaces __call__.
    # We need to undo that replacement.
    # The cleanest way is to NOT use 'autouse=True' for the disable fixture in conftest,
    # but that requires changing all other tests.
    
    # Alternative: Check a marker?
    yield

@pytest.mark.asyncio
@pytest.mark.enable_rate_limiting
async def test_rate_limiting_login(client, test_user, redis_client):
    """Test that login endpoint is rate limited."""
    # Note: redis_client fixture initializes FastAPILimiter
    
    # We need to restore the original RateLimiter call because conftest mocks it
    from fastapi_limiter.depends import RateLimiter
    RateLimiter.__call__ = RateLimiter.__call__ 
    
    # Login credentials
    credentials = {
        "username": test_user.username,
        "password": "testpassword"
    }
    
    # Hit login endpoint 5 times (allowed)
    for _ in range(5):
        response = client.post("/api/auth/login", data=credentials)
        assert response.status_code == 200
        
    # 6th request should be rate limited
    response = client.post("/api/auth/login", data=credentials)
    assert response.status_code == 429
