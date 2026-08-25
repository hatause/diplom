from fastapi import APIRouter, Depends, Path, Body
from app.core.security import get_current_user, require_roles, TokenData
from app.services.groups import groups_service
from app.schemas.groups import GroupCreate, StudentAssign
from prisma.enums import Role

router = APIRouter(prefix="/groups", tags=["Groups"])

@router.get("/my", dependencies=[Depends(require_roles([Role.TEACHER, Role.ADMIN]))])
async def get_my_groups(current_user: TokenData = Depends(get_current_user)):
    data = await groups_service.get_my_groups(current_user.userId, current_user.role == Role.ADMIN)
    return {"success": True, "data": data}

@router.post("", dependencies=[Depends(require_roles([Role.TEACHER, Role.ADMIN]))])
async def create_group(
    payload: GroupCreate = Body(...),
    current_user: TokenData = Depends(get_current_user)
):
    data = await groups_service.create_group(current_user.userId, payload)
    return {"success": True, "data": data}

@router.get("/{id}/students", dependencies=[Depends(require_roles([Role.TEACHER, Role.ADMIN]))])
async def get_group_students(
    id: str = Path(...),
    current_user: TokenData = Depends(get_current_user)
):
    data = await groups_service.get_group_students(id, current_user.userId, current_user.role)
    return {"success": True, "data": data}

@router.get("/unassigned-students", dependencies=[Depends(require_roles([Role.TEACHER, Role.ADMIN]))])
async def get_unassigned_students():
    data = await groups_service.get_unassigned_students()
    return {"success": True, "data": data}

@router.post("/{id}/students", dependencies=[Depends(require_roles([Role.TEACHER, Role.ADMIN]))])
async def assign_student(
    id: str = Path(...),
    payload: StudentAssign = Body(...)
):
    data = await groups_service.assign_student(id, payload)
    return {"success": True, "data": data}

@router.delete("/{id}", dependencies=[Depends(require_roles([Role.ADMIN]))])
async def delete_group(id: str = Path(...)):
    data = await groups_service.delete_group(id)
    return data
