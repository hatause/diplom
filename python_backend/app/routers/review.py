from fastapi import APIRouter, Depends
from app.core.security import get_current_user, TokenData
from app.services.review import review_service

router = APIRouter(prefix="/review", tags=["Review"])

@router.get("")
async def get_due_topics(current_user: TokenData = Depends(get_current_user)):
    data = await review_service.get_due_topics(current_user.userId)
    return {"success": True, "data": data}
