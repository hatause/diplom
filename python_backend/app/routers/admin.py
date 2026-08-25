from fastapi import APIRouter, Depends, Query, Path, Body
from app.core.security import get_current_user, require_roles, TokenData
from app.schemas.admin import UserCreate, UserUpdate, GroupCreate, GroupTeacherAdd, SubjectCreate, TopicCreate
from app.services.admin import admin_service
from typing import Optional
from prisma.enums import Role

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_roles([Role.ADMIN]))])

@router.get("/users")
async def get_users(
    page: int = Query(1),
    limit: int = Query(20),
    search: str = Query(""),
    role: Optional[Role] = Query(None)
):
    result = await admin_service.get_users(page, limit, search, role)
    return {"success": True, "data": result}

@router.post("/users")
async def create_user(payload: UserCreate = Body(...)):
    user = await admin_service.create_user(payload)
    return {"success": True, "data": user}

@router.put("/users/{id}")
async def update_user(
    id: str = Path(...),
    payload: UserUpdate = Body(...),
    current_user: TokenData = Depends(get_current_user)
):
    user = await admin_service.update_user(current_user.userId, id, payload)
    return {"success": True, "data": user}

@router.delete("/users/{id}")
async def deactivate_user(
    id: str = Path(...),
    current_user: TokenData = Depends(get_current_user)
):
    await admin_service.deactivate_user(current_user.userId, id)
    return {"success": True}

@router.get("/groups")
async def get_groups():
    groups = await admin_service.get_groups()
    return {"success": True, "data": groups}

@router.post("/groups")
async def create_group(payload: GroupCreate = Body(...)):
    group = await admin_service.create_group(payload)
    return {"success": True, "data": group}

@router.post("/groups/{id}/teachers")
async def add_teacher_to_group(
    id: str = Path(...),
    payload: GroupTeacherAdd = Body(...)
):
    group = await admin_service.add_teacher_to_group(id, payload.teacherId)
    return {"success": True, "data": group}

@router.get("/subjects")
async def get_subjects():
    subjects = await admin_service.get_subjects()
    return {"success": True, "data": subjects}

@router.post("/subjects")
async def create_subject(payload: SubjectCreate = Body(...)):
    subject = await admin_service.create_subject(payload)
    return {"success": True, "data": subject}

@router.post("/subjects/{id}/topics")
async def create_topic(
    id: str = Path(...),
    payload: TopicCreate = Body(...)
):
    topic = await admin_service.create_topic(id, payload)
    return {"success": True, "data": topic}

@router.get("/dashboard")
async def get_dashboard():
    stats = await admin_service.get_dashboard_stats()
    return {"success": True, "data": stats}
