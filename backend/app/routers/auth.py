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
from app.core.security import (
    verify_password, get_password_hash,
    create_access_token, decode_access_token,
    generate_refresh_token, hash_refresh_token, get_refresh_token_expiry,
)
from app.models.models import User, RefreshToken
from app.schemas.schemas import (
    UserCreate, UserLogin, TokenWithUser, TokenPair,
    RefreshRequest, LogoutRequest,
    UserResponse, UserUpdate,
    PasswordResetRequest, PasswordReset, PasswordChange,
)
from app.services.email_service import (
    send_verification_email,
    send_password_reset_email,
    generate_verification_token,
    get_verification_expiry,
)

router = APIRouter(prefix="/api/auth", tags=["authentication"])

templates_dir = Path(__file__).parent.parent / "templates"
templates = Jinja2Templates(directory=str(templates_dir))
security = HTTPBearer()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Session = Depends(get_db)
) -> User:
    payload = decode_access_token(credentials.credentials)

    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Could not validate credentials")

    user_id: str = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Could not validate credentials")

    user = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="User not found")

    if settings.ENABLE_EMAIL_VERIFICATION and not user.is_email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Email not verified. Please verify your email to continue.")

    return user


def _issue_token_pair(user: User, db: Session) -> tuple[str, str]:
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        (RefreshToken.revoked == True) | (RefreshToken.expires_at < datetime.utcnow())
    ).delete(synchronize_session=False)

    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )

    raw_refresh = generate_refresh_token()
    db.add(RefreshToken(
        id=str(uuid4()),
        user_id=user.id,
        token_hash=hash_refresh_token(raw_refresh),
        expires_at=get_refresh_token_expiry(),
    ))
    db.commit()

    return access_token, raw_refresh


def cleanup_expired_registrations(db: Session):
    import re
    expired_users = db.query(User).filter(
        User.is_email_verified == False,
        User.is_deleted == False,
        User.email_verification_expires < datetime.utcnow()
    ).all()

    for expired_user in expired_users:
        pattern = f"deleted_%_{expired_user.email}"
        old_deleted_user = db.query(User).filter(
            User.email.like(pattern),
            User.is_deleted == True
        ).first()

        if old_deleted_user:
            match = re.match(r'^deleted_[^_]+_(.+)$', old_deleted_user.email)
            if match:
                old_deleted_user.email = match.group(1)

        db.delete(expired_user)

    if expired_users:
        db.commit()


# ─── Register ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenWithUser)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    cleanup_expired_registrations(db)

    if not settings.ENABLE_REGISTRATION:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Registration is currently disabled")

    if len(user_data.password) < settings.MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Password must be at least {settings.MIN_PASSWORD_LENGTH} characters")

    existing_user = db.query(User).filter(User.email == user_data.email).first()

    if existing_user and not existing_user.is_deleted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Email already registered")

    if existing_user and existing_user.is_deleted:
        original_email = existing_user.email
        existing_user.email = f"deleted_{existing_user.id}_{original_email}"
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
        email_verification_expires=verification_expires,
    )

    db.add(user)
    db.flush()

    access_token, raw_refresh = _issue_token_pair(user, db)

    if settings.ENABLE_EMAIL_VERIFICATION:
        await send_verification_email(
            email=user.email,
            token=verification_token,
            user_name=user.display_name,
        )

    message = None
    if settings.ENABLE_EMAIL_VERIFICATION and not user.is_email_verified:
        message = "Registration successful! Please check your email to verify your account."

    return TokenWithUser(
        access_token=access_token,
        refresh_token=raw_refresh,
        token_type="bearer",
        email_verified=user.is_email_verified,
        message=message,
        user=UserResponse.model_validate(user),
    )


# ─── Login ────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenWithUser)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.email == credentials.email,
        User.is_deleted == False
    ).first()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Incorrect email or password")

    access_token, raw_refresh = _issue_token_pair(user, db)

    message = None
    if settings.ENABLE_EMAIL_VERIFICATION and not user.is_email_verified:
        message = "Please verify your email before using the app. Check your inbox for the verification link."

    return TokenWithUser(
        access_token=access_token,
        refresh_token=raw_refresh,
        token_type="bearer",
        email_verified=user.is_email_verified,
        message=message,
        user=UserResponse.model_validate(user),
    )


# ─── Refresh ──────────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenPair)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    """
    Exchange a valid refresh token for a new access + refresh token pair.
    The incoming refresh token is immediately revoked (rotation).
    """
    token_hash = hash_refresh_token(body.refresh_token)

    stored = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked == False,
    ).first()

    if not stored:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid or expired refresh token")

    if stored.expires_at < datetime.utcnow():
        stored.revoked = True
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Refresh token has expired, please sign in again")

    user = db.query(User).filter(
        User.id == stored.user_id,
        User.is_deleted == False
    ).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="User not found")

    # Revoke the used token before issuing the new pair (rotation)
    stored.revoked = True
    db.flush()

    new_access, new_raw_refresh = _issue_token_pair(user, db)

    return TokenPair(
        access_token=new_access,
        refresh_token=new_raw_refresh,
    )


# ─── Logout ───────────────────────────────────────────────────────────────────

@router.post("/logout")
def logout(body: LogoutRequest, db: Session = Depends(get_db)):
    token_hash = hash_refresh_token(body.refresh_token)
    stored = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked == False,
    ).first()

    if stored:
        stored.revoked = True
        db.commit()

    return {"message": "Logged out successfully"}


# ─── Logout all devices ───────────────────────────────────────────────────────

@router.post("/logout-all")
def logout_all(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.revoked == False,
    ).update({"revoked": True}, synchronize_session=False)
    db.commit()
    return {"message": "Signed out from all devices"}


# ─── Profile ──────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Email already in use")

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
                user_name=current_user.display_name,
            )
        else:
            current_user.email = user_update.email

    db.commit()
    db.refresh(current_user)

    if email_changed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email changed. Please verify your new email address and login again.",
        )

    return current_user


# ─── Email verification ───────────────────────────────────────────────────────

@router.get("/verify-email")
async def verify_email(request: Request, token: str, db: Session = Depends(get_db)):
    accept = request.headers.get("accept", "")
    is_browser = "text/html" in accept and "application/json" not in accept

    if is_browser:
        return templates.TemplateResponse("verify_email.html", {
            "request": request,
            "token": token,
            "app_scheme": settings.APP_SCHEME,
        })

    user = db.query(User).filter(
        User.email_verification_token == token,
        User.is_deleted == False
    ).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Invalid verification token")

    if user.email_verification_expires and user.email_verification_expires < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Verification token has expired")

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
async def resend_verification(email: str, db: Session = Depends(get_db)):
    if not settings.ENABLE_EMAIL_VERIFICATION:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Email verification is not enabled")

    user = db.query(User).filter(
        User.email == email,
        User.is_deleted == False
    ).first()

    if not user:
        return {"message": "If the email exists, a verification email will be sent"}

    if user.is_email_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Email is already verified")

    user.email_verification_token = generate_verification_token()
    user.email_verification_expires = get_verification_expiry()
    db.commit()

    await send_verification_email(
        email=user.email,
        token=user.email_verification_token,
        user_name=user.display_name,
    )

    return {"message": "Verification email sent"}


# ─── Password reset ───────────────────────────────────────────────────────────

@router.post("/forgot-password")
async def forgot_password(request: PasswordResetRequest, db: Session = Depends(get_db)):
    if not settings.ENABLE_PASSWORD_RESET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Password reset is currently disabled")

    user = db.query(User).filter(
        User.email == request.email,
        User.is_deleted == False
    ).first()

    if not user:
        return {"message": "If the email exists, a password reset link will be sent"}

    user.email_verification_token = generate_verification_token()
    user.email_verification_expires = get_verification_expiry()
    db.commit()

    await send_password_reset_email(
        email=user.email,
        token=user.email_verification_token,
        user_name=user.display_name,
    )

    return {"message": "If the email exists, a password reset link will be sent"}


@router.get("/reset-password", response_class=HTMLResponse)
async def reset_password_form(request: Request, token: str):
    return templates.TemplateResponse("reset_password_form.html", {"request": request, "token": token})


@router.post("/reset-password")
async def reset_password(reset_data: PasswordReset, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.email_verification_token == reset_data.token,
        User.is_deleted == False
    ).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Invalid or expired reset token")

    if user.email_verification_expires and user.email_verification_expires < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Reset token has expired")

    if len(reset_data.new_password) < settings.MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Password must be at least {settings.MIN_PASSWORD_LENGTH} characters")

    user.hashed_password = get_password_hash(reset_data.new_password)
    user.email_verification_token = None
    user.email_verification_expires = None

    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update(
        {"revoked": True}, synchronize_session=False
    )

    db.commit()

    return {"message": "Password reset successfully. Please sign in again."}


# ─── Account management ───────────────────────────────────────────────────────

@router.delete("/me")
async def delete_account(
    password: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Incorrect password")

    current_user.is_deleted = True
    db.commit()

    return {"message": "Account deleted successfully"}


@router.post("/change-password")
async def change_password(
    password_change: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(password_change.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Current password is incorrect")

    if len(password_change.new_password) < settings.MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Password must be at least {settings.MIN_PASSWORD_LENGTH} characters")

    if verify_password(password_change.new_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="New password must be different from current password")

    current_user.hashed_password = get_password_hash(password_change.new_password)

    db.query(RefreshToken).filter(RefreshToken.user_id == current_user.id).update(
        {"revoked": True}, synchronize_session=False
    )

    db.commit()

    return {"message": "Password changed successfully. Please sign in again on all devices."}
