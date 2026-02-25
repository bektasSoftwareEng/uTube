"""
Trending Videos Endpoint
-------------------------
Returns trending videos for Netflix-style hero carousel.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List

from backend.database import get_db
from backend.database.models import Video
from backend.routes.video_routes import VideoListResponse, AuthorResponse, get_thumbnail_url

# Create router
router = APIRouter(prefix="/videos", tags=["Trending"])


@router.get("/trending", response_model=List[VideoListResponse])
def get_trending_videos(
    limit: int = 5,
    db: Session = Depends(get_db)
):
    """
    Get trending videos (most viewed) for hero carousel.
    
    Returns top videos ordered by view count (descending).
    Perfect for Netflix-style hero carousels.
    
    Args:
        limit: Number of trending videos to return (default: 5, max: 20)
        db: Database session
        
    Returns:
        List of trending videos
    """
    # Limit maximum results
    if limit > 20:
        limit = 20
    
    # Query videos ordered by (likes / max(views, 1)) descending
    # Multiply by 1.0 to force floating point division instead of integer floor division
    ratio_expr = (func.coalesce(Video.like_count, 0) * 1.0) / func.greatest(Video.view_count, 1)
    
    videos = db.query(Video)\
        .options(joinedload(Video.author))\
        .order_by(ratio_expr.desc())\
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
