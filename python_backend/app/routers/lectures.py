from fastapi import APIRouter, Depends
from app.core.security import get_current_user, require_roles, TokenData
from app.services.lectures import lectures_service
from app.schemas.lectures import LectureCreate
from prisma.enums import Role

router = APIRouter(prefix="/lectures", tags=["Lectures"])

@router.get("/public")
async def get_public_lectures(current_user: TokenData = Depends(get_current_user)):
    data = await lectures_service.get_public_lectures()
    return {"success": True, "data": data}

@router.get("/group/{group_id}")
async def get_group_lectures(group_id: str, current_user: TokenData = Depends(get_current_user)):
    data = await lectures_service.get_group_lectures(group_id, current_user.userId)
    return {"success": True, "data": data}

@router.get("/{lecture_id}")
async def get_lecture(lecture_id: str, current_user: TokenData = Depends(get_current_user)):
    data = await lectures_service.get_lecture(lecture_id, current_user.userId)
    return {"success": True, "data": data}

@router.post("")
async def create_lecture(
    payload: LectureCreate,
    current_user: TokenData = Depends(require_roles([Role.TEACHER, Role.ADMIN]))
):
    data = await lectures_service.create_lecture(current_user.userId, payload)
    return {"success": True, "data": data}

@router.post("/{lecture_id}/explain")
async def explain_lecture(lecture_id: str, current_user: TokenData = Depends(get_current_user)):
    data = await lectures_service.explain_lecture(lecture_id, current_user.userId)
    return {"success": True, "data": data}

@router.post("/{lecture_id}/generate-test")
async def generate_test(lecture_id: str, current_user: TokenData = Depends(get_current_user)):
    data = await lectures_service.generate_test(lecture_id, current_user.userId)
    return {"success": True, "data": data}


@router.post("/{lecture_id}/extract-text")
async def extract_text(lecture_id: str, current_user: TokenData = Depends(get_current_user)):
    data = await lectures_service.extract_text(lecture_id, current_user.userId)
    return {"success": True, "data": data}
