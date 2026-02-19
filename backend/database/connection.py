"""
Database Connection Management
-------------------------------
Handles SQLAlchemy engine creation, session management, and database initialization.
Provides a dependency injection pattern for route handlers.
"""

from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
import logging

from backend.core.config import DATABASE_URL

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create SQLAlchemy engine
# connect_args={"check_same_thread": False} is needed for SQLite
# to allow multiple threads to use the same connection
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=True,  # Set to False in production to reduce logging
    pool_pre_ping=True,  # Verify connections before using them
)

# Enable foreign key constraints for SQLite
# SQLite doesn't enforce foreign keys by default
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """Enable foreign key constraints for SQLite."""
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

# Create SessionLocal class
# Each instance of SessionLocal will be a database session
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class for all ORM models
# All models will inherit from this
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Database session dependency for route handlers.
    
    Usage in FastAPI routes:
    ```python
    @app.get("/videos")
    def get_videos(db: Session = Depends(get_db)):
        videos = db.query(Video).all()
        return videos
    ```
    
    Usage in Flask routes:
    ```python
    @app.route("/videos")
    def get_videos():
        db = next(get_db())
        try:
            videos = db.query(Video).all()
            return jsonify(videos)
        finally:
            db.close()
    ```
    
    Yields:
        Session: SQLAlchemy database session
    """
    db = SessionLocal()
    try:
        logger.debug("Database session created")
        yield db
    except Exception as e:
        logger.error(f"Database session error: {e}")
        db.rollback()
        raise
    finally:
        logger.debug("Database session closed")
        db.close()


def ensure_video_columns():
    """
    Ensure the 'videos' table has all required columns.
    
    SQLAlchemy's create_all() only creates missing TABLES, not missing COLUMNS.
    This function detects missing columns and adds them via ALTER TABLE.
    Safe to run repeatedly — it only adds columns that don't already exist.
    """
    import sqlite3
    
    # Extract the file path from the DATABASE_URL (sqlite:///path/to/db)
    db_path = DATABASE_URL.replace("sqlite:///", "")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if the videos table exists at all
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='videos'")
        if not cursor.fetchone():
            conn.close()
            logger.info("'videos' table does not exist yet — will be created by create_all()")
            return
        
        # Get existing column names
        cursor.execute("PRAGMA table_info(videos)")
        existing_columns = {row[1] for row in cursor.fetchall()}
        
        # Define columns that should exist (name, type, default)
        required_columns = [
            ("status",       "TEXT DEFAULT 'processing'"),
            ("tags",         "TEXT"),           # JSON stored as TEXT in SQLite
            ("visibility",   "TEXT DEFAULT 'public'"),
            ("scheduled_at", "TEXT"),
        ]
        
        added = []
        for col_name, col_def in required_columns:
            if col_name not in existing_columns:
                alter_sql = f"ALTER TABLE videos ADD COLUMN {col_name} {col_def}"
                cursor.execute(alter_sql)
                added.append(col_name)
                logger.info(f"  ✅ Added missing column: videos.{col_name}")
        
        conn.commit()
        conn.close()
        
        if added:
            logger.info(f"Schema migration complete — added {len(added)} column(s): {', '.join(added)}")
        else:
            logger.info("Schema check passed — all video columns present")
            
    except Exception as e:
        logger.error(f"Schema migration failed: {e}")


def init_db():
    """
    Initialize the database by creating all tables.
    
    This should be called once when the application starts.
    It will create all tables defined in models.py.
    
    Usage:
    ```python
    from backend.database.connection import init_db
    
    if __name__ == "__main__":
        init_db()
        print("Database initialized successfully!")
    ```
    """
    from backend.database import models  # Import models to register them
    
    logger.info("Initializing database...")
    Base.metadata.create_all(bind=engine)
    ensure_video_columns()
    logger.info(f"Database initialized successfully at {DATABASE_URL}")


def drop_db():
    """
    Drop all tables from the database.
    
    ⚠️ WARNING: This will delete all data!
    Use only in development or for testing.
    
    Usage:
    ```python
    from backend.database.connection import drop_db
    
    if __name__ == "__main__":
        drop_db()
        print("All tables dropped!")
    ```
    """
    from backend.database import models  # Import models to register them
    
    logger.warning("Dropping all database tables...")
    Base.metadata.drop_all(bind=engine)
    logger.warning("All tables dropped!")


def reset_db():
    """
    Reset the database by dropping and recreating all tables.
    
    ⚠️ WARNING: This will delete all data!
    Use only in development or for testing.
    
    Usage:
    ```python
    from backend.database.connection import reset_db
    
    if __name__ == "__main__":
        reset_db()
        print("Database reset complete!")
    ```
    """
    drop_db()
    init_db()
    logger.info("Database reset complete!")


# Test the connection
if __name__ == "__main__":
    try:
        # Test database connection
        logger.info("Testing database connection...")
        db = next(get_db())
        logger.info("✓ Database connection successful!")
        db.close()
        
        # Initialize database
        init_db()
        
    except Exception as e:
        logger.error(f"✗ Database connection failed: {e}")
