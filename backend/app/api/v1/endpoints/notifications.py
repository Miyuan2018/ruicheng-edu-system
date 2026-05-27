from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.security import get_current_user, CurrentUser
from app.schemas.notification import NotificationListResponse, NotificationResponse
from app.schemas.common import PaginationParams
from app.services.notification_service import NotificationService

router = APIRouter()


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    unread_only: bool = Query(False, description="仅显示未读"),
    pag: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    items, total, unread_count = await NotificationService.get_user_notifications(
        db,
        recipient_id=current_user.id,
        unread_only=unread_only,
        skip=pag.skip,
        limit=pag.limit,
    )
    return {
        "total": total,
        "unread_count": unread_count,
        "items": [NotificationResponse.model_validate(i) for i in items],
    }


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    notification = await NotificationService.mark_as_read(
        db, notification_id=notification_id, recipient_id=current_user.id
    )
    if not notification:
        raise HTTPException(status_code=404, detail="通知不存在")
    return NotificationResponse.model_validate(notification)


@router.post("/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    count = await NotificationService.mark_all_as_read(db, recipient_id=current_user.id)
    return {"ok": True, "marked_count": count}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    ok = await NotificationService.delete_notification(
        db, notification_id=notification_id, recipient_id=current_user.id
    )
    if not ok:
        raise HTTPException(status_code=404, detail="通知不存在")
    return {"ok": True}


@router.get("/count/unread")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _, _, unread_count = await NotificationService.get_user_notifications(
        db, recipient_id=current_user.id, unread_only=False, skip=0, limit=1
    )
    return {"unread_count": unread_count}
