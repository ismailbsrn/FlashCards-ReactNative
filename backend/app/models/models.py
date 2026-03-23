from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


#user model matching flutter user_model.dart
class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_sync_at = Column(DateTime, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    
    is_email_verified = Column(Boolean, default=False, nullable=False)
    email_verification_token = Column(String, nullable=True)
    email_verification_expires = Column(DateTime, nullable=True)


    collections = relationship("Collection", back_populates="user", cascade="all, delete-orphan")
    cards = relationship("Card", back_populates="user", cascade="all, delete-orphan")
    review_logs = relationship("ReviewLog", back_populates="user", cascade="all, delete-orphan")


#collection model matching Flutter collection_model.dart
class Collection(Base):
    __tablename__ = "collections"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    tags = Column(String, nullable=True)  #comma separated
    color = Column(String, nullable=True)  #hex
    created_at = Column(DateTime, default=datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    version = Column(Integer, default=1, nullable=False)


    user = relationship("User", back_populates="collections")
    cards = relationship("Card", back_populates="collection", cascade="all, delete-orphan")


#card model matching Flutter card_model.dart
class Card(Base):
    __tablename__ = "cards"

    id = Column(String, primary_key=True)
    collection_id = Column(String, ForeignKey("collections.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    front = Column(String, nullable=False)
    back = Column(String, nullable=False)
    
    #SM-2 algorithm
    ease_factor = Column(Float, default=2.5, nullable=False)
    interval = Column(Integer, default=0, nullable=False)
    repetitions = Column(Integer, default=0, nullable=False)
    next_review_date = Column(DateTime, nullable=True, index=True)
    last_review_date = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    version = Column(Integer, default=1, nullable=False)


    collection = relationship("Collection", back_populates="cards")
    user = relationship("User", back_populates="cards")
    review_logs = relationship("ReviewLog", back_populates="card", cascade="all, delete-orphan")


#reviewLog model matching Flutter review_log.dart
class ReviewLog(Base):
    __tablename__ = "review_logs"

    id = Column(String, primary_key=True)
    card_id = Column(String, ForeignKey("cards.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    quality = Column(String, nullable=False)  # 'wrong', 'hard', 'good', 'easy', 'perfect'
    reviewed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # SM-2 algorithm values at time of review (before and after)
    interval_before = Column(Integer, nullable=False)
    interval_after = Column(Integer, nullable=False)
    ease_factor_before = Column(Float, nullable=False)
    ease_factor_after = Column(Float, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


    card = relationship("Card", back_populates="review_logs")
    user = relationship("User", back_populates="review_logs")
