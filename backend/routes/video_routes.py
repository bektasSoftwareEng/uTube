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

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Union
from datetime import datetime
import os
import shutil
import json
from pathlib import Path

from backend.database import get_db
from backend.database.models import User, Video
from backend.routes.auth_routes import get_current_user, get_optional_user
from backend.core.video_processor import (
    generate_unique_filename,
    validate_video_file,
    generate_thumbnail,
    get_video_duration,
    cleanup_file,
    get_video_metadata,
    generate_preview_frames,
    cleanup_preview_frames
)
from backend.services.embedding_service import generate_embedding, compute_cosine_similarity
from backend.core.config import VIDEOS_DIR, THUMBNAILS_DIR, PREVIEWS_DIR, TEMP_UPLOADS_DIR
from backend.core.security import secure_resolve

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
    description: Optional[str] = None
    video_url: str
    thumbnail_url: str
    view_count: int
    upload_date: str
    author: AuthorResponse
    preview_frames: List[str] = []  # 3 preview frames for thumbnail selection
    
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
    tags: List[str] = []  # Phase 5: Recommendation-ready
    like_count: int = 0
    status: str = "published"
    visibility: str = "public"

    class Config:
        from_attributes = True


class VideoResponse(BaseModel):
    """Response model for video details."""
    id: int
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []  # Phase 5: Recommendation-ready JSON tags
    visibility: str = "public"  # Phase 5: Access control
    scheduled_at: Optional[str] = None  # Phase 5: ISO 8601 datetime
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

def get_video_url(filename: str, is_temp: bool = False) -> str:
    """Generate full URL for video file."""
    if is_temp:
        return f"/storage/uploads/temp/{filename}"
    return f"/storage/uploads/videos/{filename}"


def get_thumbnail_url(filename: str) -> str:
    """Generate full URL for thumbnail file."""
    if not filename or filename == "default_thumbnail.png":
        return "/storage/uploads/thumbnails/default_thumbnail.png"
    return f"/storage/uploads/thumbnails/{filename}"


def get_preview_url(filename: str) -> str:
    """Generate full URL for preview frame."""
    return f"/storage/uploads/previews/{filename}"

def parse_tags(tags_val: Union[str, List, None]) -> List[str]:
    """Safely parse tags from DB (which might be JSON string) to List."""
    if not tags_val:
        return []
    if isinstance(tags_val, list):
        return tags_val
    if isinstance(tags_val, str):
        try:
            parsed = json.loads(tags_val)
            if isinstance(parsed, list):
                return parsed
            return [] # fallback if json is not a list
        except json.JSONDecodeError:
            return [] # fallback if invalid json
    return []

def format_video_response(video: Video, include_duration: bool = False) -> dict:
    """Format video object for API response."""
    # Check if video file exists in main video directory, if not assume temp
    video_path = secure_resolve(VIDEOS_DIR, video.video_filename)
    is_temp = not video_path.exists()
    
    # helper to ensure category is None if empty string? No, Optional[str] handles None.
    
    response = {
        "id": video.id,
        "title": video.title,
        "description": video.description,
        "category": video.category,
        "tags": parse_tags(video.tags),
        "visibility": video.visibility,
        "scheduled_at": video.scheduled_at.isoformat() if video.scheduled_at else None,
        "video_url": get_video_url(video.video_filename, is_temp=is_temp),
        "thumbnail_url": get_thumbnail_url(video.thumbnail_filename),
        "view_count": video.view_count,
        "upload_date": video.upload_date.isoformat(),
        "duration": video.duration,
        "like_count": video.like_count,
        "author": {
            "id": video.author.id,
            "username": video.author.username,
            "profile_image": video.author.profile_image,
            "video_count": video.author.videos.count() if video.author else 0
        }
    }
    
    return response


# ============================================================================
# Routes
# ============================================================================

@router.post("/", response_model=VideoUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_video(
    background_tasks: BackgroundTasks,
    title: str = Form(..., min_length=1, max_length=200),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    visibility: str = Form("public"),
    scheduled_at: Optional[str] = Form(None),
    video_file: UploadFile = File(...),
    thumbnail_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    video_path = None
    thumbnail_path = None
    
    try:
        print(f"[UPLOAD] Starting video upload for user {current_user.username} - Title: {title}")
        
        # Validate file
        file_size = 0
        video_file.file.seek(0, 2)
        file_size = video_file.file.tell()
        video_file.file.seek(0)
        
        is_valid, error_msg = validate_video_file(video_file.filename, file_size)
        if not is_valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
        
        # Generate unique filenames
        safe_video_filename = os.path.basename(video_file.filename.replace('\0', ''))
        video_filename = generate_unique_filename(safe_video_filename)
        
        if thumbnail_file:
            safe_thumb_filename = os.path.basename(thumbnail_file.filename.replace('\0', ''))
            extension = os.path.splitext(safe_thumb_filename)[1]
            thumbnail_filename = f"{os.path.splitext(video_filename)[0]}{extension}"
        else:
            thumbnail_filename = f"{os.path.splitext(video_filename)[0]}.jpg"
            
        # Explicit CodeQL sanitization before resolving path
        video_filename = os.path.basename(video_filename.replace('\0', ''))
        thumbnail_filename = os.path.basename(thumbnail_filename.replace('\0', ''))
        
        # Save video file to TEMP STAGING
        video_path = secure_resolve(TEMP_UPLOADS_DIR, video_filename)
        thumbnail_path = secure_resolve(THUMBNAILS_DIR, thumbnail_filename)
        
        os.makedirs(video_path.parent, exist_ok=True)
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(video_file.file, buffer)
        
        if thumbnail_file:
            os.makedirs(thumbnail_path.parent, exist_ok=True)
            with open(thumbnail_path, "wb") as buffer:
                shutil.copyfileobj(thumbnail_file.file, buffer)
        else:
            thumbnail_success = generate_thumbnail(str(video_path), str(thumbnail_path), timestamp=1.0)
            if not thumbnail_success:
                thumbnail_filename = "default_thumbnail.png"
        
        # Extract metadata
        metadata = get_video_metadata(str(video_path))
        duration = metadata.get("duration")
        
        # Parse tags
        tags_list = []
        if tags:
            try:
                tags_list = json.loads(tags)
            except json.JSONDecodeError:
                tags_list = []
        
        # Parse scheduled_at
        scheduled_datetime = None
        if scheduled_at:
            try:
                scheduled_datetime = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
            except ValueError:
                scheduled_datetime = None
                
        # Generate semantic embedding
        combined_text = f"{title} {description or ''} {' '.join(tags_list)}"
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            # Offload PyTorch inference to a worker thread to prevent blocking/crashing the main event loop
            embedding = await loop.run_in_executor(None, generate_embedding, combined_text)
        except Exception as e:
            print(f"[ERROR] Failed to generate embedding: {e}")
            embedding = None
        
        # Create database entry (visibility defaults to private for upload phase)
        new_video = Video(
            title=title,
            description=description,
            category=category,
            tags=tags_list, # SQLAlchemy handles this if type is JSON, or we might need json.dumps if Text
            visibility='private', 
            status='processing', # Initial status
            scheduled_at=scheduled_datetime,
            video_filename=video_filename,
            thumbnail_filename=thumbnail_filename,
            duration=int(duration) if duration else None,
            user_id=current_user.id,
            view_count=0,
            embedding=json.dumps(embedding) if embedding else None
        )
        # Handle string serialization for Text columns
        if isinstance(tags_list, list):
             new_video.tags = json.dumps(tags_list)
        else:
             if not new_video.tags:
                 new_video.tags = "[]"
        
        db.add(new_video)
        db.commit()
        db.refresh(new_video)
        
        background_tasks.add_task(
            generate_preview_frames,
            str(video_path),
            str(PREVIEWS_DIR),
            new_video.id,
            3
        )
        
        preview_frames_urls = [get_preview_url(f"video_{new_video.id}_preview_{i}.jpg") for i in range(1, 4)]
        
        return VideoUploadResponse(
            id=new_video.id,
            title=new_video.title,
            description=new_video.description,
            video_url=get_video_url(video_filename, is_temp=True),
            thumbnail_url=get_thumbnail_url(thumbnail_filename),
            view_count=new_video.view_count,
            upload_date=new_video.upload_date.isoformat(),
            preview_frames=preview_frames_urls,
            author=AuthorResponse(
                id=current_user.id,
                username=current_user.username,
                profile_image=current_user.profile_image,
                video_count=current_user.videos.count()
            )
        )
        
    except HTTPException:
        if video_path and video_path.exists(): cleanup_file(str(video_path))
        if thumbnail_path and thumbnail_filename != "default_thumbnail.png" and thumbnail_path.exists(): cleanup_file(str(thumbnail_path))
        raise
    except Exception as e:
        if video_path and video_path.exists(): cleanup_file(str(video_path))
        if thumbnail_path and thumbnail_filename != "default_thumbnail.png" and thumbnail_path.exists(): cleanup_file(str(thumbnail_path))
        print(f"[UPLOAD ERROR] {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Upload failed: {str(e)}")


@router.get("/", response_model=List[VideoListResponse])
def get_all_videos(
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if limit > 100: limit = 100
    
    query = db.query(Video)
    now = datetime.utcnow()
    # Filter for PUBLIC and PUBLISHED videos only
    query = query.filter(
        Video.visibility == "public",
        Video.status == "published", # Ensure processing is complete
        or_(Video.scheduled_at == None, Video.scheduled_at <= now)
    )
    
    if category: query = query.filter(Video.category == category)
    if search:
        query = query.filter(
            or_(Video.title.ilike(f"%{search}%"), Video.description.ilike(f"%{search}%"))
        )
    
    videos = query.order_by(Video.upload_date.desc()).offset(skip).limit(limit).all()
    
    return [
        VideoListResponse(
            id=video.id,
            title=video.title,
            thumbnail_url=get_thumbnail_url(video.thumbnail_filename),
            view_count=video.view_count,
            upload_date=video.upload_date.isoformat(),
            duration=video.duration,
            category=video.category,
            tags=parse_tags(video.tags), # FIXED: Parse tags here
            like_count=video.like_count,
            status=video.status,
            visibility=video.visibility,
            author=AuthorResponse(
                id=video.author.id,
                username=video.author.username,
                profile_image=video.author.profile_image,
                video_count=video.author.videos.count()
            )
        )
        for video in videos
    ]

@router.get("/semantic-search", response_model=List[VideoListResponse])
def semantic_search(
    query: str,
    limit: int = 12,
    db: Session = Depends(get_db)
):
    """
    Performs context-aware local semantic search using sentence-transformers and numpy.
    """
    if not query.strip():
        return []
        
    try:
        # 1. Generate local embedding for user query
        query_vector = generate_embedding(query.strip())
    except Exception as e:
        print(f"[ERROR] Failed to generate query embedding: {e}")
        return []
        
    now = datetime.utcnow()
    clean_query = query.strip()
    
    # 2. Bypass ML for very short queries (1-2 chars) which produce extreme noise
    if len(clean_query) < 3:
        print(f"[SEMANTIC SEARCH] Query '{clean_query}' is too short ({len(clean_query)} chars). Using exact substring match fallback.")
        
        # Only match if the title explicitly Starts with the short query, or is exactly the short query.
        # Removing % clean_query % because SQLite matching can still find letters inside words
        # if spaces aren't strictly respected by the tokenizer.
        eligible_videos = db.query(Video).filter(
            Video.visibility == "public",
            Video.status == "published",
            or_(Video.scheduled_at == None, Video.scheduled_at <= now),
            or_(
                Video.title.ilike(f"{clean_query}%"),          # Starts with
                Video.title.ilike(clean_query),                # Exact match
            )
        ).all()
        # No scoring needed, return direct match
        scored_videos = [(1.0, v) for v in eligible_videos]
        top_videos = [v[1] for v in scored_videos[:limit]]
        print(f"[SEMANTIC SEARCH] Found {len(top_videos)} substring matches.")
    else:
        # Fetch all eligible videos that have embeddings stored natively in SQLite
        eligible_videos = db.query(Video).filter(
            Video.visibility == "public",
            Video.status == "published",
            or_(Video.scheduled_at == None, Video.scheduled_at <= now),
            Video.embedding != None
        ).all()
        
        if not eligible_videos:
            return []
            
        # 3. Calculate Cosine Similarity locally using our custom numpy logic
        scored_videos = []
        for video in eligible_videos:
            try:
                # SQLAlchemy JSON column usually returns a Python list
                video_vector = video.embedding if isinstance(video.embedding, list) else json.loads(video.embedding)
                if not video_vector:
                    continue
                    
                score = compute_cosine_similarity(query_vector, video_vector)
                
                # Boost score if there's an exact substring match in the title
                if clean_query.lower() in video.title.lower():
                    score += 0.2
                    
                scored_videos.append((score, video))
                print(f"[SEMANTIC SEARCH] Score for video {video.id} ('{video.title}'): {score:.4f}")
            except Exception as e:
                print(f"[WARNING] Could not compute distance for video {video.id}: {e}")
                continue
                
        # 4. Sort by score descending (highest similarity first)
        scored_videos.sort(key=lambda x: x[0], reverse=True)
        
        # Take top N
        # 0.45 threshold ensures we only return strong contextual/semantic matches.
        top_videos = [v[1] for v in scored_videos[:limit] if v[0] > 0.45]
        print(f"[SEMANTIC SEARCH] ML Search returned {len(top_videos)} strong matches above threshold 0.45.")
    
    return [
        VideoListResponse(
            id=video.id,
            title=video.title,
            thumbnail_url=get_thumbnail_url(video.thumbnail_filename),
            view_count=video.view_count,
            upload_date=video.upload_date.isoformat(),
            duration=video.duration,
            category=video.category,
            tags=parse_tags(video.tags),
            like_count=video.like_count,
            status=video.status,
            visibility=video.visibility,
            author=AuthorResponse(
                id=video.author.id,
                username=video.author.username,
                profile_image=video.author.profile_image,
                video_count=video.author.videos.count()
            )
        )
        for video in top_videos
    ]

@router.get("/history", response_model=List[VideoListResponse])
def get_video_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch the current user's watch history (Placeholder)."""
    # Currently returning empty list until WatchHistory model is implemented
    return []

@router.get("/liked", response_model=List[VideoListResponse])
def get_liked_videos(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch videos liked by the current user."""
    from backend.database.models import Like
    
    # Query videos linked to likes by the current user
    liked_videos = db.query(Video).join(Like).filter(
        Like.user_id == current_user.id,
        Like.is_dislike == False
    ).order_by(Like.created_at.desc()).all()
    
    return [
        VideoListResponse(
            id=video.id,
            title=video.title,
            thumbnail_url=get_thumbnail_url(video.thumbnail_filename),
            view_count=video.view_count,
            upload_date=video.upload_date.isoformat(),
            duration=video.duration,
            category=video.category,
            tags=parse_tags(video.tags),
            like_count=video.like_count,
            status=video.status,
            visibility=video.visibility,
            author=AuthorResponse(
                id=video.author.id,
                username=video.author.username,
                profile_image=video.author.profile_image,
                video_count=video.author.videos.count()
            )
        )
        for video in liked_videos
    ]

@router.get("/{video_id}", response_model=VideoResponse)
def get_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
    
    now = datetime.utcnow()
    is_owner = current_user and current_user.id == video.user_id
    
    if video.visibility == "private" and not is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This video is private")
    
    if video.scheduled_at and video.scheduled_at > now and not is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This video is not yet published")
    
    return format_video_response(video, include_duration=True) # Uses parse_tags inside format_video_response now

@router.post("/{video_id}/view", status_code=status.HTTP_200_OK)
async def increment_view_count(video_id: str, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
    video.view_count += 1
    db.commit()
    return {"status": "success", "view_count": video.view_count}

@router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_video(video_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
    if video.user_id != current_user.id: raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this video")
    
    video_path_perm = secure_resolve(VIDEOS_DIR, video.video_filename)
    video_path_temp = secure_resolve(TEMP_UPLOADS_DIR, video.video_filename)
    
    if video_path_perm.exists(): cleanup_file(str(video_path_perm))
    if video_path_temp.exists(): cleanup_file(str(video_path_temp))

    thumbnail_path = secure_resolve(THUMBNAILS_DIR, video.thumbnail_filename)
    if video.thumbnail_filename != "default_thumbnail.png": cleanup_file(str(thumbnail_path))
    
    db.delete(video)
    db.commit()
    return None

class VideoUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    visibility: Optional[str] = None
    scheduled_at: Optional[str] = None
    selected_preview_frame: Optional[str] = None
    class Config: from_attributes = True

@router.post("/{video_id}/thumbnail", response_model=VideoResponse)
def upload_video_thumbnail(
    video_id: int,
    thumbnail_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
    if video.user_id != current_user.id: raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this video")
    
    import time
    safe_thumb_filename = os.path.basename(thumbnail_file.filename.replace('\0', ''))
    extension = os.path.splitext(safe_thumb_filename)[1]
    final_filename = f"video_{video_id}_custom_{int(time.time())}{extension}"
    
    THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)
    base_path = os.path.abspath(str(THUMBNAILS_DIR))
    fullpath = os.path.abspath(os.path.normpath(os.path.join(base_path, final_filename)))
    if not fullpath.startswith(base_path):
        raise HTTPException(status_code=400, detail="Invalid path")
    
    with open(fullpath, "wb") as buffer:
        shutil.copyfileobj(thumbnail_file.file, buffer)
        
    old_filename = video.thumbnail_filename
    if old_filename and old_filename != "default_thumbnail.png" and old_filename != final_filename:
        old_path = secure_resolve(THUMBNAILS_DIR, old_filename)
        if old_path.exists():
            try:
                os.remove(str(old_path))
            except:
                pass
                
    video.thumbnail_filename = final_filename
    db.commit()
    db.refresh(video)
    return format_video_response(video, include_duration=True)

@router.patch("/{video_id}/", response_model=VideoResponse)
@router.put("/{video_id}/", response_model=VideoResponse)
async def update_video(
    video_id: int,
    update_data: VideoUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    print(f"[UPDATE] Received request to update video {video_id}")
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
    if video.user_id != current_user.id: raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this video")
    
    new_visibility = update_data.visibility
    
    needs_new_embedding = False

    if update_data.title is not None: 
        video.title = update_data.title
        needs_new_embedding = True
    if update_data.description is not None: 
        video.description = update_data.description
        needs_new_embedding = True
    if update_data.category is not None: video.category = update_data.category
    if update_data.tags is not None: 
        video.tags = json.dumps(update_data.tags)
        needs_new_embedding = True
        
    if needs_new_embedding:
        try:
            # Recompute semantic embedding if textual metadata changed
            tags_list = json.loads(video.tags) if isinstance(video.tags, str) else (video.tags or [])
            combined_text = f"{video.title} {video.description or ''} {' '.join(tags_list)}"
            
            import asyncio
            loop = asyncio.get_event_loop()
            new_embedding = await loop.run_in_executor(None, generate_embedding, combined_text)
            video.embedding = json.dumps(new_embedding) if new_embedding else None
        except Exception as e:
            print(f"[ERROR] Failed to update embedding: {e}")
    if update_data.visibility is not None: video.visibility = update_data.visibility
    if update_data.scheduled_at is not None:
        video.scheduled_at = datetime.fromisoformat(update_data.scheduled_at) if update_data.scheduled_at else None
    
    # Auto-update status to 'published' when visibility becomes public
    if new_visibility == 'public':
        video.status = 'published'
    if new_visibility == 'public':
        temp_video_path = secure_resolve(TEMP_UPLOADS_DIR, video.video_filename)
        perm_video_path = secure_resolve(VIDEOS_DIR, video.video_filename)
        
        # Move if logic
        if not perm_video_path.exists():
            if temp_video_path.exists():
                try:
                    shutil.move(str(temp_video_path), str(perm_video_path))
                    print(f"[MOVE] Video moved from TEMP to VIDEOS: {video.video_filename}")
                    
                    # Refinement: Explicit Move Verification
                    # Ensure source is gone even if shutil.move failed to delete it (e.g. cross-fs copy)
                    if temp_video_path.exists():
                        try:
                            os.remove(str(temp_video_path))
                            print(f"[CLEANUP] Verified/Deleted temp source: {video.video_filename}")
                        except Exception as e:
                            print(f"[CLEANUP WARNING] Could not delete temp source: {e}")
                            
                except Exception as e:
                    print(f"[MOVE ERROR] Failed to move video: {e}")

        # Post-Publish Safety: If perm exists, temp should definitely be gone
        if perm_video_path.exists() and temp_video_path.exists():
             try:
                os.remove(str(temp_video_path))
                print(f"[CLEANUP] Deleted residue temp source: {video.video_filename}")
             except Exception as e:
                print(f"[CLEANUP WARNING] Residue cleanup failed: {e}")
    
    # POST-PUBLISH CLEANUP
    selected_thumbnail_path = None
    if update_data.selected_preview_frame:
        temp_filename = os.path.basename(update_data.selected_preview_frame.replace('\0', ''))
        temp_path = secure_resolve(PREVIEWS_DIR, temp_filename)
        selected_thumbnail_path = temp_path
    
    if selected_thumbnail_path and selected_thumbnail_path.exists():
        try:
            file_ext = selected_thumbnail_path.suffix
            final_filename = f"video_{video_id}_final{file_ext}"
            final_path = secure_resolve(THUMBNAILS_DIR, final_filename)
            THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)
            shutil.move(str(selected_thumbnail_path), str(final_path))
            video.thumbnail_filename = final_filename
            print(f"[CLEANUP] Thumbnail updated to {final_filename}")
        except Exception as e:
            print(f"[CLEANUP ERROR] Failed to move thumbnail: {e}")
            video.thumbnail_filename = os.path.basename(str(selected_thumbnail_path))
    
    # CLEANUP: Delete ALL preview frames if published or thumbnail selected
    if new_visibility == 'public' or update_data.selected_preview_frame:
        try:
            preview_pattern = f"video_{video_id}_preview_*.*"
            deleted_count = 0
            for preview_file in PREVIEWS_DIR.glob(preview_pattern):
                try:
                    # EXTRA SAFETY: Do not delete if it matches the new thumbnail filename (shouldn't happen due to move, but safe is better)
                    if preview_file.name == video.thumbnail_filename:
                        continue
                        
                    os.remove(str(preview_file))
                    deleted_count += 1
                except Exception as e:
                    print(f"[CLEANUP WARNING] Could not delete {preview_file.name}: {e}")
            if deleted_count > 0: print(f"[CLEANUP] Deleted {deleted_count} preview frame(s)")
        except Exception as e:
            print(f"[CLEANUP ERROR] Error during preview cleanup: {e}")
    
    db.commit()
    db.refresh(video)
    return format_video_response(video, include_duration=True)

@router.get("/user/{user_id}", response_model=List[VideoListResponse])
def get_user_videos(user_id: int, skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    if limit > 100: limit = 100
    videos = db.query(Video).filter(Video.user_id == user_id).order_by(Video.upload_date.desc()).offset(skip).limit(limit).all()
    
    return [
        VideoListResponse(
            id=video.id,
            title=video.title,
            thumbnail_url=get_thumbnail_url(video.thumbnail_filename),
            view_count=video.view_count,
            upload_date=video.upload_date.isoformat(),
            duration=video.duration,
            category=video.category,
            tags=parse_tags(video.tags), # FIXED
            like_count=video.like_count,
            status=video.status,
            visibility=video.visibility,
            author=AuthorResponse(
                id=video.author.id,
                username=video.author.username,
                profile_image=video.author.profile_image,
                video_count=video.author.videos.count()
            )
        )
        for video in videos
    ]
