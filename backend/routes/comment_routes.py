"""
Comment Routes
--------------
Handles comment creation, retrieval, and deletion for videos.

Endpoints:
- POST /videos/{video_id}/comments: Add a comment to a video (protected)
- GET /videos/{video_id}/comments: Get all comments for a video
- DELETE /comments/{comment_id}: Delete a comment (protected)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, Field
from typing import List, Optional

from backend.database import get_db
from backend.database.models import User, Video, Comment
from backend.routes.auth_routes import get_current_user

# Create router
router = APIRouter(tags=["Comments"])


# ============================================================================
# Pydantic Models (Request/Response Schemas)
# ============================================================================

class CommentCreate(BaseModel):
    """Request model for creating a comment."""
    text: str = Field(..., min_length=1, max_length=1000, description="Comment text")
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "Great video! Very helpful."
            }
        }


class CommentResponse(BaseModel):
    """Response model for comment details."""
    id: int
    text: str
    created_at: str
    author: dict
    
    class Config:
        from_attributes = True


class CommentWithVideoResponse(BaseModel):
    """Response model for comment with video information."""
    id: int
    text: str
    created_at: str
    author: dict
    video: dict


# ============================================================================
# Routes
# ============================================================================

@router.post("/videos/{video_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    video_id: int,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a comment to a video (protected route).
    
    Args:
        video_id: ID of the video to comment on
        comment_data: Comment text
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Created comment with author information
        
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
    
    # Create comment
    new_comment = Comment(
        text=comment_data.text,
        user_id=current_user.id,
        video_id=video_id
    )
    
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    
    # Return response with author information
    return CommentResponse(
        id=new_comment.id,
        text=new_comment.text,
        created_at=new_comment.created_at.isoformat(),
        author={
            "id": current_user.id,
            "username": current_user.username,
            "profile_image": current_user.profile_image
        }
    )


@router.get("/videos/{video_id}/comments", response_model=List[CommentResponse])
def get_video_comments(
    video_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Get all comments for a specific video.
    
    Uses joinedload to fetch author information in a single query,
    avoiding the N+1 query problem.
    
    Args:
        video_id: ID of the video
        skip: Number of comments to skip (pagination)
        limit: Maximum number of comments to return (max 100)
        db: Database session
        
    Returns:
        List of comments with author information, ordered by newest first
        
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
    
    # Limit maximum page size
    if limit > 100:
        limit = 100
    
    # Query comments with joinedload to avoid N+1 problem
    # This fetches comments and their authors in a single query
    comments = db.query(Comment)\
        .options(joinedload(Comment.author))\
        .filter(Comment.video_id == video_id)\
        .order_by(Comment.created_at.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    # Format response
    return [
        CommentResponse(
            id=comment.id,
            text=comment.text,
            created_at=comment.created_at.isoformat(),
            author={
                "id": comment.author.id,
                "username": comment.author.username,
                "profile_image": comment.author.profile_image
            }
        )
        for comment in comments
    ]


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a comment (protected route).
    
    Only the comment author or the video owner can delete a comment.
    
    Args:
        comment_id: ID of the comment to delete
        current_user: Authenticated user
        db: Database session
        
    Raises:
        HTTPException 404: Comment not found
        HTTPException 403: Not authorized to delete this comment
    """
    # Get comment with video information using joinedload
    comment = db.query(Comment)\
        .options(joinedload(Comment.video))\
        .filter(Comment.id == comment_id)\
        .first()
    
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    
    # Check authorization: user must be comment author OR video owner
    is_comment_author = comment.user_id == current_user.id
    is_video_owner = comment.video.user_id == current_user.id
    
    if not (is_comment_author or is_video_owner):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this comment"
        )
    
    # Delete comment
    db.delete(comment)
    db.commit()
    
    return None


@router.get("/users/{user_id}/comments", response_model=List[CommentWithVideoResponse])
def get_user_comments(
    user_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Get all comments made by a specific user.
    
    Useful for user profile pages to show comment history.
    
    Args:
        user_id: ID of the user
        skip: Number of comments to skip
        limit: Maximum number of comments to return
        db: Database session
        
    Returns:
        List of comments with video information
    """
    if limit > 100:
        limit = 100
    
    # Query comments with joinedload for author and video
    comments = db.query(Comment)\
        .options(joinedload(Comment.author), joinedload(Comment.video))\
        .filter(Comment.user_id == user_id)\
        .order_by(Comment.created_at.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    return [
        CommentWithVideoResponse(
            id=comment.id,
            text=comment.text,
            created_at=comment.created_at.isoformat(),
            author={
                "id": comment.author.id,
                "username": comment.author.username,
                "profile_image": comment.author.profile_image
            },
            video={
                "id": comment.video.id,
                "title": comment.video.title,
                "thumbnail_url": f"/storage/uploads/thumbnails/{comment.video.thumbnail_filename}"
            }
        )
        for comment in comments
    ]


@router.get("/comments/count/{video_id}")
def get_comment_count(video_id: int, db: Session = Depends(get_db)):
    """
    Get the total number of comments for a video.
    
    Useful for displaying comment counts without fetching all comments.
    
    Args:
        video_id: ID of the video
        db: Database session
        
    Returns:
        Comment count
    """
    count = db.query(Comment).filter(Comment.video_id == video_id).count()
    return {"video_id": video_id, "comment_count": count}
