import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent
sys.path.insert(0, str(project_root))

from backend.database import SessionLocal
from backend.database.models import Video, Like, Comment
from backend.routes.video_routes import VideoListResponse, AuthorResponse, get_thumbnail_url
from sqlalchemy import func, case
from sqlalchemy.orm import joinedload

db = SessionLocal()

try:
    like_count_sq = db.query(func.count(Like.id)).filter(
        Like.video_id == Video.id, Like.is_dislike == False
    ).correlate(Video).scalar_subquery()

    comment_count_sq = db.query(func.count(Comment.id)).filter(
        Comment.video_id == Video.id
    ).correlate(Video).scalar_subquery()

    ratio_expr = (
        func.coalesce(like_count_sq, 0) + func.coalesce(comment_count_sq, 0)
    ) * 1.0 / case((Video.view_count == 0, 1), else_=Video.view_count)

    videos = db.query(Video).options(joinedload(Video.author)).order_by(ratio_expr.desc()).limit(5).all()
    
    # Try formatting
    res = [
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
    print("SUCCESS")
    
except Exception as e:
    import traceback
    with open("trace.txt", "w", encoding="utf-8") as f:
        f.write(traceback.format_exc())
    print("Traceback written to trace.txt")
finally:
    db.close()
