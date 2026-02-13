"""
Main Application Entry Point
-----------------------------
FastAPI application setup and configuration.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.core.config import APP_NAME, APP_VERSION, CORS_ORIGINS, API_PREFIX, STORAGE_DIR
from backend.routes import auth_router, video_router, comment_router, like_router, trending_router, recommendation_router
from backend.database import init_db

# Create FastAPI application
app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="A video-sharing platform for students",
    docs_url=f"{API_PREFIX}/docs",
    redoc_url=f"{API_PREFIX}/redoc",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
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

# Mount static files for serving uploaded videos and thumbnails
app.mount("/storage", StaticFiles(directory=str(STORAGE_DIR)), name="storage")

# Initialize database on startup
@app.on_event("startup")
def startup_event():
    """Initialize database tables on application startup."""
    init_db()
    print(f"[INFO] {APP_NAME} v{APP_VERSION} started successfully!")
    print(f"[INFO] Database initialized")
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
