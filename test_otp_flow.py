import requests
import sqlite3
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"
DB_PATH = "C:\\Users\\PC\\Desktop\\uTube\\backend\\database\\utube.db"

def test_flow():
    test_email = f"sasq752+{int(time.time())}@gmail.com"
    test_username = f"user_{int(time.time())}"
    test_password = "SecurePassword123"

    print(f"--- Testing Registration for {test_email} ---")
    reg_response = requests.post(
        f"{BASE_URL}/auth/register",
        json={
            "username": test_username,
            "email": test_email,
            "password": test_password
        }
    )
    
    print(f"Status Code: {reg_response.status_code}")
    print(f"Response: {reg_response.json()}")
    assert reg_response.status_code == 201

    print("\n--- Extracting OTP from database ---")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT verification_code, is_verified FROM users WHERE email = ?", (test_email,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        print("User not found in DB!")
        return
        
    otp_code, is_verified = row
    print(f"Found OTP: {otp_code}")
    print(f"Is Verified: {is_verified}")

    print("\n--- Testing Login BEFORE Verification ---")
    login_fail = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": test_email, "password": test_password}
    )
    print(f"Status: {login_fail.status_code} (Expected 403)")
    print(f"Response: {login_fail.json()}")
    assert login_fail.status_code == 403

    print("\n--- Testing Verification ---")
    verify_response = requests.post(
        f"{BASE_URL}/auth/verify-email",
        json={"email": test_email, "code": otp_code}
    )
    print(f"Status Code: {verify_response.status_code}")
    print(f"Response: {verify_response.json()}")
    assert verify_response.status_code == 200
    assert "access_token" in verify_response.json()

    print("\n--- Testing Login AFTER Verification ---")
    login_success = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": test_email, "password": test_password}
    )
    print(f"Status: {login_success.status_code} (Expected 200)")
    print(f"Response: {login_success.json()}")
    assert login_success.status_code == 200

    print("\n✅ OTP Flow Verified Successfully!")

if __name__ == "__main__":
    test_flow()
