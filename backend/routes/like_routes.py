"""
Like Routes
-----------
Handles video like/unlike functionality.

Endpoints:
- POST /videos/{video_id}/like: Toggle like status on a video (protected)
- GET /videos/{video_id}/likes: Get like count and user's like status
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.database import get_db
from backend.database.models import User, Video, Like
from backend.routes.auth_routes import get_current_user

# Create router
router = APIRouter(prefix="/videos", tags=["Likes"])


# ============================================================================
# Pydantic Models (Request/Response Schemas)
# ============================================================================

class LikeResponse(BaseModel):
    """Response model for like status."""
    video_id: int
    like_count: int
    user_has_liked: bool
    message: str


# ============================================================================
# Routes
# ============================================================================

@router.post("/{video_id}/like", response_model=LikeResponse)
def toggle_like(
    video_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Toggle like status on a video (protected route).
    
    If user has already liked the video, remove the like.
    If user hasn't liked the video, add a like.
    
    Args:
        video_id: ID of the video to like/unlike
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Like status with count and message
        
    Raises:
        HTTPException 404: Video not found
    """
    # Check if video exists
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found"
        )
    
    # Check if user has already liked the video
    existing_like = db.query(Like)\
        .filter(Like.user_id == current_user.id, Like.video_id == video_id)\
        .first()
    
    if existing_like:
        # Unlike: remove the like
        db.delete(existing_like)
        db.commit()
        message = "Video unliked"
        user_has_liked = False
    else:
        # Like: add a new like
        new_like = Like(
            user_id=current_user.id,
            video_id=video_id
        )
        db.add(new_like)
        db.commit()
        message = "Video liked"
        user_has_liked = True
    
    # Get updated like count
    like_count = db.query(Like).filter(Like.video_id == video_id).count()
    
    return LikeResponse(
        video_id=video_id,
        like_count=like_count,
        user_has_liked=user_has_liked,
        message=message
    )


@router.get("/{video_id}/likes", response_model=LikeResponse)
def get_like_status(
    video_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get like count and current user's like status for a video.
    
    Args:
        video_id: ID of the video
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Like status
        
    Raises:
        HTTPException 404: Video not found
    """
    # Check if video exists
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found"
        )
    
    # Check if user has liked the video
    user_has_liked = db.query(Like)\
        .filter(Like.user_id == current_user.id, Like.video_id == video_id)\
        .first() is not None
    
    # Get like count
    like_count = db.query(Like).filter(Like.video_id == video_id).count()
    
    return LikeResponse(
        video_id=video_id,
        like_count=like_count,
        user_has_liked=user_has_liked,
        message="Like status retrieved"
    )
