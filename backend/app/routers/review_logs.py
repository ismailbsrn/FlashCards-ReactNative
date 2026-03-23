from uuid import uuid4
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import User, ReviewLog, Card
from app.routers.auth import get_current_user
from app.schemas.schemas import ReviewLogCreate, ReviewLogResponse

router = APIRouter(prefix="/api/review-logs", tags=["review-logs"])


@router.get("", response_model=List[ReviewLogResponse])
def get_review_logs(
    card_id: Optional[str] = None,
    since: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all review logs for the current user"""

    query = db.query(ReviewLog).filter(ReviewLog.user_id == current_user.id)
    
    if card_id:
        query = query.filter(ReviewLog.card_id == card_id)
    
    if since:
        from datetime import datetime
        since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
        query = query.filter(ReviewLog.created_at > since_dt)
    
    logs = query.order_by(ReviewLog.reviewed_at.desc()).all()
    return logs


@router.post("", response_model=ReviewLogResponse)
def create_review_log(
    log_data: ReviewLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new review log (or update if exists during sync)"""
    
    card = db.query(Card).filter(
        Card.id == log_data.card_id,
        Card.user_id == current_user.id
    ).first()
    
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found"
        )
    
    log_id = log_data.id or str(uuid4())
    existing_log = db.query(ReviewLog).filter(
        ReviewLog.id == log_id,
        ReviewLog.user_id == current_user.id
    ).first()
    
    if existing_log:
        return existing_log
    
    log = ReviewLog(
        id=log_id,
        user_id=current_user.id,
        card_id=log_data.card_id,
        quality=log_data.quality,
        interval_before=log_data.interval_before,
        interval_after=log_data.interval_after,
        ease_factor_before=log_data.ease_factor_before,
        ease_factor_after=log_data.ease_factor_after,
        reviewed_at=log_data.reviewed_at
    )
    
    db.add(log)
    db.commit()
    db.refresh(log)
    
    return log
