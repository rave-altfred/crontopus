"""
Configuration management for Crontopus API.
Handles database connections, environment variables, and app settings.
"""
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database
    database_url: str = "postgresql://crontopus:crontopus@localhost:5432/crontopus"
    database_echo: bool = False
    
    # API
    api_title: str = "Crontopus API"
    api_version: str = "0.1.0"
    api_prefix: str = "/api"
    environment: str = "development"
    
    # Security
    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    
    # CORS - comma-separated string in .env
    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    
    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins string into list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )


# Global settings instance
settings = Settings()

# SQLAlchemy setup
# Configure engine based on database type
connect_args = {}
if settings.database_url.startswith("sqlite"):
    # SQLite-specific settings
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.database_url,
    echo=settings.database_echo,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    """
    Dependency for FastAPI routes to get database session.
    
    Usage:
        @app.get("/items")
        def read_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()