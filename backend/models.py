from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Date,
    Time,
    ForeignKey,
    TIMESTAMP,
    Table,
    Boolean,
)
from sqlalchemy.sql import func
    # corrected indent
from sqlalchemy.orm import relationship

from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(128), nullable=False)
    role = Column(String(20), nullable=False, default="viewer")  # "admin" or "viewer"
    is_active = Column(Boolean, default=True)

# Association tables (many-to-many)
event_categories_table = Table(
    "event_categories",
    Base.metadata,
    Column("event_id", Integer, ForeignKey("events.id"), primary_key=True),
    Column("category_id", Integer, ForeignKey("categories.id"), primary_key=True),
)

event_planning_levels_table = Table(
    "event_planning_levels",
    Base.metadata,
    Column("event_id", Integer, ForeignKey("events.id"), primary_key=True),
    Column(
        "planning_level_id",
        Integer,
        ForeignKey("planning_levels.id"),
        primary_key=True,
    ),
)


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, ForeignKey("events.id"), nullable=True)

    title = Column(String(255), nullable=False)

    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)

    preacher = Column(String(255), nullable=True)
    sermon_title = Column(Text, nullable=True)
    remarks = Column(Text, nullable=True)
    internal_notes = Column(Text, nullable=True)
    clarification = Column(Text, nullable=True)

    link = Column(Text, nullable=True)

    in_klaerung = Column(Boolean, nullable=False, server_default="false")
    pco_id = Column(Integer, nullable=True)
    besucherzahl = Column(Integer, nullable=True)
    mail = Column(String, nullable=True)

    attachments = Column(Text, nullable=True)       # for now: text/URL/filename
    ort = Column(String(255), nullable=True)        # location
    link_id = Column(Integer, ForeignKey("events.id"), nullable=True)  # non-hierarchical link

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    parent = relationship(
        "Event",
        remote_side=[id],
        foreign_keys=[parent_id],
        backref="children",
    )

    linked_event = relationship(
        "Event",
        foreign_keys=[link_id],
        remote_side=[id],
    )

    categories = relationship(
        "Category",
        secondary=event_categories_table,
        back_populates="events",
    )

    planning_levels = relationship(
        "PlanningLevel",
        secondary=event_planning_levels_table,
        back_populates="events",
    )


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)

    symbol = Column(String(8), nullable=True)        # e.g. "🎉"
    color_hex = Column(String(7), nullable=True)     # e.g. "#FF6600"
    description = Column(Text, nullable=True)
    godi_item = Column(Boolean, nullable=False, server_default="false")

    events = relationship(
        "Event",
        secondary=event_categories_table,
        back_populates="categories",
    )


class PlanningLevel(Base):
    __tablename__ = "planning_levels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)

    events = relationship(
        "Event",
        secondary=event_planning_levels_table,
        back_populates="planning_levels",
    )

class Reporting(Base):
    __tablename__ = "reporting"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False, index=True)

    # Snapshot of event metadata at the moment of reporting
    event_title = Column(String, nullable=False)
    event_date = Column(Date, nullable=True)
    event_start_time = Column(Time, nullable=True)

    # Reporting-specific fields
    visitor = Column(Integer, nullable=True)
    vacation = Column(String, nullable=True)
    holiday = Column(String, nullable=True)
    special = Column(String, nullable=True)

    # Back-reference to the event
    event = relationship("Event", backref="reporting_entries")

