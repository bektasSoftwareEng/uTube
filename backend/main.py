"""
Main Application Entry Point
-----------------------------
FastAPI application setup and configuration.
"""

# CRITICAL: Load .env FIRST before any other imports
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env file
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)
print(f"[INFO] Loading environment variables from: {env_path}")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.core.config import APP_NAME, APP_VERSION, CORS_ORIGINS, API_PREFIX, STORAGE_DIR, UPLOADS_DIR
from backend.routes import auth_router, video_router, comment_router, like_router, trending_router, recommendation_router
from backend.database import init_db
from backend.services.cleanup_service import startup_cleanup, cleanup_loop
import asyncio

# Create FastAPI application
app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="A video-sharing platform for students",
    docs_url=f"{API_PREFIX}/docs",
    redoc_url=f"{API_PREFIX}/redoc",
)

# Configure CORS - Allow all for development to fix 403/CORS issues
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(trending_router, prefix=API_PREFIX)
app.include_router(video_router, prefix=API_PREFIX)
app.include_router(comment_router, prefix=API_PREFIX)
app.include_router(like_router, prefix=API_PREFIX)
app.include_router(recommendation_router, prefix=API_PREFIX)

# Mount static files
# /storage for local dev files
app.mount("/storage", StaticFiles(directory=str(Path(__file__).resolve().parent.parent / "storage")), name="storage")
# /uploads for direct access to videos/thumbnails/avatars
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database and ensure directories exist."""
    init_db()
    
    # Run full storage cleanup (stuck uploads, orphaned files, temp wipe)
    try:
        startup_cleanup()
    except Exception as e:
        print(f"[WARNING] Startup cleanup failed: {e}")
        
    # Task 1: Start Periodic Background Cleanup
    asyncio.create_task(cleanup_loop())

    # Ensure storage directories from config exist
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    # Ensure storage directories from config exist
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[INFO] {APP_NAME} v{APP_VERSION} started successfully!")
    print("[INFO] Storage/Uploads directories initialized")
    print(f"[INFO] Saving to: {UPLOADS_DIR}")
    print(f"[INFO] API documentation: http://localhost:8000{API_PREFIX}/docs")



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
        "backend.app:app",
        host="0.0.0.0",
        port=8000,
        reload=True  # Enable auto-reload in development
    )
