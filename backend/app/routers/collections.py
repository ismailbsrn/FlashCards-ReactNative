from uuid import uuid4
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import User, Collection
from app.routers.auth import get_current_user
from app.schemas.schemas import CollectionCreate, CollectionUpdate, CollectionResponse

router = APIRouter(prefix="/api/collections", tags=["collections"])


def collection_to_response(collection: Collection) -> dict:
    """Convert collection database model to response dict with tags as list"""

    tags = collection.tags.split(',') if collection.tags else []
    tags = [t.strip() for t in tags if t.strip()]
    
    return {
        "id": collection.id,
        "user_id": collection.user_id,
        "name": collection.name,
        "description": collection.description,
        "tags": tags,
        "color": collection.color,
        "created_at": collection.created_at,
        "updated_at": collection.updated_at,
        "is_deleted": collection.is_deleted,
        "version": collection.version
    }


@router.get("")
def get_collections(
    since: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all collections for the current user, optionally filtered by update time"""
    query = db.query(Collection).filter(Collection.user_id == current_user.id)
    
    if since:
        from datetime import datetime
        since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
        query = query.filter(Collection.updated_at > since_dt)
    
    collections = query.all()
    return [collection_to_response(c) for c in collections]


@router.get("/{collection_id}")
def get_collection(
    collection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific collection"""

    collection = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id
    ).first()
    
    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found"
        )
    
    return collection_to_response(collection)


@router.post("")
def create_collection(
    collection_data: CollectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new collection (with upsert behavior for sync)"""
    collection_id = collection_data.id or str(uuid4())
    
    existing_collection = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id
    ).first()
    
    if existing_collection:
        tags_str = ','.join(collection_data.tags) if collection_data.tags else None
        
        existing_collection.name = collection_data.name
        existing_collection.description = collection_data.description
        existing_collection.tags = tags_str
        existing_collection.color = collection_data.color
        existing_collection.updated_at = datetime.utcnow()
        
        if hasattr(collection_data, 'version') and collection_data.version is not None:
            existing_collection.version = collection_data.version
        else:
            existing_collection.version = existing_collection.version + 1
        
        db.commit()
        db.refresh(existing_collection)
        return collection_to_response(existing_collection)
    
    tags_str = ','.join(collection_data.tags) if collection_data.tags else None
    
    collection = Collection(
        id=collection_id,
        user_id=current_user.id,
        name=collection_data.name,
        description=collection_data.description,
        tags=tags_str,
        color=collection_data.color
    )
    
    db.add(collection)
    db.commit()
    db.refresh(collection)
    
    return collection_to_response(collection)


@router.put("/{collection_id}")
def update_collection(
    collection_id: str,
    collection_data: CollectionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a collection (used for sync)"""

    collection = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id
    ).first()
    
    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found"
        )
    
    #last write wins
    if collection.version > collection_data.version:
        return collection_to_response(collection)
    
    if collection_data.name is not None:
        collection.name = collection_data.name
    if collection_data.description is not None:
        collection.description = collection_data.description
    if collection_data.tags is not None:
        collection.tags = ','.join(collection_data.tags) if collection_data.tags else None
    if collection_data.color is not None:
        collection.color = collection_data.color
    if collection_data.is_deleted is not None:
        collection.is_deleted = collection_data.is_deleted
    
    collection.version = collection_data.version
    
    db.commit()
    db.refresh(collection)
    
    return collection_to_response(collection)


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection(
    collection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete a collection"""
    collection = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id
    ).first()
    
    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found"
        )
    
    collection.is_deleted = True
    collection.version += 1
    db.commit()
    
    return None
