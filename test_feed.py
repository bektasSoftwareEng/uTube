import os
import sys

# Add the project root to the path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from backend.database import SessionLocal
from backend.routes.recommendation_routes import get_recommended_feed

db = SessionLocal()
try:
    print("Fetching recommended feed...")
    videos = get_recommended_feed(limit=10, author_id=None, category=None, exclude_id=None, current_user=None, db=db)
    print(f"Success! Found {len(videos)} videos.")
except Exception as e:
    if hasattr(e, 'errors'):
        print([err['loc'] for err in e.errors()])
        print([err['msg'] for err in e.errors()])
    else:
        import traceback
        traceback.print_exc()
finally:
    db.close()
