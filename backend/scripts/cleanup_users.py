"""
User Cleanup Script
-------------------
Removes all non-synthetic users from the database.
Synthetic users (is_synthetic=1) are preserved for testing purposes.
"""

import sys
import os
from pathlib import Path

# Add project root to python path so we can import backend
# This script is located at backend/scripts/cleanup_users.py
# So we need to go up two levels to get to the project root
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(ROOT_DIR))

from backend.database import SessionLocal
from backend.database.models import User

def cleanup_users():
    """Delete all users where is_synthetic is False (0)."""
    db = SessionLocal()
    try:
        # Find all non-synthetic users
        # logic: is_synthetic=0 means False, is_synthetic=1 means True
        users_to_delete = db.query(User).filter(User.is_synthetic == 0).all()
        
        count = len(users_to_delete)
        if count == 0:
            print("No non-synthetic users found. Database is already clean.")
            return

        print(f"Found {count} non-synthetic users to delete.")
        
        # Cascading deletes are handled by SQLAlchemy models (cascade='all, delete-orphan')
        for user in users_to_delete:
            print(f"Deleting user: {user.username} (ID: {user.id})")
            db.delete(user)
        
        db.commit()
        print(f"\nSuccessfully deleted {count} users and their associated content.")
        
    except Exception as e:
        db.rollback()
        print(f"An error occurred during cleanup: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    print("Starting User Cleanup...")
    cleanup_users()
    print("Cleanup Complete.")
