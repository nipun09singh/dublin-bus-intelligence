"""SQLAlchemy ORM models — PostgreSQL + PostGIS tables."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


class GtfsRoute(Base):
    """GTFS static route — maps internal route_id to human name (e.g. 39A)."""

    __tablename__ = "gtfs_routes"

    route_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    agency_id: Mapped[str | None] = mapped_column(String(64))
    route_short_name: Mapped[str] = mapped_column(String(32), index=True)
    route_long_name: Mapped[str | None] = mapped_column(Text)
    route_type: Mapped[int] = mapped_column(Integer, default=3)  # 3 = Bus

    def __repr__(self) -> str:
        return f"<GtfsRoute {self.route_id} → {self.route_short_name}>"


class GtfsTrip(Base):
    """GTFS static trip — maps trip_id to route_id and direction."""

    __tablename__ = "gtfs_trips"

    trip_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    route_id: Mapped[str] = mapped_column(String(64), index=True)
    service_id: Mapped[str | None] = mapped_column(String(64))
    trip_headsign: Mapped[str | None] = mapped_column(Text)
    direction_id: Mapped[int | None] = mapped_column(Integer)
    shape_id: Mapped[str | None] = mapped_column(String(128))

    def __repr__(self) -> str:
        return f"<GtfsTrip {self.trip_id} route={self.route_id}>"


class GtfsStop(Base):
    """GTFS static stop — bus stop with coordinates."""

    __tablename__ = "gtfs_stops"

    stop_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    stop_name: Mapped[str] = mapped_column(Text, index=True)
    stop_lat: Mapped[float] = mapped_column(Float)
    stop_lon: Mapped[float] = mapped_column(Float)
    stop_code: Mapped[str | None] = mapped_column(String(32))

    def __repr__(self) -> str:
        return f"<GtfsStop {self.stop_id} '{self.stop_name}'>"


class VehiclePositionLog(Base):
    """Historical vehicle position — archived every poll for analytics."""

    __tablename__ = "vehicle_position_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    vehicle_id: Mapped[str] = mapped_column(String(32))
    route_id: Mapped[str] = mapped_column(String(64))
    route_short_name: Mapped[str] = mapped_column(String(32), default="")
    trip_id: Mapped[str | None] = mapped_column(String(128))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    bearing: Mapped[int | None] = mapped_column(Integer)
    speed_kmh: Mapped[float | None] = mapped_column(Float)
    delay_seconds: Mapped[int] = mapped_column(Integer, default=0)
    occupancy_status: Mapped[str] = mapped_column(String(32), default="UNKNOWN")
    feed_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("ix_vpl_vehicle_time", "vehicle_id", "feed_timestamp"),
        Index("ix_vpl_route_time", "route_id", "feed_timestamp"),
        Index("ix_vpl_recorded", "recorded_at"),
    )

    def __repr__(self) -> str:
        return f"<VehiclePositionLog {self.vehicle_id} @ {self.feed_timestamp}>"


class CrowdReport(Base):
    """Crowdsourced crowding report from a passenger."""

    __tablename__ = "crowd_reports"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    vehicle_id: Mapped[str] = mapped_column(String(32), index=True)
    route_id: Mapped[str] = mapped_column(String(64))
    crowding_level: Mapped[str] = mapped_column(String(16))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    reported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<CrowdReport {self.vehicle_id} {self.crowding_level}>"
