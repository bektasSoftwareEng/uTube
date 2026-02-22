"""
Security and Authentication Utilities
--------------------------------------
Handles password hashing, JWT token generation, and user authentication.

Features:
- Password hashing with bcrypt
- JWT token generation and validation
- User authentication helpers
"""

from datetime import datetime, timedelta
from typing import Optional, Union
import bcrypt
import secrets
from jose import JWTError, jwt
from fastapi import HTTPException, status
from pathlib import Path

from backend.core.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

import os

def secure_resolve(base_dir: Path, sub_path: Union[str, Path]) -> Path:
    """
    Resolve a user-provided path and ensure it stays within the base directory.
    Prevents Path Traversal vulnerabilities (CodeQL compliant).
    """
    try:
        # Prevent absolute path injection by stripping leading slashes
        sub_path_str = str(sub_path).lstrip("/\\")
        
        # Determine the absolute base directory
        base_dir_str = os.path.abspath(str(base_dir))
        
        # Construct the final absolute target path
        target_path_str = os.path.abspath(os.path.normpath(os.path.join(base_dir_str, sub_path_str)))
        
        # Ensure correct trailing slash on the prefix to prevent partial matches 
        # (e.g., base_dir="/safe", target_path="/safe_hacked" -> would normally pass without trailing slash)
        prefix = base_dir_str if base_dir_str.endswith(os.sep) else base_dir_str + os.sep
        
        # Validate that the target path is strictly within the base directory
        # Allowing target_path_str == base_dir_str in case the root directory itself is being referenced.
        if target_path_str != base_dir_str and not target_path_str.startswith(prefix):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Invalid file path."
            )
            
        return Path(target_path_str)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Invalid file path.")

def generate_stream_key() -> str:
    """Generate a secure, random stream key for OBS RTMP."""
    return f"live_{secrets.token_hex(16)}"

# Password hashing configuration
# We use direct bcrypt for better compatibility with Python 3.13


def hash_password(password: str) -> str:
    """
    Hash a plain text password using bcrypt.
    
    Args:
        password: Plain text password to hash
        
    Returns:
        Hashed password string
    """
    # bcrypt expects bytes
    password_bytes = password.encode('utf-8')
    # Generate salt and hash
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    # Return as string for database storage
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain text password against a hashed password.
    
    Args:
        plain_password: Plain text password to verify
        hashed_password: Hashed password from database
        
    Returns:
        True if password matches, False otherwise
    """
    try:
        # Encode both to bytes
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        # Verify
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: Dictionary of data to encode in the token (e.g., {"sub": user_id})
        expires_delta: Optional custom expiration time
        
    Returns:
        Encoded JWT token string
        
    Example:
        >>> token = create_access_token({"sub": "user123"})
        >>> print(token)
        eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    """
    to_encode = data.copy()
    
    # Ensure 'sub' is a string (requirement for some JWT libraries)
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    
    # Set expiration time
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    
    # Encode the JWT
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    """
    Decode and validate a JWT access token.
    
    Args:
        token: JWT token string to decode
        
    Returns:
        Decoded token payload if valid
        
    Raises:
        JWTError: If token is invalid or expired
    """
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return payload


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validate password strength.
    
    Requirements:
    - At least 8 characters
    - Contains at least one uppercase letter
    - Contains at least one lowercase letter
    - Contains at least one digit
    
    Args:
        password: Password to validate
        
    Returns:
        Tuple of (is_valid, error_message)
        
    Example:
        >>> validate_password_strength("weak")
        (False, "Password must be at least 8 characters long")
        >>> validate_password_strength("StrongPass123")
        (True, "")
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
    
    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter"
    
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit"
    
    return True, ""


def validate_email(email: str) -> bool:
    """
    Basic email validation.
    
    Args:
        email: Email address to validate
        
    Returns:
        True if email format is valid, False otherwise
        
    Example:
        >>> validate_email("user@example.com")
        True
        >>> validate_email("invalid-email")
        False
    """
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


# Test the security functions
if __name__ == "__main__":
    print("Testing Security Functions")
    print("=" * 60)
    
    # Test password hashing
    password = "TestPassword123"
    hashed = hash_password(password)
    print("\n1. Password Hashing:")
    print(f"   Original: {password}")
    print(f"   Hashed: {hashed[:50]}...")
    print(f"   Verify correct: {verify_password(password, hashed)}")
    print(f"   Verify wrong: {verify_password('WrongPassword', hashed)}")
    
    # Test JWT token
    print("\n2. JWT Token:")
    token = create_access_token({"sub": "user123", "username": "john_doe"})
    print(f"   Token: {token[:50]}...")
    decoded = decode_access_token(token)
    print(f"   Decoded: {decoded}")
    
    # Test password validation
    print("\n3. Password Validation:")
    test_passwords = ["weak", "WeakPass", "weakpass123", "StrongPass123"]
    for pwd in test_passwords:
        valid, msg = validate_password_strength(pwd)
        status = "✓" if valid else "✗"
        print(f"   {status} '{pwd}': {msg if msg else 'Valid'}")
    
    # Test email validation
    print("\n4. Email Validation:")
    test_emails = ["user@example.com", "invalid", "test@test", "valid.email@domain.co.uk"]
    for email in test_emails:
        valid = validate_email(email)
        status = "✓" if valid else "✗"
        print(f"   {status} {email}")
    
    print("\n" + "=" * 60)
