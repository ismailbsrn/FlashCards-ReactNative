from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


# ==========================================
# USER
# ==========================================
class UserBase(BaseModel):
    email: EmailStr
    display_name: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    email: Optional[EmailStr] = None


class UserResponse(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime
    last_sync_at: Optional[datetime] = None
    is_deleted: bool
    version: int
    is_email_verified: bool

    class Config:
        from_attributes = True

# ==========================================
# TOKEN
# ==========================================
class Token(BaseModel):
    access_token: str
    token_type: str
    email_verified: Optional[bool] = None
    message: Optional[str] = None


class TokenWithUser(BaseModel):
    access_token: str
    token_type: str
    email_verified: bool
    message: Optional[str] = None
    user: UserResponse


class TokenData(BaseModel):
    user_id: Optional[str] = None


# ==========================================
# PASSWORD RESET
# ==========================================
class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordReset(BaseModel):
    token: str
    new_password: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


# ==========================================
# COLLECTIONS
# ==========================================
class CollectionBase(BaseModel):
    name: str
    description: Optional[str] = None
    tags: Optional[list[str]] = None
    color: Optional[str] = None


class CollectionCreate(CollectionBase):
    id: Optional[str] = None


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[list[str]] = None
    color: Optional[str] = None
    is_deleted: Optional[bool] = None
    version: int


class CollectionResponse(CollectionBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    is_deleted: bool
    version: int

    class Config:
        from_attributes = True


# ==========================================
# CARDS
# ==========================================
class CardBase(BaseModel):
    front: str
    back: str
    collection_id: str


class CardCreate(CardBase):
    id: Optional[str] = None
    ease_factor: Optional[float] = None
    interval: Optional[int] = None
    repetitions: Optional[int] = None
    next_review_date: Optional[datetime] = None
    last_review_date: Optional[datetime] = None
    version: Optional[int] = None


class CardUpdate(BaseModel):
    front: Optional[str] = None
    back: Optional[str] = None
    collection_id: Optional[str] = None
    ease_factor: Optional[float] = None
    interval: Optional[int] = None
    repetitions: Optional[int] = None
    next_review_date: Optional[datetime] = None
    last_review_date: Optional[datetime] = None
    is_deleted: Optional[bool] = None
    version: int


class CardResponse(CardBase):
    id: str
    user_id: str
    ease_factor: float
    interval: int
    repetitions: int
    next_review_date: Optional[datetime] = None
    last_review_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    is_deleted: bool
    version: int

    class Config:
        from_attributes = True


# ==========================================
# REVIEWLOG
# ==========================================
class ReviewLogBase(BaseModel):
    card_id: str
    quality: str
    interval_before: int
    interval_after: int
    ease_factor_before: float
    ease_factor_after: float


class ReviewLogCreate(ReviewLogBase):
    id: Optional[str] = None
    reviewed_at: Optional[datetime] = None


class ReviewLogResponse(ReviewLogBase):
    id: str
    user_id: str
    reviewed_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# SYNC
# ==========================================
class SyncRequest(BaseModel):
    since: Optional[datetime] = None
    collections: Optional[list[CollectionUpdate]] = None
    cards: Optional[list[CardUpdate]] = None
    review_logs: Optional[list[ReviewLogCreate]] = None


class SyncResponse(BaseModel):
    collections: list[CollectionResponse]
    cards: list[CardResponse]
    review_logs: list[ReviewLogResponse]
