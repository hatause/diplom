from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user, TokenData
from app.services.analytics import analytics_service
from typing import Optional

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("")
async def get_overall_analytics(current_user: TokenData = Depends(get_current_user)):
    data = await analytics_service.get_overall_analytics(current_user.userId)
    return {"success": True, "data": data}

@router.get("/subjects")
async def get_subject_analytics(current_user: TokenData = Depends(get_current_user)):
    data = await analytics_service.get_subject_analytics(current_user.userId)
    return {"success": True, "data": data}

@router.get("/topics")
async def get_topic_analytics(
    subjectId: Optional[str] = Query(None),
    current_user: TokenData = Depends(get_current_user)
):
    data = await analytics_service.get_topic_analytics(current_user.userId, subjectId)
    return {"success": True, "data": data}
