"""
Main FastAPI application for Crontopus.
API-first job scheduling and monitoring platform.
"""
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text

from crontopus_api.config import settings, get_db
from crontopus_api.routes import auth, checkins, agents

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
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(checkins.router, prefix=settings.api_prefix)
app.include_router(agents.router, prefix=settings.api_prefix)
# Note: Job definitions live in Git, not in API routes


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