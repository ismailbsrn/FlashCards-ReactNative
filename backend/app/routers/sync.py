from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import User, Collection, Card, ReviewLog
from app.routers.auth import get_current_user
from app.schemas.schemas import SyncRequest, SyncResponse, CollectionUpdate, CardUpdate, ReviewLogCreate
from uuid import uuid4

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post("", response_model=SyncResponse)
def sync(
    sync_data: SyncRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sync endpoint for offline-first architecture.
    Accepts local changes and returns server changes since last sync.
    Implements Last Write Wins conflict resolution based on updated_at timestamps.
    """
    
    if sync_data.collections:
        for coll_update in sync_data.collections:
            existing = db.query(Collection).filter(
                Collection.id == coll_update.id if hasattr(coll_update, 'id') else False,
                Collection.user_id == current_user.id
            ).first()
            
            if existing:
                #last write wins
                if existing.version <= coll_update.version:
                    if coll_update.name is not None:
                        existing.name = coll_update.name
                    if coll_update.description is not None:
                        existing.description = coll_update.description
                    if coll_update.is_deleted is not None:
                        existing.is_deleted = coll_update.is_deleted
                    existing.version = coll_update.version
    
    if sync_data.cards:
        for card_update in sync_data.cards:
            existing = db.query(Card).filter(
                Card.id == card_update.id if hasattr(card_update, 'id') else False,
                Card.user_id == current_user.id
            ).first()
            
            if existing:
                #last write wins
                if existing.version <= card_update.version:
                    if card_update.front is not None:
                        existing.front = card_update.front
                    if card_update.back is not None:
                        existing.back = card_update.back
                    if card_update.collection_id is not None:
                        existing.collection_id = card_update.collection_id
                    if card_update.ease_factor is not None:
                        existing.ease_factor = card_update.ease_factor
                    if card_update.interval is not None:
                        existing.interval = card_update.interval
                    if card_update.repetitions is not None:
                        existing.repetitions = card_update.repetitions
                    if card_update.next_review_date is not None:
                        existing.next_review_date = card_update.next_review_date
                    if card_update.last_review_date is not None:
                        existing.last_review_date = card_update.last_review_date
                    if card_update.is_deleted is not None:
                        existing.is_deleted = card_update.is_deleted
                    existing.version = card_update.version
    
    if sync_data.review_logs:
        for log_create in sync_data.review_logs:
            existing = db.query(ReviewLog).filter(
                ReviewLog.id == log_create.id if hasattr(log_create, 'id') and log_create.id else False
            ).first()
            
            if not existing:
                log = ReviewLog(
                    id=log_create.id or str(uuid4()),
                    user_id=current_user.id,
                    card_id=log_create.card_id,
                    quality=log_create.quality,
                    ease_factor=log_create.ease_factor,
                    interval=log_create.interval,
                    reviewed_at=log_create.reviewed_at or datetime.utcnow()
                )
                db.add(log)
    
    db.commit()
    
    since_dt = sync_data.since
    
    coll_query = db.query(Collection).filter(Collection.user_id == current_user.id)
    if since_dt:
        coll_query = coll_query.filter(Collection.updated_at > since_dt)
    collections = coll_query.all()
    
    card_query = db.query(Card).filter(Card.user_id == current_user.id)
    if since_dt:
        card_query = card_query.filter(Card.updated_at > since_dt)
    cards = card_query.all()
    
    log_query = db.query(ReviewLog).filter(ReviewLog.user_id == current_user.id)
    if since_dt:
        log_query = log_query.filter(ReviewLog.created_at > since_dt)
    review_logs = log_query.all()
    
    current_user.last_sync_at = datetime.utcnow()
    db.commit()
    
    return SyncResponse(
        collections=collections,
        cards=cards,
        review_logs=review_logs
    )
