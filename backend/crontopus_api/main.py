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
async def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint with database connectivity check.
    
    Returns:
        dict: Service status, database status, and timestamp
    """
    db_status = "unknown"
    db_error = None
    
    try:
        # Test database connection
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = "error"
        db_error = str(e)
    
    response = {
        "status": "healthy" if db_status == "connected" else "degraded",
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