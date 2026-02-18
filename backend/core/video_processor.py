"""
Video Processing Utilities
---------------------------
Handles video file processing, thumbnail generation, and metadata extraction.

Features:
- Automatic thumbnail generation from video
- Video metadata extraction (duration, resolution)
- File validation and sanitization
"""

import os
import uuid
import subprocess
from pathlib import Path
from typing import Optional, Tuple
import logging

from backend.core.config import (
    VIDEOS_DIR,
    THUMBNAILS_DIR,
    TEMP_DIR,
    ALLOWED_VIDEO_FORMATS,
    MAX_VIDEO_SIZE_MB
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def generate_unique_filename(original_filename: str) -> str:
    """
    Generate a unique filename using UUID while preserving the extension.
    
    Args:
        original_filename: Original filename from upload
        
    Returns:
        Unique filename with original extension
        
    Example:
        >>> generate_unique_filename("my_video.mp4")
        "a3b8d1b6-0b3b-4b1a-9c1a-1a2b3c4d5e6f.mp4"
    """
    extension = Path(original_filename).suffix.lower()
    unique_id = str(uuid.uuid4())
    return f"{unique_id}{extension}"


def validate_video_file(filename: str, file_size: int) -> Tuple[bool, str]:
    """
    Validate video file format and size.
    
    Args:
        filename: Name of the file
        file_size: Size of the file in bytes
        
    Returns:
        Tuple of (is_valid, error_message)
        
    Example:
        >>> validate_video_file("video.mp4", 1024 * 1024 * 10)  # 10MB
        (True, "")
        >>> validate_video_file("video.exe", 1024)
        (False, "Invalid file format. Allowed formats: .mp4, .avi, .mov, .mkv, .webm")
    """
    # Check file extension
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_VIDEO_FORMATS:
        return False, f"Invalid file format. Allowed formats: {', '.join(ALLOWED_VIDEO_FORMATS)}"
    
    # Check file size
    max_size_bytes = MAX_VIDEO_SIZE_MB * 1024 * 1024
    if file_size > max_size_bytes:
        return False, f"File too large. Maximum size: {MAX_VIDEO_SIZE_MB}MB"
    
    return True, ""


def get_video_duration(video_path: str) -> Optional[float]:
    """
    Extract video duration using ffprobe (part of FFmpeg).
    
    Args:
        video_path: Path to the video file
        
    Returns:
        Duration in seconds, or None if extraction fails
        
    Example:
        >>> duration = get_video_duration("video.mp4")
        >>> print(f"Duration: {duration} seconds")
        Duration: 125.5 seconds
    """
    try:
        cmd = [
            'ffprobe',
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            video_path
        ]
        
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            duration = float(result.stdout.strip())
            return duration
        else:
            logger.error(f"ffprobe error: {result.stderr}")
            return None
            
    except subprocess.TimeoutExpired:
        logger.error("ffprobe timeout")
        return None
    except Exception as e:
        logger.error(f"Error extracting duration: {e}")
        return None


def generate_thumbnail(video_path: str, thumbnail_path: str, timestamp: float = 1.0) -> bool:
    """
    Generate a thumbnail from a video using FFmpeg.
    
    Args:
        video_path: Path to the source video file
        thumbnail_path: Path where thumbnail should be saved
        timestamp: Time in seconds to capture the thumbnail (default: 1.0)
        
    Returns:
        True if successful, False otherwise
        
    Example:
        >>> success = generate_thumbnail("video.mp4", "thumb.jpg", timestamp=2.0)
        >>> print("Thumbnail generated!" if success else "Failed")
    """
    try:
        # Ensure thumbnail directory exists
        Path(thumbnail_path).parent.mkdir(parents=True, exist_ok=True)
        
        # FFmpeg command to extract a frame at the specified timestamp
        cmd = [
            'ffmpeg',
            '-i', video_path,
            '-ss', str(timestamp),  # Seek to timestamp
            '-vframes', '1',  # Extract 1 frame
            '-vf', 'scale=320:-1',  # Scale to width 320, maintain aspect ratio
            '-y',  # Overwrite output file
            thumbnail_path
        ]
        
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30
        )
        
        if result.returncode == 0 and os.path.exists(thumbnail_path):
            logger.info(f"Thumbnail generated: {thumbnail_path}")
            return True
        else:
            logger.error(f"FFmpeg error: {result.stderr.decode()}")
            return False
            
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg timeout")
        return False
    except Exception as e:
        logger.error(f"Error generating thumbnail: {e}")
        return False


def generate_preview_frames(video_path: str, output_dir: str, video_id: int, count: int = 3) -> list:
    """
    Extract 3 high-quality frames from video for thumbnail selection.
    
    SIMPLIFIED: No AI processing - just raw, clean frame extraction.
    
    Args:
        video_path: Path to the source video file
        output_dir: Directory to save preview frames (e.g., previews/)
        video_id: Video ID for naming files
        count: Number of frames to extract (default: 3, FIXED)
        
    Returns:
        List of preview frame filenames (e.g., ["video_123_preview_1.jpg", ...])
        
    Example:
        >>> frames = generate_preview_frames("video.mp4", "previews/", 123)
        >>> print(frames)
        ['video_123_preview_1.jpg', 'video_123_preview_2.jpg', 'video_123_preview_3.jpg']
    """
    try:
        # Get video duration
        duration = get_video_duration(video_path)
        if not duration or duration < 1:
            logger.warning(f"Invalid video duration: {duration}")
            return []
        
        # Ensure output directory exists
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # Extract exactly 3 frames at 33%, 66%, 90%
        percentages = [0.33, 0.66, 0.90]
        timestamps = [duration * p for p in percentages]
        
        # Generate preview frames
        preview_frames = []
        for i, timestamp in enumerate(timestamps, 1):
            filename = f"video_{video_id}_preview_{i}.jpg"
            output_path = os.path.join(output_dir, filename)
            
            # CRITICAL: Clean FFmpeg command - NO TEXT OVERLAYS, NO FILTERS except scaling
            cmd = [
                'ffmpeg',
                '-ss', str(timestamp),  # Seek to timestamp (fast seek before input)
                '-i', video_path,
                '-vframes', '1',  # Extract 1 frame
                '-q:v', '2',  # Highest quality (2 is best)
                '-vf', 'scale=1280:-1',  # HD quality, maintain aspect ratio
                '-y',  # Overwrite
                output_path
            ]
            
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=30
            )
            
            if result.returncode == 0 and os.path.exists(output_path):
                preview_frames.append(filename)
                logger.info(f"Preview frame {i} generated at {timestamp:.2f}s ({percentages[i-1]*100:.0f}%): {filename}")
            else:
                logger.error(f"Failed to generate preview {i}: {result.stderr.decode()}")
        
        return preview_frames
        
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg timeout during preview generation")
        return []
    except Exception as e:
        logger.error(f"Error generating preview frames: {e}")
        return []



def generate_thumbnail_opencv(video_path: str, thumbnail_path: str, frame_number: int = 30) -> bool:
    """
    Generate a thumbnail using OpenCV (alternative to FFmpeg).
    
    Args:
        video_path: Path to the source video file
        thumbnail_path: Path where thumbnail should be saved
        frame_number: Frame number to capture (default: 30)
        
    Returns:
        True if successful, False otherwise
    """
    try:
        import cv2
        
        # Open video file
        video = cv2.VideoCapture(video_path)
        
        # Set frame position
        video.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        
        # Read frame
        success, frame = video.read()
        
        if success:
            # Resize frame
            height, width = frame.shape[:2]
            new_width = 320
            new_height = int(height * (new_width / width))
            resized = cv2.resize(frame, (new_width, new_height))
            
            # Save thumbnail
            cv2.imwrite(thumbnail_path, resized)
            video.release()
            logger.info(f"Thumbnail generated with OpenCV: {thumbnail_path}")
            return True
        else:
            video.release()
            logger.error("Failed to read video frame")
            return False
            
    except ImportError:
        logger.warning("OpenCV not installed, falling back to FFmpeg")
        return generate_thumbnail(video_path, thumbnail_path)
    except Exception as e:
        logger.error(f"Error generating thumbnail with OpenCV: {e}")
        return False


def cleanup_file(file_path: str) -> None:
    """
    Safely delete a file.
    
    Args:
        file_path: Path to the file to delete
    """
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Cleaned up file: {file_path}")
    except Exception as e:
        logger.error(f"Error cleaning up file {file_path}: {e}")


def cleanup_preview_frames(video_id: int, preview_dir: str) -> None:
    """
    Delete all preview frames for a specific video ID.
    Used after upload completion to save storage space.
    
    Args:
        video_id: Video ID whose preview frames should be deleted
        preview_dir: Directory containing preview frames
        
    Example:
        >>> cleanup_preview_frames(123, "previews/")
        # Deletes: video_123_preview_1.jpg through video_123_preview_5.jpg
    """
    try:
        pattern = f"video_{video_id}_preview_*.jpg"
        preview_path = Path(preview_dir)
        
        if not preview_path.exists():
            logger.warning(f"Preview directory does not exist: {preview_dir}")
            return
        
        # Find and delete all matching preview frames
        deleted_count = 0
        for frame_file in preview_path.glob(pattern):
            try:
                frame_file.unlink()
                deleted_count += 1
                logger.info(f"Deleted preview frame: {frame_file.name}")
            except Exception as e:
                logger.error(f"Failed to delete {frame_file.name}: {e}")
        
        if deleted_count > 0:
            logger.info(f"Cleanup complete: Deleted {deleted_count} preview frames for video {video_id}")
        else:
            logger.warning(f"No preview frames found for video {video_id}")
            
    except Exception as e:
        logger.error(f"Error during preview frame cleanup for video {video_id}: {e}")


def get_video_metadata(video_path: str) -> dict:
    """
    Extract comprehensive video metadata.
    
    Args:
        video_path: Path to the video file
        
    Returns:
        Dictionary with metadata (duration, resolution, codec, etc.)
    """
    metadata = {
        "duration": None,
        "width": None,
        "height": None,
        "codec": None,
        "bitrate": None
    }
    
    try:
        # Get duration
        metadata["duration"] = get_video_duration(video_path)
        
        # Get resolution and codec using ffprobe
        cmd = [
            'ffprobe',
            '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=width,height,codec_name,bit_rate',
            '-of', 'json',
            video_path
        ]
        
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            import json
            data = json.loads(result.stdout)
            if 'streams' in data and len(data['streams']) > 0:
                stream = data['streams'][0]
                metadata["width"] = stream.get("width")
                metadata["height"] = stream.get("height")
                metadata["codec"] = stream.get("codec_name")
                metadata["bitrate"] = stream.get("bit_rate")
        
    except Exception as e:
        logger.error(f"Error extracting metadata: {e}")
    
    return metadata


# Test the video processor
if __name__ == "__main__":
    print("Video Processor Utilities")
    print("=" * 60)
    
    # Test filename generation
    print("\n1. Unique Filename Generation:")
    filename = generate_unique_filename("my_video.mp4")
    print(f"   Original: my_video.mp4")
    print(f"   Unique: {filename}")
    
    # Test file validation
    print("\n2. File Validation:")
    test_files = [
        ("video.mp4", 10 * 1024 * 1024),  # 10MB
        ("video.exe", 1024),  # Invalid format
        ("large.mp4", 600 * 1024 * 1024),  # Too large
    ]
    for fname, fsize in test_files:
        valid, msg = validate_video_file(fname, fsize)
        status = "✓" if valid else "✗"
        print(f"   {status} {fname} ({fsize / 1024 / 1024:.1f}MB): {msg if msg else 'Valid'}")
    
    print("\n" + "=" * 60)
    print("Note: FFmpeg must be installed for thumbnail generation and metadata extraction")
    print("Install: https://ffmpeg.org/download.html")
