import os
import shutil
import time
from datetime import datetime, timedelta
from pathlib import Path
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.database.models import Video
from backend.core.config import UPLOADS_DIR

def cleanup_stuck_uploads():
    """
    Identifies videos stuck in 'processing' state for > 30 minutes.
    Marks them as 'failed' and removes their temporary directories.
    """
    print("[CLEANUP] Starting cleanup of stuck uploads...")
    db: Session = SessionLocal()
    try:
        # Time threshold: 30 minutes ago
        threshold = datetime.utcnow() - timedelta(minutes=30)
        
        # Find stuck videos
        stuck_videos = db.query(Video).filter(
            Video.status == 'processing',
            Video.updated_at < threshold
        ).all()
        
        if not stuck_videos:
            print("[CLEANUP] No stuck uploads found.")
            return

        print(f"[CLEANUP] Found {len(stuck_videos)} stuck videos. cleaning up...")

        for video in stuck_videos:
            print(f"[CLEANUP] Failing Video ID: {video.id} (Stuck since {video.updated_at})")
            
            # 1. Update Status
            video.status = 'failed'
            video.error_message = "Processing timed out or server restarted."
            video.updated_at = datetime.utcnow()
            
            # 2. Delete Temp Directory
            temp_path = UPLOADS_DIR / "temp" / str(video.id)
            if temp_path.exists():
                try:
                    shutil.rmtree(temp_path)
                    print(f"[CLEANUP] Deleted temp files: {temp_path}")
                except Exception as e:
                    print(f"[CLEANUP] Error deleting {temp_path}: {e}")
            
        db.commit()
        print("[CLEANUP] Cleanup completed successfully.")
        
    except Exception as e:
        print(f"[CLEANUP] Critical Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_stuck_uploads()
