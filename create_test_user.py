import sys
sys.path.append('.') # Add root to path so backend imports work
from backend.database.database import SessionLocal
from backend.database.models import User
from backend.core.security import hash_password

db = SessionLocal()

existing = db.query(User).filter(User.username == "testadmin").first()
if not existing:
    test_user = User(
        username="testadmin",
        email="testadmin@example.com",
        password_hash=hash_password("Password123!"),
        is_verified=True
    )
    db.add(test_user)
    db.commit()
    print("Created verified test user: testadmin@example.com / Password123!")
else:
    print("User already exists!")
db.close()
