from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user, TokenData
from app.services.schedule import schedule_service
from typing import Optional
from app.db.database import prisma

router = APIRouter(prefix="/schedule", tags=["Schedule"])


async def resolve_group(group: Optional[str], user: TokenData):
    if group is not None or user.role != "STUDENT":
        return group
    profile = await prisma.studentprofile.find_unique(where={"userId": user.userId}, include={"group": True})
    # An unassigned student must not receive every group's timetable.
    return profile.group.code if profile and profile.group else ""

@router.get("")
async def get_schedule(
    group: Optional[str] = Query(None),
    current_user: TokenData = Depends(get_current_user)
):
    data = await schedule_service.get_schedule(await resolve_group(group, current_user))
    return {"success": True, "data": data}

@router.get("/today")
async def get_today(
    group: Optional[str] = Query(None),
    current_user: TokenData = Depends(get_current_user)
):
    data = await schedule_service.get_today(await resolve_group(group, current_user))
    return {"success": True, "data": data}

@router.get("/week")
async def get_week(
    group: Optional[str] = Query(None),
    current_user: TokenData = Depends(get_current_user)
):
    data = await schedule_service.get_week(await resolve_group(group, current_user))
    return {"success": True, "data": data}

@router.get("/status")
async def get_status(current_user: TokenData = Depends(get_current_user)):
    data = schedule_service.get_status()
    return {"success": True, "data": data}
