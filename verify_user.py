import sqlite3
import os

db_path = 'backend/database/utube.db'
if not os.path.exists(db_path):
    print("DB not found at", db_path)
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET is_verified = 1 WHERE email = 'tester123@gmail.com'")
    conn.commit()
    print(f"Updated {cursor.rowcount} rows.")
    conn.close()
