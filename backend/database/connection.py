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
