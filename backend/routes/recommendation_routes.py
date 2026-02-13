"""
Recommendation Feed Routes
---------------------------
Hybrid recommendation system based on user preferences and behavior.

Endpoints:
- GET /feed/recommended: Get personalized video recommendations
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional
from collections import Counter

from backend.database import get_db
from backend.database.models import User, Video, Like
from backend.routes.auth_routes import get_current_user, get_optional_user
from backend.routes.video_routes import VideoListResponse, AuthorResponse, get_thumbnail_url

# Create router
router = APIRouter(prefix="/feed", tags=["Recommendations"])


@router.get("/recommended", response_model=List[VideoListResponse])
def get_recommended_feed(
    limit: int = 20,
    author_id: Optional[int] = None,
    category: Optional[str] = None,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Get personalized video recommendations using hybrid logic.
    
    Recommendation Strategy:
    1. For users with likes: Show videos from categories they've liked
    2. Collaborative filtering: Show videos liked by similar users
    3. For new users: Show trending videos (most viewed)
    
    Args:
        limit: Maximum number of videos to return (max 50)
        current_user: Authenticated user
        db: Database session
        
    Returns:
        List of recommended videos
    """
    if limit > 50:
        limit = 50
    
    recommended_video_ids = set()
    
    # Contextual Strategy: Prioritize Same Author and Category
    if author_id or category:
        context_query = db.query(Video.id)
        
        # Build list of conditions
        conditions = []
        if author_id:
            conditions.append(Video.user_id == author_id)
        if category:
            conditions.append(Video.category == category)
            
        if conditions:
            context_query = context_query.filter(or_(*conditions))
            
        context_videos = context_query.order_by(Video.view_count.desc()).limit(limit // 2).all()
        recommended_video_ids.update([v.id for v in context_videos])

    user_likes = []
    
    # Get user's liked videos if logged in
    if current_user:
        user_likes = db.query(Like)\
            .filter(Like.user_id == current_user.id)\
            .all()
        
        if user_likes:
            # Strategy 1: Get categories from user's liked videos
            liked_video_ids = [like.video_id for like in user_likes]
            liked_videos = db.query(Video)\
                .filter(Video.id.in_(liked_video_ids))\
                .all()
        
            # Extract categories (filter out None values)
            user_categories = [v.category for v in liked_videos if v.category]
        
        if user_categories:
            # Count category frequency
            category_counts = Counter(user_categories)
            top_categories = [cat for cat, _ in category_counts.most_common(3)]
            
            # Get videos from user's favorite categories (exclude already liked)
            category_videos = db.query(Video.id)\
                .filter(
                    and_(
                        Video.category.in_(top_categories),
                        ~Video.id.in_(liked_video_ids)
                    )
                )\
                .order_by(Video.view_count.desc())\
                .limit(limit // 2)\
                .all()
            
            recommended_video_ids.update([v.id for v in category_videos])
        
        # Strategy 2: Collaborative filtering - find similar users
        # Users who liked the same videos as current user
        similar_users = db.query(Like.user_id)\
            .filter(
                and_(
                    Like.video_id.in_(liked_video_ids),
                    Like.user_id != current_user.id
                )
            )\
            .group_by(Like.user_id)\
            .having(func.count(Like.video_id) >= 2)\
            .limit(10)\
            .all()
        
        if similar_users:
            similar_user_ids = [u.user_id for u in similar_users]
            
            # Get videos liked by similar users (exclude already liked)
            similar_user_videos = db.query(Like.video_id)\
                .filter(
                    and_(
                        Like.user_id.in_(similar_user_ids),
                        ~Like.video_id.in_(liked_video_ids),
                        ~Like.video_id.in_(recommended_video_ids)
                    )
                )\
                .group_by(Like.video_id)\
                .order_by(func.count(Like.user_id).desc())\
                .limit(limit // 2)\
                .all()
            
            recommended_video_ids.update([v.video_id for v in similar_user_videos])
    
    # Strategy 3: Fill remaining slots with trending videos
    if len(recommended_video_ids) < limit:
        remaining = limit - len(recommended_video_ids)
        
        # Get trending videos (exclude already recommended and liked)
        exclude_ids = recommended_video_ids.union(set([like.video_id for like in user_likes]))
        
        trending_query = db.query(Video.id)\
            .order_by(Video.view_count.desc())
        
        if exclude_ids:
            trending_query = trending_query.filter(~Video.id.in_(exclude_ids))
        
        trending_videos = trending_query.limit(remaining).all()
        recommended_video_ids.update([v.id for v in trending_videos])
    
    # Fetch full video details
    if not recommended_video_ids:
        # Fallback: return trending videos
        videos = db.query(Video)\
            .order_by(Video.view_count.desc())\
            .limit(limit)\
            .all()
    else:
        videos = db.query(Video)\
            .filter(Video.id.in_(recommended_video_ids))\
            .order_by(Video.view_count.desc())\
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
