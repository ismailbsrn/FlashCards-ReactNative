from uuid import uuid4
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import User, Card, Collection
from app.routers.auth import get_current_user
from app.schemas.schemas import CardCreate, CardUpdate, CardResponse

router = APIRouter(prefix="/api/cards", tags=["cards"])


@router.get("", response_model=List[CardResponse])
def get_cards(
    collection_id: Optional[str] = None,
    since: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all cards for the current user, optionally filtered by collection and update time"""
    query = db.query(Card).filter(Card.user_id == current_user.id)
    
    if collection_id:
        query = query.filter(Card.collection_id == collection_id)
    
    if since:
        from datetime import datetime
        since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
        query = query.filter(Card.updated_at > since_dt)
    
    cards = query.all()
    return cards


@router.get("/{card_id}", response_model=CardResponse)
def get_card(
    card_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific card"""
    card = db.query(Card).filter(
        Card.id == card_id,
        Card.user_id == current_user.id
    ).first()
    
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found"
        )
    
    return card


@router.post("", response_model=CardResponse)
def create_card(
    card_data: CardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new card (or update if exists during sync)"""

    collection = db.query(Collection).filter(
        Collection.id == card_data.collection_id,
        Collection.user_id == current_user.id
    ).first()
    
    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found"
        )
    
    card_id = card_data.id or str(uuid4())
    existing_card = db.query(Card).filter(
        Card.id == card_id,
        Card.user_id == current_user.id
    ).first()
    
    if existing_card:
        existing_card.collection_id = card_data.collection_id
        existing_card.front = card_data.front
        existing_card.back = card_data.back
        existing_card.updated_at = datetime.now(timezone.utc)
        
        if hasattr(card_data, 'ease_factor') and card_data.ease_factor is not None:
            existing_card.ease_factor = card_data.ease_factor
        if hasattr(card_data, 'interval') and card_data.interval is not None:
            existing_card.interval = card_data.interval
        if hasattr(card_data, 'repetitions') and card_data.repetitions is not None:
            existing_card.repetitions = card_data.repetitions
        if hasattr(card_data, 'next_review_date') and card_data.next_review_date is not None:
            existing_card.next_review_date = card_data.next_review_date
        if hasattr(card_data, 'last_review_date') and card_data.last_review_date is not None:
            existing_card.last_review_date = card_data.last_review_date
        if hasattr(card_data, 'version') and card_data.version is not None:
            existing_card.version = card_data.version
            
        db.commit()
        db.refresh(existing_card)
        return existing_card
    
    card = Card(
        id=card_id,
        user_id=current_user.id,
        collection_id=card_data.collection_id,
        front=card_data.front,
        back=card_data.back
    )
    
    db.add(card)
    db.commit()
    db.refresh(card)
    
    return card


@router.put("/{card_id}", response_model=CardResponse)
def update_card(
    card_id: str,
    card_data: CardUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a card (used for sync and spaced repetition)"""
    card = db.query(Card).filter(
        Card.id == card_id,
        Card.user_id == current_user.id
    ).first()
    
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found"
        )
    
    #last write wins
    if card.version > card_data.version:
        return card
    
    if card_data.front is not None:
        card.front = card_data.front
    if card_data.back is not None:
        card.back = card_data.back
    if card_data.collection_id is not None:
        card.collection_id = card_data.collection_id
    if card_data.ease_factor is not None:
        card.ease_factor = card_data.ease_factor
    if card_data.interval is not None:
        card.interval = card_data.interval
    if card_data.repetitions is not None:
        card.repetitions = card_data.repetitions
    if card_data.next_review_date is not None:
        card.next_review_date = card_data.next_review_date
    if card_data.last_review_date is not None:
        card.last_review_date = card_data.last_review_date
    if card_data.is_deleted is not None:
        card.is_deleted = card_data.is_deleted
    
    card.version = card_data.version
    
    db.commit()
    db.refresh(card)
    
    return card


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card(
    card_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete a card"""
    
    card = db.query(Card).filter(
        Card.id == card_id,
        Card.user_id == current_user.id
    ).first()
    
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found"
        )
    
    card.is_deleted = True
    card.version += 1
    db.commit()
    
    return None
