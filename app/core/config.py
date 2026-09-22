from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Core Application Settings
    PROJECT_NAME: str = "Enterprise Workflow & Ticketing Automation System"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Database Settings
    # Default to async sqlite for immediate zero-config execution; override with postgresql+asyncpg:// in .env
    DATABASE_URL: str = "sqlite+aiosqlite:///./ticketing.db"

    # Security & JWT Token Settings
    SECRET_KEY: str = "enterprise-super-secret-key-change-in-production-workflow-fsm-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # CORS Configuration
    BACKEND_CORS_ORIGINS: List[str] = ["*"]

    # Host & URL Configuration
    SERVER_HOST: str = "http://localhost:8000"
    FRONTEND_HOST: str = "http://localhost:3000"

    # Initial Superuser / Admin Defaults
    FIRST_SUPERUSER_EMAIL: str = "admin@enterprise.local"
    FIRST_SUPERUSER_PASSWORD: str = "AdminPassword123!"



settings = Settings()
