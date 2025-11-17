"""
Main FastAPI application for Crontopus.
API-first job scheduling and monitoring platform.
"""
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text

from crontopus_api.config import settings, get_db
from crontopus_api.routes import auth, checkins, agents, endpoints, jobs, enrollment_tokens, namespaces
from crontopus_api.middleware.rate_limit import get_identifier

# Create FastAPI app
app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description="API-first job scheduling and monitoring platform"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
# Note: Router prefix composition:
#   - settings.api_prefix = "/api"
#   - Each router's routes are appended to this prefix
#   - Jobs router gets additional "/jobs" suffix because its internal routes start with "/"
#   - Example: jobs router with @router.get("/") becomes GET /api/jobs/
#   - FastAPI adds trailing slash to root routes like @router.get("/")
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(checkins.router, prefix=settings.api_prefix)
app.include_router(agents.router, prefix=settings.api_prefix)  # Keep for backward compatibility
app.include_router(endpoints.router, prefix=settings.api_prefix)  # New: Agent → Endpoint terminology
app.include_router(enrollment_tokens.router, prefix=settings.api_prefix)  # Enrollment token management
app.include_router(namespaces.router, prefix=settings.api_prefix)  # Namespace/group management
app.include_router(jobs.router, prefix=f"{settings.api_prefix}/jobs")

# Log all registered routes on startup
import logging
logger = logging.getLogger("uvicorn")

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    # Initialize fastapi-limiter with Redis
    import redis.asyncio as aioredis
    from fastapi_limiter import FastAPILimiter
    
    try:
        redis_client = aioredis.from_url(
            settings.redis_url,
            db=settings.redis_database,
            encoding="utf-8",
            decode_responses=True
        )
        await FastAPILimiter.init(redis_client, identifier=get_identifier)
        logger.info(f"Rate limiting initialized with Redis at {settings.redis_url} (db: {settings.redis_database})")
    except Exception as e:
        logger.error(f"Failed to initialize rate limiting: {e}")
        # Continue without rate limiting - graceful degradation
    
    # Log registered routes
    logger.info("="*50)
    logger.info("Registered routes:")
    for route in app.routes:
        if hasattr(route, 'methods') and hasattr(route, 'path'):
            logger.info(f"  {','.join(route.methods)} {route.path}")
    logger.info("="*50)


@app.get("/health")
async def health_check():
    """
    Health check endpoint with database connectivity check.
    Always returns 200 OK even if database is unavailable.
    
    Returns:
        dict: Service status, database status, and timestamp
    """
    db_status = "unknown"
    db_error = None
    db = None
    
    try:
        # Get database session with timeout
        from crontopus_api.config import SessionLocal
        db = SessionLocal()
        
        # Test database connection with short timeout
        result = db.execute(text("SELECT 1"))
        result.fetchone()
        db_status = "connected"
    except Exception as e:
        db_status = "error"
        db_error = str(e)[:200]  # Truncate long errors
        print(f"Database health check failed: {e}")
    finally:
        if db:
            try:
                db.close()
            except:
                pass
    
    response = {
        "status": "healthy",  # Always healthy - app is running
        "service": "crontopus-api",
        "version": settings.api_version,
        "environment": settings.environment,
        "database": db_status,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    if db_error:
        response["database_error"] = db_error
    
    return response


@app.get("/")
async def root():
    """
    Root endpoint with API information.
    
    Returns:
        dict: API metadata
    """
    return {
        "name": settings.api_title,
        "version": settings.api_version,
        "docs": "/docs",
        "health": "/health"
    }