from fastapi import APIRouter, Depends
from app.core.security import get_current_user, TokenData
from app.services.achievements import achievements_service

router = APIRouter(prefix="/achievements", tags=["Achievements"])

@router.get("")
async def get_achievements(current_user: TokenData = Depends(get_current_user)):
    data = await achievements_service.get_achievements(current_user.userId)
    return {"success": True, "data": data}
