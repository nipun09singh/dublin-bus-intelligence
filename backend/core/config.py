"""Application configuration loaded from environment variables."""

from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """BusIQ configuration — all values from .env or environment."""

    # ─── Database ───
    DATABASE_URL: str = "postgresql+asyncpg://busiq:busiq_dev_2026@localhost:5432/busiq"

    # ─── Redis ───
    REDIS_URL: str = "redis://localhost:6379/0"

    # ─── NTA ───
    NTA_API_KEY: str = ""
    NTA_GTFS_RT_URL: str = "https://api.nationaltransport.ie/gtfsr/v2/Vehicles"
    NTA_GTFS_STATIC_URL: str = (
        "https://www.transportforireland.ie/transitData/Data/GTFS_Dublin_Bus.zip"
    )

    # ─── App ───
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "debug"

    # ─── CORS ───
    CORS_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse comma-separated CORS origins."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
