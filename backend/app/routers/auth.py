from datetime import timedelta, datetime
from typing import Annotated
from uuid import uuid4
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, decode_access_token
from app.models.models import User
from app.schemas.schemas import UserCreate, UserLogin, Token, TokenWithUser, UserResponse, UserUpdate, PasswordResetRequest, PasswordReset, PasswordChange
from app.services.email_service import (
    send_verification_email, 
    send_password_reset_email,
    generate_verification_token,
    get_verification_expiry
)

router = APIRouter(prefix="/api/auth", tags=["authentication"])

# Setup templates
templates_dir = Path(__file__).parent.parent / "templates"
templates = Jinja2Templates(directory=str(templates_dir))
security = HTTPBearer()


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    
    user_id: str = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    
    user = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    if settings.ENABLE_EMAIL_VERIFICATION and not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email to continue."
        )
    
    return user


def cleanup_expired_registrations(db: Session):
    """
    Clean up expired unverified registrations and restore renamed emails.
    Called during registration to keep the database clean.
    """
    import re
    
    expired_users = db.query(User).filter(
        User.is_email_verified == False,
        User.is_deleted == False,
        User.email_verification_expires < datetime.utcnow()
    ).all()
    
    for expired_user in expired_users:
        #deleted_{uuid}_{original_email}
        pattern = f"deleted_%_{expired_user.email}"
        old_deleted_user = db.query(User).filter(
            User.email.like(pattern),
            User.is_deleted == True
        ).first()
        
        if old_deleted_user:
            #deleted_{uuid}_{original_email}
            match = re.match(r'^deleted_[^_]+_(.+)$', old_deleted_user.email)
            if match:
                original_email = match.group(1)
                old_deleted_user.email = original_email
        
        db.delete(expired_user)
    
    if expired_users:
        db.commit()


@router.post("/register", response_model=TokenWithUser)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    
    cleanup_expired_registrations(db)
    
    if not settings.ENABLE_REGISTRATION:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is currently disabled"
        )
    
    if len(user_data.password) < settings.MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {settings.MIN_PASSWORD_LENGTH} characters"
        )
    
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    
    if existing_user and not existing_user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    original_email_backup = None
    if existing_user and existing_user.is_deleted:
        original_email_backup = existing_user.email
        existing_user.email = f"deleted_{existing_user.id}_{original_email_backup}"
        db.flush()
    
    verification_token = generate_verification_token()
    verification_expires = get_verification_expiry()
    
    user = User(
        id=str(uuid4()),
        email=user_data.email,
        display_name=user_data.display_name,
        hashed_password=get_password_hash(user_data.password),
        is_email_verified=not settings.ENABLE_EMAIL_VERIFICATION,
        email_verification_token=verification_token,
        email_verification_expires=verification_expires
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    if settings.ENABLE_EMAIL_VERIFICATION:
        await send_verification_email(
            email=user.email,
            token=verification_token,
            user_name=user.display_name
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    
    message = None
    if settings.ENABLE_EMAIL_VERIFICATION and not user.is_email_verified:
        message = "Registration successful! Please check your email to verify your account."
    
    return TokenWithUser(
        access_token=access_token,
        token_type="bearer",
        email_verified=user.is_email_verified,
        message=message,
        user=UserResponse.model_validate(user)
    )


@router.post("/login", response_model=TokenWithUser)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Login with email and password"""
    user = db.query(User).filter(
        User.email == credentials.email,
        User.is_deleted == False
    ).first()
    
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    
    #return with verification status and user info
    message = None
    if settings.ENABLE_EMAIL_VERIFICATION and not user.is_email_verified:
        message = "Please verify your email before using the app. Check your inbox for the verification link."
    
    return TokenWithUser(
        access_token=access_token,
        token_type="bearer",
        email_verified=user.is_email_verified,
        message=message,
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return current_user


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user profile"""
    
    email_changed = False
    
    if user_update.display_name is not None:
        current_user.display_name = user_update.display_name if user_update.display_name else None
    
    if user_update.email is not None and user_update.email != current_user.email:
        existing_user = db.query(User).filter(
            User.email == user_update.email,
            User.id != current_user.id,
            User.is_deleted == False
        ).first()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use"
            )
        
        if settings.ENABLE_EMAIL_VERIFICATION:
            verification_token = generate_verification_token()
            verification_expires = get_verification_expiry()
            
            current_user.email = user_update.email
            current_user.is_email_verified = False
            current_user.email_verification_token = verification_token
            current_user.email_verification_expires = verification_expires
            email_changed = True
            
            await send_verification_email(
                email=user_update.email,
                token=verification_token,
                user_name=current_user.display_name
            )
        else:
            current_user.email = user_update.email
    
    db.commit()
    db.refresh(current_user)
    
    #verification is required, raise 403 to force re-login
    if email_changed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email changed. Please verify your new email address and login again."
        )
    
    return current_user


@router.get("/verify-email")
async def verify_email(token: str, db: Session = Depends(get_db)):
    """Verify user email address"""

    user = db.query(User).filter(
        User.email_verification_token == token,
        User.is_deleted == False
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token"
        )
    
    if user.email_verification_expires and user.email_verification_expires < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired"
        )
    
    if user.is_email_verified:
        return {"message": "Email already verified"}
    
    old_deleted_user = db.query(User).filter(
        User.email.like(f"deleted_%_{user.email}"),
        User.is_deleted == True
    ).first()
    
    if old_deleted_user:
        db.delete(old_deleted_user)
    
    user.is_email_verified = True
    user.email_verification_token = None
    user.email_verification_expires = None
    
    db.commit()
    
    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_verification(
    email: str,
    db: Session = Depends(get_db)
):
    """Resend email verification"""
    
    if not settings.ENABLE_EMAIL_VERIFICATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email verification is not enabled"
        )
    
    user = db.query(User).filter(
        User.email == email,
        User.is_deleted == False
    ).first()
    
    if not user:
        return {"message": "If the email exists, a verification email will be sent"}
    
    if user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already verified"
        )
    
    verification_token = generate_verification_token()
    verification_expires = get_verification_expiry()
    
    user.email_verification_token = verification_token
    user.email_verification_expires = verification_expires
    
    db.commit()
    
    await send_verification_email(
        email=user.email,
        token=verification_token,
        user_name=user.display_name
    )
    
    return {"message": "Verification email sent"}


@router.post("/forgot-password")
async def forgot_password(
    request: PasswordResetRequest,
    db: Session = Depends(get_db)
):
    """Request password reset"""
    
    if not settings.ENABLE_PASSWORD_RESET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password reset is currently disabled"
        )
    
    user = db.query(User).filter(
        User.email == request.email,
        User.is_deleted == False
    ).first()
    
    if not user:
        return {"message": "If the email exists, a password reset link will be sent"}
    
    reset_token = generate_verification_token()
    reset_expires = get_verification_expiry()
    
    user.email_verification_token = reset_token
    user.email_verification_expires = reset_expires
    
    db.commit()
    
    await send_password_reset_email(
        email=user.email,
        token=reset_token,
        user_name=user.display_name
    )
    
    return {"message": "If the email exists, a password reset link will be sent"}

#for safe fallback
@router.get("/reset-password", response_class=HTMLResponse)
async def reset_password_form(request: Request, token: str):
    """Serve the password reset form HTML page"""

    return templates.TemplateResponse("reset_password_form.html", {"request": request, "token": token})


@router.post("/reset-password")
async def reset_password(
    reset_data: PasswordReset,
    db: Session = Depends(get_db)
):
    """Reset password with token (API endpoint)"""
    
    user = db.query(User).filter(
        User.email_verification_token == reset_data.token,
        User.is_deleted == False
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    if user.email_verification_expires and user.email_verification_expires < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired"
        )
    
    if len(reset_data.new_password) < settings.MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {settings.MIN_PASSWORD_LENGTH} characters"
        )
    
    user.hashed_password = get_password_hash(reset_data.new_password)
    user.email_verification_token = None
    user.email_verification_expires = None
    
    db.commit()
    
    return {"message": "Password reset successfully"}


@router.delete("/me")
async def delete_account(
    password: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete the current user's account (soft delete)"""
    
    if not verify_password(password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password"
        )
    
    current_user.is_deleted = True
    db.commit()
    
    return {"message": "Account deleted successfully"}


@router.post("/change-password")
async def change_password(
    password_change: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change password for authenticated user"""
    
    if not verify_password(password_change.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    if len(password_change.new_password) < settings.MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {settings.MIN_PASSWORD_LENGTH} characters"
        )
    
    if verify_password(password_change.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password"
        )
    
    current_user.hashed_password = get_password_hash(password_change.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}
