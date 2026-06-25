"""
Database setup — Data Redundancy Removal System
=================================================
Persistent storage that survives backend restarts, sleeps, and crashes.

Default: SQLite file (drrs.db) sitting next to this file. Zero setup —
works the moment you run the app, and the data is still there next time
you start it.

Optional: set the DATABASE_URL environment variable to any SQLAlchemy
connection string (e.g. a free Postgres database from Neon, Supabase, or
Render) to use that instead. No code changes needed.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./drrs.db")

# Some providers (Render, Heroku) hand out "postgres://" URLs, but
# SQLAlchemy 2.x requires the "postgresql://" scheme — normalize it.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite needs this flag to allow use across FastAPI's threaded requests.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables if they don't exist yet. Safe to call on every startup."""
    import models  # noqa: F401  (ensures models are registered on Base before create_all)
    Base.metadata.create_all(bind=engine)
