"""
Main Application Entry Point
-----------------------------
FastAPI application setup and configuration.
"""

# CRITICAL: Load .env FIRST before any other imports
from dotenv import load_dotenv
from pathlib import Path
import sys
import os

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# Load environment variables from .env file
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import logging
import asyncio
from contextlib import asynccontextmanager

# Suppress all INFO-level logs -- only show warnings and errors
logging.basicConfig(level=logging.WARNING)

from backend.core.config import APP_NAME, APP_VERSION, CORS_ORIGINS, API_PREFIX, STORAGE_DIR, UPLOADS_DIR
from backend.routes import auth_router, video_router, comment_router, like_router, trending_router, recommendation_router, chat_router
from backend.routes.stream_routes import router as stream_router
from backend.database import init_db
from backend.services.cleanup_service import startup_cleanup, cleanup_loop

# Lifespan context manager for startup and shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and ensure directories exist."""
    init_db()
    
    # Run full storage cleanup (stuck uploads, orphaned files, temp wipe)
    try:
        startup_cleanup()
    except Exception as e:
        print(f"[WARNING] Startup cleanup failed: {e}")
        
    # Task 1: Start Periodic Background Cleanup
    cleanup_task = asyncio.create_task(cleanup_loop())

    # Ensure storage directories exist
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n[INFO] Static files mounted at: {os.path.abspath(STORAGE_DIR)}")

    # -- Clean Startup Banner --
    print("\n" + "=" * 52)
    print(f"  [*] {APP_NAME} v{APP_VERSION}")
    print("-" * 52)
    print("  > API Server:   http://localhost:8000")
    print(f"  > API Docs:     http://localhost:8000{API_PREFIX}/docs")
    print("  > Frontend:     http://localhost:3000")
    print("=" * 52 + "\n")

    yield
    
    # Shutdown logic
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        raise

# Create FastAPI application
app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="A video-sharing platform for students",
    docs_url=f"{API_PREFIX}/docs",
    redoc_url=f"{API_PREFIX}/redoc",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files securely using explicit absolute path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORAGE_PATH = os.path.join(BASE_DIR, "backend", "storage")

# Critical: Ensure directories exist before mounting
os.makedirs(os.path.join(STORAGE_PATH, "thumbnails"), exist_ok=True)
os.makedirs(os.path.join(STORAGE_PATH, "backgrounds"), exist_ok=True)

# Mount with absolute path
app.mount("/uploads", StaticFiles(directory=STORAGE_PATH), name="uploads")

# DEBUG PRINT to terminal
print(f"--- MOUNT SUCCESS: Serving files from {STORAGE_PATH} at /uploads ---")

# /storage for local dev files
app.mount("/storage", StaticFiles(directory=str(Path(__file__).resolve().parent.parent / "storage")), name="storage")

# Include routers
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(trending_router, prefix=API_PREFIX)
app.include_router(video_router, prefix=API_PREFIX)
app.include_router(comment_router, prefix=API_PREFIX)
app.include_router(like_router, prefix=API_PREFIX)
app.include_router(recommendation_router, prefix=API_PREFIX)
app.include_router(stream_router, prefix=f"{API_PREFIX}/streams")

# Chat routes: WS endpoint at /api/v1/ws/chat/... and HTTP at /api/v1/chat/history/...
app.include_router(chat_router, prefix=API_PREFIX)



@app.on_event("shutdown")
async def shutdown_event():
    """Gracefully close database connections and clean up WAL files."""
    from backend.database import engine
    try:
        # Checkpoint WAL: merges -wal into the main .db file and removes -shm/-wal
        with engine.connect() as conn:
            conn.exec_driver_sql("PRAGMA wal_checkpoint(TRUNCATE)")
        engine.dispose()
        print("[SHUTDOWN] Database connections closed and WAL files cleaned up.", flush=True)
    except Exception as e:
        print(f"[SHUTDOWN WARNING] WAL cleanup error: {e}", flush=True)
        engine.dispose()



# Root endpoint
@app.get("/")
def root():
    """Root endpoint with API information."""
    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "status": "running",
        "docs": f"{API_PREFIX}/docs"
    }


# Health check endpoint
@app.get("/health")
def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True  # Enable auto-reload in development
    )
