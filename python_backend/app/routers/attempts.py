from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user, TokenData
from app.services.attempts import attempts_service
from typing import Optional
from prisma.enums import AttemptStatus

router = APIRouter(prefix="/attempts", tags=["Attempts"])

@router.get("")
async def get_all_attempts(
    status: Optional[AttemptStatus] = Query(None),
    subjectId: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1),
    current_user: TokenData = Depends(get_current_user)
):
    data = await attempts_service.get_user_attempts(
        user_id=current_user.userId,
        status=status,
        subject_id=subjectId,
        page=page,
        limit=limit
    )
    return {"success": True, "data": data}

@router.get("/{attempt_id}")
async def get_attempt_detail(attempt_id: str, current_user: TokenData = Depends(get_current_user)):
    data = await attempts_service.get_attempt_detail(attempt_id, current_user.userId)
    return {"success": True, "data": data}

@router.get("/{attempt_id}/result")
async def get_attempt_result(attempt_id: str, current_user: TokenData = Depends(get_current_user)):
    data = await attempts_service.get_attempt_result(attempt_id, current_user.userId)
    return {"success": True, "data": data}
