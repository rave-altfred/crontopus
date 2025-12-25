"""
Pytest configuration and shared fixtures.
"""
import pytest
import os
import time
from fastapi import Request, Response
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer
import redis.asyncio as aioredis
from fastapi_limiter import FastAPILimiter

from crontopus_api.main import app
from crontopus_api.config import get_db, Base
from crontopus_api.models import Tenant, User
from crontopus_api.security.jwt import create_access_token
from crontopus_api.security.password import get_password_hash

@pytest.fixture(scope="session")
def postgres_container():
    """Start a Postgres container for the entire test session."""
    with PostgresContainer("postgres:15-alpine") as postgres:
        yield postgres

@pytest.fixture(scope="session")
def redis_container():
    """Start a Redis container for rate limiting tests."""
    with RedisContainer("redis:7-alpine") as redis:
        yield redis

@pytest.fixture(scope="function")
async def redis_client(redis_container):
    """Create an async Redis client connected to the container."""
    host = redis_container.get_container_host_ip()
    port = redis_container.get_exposed_port(6379)
    url = f"redis://{host}:{port}"
    
    client = aioredis.from_url(url, encoding="utf-8", decode_responses=True)
    
    # Initialize limiter
    await FastAPILimiter.init(client)
    
    yield client
    
    await client.close()

@pytest.fixture(scope="session")
def db_engine(postgres_container):
    """Create a SQLAlchemy engine connected to the test container."""
    engine = create_engine(postgres_container.get_connection_url())
    
    # Create all tables once
    Base.metadata.create_all(bind=engine)
    
    yield engine
    
    # Cleanup is handled by the container shutdown

@pytest.fixture(scope="function")
def db(db_engine):
    """
    Create a fresh database session for each test.
    Uses transaction rollback for speed (no need to recreate tables).
    """
    connection = db_engine.connect()
    transaction = connection.begin()
    
    # Create a session bound to this connection
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=connection)
    session = TestingSessionLocal()
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="function")
def client(db):
    """Create a test client with database dependency override."""
    def override_get_db():
        yield db
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture(autouse=True)
def disable_rate_limiting(request):
    """Disable rate limiting for all tests except those explicitly testing it."""
    # Check for marker 'enable_rate_limiting'
    if request.node.get_closest_marker("enable_rate_limiting"):
        yield
        return

    from fastapi_limiter.depends import RateLimiter
    
    original_call = RateLimiter.__call__
    
    async def mock_call(self, request: Request, response: Response):
        return
        
    RateLimiter.__call__ = mock_call
    yield
    RateLimiter.__call__ = original_call

@pytest.fixture(autouse=True)
def mock_forgejo(monkeypatch):
    """Mock ForgejoClient to prevent external API calls during tests."""
    import crontopus_api.routes.auth as auth_routes
    
    class MockForgejoClient:
        def __init__(self, *args, **kwargs):
            pass
            
        async def create_user(self, username, email, password, full_name=None):
            return {"id": 1, "username": username, "email": email}
            
        async def create_access_token(self, username, token_name):
            return "mock_git_token_sha1"
            
        async def create_or_update_file(self, *args, **kwargs):
            return {"content": {"name": "file.txt"}}

    # Mock the client class in the auth route
    monkeypatch.setattr(auth_routes, "ForgejoClient", MockForgejoClient)
    
    # Also need to mock create_tenant_repository since it uses httpx directly
    async def mock_create_repo(*args, **kwargs):
        return True
        
    monkeypatch.setattr(auth_routes, "create_tenant_repository", mock_create_repo)


@pytest.fixture
def test_tenant(db):
    """Create a test tenant."""
    tenant = Tenant(
        id="test-tenant",
        name="Test Tenant",
        is_active=True
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@pytest.fixture
def test_user(db, test_tenant):
    """Create a test user."""
    user = User(
        email="test@example.com",
        username="testuser",
        hashed_password=get_password_hash("testpassword"),
        tenant_id=test_tenant.id,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user):
    """Generate authentication headers for test user."""
    token = create_access_token({
        "sub": str(test_user.id),
        "user_id": test_user.id,
        "tenant_id": test_user.tenant_id
    })
    return {"Authorization": f"Bearer {token}"}
