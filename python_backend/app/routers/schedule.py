from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user, TokenData
from app.services.schedule import schedule_service
from typing import Optional

router = APIRouter(prefix="/schedule", tags=["Schedule"])

@router.get("")
async def get_schedule(
    group: Optional[str] = Query(None),
    current_user: TokenData = Depends(get_current_user)
):
    data = await schedule_service.get_schedule(group)
    return {"success": True, "data": data}

@router.get("/today")
async def get_today(
    group: Optional[str] = Query(None),
    current_user: TokenData = Depends(get_current_user)
):
    data = await schedule_service.get_today(group)
    return {"success": True, "data": data}

@router.get("/week")
async def get_week(
    group: Optional[str] = Query(None),
    current_user: TokenData = Depends(get_current_user)
):
    data = await schedule_service.get_week(group)
    return {"success": True, "data": data}

@router.get("/status")
async def get_status(current_user: TokenData = Depends(get_current_user)):
    data = schedule_service.get_status()
    return {"success": True, "data": data}
