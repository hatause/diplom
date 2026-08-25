from fastapi import APIRouter, Depends, Path, Body
from app.core.security import get_current_user, TokenData
from app.services.feynman import feynman_service
from app.schemas.feynman import FeynmanCreateRequest, FeynmanExplainRequest

router = APIRouter(prefix="/feynman", tags=["Feynman Learning Mode"])


@router.post("/sessions")
async def create_session(
    payload: FeynmanCreateRequest = Body(...),
    current_user: TokenData = Depends(get_current_user),
):
    data = await feynman_service.create_session(
        current_user.userId, payload.topic, payload.subjectId
    )
    return {"success": True, "data": data}


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str = Path(...),
    current_user: TokenData = Depends(get_current_user),
):
    data = await feynman_service.get_session(current_user.userId, session_id)
    return {"success": True, "data": data}


@router.post("/sessions/{session_id}/explain")
async def send_explanation(
    session_id: str = Path(...),
    payload: FeynmanExplainRequest = Body(...),
    current_user: TokenData = Depends(get_current_user),
):
    data = await feynman_service.send_explanation(
        current_user.userId, session_id, payload.explanation
    )
    return {"success": True, "data": data}


@router.post("/sessions/{session_id}/complete")
async def complete_session(
    session_id: str = Path(...),
    current_user: TokenData = Depends(get_current_user),
):
    data = await feynman_service.complete_session(current_user.userId, session_id)
    return {"success": True, "data": data}
