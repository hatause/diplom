from fastapi import APIRouter, Depends, Path, HTTPException
from app.core.security import get_current_user, TokenData
from app.services.subjects import subjects_service

router = APIRouter(prefix="/subjects", tags=["Subjects"])

@router.get("")
async def get_all_subjects(current_user: TokenData = Depends(get_current_user)):
    data = await subjects_service.get_all_subjects(current_user.userId)
    return {"success": True, "data": data}

@router.get("/{id}")
async def get_subject_by_id(
    id: str = Path(...),
    current_user: TokenData = Depends(get_current_user)
):
    data = await subjects_service.get_subject_by_id(id, current_user.userId)
    if not data:
        raise HTTPException(status_code=404, detail="Subject not found")
    return {"success": True, "data": data}
