"""
Video Routes
------------
Handles video upload, retrieval, and management.

Endpoints:
- POST /videos: Upload a new video (protected)
- GET /videos: Get all videos (feed)
- GET /videos/{video_id}: Get specific video details
- DELETE /videos/{video_id}: Delete a video (protected)
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import os
import shutil

from backend.database import get_db
from backend.database.models import User, Video
from backend.routes.auth_routes import get_current_user
from backend.core.video_processor import (
    generate_unique_filename,
    validate_video_file,
    generate_thumbnail,
    get_video_duration,
    cleanup_file,
    get_video_metadata
)
from backend.core.config import VIDEOS_DIR, THUMBNAILS_DIR

# Create router
router = APIRouter(prefix="/videos", tags=["Videos"])


# ============================================================================
# Pydantic Models (Request/Response Schemas)
# ============================================================================

class AuthorResponse(BaseModel):
    """Response model for user/author information."""
    id: int
    username: str
    profile_image: Optional[str] = "default_avatar.png"
    video_count: Optional[int] = 0

    class Config:
        from_attributes = True


class VideoUploadResponse(BaseModel):
    """Response model for video upload."""
    id: int
    title: str
    description: Optional[str]
    video_url: str
    thumbnail_url: str
    view_count: int
    upload_date: str
    author: AuthorResponse
    
    class Config:
        from_attributes = True


class VideoListResponse(BaseModel):
    """Response model for video list."""
    id: int
    title: str
    thumbnail_url: str
    view_count: int
    upload_date: str
    author: AuthorResponse
    duration: Optional[int] = None
    category: Optional[str] = None
    like_count: int = 0

    class Config:
        from_attributes = True


class VideoResponse(BaseModel):
    """Response model for video details."""
    id: int
    title: str
    description: Optional[str]
    category: Optional[str]
    tags: Optional[str]
    video_url: str
    thumbnail_url: str
    view_count: int
    upload_date: str
    duration: Optional[int] = None
    like_count: int = 0
    author: AuthorResponse
    
    class Config:
        from_attributes = True


# ============================================================================
# Helper Functions
# ============================================================================

def get_video_url(filename: str) -> str:
    """Generate full URL for video file."""
    return f"/storage/uploads/videos/{filename}"


def get_thumbnail_url(filename: str) -> str:
    """Generate full URL for thumbnail file."""
    return f"/storage/uploads/thumbnails/{filename}"


def format_video_response(video: Video, include_duration: bool = False) -> dict:
    """Format video object for API response."""
    response = {
        "id": video.id,
        "title": video.title,
        "description": video.description,
        "video_url": get_video_url(video.video_filename),
        "thumbnail_url": get_thumbnail_url(video.thumbnail_filename),
        "view_count": video.view_count,
        "upload_date": video.upload_date.isoformat(),
        "author": {
            "id": video.author.id,
            "username": video.author.username,
            "profile_image": video.author.profile_image
        }
    }
    
    if include_duration:
        # Extract duration from metadata (if stored) or calculate
        response["duration"] = None  # Can be enhanced to store duration in DB
    
    return response


# ============================================================================
# Routes
# ============================================================================

@router.post("/", response_model=VideoUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_video(
    title: str = Form(..., min_length=1, max_length=200),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    video_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a new video (protected route - requires authentication).
    
    Steps:
    1. Validate video file format and size
    2. Generate unique filename
    3. Save video file to storage
    4. Generate thumbnail
    5. Extract metadata (duration)
    6. Create database entry
    7. Return video details with URLs
    
    If any step fails, cleanup uploaded files.
    
    Args:
        title: Video title
        description: Optional video description
        video_file: Video file upload
        current_user: Authenticated user (from dependency)
        db: Database session
        
    Returns:
        Video details with URLs
        
    Raises:
        HTTPException 400: Invalid file format or size
        HTTPException 500: Upload processing error
    """
    video_path = None
    thumbnail_path = None
    
    try:
        # Validate file
        file_size = 0
        # Read file size
        video_file.file.seek(0, 2)  # Seek to end
        file_size = video_file.file.tell()
        video_file.file.seek(0)  # Seek back to start
        
        is_valid, error_msg = validate_video_file(video_file.filename, file_size)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg
            )
        
        # Generate unique filenames
        video_filename = generate_unique_filename(video_file.filename)
        thumbnail_filename = f"{os.path.splitext(video_filename)[0]}.jpg"
        
        # Define file paths
        video_path = os.path.join(VIDEOS_DIR, video_filename)
        thumbnail_path = os.path.join(THUMBNAILS_DIR, thumbnail_filename)
        
        # Save video file
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(video_file.file, buffer)
        
        # Generate thumbnail
        thumbnail_success = generate_thumbnail(video_path, thumbnail_path, timestamp=1.0)
        if not thumbnail_success:
            # Use default thumbnail if generation fails
            thumbnail_filename = "default_thumbnail.png"
        
        # Extract video metadata
        metadata = get_video_metadata(video_path)
        duration = metadata.get("duration")
        
        # Create database entry
        new_video = Video(
            title=title,
            description=description,
            category=category,
            tags=tags,
            video_filename=video_filename,
            thumbnail_filename=thumbnail_filename,
            duration=int(duration) if duration else None,
            user_id=current_user.id,
            view_count=0
        )
        
        db.add(new_video)
        db.commit()
        db.refresh(new_video)
        
        # Return response
        return VideoUploadResponse(
            id=new_video.id,
            title=new_video.title,
            description=new_video.description,
            video_url=get_video_url(video_filename),
            thumbnail_url=get_thumbnail_url(thumbnail_filename),
            view_count=new_video.view_count,
            upload_date=new_video.upload_date.isoformat(),
            author=AuthorResponse(
                id=current_user.id,
                username=current_user.username,
                profile_image=current_user.profile_image,
                video_count=current_user.videos.count()
            )
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        # Cleanup files if database save failed
        if video_path:
            cleanup_file(video_path)
        if thumbnail_path and thumbnail_filename != "default_thumbnail.png":
            cleanup_file(thumbnail_path)
        raise
        
    except Exception as e:
        # Cleanup files on any error
        if video_path:
            cleanup_file(video_path)
        if thumbnail_path and thumbnail_filename != "default_thumbnail.png":
            cleanup_file(thumbnail_path)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading video: {str(e)}"
        )


@router.get("/", response_model=List[VideoListResponse])
def get_all_videos(
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get all videos (feed) with filtering and search.
    
    Returns videos ordered by upload date (newest first).
    Supports pagination, category filtering, and title search.
    
    Args:
        skip: Number of videos to skip (for pagination)
        limit: Maximum number of videos to return (max 100)
        category: Filter by category (optional)
        search: Search by title (optional)
        db: Database session
        
    Returns:
        List of videos
    """
    # Limit maximum page size
    if limit > 100:
        limit = 100
    
    # Build query
    query = db.query(Video)
    
    # Apply category filter
    if category:
        query = query.filter(Video.category == category)
    
    # Apply search filter (case-insensitive Title or Description)
    if search:
        query = query.filter(
            or_(
                Video.title.ilike(f"%{search}%"),
                Video.description.ilike(f"%{search}%")
            )
        )
    
    # Execute query with ordering and pagination
    videos = query\
        .order_by(Video.upload_date.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    # Format response
    return [
        VideoListResponse(
            id=video.id,
            title=video.title,
            thumbnail_url=get_thumbnail_url(video.thumbnail_filename),
            view_count=video.view_count,
            upload_date=video.upload_date.isoformat(),
            duration=video.duration,
            category=video.category,
            like_count=video.like_count,
            author=AuthorResponse(
                id=video.author.id,
                username=video.author.username,
                profile_image=video.author.profile_image,
                video_count=video.author.videos.count()
            )
        )
        for video in videos
    ]


@router.get("/{video_id}", response_model=VideoResponse)
def get_video(video_id: int, db: Session = Depends(get_db)):
    """
    Get specific video details and increment view count.
    
    Args:
        video_id: ID of the video
        db: Database session
        
    Returns:
        Video details
        
    Raises:
        HTTPException 404: Video not found
    """
    # Get video
    video = db.query(Video).filter(Video.id == video_id).first()
    
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found"
        )
    
    # Increment view count
    video.view_count += 1
    db.commit()
    
    # Return response
    return VideoResponse(
        id=video.id,
        title=video.title,
        description=video.description,
        category=video.category,
        tags=video.tags,
        video_url=get_video_url(video.video_filename),
        thumbnail_url=get_thumbnail_url(video.thumbnail_filename),
        view_count=video.view_count,
        upload_date=video.upload_date.isoformat(),
        duration=video.duration,
        like_count=video.like_count,
        author=AuthorResponse(
            id=video.author.id,
            username=video.author.username,
            profile_image=video.author.profile_image,
            video_count=video.author.videos.count()
        )
    )


@router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_video(
    video_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a video (protected route - only video owner can delete).
    
    Args:
        video_id: ID of the video to delete
        current_user: Authenticated user
        db: Database session
        
    Raises:
        HTTPException 404: Video not found
        HTTPException 403: Not authorized to delete this video
    """
    # Get video
    video = db.query(Video).filter(Video.id == video_id).first()
    
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found"
        )
    
    # Check if user owns the video
    if video.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this video"
        )
    
    # Delete physical files
    video_path = os.path.join(VIDEOS_DIR, video.video_filename)
    thumbnail_path = os.path.join(THUMBNAILS_DIR, video.thumbnail_filename)
    
    cleanup_file(video_path)
    if video.thumbnail_filename != "default_thumbnail.png":
        cleanup_file(thumbnail_path)
    
    # Delete database entry
    db.delete(video)
    db.commit()
    
    return None


@router.get("/user/{user_id}", response_model=List[VideoListResponse])
def get_user_videos(
    user_id: int,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    Get all videos uploaded by a specific user.
    
    Args:
        user_id: ID of the user
        skip: Number of videos to skip
        limit: Maximum number of videos to return
        db: Database session
        
    Returns:
        List of videos by the user
    """
    if limit > 100:
        limit = 100
    
    videos = db.query(Video)\
        .filter(Video.user_id == user_id)\
        .order_by(Video.upload_date.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    return [
        VideoListResponse(
            id=video.id,
            title=video.title,
            thumbnail_url=get_thumbnail_url(video.thumbnail_filename),
            view_count=video.view_count,
            upload_date=video.upload_date.isoformat(),
            duration=video.duration,
            category=video.category,
            like_count=video.like_count,
            author=AuthorResponse(
                id=video.author.id,
                username=video.author.username,
                profile_image=video.author.profile_image,
                video_count=video.author.videos.count()
            )
        )
        for video in videos
    ]
