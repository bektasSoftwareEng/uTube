"""
Authentication Routes
---------------------
Handles user registration, login, and authentication.

Endpoints:
- POST /register: Create a new user account
- POST /login: Authenticate and get access token
- GET /me: Get current user information
"""

from jose import JWTError
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from typing import Optional

from backend.database import get_db
from backend.database.models import User
from backend.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    validate_password_strength,
    validate_email
)

# Create router
router = APIRouter(prefix="/auth", tags=["Authentication"])

# Security scheme for JWT
security = HTTPBearer()


# ============================================================================
# Pydantic Models (Request/Response Schemas)
# ============================================================================

class UserRegister(BaseModel):
    """Request model for user registration."""
    username: str = Field(..., min_length=3, max_length=50, description="Username (3-50 characters)")
    email: EmailStr = Field(..., description="Valid email address")
    password: str = Field(..., min_length=8, description="Password (min 8 characters)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "username": "john_doe",
                "email": "john@example.com",
                "password": "SecurePass123"
            }
        }


class UserLogin(BaseModel):
    """Request model for user login."""
    email: EmailStr = Field(..., description="Email address")
    password: str = Field(..., description="Password")
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "john@example.com",
                "password": "SecurePass123"
            }
        }


class Token(BaseModel):
    """Response model for authentication token."""
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str


class UserResponse(BaseModel):
    """Response model for user information."""
    id: int
    username: str
    email: str
    profile_image: Optional[str]
    created_at: str
    
    class Config:
        from_attributes = True


# ============================================================================
# Dependency: Get Current User
# ============================================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to get the current authenticated user from JWT token.
    
    Usage in routes:
    ```python
    @router.get("/protected")
    def protected_route(current_user: User = Depends(get_current_user)):
        return {"message": f"Hello {current_user.username}"}
    ```
    
    Args:
        credentials: HTTP Bearer token from Authorization header
        db: Database session
        
    Returns:
        User object if token is valid
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    # Extract token from credentials and strip whitespace
    token = credentials.credentials.strip()
    
    # Robustly handle cases where 'Bearer ' prefix might be duplicated or case-mismatched
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
    
    # Decode token with detailed error handling
    try:
        payload = decode_access_token(token)
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token decoding failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user ID from token and ensure it's an integer
    try:
        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing subject (user ID) claim",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id = int(sub)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format in token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user from database
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"User with ID {user_id} not found in database",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Dependency to get the current user if a valid token is provided,
    otherwise returns None without raising an exception.
    """
    if not credentials:
        return None
        
    try:
        # Extract token and strip whitespace
        token = credentials.credentials.strip()
        if token.lower().startswith("bearer "):
            token = token[7:].strip()
            
        payload = decode_access_token(token)
        user_id = int(payload.get("sub"))
        return db.query(User).filter(User.id == user_id).first()
    except Exception:
        return None


# ============================================================================
# Routes
# ============================================================================

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """
    Register a new user account.
    
    Steps:
    1. Validate email format
    2. Check if email/username already exists
    3. Validate password strength
    4. Hash password
    5. Create user in database
    6. Generate JWT token
    
    Args:
        user_data: User registration data
        db: Database session
        
    Returns:
        JWT access token and user info
        
    Raises:
        HTTPException 400: If email/username exists or validation fails
    """
    # Validate email format
    if not validate_email(user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format"
        )
    
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if username already exists
    existing_username = db.query(User).filter(User.username == user_data.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Validate password strength
    is_valid, error_msg = validate_password_strength(user_data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Hash password
    hashed_password = hash_password(user_data.password)
    
    # Create new user
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hashed_password
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Generate access token
    access_token = create_access_token({"sub": new_user.id})
    
    return Token(
        access_token=access_token,
        user_id=new_user.id,
        username=new_user.username
    )


@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate user and return JWT token.
    
    Steps:
    1. Find user by email
    2. Verify password
    3. Generate JWT token
    
    Args:
        credentials: User login credentials
        db: Database session
        
    Returns:
        JWT access token and user info
        
    Raises:
        HTTPException 401: If credentials are invalid
    """
    # Find user by email
    user = db.query(User).filter(User.email == credentials.email).first()
    
    # Check if user exists and password is correct
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate access token
    access_token = create_access_token({"sub": user.id})
    
    return Token(
        access_token=access_token,
        user_id=user.id,
        username=user.username
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user information.
    
    Requires valid JWT token in Authorization header:
    Authorization: Bearer <token>
    
    Args:
        current_user: Current authenticated user (from dependency)
        
    Returns:
        User information
    """
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        profile_image=current_user.profile_image,
        created_at=current_user.created_at.isoformat()
    )


# ============================================================================
# Optional: Password Reset (Placeholder)
# ============================================================================

@router.post("/forgot-password")
def forgot_password(email: EmailStr, db: Session = Depends(get_db)):
    """
    Request password reset (placeholder for future implementation).
    
    In production, this would:
    1. Generate a reset token
    2. Send email with reset link
    3. Store token with expiration
    """
    user = db.query(User).filter(User.email == email).first()
    
    # Always return success to prevent email enumeration
    return {
        "message": "If the email exists, a password reset link has been sent"
    }
