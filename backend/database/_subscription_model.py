"""
Database Models - Subscription Addition
----------------------------------------
Add this to the end of models.py after the Like model.
"""


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
