"""
Main FastAPI application for Crontopus.
API-first job scheduling and monitoring platform.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

from crontopus_api.config import settings
from crontopus_api.routes import auth

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
# Note: Job definitions live in Git, not in API routes


@app.get("/health")
async def health_check():
    """
    Health check endpoint.
    
    Returns:
        dict: Service status and timestamp
    """
    return {
        "status": "healthy",
        "service": "crontopus-api",
        "version": settings.api_version,
        "timestamp": datetime.utcnow().isoformat()
    }


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