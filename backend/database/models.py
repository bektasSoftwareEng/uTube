"""
Database Models
---------------
SQLAlchemy ORM models for the uTube video-sharing platform.

Models:
- User: Platform users with authentication
- Video: Uploaded videos with metadata
- Comment: User comments on videos
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.database.connection import Base


class User(Base):
    """
    User model for authentication and profile management.
    
    Attributes:
        id: Primary key
        username: Unique username for login
        email: Unique email address
        password_hash: Hashed password (never store plain text!)
        profile_image: Filename of user's avatar/profile picture
        created_at: Account creation timestamp
        
    Relationships:
        videos: All videos uploaded by this user
        comments: All comments made by this user
    """
    __tablename__ = "users"
    
    # Primary Key
    id = Column(Integer, primary_key=True, index=True)
    
    # User Credentials
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    
    # Profile Information
    profile_image = Column(String(255), nullable=True, default="default_avatar.png")
    is_synthetic = Column(Integer, default=0, nullable=False)  # For test data (0=real, 1=synthetic)
    stream_key = Column(String(100), unique=True, index=True, nullable=True)
    stream_title = Column(String(100), nullable=True)
    stream_category = Column(String(50), nullable=True, default="Gaming")
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    videos = relationship(
        "Video",
        back_populates="author",
        cascade="all, delete-orphan",  # Delete videos when user is deleted
        lazy="dynamic"  # Load videos on demand
    )
    
    comments = relationship(
        "Comment",
        back_populates="author",
        cascade="all, delete-orphan",  # Delete comments when user is deleted
        lazy="dynamic"
    )
    
    likes = relationship(
        "Like",
        back_populates="user",
        cascade="all, delete-orphan",  # Delete likes when user is deleted
        lazy="dynamic"
    )
    
    # Subscription relationships
    following = relationship(
        "Subscription",
        foreign_keys="Subscription.follower_id",
        back_populates="follower",
        cascade="all, delete-orphan",
        lazy="dynamic"
    )
    
    followers = relationship(
        "Subscription",
        foreign_keys="Subscription.following_id",
        back_populates="following_user",
        cascade="all, delete-orphan",
        lazy="dynamic"
    )
    
    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"


class Video(Base):
    """
    Video model for uploaded video content.
    
    Attributes:
        id: Primary key
        title: Video title
        description: Video description/summary
        video_filename: Stored filename of the video file
        thumbnail_filename: Stored filename of the thumbnail image
        view_count: Number of views (for analytics)
        upload_date: When the video was uploaded
        user_id: Foreign key to User (video owner)
        category: Video category (e.g., "Education", "Entertainment", "Technology")
        tags: Comma-separated tags for search and filtering
        duration: Video duration in seconds
        
    Relationships:
        author: The user who uploaded this video
        comments: All comments on this video
        likes: All likes on this video
    """
    __tablename__ = "videos"
    
    # Primary Key
    id = Column(Integer, primary_key=True, index=True)
    
    # Video Metadata
    title = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=True, index=True)  # For filtering
    tags = Column(JSON, nullable=True, default=list)  # Recommendation-ready JSON array
    
    # Phase 5: Access Control & Scheduling
    visibility = Column(String(20), nullable=False, default="public", index=True)  # public, unlisted, private
    scheduled_at = Column(DateTime, nullable=True)  # UTC - For future publication
    
    # File Storage
    video_filename = Column(String(255), nullable=False)
    thumbnail_filename = Column(String(255), nullable=True, default="default_thumbnail.png")
    
    # Analytics
    view_count = Column(Integer, default=0, nullable=False, index=True)  # Indexed for trending
    duration = Column(Integer, nullable=True)  # Duration in seconds
    
    # Status (processing, published, failed)
    status = Column(String(20), default="processing", nullable=False, index=True)

    # Timestamps
    upload_date = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Foreign Keys
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Relationships
    author = relationship(
        "User",
        back_populates="videos"
    )
    
    comments = relationship(
        "Comment",
        back_populates="video",
        cascade="all, delete-orphan",  # Delete comments when video is deleted
        lazy="dynamic",
        order_by="Comment.created_at.desc()"  # Show newest comments first
    )
    
    likes = relationship(
        "Like",
        back_populates="video",
        cascade="all, delete-orphan",  # Delete likes when video is deleted
        lazy="dynamic"
    )
    
    def __repr__(self):
        return f"<Video(id={self.id}, title='{self.title}', category='{self.category}', author_id={self.user_id}, views={self.view_count})>"
    
    @property
    def like_count(self):
        """Get the number of likes (not dislikes) for this video."""
        return self.likes.filter(Like.is_dislike == False).count()
    
    @property
    def dislike_count(self):
        """Get the number of dislikes for this video."""
        return self.likes.filter(Like.is_dislike == True).count()
    
    def get_tags_list(self):
        """Parse tags string into a list."""
        if self.tags:
            return [tag.strip() for tag in self.tags.split(',') if tag.strip()]
        return []


class Comment(Base):
    """
    Comment model for user comments on videos.
    
    Attributes:
        id: Primary key
        text: Comment content
        created_at: When the comment was posted
        user_id: Foreign key to User (comment author)
        video_id: Foreign key to Video (commented video)
        
    Relationships:
        author: The user who wrote this comment
        video: The video this comment belongs to
    """
    __tablename__ = "comments"
    
    # Primary Key
    id = Column(Integer, primary_key=True, index=True)
    
    # Comment Content
    text = Column(Text, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Foreign Keys
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    
    # Relationships
    author = relationship(
        "User",
        back_populates="comments"
    )
    
    video = relationship(
        "Video",
        back_populates="comments"
    )
    
    comment_likes = relationship(
        "CommentLike",
        back_populates="comment",
        cascade="all, delete-orphan",
        lazy="dynamic"
    )
    
    def __repr__(self):
        return f"<Comment(id={self.id}, author_id={self.user_id}, video_id={self.video_id}, text='{self.text[:30]}...')>"


class Like(Base):
    """
    Like model for tracking user likes on videos.
    
    Attributes:
        id: Primary key
        user_id: Foreign key to User (who liked)
        video_id: Foreign key to Video (liked video)
        created_at: When the like was created
        
    Relationships:
        user: The user who liked the video
        video: The video that was liked
    """
    __tablename__ = "likes"
    
    # Primary Key
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign Keys
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    
    # Like vs Dislike
    is_dislike = Column(Boolean, default=False, nullable=False)  # False=like, True=dislike
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="likes")
    video = relationship("Video", back_populates="likes")
    
    # Unique constraint: one like per user per video
    __table_args__ = (
        UniqueConstraint('user_id', 'video_id', name='unique_user_video_like'),
    )
    
    def __repr__(self):
        return f"<Like(id={self.id}, user_id={self.user_id}, video_id={self.video_id})>"


class Subscription(Base):
    """
    Subscription model for user-to-user following.
    
    Attributes:
        id: Primary key
        follower_id: Foreign key to User (who is following)
        following_id: Foreign key to User (who is being followed)
        created_at: When the subscription was created
        
    Relationships:
        follower: The user who is following
        following_user: The user being followed
    """
    __tablename__ = "subscriptions"
    
    # Primary Key
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign Keys
    follower_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    following_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    follower = relationship("User", foreign_keys=[follower_id], back_populates="following")
    following_user = relationship("User", foreign_keys=[following_id], back_populates="followers")
    
    # Unique constraint: one subscription per follower-following pair
    __table_args__ = (
        UniqueConstraint('follower_id', 'following_id', name='unique_follower_following'),
    )
    
    def __repr__(self):
        return f"<Subscription(id={self.id}, follower_id={self.follower_id}, following_id={self.following_id})>"


class CommentLike(Base):
    """
    CommentLike model for tracking user likes/dislikes on comments (YouTube-style).
    
    Attributes:
        id: Primary key
        user_id: Foreign key to User
        comment_id: Foreign key to Comment
        is_dislike: False=like, True=dislike
        created_at: Timestamp
    """
    __tablename__ = "comment_likes"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    comment_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False)
    is_dislike = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User")
    comment = relationship("Comment", back_populates="comment_likes")
    
    # Unique constraint: one reaction per user per comment
    __table_args__ = (
        UniqueConstraint('user_id', 'comment_id', name='unique_user_comment_like'),
    )
    
    def __repr__(self):
        return f"<CommentLike(id={self.id}, user={self.user_id}, comment={self.comment_id}, dislike={self.is_dislike})>"
