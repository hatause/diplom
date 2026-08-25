from fastapi import APIRouter, Depends, Path, Body
from app.core.security import get_current_user, TokenData
from app.services.debate import debate_service
from app.schemas.debate import DebateCreateRequest, DebateArgueRequest

router = APIRouter(prefix="/debate", tags=["Debate Mode"])


@router.post("/sessions")
async def create_session(
    payload: DebateCreateRequest = Body(...),
    current_user: TokenData = Depends(get_current_user),
):
    data = await debate_service.create_session(
        current_user.userId, payload.topic, payload.position, payload.subjectId
    )
    return {"success": True, "data": data}


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str = Path(...),
    current_user: TokenData = Depends(get_current_user),
):
    data = await debate_service.get_session(current_user.userId, session_id)
    return {"success": True, "data": data}


@router.post("/sessions/{session_id}/argue")
async def send_argument(
    session_id: str = Path(...),
    payload: DebateArgueRequest = Body(...),
    current_user: TokenData = Depends(get_current_user),
):
    data = await debate_service.send_argument(
        current_user.userId, session_id, payload.argument
    )
    return {"success": True, "data": data}


@router.post("/sessions/{session_id}/complete")
async def complete_session(
    session_id: str = Path(...),
    current_user: TokenData = Depends(get_current_user),
):
    data = await debate_service.complete_session(current_user.userId, session_id)
    return {"success": True, "data": data}
