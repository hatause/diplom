from fastapi import APIRouter, Depends, Path, Body
from app.core.security import get_current_user, TokenData
from app.services.test import test_service
from app.schemas.tests import GenerateTestRequest, SubmitTestRequest
from typing import Any

router = APIRouter(prefix="/tests", tags=["Tests"])

@router.post("/generate")
async def generate_test(
    request: GenerateTestRequest = Body(...),
    current_user: TokenData = Depends(get_current_user)
):
    test = await test_service.generate_test(current_user.userId, request)
    return {"success": True, "data": test}

@router.get("/{id}")
async def get_test(
    id: str = Path(...),
    current_user: TokenData = Depends(get_current_user)
):
    test = await test_service.get_test(id, include_answers=False)
    return {"success": True, "data": test}

@router.post("/{id}/start")
async def start_attempt(
    id: str = Path(...),
    current_user: TokenData = Depends(get_current_user)
):
    attempt = await test_service.start_attempt(current_user.userId, id)
    return {"success": True, "data": attempt.model_dump() if hasattr(attempt, 'model_dump') else attempt}

@router.put("/{id}/progress")
async def save_progress(
    id: str = Path(...),
    progress: Any = Body(...),
    current_user: TokenData = Depends(get_current_user)
):
    result = await test_service.save_progress(id, current_user.userId, progress)
    return {"success": True, "data": {"savedAt": result.updatedAt}}

@router.post("/{id}/submit")
async def submit_test(
    id: str = Path(...),
    payload: SubmitTestRequest = Body(...),
    current_user: TokenData = Depends(get_current_user)
):
    result = await test_service.submit_attempt(id, current_user.userId, payload)
    return {"success": True, "data": result.model_dump() if hasattr(result, 'model_dump') else result}
