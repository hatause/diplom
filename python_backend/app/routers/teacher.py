from fastapi import APIRouter, Depends, Query, Path, Body
from app.core.security import get_current_user, require_roles, TokenData
from app.services.teacher import teacher_service
from app.services.groups import groups_service
from app.services.admin import admin_service
from app.schemas.admin import SubjectCreate
from prisma.enums import Role
from typing import Optional

router = APIRouter(prefix="/teacher", tags=["Teacher"], dependencies=[Depends(require_roles([Role.TEACHER, Role.ADMIN]))])

@router.get("/dashboard")
async def get_dashboard(current_user: TokenData = Depends(get_current_user)):
    data = await teacher_service.get_dashboard(current_user.userId, current_user.role == Role.ADMIN)
    return {"success": True, "data": data}

@router.get("/students")
async def get_students(
    subjectId: Optional[str] = Query(None),
    current_user: TokenData = Depends(get_current_user)
):
    data = await teacher_service.get_students(current_user.userId, current_user.role == Role.ADMIN, subjectId)
    return {"success": True, "data": data}

@router.get("/students/{id}")
async def get_student_detail(id: str = Path(...), current_user: TokenData = Depends(get_current_user)):
    data = await teacher_service.get_student_detail(id, current_user.userId, current_user.role == Role.ADMIN)
    return {"success": True, "data": data}

@router.get("/groups")
async def get_teacher_groups(current_user: TokenData = Depends(get_current_user)):
    data = await groups_service.get_my_groups(current_user.userId, current_user.role == Role.ADMIN)
    return {"success": True, "data": data}

@router.post("/subjects")
async def create_teacher_subject(
    payload: SubjectCreate = Body(...),
    current_user: TokenData = Depends(get_current_user)
):
    if current_user.role == Role.TEACHER:
        payload.teacherId = current_user.userId
    data = await admin_service.create_subject(payload)
    return {"success": True, "data": data}
