"""Database connection management — async PostgreSQL via SQLAlchemy 2.0."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from backend.core.config import settings

engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncSession:  # type: ignore[misc]
    """Yield an async database session (FastAPI dependency)."""
    async with async_session() as session:
        yield session


async def init_db() -> None:
    """Create tables from metadata (called on startup).

    Skips gracefully if database is unavailable (local dev without Docker).
    """
    try:
        from backend.models.db import Base  # noqa: F811

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception:
        import structlog
        structlog.get_logger().warning("db.init_skipped", reason="Database unavailable")


async def close_db() -> None:
    """Dispose engine on shutdown."""
    try:
        await engine.dispose()
    except Exception:
        pass
