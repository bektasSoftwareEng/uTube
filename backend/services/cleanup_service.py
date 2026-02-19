"""
Storage Cleanup Service
-----------------------
Automated cleanup of orphaned files, temp directories, and stuck uploads.
Runs at backend startup via startup_cleanup().

Functions:
- startup_cleanup(): Master function — calls all cleanup tasks
- cleanup_stuck_uploads(): Mark stuck 'processing' videos as 'failed'
- purge_orphaned_files(): Delete disk files not referenced in DB
- wipe_temp_folders(): Clear temp directories on restart
"""

import os
import time
import shutil
import logging
from datetime import datetime, timedelta
from pathlib import Path
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.database.models import Video
from backend.core.config import (
    VIDEOS_DIR,
    THUMBNAILS_DIR,
    PREVIEWS_DIR,
    TEMP_DIR,
    TEMP_UPLOADS_DIR,
)

logger = logging.getLogger(__name__)

# Safety threshold: skip files younger than 5 minutes
SAFETY_MINUTES = 5


def _is_safe_to_delete(file_path: Path) -> bool:
    """
    Check if a file is safe to delete (older than SAFETY_MINUTES).
    Prevents deleting files that are currently being written by active uploads.
    """
    try:
        mtime = file_path.stat().st_mtime
        age_seconds = time.time() - mtime
        return age_seconds > (SAFETY_MINUTES * 60)
    except (OSError, FileNotFoundError):
        return False


def cleanup_stuck_uploads():
    """
    Mark videos stuck in 'processing' state for > 30 minutes as 'failed'.
    Removes their temporary directories.
    """
    logger.info("[CLEANUP] Checking for stuck uploads...")
    db: Session = SessionLocal()
    try:
        threshold = datetime.utcnow() - timedelta(minutes=30)

        stuck_videos = db.query(Video).filter(
            Video.status == 'processing',
            Video.upload_date < threshold
        ).all()

        if not stuck_videos:
            logger.info("[CLEANUP] No stuck uploads found.")
            return

        logger.info(f"[CLEANUP] Found {len(stuck_videos)} stuck video(s).")

        for video in stuck_videos:
            logger.info(f"[CLEANUP] Failing Video ID: {video.id} (uploaded {video.upload_date})")
            video.status = 'failed'

            # Delete temp directory if it exists
            temp_path = TEMP_UPLOADS_DIR / str(video.id)
            if temp_path.exists() and temp_path.is_dir():
                try:
                    shutil.rmtree(temp_path)
                    logger.info(f"[CLEANUP] Deleted temp dir: {temp_path}")
                except Exception as e:
                    logger.warning(f"[CLEANUP] Could not delete {temp_path}: {e}")

            # Also try deleting the temp video file directly
            temp_file = TEMP_UPLOADS_DIR / video.video_filename
            if temp_file.exists() and temp_file.is_file():
                try:
                    os.remove(str(temp_file))
                    logger.info(f"[CLEANUP] Deleted temp file: {temp_file.name}")
                except Exception as e:
                    logger.warning(f"[CLEANUP] Could not delete {temp_file.name}: {e}")

        db.commit()
        logger.info("[CLEANUP] Stuck uploads cleanup complete.")

    except Exception as e:
        logger.error(f"[CLEANUP] Stuck uploads error: {e}")
        db.rollback()
    finally:
        db.close()


def purge_orphaned_files():
    """
    Scan videos/ and thumbnails/ directories.
    Delete any file whose filename is NOT referenced in the database.
    Respects 5-minute safety window for active uploads.
    """
    logger.info("[CLEANUP] Scanning for orphaned files...")
    db: Session = SessionLocal()
    total_deleted = 0

    try:
        # Collect all valid filenames from DB
        all_videos = db.query(Video).all()
        valid_video_files = {v.video_filename for v in all_videos if v.video_filename}
        valid_thumb_files = {v.thumbnail_filename for v in all_videos if v.thumbnail_filename}

        # Always keep default assets
        valid_thumb_files.add("default_thumbnail.png")

        # --- Purge orphaned VIDEO files ---
        if VIDEOS_DIR.exists():
            for f in VIDEOS_DIR.iterdir():
                if f.is_file() and f.name not in valid_video_files:
                    if _is_safe_to_delete(f):
                        try:
                            os.remove(str(f))
                            total_deleted += 1
                            logger.info(f"[ORPHAN] Deleted video: {f.name}")
                        except Exception as e:
                            logger.warning(f"[ORPHAN] Could not delete {f.name}: {e}")
                    else:
                        logger.info(f"[ORPHAN] Skipped (too new): {f.name}")

        # --- Purge orphaned THUMBNAIL files ---
        if THUMBNAILS_DIR.exists():
            for f in THUMBNAILS_DIR.iterdir():
                if f.is_file() and f.name not in valid_thumb_files:
                    if _is_safe_to_delete(f):
                        try:
                            os.remove(str(f))
                            total_deleted += 1
                            logger.info(f"[ORPHAN] Deleted thumbnail: {f.name}")
                        except Exception as e:
                            logger.warning(f"[ORPHAN] Could not delete {f.name}: {e}")
                    else:
                        logger.info(f"[ORPHAN] Skipped (too new): {f.name}")

        if total_deleted > 0:
            logger.info(f"[CLEANUP] Purged {total_deleted} orphaned file(s).")
        else:
            logger.info("[CLEANUP] No orphaned files found.")

    except Exception as e:
        logger.error(f"[CLEANUP] Orphan purge error: {e}")
    finally:
        db.close()


def wipe_temp_folders():
    """
    On server restart, delete all contents of temp directories.
    Respects 5-minute safety window for files that may be from an active upload
    started just before a restart.
    """
    logger.info("[CLEANUP] Wiping temp folders...")
    total_deleted = 0

    for temp_dir in [TEMP_DIR, TEMP_UPLOADS_DIR]:
        if not temp_dir.exists():
            continue

        for item in temp_dir.iterdir():
            try:
                if item.is_file():
                    if _is_safe_to_delete(item):
                        os.remove(str(item))
                        total_deleted += 1
                        logger.info(f"[TEMP] Deleted file: {item.name}")
                    else:
                        logger.info(f"[TEMP] Skipped (too new): {item.name}")
                elif item.is_dir():
                    # For directories, check the dir's own mtime
                    if _is_safe_to_delete(item):
                        shutil.rmtree(str(item))
                        total_deleted += 1
                        logger.info(f"[TEMP] Deleted dir: {item.name}")
                    else:
                        logger.info(f"[TEMP] Skipped dir (too new): {item.name}")
            except Exception as e:
                logger.warning(f"[TEMP] Could not delete {item.name}: {e}")

    if total_deleted > 0:
        logger.info(f"[CLEANUP] Wiped {total_deleted} temp item(s).")
    else:
        logger.info("[CLEANUP] Temp folders already clean.")


def startup_cleanup():
    """
    Master cleanup function — called once at backend startup.
    Runs all cleanup tasks in order.
    """
    logger.info("=" * 60)
    logger.info("[STARTUP] Running storage cleanup...")
    logger.info("=" * 60)

    cleanup_stuck_uploads()
    purge_orphaned_files()
    wipe_temp_folders()

    logger.info("=" * 60)
    logger.info("[STARTUP] Storage cleanup complete.")
    logger.info("=" * 60)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    startup_cleanup()
